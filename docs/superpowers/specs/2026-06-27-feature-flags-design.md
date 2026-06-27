# Feature Flags Mechanism — Design

**Date:** 2026-06-27
**Branch:** `feat/feature-flags`
**Status:** Approved

## Goal

Add a general-purpose feature-flag mechanism to the app, and use it to ship the existing **delay-risk signal** (currently on `feat/delay-risk-data-model`) onto `main` behind a flag that defaults **OFF**. Flags let us land and toggle experimental features without code changes per toggle, and without exposing unfinished work to users.

## Non-goals (YAGNI)

- DB-backed / admin-UI flags. The evaluation API is designed so a Mongo override layer can slot in later without changing call sites, but it is **not** built now.
- Per-user / per-role / per-project targeting. Global on/off only for v1.

## Control model

Flags live in a **typed registry**. Resolution order:

1. **Dev cookie override** (`ff_<key>=1|0`) — honored **only** when `NODE_ENV !== 'production'`.
2. **Env var** — `NEXT_PUBLIC_FEATURE_<KEY>` (the `NEXT_PUBLIC_` prefix makes client components and the build able to read it).
3. **Code default** — the boolean in the registry.

In production the cookie layer is bypassed entirely, so only env/deploy can change a flag. This prevents prod users from enabling experimental features by guessing a `?ff_` query param.

## File layout

| File | Responsibility |
|---|---|
| `lib/features/flags.ts` | Pure registry + `resolveFlag(key, opts)`. No `next/headers`. Importable anywhere, including middleware and tests. |
| `lib/features/server.ts` | `isEnabledServer(key)` — async; reads the dev cookie via `next/headers`, then `resolveFlag`. For server components + API routes. |
| `lib/features/useFlag.ts` | `'use client'` hook `useFlag(key)` — build-time `NEXT_PUBLIC_` value + `document.cookie` in dev. For client-only gating. |
| `middleware.ts` (modified) | In non-prod, `?ff_<key>=1\|0` query params matching known keys set a `ff_<key>` cookie, then proceed. |
| `__tests__/verify-feature-flags.test.ts` | `resolveFlag` precedence, prod-ignores-cookie, registry shape, risk API 404-when-off / 200-when-on. |

### Convenience entry point

`isEnabled(key)` — pure helper, env + default only (no cookie). Deterministic in vitest. Used by tests and anywhere the cookie isn't relevant.

## Registry shape

```ts
export const FLAG_KEYS = ['riskSignal'] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

interface FlagDefinition {
  default: boolean;
  env: string;            // process.env var name; NEXT_PUBLIC_ if client-readable
  description: string;
}

export const FLAGS: Record<FlagKey, FlagDefinition> = {
  riskSignal: {
    default: false,
    env: 'NEXT_PUBLIC_FEATURE_RISK_SIGNAL',
    description: 'Delay-risk panel + GET /api/projects/[id]/risk',
  },
};

export function resolveFlag(
  key: FlagKey,
  opts?: { env?: string; override?: boolean },
): boolean;
```

Adding a future flag = one entry in `FLAGS` + one env var. Call sites never change shape.

## Gating the delay-risk signal (worked example)

The risk branch is a clean 6-commit fast-forward of `main`, so bringing it in is conflict-free.

1. Create `feat/feature-flags` off `main`; fast-forward-merge `feat/delay-risk-data-model` in.
2. **API gate** — top of `app/api/projects/[id]/risk/route.ts`:
   ```ts
   if (!(await isEnabledServer('riskSignal'))) {
     return NextResponse.json({ error: 'Not Found' }, { status: 404 });
   }
   ```
   **404, not 403** — a hidden feature's existence must not be leaked by a distinct status code.
3. **UI gate** — `app/projects/[id]/page.tsx` renders `<RiskSignal>` only when the flag is on (server-side `isEnabledServer`). When off: nothing renders, and a direct endpoint call 404s.
4. Net effect: the risk feature lands on `main` but stays invisible/off until `NEXT_PUBLIC_FEATURE_RISK_SIGNAL=true` (or a local `?ff_riskSignal=1` cookie in dev).

## Defaults chosen

- Dev cookie override is **ignored in production**.
- Hidden endpoint returns **404**, not 403 (no existence leak).

## Testing

Follow the repo's `verify-*.test.ts` convention:

- `resolveFlag` precedence: override > env > default.
- Prod ignores cookie override.
- Registry shape (every `FLAG_KEYS` has a definition; env names are `NEXT_PUBLIC_`-prefixed where client-readable).
- Risk API: **404 when flag off, 200 when on** (toggle via `process.env` in the test).

## Branch / merge

- All work on `feat/feature-flags` (off `main`).
- Risk code brought in via clean fast-forward of `feat/delay-risk-data-model`.
- Nothing merges to `main` until requested. Since `riskSignal` defaults OFF, merging is safe (no user-visible change).
