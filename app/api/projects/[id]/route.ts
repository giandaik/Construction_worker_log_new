import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { projectUpdateSchema } from '@/lib/schemas/projectSchema';
import { getAuthUser, isAdmin } from '@/utils/auth';

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    // Only admins/managers can edit projects
    if (!user || !isAdmin(user)) {
      return ApiError.forbidden('Only administrators can edit projects');
    }

    const { id } = await params;

    const validatedData = projectUpdateSchema.safeParse(await request.json());
    if (!validatedData.success) {
      return ApiError.badRequest(
        validatedData.error.issues.map((issue) => issue.message).join(', ')
      );
    }

    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      const owner = await userRepo.findByEmail(validatedData.data.ownerEmail);
      const contractor = await userRepo.findByEmail(validatedData.data.contractorEmail);

      if (!owner) return ApiError.badRequest('Owner user not found');
      if (!contractor) return ApiError.badRequest('Contractor user not found');

      return await RepositoryFactory.withProjectRepository(async (projectRepo) => {
        const updated = await projectRepo.update(id, {
          ...validatedData.data,
          ownerUserId: owner._id?.toString(),
          contractorUserId: contractor._id?.toString(),
        } as any);

        if (!updated) return ApiError.notFound('Project');
        return ApiError.success(updated);
      });
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
