import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const MOBILE_BASE = 'https://api.example.com';

/**
 * `apiFetch` decides web-vs-mobile from `NEXT_PUBLIC_API_BASE_URL`, which is
 * read once at module load. Each case therefore sets the env var and re-imports
 * the module rather than trying to mutate it afterwards.
 */
async function loadApiClient(baseUrl?: string) {
  vi.resetModules();

  if (baseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_API_BASE_URL = baseUrl;
  }

  return import('@/lib/apiClient');
}

const storedToken = { current: null as string | null };

vi.mock('@/lib/mobile-auth', () => ({
  getMobileToken: async () => storedToken.current,
  setMobileToken: async () => {},
  clearMobileToken: async () => {},
  isMobileApp: async () => storedToken.current !== null,
}));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  storedToken.current = null;
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
});

describe('apiFetch on web (no API base URL)', () => {
  it('forwards the path and init untouched, exactly like a bare fetch', async () => {
    const { apiFetch } = await loadApiClient(undefined);
    const init = { method: 'POST', body: 'x' };

    await apiFetch('/api/me', init);

    expect(fetchMock).toHaveBeenCalledWith('/api/me', init);
  });

  it('does not attach an Authorization header even if a token is stored', async () => {
    storedToken.current = 'a.jwt.token';
    const { apiFetch } = await loadApiClient(undefined);

    await apiFetch('/api/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toBeUndefined();
  });
});

describe('apiFetch on mobile (cross-origin API)', () => {
  it('rewrites the path against the base URL', async () => {
    const { apiFetch } = await loadApiClient(MOBILE_BASE);

    await apiFetch('/api/me');

    expect(fetchMock.mock.calls[0][0]).toBe(`${MOBILE_BASE}/api/me`);
  });

  it('attaches the stored token as a bearer credential', async () => {
    storedToken.current = 'a.jwt.token';
    const { apiFetch } = await loadApiClient(MOBILE_BASE);

    await apiFetch('/api/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer a.jwt.token');
    expect(init.credentials).toBe('include');
  });

  it('sends no Authorization header when no token is stored', async () => {
    const { apiFetch } = await loadApiClient(MOBILE_BASE);

    await apiFetch('/api/me');

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('preserves caller-supplied headers alongside the token', async () => {
    storedToken.current = 'a.jwt.token';
    const { apiFetch } = await loadApiClient(MOBILE_BASE);

    await apiFetch('/api/worklogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer a.jwt.token');
    expect(init.method).toBe('POST');
  });

  it('does not overwrite an Authorization header the caller already set', async () => {
    storedToken.current = 'stored.jwt.token';
    const { apiFetch } = await loadApiClient(MOBILE_BASE);

    await apiFetch('/api/me', { headers: { Authorization: 'Bearer explicit.token' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer explicit.token');
  });

  it('leaves absolute URLs (e.g. Vercel Blob assets) unrewritten', async () => {
    const { apiFetch } = await loadApiClient(MOBILE_BASE);

    await apiFetch('https://blob.vercel-storage.com/photo.jpg');

    expect(fetchMock.mock.calls[0][0]).toBe('https://blob.vercel-storage.com/photo.jpg');
  });
});

describe('lib/mobile-auth on a non-native platform', () => {
  it('is a safe no-op, so web and SSR can call it unconditionally', async () => {
    // Setting a token makes the file-level mock answer true/'a.jwt.token', so
    // these assertions can only pass against the real module.
    storedToken.current = 'mock.would.return.this';
    vi.resetModules();
    vi.doUnmock('@/lib/mobile-auth');
    const mobileAuth = await import('@/lib/mobile-auth');

    // No Capacitor native shell in the test environment.
    expect(await mobileAuth.isMobileApp()).toBe(false);
    expect(await mobileAuth.getMobileToken()).toBeNull();
    await expect(mobileAuth.setMobileToken('a.jwt.token')).resolves.toBeUndefined();
    await expect(mobileAuth.clearMobileToken()).resolves.toBeUndefined();
  });
});
