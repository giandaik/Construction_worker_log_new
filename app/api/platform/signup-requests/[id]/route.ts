import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { ApiError, readJsonBody } from '@/lib/api/errorHandling';
import {
  sendSignupRequestRejectedEmail,
  sendTenantInvitationEmail,
} from '@/lib/email/sendEmail';
import { signupRequestDecisionSchema } from '@/lib/schemas/signupRequestSchema';
import { RepositoryFactory } from '@/lib/repositories';
import {
  buildTenantInvitationUrl,
  createInvitationToken,
  hasPendingTenantInvitation,
  hashInvitationToken,
  removeTenantInvitation,
  saveTenantInvitation,
} from '@/lib/tenant/invitations';
import {
  claimPendingSignupRequest,
  decideSignupRequest,
  findPendingSignupRequestById,
  releaseSignupRequestClaim,
} from '@/lib/tenant/signupRequests';
import { checkMembershipEligibility } from '@/lib/tenant/membershipGuards';
import type { TenantRole } from '@/lib/models/UserTenantMembership';
import { getAuthUser, isSuperAdmin } from '@/utils/auth';

class SignupRequestActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SignupRequestActionError';
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let claimedRequest: { id: ObjectId; claimId: string } | null = null;
  let keepClaim = false;
  let invitationToken: string | null = null;
  let invitationDelivered = false;
  try {
    const actor = await getAuthUser(request);
    if (!actor || !isSuperAdmin(actor)) return ApiError.forbidden();
    if (!ObjectId.isValid(actor.userId)) return ApiError.forbidden();
    const actorId = new ObjectId(actor.userId);

    const { id } = await params;
    if (!ObjectId.isValid(id)) return ApiError.notFound('Signup request');

    const parsed = signupRequestDecisionSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    const requestId = new ObjectId(id);
    if (!await findPendingSignupRequestById(requestId)) return ApiError.notFound('Signup request');

    const claim = await claimPendingSignupRequest(requestId);
    if (!claim) {
      return ApiError.conflict('This request has already been handled or is being processed.');
    }
    claimedRequest = { id: requestId, claimId: claim.claimId };

    if (parsed.data.action === 'reject') {
      const decided = await decideSignupRequest(
        requestId,
        claim.claimId,
        'rejected',
        actorId,
        { rejectionReason: parsed.data.reason },
      );
      if (!decided) throw new SignupRequestActionError('The request could not be rejected.', 409);

      keepClaim = true;
      const emailSent = await sendSignupRequestRejectedEmail({
        email: claim.request.email,
        firstName: claim.request.firstName,
        organizationName: claim.request.organizationName,
        reason: parsed.data.reason,
      });
      return NextResponse.json({
        message: 'Request rejected',
        notificationSent: emailSent,
      });
    }

    const tenantId = parsed.data.tenantId;
    if (!ObjectId.isValid(tenantId)) throw new SignupRequestActionError('A valid organisation is required.', 400);
    const tenant = await RepositoryFactory.getTenantRepository().findById(tenantId);
    if (!tenant || tenant.status !== 'active') {
      throw new SignupRequestActionError('Choose an active organisation before approving this request.', 409);
    }

    const existingUser = await RepositoryFactory.getUserRepository().findByEmail(claim.request.email);
    if (existingUser?._id) {
      const refusal = await checkMembershipEligibility(existingUser._id.toString(), tenantId);
      if (refusal) throw new SignupRequestActionError(refusal, 409);
      const membership = await RepositoryFactory.getMembershipRepository().findMembership(
        existingUser._id,
        tenantId,
      );
      if (membership?.isActive) {
        throw new SignupRequestActionError('This account already belongs to the selected organisation.', 409);
      }
    }

    if (await hasPendingTenantInvitation(claim.request.email, tenantId)) {
      throw new SignupRequestActionError(
        'An invitation is already pending for this email and organisation.',
        409,
      );
    }

    const tenantRole: TenantRole = parsed.data.tenantRole;
    const token = createInvitationToken();
    invitationToken = token;
    const inviteUrl = buildTenantInvitationUrl(request, token);
    const invitation = {
      tokenHash: hashInvitationToken(token),
      email: claim.request.email,
      tenantId: new ObjectId(tenantId),
      tenantRole,
      invitedBy: actorId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending' as const,
    };

    await saveTenantInvitation(invitation);
    const emailSent = await sendTenantInvitationEmail({
      email: claim.request.email,
      tenantName: tenant.name,
      inviterName: actor.name,
      tenantRole,
      inviteUrl,
    });

    if (!emailSent) {
      await removeTenantInvitation(token);
      invitationToken = null;
      throw new SignupRequestActionError(
        'Invitation email could not be sent. The request remains pending; check email configuration and try again.',
        503,
      );
    }
    invitationDelivered = true;

    const decided = await decideSignupRequest(
      requestId,
      claim.claimId,
      'approved',
      actorId,
      { tenantId: new ObjectId(tenantId), tenantRole },
    );
    if (!decided) {
      keepClaim = true;
      throw new SignupRequestActionError(
        'The invitation was sent, but the request status could not be updated. Check the request before retrying.',
        500,
      );
    }

    keepClaim = true;
    return NextResponse.json({ message: 'Request approved and invitation sent' });
  } catch (error) {
    if (invitationToken && !invitationDelivered) {
      try {
        await removeTenantInvitation(invitationToken);
      } catch (cleanupError) {
        console.error('Failed to remove an unsent signup-request invitation:', cleanupError);
      }
    }

    if (claimedRequest && !keepClaim) {
      try {
        await releaseSignupRequestClaim(claimedRequest.id, claimedRequest.claimId);
      } catch (releaseError) {
        console.error('Failed to release signup request claim:', releaseError);
      }
    }

    if (error instanceof SignupRequestActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return ApiError.handle(error);
  }
}
