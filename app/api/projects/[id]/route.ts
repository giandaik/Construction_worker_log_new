import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return await RepositoryFactory.withProjectRepository(async (projectRepo) => {
      const project = await projectRepo.findById(id);
      if (!project) return ApiError.notFound('Project');
      return ApiError.success(project);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
