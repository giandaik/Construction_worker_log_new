// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { canAssignRole, roleRank } from '@/lib/tenant/roleHierarchy';

const JWT_SECRET = 'test-secret-that-is-long-enough-for-the-validator';

let mongoServer: MongoMemoryServer;

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

describe('POST /api/users', () => {
  it('disables direct account creation in favour of invitation acceptance', async () => {
    const { POST } = await import('@/app/api/users/route');
    const response = await POST();

    expect(response.status).toBe(405);
    expect((await response.json()).error).toMatch(/invitation flow/i);
  });
});
