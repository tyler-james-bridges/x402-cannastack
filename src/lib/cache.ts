const cache = new Map<string, { data: unknown; expires: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown, ttlMs: number = 300_000) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}
