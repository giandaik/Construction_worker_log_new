import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { renderHook } from '@testing-library/react';
import { useFlag } from '../lib/features/useFlag';
import {
  FLAGS,
  FLAG_KEYS,
  resolveFlag,
  isEnabled,
  parseFlagOverride,
  flagOverridesFromQuery,
  isEnabledForRequest,
  type FlagKey,
} from '../lib/features/flags';

// NODE_ENV is read-only in this project's types; use vi.stubEnv to flip it.
// The flag env var uses a dynamic key, so direct assign/delete is fine.
const FLAG_ENV = FLAGS.riskSignal.env;

describe('feature flag registry', () => {
  it('exposes the riskSignal flag with a NEXT_PUBLIC_ env name', () => {
    expect(FLAG_KEYS).toContain('riskSignal');
    expect(FLAGS.riskSignal.default).toBe(false);
    expect(FLAGS.riskSignal.env).toMatch(/^NEXT_PUBLIC_/);
    expect(FLAGS.riskSignal.description).toBeTruthy();
  });
});

describe('resolveFlag precedence (override > env > default)', () => {
  const key: FlagKey = 'riskSignal';

  afterEach(() => {
    delete process.env[FLAG_ENV];
  });

  it('returns the override when provided (true)', () => {
    expect(resolveFlag(key, { override: true })).toBe(true);
  });

  it('returns the override when provided (false), even if env is on', () => {
    process.env[FLAG_ENV] = 'true';
    expect(resolveFlag(key, { override: false })).toBe(false);
  });

  it('parses truthy env values ("1","true","yes","on")', () => {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'on']) {
      process.env[FLAG_ENV] = v;
      expect(resolveFlag(key), `env=${v}`).toBe(true);
    }
  });

  it('parses falsy env values ("0","false","no","off")', () => {
    for (const v of ['0', 'false', 'no', 'off']) {
      process.env[FLAG_ENV] = v;
      expect(resolveFlag(key), `env=${v}`).toBe(false);
    }
  });

  it('falls back to default when env is unset', () => {
    delete process.env[FLAG_ENV];
    expect(resolveFlag(key)).toBe(false);
  });

  it('falls back to default when env is garbage', () => {
    process.env[FLAG_ENV] = 'maybe';
    expect(resolveFlag(key)).toBe(false);
  });

  it('isEnabled() mirrors resolveFlag() without an override', () => {
    process.env[FLAG_ENV] = 'true';
    expect(isEnabled(key)).toBe(true);
  });
});

describe('parseFlagOverride (cookie read)', () => {
  it('reads ff_riskSignal=1', () => {
    expect(parseFlagOverride('ff_riskSignal=1', 'riskSignal')).toBe(true);
  });
  it('reads ff_riskSignal=0 mid-header', () => {
    expect(parseFlagOverride('other=1; ff_riskSignal=0', 'riskSignal')).toBe(false);
  });
  it('returns undefined when absent', () => {
    expect(parseFlagOverride('foo=bar', 'riskSignal')).toBeUndefined();
  });
  it('returns undefined for empty header', () => {
    expect(parseFlagOverride(null, 'riskSignal')).toBeUndefined();
  });
  it('ignores malformed values', () => {
    expect(parseFlagOverride('ff_riskSignal=yes', 'riskSignal')).toBeUndefined();
  });
});

describe('flagOverridesFromQuery (middleware input)', () => {
  it('collects only known keys with 1|0', () => {
    const sp = new URLSearchParams('ff_riskSignal=1&ff_unknown=1&junk=x');
    expect(flagOverridesFromQuery(sp)).toEqual({ riskSignal: '1' });
  });
  it('ignores values other than 1|0', () => {
    const sp = new URLSearchParams('ff_riskSignal=true');
    expect(flagOverridesFromQuery(sp)).toEqual({});
  });
});

describe('isEnabledForRequest', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env[FLAG_ENV];
  });

  it('honors the cookie override in non-production', () => {
    // NODE_ENV defaults to 'test' in vitest -> isDev() true
    delete process.env[FLAG_ENV];
    const req = new Request('http://x/api', {
      headers: { cookie: 'ff_riskSignal=1' },
    });
    expect(isEnabledForRequest('riskSignal', req)).toBe(true);
  });

  it('ignores the cookie override in production (falls back to env/default)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env[FLAG_ENV];
    const req = new Request('http://x/api', {
      headers: { cookie: 'ff_riskSignal=1' },
    });
    expect(isEnabledForRequest('riskSignal', req)).toBe(false);
  });
});

describe('useFlag (client hook)', () => {
  afterEach(() => {
    delete process.env[FLAG_ENV];
    document.cookie = 'ff_riskSignal=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('returns false by default (flag off)', () => {
    delete process.env[FLAG_ENV];
    const { result } = renderHook(() => useFlag('riskSignal'));
    expect(result.current).toBe(false);
  });

  it('honors a dev cookie override', () => {
    delete process.env[FLAG_ENV];
    document.cookie = 'ff_riskSignal=1; path=/';
    const { result } = renderHook(() => useFlag('riskSignal'));
    expect(result.current).toBe(true);
  });
});

describe('middleware flag cookie stamping (dev only)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stamps ff_<key> cookie from ?ff_<key>=1 in dev', async () => {
    // NODE_ENV defaults to 'test' -> dev
    const { stampFlagOverrides } = await import('../middleware-helpers');
    const res = stampFlagOverrides(
      new NextRequest('http://x/projects/1?ff_riskSignal=1'),
      new NextResponse(),
    );
    expect(res.cookies.get('ff_riskSignal')?.value).toBe('1');
  });

  it('does nothing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { stampFlagOverrides } = await import('../middleware-helpers');
    const res = stampFlagOverrides(
      new NextRequest('http://x/projects/1?ff_riskSignal=1'),
      new NextResponse(),
    );
    expect(res.cookies.get('ff_riskSignal')).toBeUndefined();
  });
});
