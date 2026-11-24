import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import {
  getAuthUserIgnoringImpersonationState,
  setSessionCookie,
  validateJWTSecret,
} from '@/utils/auth';
import { PLATFORM_ROLES } from '@/lib/constants/roles';
import { DatabaseUtils } from '@/lib/api/database';

// DELETE — end the active impersonation session and restore super-admin JWT
export async function DELETE(request: Request) {
  try {
    // This is the one route that reads the token without the
    // "is the impersonation still open?" gate — it is the route that closes
    // the session, so it has to distinguish a replay (409) from an
    // unauthenticated caller (401).
    const user = await getAuthUserIgnoringImpersonationState(request);
    if (!user) return ApiError.unauthorized();

    if (!user.impersonatedBy || !user.impersonationId) {
      return ApiError.badRequest('No active impersonation session');
    }

    // The repositories below are used directly rather than through a
    // with*Repository wrapper, so the connection must be established here.
    await DatabaseUtils.connect();

    // Conditional close: `endActiveSession` only matches an entry that has no
    // `endedAt`, so a replayed DELETE — the same token sent twice — matches
    // nothing and cannot mint a second super-admin token.
    const closed = await RepositoryFactory.getImpersonationLogRepository()
      .endActiveSession(user.impersonationId);

    if (!closed) {
      return ApiError.conflict('Impersonation session has already ended');
    }

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
