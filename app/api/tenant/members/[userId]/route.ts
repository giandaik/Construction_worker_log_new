import { ApiError } from '@/lib/api/errorHandling';
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
    const body = await request.json();
    const parsed = membershipUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((i) => i.message).join(', '));
    }

    // upsertMembership creates what it cannot find, so PUT is a second way
    // into the tenant: it has to refuse an outsider exactly as POST does.
    const refusal = await membershipRefusalResponse(userId, tenantId);
    if (refusal) return refusal;

    await RepositoryFactory.getMembershipRepository().upsertMembership(
      userId,
      tenantId,
      parsed.data.tenantRole
    );

    return ApiError.success({ message: 'Member updated', userId, tenantRole: parsed.data.tenantRole });
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
