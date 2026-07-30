/**
 * Phase 2 (Capacitor): API base URL + CORS.
 *
 * `lib/apiClient.ts` reads `NEXT_PUBLIC_API_BASE_URL` once at module load, so
 * every case here stubs the env and re-imports the module.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function loadApiClient(baseUrl?: string) {
  vi.resetModules();
  if (baseUrl === undefined) {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '');
  } else {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', baseUrl);
  }
  return import('@/lib/apiClient');
}

describe('apiUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('leaves paths untouched when no base URL is configured (web)', async () => {
    const { apiUrl } = await loadApiClient();
    expect(apiUrl('/api/projects')).toBe('/api/projects');
    expect(apiUrl('/api/worklogs?project=abc')).toBe('/api/worklogs?project=abc');
  });

  it('prefixes the base URL when one is configured (mobile)', async () => {
    const { apiUrl } = await loadApiClient('https://example.vercel.app');
    expect(apiUrl('/api/projects')).toBe('https://example.vercel.app/api/projects');
  });

  it('never produces a double slash, whatever the trailing/leading slashes', async () => {
    const { apiUrl } = await loadApiClient('https://example.vercel.app/');
    expect(apiUrl('/api/projects')).toBe('https://example.vercel.app/api/projects');
    expect(apiUrl('api/projects')).toBe('https://example.vercel.app/api/projects');
  });

  it('passes absolute and data URLs through unchanged', async () => {
    const { apiUrl } = await loadApiClient('https://example.vercel.app');
    const blobUrl = 'https://abc.public.blob.vercel-storage.com/photo.jpg';
    expect(apiUrl(blobUrl)).toBe(blobUrl);
    expect(apiUrl('http://other.test/x')).toBe('http://other.test/x');
    expect(apiUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
  });

  it('reports whether the API is cross-origin', async () => {
    expect((await loadApiClient()).isCrossOriginApi()).toBe(false);
    expect((await loadApiClient('https://example.vercel.app')).isCrossOriginApi()).toBe(true);
  });
});

describe('apiFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve(new Response('{}')));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is indistinguishable from fetch on the web', async () => {
    const { apiFetch } = await loadApiClient();
    const init = { method: 'POST', body: '{"a":1}' };
    await apiFetch('/api/worklogs', init);

    // Same path, and the init object forwarded verbatim — no injected options.
    expect(fetchMock).toHaveBeenCalledWith('/api/worklogs', init);
  });

  it('forwards a bare call with no init on the web', async () => {
    const { apiFetch } = await loadApiClient();
    await apiFetch('/api/projects');
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', undefined);
  });

  it('rewrites to the base URL and includes credentials on mobile', async () => {
    const { apiFetch } = await loadApiClient('https://example.vercel.app');
    await apiFetch('/api/projects');

    expect(fetchMock).toHaveBeenCalledWith('https://example.vercel.app/api/projects', {
      credentials: 'include',
    });
  });

  it('preserves the caller init while adding credentials on mobile', async () => {
    const { apiFetch } = await loadApiClient('https://example.vercel.app');
    await apiFetch('/api/worklogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.vercel.app/api/worklogs', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  });

  it('lets the caller override credentials', async () => {
    const { apiFetch } = await loadApiClient('https://example.vercel.app');
    await apiFetch('/api/projects', { credentials: 'omit' });

    expect(fetchMock).toHaveBeenCalledWith('https://example.vercel.app/api/projects', {
      credentials: 'omit',
    });
  });
});

describe('corsHeaders', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadCors(env: Record<string, string> = {}) {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CORS_ALLOWED_ORIGINS', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('VERCEL_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    return import('@/lib/cors');
  }

  it('allows the iOS and Android WebView origins', async () => {
    const { corsHeaders } = await loadCors();
    for (const origin of ['capacitor://localhost', 'ionic://localhost', 'http://localhost']) {
      expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBe(origin);
    }
  });

  it('echoes the origin rather than a wildcard, so credentials are usable', async () => {
    const { corsHeaders } = await loadCors();
    const headers = corsHeaders('capacitor://localhost');

    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    expect(headers['Access-Control-Allow-Origin']).not.toBe('*');
    expect(headers['Vary']).toBe('Origin');
  });

  it('advertises the methods and headers the app actually sends', async () => {
    const { corsHeaders } = await loadCors();
    const headers = corsHeaders('capacitor://localhost');

    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      expect(headers['Access-Control-Allow-Methods']).toContain(method);
    }
    expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  it('sends nothing for an unknown origin or a same-origin request', async () => {
    const { corsHeaders } = await loadCors();
    expect(corsHeaders('https://evil.test')).toEqual({});
    expect(corsHeaders(null)).toEqual({});
  });

  it('allows origins named in CORS_ALLOWED_ORIGINS', async () => {
    const { corsHeaders, isAllowedOrigin } = await loadCors({
      CORS_ALLOWED_ORIGINS: 'https://app.example.com, https://staging.example.com',
    });

    expect(isAllowedOrigin('https://app.example.com')).toBe(true);
    expect(isAllowedOrigin('https://staging.example.com')).toBe(true);
    expect(corsHeaders('https://other.example.com')).toEqual({});
  });

  it("allows the Vercel deployment's own origin", async () => {
    const { isAllowedOrigin } = await loadCors({ VERCEL_URL: 'my-app-abc123.vercel.app' });
    expect(isAllowedOrigin('https://my-app-abc123.vercel.app')).toBe(true);
  });

  it('rejects arbitrary localhost ports in production but allows them in dev', async () => {
    expect((await loadCors()).isAllowedOrigin('http://localhost:3000')).toBe(false);

    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const dev = await import('@/lib/cors');
    expect(dev.isAllowedOrigin('http://localhost:3000')).toBe(true);
  });

  it('answers a preflight with 204 and the CORS headers', async () => {
    const { preflightResponse } = await loadCors();
    const response = preflightResponse('capacitor://localhost');

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('capacitor://localhost');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('copies headers onto an existing response', async () => {
    const { applyCorsHeaders } = await loadCors();
    const response = applyCorsHeaders(
      new Response('{"error":"Unauthorized"}', { status: 401 }),
      'capacitor://localhost',
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('capacitor://localhost');
  });
});
