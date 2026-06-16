import { getMultiSourceClusters, getSummarizedArticles } from "../storage/db";
import { hasDisplayableContent } from "../summarize/summaryQuality";
import type { ArticleRecord, StoryCluster } from "../types";
import { articleTimestamp } from "./time";

export type TrendingFeedItem = {
  kind: "trending";
  id: string;
  cluster: StoryCluster;
  articles: ArticleRecord[];
  lead: ArticleRecord;
  mergedFacts: string[];
  popularity: number;
  sortTs: number;
};

export type ArticleFeedItem = {
  kind: "article";
  id: string;
  article: ArticleRecord;
  sortTs: number;
};

export type FeedItem = TrendingFeedItem | ArticleFeedItem;

const CONFIDENCE_SCORE: Record<StoryCluster["confidence"], number> = {
  HIGH: 30,
  MEDIUM: 18,
  LOW: 8,
};

function groupByCluster(articles: ArticleRecord[]): Map<string, ArticleRecord[]> {
  const map = new Map<string, ArticleRecord[]>();
  for (const a of articles) {
    if (!a.clusterId) continue;
    const list = map.get(a.clusterId) ?? [];
    list.push(a);
    map.set(a.clusterId, list);
  }
  return map;
}

function clusterSortTs(articles: ArticleRecord[]): number {
  return Math.max(0, ...articles.map(articleTimestamp));
}

export async function buildNewsFeed(articleLimit = 150): Promise<FeedItem[]> {
  const [multi, summarized] = await Promise.all([
    getMultiSourceClusters(),
    getSummarizedArticles(articleLimit),
  ]);

  const byCluster = groupByCluster(summarized);
  const items: FeedItem[] = [];
  const usedIds = new Set<string>();

  const sortedClusters = [...multi].sort((a, b) => {
    const sa = b.sourceKeys.length * 10 + CONFIDENCE_SCORE[b.confidence];
    const sb = a.sourceKeys.length * 10 + CONFIDENCE_SCORE[a.confidence];
    return sa - sb;
  });

  for (const cluster of sortedClusters) {
    const articles = (byCluster.get(cluster.id) ?? [])
      .filter((a) => a.summary?.trim() && hasDisplayableContent(a));
    if (!articles.length) continue;

    const lead =
      articles.find((a) => a.image && articleTimestamp(a) === clusterSortTs(articles)) ??
      articles.find((a) => a.image) ??
      articles.find((a) => a.summarizedAt > 0) ??
      articles[0];

    const mergedFacts = [...new Set(articles.flatMap((a) => a.keyFacts))].slice(0, 4);
    const sortTs = clusterSortTs(articles);

    items.push({
      kind: "trending",
      id: cluster.id,
      cluster,
      articles,
      lead,
      mergedFacts,
      popularity: cluster.sourceKeys.length * 10 + CONFIDENCE_SCORE[cluster.confidence],
      sortTs,
    });

    for (const a of articles) usedIds.add(a.id);
  }

  for (const article of summarized) {
    if (usedIds.has(article.id)) continue;
    if (!hasDisplayableContent(article)) continue;
    items.push({
      kind: "article",
      id: article.id,
      article,
      sortTs: articleTimestamp(article),
    });
  }

  // Newest stories first — hour-level freshness over static trending rank
  return items.sort((a, b) => b.sortTs - a.sortTs);
}
