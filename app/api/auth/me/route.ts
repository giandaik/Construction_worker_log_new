import { getAuthUser } from '@/utils/auth';
import { ApiError } from '@/lib/api/errorHandling';

export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return ApiError.unauthorized();
    return ApiError.success(authUser);
  } catch (error) {
    return ApiError.handle(error);
  }
}