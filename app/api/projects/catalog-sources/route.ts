import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isAdmin } from '@/utils/auth';

/**
 * Lightweight list of projects (id, name, total catalog size) to drive the
 * "copy options from another project" source picker. Admins/managers only.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) {
      return ApiError.forbidden('Only admins or supervisors can manage the project catalog');
    }

    return await RepositoryFactory.withProjectRepository(async (projectRepo) => {
      const summaries = await projectRepo.findCatalogSummaries();
      return ApiError.success(summaries);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
