import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { catalogUpdateSchema } from '@/lib/schemas/projectSchema';
import { getAuthUser, isAdmin, resolveRepositoryContext } from '@/utils/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) {
      return ApiError.forbidden('Only admins or supervisors can manage the project catalog');
    }

    const context = resolveRepositoryContext(user);

    const { id } = await params;
    const parsed = catalogUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((i) => i.message).join(', '));
    }

    return await RepositoryFactory.withProjectRepository(async (projectRepo) => {
      const updated = await projectRepo.setCatalog(id, parsed.data.kind, parsed.data.values);
      if (!updated) return ApiError.notFound('Project');
      return ApiError.success(updated);
    }, context);
  } catch (error) {
    return ApiError.handle(error);
  }
}
