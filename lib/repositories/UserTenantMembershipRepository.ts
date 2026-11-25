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

  /**
   * Creates the membership, or updates one that already exists.
   *
   * `isActive` is only written when the caller names it: re-adding an existing
   * member should not silently re-activate an account an admin deactivated.
   * New rows always start active.
   */
  async upsertMembership(
    userId: string | ObjectId,
    tenantId: string | ObjectId,
    tenantRole: TenantRole | Lowercase<TenantRole>,
    isActive?: boolean
  ): Promise<void> {
    const normalizedRole = normalizeTenantRole(tenantRole);
    await this.scopedUpdateOne(
      { userId: normalizeTenantId(userId.toString()), tenantId: normalizeTenantId(tenantId) },
      {
        $set: {
          tenantRole: normalizedRole,
          updatedAt: new Date(),
          ...(isActive === undefined ? {} : { isActive }),
        },
        // `isActive` appears in exactly one of the two operators: an upsert
        // that names it in both fails with a path-conflict error.
        $setOnInsert: {
          joinedAt: new Date(),
          createdAt: new Date(),
          tenantId: normalizeTenantId(tenantId),
          userId: normalizeTenantId(userId.toString()),
          ...(isActive === undefined ? { isActive: true } : {}),
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
