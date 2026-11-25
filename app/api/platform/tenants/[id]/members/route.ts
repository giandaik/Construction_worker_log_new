import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isSuperAdmin } from '@/utils/auth';

/**
 * GET — platform-level view of a specific tenant's members.
 *
 * Returns the count the tenant list already relied on, plus the member rows
 * themselves. The support flow ("impersonate this customer") needs to pick a
 * person, and without names here an operator had to know a raw user id.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isSuperAdmin(user)) return ApiError.forbidden();

    const { id: tenantId } = await params;
    const memberRepo = RepositoryFactory.getMembershipRepository();
    const userRepo = RepositoryFactory.getUserRepository();

    const memberships = await memberRepo.findByTenant(tenantId);
    const members = await Promise.all(
      memberships.map(async (membership) => {
        const account = await userRepo.findById(membership.userId.toString());
        return {
          userId: membership.userId.toString(),
          name: account?.name ?? '(deleted user)',
          email: account?.email ?? '',
          tenantRole: membership.tenantRole,
          isActive: membership.isActive,
        };
      }),
    );

    return ApiError.success({
      count: members.filter((member) => member.isActive).length,
      members,
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
