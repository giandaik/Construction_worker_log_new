import { getAuthUser } from '@/utils/auth';
import { RepositoryFactory } from '@/lib/repositories';
import { ApiError } from '@/lib/api/errorHandling';

export async function GET() {
  try {
    const authUser = await getAuthUser();

    if (!authUser) {
      return ApiError.unauthorized();
    }

    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      const user = await userRepo.findById(authUser.userId);
      if (!user) {
        return ApiError.notFound('User');
      }

      return ApiError.success({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
      });
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
