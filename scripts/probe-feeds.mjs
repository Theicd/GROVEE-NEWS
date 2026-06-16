/**
 * Probe RSS feeds through the local Vite proxy.
 * Run: npm run dev (in another terminal), then node scripts/probe-feeds.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const feedsFile = readFileSync(join(ROOT, "../src/feeds/englishFeeds.ts"), "utf8");
const urls = [...feedsFile.matchAll(/url:\s*"(https?:\/\/[^"]+)"/g)].map((m) => m[1]);

const PROXY = "http://127.0.0.1:5190/api/fetch?url=";
const TIMEOUT = 20_000;

let ok = 0;
let fail = 0;

for (const url of urls) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(PROXY + encodeURIComponent(url), { signal: ctrl.signal });
    const text = await res.text();
    const isXml = text.includes("<rss") || text.includes("<feed") || text.includes("<rdf:RDF");
    if (res.ok && isXml) {
      ok++;
      console.log(`OK  ${url} (${text.length} bytes)`);
    } else {
      fail++;
      console.log(`BAD ${url} HTTP ${res.status} xml=${isXml}`);
    }
  } catch (err) {
    fail++;
    console.log(`ERR ${url} — ${err instanceof Error ? err.message : err}`);
  } finally {
    clearTimeout(timer);
  }
}

console.log(`\n${ok}/${urls.length} feeds OK, ${fail} failed`);
process.exit(fail > urls.length / 2 ? 1 : 0);
