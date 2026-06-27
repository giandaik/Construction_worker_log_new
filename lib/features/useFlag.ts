'use client';

import { type FlagKey, FLAGS, isDev, parseFlagOverride, resolveFlag } from './flags';

/**
 * Build-time inlined NEXT_PUBLIC_ values. Next.js only inlines statically
 * referenced process.env.NEXT_PUBLIC_* reads, so each flag must be listed here.
 * Add a line whenever a new client-readable flag is added to FLAGS.
 */
const CLIENT_ENV: Record<FlagKey, string | undefined> = {
  riskSignal: process.env.NEXT_PUBLIC_FEATURE_RISK_SIGNAL,
};

/**
 * Read a feature flag from a client component.
 *
 * Computed during render (no state/effect): the value only changes on
 * navigation or reload (the middleware sets the override cookie before the
 * page loads), so there is nothing to reactively subscribe to.
 */
export function useFlag(key: FlagKey): boolean {
  const override = isDev()
    ? parseFlagOverride(
        typeof document !== 'undefined' ? document.cookie : null,
        key,
      )
    : undefined;
  return resolveFlag(key, { override, envValue: CLIENT_ENV[key] });
}

export { FLAGS };
