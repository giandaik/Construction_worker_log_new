import { NextRequest, NextResponse } from 'next/server';
import { flagOverridesFromQuery } from './lib/features/flags';

/**
 * In non-production, turn ?ff_<key>=1|0 query params into ff_<key> cookies so
 * a developer can toggle experimental features locally without touching env.
 * Returns the same response (mutated) for chaining.
 */
export function stampFlagOverrides(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  if (process.env.NODE_ENV === 'production') return response;
  const overrides = flagOverridesFromQuery(request.nextUrl.searchParams);
  for (const key of Object.keys(overrides) as Array<keyof typeof overrides>) {
    response.cookies.set(`ff_${key}`, overrides[key] as '1' | '0', {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
    });
  }
  return response;
}
