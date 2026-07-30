// @vitest-environment node
//
// Node, not the project-default jsdom: jsdom's `TextEncoder` returns a
// cross-realm `Uint8Array` that jose's `instanceof` check rejects when signing.
// Everything under test here is server-side anyway.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignJWT } from 'jose';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

/**
 * `getAuthUser` reads the cookie through `next/headers`, which throws outside a
 * request scope. The mock lets each test say "this request has a cookie" or
 * "this one doesn't" without standing up a Next server.
 */
const cookieValue = { current: undefined as string | undefined };

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === COOKIE_NAME && cookieValue.current !== undefined
        ? { name, value: cookieValue.current }
        : undefined,
  }),
}));

import { getAuthUser, getTokenFromRequest } from '@/utils/auth';
import { SESSION_COOKIE_NAME } from '@/lib/constants/constants';

/**
 * Bound to the real constant so a rename can't leave the mock quietly handing
 * back nothing and turning the cookie-path tests green for the wrong reason.
 */
const COOKIE_NAME = SESSION_COOKIE_NAME;

async function signToken(
  payload: Record<string, unknown>,
  expiresIn = '12h',
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(JWT_SECRET));
}

const USER = { userId: 'user-1', name: 'Ada', role: 'admin' };

function bearerRequest(token: string): Request {
  return new Request('http://localhost/api/me', {
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  process.env.NEXT_JWT_SECRET = JWT_SECRET;
  cookieValue.current = undefined;
  // getAuthUser logs on every verification failure; keep the output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getTokenFromRequest', () => {
  it('extracts a bearer token', () => {
    const request = new Request('http://localhost/api/me', {
      headers: { authorization: 'Bearer abc.def.ghi' },
    });
    expect(getTokenFromRequest(request)).toBe('abc.def.ghi');
  });

  it('is case-insensitive on the scheme', () => {
    const request = new Request('http://localhost/api/me', {
      headers: { authorization: 'bearer abc.def.ghi' },
    });
    expect(getTokenFromRequest(request)).toBe('abc.def.ghi');
  });

  it('tolerates surrounding and repeated whitespace', () => {
    const request = new Request('http://localhost/api/me', {
      headers: { authorization: '  Bearer    abc.def.ghi  ' },
    });
    expect(getTokenFromRequest(request)).toBe('abc.def.ghi');
  });

  it('returns null when the header is absent', () => {
    expect(getTokenFromRequest(new Request('http://localhost/api/me'))).toBeNull();
  });

  it('returns null for a non-bearer scheme', () => {
    const request = new Request('http://localhost/api/me', {
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(getTokenFromRequest(request)).toBeNull();
  });

  it('returns null when the scheme has no token', () => {
    const request = new Request('http://localhost/api/me', {
      headers: { authorization: 'Bearer' },
    });
    expect(getTokenFromRequest(request)).toBeNull();
  });
});

describe('getAuthUser — cookie path (web, unchanged)', () => {
  it('authenticates from the session cookie with no request argument', async () => {
    cookieValue.current = await signToken(USER);

    expect(await getAuthUser()).toEqual(USER);
  });

  it('returns null when there is no cookie and no request', async () => {
    expect(await getAuthUser()).toBeNull();
  });

  it('returns null for a cookie signed with a different secret', async () => {
    cookieValue.current = await new SignJWT(USER)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('12h')
      .sign(new TextEncoder().encode('a-completely-different-secret-32-chars'));

    expect(await getAuthUser()).toBeNull();
  });

  it('returns null rather than throwing when the secret is unconfigured', async () => {
    cookieValue.current = await signToken(USER);
    delete process.env.NEXT_JWT_SECRET;

    expect(await getAuthUser()).toBeNull();
  });

  it('prefers the cookie when both sources are valid', async () => {
    cookieValue.current = await signToken({ ...USER, userId: 'from-cookie' });
    const bearer = await signToken({ ...USER, userId: 'from-bearer' });

    const user = await getAuthUser(bearerRequest(bearer));
    expect(user?.userId).toBe('from-cookie');
  });
});

describe('getAuthUser — bearer path (mobile)', () => {
  it('authenticates from the Authorization header', async () => {
    const token = await signToken(USER);

    expect(await getAuthUser(bearerRequest(token))).toEqual(USER);
  });

  it('returns null for a request with no cookie and no bearer token', async () => {
    expect(await getAuthUser(new Request('http://localhost/api/me'))).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await new SignJWT(USER)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('12h')
      .sign(new TextEncoder().encode('a-completely-different-secret-32-chars'));

    expect(await getAuthUser(bearerRequest(token))).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signToken(USER, '-1s');

    expect(await getAuthUser(bearerRequest(token))).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = await signToken(USER);

    expect(await getAuthUser(bearerRequest(`${token}tampered`))).toBeNull();
  });

  it('falls back to a valid bearer token when the cookie no longer verifies', async () => {
    cookieValue.current = await signToken(USER, '-1s');
    const bearer = await signToken({ ...USER, userId: 'from-bearer' });

    const user = await getAuthUser(bearerRequest(bearer));
    expect(user?.userId).toBe('from-bearer');
  });
});
