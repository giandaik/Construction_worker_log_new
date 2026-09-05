/**
 * In-memory fixed-window rate limiter.
 *
 * Scope and limits:
 *   - Per Node.js process. The application runs as a single Next.js server,
 *     so this is sufficient to blunt credential stuffing and signup spam.
 *     It is NOT a distributed limiter: behind multiple instances each process
 *     keeps its own counters, and a restart clears them.
 *   - Counters live in a plain Map. Expired entries are pruned lazily on
 *     access plus a bounded sweep, so the Map cannot grow without limit from
 *     attacker-chosen keys.
 */

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Maximum number of hits allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** True when the caller has exceeded the limit and must be rejected. */
  isLimited: boolean;
  /** Seconds until the window resets — the `Retry-After` value. */
  retryAfterSeconds: number;
  /** Hits still available in the current window. */
  remaining: number;
}

/** Sweep at most this many entries per call so a sweep stays O(1)-ish. */
const SWEEP_BUDGET = 50;

const windows = new Map<string, Window>();

/**
 * Drops expired entries so attacker-chosen keys cannot grow the Map forever.
 *
 * Map iteration order is insertion order, so the oldest keys — the ones most
 * likely to have expired — are visited first.
 */
function sweepExpired(now: number): void {
  let budget = SWEEP_BUDGET;

  for (const [key, window] of windows) {
    if (budget-- <= 0) {
      return;
    }

    if (window.resetAt <= now) {
      windows.delete(key);
    }
  }
}

/**
 * Records one hit against `key` and reports whether it is now limited.
 *
 * The hit is counted even when already limited, so a caller that keeps
 * hammering does not shorten its own lockout.
 */
export function consumeRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);

  const existing = windows.get(key);
  const window =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs };

  window.count += 1;
  windows.set(key, window);

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((window.resetAt - now) / 1000),
  );

  return {
    isLimited: window.count > limit,
    retryAfterSeconds,
    remaining: Math.max(0, limit - window.count),
  };
}

/**
 * Clears a key's window.
 *
 * Called after a successful login so a legitimate user who mistyped their
 * password a few times is not locked out by their own successful sign-in.
 */
export function resetRateLimit(key: string): void {
  windows.delete(key);
}

/** Test hook: drops every counter. Not used by application code. */
export function clearAllRateLimits(): void {
  windows.clear();
}

/**
 * Best-effort client IP.
 *
 * Behind Vercel/most proxies the left-most `x-forwarded-for` entry is the
 * client. There is no trusted-proxy configuration here, so a direct client
 * can spoof this header; the per-account limit is the defence that does not
 * depend on it.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
