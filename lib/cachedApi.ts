/**
 * `apiFetch` + `apiCache` in one call: fetch a JSON endpoint, keep the result,
 * and share the in-flight request with anyone asking for the same key.
 *
 * Screens call this instead of `apiFetch(...).json()` so that whatever they
 * fetch becomes available to the next mount of that screen (or to a prefetch).
 */

import { apiFetch } from './apiClient';
import { dedupe, freshWithin, peekCached, writeCached } from './apiCache';

export async function fetchJsonCached<T>(key: string, path: string): Promise<T> {
  return dedupe(key, async () => {
    const response = await apiFetch(path);
    if (!response.ok) {
      throw new Error(`${path} failed with ${response.status}`);
    }
    const data = (await response.json()) as T;
    writeCached(key, data);
    return data;
  });
}

/**
 * Warm `key` without a caller waiting for it.
 *
 * Skips the request entirely when the cache is already fresh, so repeated
 * prefetches (every mount of the tab bar, every tap that lands on a warm
 * screen) cost nothing.
 */
export function prefetchJson(key: string, path: string, maxAgeMs = 60_000): void {
  if (freshWithin(key, maxAgeMs)) return;
  void fetchJsonCached(key, path).catch(() => {
    // A prefetch is an optimisation: a failure must not surface anywhere.
  });
}
