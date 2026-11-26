// @vitest-environment node
//
// Node, not the project-default jsdom: the routes sign JWTs with jose, which
// rejects the cross-realm Uint8Array that jsdom's TextEncoder produces.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hash } from 'bcryptjs';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE_NAME } from '@/lib/constants/constants';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
const { TENANT_ID } = vi.hoisted(() => ({ TENANT_ID: '507f1f77bcf86cd799439011' }));
const PASSWORD = 'correct-horse-battery-staple';
const EMAIL = 'mobile-login@example.com';

let mongoServer: MongoMemoryServer;

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
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('tenants').deleteMany({});
  await mongoose.connection.collection('user_tenant_memberships').deleteMany({});
});

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/login', () => {
  beforeEach(async () => {
    const { insertedId } = await mongoose.connection.collection('users').insertOne({
      name: 'Ada',
      email: EMAIL,
      password: await hash(PASSWORD, 12),
      role: 'admin',
    });

    // Login now resolves the tenant from membership: a user with no active
    // membership — or whose organisation is not active — is refused (403) and
    // never receives a token. The issued JWT carries the membership's
    // tenantRole/tenantId, not the account's legacy `role` field.
    await mongoose.connection.collection('tenants').insertOne({
      _id: new mongoose.Types.ObjectId(TENANT_ID),
      name: 'Mobile Test Co',
      slug: 'mobile-test-co',
      status: 'active',
      createdAt: new Date(),
    });

    await mongoose.connection.collection('user_tenant_memberships').insertOne({
      userId: insertedId,
      tenantId: new mongoose.Types.ObjectId(TENANT_ID),
      tenantRole: 'admin',
      isActive: true,
      joinedAt: new Date(),
    });
  });

  it('returns a verifiable JWT in the body for the mobile client to store', async () => {
    const { POST } = await import('@/app/api/login/route');

    const res = await POST(
      jsonRequest('http://localhost/api/login', { email: EMAIL, password: PASSWORD }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.token).toBe('string');

    const { payload } = await jwtVerify(
      body.token,
      new TextEncoder().encode(JWT_SECRET),
    );
    expect(payload.role).toBe('admin');
    expect(payload.name).toBe('Ada');
    expect(payload.userId).toEqual(expect.any(String));
  });

  it('still sets the session cookie, so web auth is unchanged', async () => {
    const { POST } = await import('@/app/api/login/route');

    const res = await POST(
      jsonRequest('http://localhost/api/login', { email: EMAIL, password: PASSWORD }),
    );

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
  });

  it('returns the same token that it puts in the cookie', async () => {
    const { POST } = await import('@/app/api/login/route');

    const res = await POST(
      jsonRequest('http://localhost/api/login', { email: EMAIL, password: PASSWORD }),
    );
    const { token } = await res.json();

    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=${token}`);
  });

  it('leaks no token when the credentials are wrong', async () => {
    const { POST } = await import('@/app/api/login/route');

    const res = await POST(
      jsonRequest('http://localhost/api/login', { email: EMAIL, password: 'wrong' }),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.token).toBeUndefined();
  });
});

describe('POST /api/signup', () => {
  it('refuses account creation without an invitation', async () => {
    const { POST } = await import('@/app/api/signup/route');

    const res = await POST(
      jsonRequest('http://localhost/api/signup', {
        name: 'Grace',
        email: 'mobile-signup@example.com',
        password: PASSWORD,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.token).toBeUndefined();
    expect(await mongoose.connection.collection('users').countDocuments({
      email: 'mobile-signup@example.com',
    })).toBe(0);
  });
});
