import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, resolveRepositoryContext } from '@/utils/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();

    const context = resolveRepositoryContext(user);
    return await RepositoryFactory.withProjectRepository(async (projectRepo) => {
      const defaultProject = await projectRepo.findOne({ name: "Default Project" } as any);
      if (!defaultProject) return ApiError.notFound('Default project');
      return ApiError.success(defaultProject);
    }, context);
  } catch (error) {
    return ApiError.handle(error);
  }
} 