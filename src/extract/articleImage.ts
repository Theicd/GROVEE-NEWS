import { fetchRemoteText } from "../fetch/remoteFetch";

const HEAD_SCAN_CHARS = 80_000;

export function resolveImageUrl(src: string, pageUrl: string): string {
  if (!src?.trim()) return "";
  const decoded = src.replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
  if (decoded.startsWith("data:")) return "";
  try {
    return new URL(decoded, pageUrl).href;
  } catch {
    return decoded;
  }
}

function pickMetaContent(html: string, patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

function pickFirstImgSrc(html: string, pageUrl: string): string {
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const resolved = resolveImageUrl(m[1], pageUrl);
    if (!resolved) continue;
    if (/pixel|tracker|1x1|spacer|blank\.gif/i.test(resolved)) continue;
    return resolved;
  }
  return "";
}

/** Extract hero image from article HTML (og/twitter meta + first content img). */
export function extractArticleImageFromHtml(html: string, pageUrl: string): string {
  const head = html.slice(0, HEAD_SCAN_CHARS);

  const meta =
    pickMetaContent(head, [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
      /<meta[^>]+name=["']thumbnail["'][^>]+content=["']([^"']+)["']/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
      /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
    ]) || pickFirstImgSrc(head, pageUrl);

  return resolveImageUrl(meta, pageUrl);
}

const imageCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function peekCachedArticleImage(articleUrl: string): string {
  return imageCache.get(articleUrl) ?? "";
}

/** Fetch article page and return og:image / twitter:image URL (cached). */
export async function fetchArticleImage(articleUrl: string, timeoutMs = 14_000): Promise<string> {
  const cached = imageCache.get(articleUrl);
  if (cached) return cached;

  const pending = inflight.get(articleUrl);
  if (pending) return pending;

  const task = (async () => {
    try {
      const html = await fetchRemoteText(articleUrl, timeoutMs);
      const image = extractArticleImageFromHtml(html, articleUrl);
      if (image) imageCache.set(articleUrl, image);
      return image;
    } catch {
      return "";
    } finally {
      inflight.delete(articleUrl);
    }
  })();

  inflight.set(articleUrl, task);
  return task;
}
