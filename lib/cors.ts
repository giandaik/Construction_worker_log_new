/**
 * CORS policy for this app's API routes.
 *
 * The web app is same-origin and needs none of this. The Capacitor WebView is
 * not: its document origin is `capacitor://localhost` on iOS and
 * `http://localhost` on Android, while the API lives on the deployed backend.
 * Every call from the app is therefore cross-origin and must be allowed
 * explicitly, preflight included.
 *
 * Requests carry the session cookie (see `apiFetch`), so the response must send
 * `Access-Control-Allow-Credentials: true`. That is incompatible with the
 * wildcard origin — browsers reject `Allow-Origin: *` on a credentialed
 * request — so the request's own origin is echoed back, and only if it is on
 * the allowlist. An unknown origin gets no CORS headers at all and the browser
 * blocks it, which is the same outcome as today.
 */

/** WebView document origins Capacitor serves the bundle from. */
const WEBVIEW_ORIGINS = [
  'capacitor://localhost', // iOS
  'ionic://localhost', // iOS, older Capacitor/Ionic shells
  'http://localhost', // Android (no port)
];

/**
 * Extra origins from the environment, so a deployment can name its own domains
 * without a code change. `CORS_ALLOWED_ORIGINS` is a comma-separated list;
 * Vercel's own URL vars are picked up automatically.
 */
function environmentOrigins(): string[] {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const vercelHosts = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ].filter(Boolean) as string[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return [
    ...configured,
    ...vercelHosts.map((host) => `https://${host}`),
    ...(appUrl ? [appUrl.replace(/\/$/, '')] : []),
  ];
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (WEBVIEW_ORIGINS.includes(origin)) return true;
  if (environmentOrigins().includes(origin)) return true;
  // Any localhost port in development, so a locally served static export
  // (`npx serve out`) can be pointed at a local backend.
  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
}

/**
 * CORS headers for a request from `origin`, or an empty object when the origin
 * is absent (same-origin request) or not allowed.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin as string,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    // Responses differ by origin; without this a shared cache could serve one
    // origin's CORS headers to another.
    Vary: 'Origin',
  };
}

/** Copies the CORS headers for `origin` onto an existing response. */
export function applyCorsHeaders<T extends { headers: Headers }>(
  response: T,
  origin: string | null,
): T {
  for (const [name, value] of Object.entries(corsHeaders(origin))) {
    response.headers.set(name, value);
  }
  return response;
}

/**
 * 204 response for a preflight `OPTIONS`. Exported for route handlers that need
 * to answer a preflight themselves; the middleware handles the common case.
 */
export function preflightResponse(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
