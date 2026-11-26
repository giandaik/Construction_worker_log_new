import { NextResponse } from "next/server";
import { readJsonBody } from '@/lib/api/errorHandling';
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { ApiError } from "@/lib/api/errorHandling";
import { z } from "zod";
import { RepositoryFactory } from "@/lib/repositories";
import { setSessionCookie, validateJWTSecret } from "@/utils/auth";
import { consumeRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  acceptTenantInvitation,
  findPendingInvitation,
  getLegacyUserRole,
  TenantInvitationError,
} from "@/lib/tenant/invitations";

/**
 * Invite acceptance is unauthenticated and creates a user row, so it is
 * limited per IP. An invitation is still required for every account.
 */
const SIGNUP_RATE_LIMIT = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
};

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().max(254).email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  inviteToken: z.string().regex(/^[a-f0-9]{64}$/, 'A valid organisation invitation is required'),
});

export async function POST(request: Request) {
  try {
    const { isLimited, retryAfterSeconds } = consumeRateLimit(
      `signup:ip:${getClientIp(request)}`,
      SIGNUP_RATE_LIMIT,
    );

    if (isLimited) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    const body = await readJsonBody(request);

    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(
        parsed.error.issues.map((issue) => issue.message).join(", ")
      );
    }

    const { name, email, password, inviteToken } = parsed.data;
    const invitation = await findPendingInvitation(inviteToken, email);
    if (!invitation) {
      return ApiError.badRequest('This invitation is invalid, expired, or was sent to a different email address.');
    }

    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      if (await userRepo.isEmailTaken(email)) {
        return ApiError.conflict("An account already exists for this email. Sign in using the invitation link to join.");
      }

      let user: Awaited<ReturnType<typeof userRepo.create>>;
      try {
        user = await userRepo.create({
          name,
          email,
          password: await hash(password, 12),
          role: getLegacyUserRole(invitation.tenantRole),
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'Email already in use') {
          return ApiError.conflict("An account already exists for this email. Sign in using the invitation link to join.");
        }
        throw error;
      }

      let membership: Awaited<ReturnType<typeof acceptTenantInvitation>>;
      try {
        membership = await acceptTenantInvitation(inviteToken, email, user._id!.toString());
      } catch (error) {
        try {
          const memberships = await RepositoryFactory.getMembershipRepository().findByUser(
            user._id!.toString(),
          );
          if (memberships.length === 0) {
            await userRepo.delete(user._id!);
          } else {
            console.error(
              'Retaining account after invitation acceptance failure because membership records remain',
            );
          }
        } catch (rollbackError) {
          console.error('Failed to roll back account created from invitation:', rollbackError);
        }

        if (error instanceof TenantInvitationError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        throw error;
      }

      const jwtSecret = validateJWTSecret();
      const token = await new SignJWT({
        userId: user._id?.toString(),
        role: membership.tenantRole,
        tenantId: membership.tenantId,
        name: user.name,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("12h")
        .sign(new TextEncoder().encode(jwtSecret));

      const response = NextResponse.json(
        {
          message: "Account created",
          user: {
            _id: user._id?.toString(),
            name: user.name,
            email: user.email,
            role: membership.tenantRole,
            tenantId: membership.tenantId,
          },
          token,
        },
        { status: 201 }
      );

      setSessionCookie(response, token);
      return response;
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
