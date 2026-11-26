import {ApiError, readJsonBody } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isAdmin, requireTenantId } from '@/utils/auth';
import { membershipUpdateSchema } from '@/lib/schemas/tenantSchema';
import { membershipRefusalResponse } from '@/lib/tenant/membershipGuards';

// PUT — update a member's role
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) return ApiError.forbidden('Only admins can manage members');
    const tenantId = requireTenantId(user);

    const { userId } = await params;
    const body = await readJsonBody(request);
    const parsed = membershipUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((i) => i.message).join(', '));
    }

    // Keep this endpoint for existing member administration, not onboarding.
    const refusal = await membershipRefusalResponse(userId, tenantId);
    if (refusal) return refusal;

    const membershipRepository = RepositoryFactory.getMembershipRepository();
    const membership = await membershipRepository.findMembership(userId, tenantId);
    if (!membership) return ApiError.notFound('Membership');

    await membershipRepository.upsertMembership(
      userId,
      tenantId,
      parsed.data.tenantRole,
      parsed.data.isActive
    );

    return ApiError.success({
      message: 'Member updated',
      userId,
      tenantRole: parsed.data.tenantRole,
      ...(parsed.data.isActive === undefined ? {} : { isActive: parsed.data.isActive }),
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}

// DELETE — remove a member from the active tenant
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) return ApiError.forbidden('Only admins can manage members');
    const tenantId = requireTenantId(user);

    const { userId } = await params;

    // Prevent self-removal
    if (userId === user.userId) {
      return ApiError.badRequest('You cannot remove yourself from the organisation');
    }

    const removed = await RepositoryFactory.getMembershipRepository().removeMembership(
      userId,
      tenantId
    );
    if (!removed) return ApiError.notFound('Membership');

    return ApiError.success({ message: 'Member removed' });
  } catch (error) {
    return ApiError.handle(error);
  }
}
