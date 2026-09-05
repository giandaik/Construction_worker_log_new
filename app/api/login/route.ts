import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/dbConnect";
import mongoose from "mongoose";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { setSessionCookie, validateJWTSecret } from "@/utils/auth";
import { RepositoryFactory } from "@/lib/repositories";
import { PLATFORM_ROLES, isSuperAdminRole } from '@/lib/constants/roles';
import { consumeRateLimit, getClientIp, resetRateLimit } from "@/lib/rateLimit";
import { DUMMY_PASSWORD_HASH } from "@/lib/constants/security";

/**
 * Credentials must be strings before they reach MongoDB.
 *
 * Without this, a JSON object value such as `{"$regex":"^alice"}` is passed
 * straight into the `findOne` filter and interpreted as a query operator,
 * letting an attacker select an account by partial identifier.
 */
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string(),
});

/** Both failure paths return exactly this — never "no such user". */
const INVALID_CREDENTIALS = "Invalid credentials";

const LOGIN_RATE_LIMIT = {
  limit: 10,
  windowMs: 5 * 60 * 1000,
};

function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many login attempts. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

async function buildToken(payload: Record<string, unknown>, jwtSecret: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(jwtSecret));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    /**
     * Two independent buckets: the IP bucket stops one host spraying many
     * accounts, the email bucket stops a distributed spray against one
     * account. Either being exhausted rejects the request.
     */
    const ipKey = `login:ip:${getClientIp(request)}`;
    const emailKey = `login:email:${email}`;

    const ipLimit = consumeRateLimit(ipKey, LOGIN_RATE_LIMIT);
    const emailLimit = consumeRateLimit(emailKey, LOGIN_RATE_LIMIT);

    if (ipLimit.isLimited || emailLimit.isLimited) {
      return tooManyRequests(
        Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds),
      );
    }

    await dbConnect();
    const db = mongoose.connection;
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ email });

    /**
     * Always run one bcrypt compare, against the real hash when the account
     * exists and the dummy hash otherwise, so both paths take the same time.
     */
    const passwordMatches = await compare(
      password,
      (user?.password as string | undefined) ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !user.password || !passwordMatches) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    // Credentials are good — a legitimate user is not locked out by earlier typos.
    resetRateLimit(ipKey);
    resetRateLimit(emailKey);

    const jwtSecret = validateJWTSecret();

    // Super-admin: no tenant context needed
    if (isSuperAdminRole(user.platformRole)) {
      const token = await buildToken(
        { userId: user._id.toString(), name: user.name, role: user.role, platformRole: PLATFORM_ROLES.SUPER_ADMIN },
        jwtSecret
      );
      const response = NextResponse.json({
        message: "Logged in successfully",
        token,
        user: { _id: user._id.toString(), name: user.name, email: user.email, role: user.role, platformRole: PLATFORM_ROLES.SUPER_ADMIN },
        redirect: "/platform",
      });
      setSessionCookie(response, token);
      return response;
    }

    // Regular user: load tenant memberships
    const memberships = await RepositoryFactory.getMembershipRepository().findByUser(
      user._id.toString()
    );
    const activeMemberships = memberships.filter((m) => m.isActive);

    if (activeMemberships.length === 0) {
      return NextResponse.json(
        { error: "Your account is not associated with any organisation. Contact your administrator." },
        { status: 403 }
      );
    }

    // Single tenant: issue full JWT immediately
    if (activeMemberships.length === 1) {
      const membership = activeMemberships[0];
      const token = await buildToken(
        {
          userId: user._id.toString(),
          name: user.name,
          role: membership.tenantRole,
          tenantId: membership.tenantId.toString(),
        },
        jwtSecret
      );
      const response = NextResponse.json({
        message: "Logged in successfully",
        token,
        user: {
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: membership.tenantRole,
          tenantId: membership.tenantId.toString(),
        },
        redirect: "/app",
      });
      setSessionCookie(response, token);
      return response;
    }

    // Multiple tenants: return list so client can pick one
    const tenantRepo = RepositoryFactory.getTenantRepository();
    const tenantDetails = await Promise.all(
      activeMemberships.map(async (m) => {
        const tenant = await tenantRepo.findById(m.tenantId.toString());
        return { tenantId: m.tenantId.toString(), tenantName: tenant?.name ?? m.tenantId.toString(), tenantRole: m.tenantRole };
      })
    );

    // Issue a short-lived selector token (no tenantId yet)
    const selectorToken = await buildToken(
      { userId: user._id.toString(), name: user.name, role: "pending_selection" },
      jwtSecret
    );
    const response = NextResponse.json({
      message: "tenant_selection_required",
      token: selectorToken,
      user: { _id: user._id.toString(), name: user.name, email: user.email },
      tenants: tenantDetails,
    });
    setSessionCookie(response, selectorToken);
    return response;
  } catch (error) {
    console.error("Error during login:", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
