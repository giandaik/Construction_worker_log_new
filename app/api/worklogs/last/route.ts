import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser } from '@/utils/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return ApiError.unauthorized();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project');
    if (!projectId) {
      return ApiError.badRequest('project query param is required');
    }

    return await RepositoryFactory.withWorkLogRepository(async (repo) => {
      const last = await repo.findMostRecentByAuthorAndProject(user.userId, projectId);
      if (!last) return ApiError.success(null);

      return ApiError.success({
        _id: last._id,
        date: last.date,
        project: last.project,
        weather: last.weather,
        temperature: last.temperature,
        personnel: last.personnel ?? [],
        equipment: last.equipment ?? [],
        materials: last.materials ?? [],
      });
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
