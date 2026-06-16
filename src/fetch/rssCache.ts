export type RssCachePayload = {
  generatedAt: string;
  feedCount: number;
  okCount: number;
  byKey: Record<string, { url: string; xml?: string; ok?: false }>;
  byUrl: Record<string, string>;
};

let cachePromise: Promise<RssCachePayload | null> | null = null;

function cacheUrl(): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base}rss-cache.json`;
}

export function loadRssCache(): Promise<RssCachePayload | null> {
  if (!cachePromise) {
    cachePromise = fetch(cacheUrl())
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return cachePromise;
}

export async function getCachedRssXml(urls: string[]): Promise<string | null> {
  const cache = await loadRssCache();
  if (!cache) return null;
  for (const url of urls) {
    const xml = cache.byUrl[url];
    if (xml?.trim()) return xml;
  }
  return null;
}

export async function getRssCacheAgeMs(): Promise<number | null> {
  const cache = await loadRssCache();
  if (!cache?.generatedAt) return null;
  const t = Date.parse(cache.generatedAt);
  return Number.isFinite(t) ? Date.now() - t : null;
}
