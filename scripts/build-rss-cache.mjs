/**
 * Build-time RSS cache for static hosting (GitHub Pages has no /api/fetch).
 * Run: node scripts/build-rss-cache.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const feedsFile = readFileSync(join(ROOT, "../src/feeds/englishFeeds.ts"), "utf8");
const OUT_DIR = join(ROOT, "../public");
const OUT_FILE = join(OUT_DIR, "rss-cache.json");

const TIMEOUT_MS = 25_000;
const CONCURRENCY = 8;

function parseFeeds(source) {
  const blocks = source.match(/feed\(\{[\s\S]*?\}\)/g) ?? [];
  const feeds = [];
  for (const block of blocks) {
    const key = block.match(/key:\s*"([^"]+)"/)?.[1];
    const url = block.match(/url:\s*"(https?:\/\/[^"]+)"/)?.[1];
    if (!key || !url) continue;
    const fallbackUrls = [...block.matchAll(/"(https?:\/\/[^"]+)"/g)]
      .map((m) => m[1])
      .filter((u) => u !== url);
    feeds.push({ key, url, fallbackUrls });
  }
  return feeds;
}

function isRssXml(text) {
  return /<rss[\s>]/i.test(text) || /<feed[\s>]/i.test(text) || /<rdf:RDF/i.test(text);
}

async function fetchXml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "GROVEE-NEWS/0.1 (rss-cache-build)",
        Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
      },
      redirect: "follow",
    });
    const text = await res.text();
    if (!res.ok || !isRssXml(text)) {
      return { ok: false, status: res.status, bytes: text.length };
    }
    return { ok: true, xml: text, url, bytes: text.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeed(feed) {
  const urls = [feed.url, ...feed.fallbackUrls];
  for (const url of urls) {
    const result = await fetchXml(url);
    if (result.ok) {
      return { key: feed.key, url: result.url, xml: result.xml, ok: true, bytes: result.bytes };
    }
  }
  return { key: feed.key, url: feed.url, ok: false };
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

const feeds = parseFeeds(feedsFile);
console.log(`Fetching ${feeds.length} feeds for static cache…`);

const results = await mapPool(feeds, CONCURRENCY, fetchFeed);
const byKey = {};
const byUrl = {};
let ok = 0;
for (const r of results) {
  byKey[r.key] = r.ok ? { url: r.url, xml: r.xml } : { url: r.url, ok: false };
  if (r.ok) {
    byUrl[r.url] = r.xml;
    ok++;
    console.log(`OK  ${r.key} (${r.bytes} bytes)`);
  } else {
    console.log(`FAIL ${r.key}`);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const payload = {
  generatedAt: new Date().toISOString(),
  feedCount: feeds.length,
  okCount: ok,
  byKey,
  byUrl,
};
writeFileSync(OUT_FILE, JSON.stringify(payload));
console.log(`\nWrote ${OUT_FILE} — ${ok}/${feeds.length} feeds cached`);
