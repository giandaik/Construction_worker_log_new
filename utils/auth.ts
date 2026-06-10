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
 * Gets the authenticated user from the request
 * @returns The authenticated user or null if not authenticated
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return null;
    }

    const jwtSecret = validateJWTSecret();
    const { payload } = await jwtVerify(
      sessionCookie,
      new TextEncoder().encode(jwtSecret)
    );

    return {
      userId: payload.userId as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return null;
  }
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
