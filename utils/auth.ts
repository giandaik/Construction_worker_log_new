import { SESSION_COOKIE_NAME } from "@/lib/constants/constants";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Validates that JWT secret is configured
 * @throws Error if JWT secret is missing or too short
 */
export function validateJWTSecret(): string {
  const secret = process.env.NEXT_JWT_SECRET;

  if (!secret) {
    throw new Error("NEXT_JWT_SECRET environment variable is not configured");
  }

  if (secret.length < 32) {
    throw new Error("NEXT_JWT_SECRET must be at least 32 characters long for security");
  }

  return secret;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60, // 12 hours
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0, // expire immediately
  });
}

export interface AuthUser {
  userId: string;
  name: string;
  role: string;
}

/**
 * Extracts the JWT from an `Authorization: Bearer <token>` header.
 *
 * This is how the Capacitor WebView authenticates: its document origin
 * (`capacitor://localhost`) is not the API origin, so the session cookie is
 * never sent. The token is stored on the device instead (see
 * `lib/mobile-auth.ts`) and attached by `apiFetch`.
 *
 * @returns The bearer token, or null if the header is absent or malformed
 */
export function getTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer[ \t]+(.+)$/i.exec(header.trim());
  if (!match) return null;

  return match[1].trim() || null;
}

/**
 * Reads the session cookie, tolerating being called outside a request scope.
 *
 * `cookies()` throws when there is no request context (a route handler invoked
 * directly from a unit test, for instance). That must not shadow the bearer
 * token path, so a throw is treated the same as "no cookie".
 */
async function getSessionCookieToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Gets the authenticated user from the request.
 *
 * The cookie is tried first, so web behaviour is unchanged. When `request` is
 * supplied, an `Authorization: Bearer` header is used as a fallback — and also
 * as a second attempt if the cookie is present but no longer verifies, so a
 * stale web cookie can't lock out a mobile client that sent a valid token.
 *
 * Callers with no access to a `Request` (server components) may keep calling
 * this with no arguments; they get the cookie-only behaviour they had before.
 *
 * @returns The authenticated user or null if not authenticated
 */
export async function getAuthUser(request?: Request): Promise<AuthUser | null> {
  const cookieToken = await getSessionCookieToken();
  const bearerToken = request ? getTokenFromRequest(request) : null;

  const candidates = [cookieToken, bearerToken].filter(
    (token, index, all): token is string =>
      Boolean(token) && all.indexOf(token) === index
  );

  if (candidates.length === 0) {
    return null;
  }

  for (const token of candidates) {
    try {
      const jwtSecret = validateJWTSecret();
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(jwtSecret)
      );

      return {
        userId: payload.userId as string,
        name: payload.name as string,
        role: payload.role as string,
      };
    } catch (error) {
      console.error("Error verifying auth token:", error);
    }
  }

  return null;
}

/**
 * Checks if user is authorized for admin operations
 */
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin" || user?.role === "manager";
}

/**
 * Checks if user can modify a resource (admin or owner)
 */
export function canModify(user: AuthUser | null, resourceUserId: string): boolean {
  if (!user) return false;
  return isAdmin(user) || user.userId === resourceUserId;
}

/**
 * Checks if the user is the assigned project owner.
 */
export function isProjectOwner(user: AuthUser | null, projectOwnerUserId?: string): boolean {
  if (!user || !projectOwnerUserId) return false;
  return user.userId === projectOwnerUserId;
}
