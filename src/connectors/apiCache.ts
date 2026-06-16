type CacheEntry<T> = { at: number; data: T };

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const stores = new Map<string, Map<string, CacheEntry<unknown>>>();

function bucket(name: string): Map<string, CacheEntry<unknown>> {
  let m = stores.get(name);
  if (!m) {
    m = new Map();
    stores.set(name, m);
  }
  return m;
}

export function cacheGet<T>(store: string, key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  const entry = bucket(store).get(key.toLowerCase()) as CacheEntry<T> | undefined;
  if (!entry || Date.now() - entry.at > ttlMs) return null;
  return entry.data;
}

export function cacheSet<T>(store: string, key: string, data: T): void {
  bucket(store).set(key.toLowerCase(), { at: Date.now(), data });
}
