import { fetchRemoteJson } from "../fetch/remoteJson";
import { cacheGet, cacheSet } from "./apiCache";
import { githubResultLimit, githubSearchTerms, parseGithubRepoRef } from "./searchIntent";
import { expandQueryKeywords } from "../search/relevance";
import { isGithubApiPaused, isGithubRateLimitError, pauseGithubApi } from "./githubRateLimit";
import type { ArticleRecord } from "../types";

type GhSearchResponse = {
  items?: GhRepo[];
  total_count?: number;
};

type GhRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  topics?: string[];
  owner?: { avatar_url?: string };
  updated_at: string;
  default_branch?: string;
};

const CACHE_STORE = "github_search";

function buildGithubSearchQuery(userQuery: string): string {
  const topic = githubSearchTerms(userQuery);
  const terms = expandQueryKeywords(topic).filter((t) => t.length > 1 && t !== "github").slice(0, 5);
  const core = terms.length ? terms.join(" ") : topic;
  return `${core} in:name,description`;
}

export function githubRepoToArticle(repo: GhRepo): ArticleRecord {
  const desc = repo.description?.trim() ?? "";
  const topics = (repo.topics ?? []).slice(0, 6);
  const branch = repo.default_branch ?? "main";
  const now = Date.now();
  const ts = Date.parse(repo.updated_at) || now;

  return {
    id: `gh-live::${repo.id}`,
    url: repo.html_url,
    source: "GitHub",
    sourceKey: "github_search",
    title: repo.full_name,
    image: repo.owner?.avatar_url ?? "",
    publishDate: new Date(ts).toISOString(),
    publishedTs: ts,
    articleText: [desc, topics.length ? `Topics: ${topics.join(", ")}` : "", `Language: ${repo.language ?? "—"}`]
      .filter(Boolean)
      .join("\n"),
    summary: desc || `Open-source repository — ${repo.stargazers_count} stars`,
    keyFacts: [
      `⭐ ${repo.stargazers_count.toLocaleString()} stars`,
      repo.language ? `Language: ${repo.language}` : "",
      ...topics.slice(0, 3).map((t) => `Topic: ${t}`),
      `Browse files: ${repo.html_url}/tree/${branch}`,
    ].filter(Boolean),
    keywords: ["github", "repository", ...topics],
    entities: [repo.full_name.split("/")[0] ?? ""],
    clusterId: `gh-live::${repo.id}`,
    confidence: repo.stargazers_count > 500 ? "HIGH" : repo.stargazers_count > 50 ? "MEDIUM" : "LOW",
    fetchedAt: now,
    summarizedAt: 0,
    language: "en",
    feedCategory: "dev",
    intelSource: "github",
  };
}

/** One API call — exact repo by `owner/name` or URL in query. */
export async function fetchGithubRepoByName(fullName: string): Promise<ArticleRecord | null> {
  const key = `repo::${fullName.toLowerCase()}`;
  const cached = cacheGet<ArticleRecord>(CACHE_STORE, key);
  if (cached) return cached;

  if (isGithubApiPaused()) return null;

  try {
    const url = `https://api.github.com/repos/${fullName}`;
    const repo = await fetchRemoteJson<GhRepo>(url, 12_000);
    const article = githubRepoToArticle(repo);
    cacheSet(CACHE_STORE, key, article);
    return article;
  } catch (err) {
    if (isGithubRateLimitError(err)) pauseGithubApi();
    return null;
  }
}

export async function searchGithubRepositories(query: string, limit = 12): Promise<ArticleRecord[]> {
  const cacheKey = `q::${buildGithubSearchQuery(query)}::${limit}`;
  const cached = cacheGet<ArticleRecord[]>(CACHE_STORE, cacheKey);
  if (cached) return cached;

  if (isGithubApiPaused()) return [];

  try {
    const q = encodeURIComponent(buildGithubSearchQuery(query));
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${Math.min(limit, 15)}`;
    const data = await fetchRemoteJson<GhSearchResponse>(url, 18_000);
    const items = (data.items ?? []).slice(0, limit).map(githubRepoToArticle);
    cacheSet(CACHE_STORE, cacheKey, items);
    return items;
  } catch (err) {
    if (isGithubRateLimitError(err)) pauseGithubApi();
    throw err;
  }
}

/** On-demand GitHub lookup — direct repo or search, with cache + rate-limit guard. */
export async function searchGithubOnDemand(query: string): Promise<ArticleRecord[]> {
  const repoRef = parseGithubRepoRef(query);
  if (repoRef) {
    const direct = await fetchGithubRepoByName(repoRef);
    return direct ? [direct] : [];
  }
  const limit = githubResultLimit(query);
  return searchGithubRepositories(query, limit);
}
