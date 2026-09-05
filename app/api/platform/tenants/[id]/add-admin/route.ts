import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isSuperAdmin } from '@/utils/auth';
import { z } from 'zod';
import { hash } from 'bcryptjs';

// Schema for adding an admin user to a tenant
const addAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST — create an ADMIN user for a specific tenant (SUPER_ADMIN only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isSuperAdmin(user)) {
      return ApiError.forbidden('Only super admins can add admin users to tenants');
    }

    const { id: tenantId } = await params;

    const body = await request.json();
    const parsed = addAdminSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((i) => i.message).join(', '));
    }

    // Verify tenant exists
    const tenantRepo = RepositoryFactory.getTenantRepository();
    const tenant = await tenantRepo.findById(tenantId);
    if (!tenant) {
      return ApiError.notFound('Tenant');
    }

    // Check if user with this email already exists
    const userRepo = RepositoryFactory.getUserRepository();
    const existingUser = await userRepo.findByEmail(parsed.data.email);
    if (existingUser) {
      return ApiError.badRequest('A user with this email already exists');
    }

    // Create the admin user
    const hashedPassword = await hash(parsed.data.password, 12);
    const newUser = await userRepo.create({
      email: parsed.data.email,
      name: parsed.data.name,
      password: hashedPassword,
      role: 'admin', // Platform role is not "SUPER_ADMIN" for tenant admins
    } as any);

    // Create the tenant membership with ADMIN role
    await RepositoryFactory.getMembershipRepository().upsertMembership(
      newUser._id!.toString(),
      tenantId,
      'ADMIN'
    );

    return ApiError.success(
      {
        message: 'Admin user created successfully',
        userId: newUser._id,
        email: newUser.email,
        name: newUser.name,
      },
      201
    );
  } catch (error) {
    return ApiError.handle(error);
  }
}
