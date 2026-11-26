import { ApiError } from '@/lib/api/errorHandling';
import { listPendingSignupRequests } from '@/lib/tenant/signupRequests';
import { getAuthUser, isSuperAdmin } from '@/utils/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isSuperAdmin(user)) return ApiError.forbidden();

    const requests = await listPendingSignupRequests();
    return ApiError.success(requests.map((signupRequest) => ({
      id: signupRequest._id?.toString(),
      firstName: signupRequest.firstName,
      lastName: signupRequest.lastName,
      email: signupRequest.email,
      organizationName: signupRequest.organizationName,
      message: signupRequest.message,
      createdAt: signupRequest.createdAt,
      isProcessing: Boolean(
        signupRequest.claimId &&
        signupRequest.claimExpiresAt &&
        signupRequest.claimExpiresAt.getTime() > Date.now(),
      ),
    })));
  } catch (error) {
    return ApiError.handle(error);
  }
}
