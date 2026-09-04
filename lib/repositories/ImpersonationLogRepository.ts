import { ObjectId } from 'mongodb';
import { BaseRepository } from './base/BaseRepository';
import { PLATFORM_CONTEXT } from './base/RepositoryContext';

export interface ImpersonationLog {
  _id?: string | ObjectId;
  superAdminId: string | ObjectId;
  targetTenantId: string | ObjectId;
  targetUserId: string | ObjectId;
  reason?: string;
  startedAt?: Date;
  endedAt?: Date;
}

export class ImpersonationLogRepository extends BaseRepository<ImpersonationLog> {
  // Impersonation is a SUPER_ADMIN/platform-level audit trail — platform scope
  constructor(collection: any) {
    super(collection, PLATFORM_CONTEXT);
  }

  async startSession(
    superAdminId: string,
    targetTenantId: string,
    targetUserId: string,
    reason?: string
  ): Promise<ImpersonationLog> {
    return this.create({
      superAdminId,
      targetTenantId,
      targetUserId,
      reason,
      startedAt: new Date(),
    } as any);
  }

  async endSession(logId: string): Promise<ImpersonationLog | null> {
    return this.update(logId, { endedAt: new Date() } as any);
  }

  async findRecent(limit = 50): Promise<ImpersonationLog[]> {
    return this.findAll({} as any, { sort: { startedAt: -1 }, limit });
  }
}
