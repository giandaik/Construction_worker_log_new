// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SignJWT } from 'jose';
import { impersonationRequestSchema } from '@/lib/schemas/tenantSchema';

const JWT_SECRET = 'test-secret-that-is-long-enough-for-the-validator';

let mongoServer: MongoMemoryServer;

const TENANT = new mongoose.Types.ObjectId();

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

beforeAll(async () => {
  process.env.NEXT_JWT_SECRET = JWT_SECRET;
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

let superAdminToken: string;
let targetUserId: string;

beforeEach(async () => {
  for (const name of ['users', 'tenants', 'user_tenant_memberships', 'impersonation_logs']) {
    await mongoose.connection.collection(name).deleteMany({});
  }

  await mongoose.connection.collection('tenants').insertOne({
    _id: TENANT,
    name: 'Alpha',
    slug: 'alpha',
    status: 'active',
  });

  const superAdminId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('users').insertOne({
    _id: superAdminId,
    name: 'Root',
    email: 'root@example.test',
    role: 'admin',
    platformRole: 'SUPER_ADMIN',
  });

  const target = new mongoose.Types.ObjectId();
  targetUserId = target.toString();
  await mongoose.connection.collection('users').insertOne({
    _id: target,
    name: 'Alice',
    email: 'alice@example.test',
    role: 'admin',
  });
  await mongoose.connection.collection('user_tenant_memberships').insertOne({
    userId: target,
    tenantId: TENANT,
    tenantRole: 'ADMIN',
    isActive: true,
    joinedAt: new Date(),
  });

  superAdminToken = await new SignJWT({
    userId: superAdminId.toString(),
    name: 'Root',
    role: 'admin',
    platformRole: 'SUPER_ADMIN',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(JWT_SECRET));
});

async function impersonate(body: unknown) {
  const { POST } = await import('@/app/api/platform/tenants/[id]/impersonate/route');
  return POST(
    new Request(`http://localhost/api/platform/tenants/${TENANT}/impersonate`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${superAdminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: TENANT.toString() }) },
  );
}

describe('M3 — the impersonation reason is validated', () => {
  it('accepts an absent reason', () => {
    expect(impersonationRequestSchema.safeParse({ userId: 'abc' }).success).toBe(true);
  });

  it('rejects a non-string, an empty string and one over 500 characters', () => {
    expect(impersonationRequestSchema.safeParse({ userId: 'abc', reason: { $ne: null } }).success).toBe(false);
    expect(impersonationRequestSchema.safeParse({ userId: 'abc', reason: '   ' }).success).toBe(false);
    expect(impersonationRequestSchema.safeParse({ userId: 'abc', reason: 'x'.repeat(501) }).success).toBe(false);
    expect(impersonationRequestSchema.safeParse({ userId: 'abc', reason: 'x'.repeat(500) }).success).toBe(true);
  });

  it('trims the stored reason', () => {
    const parsed = impersonationRequestSchema.parse({ userId: 'abc', reason: '  support ticket 12  ' });
    expect(parsed.reason).toBe('support ticket 12');
  });

  it('rejects a non-string userId before it reaches Mongo', () => {
    expect(impersonationRequestSchema.safeParse({ userId: { $ne: null } }).success).toBe(false);
  });
});

describe('M3 — POST impersonate refuses a malformed body', () => {
  it('answers 400 to an object reason and writes no log entry', async () => {
    const response = await impersonate({ userId: targetUserId, reason: { $ne: null } });

    expect(response.status).toBe(400);
    expect(await mongoose.connection.collection('impersonation_logs').countDocuments({})).toBe(0);
  });

  it('answers 400 to an object userId', async () => {
    const response = await impersonate({ userId: { $ne: null } });

    expect(response.status).toBe(400);
    expect(await mongoose.connection.collection('impersonation_logs').countDocuments({})).toBe(0);
  });

  it('still starts a session for a well-formed body', async () => {
    const response = await impersonate({ userId: targetUserId, reason: 'support ticket 12' });

    expect(response.status).toBe(200);
    const [entry] = await mongoose.connection.collection('impersonation_logs').find({}).toArray();
    expect(entry.reason).toBe('support ticket 12');
  });
});
