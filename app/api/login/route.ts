import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import mongoose from "mongoose";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { setSessionCookie, validateJWTSecret } from "@/utils/auth";
import { RepositoryFactory } from "@/lib/repositories";
import { PLATFORM_ROLES, isSuperAdminRole } from '@/lib/constants/roles';

async function buildToken(payload: Record<string, unknown>, jwtSecret: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(jwtSecret));
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await dbConnect();
    const db = mongoose.connection;
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ email });

    if (!user || !user.password || !(await compare(password, user.password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

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
    console.log("User memberships:", user._id.toString(), memberships);
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


