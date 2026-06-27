import { describe, it, expect, afterEach } from 'vitest';
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
  const saved = process.env[FLAGS.riskSignal.env];

  afterEach(() => {
    if (saved === undefined) delete process.env[FLAGS.riskSignal.env];
    else process.env[FLAGS.riskSignal.env] = saved;
  });

  it('returns the override when provided (true)', () => {
    process.env[FLAGS.riskSignal.env] = undefined;
    expect(resolveFlag(key, { override: true })).toBe(true);
  });

  it('returns the override when provided (false), even if env is on', () => {
    process.env[FLAGS.riskSignal.env] = 'true';
    expect(resolveFlag(key, { override: false })).toBe(false);
  });

  it('parses truthy env values ("1","true","yes","on")', () => {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'on']) {
      process.env[FLAGS.riskSignal.env] = v;
      expect(resolveFlag(key), `env=${v}`).toBe(true);
    }
  });

  it('parses falsy env values ("0","false","no","off")', () => {
    for (const v of ['0', 'false', 'no', 'off']) {
      process.env[FLAGS.riskSignal.env] = v;
      expect(resolveFlag(key), `env=${v}`).toBe(false);
    }
  });

  it('falls back to default when env is unset', () => {
    process.env[FLAGS.riskSignal.env] = undefined;
    expect(resolveFlag(key)).toBe(false);
  });

  it('falls back to default when env is garbage', () => {
    process.env[FLAGS.riskSignal.env] = 'maybe';
    expect(resolveFlag(key)).toBe(false);
  });

  it('isEnabled() mirrors resolveFlag() without an override', () => {
    process.env[FLAGS.riskSignal.env] = 'true';
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
  const savedNodeEnv = process.env.NODE_ENV;
  const savedFlag = process.env[FLAGS.riskSignal.env];

  afterEach(() => {
    process.env.NODE_ENV = savedNodeEnv;
    if (savedFlag === undefined) delete process.env[FLAGS.riskSignal.env];
    else process.env[FLAGS.riskSignal.env] = savedFlag;
  });

  it('honors the cookie override in non-production', () => {
    process.env.NODE_ENV = 'test';
    process.env[FLAGS.riskSignal.env] = undefined;
    const req = new Request('http://x/api', {
      headers: { cookie: 'ff_riskSignal=1' },
    });
    expect(isEnabledForRequest('riskSignal', req)).toBe(true);
  });

  it('ignores the cookie override in production (falls back to env/default)', () => {
    process.env.NODE_ENV = 'production';
    process.env[FLAGS.riskSignal.env] = undefined;
    const req = new Request('http://x/api', {
      headers: { cookie: 'ff_riskSignal=1' },
    });
    expect(isEnabledForRequest('riskSignal', req)).toBe(false);
  });
});
