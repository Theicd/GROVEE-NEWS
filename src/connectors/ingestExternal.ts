import { getAllArticles, upsertArticle } from "../storage/db";
import { summarizeArticle } from "../summarize/summarizerClient";
import { normalizeSummarizerResult } from "../summarize/summaryQuality";
import type { ArticleRecord } from "../types";
import { fetchGithubTrending } from "./githubConnector";
import { fetchHfNewModels } from "./hfConnector";
import type { ExternalIntelItem } from "./types";

export type IngestExternalResult = {
  github: number;
  hf: number;
  skipped: number;
};

async function articleExists(url: string, existing: Set<string>): Promise<boolean> {
  return existing.has(url);
}

async function ingestOne(item: ExternalIntelItem, existing: Set<string>): Promise<boolean> {
  if (await articleExists(item.url, existing)) return false;

  const rawSum = await summarizeArticle(item.bodyText);
  const sum = normalizeSummarizerResult(rawSum, item.description, item.bodyText, item.title);

  const article: ArticleRecord = {
    id: item.id,
    url: item.url,
    source: item.source,
    sourceKey: item.sourceKey,
    title: item.title,
    image: item.image,
    publishDate: item.publishDate,
    publishedTs: item.publishedTs,
    articleText: item.bodyText,
    summary: sum.summary,
    keyFacts: sum.keyFacts,
    keywords: [...sum.keywords, item.feedCategory, item.intelSource],
    entities: sum.entities,
    clusterId: item.id,
    confidence: "LOW",
    fetchedAt: Date.now(),
    summarizedAt: Date.now(),
    language: "en",
    feedCategory: item.feedCategory,
    intelSource: item.intelSource,
  };

  await upsertArticle(article);
  existing.add(item.url);
  return true;
}

export async function ingestExternalSources(opts: {
  maxGithub?: number;
  maxHf?: number;
}): Promise<IngestExternalResult> {
  const maxGithub = opts.maxGithub ?? 4;
  const maxHf = opts.maxHf ?? 4;
  const existing = new Set((await getAllArticles()).map((a) => a.url));

  let github = 0;
  let hf = 0;
  let skipped = 0;

  const [ghItems, hfItems] = await Promise.all([
    fetchGithubTrending(maxGithub + 4).catch(() => [] as ExternalIntelItem[]),
    fetchHfNewModels(maxHf + 4).catch(() => [] as ExternalIntelItem[]),
  ]);

  for (const item of ghItems) {
    if (github >= maxGithub) break;
    const ok = await ingestOne(item, existing);
    if (ok) github++;
    else skipped++;
  }

  for (const item of hfItems) {
    if (hf >= maxHf) break;
    const ok = await ingestOne(item, existing);
    if (ok) hf++;
    else skipped++;
  }

  return { github, hf, skipped };
}
