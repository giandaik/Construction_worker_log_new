/**
 * The cache exists so screens can paint before the network answers. These
 * tests pin the three properties that make that safe: a write is readable
 * synchronously on the next mount, a concurrent caller shares one request, and
 * an invalidation really removes the value from both layers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __resetApiCacheForTests,
  dedupe,
  freshWithin,
  invalidateCached,
  peekCached,
  writeCached,
} from '@/lib/apiCache';
import { fetchJsonCached, prefetchJson } from '@/lib/cachedApi';

vi.mock('@/lib/apiClient', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '@/lib/apiClient';

const mockedFetch = vi.mocked(apiFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('apiCache', () => {
  beforeEach(() => {
    __resetApiCacheForTests();
    mockedFetch.mockReset();
  });

  it('returns null for an unknown key', () => {
    expect(peekCached('nope')).toBeNull();
  });

  it('survives a remount by reading the written value synchronously', () => {
    writeCached('worklogs:all', [{ _id: '1' }]);
    expect(peekCached('worklogs:all')).toEqual([{ _id: '1' }]);
    expect(freshWithin('worklogs:all', 60_000)).toBe(true);
  });

  it('drops a value from both layers on invalidate', () => {
    writeCached('projects', [{ _id: 'p' }]);
    invalidateCached('projects');
    expect(peekCached('projects')).toBeNull();
    expect(window.localStorage.getItem('cw_api_v1:projects')).toBeNull();
  });

  it('treats an old write as stale', () => {
    writeCached('worklogs:all', []);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(freshWithin('worklogs:all', 60_000)).toBe(false);
    vi.useRealTimers();
  });

  it('runs one request for concurrent callers', async () => {
    const run = vi.fn(async () => {
      await Promise.resolve();
      return 'value';
    });

    const [a, b] = await Promise.all([dedupe('k', run), dedupe('k', run)]);
    expect(a).toBe('value');
    expect(b).toBe('value');
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('fetchJsonCached', () => {
  beforeEach(() => {
    __resetApiCacheForTests();
    mockedFetch.mockReset();
  });

  it('caches a successful response', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse([{ _id: 'a' }]));

    await expect(fetchJsonCached('worklogs:all', '/api/worklogs')).resolves.toEqual([{ _id: 'a' }]);
    expect(peekCached('worklogs:all')).toEqual([{ _id: 'a' }]);
  });

  it('throws and caches nothing on a failed response', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, 500));

    await expect(fetchJsonCached('worklogs:all', '/api/worklogs')).rejects.toThrow(/500/);
    expect(peekCached('worklogs:all')).toBeNull();
  });

  it('prefetch skips the request while the cache is fresh', async () => {
    writeCached('worklogs:all', []);
    prefetchJson('worklogs:all', '/api/worklogs', 60_000);
    await Promise.resolve();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('prefetch swallows a failure instead of surfacing it', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('offline'));
    expect(() => prefetchJson('worklogs:all', '/api/worklogs')).not.toThrow();
    await Promise.resolve();
  });
});
