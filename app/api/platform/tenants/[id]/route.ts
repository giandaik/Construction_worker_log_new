import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isSuperAdmin } from '@/utils/auth';
import { tenantUpdateSchema } from '@/lib/schemas/tenantSchema';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || !isSuperAdmin(user)) return ApiError.forbidden();

    const { id } = await params;
    return await RepositoryFactory.withTenantRepository(async (repo) => {
      const tenant = await repo.findById(id);
      if (!tenant) return ApiError.notFound('Tenant');
      return ApiError.success(tenant);
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
    if (!user || !isSuperAdmin(user)) return ApiError.forbidden();

    const { id } = await params;
    const body = await request.json();
    const parsed = tenantUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((i) => i.message).join(', '));
    }

    return await RepositoryFactory.withTenantRepository(async (repo) => {
      if (parsed.data.slug && (await repo.isSlugTaken(parsed.data.slug, id))) {
        return ApiError.badRequest('A tenant with this slug already exists');
      }
      const updated = await repo.update(id, parsed.data as any);
      if (!updated) return ApiError.notFound('Tenant');
      return ApiError.success(updated);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || !isSuperAdmin(user)) return ApiError.forbidden();

    const { id } = await params;
    return await RepositoryFactory.withTenantRepository(async (repo) => {
      // Soft-delete: mark as disabled rather than dropping data
      const updated = await repo.update(id, { status: 'disabled' } as any);
      if (!updated) return ApiError.notFound('Tenant');
      return ApiError.success({ message: 'Tenant disabled' });
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
