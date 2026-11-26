import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isAdmin, requireTenantId } from '@/utils/auth';

// GET — list all members of the active tenant
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();
    const tenantId = requireTenantId(user);

    const members = await RepositoryFactory.getMembershipRepository().findByTenant(tenantId);
    const userRepo = RepositoryFactory.getUserRepository();

    const enriched = await Promise.all(
      members.map(async (m) => {
        const u = await userRepo.findById(m.userId.toString());
        return { ...m, name: u?.name, email: u?.email };
      })
    );

    return ApiError.success(enriched);
  } catch (error) {
    return ApiError.handle(error);
  }
}

// POST — tenant membership is established only after an invitation is accepted.
export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return ApiError.unauthorized();
    if (!isAdmin(user)) return ApiError.forbidden('Only admins can manage members');
    requireTenantId(user);
    return NextResponse.json(
      { error: 'Members must accept an invitation before joining an organisation.' },
      { status: 405, headers: { Allow: 'GET' } },
    );
  } catch (error) {
    return ApiError.handle(error);
  }
}
