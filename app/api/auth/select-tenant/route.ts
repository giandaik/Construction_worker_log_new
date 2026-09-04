import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getAuthUser, setSessionCookie, validateJWTSecret } from "@/utils/auth";
import { RepositoryFactory } from "@/lib/repositories";
import { ApiError } from "@/lib/api/errorHandling";

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return ApiError.unauthorized();

    const { tenantId } = await request.json();
    if (!tenantId || typeof tenantId !== "string") {
      return ApiError.badRequest("tenantId is required");
    }

    // Server-side validation: user must actually be a member of this tenant
    const membership = await RepositoryFactory.getMembershipRepository().findMembership(
      authUser.userId,
      tenantId
    );

    if (!membership || !membership.isActive) {
      return ApiError.forbidden("You are not a member of this organisation");
    }

    // Verify the tenant itself is active
    const tenant = await RepositoryFactory.getTenantRepository().findById(tenantId);
    if (!tenant || tenant.status !== "active") {
      return ApiError.forbidden("This organisation is not currently active");
    }

    const jwtSecret = validateJWTSecret();
    const token = await new SignJWT({
      userId: authUser.userId,
      name: authUser.name,
      role: membership.tenantRole,
      tenantId: membership.tenantId.toString(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(new TextEncoder().encode(jwtSecret));

    const response = NextResponse.json({
      message: "Tenant selected",
      user: { userId: authUser.userId, name: authUser.name, role: membership.tenantRole, tenantId },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return ApiError.handle(error);
  }
}
