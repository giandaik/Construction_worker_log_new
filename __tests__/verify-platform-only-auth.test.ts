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
import { POST as startImpersonation } from '@/app/api/platform/tenants/[id]/impersonate/route';
import { POST as selectTenant } from '@/app/api/auth/select-tenant/route';
import { GET as listMembers } from '@/app/api/tenant/members/route';
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
  await mongoose.connection.collection('user_tenant_memberships').deleteMany({});
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

/**
 * The mobile WebView never receives the session cookie, so any route that mints
 * a new JWT has to hand it back in the response body, and any route the mobile
 * client calls has to accept `Authorization: Bearer`.
 */
describe('mobile bearer credentials', () => {
  async function seedTenant(name: string, status = 'active') {
    const tenantId = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('tenants').insertOne({
      _id: tenantId,
      name,
      slug: name.toLowerCase(),
      status,
      plan: 'free',
    });
    return tenantId;
  }

  async function seedMember(tenantId: mongoose.Types.ObjectId, tenantRole = 'ADMIN') {
    const userId = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('users').insertOne({
      _id: userId,
      name: 'Member',
      email: `member-${userId.toString()}@example.com`,
      role: 'user',
    });
    await mongoose.connection.collection('user_tenant_memberships').insertOne({
      userId,
      tenantId,
      tenantRole,
      isActive: true,
      joinedAt: new Date(),
    });
    return userId;
  }

  function selectTenantRequest(token: string, tenantId: string) {
    return new Request('http://localhost/api/auth/select-tenant', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tenantId }),
    });
  }

  it('completes tenant selection with a bearer-only pending_selection token', async () => {
    const tenantId = await seedTenant('Alpha');
    const userId = await seedMember(tenantId, 'MANAGER');
    const pending = await signToken({
      userId: userId.toString(),
      name: 'Member',
      role: 'pending_selection',
    });

    const response = await selectTenant(
      selectTenantRequest(pending, tenantId.toString()),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBeTruthy();

    const { payload } = await jwtVerify(
      body.token,
      new TextEncoder().encode(JWT_SECRET),
    );
    expect(payload.userId).toBe(userId.toString());
    expect(payload.tenantId).toBe(tenantId.toString());
    expect(payload.role).toBe('MANAGER');
  });

  it('still refuses a tenant the bearer user is not a member of', async () => {
    const ownTenant = await seedTenant('Alpha');
    const otherTenant = await seedTenant('Beta');
    const userId = await seedMember(ownTenant);
    const pending = await signToken({
      userId: userId.toString(),
      name: 'Member',
      role: 'pending_selection',
    });

    const response = await selectTenant(
      selectTenantRequest(pending, otherTenant.toString()),
    );

    expect(response.status).toBe(403);
  });

  it('returns an impersonation token in the body that works as a bearer credential', async () => {
    const superAdminId = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('users').insertOne({
      _id: superAdminId,
      name: 'Platform Admin',
      email: 'platform@example.com',
      role: 'user',
      platformRole: 'super_admin',
    });
    const tenantId = await seedTenant('Alpha');
    const targetUserId = await seedMember(tenantId);

    const adminToken = await platformToken('super_admin', superAdminId.toString());
    const response = await startImpersonation(
      new Request(`http://localhost/api/platform/tenants/${tenantId.toString()}/impersonate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ userId: targetUserId.toString(), reason: 'support' }),
      }),
      { params: Promise.resolve({ id: tenantId.toString() }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.redirect).toBe('/app');

    // The body token must be the same credential the cookie carries.
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe(body.token);

    // And it must authenticate a tenant route with no cookie present.
    const members = await listMembers(
      new Request('http://localhost/api/tenant/members', {
        headers: { authorization: `Bearer ${body.token}` },
      }),
    );

    expect(members.status).toBe(200);
    const membersBody = await members.json();
    const rows = membersBody.data ?? membersBody;
    expect(rows).toHaveLength(1);
    expect(rows[0].userId.toString()).toBe(targetUserId.toString());
  });

  it('returns a restored super-admin token in the body when impersonation ends', async () => {
    const superAdminId = new mongoose.Types.ObjectId();
    const logId = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('users').insertOne({
      _id: superAdminId,
      name: 'Platform Admin',
      email: 'platform@example.com',
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
    await mongoose.connection.collection('tenants').insertOne({
      name: 'Acme',
      slug: 'acme',
      status: 'active',
      plan: 'free',
    });

    const token = await impersonationToken(superAdminId.toString(), logId.toString());
    const response = await endImpersonation(
      new Request('http://localhost/api/platform/impersonation', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(response.cookies.get(SESSION_COOKIE_NAME)?.value).toBe(body.token);

    const restored = await listTenants(
      new Request('http://localhost/api/platform/tenants', {
        headers: { authorization: `Bearer ${body.token}` },
      }),
    );

    expect(restored.status).toBe(200);
  });
});
