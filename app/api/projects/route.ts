import { ApiError } from "@/lib/api/errorHandling";
import { projectSchema } from "@/lib/schemas/projectSchema";
import { RepositoryFactory } from "@/lib/repositories";
import { getAuthUser, isAdmin } from "@/utils/auth";

export async function GET() {
  try {
    return await RepositoryFactory.withRepositories(async ({ projects: projectRepo, workLogs: workLogRepo }) => {
      // Ensure default project exists
      await projectRepo.ensureDefaultProject();

      const [projects, logStats] = await Promise.all([
        projectRepo.findSummary(),
        workLogRepo.getProjectStats(),
      ]);

      const statsByProject = new Map(logStats.map((stats) => [stats.project, stats]));

      const projectsWithStats = projects.map((project) => {
        const stats = statsByProject.get(String(project._id));
        return {
          ...project,
          worklogCount: stats?.worklogCount ?? 0,
          lastLogDate: stats?.lastLogDate ?? null,
        };
      });

      return ApiError.success(projectsWithStats);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();

    // Only admins/managers can create projects
    if (!user || !isAdmin(user)) {
      return ApiError.forbidden('Only administrators can create projects');
    }

    const projectData = await request.json();

    // Validate project data
    const validatedData = projectSchema.safeParse(projectData);
    if (!validatedData.success) {
      return ApiError.badRequest(
        validatedData.error.issues.map(issue => issue.message).join(', ')
      );
    }
    
    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      const owner = await userRepo.findByEmail(
        validatedData.data.ownerEmail
      );

      const contractor = await userRepo.findByEmail(
        validatedData.data.contractorEmail
      );

      if (!owner) {
        return ApiError.badRequest('Owner user not found');
      }

      if (!contractor) {
        return ApiError.badRequest('Contractor user not found');
      }
  

      return await RepositoryFactory.withProjectRepository(async (projectRepo) => {
        // Create new project with required defaults
        const newProject = {
          ...validatedData.data,
          startDate: validatedData.data.startDate || new Date(),
          endDate: validatedData.data.endDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          ownerUserId: owner._id?.toString(),
          contractorUserId: contractor._id?.toString(),
          status: validatedData.data.status || 'planned',
        };

        // Insert using repository
        const project = await projectRepo.create(newProject as any);

        return ApiError.success(project, 201);
      });
    });
    
  } catch (error) {
    return ApiError.handle(error);
  }
}
