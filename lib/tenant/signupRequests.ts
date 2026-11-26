import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { Document } from 'mongodb';

import { DatabaseUtils } from '@/lib/api/database';
import type { TenantRole } from '@/lib/models/UserTenantMembership';

const CLAIM_LEASE_MS = 5 * 60 * 1000;
const DECIDED_REQUEST_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

export interface SignupRequest extends Document {
  _id?: ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  notificationSentAt?: Date;
  claimId?: string;
  claimExpiresAt?: Date;
  decidedAt?: Date;
  decidedBy?: ObjectId;
  decision?: 'approved' | 'rejected';
  tenantId?: ObjectId;
  tenantRole?: TenantRole;
  rejectionReason?: string;
  purgeAt?: Date;
}

let indexesReady: Promise<void> | null = null;

async function getSignupRequestCollection() {
  await DatabaseUtils.connect();
  const collection = DatabaseUtils.getCollection('signup_requests');

  if (!indexesReady) {
    indexesReady = Promise.all([
      collection.createIndex(
        { email: 1 },
        { unique: true, partialFilterExpression: { status: 'pending' } },
      ),
      collection.createIndex({ status: 1, createdAt: -1 }),
      collection.createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
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

export async function createOrGetPendingSignupRequest(
  input: Pick<SignupRequest, 'firstName' | 'lastName' | 'email' | 'organizationName' | 'message'>,
): Promise<SignupRequest> {
  const collection = await getSignupRequestCollection();
  const existing = await collection.findOne({ email: input.email, status: 'pending' });
  if (existing) return existing as SignupRequest;

  const now = new Date();
  const request: SignupRequest = {
    ...input,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await collection.insertOne({ ...request });
    return request;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      const racedRequest = await collection.findOne({ email: input.email, status: 'pending' });
      if (racedRequest) return racedRequest as SignupRequest;
    }
    throw error;
  }
}

export async function markSignupRequestNotificationSent(id: ObjectId): Promise<void> {
  const collection = await getSignupRequestCollection();
  await collection.updateOne(
    { _id: id, status: 'pending' },
    { $set: { notificationSentAt: new Date(), updatedAt: new Date() } },
  );
}

export async function listPendingSignupRequests(): Promise<SignupRequest[]> {
  const collection = await getSignupRequestCollection();
  const requests = await collection.find({ status: 'pending' }).sort({ createdAt: -1 }).toArray();
  return requests.map((request) => request as SignupRequest);
}

export async function countPendingSignupRequests(): Promise<number> {
  const collection = await getSignupRequestCollection();
  return collection.countDocuments({ status: 'pending' });
}

export async function findPendingSignupRequestById(id: ObjectId): Promise<SignupRequest | null> {
  const collection = await getSignupRequestCollection();
  const request = await collection.findOne({ _id: id, status: 'pending' });
  return request as SignupRequest | null;
}

export async function claimPendingSignupRequest(
  id: ObjectId,
): Promise<{ request: SignupRequest; claimId: string } | null> {
  const collection = await getSignupRequestCollection();
  const claimId = randomBytes(16).toString('hex');
  const now = new Date();
  const updated = await collection.updateOne(
    {
      _id: id,
      status: 'pending',
      $or: [
        { claimId: { $exists: false } },
        { claimExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        claimId,
        claimExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS),
        updatedAt: now,
      },
    },
  );

  if (updated.modifiedCount !== 1) return null;

  const request = await collection.findOne({ _id: id, claimId });
  return request ? { request: request as SignupRequest, claimId } : null;
}

export async function releaseSignupRequestClaim(id: ObjectId, claimId: string): Promise<void> {
  const collection = await getSignupRequestCollection();
  await collection.updateOne(
    { _id: id, status: 'pending', claimId },
    { $unset: { claimId: '', claimExpiresAt: '' }, $set: { updatedAt: new Date() } },
  );
}

export async function decideSignupRequest(
  id: ObjectId,
  claimId: string,
  decision: 'approved' | 'rejected',
  decidedBy: ObjectId,
  details: {
    tenantId?: ObjectId;
    tenantRole?: TenantRole;
    rejectionReason?: string;
  } = {},
): Promise<boolean> {
  const collection = await getSignupRequestCollection();
  const decidedAt = new Date();
  const decisionDetails = {
    ...(details.tenantId ? { tenantId: details.tenantId } : {}),
    ...(details.tenantRole ? { tenantRole: details.tenantRole } : {}),
    ...(details.rejectionReason !== undefined ? { rejectionReason: details.rejectionReason } : {}),
  };
  const result = await collection.updateOne(
    { _id: id, status: 'pending', claimId },
    {
      $set: {
        ...decisionDetails,
        status: decision,
        decision,
        decidedBy,
        decidedAt,
        updatedAt: decidedAt,
        purgeAt: new Date(decidedAt.getTime() + DECIDED_REQUEST_RETENTION_MS),
      },
      $unset: { claimId: '', claimExpiresAt: '' },
    },
  );
  return result.modifiedCount === 1;
}
