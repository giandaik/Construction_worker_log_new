import { createHash, randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { Document } from 'mongodb';

import { DatabaseUtils } from '@/lib/api/database';
import type { TenantRole } from '@/lib/models/UserTenantMembership';
import { RepositoryFactory } from '@/lib/repositories';
import type { UserRole } from '@/lib/repositories/UserRepository';
import type { UserTenantMembership } from '@/lib/repositories/UserTenantMembershipRepository';
import { checkMembershipEligibility } from '@/lib/tenant/membershipGuards';

const CLAIM_LEASE_MS = 5 * 60 * 1000;
const USER_ROLE_BY_TENANT_ROLE: Record<TenantRole, UserRole> = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  WORKER: 'user',
};

export interface TenantInvitation extends Document {
  _id?: ObjectId;
  tokenHash: string;
  email: string;
  tenantId: ObjectId;
  tenantRole: TenantRole;
  invitedBy: ObjectId;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'claimed' | 'accepted' | 'revoked';
  claimId?: string;
  claimedAt?: Date;
  acceptedAt?: Date;
  acceptedBy?: ObjectId;
}

export class TenantInvitationError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = 'TenantInvitationError';
  }
}

let indexesReady: Promise<void> | null = null;

async function getInvitationCollection() {
  await DatabaseUtils.connect();
  const collection = DatabaseUtils.getCollection('tenant_invitations');

  if (!indexesReady) {
    indexesReady = Promise.all([
      collection.createIndex({ tokenHash: 1 }, { unique: true }),
      collection.createIndex(
        { tenantId: 1, email: 1 },
        { unique: true, partialFilterExpression: { status: 'pending' } },
      ),
      collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        indexesReady = null;
        throw error;
      });
  }

  await indexesReady;
  return collection;
}

export function createInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function buildTenantInvitationUrl(request: Request, token: string): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configuredUrl && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_URL must be configured to send invitations');
  }

  const appUrl = new URL(configuredUrl || new URL(request.url).origin);
  if (appUrl.protocol !== 'https:' && appUrl.protocol !== 'http:') {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTP or HTTPS');
  }

  appUrl.pathname = '/signup';
  appUrl.search = '';
  appUrl.hash = '';
  appUrl.searchParams.set('invite', token);
  return appUrl.toString();
}

export function getLegacyUserRole(tenantRole: TenantRole): UserRole {
  return USER_ROLE_BY_TENANT_ROLE[tenantRole];
}

export async function saveTenantInvitation(
  invitation: Omit<TenantInvitation, '_id'>,
): Promise<void> {
  const collection = await getInvitationCollection();
  const result = await collection.updateOne(
    {
      tenantId: invitation.tenantId,
      email: invitation.email,
      status: 'pending',
    },
    { $set: invitation },
    { upsert: true },
  );

  if (result.matchedCount > 1 || result.modifiedCount > 1) {
    throw new Error('Unexpected invitation update result');
  }
}

export async function removeTenantInvitation(token: string): Promise<void> {
  const collection = await getInvitationCollection();
  await collection.deleteOne({ tokenHash: hashInvitationToken(token), status: 'pending' });
}

export async function findPendingInvitation(
  token: string,
  email: string,
): Promise<TenantInvitation | null> {
  const collection = await getInvitationCollection();
  const invitation = await collection.findOne({
    tokenHash: hashInvitationToken(token),
    email: email.trim().toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
  return invitation as TenantInvitation | null;
}

export async function hasPendingTenantInvitation(email: string, tenantId: string): Promise<boolean> {
  const collection = await getInvitationCollection();
  return Boolean(await collection.findOne({
    tenantId: new ObjectId(tenantId),
    email: email.trim().toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }));
}

async function claimInvitation(
  token: string,
  email: string,
): Promise<{ invitation: TenantInvitation; claimId: string } | null> {
  const collection = await getInvitationCollection();
  const claimId = randomBytes(16).toString('hex');
  const now = new Date();
  const claimableBefore = new Date(now.getTime() - CLAIM_LEASE_MS);
  const updated = await collection.updateOne(
    {
      tokenHash: hashInvitationToken(token),
      email: email.trim().toLowerCase(),
      expiresAt: { $gt: now },
      $or: [
        { status: 'pending' },
        { status: 'claimed', claimedAt: { $lt: claimableBefore } },
      ],
    },
    { $set: { status: 'claimed', claimId, claimedAt: now } },
  );

  if (updated.modifiedCount !== 1) return null;

  const invitation = await collection.findOne({ tokenHash: hashInvitationToken(token), claimId });
  return invitation ? { invitation: invitation as TenantInvitation, claimId } : null;
}

async function releaseInvitationClaim(tokenHash: string, claimId: string): Promise<void> {
  const collection = await getInvitationCollection();
  await collection.updateOne(
    { tokenHash, claimId, status: 'claimed' },
    { $set: { status: 'pending' }, $unset: { claimId: '', claimedAt: '' } },
  );
}

export async function acceptTenantInvitation(
  token: string,
  email: string,
  userId: string,
): Promise<{ tenantId: string; tenantRole: TenantRole }> {
  const claimed = await claimInvitation(token, email);
  if (!claimed) {
    throw new TenantInvitationError('This invitation is invalid, expired, or already used.');
  }

  const { invitation, claimId } = claimed;
  let previousMembership: UserTenantMembership | null = null;
  let membershipUpdated = false;

  try {
    const tenantId = invitation.tenantId.toString();
    const tenant = await RepositoryFactory.getTenantRepository().findById(tenantId);
    if (!tenant || tenant.status !== 'active') {
      throw new TenantInvitationError('This organisation is not currently active.', 403);
    }

    const user = await RepositoryFactory.getUserRepository().findById(userId);
    if (!user || user.email.toLowerCase() !== invitation.email) {
      throw new TenantInvitationError('The invitation does not match this account.', 403);
    }

    const refusal = await checkMembershipEligibility(userId, tenantId);
    if (refusal) {
      throw new TenantInvitationError(refusal, refusal === 'User not found' ? 404 : 409);
    }

    const membershipRepository = RepositoryFactory.getMembershipRepository();
    previousMembership = await membershipRepository.findMembership(userId, tenantId);
    if (previousMembership?.isActive) {
      throw new TenantInvitationError('This account already belongs to the organisation.', 409);
    }

    await membershipRepository.upsertMembership(
      userId,
      tenantId,
      invitation.tenantRole,
      true,
    );
    membershipUpdated = true;

    const collection = await getInvitationCollection();
    const finalized = await collection.updateOne(
      { _id: invitation._id, status: 'claimed', claimId },
      {
        $set: { status: 'accepted', acceptedAt: new Date(), acceptedBy: new ObjectId(userId) },
        $unset: { claimId: '', claimedAt: '' },
      },
    );
    if (finalized.modifiedCount !== 1) {
      throw new Error('Invitation could not be marked as accepted');
    }

    return { tenantId, tenantRole: invitation.tenantRole };
  } catch (error) {
    if (membershipUpdated) {
      try {
        const membershipRepository = RepositoryFactory.getMembershipRepository();
        if (previousMembership) {
          await membershipRepository.upsertMembership(
            userId,
            invitation.tenantId,
            previousMembership.tenantRole,
            previousMembership.isActive,
          );
        } else {
          await membershipRepository.removeMembership(userId, invitation.tenantId);
        }
      } catch (rollbackError) {
        console.error('Failed to roll back invitation membership:', rollbackError);
      }
    }

    try {
      await releaseInvitationClaim(invitation.tokenHash, claimId);
    } catch (releaseError) {
      console.error('Failed to release invitation claim:', releaseError);
    }
    throw error;
  }
}
