import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { ApiError, readJsonBody } from '@/lib/api/errorHandling';
import { sendTenantInvitationEmail } from '@/lib/email/sendEmail';
import { tenantInvitationSchema } from '@/lib/schemas/tenantSchema';
import { RepositoryFactory } from '@/lib/repositories';
import { canAssignRole, resolveTenantRole } from '@/lib/tenant/roleHierarchy';
import {
  createInvitationToken,
  buildTenantInvitationUrl,
  getLegacyUserRole,
  hashInvitationToken,
  removeTenantInvitation,
  saveTenantInvitation,
} from '@/lib/tenant/invitations';
import { checkMembershipEligibility } from '@/lib/tenant/membershipGuards';
import { getAuthUser, isAdmin, requireTenantId } from '@/utils/auth';

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) return ApiError.forbidden('Only administrators can invite members');

    const tenantId = requireTenantId(user);
    const body = await readJsonBody(request);
    const parsed = tenantInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    const { email, tenantRole } = parsed.data;
    const userRole = getLegacyUserRole(tenantRole);
    if (!canAssignRole(await resolveTenantRole(user), userRole)) {
      return ApiError.forbidden(`Your role cannot invite a member with the ${userRole} role`);
    }

    const tenant = await RepositoryFactory.getTenantRepository().findById(tenantId);
    if (!tenant || tenant.status !== 'active') {
      return ApiError.conflict('This organisation is not currently active');
    }

    const existingUser = await RepositoryFactory.getUserRepository().findByEmail(email);
    if (existingUser?._id) {
      const membership = await RepositoryFactory.getMembershipRepository().findMembership(
        existingUser._id,
        tenantId,
      );
      if (membership?.isActive) {
        return ApiError.conflict('This account already belongs to the organisation');
      }

      const refusal = await checkMembershipEligibility(existingUser._id.toString(), tenantId);
      if (refusal) return ApiError.conflict(refusal);
    }

    const inviterId = ObjectId.isValid(user.userId) ? new ObjectId(user.userId) : null;
    if (!inviterId) return ApiError.unauthorized();

    const token = createInvitationToken();
    const inviteUrl = buildTenantInvitationUrl(request, token);
    const invitation = {
      tokenHash: hashInvitationToken(token),
      email,
      tenantId: new ObjectId(tenantId),
      tenantRole,
      invitedBy: inviterId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending' as const,
    };

    await saveTenantInvitation(invitation);

    let emailSent: boolean;
    try {
      emailSent = await sendTenantInvitationEmail({
        email,
        tenantName: tenant.name,
        inviterName: user.name,
        tenantRole,
        inviteUrl,
      });
    } catch (error) {
      try {
        await removeTenantInvitation(token);
      } catch (cleanupError) {
        console.error('Failed to remove unsent tenant invitation:', cleanupError);
      }
      throw error;
    }

    if (!emailSent) {
      await removeTenantInvitation(token);
      return NextResponse.json(
        { error: 'Invitation email could not be sent. Check the SMTP configuration and try again.' },
        { status: 503 },
      );
    }

    return ApiError.success(
      { message: 'Invitation sent', email, expiresAt: invitation.expiresAt },
      201,
    );
  } catch (error) {
    return ApiError.handle(error);
  }
}
