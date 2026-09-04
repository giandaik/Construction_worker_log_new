import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isAdmin, resolveRepositoryContext } from '@/utils/auth';

/**
 * Lightweight list of projects (id, name, total catalog size) to drive the
 * "copy options from another project" source picker. Admins/managers only.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) {
      return ApiError.forbidden('Only admins or supervisors can manage the project catalog');
    }

    const context = resolveRepositoryContext(user);

    return await RepositoryFactory.withProjectRepository(async (projectRepo) => {
      const summaries = await projectRepo.findCatalogSummaries();
      return ApiError.success(summaries);
    }, context);
  } catch (error) {
    return ApiError.handle(error);
  }
}
