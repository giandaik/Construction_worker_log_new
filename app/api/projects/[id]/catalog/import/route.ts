import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { catalogImportSchema } from '@/lib/schemas/projectSchema';
import { toProjectCatalog } from '@/lib/catalog/mergeCatalog';
import { getAuthUser, isAdmin } from '@/utils/auth';

/**
 * Copy (additively merge) another project's option catalog into this one.
 * Server is the source of truth for the merge; the client preview is advisory.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) {
      return ApiError.forbidden('Only admins or supervisors can manage the project catalog');
    }

    const { id } = await params;
    const parsed = catalogImportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((i) => i.message).join(', '));
    }

    const { sourceProjectId } = parsed.data;
    if (sourceProjectId === id) {
      return ApiError.badRequest('Cannot import a project into itself');
    }

    return await RepositoryFactory.withProjectRepository(async (projectRepo) => {
      const source = await projectRepo.findById(sourceProjectId);
      if (!source) return ApiError.notFound('Source project');

      const updated = await projectRepo.mergeCatalog(id, toProjectCatalog(source));
      if (!updated) return ApiError.notFound('Project');

      return ApiError.success(updated);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
