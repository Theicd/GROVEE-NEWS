import { ensureEnglishDisplay } from "../display/englishDisplay";
import { searchLiveConnectors } from "../connectors/liveSearch";
import { buildDailyBriefing } from "../briefing/buildBriefing";
import { ENGLISH_NEWS_FEEDS, FEED_BY_KEY, RSS_POLL_INTERVAL_MS } from "../feeds/englishFeeds";
import { normalizeArticleBody } from "../extract/normalizeArticleBody";
import { assignClusters } from "../dedup/clusters";
import { extractArticleFromUrl } from "../extract/readabilityExtract";
import { fetchArticleImage } from "../extract/articleImage";
import { fetchRemoteText } from "../fetch/remoteFetch";
import { getCachedRssXml } from "../fetch/rssCache";
import { parseRssXml } from "../rss/parser";
import { rankArticlesForQuery, rankRssHeadlinesForQuery, rssItemToSearchArticle, buildSearchTerms, sanitizeAiKeywords } from "../search/relevance";
import { ensureSearchIndexLoaded, indexArticles, resetSearchIndex } from "../search/flexIndex";
import {
  db,
  getAllArticles,
  getAllClusters,
  getAllRssItems,
  getArticleCount,
  getCluster,
  getMultiSourceClusters,
  getPendingArticleCount,
  getRssHeadlineCount,
  purgeBlockedNewsSources,
  getSummarizedCount,
  listPendingRssItems,
  setMeta,
  upsertArticle,
  upsertCluster,
  upsertRssItems,
} from "../storage/db";
import { expandQuery, getModelBootState, isSummarizerReady, subscribeModelBoot, summarizeArticle, waitForSummarizer } from "../summarize/summarizerClient";
import { needsEnglishDisplay } from "../summarize/languageDetect";
import { isFailedExtraction, normalizeSummarizerResult, pickDisplaySummary } from "../summarize/summaryQuality";
import type {
  ActivityEntry,
  ActivityKind,
  ArticleRecord,
  EngineStatus,
  FeedPollStatus,
  IntelBundle,
  LastSearchInfo,
  LastSummaryInfo,
  RssItem,
  SearchHit,
} from "../types";

export type SearchUpdate = {
  phase: "indexed" | "headlines" | "live" | "refined" | "done";
  hits: SearchHit[];
};

const EXPAND_QUERY_TIMEOUT_MS = 2_500;

async function expandQueryFast(query: string): Promise<string[]> {
  return Promise.race([
    expandQuery(query).catch(() => [] as string[]),
    new Promise<string[]>((resolve) => {
      setTimeout(() => resolve([]), EXPAND_QUERY_TIMEOUT_MS);
    }),
  ]);
}

function dedupeSearchHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const sorted = [...hits].sort((a, b) => b.score - a.score);
  const out: SearchHit[] = [];
  for (const hit of sorted) {
    const key = hit.article.url || hit.article.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

async function loadClusters(ids: string[]): Promise<Map<string, Awaited<ReturnType<typeof getCluster>>>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const pairs = await Promise.all(unique.map(async (id) => [id, await getCluster(id)] as const));
  return new Map(pairs);
}

async function buildHitsFromRanked(
  rankedArticles: { id: string; score: number }[],
  rankedHeadlines: { id: string; score: number }[],
  articles: ArticleRecord[],
  rssItems: RssItem[],
  liveHits: SearchHit[],
  clusterMap: Map<string, Awaited<ReturnType<typeof getCluster>>>,
): Promise<SearchHit[]> {
  const byId = new Map(articles.map((a) => [a.id, a]));
  const rssById = new Map(rssItems.map((r) => [r.id, r]));
  const results: SearchHit[] = [];
  const seenUrls = new Set<string>();

  for (const h of rankedArticles) {
    const article = byId.get(h.id);
    if (!article) continue;
    seenUrls.add(article.url);
    const cluster = article.clusterId ? (clusterMap.get(article.clusterId) ?? null) : null;
    results.push({ article, cluster, score: h.score, sourceKind: "indexed" });
  }

  for (const h of rankedHeadlines) {
    const item = rssById.get(h.id);
    if (!item) continue;
    if (seenUrls.has(item.link)) continue;
    seenUrls.add(item.link);
    const indexed = byId.get(h.id);
    const article = indexed ?? rssItemToSearchArticle(item);
    results.push({
      article,
      cluster: null,
      score: h.score,
      sourceKind: indexed ? "indexed" : "headline",
    });
  }

  for (const hit of liveHits) {
    if (seenUrls.has(hit.article.url)) continue;
    seenUrls.add(hit.article.url);
    results.push(hit);
  }

  return dedupeSearchHits(results);
}

type StatusListener = (s: EngineStatus) => void;

const initialFeedStatuses: FeedPollStatus[] = ENGLISH_NEWS_FEEDS.map((f) => ({
  key: f.key,
  label: f.label,
  state: "pending" as const,
}));

let status: EngineStatus = {
  phase: "idle",
  message: "Ready",
  articlesIndexed: 0,
  rssHeadlines: 0,
  pendingArticles: 0,
  summarizedByModel: 0,
  feedsOk: 0,
  feedsFailed: 0,
  feedsTotal: ENGLISH_NEWS_FEEDS.length,
  feedStatuses: initialFeedStatuses,
  lastPollAt: 0,
  modelReady: false,
  activityLog: [],
  lastSummary: null,
  lastSearch: null,
  clustersTotal: 0,
  multiSourceClusters: 0,
  connectorsIngested: 0,
  lastConnectorAt: 0,
};

const listeners = new Set<StatusListener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let processing = false;

function emit(patch: Partial<EngineStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
}

function logActivity(kind: ActivityKind, message: string) {
  const entry: ActivityEntry = { ts: Date.now(), kind, message };
  const activityLog = [entry, ...status.activityLog].slice(0, 40);
  emit({ activityLog, message });
}

async function syncDbStats() {
  const [articlesIndexed, rssHeadlines, pendingArticles, summarizedByModel] = await Promise.all([
    getArticleCount(),
    getRssHeadlineCount(),
    getPendingArticleCount(),
    getSummarizedCount(),
  ]);
  emit({ articlesIndexed, rssHeadlines, pendingArticles, summarizedByModel });
}

export function subscribeEngineStatus(fn: StatusListener): () => void {
  listeners.add(fn);
  fn(status);
  void syncDbStats();
  return () => listeners.delete(fn);
}

export function getEngineStatus(): EngineStatus {
  return status;
}

async function fetchFeedItems(feed: (typeof ENGLISH_NEWS_FEEDS)[0]): Promise<RssItem[]> {
  const urls = [feed.url, ...(feed.fallbackUrls ?? [])];
  let lastErr: unknown;

  const cached = await getCachedRssXml(urls);
  if (cached) {
    try {
      return parseRssXml(cached, {
        source: feed.label,
        sourceKey: feed.key,
        category: feed.category,
      });
    } catch (err) {
      lastErr = err;
    }
  }

  for (const url of urls) {
    try {
      const xml = await fetchRemoteText(url);
      return parseRssXml(xml, {
        source: feed.label,
        sourceKey: feed.key,
        category: feed.category,
      });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Feed fetch failed");
}

function setFeedStatus(key: string, state: FeedPollStatus["state"], items?: number) {
  const feedStatuses = status.feedStatuses.map((f) =>
    f.key === key ? { ...f, state, items: items ?? f.items } : f,
  );
  emit({ feedStatuses });
}

export async function pollAllFeeds(): Promise<void> {
  if (processing) return;
  processing = true;
  logActivity("rss", `Starting RSS poll (${ENGLISH_NEWS_FEEDS.length} feeds)…`);
  emit({
    phase: "polling",
    feedsOk: 0,
    feedsFailed: 0,
    feedStatuses: ENGLISH_NEWS_FEEDS.map((f) => ({ key: f.key, label: f.label, state: "pending" })),
  });

  let ok = 0;
  let failed = 0;
  let newItems = 0;
  const FEED_BATCH = 6;

  for (let i = 0; i < ENGLISH_NEWS_FEEDS.length; i += FEED_BATCH) {
    const chunk = ENGLISH_NEWS_FEEDS.slice(i, i + FEED_BATCH);
    const results = await Promise.allSettled(
      chunk.map(async (feed) => {
        const items = await fetchFeedItems(feed);
        const added = await upsertRssItems(items);
        return { feed, items, added };
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const feed = chunk[j];
      if (result.status === "fulfilled") {
        ok++;
        newItems += result.value.added;
        setFeedStatus(feed.key, "ok", result.value.items.length);
        logActivity("rss", `✓ ${feed.label} — ${result.value.items.length} headlines (${result.value.added} new)`);
        emit({ feedsOk: ok, feedsFailed: failed });
      } else {
        failed++;
        setFeedStatus(feed.key, "fail");
        logActivity("error", `✗ ${feed.label} — fetch failed`);
        emit({ feedsOk: ok, feedsFailed: failed });
      }
    }
    await syncDbStats();
  }

  await setMeta("lastPollAt", String(Date.now()));
  logActivity("rss", `Poll complete: ${ok} OK, ${failed} failed, ${newItems} new headlines`);
  emit({
    feedsOk: ok,
    feedsFailed: failed,
    lastPollAt: Date.now(),
    phase: "extracting",
  });

  logActivity("connector", "Fetching GitHub repos + Hugging Face models…");
  emit({ phase: "summarizing", message: "GitHub + Hugging Face Hub ingest…" });
  try {
    const ext = await ingestExternalSources({ maxGithub: 4, maxHf: 4 });
    const total = ext.github + ext.hf;
    logActivity(
      "connector",
      `✓ Connectors: ${ext.github} GitHub repos, ${ext.hf} HF models (${ext.skipped} skipped)`,
    );
    emit({
      connectorsIngested: status.connectorsIngested + total,
      lastConnectorAt: Date.now(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connector ingest failed";
    logActivity("error", `Connectors: ${msg}`);
  }

  await drainPendingArticles();
  await syncDbStats();
  processing = false;
}

async function drainPendingArticles(): Promise<void> {
  const batchSize = 8;
  const maxPerPoll = 48;
  let processed = 0;

  while (processed < maxPerPoll) {
    const pending = await listPendingRssItems(Math.min(batchSize, maxPerPoll - processed));
    if (!pending.length) break;
    await processArticleBatch(pending);
    processed += pending.length;
    await syncDbStats();
  }

  await rebuildIndex();
  const count = await getArticleCount();
  logActivity("index", `Index ready — ${count} articles searchable`);
  emit({ phase: "ready", articlesIndexed: count });
}

async function processArticleBatch(pending: RssItem[]): Promise<void> {
  logActivity("extract", `Processing batch of ${pending.length} articles…`);
  emit({ phase: "extracting" });

  for (const item of pending) {
    try {
      logActivity("extract", `Fetching page: ${item.title.slice(0, 50)}…`);
      let extracted = await extractArticleFromUrl(item.link, item.title);
      const rssText = item.description?.trim() ?? "";

      if (isFailedExtraction(extracted.title, extracted.text)) {
        logActivity("extract", `Blocked page — using RSS description: ${item.title.slice(0, 45)}…`);
        extracted = {
          title: item.title,
          text: rssText || extracted.text,
          image: item.image || extracted.image,
        };
      }

      emit({ phase: "summarizing" });
      logActivity("summarize", `Qwen summarizing: ${item.title.slice(0, 55)}…`);

      const bodyForSummary = normalizeArticleBody(extracted.text?.trim() || rssText, item.title).body;
      const rawSum = await summarizeArticle(bodyForSummary);
      const sum = normalizeSummarizerResult(
        rawSum,
        rssText,
        bodyForSummary,
        extracted.title || item.title,
      );
      const byModel = sum.summary.length > 20 && !sum.summary.startsWith(rssText.slice(0, 40));
      const feedDef = FEED_BY_KEY[item.sourceKey];
      let image = extracted.image || item.image;
      if (!image) {
        image = await fetchArticleImage(item.link).catch(() => "");
      }
      let article: ArticleRecord = {
        id: item.id,
        url: item.link,
        source: item.source,
        sourceKey: item.sourceKey,
        title: extracted.title || item.title,
        image,
        publishDate: item.published,
        publishedTs: item.publishedTs,
        articleText: bodyForSummary,
        summary: sum.summary,
        displayTitle: rawSum.titleEn,
        displaySummary: sum.summary,
        keyFacts: sum.keyFacts,
        keywords: [...sum.keywords, item.category, feedDef?.category ?? ""].filter(Boolean),
        entities: sum.entities,
        clusterId: item.id,
        confidence: "LOW",
        fetchedAt: Date.now(),
        summarizedAt: Date.now(),
        language: feedDef?.language ?? "multi",
        feedCategory: item.category,
        intelSource: "rss",
      };
      article = await ensureEnglishDisplay(article);
      await upsertArticle(article);

      const lastSummary: LastSummaryInfo = {
        title: article.displayTitle ?? article.title,
        source: article.source,
        summary: article.displaySummary ?? article.summary,
        keyFacts: article.keyFacts.slice(0, 4),
        byModel,
        at: Date.now(),
      };
      logActivity(
        "summarize",
        byModel ? `✓ Qwen summary saved (${article.source})` : `○ RSS fallback summary (${article.source})`,
      );
      emit({ lastSummary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      logActivity("error", `Failed: ${item.title.slice(0, 40)} — ${msg}`);
      let fallbackImage = item.image;
      if (!fallbackImage) {
        fallbackImage = await fetchArticleImage(item.link).catch(() => "");
      }
      let fallback: ArticleRecord = {
        id: item.id,
        url: item.link,
        source: item.source,
        sourceKey: item.sourceKey,
        title: item.title,
        image: fallbackImage,
        publishDate: item.published,
        publishedTs: item.publishedTs,
        articleText: item.description,
        summary: item.description.slice(0, 280),
        keyFacts: item.description ? [item.description.slice(0, 200)] : [],
        keywords: [],
        entities: [],
        clusterId: item.id,
        confidence: "LOW",
        fetchedAt: Date.now(),
        summarizedAt: 0,
        language: "multi",
        feedCategory: item.category,
        intelSource: "rss",
      };
      fallback = await ensureEnglishDisplay(fallback);
      await upsertArticle(fallback);
      emit({
        lastSummary: {
          title: fallback.displayTitle ?? fallback.title,
          source: fallback.source,
          summary: fallback.displaySummary ?? fallback.summary,
          keyFacts: fallback.keyFacts,
          byModel: false,
          at: Date.now(),
        },
      });
    }
  }
}

async function rebuildIndex(): Promise<void> {
  emit({ phase: "indexing" });
  logActivity("index", "Rebuilding FlexSearch index + story clusters…");
  const articles = await getAllArticles();
  const { articles: clustered, clusters } = assignClusters(articles);
  await db.transaction("rw", db.articles, db.clusters, async () => {
    for (const a of clustered) await upsertArticle(a);
    for (const c of clusters) await upsertCluster(c);
  });
  resetSearchIndex();
  await indexArticles(clustered);
  const multi = await getMultiSourceClusters();
  logActivity(
    "index",
    `Clustered ${clusters.length} groups · ${multi.length} cross-source stories detected`,
  );
  emit({ clustersTotal: clusters.length, multiSourceClusters: multi.length });
}

export async function hydrateEngineFromDb(): Promise<void> {
  logActivity("index", "Loading saved data from IndexedDB…");
  await syncDbStats();
  const articles = await getAllArticles();
  if (articles.length > 0) {
    await ensureSearchIndexLoaded(articles);
    const clusters = await getAllClusters();
    const multi = await getMultiSourceClusters();
    emit({
      phase: "ready",
      message: `${articles.length} articles restored from local storage`,
      clustersTotal: clusters.length,
      multiSourceClusters: multi.length,
    });
    logActivity("index", `Restored ${articles.length} articles · ${multi.length} cross-source`);
  } else {
    emit({ phase: "idle", message: "No cached articles yet" });
  }
}

export async function searchNews(query: string, onUpdate?: (update: SearchUpdate) => void): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const emitUpdate = (phase: SearchUpdate["phase"], hits: SearchHit[]) => {
    onUpdate?.({ phase, hits });
  };

  logActivity("search", `Search: "${q}"`);
  emit({ message: `Searching: ${q}` });

  const [articles, rssItems] = await Promise.all([getAllArticles(), getAllRssItems()]);
  const totalHeadlines = rssItems.length;
  const indexedUrls = new Set(articles.map((a) => a.url));
  const byId = new Map(articles.map((a) => [a.id, a]));

  const livePromise = searchLiveConnectors(q);
  const expandPromise = expandQueryFast(q);

  const rankedArticles = rankArticlesForQuery(articles, q, 24);
  const clusterMap = await loadClusters(
    rankedArticles.map((h) => byId.get(h.id)?.clusterId ?? "").filter(Boolean),
  );

  let hits = await buildHitsFromRanked(rankedArticles, [], articles, rssItems, [], clusterMap);
  emitUpdate("indexed", hits);

  const rankedHeadlines = rankRssHeadlinesForQuery(rssItems, q, indexedUrls, 40);
  hits = await buildHitsFromRanked(rankedArticles, rankedHeadlines, articles, rssItems, [], clusterMap);
  emitUpdate("headlines", hits);

  const live = await livePromise;
  hits = await buildHitsFromRanked(rankedArticles, rankedHeadlines, articles, rssItems, live.hits, clusterMap);
  emitUpdate("live", hits);

  const cleanedAi = sanitizeAiKeywords(await expandPromise);
  const terms = buildSearchTerms(q, cleanedAi);
  const rankOpts = { aiKeywords: cleanedAi };

  if (cleanedAi.length > 0) {
    const refinedArticles = rankArticlesForQuery(articles, q, 24, rankOpts);
    const refinedHeadlines = rankRssHeadlinesForQuery(rssItems, q, indexedUrls, 40, rankOpts);
    hits = await buildHitsFromRanked(refinedArticles, refinedHeadlines, articles, rssItems, live.hits, clusterMap);
    emitUpdate("refined", hits);
  }

  const indexedMatches = rankArticlesForQuery(articles, q, 24, rankOpts).length;
  const headlineMatches = rankRssHeadlinesForQuery(rssItems, q, indexedUrls, 40, rankOpts).length;
  const githubMatches = live.hits.filter((h) => h.sourceKind === "github").length;
  const hfMatches = live.hits.filter((h) => h.sourceKind === "huggingface").length;

  const lastSearch: LastSearchInfo = {
    query: q,
    expandedTerms: terms,
    resultCount: hits.length,
    indexedMatches,
    headlineMatches,
    githubMatches,
    hfMatches,
    liveGithubSkipped: live.githubSkipped,
    liveHfSkipped: live.hfSkipped,
    githubRateLimited: live.githubRateLimited,
    totalHeadlines,
    at: Date.now(),
  };

  logActivity(
    "search",
    live.githubSkipped && live.hfSkipped
      ? `Scanned ${totalHeadlines} headlines + ${articles.length} indexed (live APIs skipped — news query)`
      : `Scanned ${totalHeadlines} headlines + ${articles.length} indexed + live (${live.githubCount} GitHub, ${live.hfCount} HF${live.githubRateLimited ? ", GitHub rate-limited" : ""})`,
  );

  if (hits.length > 0) {
    logActivity(
      "search",
      `Found ${hits.length} (${indexedMatches} indexed + ${headlineMatches} headlines + ${githubMatches} GitHub + ${hfMatches} HF) — top: "${hits[0].article.title.slice(0, 45)}"`,
    );
  } else {
    logActivity("search", `No matches for "${q}"`);
  }

  emit({ phase: "ready", lastSearch });
  emitUpdate("done", hits);
  return hits;
}

export async function getDailyBriefing(limit = 20) {
  return buildDailyBriefing(limit);
}

export function buildIntelBundle(topic: string, hits: SearchHit[]): IntelBundle {
  const clusterIds = new Set(hits.map((h) => h.article.clusterId));
  const confidences = hits.map((h) => h.article.confidence);
  const confidence: IntelBundle["confidence"] = confidences.includes("HIGH")
    ? "HIGH"
    : confidences.includes("MEDIUM")
      ? "MEDIUM"
      : "LOW";

  return {
    topic,
    sources: clusterIds.size || hits.length,
    confidence,
    summaries: hits.map((h) => h.article.summary).filter(Boolean).slice(0, 8),
    keyFacts: [...new Set(hits.flatMap((h) => h.article.keyFacts))].slice(0, 12),
    articleLinks: hits.map((h) => h.article.url).slice(0, 12),
    images: hits.map((h) => h.article.image).filter(Boolean).slice(0, 8),
  };
}

export async function startEngine(): Promise<void> {
  let modelLogged = false;
  const syncModelReady = () => {
    const ready = isSummarizerReady() || getModelBootState().phase === "ready";
    emit({ modelReady: ready });
    if (ready && !modelLogged) {
      modelLogged = true;
      logActivity("model", "Qwen 2.5 0.5B ready for summaries");
    }
  };
  syncModelReady();
  subscribeModelBoot(() => syncModelReady());

  const purged = await purgeBlockedNewsSources();
  if (purged.articles > 0 || purged.rss > 0) {
    logActivity(
      "rss",
      `Removed blocked outlets: ${purged.articles} articles, ${purged.rss} headlines`,
    );
    await rebuildIndex();
  }

  await hydrateEngineFromDb();

  void (async () => {
    if (!(await waitForSummarizer(180_000))) return;
    const all = await getAllArticles();
    let fixed = 0;
    for (const a of all) {
      if (fixed >= 15) break;
      if (a.displaySummary && a.displayTitle && !needsEnglishDisplay(a.displayTitle, a.displaySummary)) continue;
      if (!needsEnglishDisplay(a.title, a.summary)) continue;
      await upsertArticle(await ensureEnglishDisplay(a));
      fixed++;
    }
    if (fixed > 0) logActivity("index", `English display backfill: ${fixed} articles`);
  })();

  void pollAllFeeds();

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    void pollAllFeeds();
  }, RSS_POLL_INTERVAL_MS);
}

export function stopEngine(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
