import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME } from "./lib/constants/constants";
import { validateJWTSecret } from "./utils/auth";
import { stampFlagOverrides } from "./middleware-helpers";


// Paths that don't require authentication
const PUBLIC_PATHS = ["/login", "/signup", "/api/login", "/api/signup", "/api/logout", "/_next", "/favicon.ico"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return stampFlagOverrides(request, NextResponse.next());
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    // For API routes, return 401 Unauthorized instead of redirecting
    if (pathname.startsWith("/api")) {
      return stampFlagOverrides(
        request,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    // For page routes, keep redirecting to login
    const loginUrl = new URL("/login", request.url);
    return stampFlagOverrides(request, NextResponse.redirect(loginUrl));
  }
  try {
    const jwtSecret = validateJWTSecret();
    await jwtVerify(sessionCookie!, new TextEncoder().encode(jwtSecret));

    return stampFlagOverrides(request, NextResponse.next());
  } catch (err) {
    console.error("JWT ERROR:", err);
    return stampFlagOverrides(
      request,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};


