// @vitest-environment node
/**
 * Regression tests for security audit findings H1, M1 and L2.
 *
 *   H1 — NoSQL operator injection + user-enumeration timing oracle in login.
 *   M1 — no brute-force protection on login (and signup spam, L4's surface).
 *   L2 — jwtVerify did not pin the signing algorithm.
 */
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hash } from 'bcryptjs';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { POST as login } from '@/app/api/login/route';
import { POST as signup } from '@/app/api/signup/route';
import { middleware } from '@/middleware';
import { clearAllRateLimits } from '@/lib/rateLimit';
import { DUMMY_PASSWORD_HASH, PASSWORD_HASH_COST } from '@/lib/constants/security';
import { SESSION_COOKIE_NAME } from '@/lib/constants/constants';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
const PASSWORD = 'correct-horse-battery-staple';
let mongoServer: MongoMemoryServer;

/** Each call uses a distinct IP so one test cannot rate-limit the next. */
let ipCounter = 0;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}`;
}

function loginRequest(body: unknown, ip = freshIp()): Request {
  return new Request('http://localhost/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

async function seedUser(email: string) {
  const userId = new mongoose.Types.ObjectId();
  const tenantId = new mongoose.Types.ObjectId();

  await mongoose.connection.collection('users').insertOne({
    _id: userId,
    name: 'Alice Admin',
    email,
    password: await hash(PASSWORD, PASSWORD_HASH_COST),
    role: 'user',
    platformRole: null,
  });
  await mongoose.connection.collection('tenants').insertOne({
    _id: tenantId,
    name: 'Alpha',
    slug: 'alpha',
    status: 'active',
  });
  await mongoose.connection.collection('user_tenant_memberships').insertOne({
    userId,
    tenantId,
    tenantRole: 'ADMIN',
    isActive: true,
  });

  return { userId, tenantId };
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
  clearAllRateLimits();
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('tenants').deleteMany({});
  await mongoose.connection.collection('user_tenant_memberships').deleteMany({});
});

describe('H1 — login rejects NoSQL operator injection', () => {
  it.each([
    ['$regex', { $regex: '^alice' }],
    ['$ne', { $ne: null }],
    ['$gt', { $gt: '' }],
  ])('rejects an operator object (%s) as the email with 400', async (_label, email) => {
    await seedUser('alice@alpha.test');

    const response = await login(loginRequest({ email, password: PASSWORD }));

    // Before the fix a $regex selected Alice's row and returned 200 + a token.
    expect(response.status).toBe(400);
    expect((await response.json()).token).toBeUndefined();
  });

  it('rejects a non-string password', async () => {
    await seedUser('alice@alpha.test');

    const response = await login(
      loginRequest({ email: 'alice@alpha.test', password: { $ne: null } }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects a malformed email address', async () => {
    const response = await login(loginRequest({ email: 'not-an-email', password: PASSWORD }));

    expect(response.status).toBe(400);
  });

  it('still logs a legitimate user in', async () => {
    await seedUser('alice@alpha.test');

    const response = await login(
      loginRequest({ email: 'alice@alpha.test', password: PASSWORD }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.user.tenantId).toBeTruthy();
  });

  it('normalizes case and surrounding whitespace', async () => {
    await seedUser('alice@alpha.test');

    const response = await login(
      loginRequest({ email: '  ALICE@Alpha.TEST  ', password: PASSWORD }),
    );

    expect(response.status).toBe(200);
  });
});

describe('H1 — login does not disclose whether an account exists', () => {
  it('returns the same status and message for an unknown and a known account', async () => {
    await seedUser('alice@alpha.test');

    const known = await login(loginRequest({ email: 'alice@alpha.test', password: 'wrong' }));
    const unknown = await login(loginRequest({ email: 'nobody@alpha.test', password: 'wrong' }));

    expect(known.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await known.json()).toEqual(await unknown.json());
  });

  it('compares against a dummy hash of the same cost real accounts use', async () => {
    // The equal-time property depends entirely on these costs matching. If a
    // future change raises PASSWORD_HASH_COST without regenerating the dummy,
    // the "unknown account" path becomes measurably cheaper and the oracle
    // reopens — this assertion is what catches that drift.
    const realHash = await hash(PASSWORD, PASSWORD_HASH_COST);

    expect(DUMMY_PASSWORD_HASH.split('$')[2]).toBe(realHash.split('$')[2]);
  });

  it('runs a password comparison even when no user matches', async () => {
    // A skipped compare is what produced the ~5x timing gap in the audit.
    // Measuring wall-clock is flaky in CI, so assert the observable proxy:
    // an unknown account takes a comparable order of magnitude, never ~0.
    await seedUser('alice@alpha.test');

    const startUnknown = Date.now();
    await login(loginRequest({ email: 'nobody@alpha.test', password: 'wrong' }));
    const unknownMs = Date.now() - startUnknown;

    const startKnown = Date.now();
    await login(loginRequest({ email: 'alice@alpha.test', password: 'wrong' }));
    const knownMs = Date.now() - startKnown;

    // Before the fix the unknown path skipped bcrypt entirely and was near
    // instant while the known path paid a full cost-12 compare.
    expect(unknownMs).toBeGreaterThan(knownMs / 4);
  });
});

describe('M1 — login rate limiting', () => {
  it('rejects the 11th failed attempt from one IP with 429 and Retry-After', async () => {
    await seedUser('alice@alpha.test');
    const ip = '198.51.100.1';

    const codes: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await login(
        loginRequest({ email: 'alice@alpha.test', password: 'wrong' }, ip),
      );
      codes.push(response.status);

      if (attempt === 10) {
        expect(response.headers.get('retry-after')).toBeTruthy();
      }
    }

    expect(codes.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(codes[10]).toBe(429);
    // 11 real bcrypt compares at cost 12 comfortably exceed the 5s default.
  }, 60000);

  it('limits a distributed spray against one account by email', async () => {
    await seedUser('alice@alpha.test');

    let last = 0;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      // Every attempt comes from a different IP, so only the per-email
      // bucket can stop this.
      const response = await login(
        loginRequest({ email: 'alice@alpha.test', password: 'wrong' }, `10.0.0.${attempt}`),
      );
      last = response.status;
    }

    expect(last).toBe(429);
  }, 60000);

  it('clears the counters after a successful login', async () => {
    await seedUser('alice@alpha.test');
    const ip = '198.51.100.2';

    for (let attempt = 0; attempt < 9; attempt += 1) {
      await login(loginRequest({ email: 'alice@alpha.test', password: 'wrong' }, ip));
    }

    const success = await login(
      loginRequest({ email: 'alice@alpha.test', password: PASSWORD }, ip),
    );
    expect(success.status).toBe(200);

    // A user who mistyped their password then signed in successfully must not
    // be locked out by their own earlier typos.
    const after = await login(loginRequest({ email: 'alice@alpha.test', password: 'wrong' }, ip));
    expect(after.status).toBe(401);
  }, 60000);

  it('rate-limits signup per IP', async () => {
    const ip = '192.0.2.10';

    const codes: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await signup(
        new Request('http://localhost/api/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
          body: JSON.stringify({
            name: `Probe ${attempt}`,
            email: `probe${attempt}@spam.test`,
            password: 'probe-password-123',
          }),
        }),
      );
      codes.push(response.status);
    }

    expect(codes.slice(0, 5)).toEqual(Array(5).fill(201));
    expect(codes[5]).toBe(429);
  }, 60000);
});

describe('L2 — JWT verification pins the signing algorithm', () => {
  it('rejects a token signed with an algorithm other than HS256', async () => {
    // HS512 over the same symmetric secret: cryptographically valid, but the
    // wrong algorithm. Unpinned verification would accept it.
    const token = await new SignJWT({
      userId: new mongoose.Types.ObjectId().toString(),
      name: 'Alice',
      role: 'ADMIN',
      tenantId: new mongoose.Types.ObjectId().toString(),
    })
      .setProtectedHeader({ alg: 'HS512' })
      .setIssuedAt()
      .setExpirationTime('12h')
      .sign(new TextEncoder().encode(JWT_SECRET));

    const response = await middleware(
      new NextRequest('http://localhost/api/worklogs', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );

    expect(response.status).toBe(401);
  });

  it('still accepts a correctly signed HS256 token', async () => {
    const token = await new SignJWT({
      userId: new mongoose.Types.ObjectId().toString(),
      name: 'Alice',
      role: 'ADMIN',
      tenantId: new mongoose.Types.ObjectId().toString(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('12h')
      .sign(new TextEncoder().encode(JWT_SECRET));

    const response = await middleware(
      new NextRequest('http://localhost/api/worklogs', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      }),
    );

    expect(response.status).toBe(200);
  });
});
