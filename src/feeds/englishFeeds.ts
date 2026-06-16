import { isBlockedFeedKey } from "./blockedFeeds";

/** Multi-domain intelligence source catalog (RSS today; APIs later). */

export type FeedCategory =
  | "world"
  | "israel"
  | "business"
  | "technology"
  | "ai"
  | "space"
  | "science"
  | "entertainment"
  | "fashion"
  | "health"
  | "alternative"
  | "dev"
  | "trends";

export type SourceType = "rss" | "github_rss" | "community";

export type FeedLanguage = "en" | "zh" | "multi";

export type NewsFeedDef = {
  key: string;
  url: string;
  fallbackUrls?: string[];
  label: string;
  tag: string;
  category: FeedCategory;
  priority: number;
  language?: FeedLanguage;
  sourceType?: SourceType;
};

function feed(def: NewsFeedDef): NewsFeedDef {
  return { language: "en", sourceType: "rss", ...def };
}

export const INTELLIGENCE_FEEDS: NewsFeedDef[] = [
  // —— World ——
  feed({ key: "skynews", url: "https://feeds.skynews.com/feeds/rss/world.xml", label: "Sky News", tag: "Sky", category: "world", priority: 1 }),
  feed({ key: "dw", url: "https://rss.dw.com/rdf/rss-en-all", label: "Deutsche Welle", tag: "DW", category: "world", priority: 2 }),

  // —— Israel (English) ——
  feed({
    key: "jpost_front",
    url: "https://www.jpost.com/rss/rssfeedsfrontpage.aspx",
    fallbackUrls: [
      "https://rss.jpost.com/rss/rssfeedsfrontpage.aspx",
      "https://news.google.com/rss/search?q=site:jpost.com&hl=en-US&gl=US&ceid=US:en",
    ],
    label: "Jerusalem Post",
    tag: "JPost",
    category: "israel",
    priority: 1,
  }),
  feed({
    key: "jpost_israel",
    url: "https://www.jpost.com/rss/rssfeedsisraelnews.aspx",
    fallbackUrls: ["https://news.google.com/rss/search?q=site:jpost.com+israel&hl=en-US&gl=US&ceid=US:en"],
    label: "JPost · Israel",
    tag: "JPost",
    category: "israel",
    priority: 2,
  }),
  feed({
    key: "jpost_middleeast",
    url: "https://www.jpost.com/rss/rssfeedsmiddleeastnews.aspx",
    fallbackUrls: ["https://news.google.com/rss/search?q=site:jpost.com+middle+east&hl=en-US&gl=US&ceid=US:en"],
    label: "JPost · Middle East",
    tag: "JPost",
    category: "israel",
    priority: 3,
  }),
  feed({
    key: "jpost_business",
    url: "https://news.google.com/rss/search?q=site:jpost.com+business&hl=en-US&gl=US&ceid=US:en",
    fallbackUrls: ["https://www.jpost.com/rss/rssfeedsfrontpage.aspx"],
    label: "JPost · Business",
    tag: "JPost",
    category: "israel",
    priority: 4,
  }),
  feed({
    key: "toi_main",
    url: "https://www.timesofisrael.com/feed/",
    fallbackUrls: ["https://news.google.com/rss/search?q=site:timesofisrael.com&hl=en-US&gl=US&ceid=US:en"],
    label: "Times of Israel",
    tag: "TOI",
    category: "israel",
    priority: 5,
  }),
  feed({
    key: "toi_israel",
    url: "https://www.timesofisrael.com/israel-inside/feed/",
    fallbackUrls: ["https://news.google.com/rss/search?q=site:timesofisrael.com+israel&hl=en-US&gl=US&ceid=US:en"],
    label: "TOI · Israel",
    tag: "TOI",
    category: "israel",
    priority: 6,
  }),
  feed({
    key: "toi_middleeast",
    url: "https://news.google.com/rss/search?q=site:timesofisrael.com+middle+east&hl=en-US&gl=US&ceid=US:en",
    fallbackUrls: [
      "https://www.timesofisrael.com/feed/",
      "https://www.timesofisrael.com/israel-inside/feed/",
    ],
    label: "TOI · Middle East",
    tag: "TOI",
    category: "israel",
    priority: 7,
  }),
  feed({
    key: "ynet_all",
    url: "https://www.ynetnews.com/Integration/StoryRss2.xml",
    fallbackUrls: ["https://news.google.com/rss/search?q=site:ynetnews.com&hl=en-US&gl=US&ceid=US:en"],
    label: "Ynetnews",
    tag: "Ynet",
    category: "israel",
    priority: 8,
  }),
  feed({
    key: "ynet_hot",
    url: "https://www.ynetnews.com/Integration/StoryRss1854.xml",
    label: "Ynetnews · Hot",
    tag: "Ynet",
    category: "israel",
    priority: 9,
  }),
  feed({
    key: "ynet_opinions",
    url: "https://www.ynetnews.com/Integration/StoryRss820.xml",
    label: "Ynetnews · Opinions",
    tag: "Ynet",
    category: "israel",
    priority: 10,
  }),
  feed({
    key: "inn_main",
    url: "https://www.israelnationalnews.com/Rss.aspx",
    fallbackUrls: ["https://news.google.com/rss/search?q=site:israelnationalnews.com&hl=en-US&gl=US&ceid=US:en"],
    label: "Israel National News",
    tag: "INN",
    category: "israel",
    priority: 11,
  }),
  feed({
    key: "inn_news",
    url: "https://news.google.com/rss/search?q=site:israelnationalnews.com+news&hl=en-US&gl=US&ceid=US:en",
    fallbackUrls: ["https://www.israelnationalnews.com/Rss.aspx"],
    label: "INN · News",
    tag: "INN",
    category: "israel",
    priority: 12,
  }),
  feed({
    key: "inn_opinion",
    url: "https://news.google.com/rss/search?q=site:israelnationalnews.com+opinion&hl=en-US&gl=US&ceid=US:en",
    fallbackUrls: ["https://www.israelnationalnews.com/Rss.aspx"],
    label: "INN · Opinion",
    tag: "INN",
    category: "israel",
    priority: 13,
  }),
  feed({
    key: "globes_main",
    url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585",
    fallbackUrls: ["https://news.google.com/rss/search?q=site:globes.co.il&hl=en-US&gl=US&ceid=US:en"],
    label: "Globes",
    tag: "Globes",
    category: "israel",
    priority: 14,
    language: "multi",
  }),
  feed({
    key: "globes_market",
    url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=607",
    label: "Globes · Markets",
    tag: "Globes",
    category: "israel",
    priority: 15,
    language: "multi",
  }),
  feed({
    key: "globes_tech",
    url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=594",
    label: "Globes · Tech",
    tag: "Globes",
    category: "israel",
    priority: 16,
    language: "multi",
  }),

  // —— Business ——
  feed({ key: "ft", url: "https://www.ft.com/?format=rss", label: "Financial Times", tag: "FT", category: "business", priority: 1 }),

  // —— Technology ——
  feed({ key: "techcrunch", url: "https://techcrunch.com/feed/", label: "TechCrunch", tag: "TechCrunch", category: "technology", priority: 1 }),
  feed({ key: "theverge", url: "https://www.theverge.com/rss/index.xml", label: "The Verge", tag: "The Verge", category: "technology", priority: 2 }),
  feed({ key: "arstechnica", url: "https://feeds.arstechnica.com/arstechnica/index", label: "Ars Technica", tag: "Ars", category: "technology", priority: 3 }),
  feed({ key: "wired", url: "https://www.wired.com/feed/rss", label: "Wired", tag: "Wired", category: "technology", priority: 4 }),
  feed({ key: "mittr", url: "https://www.technologyreview.com/feed/", label: "MIT Technology Review", tag: "MIT TR", category: "technology", priority: 5 }),

  // —— AI ——
  feed({ key: "openai", url: "https://openai.com/news/rss.xml", label: "OpenAI", tag: "OpenAI", category: "ai", priority: 1 }),
  feed({ key: "deepmind", url: "https://deepmind.google/blog/rss.xml", label: "Google DeepMind", tag: "DeepMind", category: "ai", priority: 2 }),
  feed({ key: "huggingface", url: "https://huggingface.co/blog/feed.xml", label: "Hugging Face Blog", tag: "HF", category: "ai", priority: 3 }),
  feed({
    key: "arxiv_ai",
    url: "http://export.arxiv.org/rss/cs.AI",
    label: "arXiv AI",
    tag: "arXiv",
    category: "ai",
    priority: 4,
  }),

  // —— Dev & builders ——
  feed({ key: "hackernews", url: "https://hnrss.org/frontpage", label: "Hacker News", tag: "HN", category: "dev", priority: 1, sourceType: "community" }),
  feed({ key: "devto", url: "https://dev.to/feed", label: "DEV Community", tag: "DEV", category: "dev", priority: 2 }),
  feed({ key: "lobsters", url: "https://lobste.rs/rss", label: "Lobsters", tag: "Lobsters", category: "dev", priority: 3, sourceType: "community" }),
  feed({
    key: "githubtrending",
    url: "https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml",
    label: "GitHub Trending",
    tag: "GitHub",
    category: "dev",
    priority: 4,
    sourceType: "github_rss",
  }),

  // —— Space & science ——
  feed({ key: "nasa", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", label: "NASA", tag: "NASA", category: "space", priority: 1 }),
  feed({ key: "esa", url: "https://www.esa.int/rssfeed/Our_Activities/Space_News", label: "ESA", tag: "ESA", category: "space", priority: 2 }),
  feed({ key: "spacecom", url: "https://www.space.com/feeds/all", label: "Space.com", tag: "Space.com", category: "space", priority: 3 }),
  feed({ key: "sciencedaily", url: "https://www.sciencedaily.com/rss/top/science.xml", label: "ScienceDaily", tag: "ScienceDaily", category: "science", priority: 1 }),
  feed({ key: "nature", url: "https://www.nature.com/nature.rss", label: "Nature", tag: "Nature", category: "science", priority: 2 }),
  feed({ key: "physorg", url: "https://phys.org/rss-feed/", label: "Phys.org", tag: "Phys.org", category: "science", priority: 3 }),

  // —— Health & alternative / TCM ——
  feed({
    key: "medicalnewstoday",
    url: "https://www.medicalnewstoday.com/newsfeeds/rss",
    label: "Medical News Today",
    tag: "MNT",
    category: "health",
    priority: 1,
  }),
  feed({
    key: "mindbodygreen",
    url: "https://www.mindbodygreen.com/rss.xml",
    label: "mindbodygreen",
    tag: "MBG",
    category: "health",
    priority: 2,
  }),
  feed({
    key: "tcmworld",
    url: "https://tcmworld.org/feed",
    label: "TCM World",
    tag: "TCM",
    category: "alternative",
    priority: 1,
  }),
  feed({
    key: "tcmblog",
    url: "https://tcmblog.co.uk/feed",
    label: "TCM Blog UK",
    tag: "TCM UK",
    category: "alternative",
    priority: 2,
  }),
  feed({
    key: "tcm_acupuncture",
    url: "https://zhzjdzzz.cma-cmc.com.cn/EN/rss_dqml_2095-3240.xml",
    label: "Acupuncture Journal",
    tag: "针灸",
    category: "alternative",
    priority: 3,
    language: "multi",
  }),
  feed({
    key: "tcm_pediatric_cn",
    url: "https://www.zxek.net/CN/rss_dqml_1674-3865.xml",
    label: "中医儿科期刊",
    tag: "中医",
    category: "alternative",
    priority: 4,
    language: "zh",
  }),

  // —— Entertainment & fashion ——
  feed({ key: "ign", url: "https://feeds.ign.com/ign/all", fallbackUrls: ["https://www.gamespot.com/feeds/mashup/"], label: "IGN", tag: "IGN", category: "entertainment", priority: 1 }),
  feed({ key: "gamespot", url: "https://www.gamespot.com/feeds/mashup/", label: "GameSpot", tag: "GameSpot", category: "entertainment", priority: 2 }),
  feed({ key: "rollingstone", url: "https://www.rollingstone.com/feed/", label: "Rolling Stone", tag: "Rolling Stone", category: "entertainment", priority: 3 }),
  feed({ key: "variety", url: "https://variety.com/feed/", label: "Variety", tag: "Variety", category: "entertainment", priority: 4 }),
  feed({ key: "vogue", url: "https://www.vogue.com/feed/rss", label: "Vogue", tag: "Vogue", category: "fashion", priority: 1 }),

  // —— Trends & community ——
  feed({
    key: "reddit_world",
    url: "https://www.reddit.com/r/worldnews/.rss",
    label: "Reddit World News",
    tag: "Reddit",
    category: "trends",
    priority: 1,
    sourceType: "community",
  }),
  feed({
    key: "reddit_technology",
    url: "https://www.reddit.com/r/technology/.rss",
    label: "Reddit Technology",
    tag: "Reddit Tech",
    category: "trends",
    priority: 2,
    sourceType: "community",
  }),
  feed({ key: "producthunt", url: "https://www.producthunt.com/feed", label: "Product Hunt", tag: "Product Hunt", category: "trends", priority: 3 }),
].filter((f) => !isBlockedFeedKey(f.key));

/** @deprecated use INTELLIGENCE_FEEDS */
export const ENGLISH_NEWS_FEEDS = INTELLIGENCE_FEEDS;

export const FEED_BY_KEY = Object.fromEntries(INTELLIGENCE_FEEDS.map((f) => [f.key, f])) as Record<
  string,
  NewsFeedDef
>;

export const RSS_POLL_INTERVAL_MS = 5 * 60_000;

export const FEED_CATEGORY_LABELS: Record<FeedCategory, string> = {
  world: "World",
  israel: "Israel",
  business: "Business",
  technology: "Technology",
  ai: "AI",
  space: "Space",
  science: "Science",
  entertainment: "Entertainment",
  fashion: "Fashion",
  health: "Health",
  alternative: "Alternative / TCM",
  dev: "Dev & GitHub",
  trends: "Trends",
};
