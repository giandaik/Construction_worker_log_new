// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SignJWT } from 'jose';
import { canAssignRole, roleRank } from '@/lib/tenant/roleHierarchy';

const JWT_SECRET = 'test-secret-that-is-long-enough-for-the-validator';

let mongoServer: MongoMemoryServer;

const TENANT = new mongoose.Types.ObjectId().toString();

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

beforeEach(async () => {
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('user_tenant_memberships').deleteMany({});
});

/** Seeds a tenant member and returns a token carrying their membership role. */
async function seedMember(tenantRole: 'ADMIN' | 'MANAGER' | 'WORKER', tokenRole = tenantRole) {
  const id = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('users').insertOne({
    _id: id,
    name: 'Creator',
    email: `${id.toString()}@example.test`,
    role: tenantRole.toLowerCase(),
  });
  await mongoose.connection.collection('user_tenant_memberships').insertOne({
    userId: id,
    tenantId: new mongoose.Types.ObjectId(TENANT),
    tenantRole,
    isActive: true,
    joinedAt: new Date(),
  });

  const token = await new SignJWT({
    userId: id.toString(),
    name: 'Creator',
    role: tokenRole,
    tenantId: TENANT,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(JWT_SECRET));

  return { userId: id.toString(), token };
}

function createUserRequest(token: string, role: string) {
  return new Request('http://localhost/api/users', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'New Person',
      email: `new-${Math.random().toString(36).slice(2)}@example.test`,
      password: 'passwordA1!',
      role,
    }),
  });
}

describe('M2 — role ranks', () => {
  it('treats `user` and `WORKER` as the same rung and is case-insensitive', () => {
    expect(roleRank('user')).toBe(roleRank('WORKER'));
    expect(roleRank('Admin')).toBe(roleRank('ADMIN'));
  });

  it('ranks an unknown or missing role below everything', () => {
    expect(roleRank('wizard')).toBe(0);
    expect(roleRank(undefined)).toBe(0);
    expect(canAssignRole(undefined, 'user')).toBe(false);
    expect(canAssignRole('wizard', 'user')).toBe(false);
  });

  it('lets a role assign its own rank and below, never above', () => {
    expect(canAssignRole('MANAGER', 'manager')).toBe(true);
    expect(canAssignRole('MANAGER', 'user')).toBe(true);
    expect(canAssignRole('MANAGER', 'admin')).toBe(false);
    expect(canAssignRole('ADMIN', 'admin')).toBe(true);
  });
});

describe('M2 — POST /api/users bounds the assignable role by the creator’s', () => {
  it('refuses a manager creating an admin', async () => {
    const { POST } = await import('@/app/api/users/route');
    const { token } = await seedMember('MANAGER');

    const response = await POST(createUserRequest(token, 'admin'));

    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(/cannot create a user with the admin role/i);
    expect(await mongoose.connection.collection('users').countDocuments({ role: 'admin' })).toBe(0);
  });

  it('lets a manager create a manager and a worker', async () => {
    const { POST } = await import('@/app/api/users/route');
    const { token } = await seedMember('MANAGER');

    expect((await POST(createUserRequest(token, 'manager'))).status).toBe(201);
    expect((await POST(createUserRequest(token, 'user'))).status).toBe(201);
  });

  it('lets an admin create an admin', async () => {
    const { POST } = await import('@/app/api/users/route');
    const { token } = await seedMember('ADMIN');

    expect((await POST(createUserRequest(token, 'admin'))).status).toBe(201);
  });

  it('believes the membership, not a token claiming a role the creator lost', async () => {
    const { POST } = await import('@/app/api/users/route');
    const { token } = await seedMember('MANAGER', 'ADMIN');

    const response = await POST(createUserRequest(token, 'admin'));

    expect(response.status).toBe(403);
  });
});
