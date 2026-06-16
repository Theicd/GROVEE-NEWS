import Dexie, { type Table } from "dexie";
import { isBlockedArticle, isBlockedRssItem } from "../feeds/blockedFeeds";
import type { ArticleRecord, RssItem, StoryCluster } from "../types";

export class NewsDb extends Dexie {
  rssItems!: Table<RssItem, string>;
  articles!: Table<ArticleRecord, string>;
  clusters!: Table<StoryCluster, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("grovee-news-intel");
    this.version(1).stores({
      rssItems: "id, publishedTs, sourceKey, link",
      articles: "id, publishedTs, sourceKey, clusterId, url",
      clusters: "id, updatedAt",
      meta: "key",
    });
  }
}

export const db = new NewsDb();

export async function upsertRssItems(items: RssItem[]): Promise<number> {
  let n = 0;
  const allowed = items.filter((item) => !isBlockedRssItem(item));
  await db.transaction("rw", db.rssItems, async () => {
    for (const item of allowed) {
      const exists = await db.rssItems.get(item.id);
      if (!exists) {
        await db.rssItems.put(item);
        n++;
      }
    }
  });
  return n;
}

export async function upsertArticle(article: ArticleRecord): Promise<void> {
  await db.articles.put(article);
}

export async function patchArticleImage(id: string, image: string): Promise<void> {
  if (!id || !image) return;
  const article = await db.articles.get(id);
  if (!article || article.image) return;
  await db.articles.put({ ...article, image });
}

export async function upsertCluster(cluster: StoryCluster): Promise<void> {
  await db.clusters.put(cluster);
}

export async function getArticleCount(): Promise<number> {
  return db.articles.count();
}

export async function getAllArticles(limit = 5000): Promise<ArticleRecord[]> {
  const articles = await db.articles.orderBy("publishedTs").reverse().limit(limit).toArray();
  return articles.filter((a) => !isBlockedArticle(a));
}

export async function getAllClusters(): Promise<StoryCluster[]> {
  return db.clusters.orderBy("updatedAt").reverse().toArray();
}

export async function getMultiSourceClusters(): Promise<StoryCluster[]> {
  const all = await getAllClusters();
  return all.filter((c) => c.sourceKeys.length > 1);
}

export async function getCluster(id: string): Promise<StoryCluster | undefined> {
  return db.clusters.get(id);
}

export async function getArticlesByCluster(clusterId: string): Promise<ArticleRecord[]> {
  return db.articles.where("clusterId").equals(clusterId).toArray();
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}

export async function getMeta(key: string): Promise<string | null> {
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function getRssHeadlineCount(): Promise<number> {
  return db.rssItems.count();
}

export async function getSummarizedCount(): Promise<number> {
  return db.articles.filter((a) => a.summarizedAt > 0).count();
}

export async function getPendingArticleCount(): Promise<number> {
  return (await listPendingRssItems(5000)).length;
}

export async function getRecentArticles(limit = 8): Promise<ArticleRecord[]> {
  const all = await db.articles.toArray();
  return all
    .filter((a) => !isBlockedArticle(a))
    .sort((a, b) => (b.fetchedAt || b.publishedTs) - (a.fetchedAt || a.publishedTs))
    .slice(0, limit);
}

/** Articles with summaries, newest publish time first — for the home feed */
export async function getSummarizedArticles(limit = 150): Promise<ArticleRecord[]> {
  const all = await db.articles.toArray();
  return all
    .filter((a) => Boolean(a.summary?.trim()) && !isBlockedArticle(a))
    .sort((a, b) => {
      const ta = a.publishedTs || a.summarizedAt || a.fetchedAt || 0;
      const tb = b.publishedTs || b.summarizedAt || b.fetchedAt || 0;
      return tb - ta;
    })
    .slice(0, limit);
}

export async function getAllRssItems(limit = 5000): Promise<RssItem[]> {
  const items = await db.rssItems.orderBy("publishedTs").reverse().limit(limit).toArray();
  return items.filter((item) => !isBlockedRssItem(item));
}

/** Remove blocked outlets (e.g. Al Jazeera) from local storage. */
export async function purgeBlockedNewsSources(): Promise<{ articles: number; rss: number }> {
  const articles = (await db.articles.toArray()).filter(isBlockedArticle);
  const rss = (await db.rssItems.toArray()).filter(isBlockedRssItem);
  const removedArticleIds = new Set(articles.map((a) => a.id));

  await db.transaction("rw", db.articles, db.rssItems, db.clusters, async () => {
    for (const a of articles) await db.articles.delete(a.id);
    for (const r of rss) await db.rssItems.delete(r.id);

    const clusters = await db.clusters.toArray();
    for (const cluster of clusters) {
      const keptIds = cluster.articleIds.filter((id) => !removedArticleIds.has(id));
      if (keptIds.length === 0) {
        await db.clusters.delete(cluster.id);
        continue;
      }
      if (keptIds.length !== cluster.articleIds.length) {
        const keptArticles = await db.articles.bulkGet(keptIds);
        const sourceKeys = [...new Set(keptArticles.filter(Boolean).map((a) => a!.sourceKey))];
        await db.clusters.put({
          ...cluster,
          articleIds: keptIds,
          sourceKeys,
        });
      }
    }
  });

  return { articles: articles.length, rss: rss.length };
}

export async function listPendingRssItems(limit = 30): Promise<RssItem[]> {
  const articleUrls = new Set((await db.articles.toArray()).map((a) => a.url));
  const all = await getAllRssItems(5000);
  const pending = all.filter((r) => !articleUrls.has(r.link));

  // Round-robin by category so tech / TCM / dev are not starved by world-news volume
  const buckets = new Map<string, RssItem[]>();
  for (const item of pending) {
    const cat = item.category || "world";
    const list = buckets.get(cat) ?? [];
    list.push(item);
    buckets.set(cat, list);
  }
  for (const [cat, list] of buckets) {
    list.sort((a, b) => b.publishedTs - a.publishedTs);
    buckets.set(cat, list);
  }

  const categories = [...buckets.keys()].sort();
  const picked: RssItem[] = [];
  let round = 0;
  while (picked.length < limit) {
    let any = false;
    for (const cat of categories) {
      const list = buckets.get(cat)!;
      if (round < list.length) {
        picked.push(list[round]);
        any = true;
        if (picked.length >= limit) break;
      }
    }
    if (!any) break;
    round++;
  }
  return picked;
}
