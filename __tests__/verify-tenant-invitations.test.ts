// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hash } from 'bcryptjs';
import { jwtVerify, SignJWT } from 'jose';
import { clearAllRateLimits } from '@/lib/rateLimit';

const { sendInvitation, sendRequestNotification, sendRequestRejected } = vi.hoisted(() => ({
  sendInvitation: vi.fn(),
  sendRequestNotification: vi.fn(),
  sendRequestRejected: vi.fn(),
}));
vi.mock('@/lib/email/sendEmail', () => ({
  sendTenantInvitationEmail: sendInvitation,
  sendSignupRequestNotificationEmail: sendRequestNotification,
  sendSignupRequestRejectedEmail: sendRequestRejected,
}));

const JWT_SECRET = 'test-secret-that-is-long-enough-for-the-validator';
const PASSWORD = 'correct-horse-battery-staple';
const TENANT_ID = new mongoose.Types.ObjectId();

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  process.env.NEXT_JWT_SECRET = JWT_SECRET;
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  clearAllRateLimits();
  sendInvitation.mockReset().mockResolvedValue(true);
  sendRequestNotification.mockReset().mockResolvedValue(true);
  sendRequestRejected.mockReset().mockResolvedValue(true);
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('tenants').deleteMany({});
  await mongoose.connection.collection('user_tenant_memberships').deleteMany({});
  await mongoose.connection.collection('tenant_invitations').deleteMany({});
  await mongoose.connection.collection('signup_requests').deleteMany({});
  await mongoose.connection.collection('tenants').insertOne({
    _id: TENANT_ID,
    name: 'Alpha Construction',
    slug: 'alpha-construction',
    status: 'active',
  });
});

async function seedMember(role: 'ADMIN' | 'MANAGER' = 'ADMIN', tokenRole = role) {
  const userId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('users').insertOne({
    _id: userId,
    name: 'Tenant Admin',
    email: `${userId.toString()}@example.test`,
    password: await hash(PASSWORD, 12),
    role: role.toLowerCase(),
  });
  await mongoose.connection.collection('user_tenant_memberships').insertOne({
    userId,
    tenantId: TENANT_ID,
    tenantRole: role,
    isActive: true,
    joinedAt: new Date(),
  });
  const token = await new SignJWT({
    userId: userId.toString(),
    name: 'Tenant Admin',
    role: tokenRole,
    tenantId: TENANT_ID.toString(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(JWT_SECRET));
  return { userId, token };
}

async function seedSuperAdmin() {
  const userId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('users').insertOne({
    _id: userId,
    name: 'Platform Admin',
    email: 'platform-admin@example.test',
    password: await hash(PASSWORD, 12),
    role: 'user',
    platformRole: 'SUPER_ADMIN',
  });
  const token = await new SignJWT({
    userId: userId.toString(),
    name: 'Platform Admin',
    role: 'user',
    platformRole: 'SUPER_ADMIN',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(JWT_SECRET));
  return { userId, token };
}

function request(url: string, body: unknown, token?: string) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function issueInvitation(email: string, tenantRole = 'WORKER', token?: string) {
  const { POST } = await import('@/app/api/tenant/invitations/route');
  const admin = token ? { token } : await seedMember();
  const response = await POST(
    request('http://localhost/api/tenant/invitations', { email, tenantRole }, admin.token),
  );
  return { response, admin };
}

describe('tenant invitation flow', () => {
  it('allows unauthenticated visitors to submit an invitation request', async () => {
    const { middleware } = await import('@/middleware');
    const response = await middleware(
      new NextRequest('http://localhost/api/signup-requests', { method: 'POST' }),
    );

    expect(response.status).toBe(200);
  });

  it('sends an expiring invite without storing or returning the raw token', async () => {
    const { response } = await issueInvitation('worker@example.test');
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.message).toBe('Invitation sent');
    expect(payload.inviteToken).toBeUndefined();
    expect(sendInvitation).toHaveBeenCalledOnce();

    const sentPayload = sendInvitation.mock.calls[0][0];
    const token = new URL(sentPayload.inviteUrl).searchParams.get('invite');
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    const record = await mongoose.connection.collection('tenant_invitations').findOne({
      email: 'worker@example.test',
    });
    expect(record?.tokenHash).not.toBe(token);
    expect(record?.status).toBe('pending');
    expect(record?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('prevents a manager from inviting another administrator', async () => {
    const manager = await seedMember('MANAGER', 'ADMIN');
    const { response } = await issueInvitation('new-admin@example.test', 'ADMIN', manager.token);

    expect(response.status).toBe(403);
    expect(sendInvitation).not.toHaveBeenCalled();
  });

  it('does not leave an active invitation when email delivery fails', async () => {
    sendInvitation.mockResolvedValueOnce(false);
    const { response } = await issueInvitation('worker@example.test');

    expect(response.status).toBe(503);
    expect(await mongoose.connection.collection('tenant_invitations').countDocuments({
      email: 'worker@example.test',
      status: 'pending',
    })).toBe(0);
  });

  it('allows an administrator to invite a member at their own role', async () => {
    const { response } = await issueInvitation('new-admin@example.test', 'ADMIN');

    expect(response.status).toBe(201);
    expect(sendInvitation).toHaveBeenCalledOnce();
    expect(sendInvitation.mock.calls[0][0].tenantRole).toBe('ADMIN');
  });

  it('creates a scoped account from a matching invite and consumes the invite once', async () => {
    await issueInvitation('worker@example.test');
    const token = new URL(sendInvitation.mock.calls[0][0].inviteUrl).searchParams.get('invite');
    const { POST: signup } = await import('@/app/api/signup/route');
    const signupBody = {
      name: 'New Worker',
      email: 'worker@example.test',
      password: PASSWORD,
      inviteToken: token,
    };

    const response = await signup(request('http://localhost/api/signup', signupBody));
    const payload = await response.json();

    expect(response.status).toBe(201);
    const { payload: claims } = await jwtVerify(
      payload.token,
      new TextEncoder().encode(JWT_SECRET),
    );
    expect(claims.role).toBe('WORKER');
    expect(claims.tenantId).toBe(TENANT_ID.toString());

    const user = await mongoose.connection.collection('users').findOne({ email: signupBody.email });
    expect(user?.password).not.toBe(PASSWORD);
    const membership = await mongoose.connection.collection('user_tenant_memberships').findOne({
      userId: user?._id,
    });
    expect(membership?.tenantId.toString()).toBe(TENANT_ID.toString());
    expect(membership?.tenantRole).toBe('WORKER');

    const replay = await signup(request('http://localhost/api/signup', signupBody));
    expect(replay.status).toBe(400);
  });

  it('requires an invite and rejects an email mismatch without creating an account', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const missing = await POST(request('http://localhost/api/signup', {
      name: 'No Invite',
      email: 'no-invite@example.test',
      password: PASSWORD,
    }));
    expect(missing.status).toBe(400);

    await issueInvitation('intended@example.test');
    const token = new URL(sendInvitation.mock.calls[0][0].inviteUrl).searchParams.get('invite');
    const mismatch = await POST(request('http://localhost/api/signup', {
      name: 'Wrong Person',
      email: 'other@example.test',
      password: PASSWORD,
      inviteToken: token,
    }));
    expect(mismatch.status).toBe(400);
    expect(await mongoose.connection.collection('users').countDocuments({})).toBe(1);
  });

  it('lets an existing account join only after successful password authentication', async () => {
    await mongoose.connection.collection('users').insertOne({
      name: 'Existing Worker',
      email: 'existing@example.test',
      password: await hash(PASSWORD, 12),
      role: 'user',
    });
    await issueInvitation('existing@example.test');
    const inviteToken = new URL(sendInvitation.mock.calls[0][0].inviteUrl).searchParams.get('invite');
    const { POST: login } = await import('@/app/api/login/route');

    const invalid = await login(request('http://localhost/api/login', {
      email: 'existing@example.test',
      password: 'wrong-password',
      inviteToken,
    }));
    expect(invalid.status).toBe(401);
    expect(await mongoose.connection.collection('user_tenant_memberships').countDocuments({})).toBe(1);

    const accepted = await login(request('http://localhost/api/login', {
      email: 'existing@example.test',
      password: PASSWORD,
      inviteToken,
    }));
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).user.tenantId).toBe(TENANT_ID.toString());
    expect(await mongoose.connection.collection('user_tenant_memberships').countDocuments({})).toBe(2);
  });

  it('stores a public signup request and emails platform super-admins without creating an account', async () => {
    await seedSuperAdmin();
    const { POST } = await import('@/app/api/signup-requests/route');
    const response = await POST(request('http://localhost/api/signup-requests', {
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.test',
      organizationName: 'North Works',
      message: 'I manage a small construction team.',
    }));

    expect(response.status).toBe(202);
    expect(sendRequestNotification).toHaveBeenCalledOnce();
    expect(sendRequestNotification.mock.calls[0][0].recipients).toEqual(['platform-admin@example.test']);
    expect(await mongoose.connection.collection('users').countDocuments({ email: 'alex@example.test' })).toBe(0);
    const saved = await mongoose.connection.collection('signup_requests').findOne({ email: 'alex@example.test' });
    expect(saved?.status).toBe('pending');
    expect(saved?.notificationSentAt).toBeInstanceOf(Date);
  });

  it('deduplicates repeated pending requests and does not resend a delivered notification', async () => {
    await seedSuperAdmin();
    const { POST } = await import('@/app/api/signup-requests/route');
    const body = {
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.test',
      organizationName: 'North Works',
    };

    expect((await POST(request('http://localhost/api/signup-requests', body))).status).toBe(202);
    expect((await POST(request('http://localhost/api/signup-requests', body))).status).toBe(202);
    expect(sendRequestNotification).toHaveBeenCalledOnce();
    expect(await mongoose.connection.collection('signup_requests').countDocuments({
      email: body.email,
      status: 'pending',
    })).toBe(1);
  });

  it('keeps requests available for retry when the super-admin notification fails', async () => {
    await seedSuperAdmin();
    sendRequestNotification.mockResolvedValueOnce(false);
    const { POST } = await import('@/app/api/signup-requests/route');
    const body = {
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.test',
      organizationName: 'North Works',
    };

    expect((await POST(request('http://localhost/api/signup-requests', body))).status).toBe(503);
    const saved = await mongoose.connection.collection('signup_requests').findOne({ email: body.email });
    expect(saved?.status).toBe('pending');
    expect(saved?.notificationSentAt).toBeUndefined();
    expect((await POST(request('http://localhost/api/signup-requests', body))).status).toBe(202);
    expect(sendRequestNotification).toHaveBeenCalledTimes(2);
  });

  it('lets a super-admin approve a request and then sends the existing invitation email', async () => {
    const { token } = await seedSuperAdmin();
    const { POST: submitRequest } = await import('@/app/api/signup-requests/route');
    await submitRequest(request('http://localhost/api/signup-requests', {
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.test',
      organizationName: 'North Works',
    }));
    const signupRequest = await mongoose.connection.collection('signup_requests').findOne({
      email: 'alex@example.test',
    });
    const { GET } = await import('@/app/api/platform/signup-requests/route');
    const listResponse = await GET(new Request('http://localhost/api/platform/signup-requests', {
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toHaveLength(1);

    const { POST: decideRequest } = await import('@/app/api/platform/signup-requests/[id]/route');
    const response = await decideRequest(
      request('http://localhost/api/platform/signup-requests', {
        action: 'approve',
        tenantId: TENANT_ID.toString(),
        tenantRole: 'WORKER',
      }, token),
      { params: Promise.resolve({ id: signupRequest?._id.toString() ?? '' }) },
    );

    expect(response.status).toBe(200);
    expect(sendInvitation).toHaveBeenCalledOnce();
    expect(sendInvitation.mock.calls[0][0].tenantName).toBe('Alpha Construction');
    const invitation = await mongoose.connection.collection('tenant_invitations').findOne({
      email: 'alex@example.test',
    });
    expect(invitation?.status).toBe('pending');
    expect(invitation?.tenantRole).toBe('WORKER');
    expect(await mongoose.connection.collection('users').countDocuments({ email: 'alex@example.test' })).toBe(0);
    expect(await mongoose.connection.collection('user_tenant_memberships').countDocuments({})).toBe(0);
    expect((await mongoose.connection.collection('signup_requests').findOne({
      _id: signupRequest?._id,
    }))?.status).toBe('approved');

    const inviteToken = new URL(sendInvitation.mock.calls[0][0].inviteUrl).searchParams.get('invite');
    const { POST: signup } = await import('@/app/api/signup/route');
    const accepted = await signup(request('http://localhost/api/signup', {
      name: 'Alex Builder',
      email: 'alex@example.test',
      password: PASSWORD,
      inviteToken,
    }));
    expect(accepted.status).toBe(201);
    expect(await mongoose.connection.collection('user_tenant_memberships').countDocuments({})).toBe(1);
    expect((await mongoose.connection.collection('tenant_invitations').findOne({
      email: 'alex@example.test',
    }))?.status).toBe('accepted');
  });

  it('prevents tenant administrators from accessing the signup-request queue', async () => {
    const { token } = await seedMember();
    const { GET } = await import('@/app/api/platform/signup-requests/route');
    const response = await GET(new Request('http://localhost/api/platform/signup-requests', {
      headers: { authorization: `Bearer ${token}` },
    }));

    expect(response.status).toBe(403);
  });

  it('leaves a request pending when the invitation email cannot be delivered', async () => {
    const { token } = await seedSuperAdmin();
    const { POST: submitRequest } = await import('@/app/api/signup-requests/route');
    await submitRequest(request('http://localhost/api/signup-requests', {
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.test',
      organizationName: 'North Works',
    }));
    const signupRequest = await mongoose.connection.collection('signup_requests').findOne({
      email: 'alex@example.test',
    });
    sendInvitation.mockResolvedValueOnce(false);
    const { POST: decideRequest } = await import('@/app/api/platform/signup-requests/[id]/route');
    const response = await decideRequest(
      request('http://localhost/api/platform/signup-requests', {
        action: 'approve',
        tenantId: TENANT_ID.toString(),
        tenantRole: 'WORKER',
      }, token),
      { params: Promise.resolve({ id: signupRequest?._id.toString() ?? '' }) },
    );

    expect(response.status).toBe(503);
    expect((await mongoose.connection.collection('signup_requests').findOne({
      _id: signupRequest?._id,
    }))?.claimId).toBeUndefined();
    expect((await mongoose.connection.collection('signup_requests').findOne({
      _id: signupRequest?._id,
    }))?.status).toBe('pending');
    expect(await mongoose.connection.collection('tenant_invitations').countDocuments({
      email: 'alex@example.test',
      status: 'pending',
    })).toBe(0);
  });

  it('notifies the applicant when a super-admin rejects their request', async () => {
    const { token } = await seedSuperAdmin();
    const { POST: submitRequest } = await import('@/app/api/signup-requests/route');
    await submitRequest(request('http://localhost/api/signup-requests', {
      firstName: 'Alex',
      lastName: 'Builder',
      email: 'alex@example.test',
      organizationName: 'North Works',
    }));
    const signupRequest = await mongoose.connection.collection('signup_requests').findOne({
      email: 'alex@example.test',
    });
    const { POST: decideRequest } = await import('@/app/api/platform/signup-requests/[id]/route');
    const response = await decideRequest(
      request('http://localhost/api/platform/signup-requests', {
        action: 'reject',
        reason: 'Please contact your organisation administrator.',
      }, token),
      { params: Promise.resolve({ id: signupRequest?._id.toString() ?? '' }) },
    );

    expect(response.status).toBe(200);
    expect(sendRequestRejected).toHaveBeenCalledOnce();
    expect(sendRequestRejected.mock.calls[0][0].email).toBe('alex@example.test');
    expect((await mongoose.connection.collection('signup_requests').findOne({
      _id: signupRequest?._id,
    }))?.status).toBe('rejected');
  });
});
