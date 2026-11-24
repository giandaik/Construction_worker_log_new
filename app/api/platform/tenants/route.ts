import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { getAuthUser, isSuperAdmin } from '@/utils/auth';
import { DatabaseUtils } from '@/lib/api/database';
import { tenantProvisioningSchema } from '@/lib/schemas/tenantSchema';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { hash } from 'bcryptjs';

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63);
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isSuperAdmin(user)) return ApiError.forbidden();

    return await RepositoryFactory.withTenantRepository(async (tenantRepo) => {
      const tenants = await tenantRepo.findAll({}, { sort: { name: 1 } });
      
      // Add member count to each tenant
      const memberRepo = RepositoryFactory.getMembershipRepository();
      const tenantsWithCounts = await Promise.all(
        tenants.map(async (t) => ({
          ...t,
          memberCount: await memberRepo.countByTenant(t._id?.toString() || ''),
        }))
      );
      
      return ApiError.success(tenantsWithCounts);
    });
  } catch (error) {
    if (error instanceof Error && (
      error.message === 'A tenant with this slug already exists' ||
      error.message === 'A user with this email already exists'
    )) {
      return ApiError.badRequest(error.message);
    }
    return ApiError.handle(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user || !isSuperAdmin(user)) return ApiError.forbidden();

    const body = await request.json();
    const parsed = tenantProvisioningSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(parsed.error.issues.map((i) => i.message).join(', '));
    }

    const slug = parsed.data.slug ?? slugify(parsed.data.name);
    if (slug.length < 2) return ApiError.badRequest('Tenant name must produce a valid slug');

    await DatabaseUtils.connect();
    const db = mongoose.connection;
    const tenants = db.collection('tenants');
    const users = db.collection('users');
    const memberships = db.collection('user_tenant_memberships');
    const session = await mongoose.startSession();
    let tenantId: ObjectId | undefined;
    let adminId: ObjectId | undefined;

    try {
      await session.withTransaction(async () => {
        if (await tenants.findOne({ slug }, { session })) throw new Error('A tenant with this slug already exists');
        if (await users.findOne({ email: parsed.data.initialAdmin.email }, { session })) throw new Error('A user with this email already exists');

        const now = new Date();
        tenantId = new ObjectId();
        adminId = new ObjectId();
        await tenants.insertOne({ _id: tenantId, name: parsed.data.name, slug, status: parsed.data.status, plan: parsed.data.plan, createdAt: now, updatedAt: now }, { session });
        await users.insertOne({ _id: adminId, name: parsed.data.initialAdmin.name, email: parsed.data.initialAdmin.email, password: await hash(parsed.data.initialAdmin.password, 12), role: 'user', platformRole: null, createdAt: now, updatedAt: now }, { session });
        await memberships.insertOne({ _id: new ObjectId(), userId: adminId, tenantId, tenantRole: 'ADMIN', isActive: true, joinedAt: now, createdAt: now, updatedAt: now }, { session });
      });
    } finally {
      await session.endSession();
    }

    return ApiError.success({
      tenantId: tenantId?.toString(),
      tenant: { _id: tenantId?.toString(), name: parsed.data.name, slug, status: parsed.data.status, plan: parsed.data.plan },
      administrator: { userId: adminId?.toString(), name: parsed.data.initialAdmin.name, email: parsed.data.initialAdmin.email, tenantRole: 'ADMIN' },
    }, 201);
  } catch (error) {
    return ApiError.handle(error);
  }
}
