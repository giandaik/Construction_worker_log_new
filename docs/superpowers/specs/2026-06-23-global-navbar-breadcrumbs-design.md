# Global Navbar + Breadcrumbs — Design

- **Date:** 2026-06-23
- **Status:** Approved
- **Branch:** `feat/global-navbar-breadcrumbs`
- **Goal:** Make the home-page header render on every authenticated route, and add a breadcrumb trail showing the user's current location in the route hierarchy.

## Context

- The header currently exists **only inline in `app/page.tsx`** (home). Every other page uses ad-hoc "Back to …" buttons. No breadcrumbs.
- One shared layout (`app/layout.tsx`) wraps `AuthProvider → ThemeProvider → SyncManager + {children}`. No chrome.
- Role helpers: server `getAuthUser()` / `isAdmin()` in `utils/auth.ts`; client `useCurrentUser()` in `hooks/useCurrentUser.ts` (returns `{ user: { userId, name, email, role }, isLoading, error }`).
- Reusable client components: `components/theme-toggle.tsx` (`ThemeToggle`), `components/LogoutButton.tsx` (`LogoutButton`).
- Rich-label API routes exist: `app/api/projects/[id]/route.ts` (`.name`), `app/api/worklogs/[id]/route.ts` (`.date`).
- No Headless UI / Radix installed; icons via `lucide-react`. Existing header is responsive via `flex-wrap` + `hidden sm:inline` labels — no hamburger.

## Approach: client `AppShell` in the root layout

Add a single client component to `app/layout.tsx`. It renders `Navbar + Breadcrumbs + <main>{children}</main>` and hides chrome on public routes (`/login`, `/signup`). No file moves; pages stay server-rendered (passed as `children`), so this does not regress the existing server-rendered home page.

## Components (new)

| File | Role |
|---|---|
| `components/layout/navConfig.ts` | nav link list + role predicate (shared) |
| `components/layout/Navbar.tsx` | brand + role-aware links + actions; responsive via `flex-wrap` |
| `components/layout/Breadcrumbs.tsx` | `usePathname()` trail + rich labels |
| `components/layout/AppShell.tsx` | gates chrome on public routes |

## Navbar

- **Brand:** HardHat icon + title (matches current home header).
- **Links** (role-aware via `useCurrentUser().role`): Home `/` (all) · Work Logs `/worklogs` (all) · Projects `/projects` (all — gate to `isAdmin` during impl if the route proves admin-only) · Admin `/admin/users` (`isAdmin` only).
- **Actions:** New Form `/forms/new` · `ThemeToggle` · `LogoutButton`.
- **Mobile:** `flex-wrap` with icon-only labels on small screens (`hidden sm:inline`), consistent with the existing header. (A hamburger menu is out of scope / optional follow-up — would need Headless UI or a hand-rolled accessible disclosure.)

## Breadcrumbs

Trail built from `usePathname()` segments; the last crumb is the current page (plain text, not a link). Dynamic segments resolve to rich labels via fetch, with graceful fallback:

| Route | Trail |
|---|---|
| `/` | Home |
| `/projects` | Home / Projects |
| `/projects/[id]` | Home / Projects / **{project name}** |
| `/projects/[id]/calendar` | Home / Projects / {name} / Calendar |
| `/worklogs/[id]` | Home / Work Logs / **{worklog date}** |
| `/worklogs/[id]/edit` | Home / Work Logs / {date} / Edit |
| `/admin/users` | Home / Admin / Users |

- Labels cached per-id in a ref so navigation does not refetch.
- Loading → muted placeholder; error/missing → generic "Detail". Never blocks render.
- Mobile: truncate to last 1–2 crumbs (`… / Work Logs / {date}`), no horizontal overflow.

## Files modified

- `app/layout.tsx` — wrap `{children}` in `<AppShell>`.
- `app/page.tsx` — remove the inline `<header>` (AppShell now provides it; avoids duplication).
- **Remove "Back to …" buttons** from: `projects/page.tsx`, `projects/[id]/page.tsx`, `projects/[id]/calendar/page.tsx`, `projects/[id]/edit/page.tsx`, `admin/projects/new/page.tsx`, `admin/users/page.tsx`, `worklogs/page.tsx`, `worklogs/[id]/page.tsx`. (Also check `worklogs/[id]/edit/page.tsx` and `forms/new/page.tsx` for any equivalent back affordance.)

## Edge cases

- Public routes (`/login`, `/signup`): no chrome.
- Role still loading: navbar renders non-gated links; `isAdmin` items appear once loaded.
- Label fetch failure: generic crumb, no crash.
- Sub-routes under a project (`calendar`, `edit`) reuse the already-fetched project name.

## Testing

- vitest units (matching `__tests__/` style): crumb segment→trail mapping (pure fn), nav-link role predicate, AppShell public-route predicate.
- `npm run lint` and `npm run build` must pass.

## Out of scope

- Changing auth / route guards.
- New dependencies.
- Hamburger mobile menu (optional follow-up).
