import { ApiError } from "@/lib/api/errorHandling";
import { userSchema } from "@/lib/schemas/userSchema";
import { RepositoryFactory } from "@/lib/repositories";
import { getAuthUser, isAdmin } from "@/utils/auth";
import { hash } from "bcryptjs";

export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return ApiError.unauthorized();
    }

    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      await userRepo.ensureDefaultUser();

      // Return user summary (lightweight for dropdowns)
      const users = await userRepo.findSummary();

      return ApiError.success(users);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser();

    // Only admins/managers can create users
    if (!authUser || !isAdmin(authUser)) {
      return ApiError.forbidden('Only administrators can create users');
    }

    const userData = await request.json();

    // Validate user data with Zod schema
    const validatedData = userSchema.safeParse(userData);
    if (!validatedData.success) {
      return ApiError.badRequest(
        validatedData.error.issues.map(issue => issue.message).join(', ')
      );
    }

    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      const { password, ...rest } = validatedData.data;
      const newUser = {
        ...rest,
        password: await hash(password, 12),
        role: rest.role || 'user',
      };

      const user = await userRepo.create(newUser as any);

      return ApiError.success(user, 201);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
} 