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

  /**
   * Closes a session only if it is still open.
   *
   * The `endedAt: null` clause is part of the filter rather than a read
   * followed by a write, so two concurrent DELETEs cannot both succeed —
   * the second one matches nothing and gets `null`, which the route turns
   * into a 409. That is what makes a replayed end-impersonation request
   * detectable instead of idempotently re-minting a super-admin token.
   */
  async endActiveSession(logId: string): Promise<ImpersonationLog | null> {
    if (!ObjectId.isValid(logId)) return null;

    const result = await this.scopedFindOneAndUpdate(
      { _id: new ObjectId(logId), endedAt: null },
      { $set: { endedAt: new Date(), updatedAt: new Date() } }
    );

    return result ? this.mapToEntity(result) : null;
  }

  /**
   * True when the log entry exists and has not been closed.
   *
   * Fail-closed: a malformed id, a missing entry or a closed one all
   * answer `false`, so a token naming any of them stops authenticating.
   */
  async isSessionActive(logId: string): Promise<boolean> {
    if (!ObjectId.isValid(logId)) return false;

    const entry = await this.scopedFindOneRaw({
      _id: new ObjectId(logId),
      endedAt: null,
    });

    return Boolean(entry);
  }

  async findRecent(limit = 50): Promise<ImpersonationLog[]> {
    return this.findAll({} as any, { sort: { startedAt: -1 }, limit });
  }
}
