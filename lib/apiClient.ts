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

import { getMobileToken } from './mobile-auth';
import { isNativeShell, nativePlugin } from './native-bridge';

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
 * One API call through Capacitor's native HTTP client (URLSession on iOS).
 *
 * Inside the WebView the document origin is `capacitor://localhost`, which the
 * deployed API cannot be reached from reliably: the cross-origin request is
 * left pending by WKWebView. The native client has no such origin, and keeps
 * its own cookie jar, so the call behaves like `curl` from the host.
 *
 * The result is wrapped in a real `Response` so every caller stays unchanged.
 */
async function nativeRequest(url: string, init?: RequestInit): Promise<Response> {
  // The injected plugin is what the shell actually serves requests through;
  // `await import('@capacitor/core')` stalls inside the WKWebView (see
  // `lib/native-bridge.ts`), so only import when the global is missing.
  let CapacitorHttp = nativePlugin('CapacitorHttp');
  if (!CapacitorHttp) {
    ({ CapacitorHttp } = await import('@capacitor/core'));
  }

  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });

  const method = (init?.method || 'GET').toUpperCase();

  // CapacitorHttp serialises a JSON body itself; a pre-stringified body has to
  // be unwrapped so it is not sent as a quoted string.
  let data: unknown;
  if (typeof init?.body === 'string') {
    try {
      data = JSON.parse(init.body);
    } catch {
      data = init.body;
    }
  } else if (init?.body !== undefined && init?.body !== null) {
    data = init.body;
  }

  const result = await CapacitorHttp.request({
    url,
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' || data === undefined ? {} : { data }),
  });

  const raw = result.data;
  const body =
    raw === undefined || raw === null ? null : typeof raw === 'string' ? raw : JSON.stringify(raw);

  return new Response(result.status === 204 ? null : body, {
    status: result.status,
    headers: new Headers(result.headers as Record<string, string>),
  });
}

/**
 * `fetch` with the API base URL applied, plus the bearer token on mobile.
 *
 * Same-origin web calls go straight to `fetch` with `init` forwarded verbatim,
 * so web behaviour is byte-for-byte unchanged and still cookie-authenticated.
 *
 * When the API is cross-origin (a mobile build) the stored JWT is attached as
 * `Authorization: Bearer` — the WebView origin never receives the session
 * cookie, so this is what authenticates the call — and the request itself goes
 * through the native HTTP client. An `Authorization` header already set by the
 * caller wins.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!isCrossOriginApi()) return fetch(path, init);

  const headers = new Headers(init?.headers);
  const token = headers.has('Authorization') ? null : await getMobileToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const target = apiUrl(path);

  // Native shell: never let the WebView attempt the cross-origin hop. Keyed on
  // the injected bridge rather than the plugin package, so a mobile bundle
  // opened in an ordinary browser keeps cookie-authenticated `fetch`.
  if (isNativeShell()) {
    return nativeRequest(target, { ...init, headers });
  }

  // Nothing to authenticate with: forward the caller's init untouched, so a
  // mobile call without a stored session differs from a web call only by
  // `credentials: 'include'` and the absolute URL. Converting headers into a
  // `Headers` instance here would silently rewrite a plain object (and drop
  // any prototype-free plain object the caller passed).
  if (!token) return fetch(target, { credentials: 'include', ...init });

  return fetch(target, { credentials: 'include', ...init, headers });
}
