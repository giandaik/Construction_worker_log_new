/**
 * Feature flags — pure registry + resolvers.
 *
 * No React, no next/headers, no server-only imports: safe to import from
 * middleware (edge), route handlers, server/client components, and tests.
 *
 * Resolution order: dev cookie override -> NEXT_PUBLIC_ env var -> code default.
 * Cookie overrides are honored ONLY outside production, so prod users cannot
 * enable experimental features by guessing a ?ff_<key> URL param.
 */

export const FLAG_KEYS = ['riskSignal'] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export interface FlagDefinition {
  /** Value used when neither the override nor the env var applies. */
  readonly default: boolean;
  /** process.env var name. NEXT_PUBLIC_ prefix makes it client-readable. */
  readonly env: string;
  readonly description: string;
}

export const FLAGS: Record<FlagKey, FlagDefinition> = {
  riskSignal: {
    default: false,
    env: 'NEXT_PUBLIC_FEATURE_RISK_SIGNAL',
    description: 'Delay-risk signal panel + GET /api/projects/[id]/risk',
  },
};

export function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const FALSY = new Set(['0', 'false', 'no', 'off']);

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const value = raw.trim().toLowerCase();
  if (TRUTHY.has(value)) return true;
  if (FALSY.has(value)) return false;
  return fallback;
}

/**
 * Read an `ff_<key>=1|0` override from a cookie header.
 * Returns undefined when absent or malformed.
 */
export function parseFlagOverride(
  cookieHeader: string | null,
  key: FlagKey,
): boolean | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)ff_${key}=(1|0)(?:;|$)`));
  return match ? match[1] === '1' : undefined;
}

/**
 * Collect `?ff_<key>=1|0` overrides from query params (middleware input).
 * Only known keys with a strict 1|0 value are returned.
 */
export function flagOverridesFromQuery(
  searchParams: URLSearchParams,
): Partial<Record<FlagKey, '1' | '0'>> {
  const result: Partial<Record<FlagKey, '1' | '0'>> = {};
  for (const key of FLAG_KEYS) {
    const value = searchParams.get(`ff_${key}`);
    if (value === '1' || value === '0') result[key] = value;
  }
  return result;
}

export function resolveFlag(
  key: FlagKey,
  opts: { override?: boolean; envValue?: string } = {},
): boolean {
  if (typeof opts.override === 'boolean') return opts.override;
  const definition = FLAGS[key];
  const envValue =
    opts.envValue !== undefined ? opts.envValue : process.env[definition.env];
  return parseBool(envValue, definition.default);
}

/** Pure: env + default only (no cookie). Deterministic in tests. */
export function isEnabled(key: FlagKey): boolean {
  return resolveFlag(key);
}

/** Route-handler gate: honors a dev-only cookie override read off the request. */
export function isEnabledForRequest(key: FlagKey, request: Request): boolean {
  const override = isDev()
    ? parseFlagOverride(request.headers.get('cookie'), key)
    : undefined;
  return resolveFlag(key, { override });
}
