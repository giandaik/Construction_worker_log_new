import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "./lib/constants/constants";
import { getTokenFromRequest, validateJWTSecret } from "./utils/auth";
import { stampFlagOverrides } from "./middleware-helpers";
import { applyCorsHeaders, preflightResponse } from "./lib/cors";


// Paths that don't require authentication. "/" is the public marketing
// landing page — handled by exact match below, NOT listed here, because a
// "/" prefix entry would make every route public under startsWith semantics.
const PUBLIC_PATHS = ["/login", "/signup", "/api/login", "/api/signup", "/api/logout", "/_next", "/favicon.ico"];

function isPublicPath(pathname: string) {
  // "/" is the marketing landing page — exact match only.
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");
  const origin = request.headers.get("origin");

  // Preflight carries no cookies, so it must be answered before the auth check
  // below — otherwise the browser sees a 401 with no CORS headers and never
  // sends the real request.
  if (isApiRoute && request.method === "OPTIONS") {
    return preflightResponse(origin);
  }

  // Every API response needs CORS headers, including the 401s: a WebView that
  // cannot read the error body has no way to know it should log in again.
  const withCors = <T extends NextResponse>(response: T): T =>
    isApiRoute ? applyCorsHeaders(response, origin) : response;

  if (isPublicPath(pathname)) {
    return withCors(stampFlagOverrides(request, NextResponse.next()));
  }

  // The Capacitor WebView is a different origin from the API, so it never sends
  // the session cookie; it authenticates with a bearer token instead. Cookie
  // first keeps web behaviour identical.
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const token = sessionCookie ?? getTokenFromRequest(request);

  if (!token) {
    // For API routes, return 401 Unauthorized instead of redirecting
    if (isApiRoute) {
      return withCors(
        stampFlagOverrides(
          request,
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        ),
      );
    }

    // For page routes, keep redirecting to login
    const loginUrl = new URL("/login", request.url);
    return stampFlagOverrides(request, NextResponse.redirect(loginUrl));
  }
  try {
    const jwtSecret = validateJWTSecret();
    await jwtVerify(token, new TextEncoder().encode(jwtSecret));

    return withCors(stampFlagOverrides(request, NextResponse.next()));
  } catch (err) {
    console.error("JWT ERROR:", err);
    return withCors(
      stampFlagOverrides(
        request,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      ),
    );
  }

}

export const config = {
  // Skip auth middleware for Next internals, the favicon, and the named
  // /public assets below. Without this, the next/image optimizer's
  // internal fetch of a public image gets redirected to /login and
  // returns "not a valid image". List assets explicitly — a blanket
  // image-extension exclusion would also bypass auth on dynamic routes
  // like /worklogs/x.png. Add new /public assets to this list.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitely-logo.png|hero-construction.jpg|screenshots/).*)",
  ],
};


