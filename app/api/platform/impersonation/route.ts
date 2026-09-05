import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, setSessionCookie, validateJWTSecret } from '@/utils/auth';
import { PLATFORM_ROLES } from '@/lib/constants/roles';
import { DatabaseUtils } from '@/lib/api/database';

// DELETE — end the active impersonation session and restore super-admin JWT
export async function DELETE(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();

    if (!user.impersonatedBy || !user.impersonationId) {
      return ApiError.badRequest('No active impersonation session');
    }

    // The repositories below are used directly rather than through a
    // with*Repository wrapper, so the connection must be established here.
    await DatabaseUtils.connect();

    // Close the log entry
    await RepositoryFactory.getImpersonationLogRepository().endSession(user.impersonationId);

    // Re-issue a super-admin JWT for the original admin
    const adminUser = await RepositoryFactory.getUserRepository().findById(user.impersonatedBy);
    if (!adminUser) return ApiError.notFound('Admin user');

    const jwtSecret = validateJWTSecret();
    const token = await new SignJWT({
      userId: user.impersonatedBy,
      name: adminUser.name,
      role: adminUser.role,
      platformRole: PLATFORM_ROLES.SUPER_ADMIN,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('12h')
      .sign(new TextEncoder().encode(jwtSecret));

    // Returned in the body as well as the cookie so the mobile client can
    // swap its stored bearer token for the restored super-admin one.
    const response = NextResponse.json({
      message: 'Impersonation ended',
      token,
      redirect: '/platform',
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return ApiError.handle(error);
  }
}
