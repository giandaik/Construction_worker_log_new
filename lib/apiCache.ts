/**
 * Small response cache for the app's own GET endpoints.
 *
 * Why this exists: every screen in the native shell mounts fresh, fetches what
 * it needs and throws it away on unmount. Opening Logs therefore painted a
 * full-page skeleton and waited for two cross-origin calls (each ~200 ms of
 * Vercel TTFB, plus a bridge round trip for the bearer token) before it could
 * show a single row — on every visit, including the tenth one in a session.
 *
 * The cache keeps the last good payload per key so a screen can paint from
 * `peekCached()` on its very first render and revalidate in the background.
 *
 * Deliberately not a data-fetching library: no observers, no mutations, no
 * optimistic updates. Just peek / write / dedupe, so call sites stay plain
 * `useEffect` code.
 */

/** Namespaced so a future schema change can be dropped by bumping the version. */
const STORAGE_PREFIX = 'cw_api_v1:';

/** Beyond this a payload is kept in memory only — localStorage is a 5 MB budget. */
const MAX_PERSISTED_BYTES = 200_000;

const memory = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function storageKey(key: string): string {
  return STORAGE_PREFIX + key;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** True when the browser has rejected writes (private mode, quota) at least once. */
let storageBroken = false;

function readStored(key: string): unknown {
  if (!canUseStorage() || storageBroken) return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    storageBroken = true;
    return undefined;
  }
}

function writeStored(key: string, value: unknown): void {
  if (!canUseStorage() || storageBroken) return;
  try {
    const raw = JSON.stringify(value);
    if (raw.length > MAX_PERSISTED_BYTES) {
      window.localStorage.removeItem(storageKey(key));
      return;
    }
    window.localStorage.setItem(storageKey(key), raw);
  } catch {
    storageBroken = true;
  }
}

/**
 * Last payload for `key`, or null when nothing has been cached yet.
 *
 * Synchronous on purpose: it is the initial value of a `useState`, which is
 * what lets the first render paint real rows instead of a skeleton.
 */
export function peekCached<T>(key: string): T | null {
  if (memory.has(key)) return memory.get(key) as T;
  const stored = readStored(key);
  if (stored === undefined) return null;
  memory.set(key, stored);
  return stored as T;
}

/** True when `key` holds a payload cached less than `maxAgeMs` ago. */
export function freshWithin(key: string, maxAgeMs: number): boolean {
  const cachedAt = peekCachedAt(key);
  return cachedAt !== null && Date.now() - cachedAt <= maxAgeMs;
}

/** Epoch ms when `key` was last written this session, or null when unknown. */
export function peekCachedAt(key: string): number | null {
  const stamp = memory.get(stampKey(key));
  return typeof stamp === 'number' ? stamp : null;
}

function stampKey(key: string): string {
  return `${key}::at`;
}

export function writeCached(key: string, value: unknown): void {
  memory.set(key, value);
  memory.set(stampKey(key), Date.now());
  writeStored(key, value);
}

/** Drops one key from both layers. Used when a payload is known to be stale. */
export function invalidateCached(key: string): void {
  memory.delete(key);
  memory.delete(stampKey(key));
  if (canUseStorage() && !storageBroken) {
    try {
      window.localStorage.removeItem(storageKey(key));
    } catch {
      storageBroken = true;
    }
  }
}

/**
 * One in-flight request per key, shared by every caller.
 *
 * Two screens opening at once, or a prefetch racing a tap, would otherwise
 * duplicate the same expensive cross-origin call.
 */
export function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = run().finally(() => {
    inflight.delete(key);
  }) as Promise<T>;
  inflight.set(key, promise);
  return promise;
}

/** Test seam: reset both layers and the in-flight map. */
export function __resetApiCacheForTests(): void {
  memory.clear();
  inflight.clear();
  storageBroken = false;
  if (canUseStorage()) {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) doomed.push(key);
      }
      doomed.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      storageBroken = true;
    }
  }
}
