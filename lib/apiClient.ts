/**
 * Single entry point for every call the browser makes to this app's own API.
 *
 * On the web there is no base URL: `apiFetch('/api/projects')` hits
 * `/api/projects` on the current origin, exactly as a bare `fetch` would.
 *
 * In the Capacitor WebView there is no server behind the origin
 * (`capacitor://localhost` on iOS, `http://localhost` on Android), so the
 * static export is built with `NEXT_PUBLIC_API_BASE_URL` pointing at the
 * deployed backend and every call is rewritten to an absolute URL against it.
 *
 * `NEXT_PUBLIC_*` values are inlined by Next at build time, which is why the
 * mobile target is chosen by `scripts/build-mobile.mjs` rather than at runtime.
 */

/** Trailing slash stripped so joining never produces a double slash. */
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

/** True when API calls leave the WebView origin — i.e. a mobile build. */
export function isCrossOriginApi(): boolean {
  return API_BASE_URL.length > 0;
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * Resolves an API path against the configured base URL. Absolute URLs and
 * `data:`/`blob:` URLs are returned untouched, so callers that already hold a
 * full URL (Vercel Blob assets, for instance) can share this helper safely.
 */
export function apiUrl(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  if (!API_BASE_URL) return path;
  return API_BASE_URL + (path.startsWith('/') ? path : `/${path}`);
}

/**
 * `fetch` with the API base URL applied.
 *
 * When the API is cross-origin, credentials are included so the session cookie
 * is sent — the browser's default (`same-origin`) would drop it. Phase 3
 * replaces cookie auth on mobile with a bearer token; until then this is what
 * keeps an authenticated call authenticated. Same-origin web calls are left on
 * the default, so web behaviour is byte-for-byte unchanged.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!isCrossOriginApi()) return fetch(path, init);
  return fetch(apiUrl(path), { credentials: 'include', ...init });
}
