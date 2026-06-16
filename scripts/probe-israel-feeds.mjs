/**
 * Probe Israel English RSS feeds (direct fetch).
 * Run: node scripts/probe-israel-feeds.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const feedsFile = readFileSync(join(ROOT, "../src/feeds/englishFeeds.ts"), "utf8");

/** Extract israel-category feed blocks from the catalog source. */
function extractIsraelFeeds() {
  const section = feedsFile.split("// —— Israel (English) ——")[1]?.split("// —— Business ——")[0] ?? "";
  const feeds = [];
  const chunks = section.split(/feed\(\{/);
  for (const chunk of chunks.slice(1)) {
    const key = chunk.match(/key:\s*"([^"]+)"/)?.[1];
    const url = chunk.match(/url:\s*"([^"]+)"/)?.[1];
    const fallbacks = [...chunk.matchAll(/fallbackUrls:\s*\[[\s\S]*?\]/g)].flatMap((m) =>
      [...m[0].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
    );
    if (key && url) feeds.push({ key, urls: [url, ...fallbacks] });
  }
  return feeds;
}

const feeds = extractIsraelFeeds();
const TIMEOUT = 22_000;
let ok = 0;
let fail = 0;

for (const feed of feeds) {
  let worked = false;
  for (const url of feed.urls) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "GROVEE-NEWS/0.1 (RSS probe)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      });
      const text = await res.text();
      const items = (text.match(/<item[\s>]/gi) ?? []).length;
      const isXml = text.includes("<rss") || text.includes("<feed") || text.includes("<rdf:RDF");
      const valid = res.ok && isXml && (items > 0 || feed.key === "ynet_opinions");
      if (valid) {
        console.log(`OK  ${feed.key} — ${items} items via ${url.slice(0, 72)}`);
        ok++;
        worked = true;
        break;
      }
    } catch {
      /* try next */
    } finally {
      clearTimeout(timer);
    }
  }
  if (!worked) {
    console.log(`FAIL ${feed.key} — no working URL`);
    fail++;
  }
}

console.log(`\n${ok}/${feeds.length} Israel feeds OK, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
