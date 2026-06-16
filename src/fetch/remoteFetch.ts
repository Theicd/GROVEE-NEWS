import { extractArticleImageFromHtml } from "../extract/articleImage";
import { normalizeArticleBody } from "../extract/normalizeArticleBody";

const DEFAULT_TIMEOUT_MS = 22_000;

/** Local Vite proxy — no CORS in dev/preview. */
const localProxy = (url: string) => `/api/fetch?url=${encodeURIComponent(url)}`;

const EXTERNAL_RELAYS = [
  (url: string) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://cors.eu.org/${url}`,
  (url: string) => `https://r.jina.ai/${url}`,
];

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
}

export async function fetchRemoteText(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const attempts: Array<() => Promise<string>> = [
    async () => fetchText(localProxy(url), timeoutMs),
  ];

  if (isSameOrigin(url)) {
    attempts.unshift(async () => fetchText(url, timeoutMs));
  }

  for (const relay of EXTERNAL_RELAYS) {
    attempts.push(async () => fetchText(relay(url), timeoutMs));
  }

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All fetch attempts failed");
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error("Empty response");
  return normalizeRelayText(text, url);
}

function normalizeRelayText(text: string, sourceUrl: string): string {
  const { body, title } = normalizeArticleBody(text);
  if (title && /markdown content:/i.test(text)) {
    return `Title: ${title}\n\n${body}`;
  }
  if (body !== text.trim()) return body;
  return text;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "text/html,application/xhtml+xml,application/xml,text/plain,*/*" },
    });
  } finally {
    clearTimeout(id);
  }
}

export function extractOgImage(html: string, pageUrl = ""): string {
  return extractArticleImageFromHtml(html, pageUrl || "https://localhost/");
}
