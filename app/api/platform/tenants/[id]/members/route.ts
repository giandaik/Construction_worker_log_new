import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isSuperAdmin } from '@/utils/auth';

// GET — platform-level view of member count for a specific tenant
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isSuperAdmin(user)) return ApiError.forbidden();

    const { id: tenantId } = await params;
    const memberRepo = RepositoryFactory.getMembershipRepository();

    const count = await memberRepo.countByTenant(tenantId);

    return ApiError.success({ count });
  } catch (error) {
    return ApiError.handle(error);
  }
}
