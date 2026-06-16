import type { ArticleRecord, RssItem } from "../types";

/** Feed keys that must never be polled or shown. */
export const BLOCKED_FEED_KEYS = new Set([
  "aljazeera",
  "al_jazeera",
  "aj",
  "bbc",
  "cnn",
  "guardian",
  "npr",
  "cbc",
  "france24",
  "lemonde",
  "bloomberg",
  "cnbc",
  "spiegel",
]);

const BLOCKED_SOURCE_PATTERNS: RegExp[] = [
  /\bal[\s-]?jazeera\b/i,
  /\bbbc\b/i,
  /\bcnn\b/i,
  /\bthe\s+guardian\b/i,
  /\bguardian\b/i,
  /\bnpr\b/i,
  /\bcbc\b/i,
  /\bfrance\s*24\b/i,
  /\ble\s+monde\b/i,
  /\bbloomberg\b/i,
  /\bcnbc\b/i,
  /\bder\s+spiegel\b/i,
  /\bspiegel\b/i,
];

const BLOCKED_URL_PATTERNS: RegExp[] = [
  /(?:^|\/\/)(?:www\.)?aljazeera\.com/i,
  /aje\.io/i,
  /(?:^|\/\/)feeds\.bbci\.co\.uk/i,
  /(?:^|\/\/)(?:www\.)?bbc\.(?:co\.uk|com)/i,
  /(?:^|\/\/)(?:www\.)?cnn\.com/i,
  /(?:^|\/\/)(?:www\.)?theguardian\.com/i,
  /(?:^|\/\/)(?:www\.)?npr\.org/i,
  /(?:^|\/\/)(?:www\.)?cbc\.ca/i,
  /(?:^|\/\/)(?:www\.)?france24\.com/i,
  /(?:^|\/\/)(?:www\.)?lemonde\.fr/i,
  /(?:^|\/\/)feeds\.bloomberg\.com/i,
  /(?:^|\/\/)(?:www\.)?bloomberg\.com/i,
  /(?:^|\/\/)(?:www\.)?cnbc\.com/i,
  /(?:^|\/\/)(?:www\.)?spiegel\.de/i,
];

export function isBlockedFeedKey(key: string): boolean {
  return BLOCKED_FEED_KEYS.has(key.toLowerCase());
}

function matchesBlockedSource(source: string): boolean {
  return BLOCKED_SOURCE_PATTERNS.some((re) => re.test(source));
}

function matchesBlockedUrl(url: string): boolean {
  return BLOCKED_URL_PATTERNS.some((re) => re.test(url));
}

export function isBlockedNewsItem(item: {
  sourceKey?: string;
  source?: string;
  url?: string;
  link?: string;
}): boolean {
  const key = (item.sourceKey ?? "").toLowerCase();
  if (isBlockedFeedKey(key)) return true;
  if (item.source && matchesBlockedSource(item.source)) return true;
  const url = item.url ?? item.link ?? "";
  if (url && matchesBlockedUrl(url)) return true;
  return false;
}

export function isBlockedArticle(article: ArticleRecord): boolean {
  return isBlockedNewsItem({
    sourceKey: article.sourceKey,
    source: article.source,
    url: article.url,
  });
}

export function isBlockedRssItem(item: RssItem): boolean {
  return isBlockedNewsItem({
    sourceKey: item.sourceKey,
    source: item.source,
    link: item.link,
  });
}
