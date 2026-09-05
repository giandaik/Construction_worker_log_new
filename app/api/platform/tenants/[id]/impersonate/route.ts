import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isSuperAdmin, setSessionCookie, validateJWTSecret } from '@/utils/auth';

// POST — super-admin starts an impersonation session inside a tenant
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const superAdmin = await getAuthUser(request);
    if (!superAdmin || !isSuperAdmin(superAdmin)) return ApiError.forbidden();

    const { id: tenantId } = await params;
    const { userId, reason } = await request.json();
    if (!userId) return ApiError.badRequest('userId is required');

    // Verify tenant exists and is active
    const tenant = await RepositoryFactory.getTenantRepository().findById(tenantId);
    if (!tenant) return ApiError.notFound('Tenant');
    if (tenant.status !== 'active') {
      return ApiError.badRequest('Cannot impersonate into an inactive tenant');
    }

    // Verify the target user is actually a member of this tenant
    const membership = await RepositoryFactory.getMembershipRepository().findMembership(
      userId,
      tenantId
    );
    if (!membership) return ApiError.badRequest('User is not a member of this tenant');

    const targetUser = await RepositoryFactory.getUserRepository().findById(userId);
    if (!targetUser) return ApiError.notFound('User');

    // Record the impersonation
    const logEntry = await RepositoryFactory.getImpersonationLogRepository().startSession(
      superAdmin.userId,
      tenantId,
      userId,
      reason
    );

    const jwtSecret = validateJWTSecret();
    const token = await new SignJWT({
      userId,
      name: targetUser.name,
      role: membership.tenantRole,
      tenantId,
      impersonatedBy: superAdmin.userId,
      impersonationId: logEntry._id?.toString(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('4h')
      .sign(new TextEncoder().encode(jwtSecret));

    const response = NextResponse.json({
      message: 'Impersonation started',
      impersonationId: logEntry._id?.toString(),
      targetUser: { userId, name: targetUser.name, tenantId, tenantRole: membership.tenantRole },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return ApiError.handle(error);
  }
}
