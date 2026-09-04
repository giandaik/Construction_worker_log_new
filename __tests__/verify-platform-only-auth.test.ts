// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hash } from 'bcryptjs';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { POST as login } from '@/app/api/login/route';
import { middleware } from '@/middleware';
import { SESSION_COOKIE_NAME } from '@/lib/constants/constants';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
const PASSWORD = 'correct-horse-battery-staple';
let mongoServer: MongoMemoryServer;

async function platformToken(platformRole = 'super_admin') {
  return new SignJWT({
    userId: new mongoose.Types.ObjectId().toString(),
    name: 'Platform Admin',
    role: 'user',
    platformRole,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(new TextEncoder().encode(JWT_SECRET));
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
