import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import type { User } from '@/lib/repositories';
import { getAuthUser, isSuperAdmin } from '@/utils/auth';
import { platformSuperAdminSchema } from '@/lib/schemas/userSchema';
import { hash } from 'bcryptjs';
import { PLATFORM_ROLES } from '@/lib/constants/roles';

// GET — platform-level view of all users
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || !isSuperAdmin(user)) return ApiError.forbidden();

    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      const users = await userRepo.findPlatformSuperAdmins();
      return ApiError.success(users);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthUser();
    if (!actor || !isSuperAdmin(actor)) return ApiError.forbidden();

    const parsed = platformSuperAdminSchema.safeParse(await request.json());
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((issue) => issue.message).join(', '));
    }

    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      const email = parsed.data.email.trim().toLowerCase();
      if (await userRepo.isEmailTaken(email)) {
        return ApiError.badRequest('A user with this email already exists');
      }

      const user = await userRepo.create({
        name: parsed.data.name.trim(),
        email,
        password: await hash(parsed.data.password, 12),
        role: 'user',
        platformRole: PLATFORM_ROLES.SUPER_ADMIN,
      } as Omit<User, '_id' | 'createdAt' | 'updatedAt'>);
      return ApiError.success(user, 201);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
