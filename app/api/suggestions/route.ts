import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, resolveRepositoryContext } from '@/utils/auth';

const ALLOWED_FIELDS = {
  'personnel.role': { collection: 'worklogs', path: 'personnel.role' },
  'equipment.type': { collection: 'worklogs', path: 'equipment.type' },
  'materials.name': { collection: 'worklogs', path: 'materials.name' },
  'materials.unit': { collection: 'worklogs', path: 'materials.unit' },
} as const;

type FieldKey = keyof typeof ALLOWED_FIELDS;

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return ApiError.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const field = searchParams.get('field') as FieldKey | null;
    const projectId = searchParams.get('project');

    if (!field || !(field in ALLOWED_FIELDS)) {
      return ApiError.badRequest(`field must be one of: ${Object.keys(ALLOWED_FIELDS).join(', ')}`);
    }

    const { path } = ALLOWED_FIELDS[field];
    const context = resolveRepositoryContext(user);

    return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
      const suggestions = await workLogRepo.findSuggestions(
        path,
        user.userId,
        projectId ?? undefined,
      );
      return ApiError.success({ suggestions });
    }, context);
  } catch (error) {
    return ApiError.handle(error);
  }
}
