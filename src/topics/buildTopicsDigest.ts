import { getAllArticles, getAllRssItems } from "../storage/db";
import {
  rankArticlesForQuery,
  rankRssHeadlinesForQuery,
  rssItemToSearchArticle,
} from "../search/relevance";
import type { ArticleRecord, RssItem } from "../types";
import { TOPIC_LANES, type TopicLane } from "./topicLanes";

export type TopicDigestHit = {
  id: string;
  laneId: string;
  laneLabel: string;
  laneIcon: string;
  query: string;
  score: number;
  matchLabel: "high" | "medium" | "low";
  article: ArticleRecord;
  sourceKind: "indexed" | "headline";
};

export type TopicsDigest = {
  generatedAt: number;
  hits: TopicDigestHit[];
  stats: {
    totalLanes: number;
    lanesWithHits: number;
    headlineHits: number;
    indexedHits: number;
  };
};

export type BuildTopicsDigestOptions = {
  /** Top picks per lane (default 1 for a clean mix). */
  perLane?: number;
  lanes?: TopicLane[];
};

function articleFromRss(item: RssItem): ArticleRecord {
  return rssItemToSearchArticle(item);
}

function pickLaneHits(
  lane: TopicLane,
  rssItems: RssItem[],
  articles: ArticleRecord[],
  indexedUrls: Set<string>,
  perLane: number,
): TopicDigestHit[] {
  const rankedHeadlines = rankRssHeadlinesForQuery(rssItems, lane.query, indexedUrls, perLane * 3);
  const rankedIndexed = rankArticlesForQuery(articles, lane.query, perLane * 3);

  const rssById = new Map(rssItems.map((r) => [r.id, r]));
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const candidates: TopicDigestHit[] = [];

  for (const h of rankedIndexed) {
    const article = articleById.get(h.id);
    if (!article) continue;
    candidates.push({
      id: `${lane.id}:indexed:${article.id}`,
      laneId: lane.id,
      laneLabel: lane.label,
      laneIcon: lane.icon,
      query: lane.query,
      score: h.score,
      matchLabel: h.matchLabel,
      article,
      sourceKind: "indexed",
    });
  }

  for (const h of rankedHeadlines) {
    const item = rssById.get(h.id);
    if (!item) continue;
    candidates.push({
      id: `${lane.id}:headline:${item.id}`,
      laneId: lane.id,
      laneLabel: lane.label,
      laneIcon: lane.icon,
      query: lane.query,
      score: h.score,
      matchLabel: h.matchLabel,
      article: articleFromRss(item),
      sourceKind: "headline",
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const seenUrls = new Set<string>();
  const picked: TopicDigestHit[] = [];
  for (const c of candidates) {
    const url = c.article.url;
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    picked.push(c);
    if (picked.length >= perLane) break;
  }

  return picked;
}

export async function buildTopicsDigest(options: BuildTopicsDigestOptions = {}): Promise<TopicsDigest> {
  const perLane = options.perLane ?? 1;
  const lanes = options.lanes ?? TOPIC_LANES;

  const [rssItems, articles] = await Promise.all([getAllRssItems(), getAllArticles()]);
  const indexedUrls = new Set(articles.map((a) => a.url));

  const hits: TopicDigestHit[] = [];
  const lanesWithHits = new Set<string>();

  for (const lane of lanes) {
    const laneHits = pickLaneHits(lane, rssItems, articles, indexedUrls, perLane);
    for (const hit of laneHits) {
      hits.push(hit);
      lanesWithHits.add(lane.id);
    }
  }

  hits.sort((a, b) => b.score - a.score);

  return {
    generatedAt: Date.now(),
    hits,
    stats: {
      totalLanes: lanes.length,
      lanesWithHits: lanesWithHits.size,
      headlineHits: hits.filter((h) => h.sourceKind === "headline").length,
      indexedHits: hits.filter((h) => h.sourceKind === "indexed").length,
    },
  };
}
