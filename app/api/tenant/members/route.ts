import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isAdmin, requireTenantId } from '@/utils/auth';
import { membershipSchema } from '@/lib/schemas/tenantSchema';

// GET — list all members of the active tenant
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();
    const tenantId = requireTenantId(user);

    const members = await RepositoryFactory.getMembershipRepository().findByTenant(tenantId);
    const userRepo = RepositoryFactory.getUserRepository();

    const enriched = await Promise.all(
      members.map(async (m) => {
        const u = await userRepo.findById(m.userId.toString());
        return { ...m, name: u?.name, email: u?.email };
      })
    );

    return ApiError.success(enriched);
  } catch (error) {
    return ApiError.handle(error);
  }
}

// POST — add a user to the active tenant (admin only)
export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) return ApiError.forbidden('Only admins can manage members');
    const tenantId = requireTenantId(user);

    const body = await request.json();
    const parsed = membershipSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((i) => i.message).join(', '));
    }

    // Verify the target user exists
    const targetUser = await RepositoryFactory.getUserRepository().findById(parsed.data.userId);
    if (!targetUser) return ApiError.notFound('User');

    await RepositoryFactory.getMembershipRepository().upsertMembership(
      parsed.data.userId,
      tenantId,
      parsed.data.tenantRole
    );

    return ApiError.success({ message: 'Member added', userId: parsed.data.userId, tenantRole: parsed.data.tenantRole }, 201);
  } catch (error) {
    return ApiError.handle(error);
  }
}
