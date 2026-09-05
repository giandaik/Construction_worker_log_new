// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SignJWT } from 'jose';
import { ImpersonationLogRepository } from '@/lib/repositories/ImpersonationLogRepository';

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
  await mongoose.connection.collection('impersonation_logs').deleteMany({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function logsRepo() {
  return new ImpersonationLogRepository(
    mongoose.connection.collection('impersonation_logs'),
  );
}

async function impersonationToken(impersonationId: string) {
  return new SignJWT({
    userId: new mongoose.Types.ObjectId().toString(),
    name: 'Alice Admin',
    role: 'ADMIN',
    tenantId: new mongoose.Types.ObjectId().toString(),
    impersonatedBy: new mongoose.Types.ObjectId().toString(),
    impersonationId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

function bearer(token: string) {
  return new Request('http://localhost/api/worklogs', {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function startSession() {
  return logsRepo().startSession(
    new mongoose.Types.ObjectId().toString(),
    new mongoose.Types.ObjectId().toString(),
    new mongoose.Types.ObjectId().toString(),
    'audit probe',
  );
}

describe('H4 — an impersonation session is stateful', () => {
  it('authenticates a token whose log entry is still open', async () => {
    const { getAuthUser } = await import('@/utils/auth');
    const entry = await startSession();

    const user = await getAuthUser(
      bearer(await impersonationToken(entry._id!.toString())),
    );

    expect(user?.impersonationId).toBe(entry._id!.toString());
  });

  it('stops authenticating once the log entry is closed', async () => {
    const { getAuthUser } = await import('@/utils/auth');
    const entry = await startSession();
    const token = await impersonationToken(entry._id!.toString());

    expect(await getAuthUser(bearer(token))).not.toBeNull();

    await logsRepo().endActiveSession(entry._id!.toString());

    expect(await getAuthUser(bearer(token))).toBeNull();
  });

  it('rejects a token naming a log entry that does not exist', async () => {
    const { getAuthUser } = await import('@/utils/auth');
    const token = await impersonationToken(
      new mongoose.Types.ObjectId().toString(),
    );

    expect(await getAuthUser(bearer(token))).toBeNull();
  });

  it('rejects a token whose impersonationId is not a valid id', async () => {
    const { getAuthUser } = await import('@/utils/auth');

    expect(await getAuthUser(bearer(await impersonationToken('not-an-id')))).toBeNull();
  });

  it('leaves a token with no impersonation claim untouched', async () => {
    const { getAuthUser } = await import('@/utils/auth');
    const token = await new SignJWT({
      userId: new mongoose.Types.ObjectId().toString(),
      name: 'Alice Admin',
      role: 'ADMIN',
      tenantId: new mongoose.Types.ObjectId().toString(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('12h')
      .sign(new TextEncoder().encode(JWT_SECRET));

    expect(await getAuthUser(bearer(token))).not.toBeNull();
  });

  it('still exposes the ended session to the route that ends it', async () => {
    const { getAuthUserIgnoringImpersonationState } = await import('@/utils/auth');
    const entry = await startSession();
    const token = await impersonationToken(entry._id!.toString());
    await logsRepo().endActiveSession(entry._id!.toString());

    const user = await getAuthUserIgnoringImpersonationState(bearer(token));

    expect(user?.impersonationId).toBe(entry._id!.toString());
  });
});

describe('H4 — ending an impersonation session cannot be replayed', () => {
  it('closes an open session once and refuses the second attempt', async () => {
    const entry = await startSession();
    const id = entry._id!.toString();

    expect(await logsRepo().endActiveSession(id)).not.toBeNull();
    expect(await logsRepo().endActiveSession(id)).toBeNull();
  });

  it('lets only one of two concurrent closes win', async () => {
    const entry = await startSession();
    const id = entry._id!.toString();

    const results = await Promise.all([
      logsRepo().endActiveSession(id),
      logsRepo().endActiveSession(id),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('reports an open session as active and a closed one as not', async () => {
    const entry = await startSession();
    const id = entry._id!.toString();

    expect(await logsRepo().isSessionActive(id)).toBe(true);
    await logsRepo().endActiveSession(id);
    expect(await logsRepo().isSessionActive(id)).toBe(false);
  });
});

describe('H4 — impersonation cannot be laundered into a tenant token', () => {
  it('select-tenant rejects a token carrying impersonation claims', async () => {
    const { POST } = await import('@/app/api/auth/select-tenant/route');
    const entry = await startSession();
    const token = await impersonationToken(entry._id!.toString());

    const response = await POST(
      new Request('http://localhost/api/auth/select-tenant', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tenantId: new mongoose.Types.ObjectId().toString() }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/End impersonation/i);
  });
});
