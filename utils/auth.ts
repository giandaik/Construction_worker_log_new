import { SESSION_COOKIE_NAME } from "@/lib/constants/constants";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { validateJWTSecret as validateJWTSecretEdge } from "@/lib/auth-edge";
import {
  isSuperAdminRole,
  PLATFORM_ROLES,
} from "@/lib/constants/roles";
import {
  tenantContext,
  PLATFORM_CONTEXT,
  type RepositoryContext,
} from "@/lib/repositories/base/RepositoryContext";

/**
 * Validates that JWT secret is configured.
 *
 * Uses the Edge-safe implementation so this module remains safe to
 * import from code paths that may execute in the Edge runtime.
 *
 * @throws Error if JWT secret is missing or too short.
 */
export function validateJWTSecret(): string {
  return validateJWTSecretEdge();
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
) {
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
    maxAge: 0,
  });
}

export interface AuthUser {
  userId: string;
  name: string;
  role: string;
  tenantId?: string;
  platformRole?: typeof PLATFORM_ROLES.SUPER_ADMIN;
  impersonatedBy?: string;
  impersonationId?: string;
}

/**
 * Extracts the JWT from an Authorization: Bearer <token> header.
 *
 * Used by the Capacitor mobile client because the WebView does not
 * reliably send the web session cookie to the API origin.
 *
 * @returns The bearer token, or null if absent/malformed.
 */
export function getTokenFromRequest(
  request: Request,
): string | null {
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

/**
 * Reads the session cookie.
 *
 * cookies() can throw when called outside a request scope, such as
 * certain unit tests. In that case, treat it as "no cookie".
 */
async function getSessionCookieToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();

    return (
      cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null
    );
  } catch {
    return null;
  }
}

/**
 * Converts a verified JWT payload into an AuthUser.
 *
 * Required claims are checked before returning the authenticated user.
 * This prevents malformed JWT payloads from being treated as valid
 * application users merely because the JWT signature is valid.
 */
function authUserFromPayload(
  payload: Record<string, unknown>,
): AuthUser | null {
  if (
    typeof payload.userId !== "string" ||
    !payload.userId ||
    typeof payload.name !== "string" ||
    !payload.name ||
    typeof payload.role !== "string" ||
    !payload.role
  ) {
    return null;
  }

  const platformRole = isSuperAdminRole(payload.platformRole)
    ? PLATFORM_ROLES.SUPER_ADMIN
    : undefined;

  const tenantId = platformRole
    ? undefined
    : typeof payload.tenantId === "string" && payload.tenantId
      ? payload.tenantId
      : undefined;

  const impersonatedBy =
    typeof payload.impersonatedBy === "string" &&
    payload.impersonatedBy
      ? payload.impersonatedBy
      : undefined;

  const impersonationId =
    typeof payload.impersonationId === "string" &&
    payload.impersonationId
      ? payload.impersonationId
      : undefined;

  return {
    userId: payload.userId,
    name: payload.name,
    role: payload.role,
    tenantId,
    platformRole,
    impersonatedBy,
    impersonationId,
  };
}

/**
 * Verifies a JWT and converts it into an AuthUser.
 */
async function verifyAuthToken(
  token: string,
): Promise<AuthUser | null> {
  try {
    const jwtSecret = validateJWTSecret();

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
    );

    return authUserFromPayload(payload);
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return null;
  }
}

/**
 * Gets the authenticated user.
 *
 * Authentication sources:
 *
 * 1. Session cookie — normal web application.
 * 2. Authorization: Bearer <token> — Capacitor/mobile client.
 *
 * The cookie is attempted first so existing web behaviour remains
 * unchanged. If the cookie is missing or invalid, a supplied Bearer
 * token is attempted.
 *
 * Server components can continue calling:
 *
 *   getAuthUser()
 *
 * API/mobile routes can call:
 *
 *   getAuthUser(request)
 *
 * @returns The authenticated user or null if authentication fails.
 */
export async function getAuthUser(
  request?: Request,
): Promise<AuthUser | null> {
  const cookieToken = await getSessionCookieToken();
  const bearerToken = request
    ? getTokenFromRequest(request)
    : null;

  const candidates = [
    cookieToken,
    bearerToken,
  ].filter(
    (token, index, all): token is string =>
      Boolean(token) &&
      all.indexOf(token) === index,
  );

  if (candidates.length === 0) {
    return null;
  }

  for (const token of candidates) {
    const user = await verifyAuthToken(token);

    if (user) {
      return user;
    }
  }

  return null;
}

/**
 * Checks if the user is authorized for tenant-admin operations.
 *
 * SuperAdmin is deliberately NOT included here. SuperAdmin has
 * platform-level privileges and should be checked with isSuperAdmin()
 * / requireSuperAdmin() instead.
 */
export function isAdmin(
  user: AuthUser | null,
): boolean {
  return (
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "admin" ||
    user?.role === "manager" 
  );
}

/**
 * Checks if the user is a platform SuperAdmin.
 */
export function isSuperAdmin(
  user: AuthUser | null,
): boolean {
  return isSuperAdminRole(user?.platformRole);
}

export function requireSuperAdmin(
  user: AuthUser | null,
): AuthUser {
  if (!user || !isSuperAdmin(user)) {
    throw new Error("SuperAdmin access required");
  }

  return user;
}

export { PLATFORM_ROLES };

/**
 * Returns the active tenantId or throws.
 *
 * Never use this for platform/SuperAdmin-only routes.
 */
export function requireTenantId(
  user: AuthUser | null,
): string {
  if (!user?.tenantId) {
    throw new Error("No active tenant in session");
  }

  return user.tenantId;
}

/**
 * Resolves the RepositoryContext for the current authenticated user.
 *
 * SUPER_ADMIN:
 *   PLATFORM_CONTEXT
 *
 * Tenant user:
 *   tenantContext(user.tenantId)
 *
 * This is the single choke point used by routes when constructing
 * tenant-aware repositories. A non-platform user without an active
 * tenant fails closed rather than receiving unscoped access.
 */
export function resolveRepositoryContext(
  user: AuthUser | null,
): RepositoryContext {
  if (!user) {
    throw new Error(
      "resolveRepositoryContext() requires an authenticated user",
    );
  }

  if (isSuperAdmin(user)) {
    return PLATFORM_CONTEXT;
  }

  return tenantContext(user.tenantId);
}

/**
 * Checks if the user can modify a resource.
 *
 * Tenant admins/managers can modify it; otherwise the user must own it.
 *
 * Resource-level authorization should still be performed by the
 * repository/API layer in addition to this UI/helper check.
 */
export function canModify(
  user: AuthUser | null,
  resourceUserId: string,
): boolean {
  if (!user) {
    return false;
  }

  return (
    isAdmin(user) ||
    user.userId === resourceUserId
  );
}

/**
 * Checks if the user is the assigned project owner.
 */
export function isProjectOwner(
  user: AuthUser | null,
  projectOwnerUserId?: string,
): boolean {
  if (!user || !projectOwnerUserId) {
    return false;
  }

  return user.userId === projectOwnerUserId;
}
