# Feature Flags Mechanism Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed, env-backed feature-flag mechanism with a dev-only cookie override, and ship the delay-risk signal onto `main` behind a `riskSignal` flag that defaults OFF.

**Architecture:** A pure flag registry (`lib/features/flags.ts`) resolves each flag as dev-cookie-override → `NEXT_PUBLIC_` env var → code default. Route handlers resolve from the incoming request cookie (`isEnabledForRequest`); client components read a statically-inlined env map + `document.cookie` (`useFlag`). Middleware turns `?ff_<key>=1|0` query params into `ff_<key>` cookies (dev only). The existing delay-risk feature is merged in and gated at its API route (404 when off) and its UI panel (not rendered when off).

**Tech Stack:** Next.js 15 (app router, TS), vitest + @testing-library/react, jose/JWT cookies, existing `verify-*.test.ts` convention.

**Spec:** `docs/superpowers/specs/2026-06-27-feature-flags-design.md`

**fp tracking:** parent `CWL-oulvxfvx`; subissues `CWL-uisgdzdy` (registry+helpers), `CWL-mjowgocb` (middleware), `CWL-jctnupcz` (merge), `CWL-ariqidmn` (gates), `CWL-zzflxmed` (tests).

---

## Deviation from spec (called out for transparency)

The spec listed a `lib/features/server.ts` using `next/headers` for server components. **Dropped in favor of request-based resolution** (`isEnabledForRequest(key, request)` in `flags.ts`): the project detail page is a client component, so the only server-side gate is the route handler, which already holds the `request`. Reading the cookie off the request is more correct and fully unit-testable without Next's async request context. The client path still needs special handling (see Task 2).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/features/flags.ts` | Create | Pure registry + resolvers. No React, no `next/headers`. Importable in middleware, routes, tests, client. |
| `lib/features/useFlag.ts` | Create | `'use client'` hook. Statically-inlined `NEXT_PUBLIC_` map + `document.cookie` override in dev. |
| `middleware.ts` | Modify | Dev-only: `?ff_<key>=1\|0` → `ff_<key>` cookie. |
| `__tests__/verify-feature-flags.test.ts` | Create | Pure resolver tests + route-gate tests (404 off / 401 on). |
| `app/api/projects/[id]/risk/route.ts` | Modify (after merge) | Early 404 when flag off. |
| `app/projects/[id]/page.tsx` | Modify (after merge) | Render `<RiskSignal>` only when `useFlag('riskSignal')`. |
| `CLAUDE.md` | Modify | Document the feature-flags feature. |

---

## Chunk 1: The flag mechanism (registry + pure resolvers)

### Task 1: Pure registry + resolvers (`lib/features/flags.ts`)
**fp:** `CWL-uisgdzdy` · **Test:** `__tests__/verify-feature-flags.test.ts`

- [ ] **Step 1: Write failing tests** — create `__tests__/verify-feature-flags.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
  it('reads ff_riskSignal=0', () => {
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/verify-feature-flags.test.ts`
Expected: FAIL — `Cannot find module '../lib/features/flags'`.

- [ ] **Step 3: Implement `lib/features/flags.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/verify-feature-flags.test.ts`
Expected: PASS (all `feature flag` / `resolveFlag` / `parseFlagOverride` / `flagOverridesFromQuery` / `isEnabledForRequest` cases).

- [ ] **Step 5: Commit**

```bash
git add lib/features/flags.ts __tests__/verify-feature-flags.test.ts
git commit -m "feat(flags): typed flag registry + pure resolvers

Pure module (no next/headers) resolving dev-cookie > NEXT_PUBLIC_ env >
code default. Cookie override honored only outside production."
```

---

### Task 2: Client hook (`lib/features/useFlag.ts`)
**fp:** `CWL-uisgdzdy`

> **Next.js gotcha:** only statically-referenced `process.env.NEXT_PUBLIC_*` values are inlined into the client bundle. Dynamic `process.env[name]` access is `undefined` on the client, so we keep a static `CLIENT_ENV` map keyed by flag.

- [ ] **Step 1: Write failing test** — append to `__tests__/verify-feature-flags.test.ts`:

```tsx
// at top of file, add to the vitest import:
//   import { renderHook } from '@testing-library/react';
// And import the hook:
import { useFlag } from '../lib/features/useFlag';

describe('useFlag (client hook)', () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedFlag = process.env[FLAGS.riskSignal.env];

  afterEach(() => {
    process.env.NODE_ENV = savedNodeEnv;
    if (savedFlag === undefined) delete process.env[FLAGS.riskSignal.env];
    else process.env[FLAGS.riskSignal.env] = savedFlag;
    document.cookie = 'ff_riskSignal=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('returns false by default (flag off)', () => {
    process.env.NODE_ENV = 'test';
    process.env[FLAGS.riskSignal.env] = undefined;
    const { result } = renderHook(() => useFlag('riskSignal'));
    expect(result.current).toBe(false);
  });

  it('honors a dev cookie override', () => {
    process.env.NODE_ENV = 'test';
    process.env[FLAGS.riskSignal.env] = undefined;
    document.cookie = 'ff_riskSignal=1; path=/';
    const { result } = renderHook(() => useFlag('riskSignal'));
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/verify-feature-flags.test.ts`
Expected: FAIL — `Cannot find module '../lib/features/useFlag'`.

- [ ] **Step 3: Implement `lib/features/useFlag.ts`**

```ts
'use client';

import { useEffect, useState } from 'react';
import {
  FLAGS,
  type FlagKey,
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

// Re-export for convenience so consumers can import flags metadata alongside.
export { FLAGS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/verify-feature-flags.test.ts`
Expected: PASS — including the two `useFlag` cases.

- [ ] **Step 5: Commit**

```bash
git add lib/features/useFlag.ts __tests__/verify-feature-flags.test.ts
git commit -m "feat(flags): useFlag client hook (static NEXT_PUBLIC_ map + dev cookie)"
```

---

### Task 3: Middleware cookie override (`middleware.ts`)
**fp:** `CWL-mjowgocb`

- [ ] **Step 1: Write failing test** — append to `__tests__/verify-feature-flags.test.ts`:

```ts
// The pure collection logic is already covered by flagOverridesFromQuery tests.
// Here we assert middleware wires known query params onto the response cookie.
describe('middleware flag cookie stamping (dev only)', () => {
  const savedNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = savedNodeEnv;
  });

  it('helper stamps ff_<key> cookie from ?ff_<key>=1 in dev', async () => {
    process.env.NODE_ENV = 'test';
    const { stampFlagOverrides } = await import('../middleware-helpers');
    const res = stampFlagOverrides(
      new NextRequest('http://x/projects/1?ff_riskSignal=1'),
      new NextResponse(),
    );
    expect(res.cookies.get('ff_riskSignal')?.value).toBe('1');
  });

  it('helper does nothing in production', async () => {
    process.env.NODE_ENV = 'production';
    const { stampFlagOverrides } = await import('../middleware-helpers');
    const res = stampFlagOverrides(
      new NextRequest('http://x/projects/1?ff_riskSignal=1'),
      new NextResponse(),
    );
    expect(res.cookies.get('ff_riskSignal')).toBeUndefined();
  });
});
```

Imports needed at top: `import { NextRequest, NextResponse } from 'next/server';`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/verify-feature-flags.test.ts`
Expected: FAIL — `Cannot find module '../middleware-helpers'`.

- [ ] **Step 3: Create `middleware-helpers.ts`** (kept separate from `middleware.ts` so it is unit-testable — `middleware.ts` import order / edge runtime is awkward to import directly):

```ts
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
  for (const [key, value] of Object.entries(overrides)) {
    response.cookies.set(`ff_${key}`, value, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
    });
  }
  return response;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/verify-feature-flags.test.ts`
Expected: PASS — both `middleware flag cookie stamping` cases.

- [ ] **Step 5: Wire into `middleware.ts`**

Edit `middleware.ts`: import the helper and wrap each `NextResponse` return. Add at top with the other imports:

```ts
import { stampFlagOverrides } from "./middleware-helpers";
```

Then wrap every `return NextResponse...` with `stampFlagOverrides(request, ...)`. The three return points become:

```ts
// public path
return stampFlagOverrides(request, NextResponse.next());

// api 401 (no cookie)
return stampFlagOverrides(
  request,
  NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
);

// page redirect (no cookie)
const loginUrl = new URL("/login", request.url);
return stampFlagOverrides(request, NextResponse.redirect(loginUrl));

// happy path after jwtVerify
return stampFlagOverrides(request, NextResponse.next());

// catch-all 401 (jwt error)
return stampFlagOverrides(
  request,
  NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
);
```

- [ ] **Step 6: Verify build/typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add middleware.ts middleware-helpers.ts __tests__/verify-feature-flags.test.ts
git commit -m "feat(flags): dev-only ?ff_<key>=1 cookie override via middleware"
```

---

## Chunk 2: Bring in the risk feature and gate it

### Task 4: Merge the delay-risk signal onto this branch
**fp:** `CWL-jctnupcz`

The risk branch is a clean 6-commit fast-forward of `main` (verified: `main` is the merge-base, nothing diverges), so this is conflict-free.

- [ ] **Step 1: Merge**

Run: `git merge --ff-only feat/delay-risk-data-model`
Expected: fast-forward, 6 commits applied, working tree clean.

- [ ] **Step 2: Verify the risk files landed**

Run: `ls lib/features lib/risk app/api/projects/\[id\]/risk components/projects | head -40`
Expected: `lib/risk/` present, `app/api/projects/[id]/risk/route.ts` present, `components/projects/RiskSignal.tsx` present.

- [ ] **Step 3: Verify the existing risk tests + build still pass**

Run: `npx vitest run __tests__/verify-risk && npm run build`
Expected: risk tests pass; build succeeds. (Per project memory, ~29 unrelated pre-existing fails on `vitest run` are DB/auth env noise — gate on `verify-*` files + build, not the full suite.)

- [ ] **Step 4: Commit** (none — fast-forward merge brings its own commits. Skip.)

---

### Task 5: Gate the risk API route (404 when off)
**fp:** `CWL-ariqidmn` · **Test:** `__tests__/verify-feature-flags.test.ts`

- [ ] **Step 1: Write failing test** — append to `__tests__/verify-feature-flags.test.ts`:

```ts
// Mock auth + repositories so the route does not touch a real DB.
vi.mock('@/utils/auth', () => ({ getAuthUser: vi.fn() }));
vi.mock('@/lib/repositories', () => ({
  RepositoryFactory: {
    withRiskLexiconRepository: vi.fn(),
    withWorkLogRepository: vi.fn(),
  },
}));

import { GET } from '../app/api/projects/[id]/risk/route';
import { getAuthUser } from '@/utils/auth';

describe('risk API flag gate', () => {
  const savedFlag = process.env[FLAGS.riskSignal.env];

  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    if (savedFlag === undefined) delete process.env[FLAGS.riskSignal.env];
    else process.env[FLAGS.riskSignal.env] = savedFlag;
  });

  it('returns 404 when the flag is off (before auth, before DB)', async () => {
    process.env[FLAGS.riskSignal.env] = undefined; // default off
    vi.mocked(getAuthUser).mockResolvedValue({ _id: 'u1', role: 'admin' } as any);
    const res = await GET(
      new Request('http://x/api/projects/abc/risk'),
      { params: Promise.resolve({ id: 'abc' }) } as any,
    );
    expect(res.status).toBe(404);
    expect(getAuthUser).not.toHaveBeenCalled(); // gate short-circuits before auth
  });

  it('proceeds past the gate when the flag is on (auth takes over -> 401)', async () => {
    process.env[FLAGS.riskSignal.env] = 'true';
    vi.mocked(getAuthUser).mockResolvedValue(null); // unauthenticated
    const res = await GET(
      new Request('http://x/api/projects/abc/risk'),
      { params: Promise.resolve({ id: 'abc' }) } as any,
    );
    expect(res.status).toBe(401); // proves the flag gate passed; auth then denied
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/verify-feature-flags.test.ts`
Expected: FAIL — `risk API flag gate > returns 404` fails (route returns 401/200, not 404, and calls getAuthUser).

- [ ] **Step 3: Add the gate to the route** — edit `app/api/projects/[id]/risk/route.ts`:

Add imports:
```ts
import { NextResponse } from 'next/server';
import { isEnabledForRequest } from '@/lib/features/flags';
```

At the very top of the `GET` function body, before the `try` (so a disabled feature is invisible even to unauthenticated callers):
```ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isEnabledForRequest('riskSignal', request)) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }
  try {
    // ... existing body unchanged ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/verify-feature-flags.test.ts`
Expected: PASS — both `risk API flag gate` cases.

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/\[id\]/risk/route.ts __tests__/verify-feature-flags.test.ts
git commit -m "feat(flags): gate risk API behind riskSignal flag (404 when off)"
```

---

### Task 6: Gate the risk UI panel (client)
**fp:** `CWL-ariqidmn`

- [ ] **Step 1: Edit `app/projects/[id]/page.tsx`**

Add the hook import next to the existing `RiskSignal` import:
```ts
import { useFlag } from '@/lib/features/useFlag';
```

Inside `ProjectDetailPage`, add the flag read alongside the other hooks (e.g., near `const { user } = useCurrentUser();`):
```ts
const riskEnabled = useFlag('riskSignal');
```

Wrap the panel render:
```tsx
{riskEnabled && <RiskSignal projectId={project._id} />}
```
(was: `<RiskSignal projectId={project._id} />` at ~line 142.)

- [ ] **Step 2: Verify typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/projects/\[id\]/page.tsx
git commit -m "feat(flags): render risk panel only when riskSignal flag is on"
```

---

## Chunk 3: Verify + document

### Task 7: Full verification
**fp:** `CWL-zzflxmed`

- [ ] **Step 1: Run the feature-flag suite**

Run: `npx vitest run __tests__/verify-feature-flags.test.ts`
Expected: all green.

- [ ] **Step 2: Run lint + build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 3: Smoke-test the toggle locally**

```bash
NEXT_PUBLIC_FEATURE_RISK_SIGNAL=true npm run dev
```
Open a project detail page → risk panel renders. Stop, run plain `npm run dev` → panel hidden; `GET /api/projects/<id>/risk` returns 404. Add `?ff_riskSignal=1` to the URL (dev) → panel renders + endpoint 200.

- [ ] **Step 4: Mark fp subissues done** — for each of `CWL-uisgdzdy, CWL-mjowgocb, CWL-jctnupcz, CWL-ariqidmn, CWL-zzflxmed`: `fp issue update --status done <id>` and `fp issue assign <id> --rev <commit>`.

---

### Task 8: Document the feature
**fp:** parent `CWL-oulvxfvx`

- [ ] **Step 1: Add a "Feature Flags" section to `CLAUDE.md`** following the existing per-feature doc style (Files added/modified, API/usage, key design decisions, env vars). Document:
  - `lib/features/flags.ts`, `lib/features/useFlag.ts`, `middleware-helpers.ts`, `__tests__/verify-feature-flags.test.ts`.
  - Resolution order + dev-only cookie override + prod safety.
  - How to add a flag (one `FLAGS` entry + one `NEXT_PUBLIC_` env + one `CLIENT_ENV` line + a `flagOverridesFromQuery`/`parseFlagOverride` auto-coverage).
  - Env var: `NEXT_PUBLIC_FEATURE_RISK_SIGNAL` (default unset = off).
  - The `riskSignal` flag gating the risk API + panel.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(flags): document the feature-flags mechanism"
```

- [ ] **Step 3: Final parent-issue comment + status**

```bash
fp comment CWL-oulvxfvx "Feature-flags mechanism + riskSignal gate complete. All subissues done. Plan: docs/superpowers/plans/2026-06-27-feature-flags.md"
fp issue update --status done CWL-oulvxfvx
```

---

## Verification checklist (before merging to main)

- [ ] `npx vitest run __tests__/verify-feature-flags.test.ts` green.
- [ ] `npm run build` succeeds.
- [ ] `npm run lint` clean.
- [ ] With `riskSignal` unset (default), the project page shows no risk panel and the risk API 404s — i.e. landing this branch on `main` causes **zero user-visible change**.
- [ ] `gitnexus_detect_changes()` run (per project GitNexus rules) to confirm only expected symbols/flows are affected.
