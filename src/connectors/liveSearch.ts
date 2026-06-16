import { buildSearchTerms, expandQueryKeywords } from "../search/relevance";
import type { ArticleRecord, SearchHit } from "../types";
import { githubApiPausedMinutesLeft, isGithubApiPaused } from "./githubRateLimit";
import { searchGithubOnDemand } from "./githubSearch";
import { searchHfOnDemand } from "./hfSearch";
import { shouldSearchGithub, shouldSearchHf } from "./searchIntent";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordMatch(text: string, term: string): boolean {
  if (!text || !term) return false;
  if (term.includes(" ")) return text.includes(term);
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);
}

function scoreLiveArticle(article: ArticleRecord, searchTerms: string[]): number {
  const hay = [
    article.title,
    article.summary,
    article.displaySummary ?? "",
    article.articleText,
    article.keywords.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const term of searchTerms) {
    if (wordMatch(hay, term)) score += 28;
    else if (hay.includes(term)) score += 12;
  }
  return score;
}

function queryBoost(query: string, kind: "github" | "huggingface"): number {
  const q = query.toLowerCase();
  if (kind === "github" && /\bgithub\b/.test(q)) return 35;
  if (kind === "huggingface" && /\b(huggingface|hugging\s*face|hug)\b/.test(q)) return 35;
  return 0;
}

export type LiveSearchResult = {
  hits: SearchHit[];
  githubCount: number;
  hfCount: number;
  githubSkipped: boolean;
  hfSkipped: boolean;
  githubRateLimited: boolean;
};

/**
 * Live GitHub + Hugging Face — only when query explicitly names each site.
 */
export async function searchLiveConnectors(query: string): Promise<LiveSearchResult> {
  const q = query.trim();
  const empty: LiveSearchResult = {
    hits: [],
    githubCount: 0,
    hfCount: 0,
    githubSkipped: true,
    hfSkipped: true,
    githubRateLimited: false,
  };
  if (!q) return empty;

  const wantGithub = shouldSearchGithub(q);
  const wantHf = shouldSearchHf(q);
  const githubRateLimited = wantGithub && isGithubApiPaused();

  if (!wantGithub && !wantHf) return empty;

  const searchTerms = buildSearchTerms(q);

  const [githubArticles, hfArticles] = await Promise.all([
    wantGithub && !githubRateLimited
      ? searchGithubOnDemand(q).catch(() => [] as ArticleRecord[])
      : Promise.resolve([] as ArticleRecord[]),
    wantHf ? searchHfOnDemand(q).catch(() => [] as ArticleRecord[]) : Promise.resolve([] as ArticleRecord[]),
  ]);

  const hits: SearchHit[] = [];

  for (const article of githubArticles) {
    const score = scoreLiveArticle(article, searchTerms) + queryBoost(q, "github") + 40;
    if (score < 12 && expandQueryKeywords(q).length > 1) continue;
    hits.push({ article, cluster: null, score, sourceKind: "github" });
  }

  for (const article of hfArticles) {
    const score = scoreLiveArticle(article, searchTerms) + queryBoost(q, "huggingface") + 40;
    if (score < 12 && expandQueryKeywords(q).length > 1) continue;
    hits.push({ article, cluster: null, score, sourceKind: "huggingface" });
  }

  hits.sort((a, b) => b.score - a.score);

  return {
    hits,
    githubCount: githubArticles.length,
    hfCount: hfArticles.length,
    githubSkipped: !wantGithub,
    hfSkipped: !wantHf,
    githubRateLimited,
  };
}

export { githubApiPausedMinutesLeft };
