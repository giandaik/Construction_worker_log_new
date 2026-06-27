'use client';

import { useEffect, useState } from 'react';
import {
  type FlagKey,
  FLAGS,
  isDev,
  parseFlagOverride,
  resolveFlag,
} from './flags';

/**
 * Build-time inlined NEXT_PUBLIC_ values. Next.js only inlines statically
 * referenced process.env.NEXT_PUBLIC_* reads, so each flag must be listed here.
 * Add a line whenever a new client-readable flag is added to FLAGS.
 */
const CLIENT_ENV: Record<FlagKey, string | undefined> = {
  riskSignal: process.env.NEXT_PUBLIC_FEATURE_RISK_SIGNAL,
};

function evaluate(key: FlagKey): boolean {
  const override = isDev()
    ? parseFlagOverride(
        typeof document !== 'undefined' ? document.cookie : null,
        key,
      )
    : undefined;
  return resolveFlag(key, { override, envValue: CLIENT_ENV[key] });
}

/** Read a feature flag from a client component. */
export function useFlag(key: FlagKey): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => evaluate(key));
  useEffect(() => {
    setEnabled(evaluate(key));
  }, [key]);
  return enabled;
}

export { FLAGS };
