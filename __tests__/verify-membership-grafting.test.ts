// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SignJWT } from 'jose';

const JWT_SECRET = 'test-secret-that-is-long-enough-for-the-validator';

let mongoServer: MongoMemoryServer;

const ALPHA = new mongoose.Types.ObjectId().toString();
const BETA = new mongoose.Types.ObjectId().toString();

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

async function seedUser(fields: Record<string, unknown>) {
  const id = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('users').insertOne({
    _id: id,
    name: 'Seeded',
    email: `${id.toString()}@example.test`,
    role: 'user',
    ...fields,
  });
  return id.toString();
}

async function seedMembership(userId: string, tenantId: string, tenantRole = 'ADMIN') {
  await mongoose.connection.collection('user_tenant_memberships').insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    tenantRole,
    isActive: true,
    joinedAt: new Date(),
  });
}

async function adminToken(userId: string, tenantId: string) {
  return new SignJWT({ userId, name: 'Alice Admin', role: 'ADMIN', tenantId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

function jsonRequest(url: string, method: string, token: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let alphaAdmin: string;
let alphaAdminToken: string;

beforeEach(async () => {
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('user_tenant_memberships').deleteMany({});

  alphaAdmin = await seedUser({ name: 'Alice', role: 'admin' });
  await seedMembership(alphaAdmin, ALPHA);
  alphaAdminToken = await adminToken(alphaAdmin, ALPHA);
});

function membershipsOf(userId: string) {
  return mongoose.connection
    .collection('user_tenant_memberships')
    .find({ userId: new mongoose.Types.ObjectId(userId) })
    .toArray();
}

describe('H3 — POST /api/tenant/members refuses to graft outsiders', () => {
  it('refuses a user who is an active member of another tenant', async () => {
    const { POST } = await import('@/app/api/tenant/members/route');
    const betaAdmin = await seedUser({ name: 'Bob', role: 'admin' });
    await seedMembership(betaAdmin, BETA);

    const response = await POST(
      jsonRequest('http://localhost/api/tenant/members', 'POST', alphaAdminToken, {
        userId: betaAdmin,
        tenantRole: 'ADMIN',
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/another organisation/i);
    expect(await membershipsOf(betaAdmin)).toHaveLength(1);
  });

  it('refuses the platform super-admin', async () => {
    const { POST } = await import('@/app/api/tenant/members/route');
    const superAdmin = await seedUser({ name: 'Root', platformRole: 'SUPER_ADMIN' });

    const response = await POST(
      jsonRequest('http://localhost/api/tenant/members', 'POST', alphaAdminToken, {
        userId: superAdmin,
        tenantRole: 'ADMIN',
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Platform administrators/i);
    expect(await membershipsOf(superAdmin)).toHaveLength(0);
  });

  it('still adds a user who belongs to no tenant', async () => {
    const { POST } = await import('@/app/api/tenant/members/route');
    const newcomer = await seedUser({ name: 'Nick' });

    const response = await POST(
      jsonRequest('http://localhost/api/tenant/members', 'POST', alphaAdminToken, {
        userId: newcomer,
        tenantRole: 'WORKER',
      }),
    );

    expect(response.status).toBe(201);
    expect(await membershipsOf(newcomer)).toHaveLength(1);
  });

  it('reports an unknown user as not found', async () => {
    const { POST } = await import('@/app/api/tenant/members/route');

    const response = await POST(
      jsonRequest('http://localhost/api/tenant/members', 'POST', alphaAdminToken, {
        userId: new mongoose.Types.ObjectId().toString(),
        tenantRole: 'WORKER',
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe('H3 — PUT /api/tenant/members/[userId] is not a second way in', () => {
  it('refuses to create a membership for another tenant’s admin', async () => {
    const { PUT } = await import('@/app/api/tenant/members/[userId]/route');
    const betaAdmin = await seedUser({ name: 'Bob', role: 'admin' });
    await seedMembership(betaAdmin, BETA);

    const response = await PUT(
      jsonRequest(
        `http://localhost/api/tenant/members/${betaAdmin}`,
        'PUT',
        alphaAdminToken,
        { tenantRole: 'ADMIN' },
      ),
      { params: Promise.resolve({ userId: betaAdmin }) },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/another organisation/i);

    const memberships = await membershipsOf(betaAdmin);
    expect(memberships).toHaveLength(1);
    expect(memberships[0].tenantId.toString()).toBe(BETA);
  });

  it('still updates the role of a member of this tenant', async () => {
    const { PUT } = await import('@/app/api/tenant/members/[userId]/route');
    const worker = await seedUser({ name: 'Nick' });
    await seedMembership(worker, ALPHA, 'WORKER');

    const response = await PUT(
      jsonRequest(
        `http://localhost/api/tenant/members/${worker}`,
        'PUT',
        alphaAdminToken,
        { tenantRole: 'MANAGER' },
      ),
      { params: Promise.resolve({ userId: worker }) },
    );

    expect(response.status).toBe(200);
    const memberships = await membershipsOf(worker);
    expect(memberships).toHaveLength(1);
    expect(memberships[0].tenantRole).toBe('MANAGER');
  });
});
