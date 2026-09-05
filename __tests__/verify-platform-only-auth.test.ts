// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { POST as login } from '@/app/api/login/route';
import { GET as listTenants } from '@/app/api/platform/tenants/route';
import { DELETE as endImpersonation } from '@/app/api/platform/impersonation/route';
import { middleware } from '@/middleware';
import { SESSION_COOKIE_NAME } from '@/lib/constants/constants';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
const PASSWORD = 'correct-horse-battery-staple';
let mongoServer: MongoMemoryServer;

async function signToken(claims: Record<string, unknown>) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

async function platformToken(
  platformRole = 'super_admin',
  userId = new mongoose.Types.ObjectId().toString(),
) {
  return signToken({
    userId,
    name: 'Platform Admin',
    role: 'user',
    platformRole,
  });
}

/** A plain tenant user: no platformRole, no impersonation claims. */
async function tenantToken() {
  return signToken({
    userId: new mongoose.Types.ObjectId().toString(),
    name: 'Tenant User',
    role: 'ADMIN',
    tenantId: new mongoose.Types.ObjectId().toString(),
  });
}

/** The token minted by POST /api/platform/tenants/[id]/impersonate. */
async function impersonationToken(
  impersonatedBy = new mongoose.Types.ObjectId().toString(),
  impersonationId = new mongoose.Types.ObjectId().toString(),
) {
  return signToken({
    userId: new mongoose.Types.ObjectId().toString(),
    name: 'Impersonated User',
    role: 'ADMIN',
    tenantId: new mongoose.Types.ObjectId().toString(),
    impersonatedBy,
    impersonationId,
  });
}

beforeAll(async () => {
  process.env.NEXT_JWT_SECRET = JWT_SECRET;
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('tenants').deleteMany({});
  await mongoose.connection.collection('impersonation_logs').deleteMany({});
});

describe('platform-only authentication', () => {
  it('logs a SuperAdmin into the platform with a canonical role claim', async () => {
    await mongoose.connection.collection('users').insertOne({
      name: 'Platform Admin',
      email: 'platform@example.com',
      password: await hash(PASSWORD, 12),
      role: 'user',
      platformRole: 'super_admin',
    });

    const response = await login(new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'platform@example.com', password: PASSWORD }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.redirect).toBe('/platform');
    expect(body.user.platformRole).toBe('SUPER_ADMIN');
    expect(body.token).toBeTruthy();
  });

  it('redirects a SuperAdmin from /app to /platform', async () => {
    const token = await platformToken();
    const request = new NextRequest('http://localhost/app', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/platform');
  });

  it('rejects SuperAdmin access to tenant APIs', async () => {
    const token = await platformToken('SUPER_ADMIN');
    const request = new NextRequest('http://localhost/api/worklogs', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(403);
  });
});

describe('ending an impersonation session', () => {
  it('lets an impersonated session through to the exit route', async () => {
    const token = await impersonationToken();
    const request = new NextRequest('http://localhost/api/platform/impersonation', {
      method: 'DELETE',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it('still blocks an impersonated session from every other platform API', async () => {
    const token = await impersonationToken();
    const request = new NextRequest('http://localhost/api/platform/tenants', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(403);
  });

  it('still blocks other methods on the exit route', async () => {
    const token = await impersonationToken();
    const request = new NextRequest('http://localhost/api/platform/impersonation', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(403);
  });

  it('still blocks a regular tenant user from the exit route', async () => {
    const token = await tenantToken();
    const request = new NextRequest('http://localhost/api/platform/impersonation', {
      method: 'DELETE',
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(403);
  });

  it('closes the audit log and restores the super-admin JWT', async () => {
    const superAdminId = new mongoose.Types.ObjectId();
    const logId = new mongoose.Types.ObjectId();

    await mongoose.connection.collection('users').insertOne({
      _id: superAdminId,
      name: 'Platform Admin',
      email: 'platform@example.com',
      password: await hash(PASSWORD, 12),
      role: 'user',
      platformRole: 'super_admin',
    });
    await mongoose.connection.collection('impersonation_logs').insertOne({
      _id: logId,
      superAdminId,
      targetTenantId: new mongoose.Types.ObjectId(),
      targetUserId: new mongoose.Types.ObjectId(),
      startedAt: new Date(),
    });

    const token = await impersonationToken(
      superAdminId.toString(),
      logId.toString(),
    );

    const response = await endImpersonation(
      new Request('http://localhost/api/platform/impersonation', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(response.status).toBe(200);

    const restored = response.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(restored).toBeTruthy();

    const { payload } = await jwtVerify(
      restored!,
      new TextEncoder().encode(JWT_SECRET),
    );
    expect(payload.platformRole).toBe('SUPER_ADMIN');
    expect(payload.userId).toBe(superAdminId.toString());
    expect(payload.impersonatedBy).toBeUndefined();

    const log = await mongoose.connection
      .collection('impersonation_logs')
      .findOne({ _id: logId });
    expect(log?.endedAt).toBeInstanceOf(Date);
  });
});

describe('bearer authentication on platform APIs', () => {
  it('authenticates a SuperAdmin bearer token on GET /api/platform/tenants', async () => {
    await mongoose.connection.collection('tenants').insertOne({
      name: 'Acme',
      slug: 'acme',
      status: 'active',
      plan: 'free',
    });

    const token = await platformToken();
    const response = await listTenants(
      new Request('http://localhost/api/platform/tenants', {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    const tenants = body.data ?? body;
    expect(tenants.map((tenant: { name: string }) => tenant.name)).toEqual(['Acme']);
  });

  it('rejects a bearer token without the platform role', async () => {
    const token = await tenantToken();
    const response = await listTenants(
      new Request('http://localhost/api/platform/tenants', {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(response.status).toBe(403);
  });

  it('lets the middleware through with a SuperAdmin bearer token', async () => {
    const token = await platformToken();
    const request = new NextRequest('http://localhost/api/platform/tenants', {
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
  });
});
