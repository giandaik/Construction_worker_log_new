import { ObjectId } from 'mongodb';
import { BaseRepository } from './base/BaseRepository';
import { PLATFORM_CONTEXT } from './base/RepositoryContext';
import type { TenantRole } from '@/lib/models/UserTenantMembership';
import { normalizeTenantId } from '@/lib/tenant/normalizeTenantId';

function normalizeTenantRole(role: string): TenantRole {
  const normalized = role.toUpperCase();
  if (normalized !== 'ADMIN' && normalized !== 'MANAGER' && normalized !== 'WORKER') {
    throw new Error('Invalid tenant role');
  }
  return normalized as TenantRole;
}

export interface UserTenantMembership {
  _id?: string | ObjectId;
  userId: string | ObjectId;
  tenantId: string | ObjectId;
  tenantRole: TenantRole;
  isActive: boolean;
  joinedAt?: Date;
}

export class UserTenantMembershipRepository extends BaseRepository<UserTenantMembership> {
  // Memberships link users to tenants; the repository itself is platform-level
  constructor(collection: object) {
    super(collection, PLATFORM_CONTEXT);
  }

  async findByUser(userId: string | ObjectId): Promise<UserTenantMembership[]> {
    return this.findAll({ userId: normalizeTenantId(userId.toString()), isActive: true }, {
      sort: { joinedAt: 1 },
    });
  }

  async findByTenant(tenantId: string | ObjectId): Promise<UserTenantMembership[]> {
    return this.findAll({ tenantId: normalizeTenantId(tenantId) }, { sort: { joinedAt: 1 } });
  }

  async findMembership(
    userId: string | ObjectId,
    tenantId: string | ObjectId
  ): Promise<UserTenantMembership | null> {
    return this.findOne({
      userId: normalizeTenantId(userId.toString()),
      tenantId: normalizeTenantId(tenantId),
    });
  }

  async upsertMembership(
    userId: string | ObjectId,
    tenantId: string | ObjectId,
    tenantRole: TenantRole | Lowercase<TenantRole>
  ): Promise<void> {
    const normalizedRole = normalizeTenantRole(tenantRole);
    await this.scopedUpdateOne(
      { userId: normalizeTenantId(userId.toString()), tenantId: normalizeTenantId(tenantId) },
      {
        $set: { tenantRole: normalizedRole, isActive: true, updatedAt: new Date() },
        $setOnInsert: {
          joinedAt: new Date(),
          createdAt: new Date(),
          tenantId: normalizeTenantId(tenantId),
          userId: normalizeTenantId(userId.toString()),
        },
      },
      { upsert: true }
    );
  }

  async removeMembership(userId: string | ObjectId, tenantId: string | ObjectId): Promise<boolean> {
    const result = await this.scopedDeleteOneRaw({
      userId: normalizeTenantId(userId.toString()),
      tenantId: normalizeTenantId(tenantId),
    });
    return result.deletedCount > 0;
  }

  async countByTenant(tenantId: string | ObjectId): Promise<number> {
    return this.count({ tenantId: normalizeTenantId(tenantId), isActive: true });
  }
}
