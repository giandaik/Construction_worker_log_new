import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

import { SESSION_COOKIE_NAME } from "./lib/constants/constants";
import { validateJWTSecret } from "./lib/auth-edge";
import { isSuperAdminRole } from "./lib/constants/roles";
import { stampFlagOverrides } from "./middleware-helpers";
import {
  applyCorsHeaders,
  preflightResponse,
} from "./lib/cors";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/sample-log",
  "/api/login",
  "/api/signup",
  "/api/logout",
  "/_next",
  "/favicon.ico",
  "/select-tenant",
  "/api/auth/select-tenant",
];

function isPublicPath(pathname: string): boolean {
  // "/" is the public marketing landing page.
  // Exact match only — never use "/" in PUBLIC_PATHS because
  // startsWith("/") would make every route public.
  if (pathname === "/") {
    return true;
  }

  return PUBLIC_PATHS.some((publicPath) =>
    pathname.startsWith(publicPath),
  );
}

/**
 * Extracts Authorization: Bearer <token> without importing server-only
 * authentication code into middleware.
 */
function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");

  if (!header) {
    return null;
  }

  const match = /^Bearer[ \t]+(.+)$/i.exec(header.trim());

  if (!match) {
    return null;
  }

  return match[1].trim() || null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");
  const origin = request.headers.get("origin");

  /**
   * Preflight requests do not contain authentication cookies and normally
   * do not contain the bearer token either. Handle OPTIONS before auth.
   */
  if (isApiRoute && request.method === "OPTIONS") {
    return preflightResponse(origin);
  }

  /**
   * Every API response must carry CORS headers, including authentication
   * and authorization errors.
   */
  const withCors = <T extends NextResponse>(response: T): T =>
    isApiRoute
      ? applyCorsHeaders(response, origin)
      : response;

  /**
   * Public pages/API routes.
   */
  if (isPublicPath(pathname)) {
    return withCors(
      stampFlagOverrides(
        request,
        NextResponse.next(),
      ),
    );
  }

  /**
   * Web:
   *   session cookie
   *
   * Capacitor/mobile:
   *   Authorization: Bearer <token>
   *
   * Cookie takes precedence so normal web behaviour remains unchanged.
   */
  const sessionCookie =
    request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const bearerToken = getBearerToken(request);

  const tokens = [sessionCookie, bearerToken].filter(
    (value, index, all): value is string =>
      Boolean(value) && all.indexOf(value) === index,
  );

  if (tokens.length === 0) {
    if (isApiRoute) {
      return withCors(
        stampFlagOverrides(
          request,
          NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
          ),
        ),
      );
    }

    const loginUrl = new URL("/login", request.url);

    return stampFlagOverrides(
      request,
      NextResponse.redirect(loginUrl),
    );
  }

  try {
    /**
     * Middleware only verifies the JWT cryptographically.
     *
     * It does NOT query MongoDB.
     * It does NOT perform tenant membership lookups.
     *
     * Those checks belong in the API/server/repository layer.
     */
    const jwtSecret = validateJWTSecret();

    let payload: Record<string, unknown> | null = null;

    for (const tokenCandidate of tokens) {
      try {
        const verified = await jwtVerify(
          tokenCandidate,
          new TextEncoder().encode(jwtSecret),
        );
        payload = verified.payload;
        break;
      } catch {
        // Try the next authentication source, such as a valid mobile token.
      }
    }

    if (!payload) {
      throw new Error("No valid authentication token");
    }

    const isPlatformUser = isSuperAdminRole(payload.platformRole);

    const isPendingSelection =
      payload.role === "pending_selection";

    const isPlatformRoute =
      pathname.startsWith("/platform") ||
      pathname.startsWith("/api/platform");
    const isAuthRoute =
      pathname.startsWith("/api/auth/") ||
      pathname === "/api/logout";

    /** Platform routes require SUPER_ADMIN. */
    if (isPlatformRoute) {
      if (!isPlatformUser) {
        if (isApiRoute) {
          return withCors(
            stampFlagOverrides(
              request,
              NextResponse.json(
                { error: "Forbidden" },
                { status: 403 },
              ),
            ),
          );
        }

        const homeUrl = new URL("/app", request.url);

        return stampFlagOverrides(
          request,
          NextResponse.redirect(homeUrl),
        );
      }
    }

    /** SuperAdmin is platform-only and cannot enter tenant routes. */
    if (isPlatformUser && !isPlatformRoute && !isAuthRoute) {
      if (isApiRoute) {
        return withCors(
          stampFlagOverrides(
            request,
            NextResponse.json(
              { error: "SuperAdmin platform-only access" },
              { status: 403 },
            ),
          ),
        );
      }

      return stampFlagOverrides(
        request,
        NextResponse.redirect(new URL("/platform", request.url)),
      );
    }

    /**
     * A normal tenant user must have an active tenant.
     *
     * SUPER_ADMIN does not require tenantId because platform access
     * is intentionally unscoped.
     */
    if (
      !isPlatformUser &&
      !isPendingSelection &&
      !payload.tenantId
    ) {
      if (isApiRoute) {
        return withCors(
          stampFlagOverrides(
            request,
            NextResponse.json(
              {
                error:
                  "No active tenant. Please select an organisation.",
              },
              { status: 403 },
            ),
          ),
        );
      }

      const selectUrl = new URL(
        "/select-tenant",
        request.url,
      );

      return stampFlagOverrides(
        request,
        NextResponse.redirect(selectUrl),
      );
    }

    /**
     * Users whose JWT represents the tenant-selection state may only
     * access the tenant-selection page and its API.
     */
    if (
      isPendingSelection &&
      !pathname.startsWith("/select-tenant") &&
      !pathname.startsWith("/api/auth/select-tenant")
    ) {
      if (isApiRoute) {
        return withCors(
          stampFlagOverrides(
            request,
            NextResponse.json(
              {
                error:
                  "Please select an organisation first",
              },
              { status: 403 },
            ),
          ),
        );
      }

      const selectUrl = new URL(
        "/select-tenant",
        request.url,
      );

      return stampFlagOverrides(
        request,
        NextResponse.redirect(selectUrl),
      );
    }

    return withCors(
      stampFlagOverrides(
        request,
        NextResponse.next(),
      ),
    );
  } catch (error) {
    console.error("JWT ERROR:", error);

    if (isApiRoute) {
      return withCors(
        stampFlagOverrides(
          request,
          NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
          ),
        ),
      );
    }

    const loginUrl = new URL("/login", request.url);

    return stampFlagOverrides(
      request,
      NextResponse.redirect(loginUrl),
    );
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitely-logo.png|hero-construction.jpg|screenshots/).*)",
  ],
};