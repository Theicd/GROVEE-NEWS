export type RssItem = {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceKey: string;
  category: string;
  link: string;
  image: string;
  published: string;
  publishedTs: number;
  guid: string;
};

export type ArticleRecord = {
  id: string;
  url: string;
  source: string;
  sourceKey: string;
  title: string;
  image: string;
  publishDate: string;
  publishedTs: number;
  articleText: string;
  summary: string;
  /** English headline for UI (original may stay in `title` for search) */
  displayTitle?: string;
  /** English summary/snippet for UI */
  displaySummary?: string;
  keyFacts: string[];
  keywords: string[];
  entities: string[];
  clusterId: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  fetchedAt: number;
  summarizedAt: number;
  /** Content language hint for display / search */
  language?: "en" | "zh" | "multi";
  /** Feed category at ingest time (technology, alternative, …) */
  feedCategory?: string;
  /** API connector origin */
  intelSource?: "rss" | "github" | "huggingface";
};

export type StoryCluster = {
  id: string;
  headline: string;
  sourceKeys: string[];
  articleIds: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
  updatedAt: number;
};

export type SearchHit = {
  article: ArticleRecord;
  cluster: StoryCluster | null;
  score: number;
  /** Indexed with Qwen/RSS summary vs headline-only from RSS queue vs live API */
  sourceKind: "indexed" | "headline" | "github" | "huggingface";
};

export type IntelBundle = {
  topic: string;
  sources: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  summaries: string[];
  keyFacts: string[];
  articleLinks: string[];
  images: string[];
};

export type ActivityKind = "rss" | "extract" | "summarize" | "index" | "search" | "model" | "connector" | "error";

export type ActivityEntry = {
  ts: number;
  kind: ActivityKind;
  message: string;
};

export type FeedPollStatus = {
  key: string;
  label: string;
  state: "pending" | "ok" | "fail";
  items?: number;
};

export type LastSearchInfo = {
  query: string;
  expandedTerms: string[];
  resultCount: number;
  indexedMatches: number;
  headlineMatches: number;
  githubMatches: number;
  hfMatches: number;
  liveGithubSkipped?: boolean;
  liveHfSkipped?: boolean;
  githubRateLimited?: boolean;
  totalHeadlines: number;
  at: number;
} | null;

export type LastSummaryInfo = {
  title: string;
  source: string;
  summary: string;
  keyFacts: string[];
  byModel: boolean;
  at: number;
} | null;

export type EngineStatus = {
  phase: "idle" | "polling" | "extracting" | "summarizing" | "indexing" | "ready" | "error";
  message: string;
  articlesIndexed: number;
  rssHeadlines: number;
  pendingArticles: number;
  summarizedByModel: number;
  feedsOk: number;
  feedsFailed: number;
  feedsTotal: number;
  feedStatuses: FeedPollStatus[];
  lastPollAt: number;
  modelReady: boolean;
  activityLog: ActivityEntry[];
  lastSummary: LastSummaryInfo;
  lastSearch: LastSearchInfo;
  clustersTotal: number;
  multiSourceClusters: number;
  connectorsIngested: number;
  lastConnectorAt: number;
};
