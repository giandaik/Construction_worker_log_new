# Onboarding — Construction Worker Daily Log

> Authored 2026-06-11 from a hands-on codebase walk, not from `/understand`. If the graph-based dashboard is later generated (`/understand-anything:understand`), prefer that for navigation; this doc covers the parts a graph won't tell you (intent, conventions, gotchas).

## Project Overview

- **Name**: `construction-app` (private)
- **Purpose**: Daily work-log app for construction sites — workers fill in personnel/equipment/materials/weather/notes, attach photos and DWG drawings, collect e-signatures, export PDFs. Offline-first.
- **Language**: TypeScript (strict)
- **Framework**: Next.js 15 (App Router, RSC)
- **Persistence**: MongoDB via the official `mongodb` driver and `mongoose` (both present — see Gotchas)
- **Auth**: JWT via `jose`, HTTP-only session cookie (`cw_session`), session validated in `middleware.ts` and `utils/auth.ts`
- **UI**: Tailwind CSS + shadcn/ui (Radix primitives) + `lucide-react`
- **Forms**: `react-hook-form` + `zod` (`@hookform/resolvers`)
- **Toasts**: `sonner`
- **File storage**: Vercel Blob (`@vercel/blob`) for photos, DWGs, and companion PDFs
- **Offline storage**: IndexedDB (custom helper in `lib/indexedDBHelper.ts`)
- **PDF generation**: `jspdf` with embedded Roboto font (`app/fonts/Roboto-Regular.js`)
- **Email**: `nodemailer` over Gmail SMTP (signature/completion notifications)
- **Tests**: Vitest + Testing Library; integration tests in `__tests__/`

### README vs reality

`README.md` and `CLAUDE.md` partially describe a *legacy* Vite + Firebase + Express stack. The codebase has moved to Next.js 15 App Router + MongoDB + JWT. The `CLAUDE.md` "Important Notes" section is the authoritative summary — trust it, not the upper Tech Stack list.

## Architecture Layers

The code is organized by Next.js convention (`app/`, `components/`, `lib/`, `hooks/`, `types/`) with a clear horizontal split inside `lib/`:

### 1. App shell (`app/`)
Next.js App Router pages and API routes. Pages are mostly `"use client"` because they own form state and offline behavior.

- `app/layout.tsx` — root layout, providers (theme, session, toaster, sync manager)
- `app/page.tsx` — home dashboard
- `app/error.tsx` — global error boundary
- `app/login/page.tsx` — login form
- `app/projects/`, `app/projects/[id]/` — project list + detail (DWG management lives here)
- `app/worklogs/`, `app/worklogs/[id]/`, `app/worklogs/[id]/edit/` — list, detail, edit pages
- `app/forms/new/page.tsx` — new worklog page
- `app/api/**` — REST endpoints (see API map below)
- `app/fonts/Roboto-Regular.js` — base64 font blob used by `jspdf`

### 2. Auth boundary (`middleware.ts`, `utils/auth.ts`)
- `middleware.ts` gates all routes except login/signup/static. Verifies `cw_session` cookie via `jose`.
- `utils/auth.ts` exports `getAuthUser()`, `setSessionCookie()`, `clearSessionCookie()`, `isAdmin()`, `canModify()`. **`isAdmin` returns true for both `admin` and `manager` roles** — used as the supervisor gate.

### 3. Data layer (`lib/models/`, `lib/schemas/`, `lib/repositories/`)
Three concentric layers:

| Layer | Purpose | Used by |
|---|---|---|
| `lib/models/*.ts` | Mongoose schemas (`Project`, `User`, `WorkLog`) — current DB shape | Routes that still go through mongoose |
| `lib/schemas/*.ts` | Zod schemas (`projectSchema`, `workLogSchema`, `userSchema`) — input validation | API routes parsing request bodies |
| `lib/repositories/*Repository.ts` | Direct mongodb-driver access wrapped in a `BaseRepository<T>` pattern | Newer API routes (most worklogs/projects endpoints) |
| `lib/repositories/RepositoryFactory.ts` | `withWorkLogRepository`, `withProjectRepository`, `withUserRepository` callback wrappers that handle the DB connection | All callers |

There are **two database access paths** — repository pattern (preferred for new code) and direct mongoose/mongodb. The migration is partial; some routes still call `db.collection(...)` directly (e.g., `app/api/worklogs/route.ts` POST handler — there's a tracked refactor to clean this up: `CWL-okocxtht`).

### 4. UI primitives (`components/ui/`)
shadcn-generated components: `button`, `card`, `dialog`, `input`, `label`, `select`, `tabs`, `textarea`, `skeleton`, `alert`, `form`, `table`, `toaster`. Don't hand-edit these unless you know what you're doing.

### 5. Domain components (`components/`, `components/forms/`)
- `WorkLogForm.tsx` — the canonical new-worklog form (467 lines, uses `useWorkLogForm` hook + `ArrayField`/`FormField`/`Combobox`)
- `components/forms/PhotoUpload.tsx` — multi-file image picker with client-side resize + offline `data:` URL fallback
- `components/forms/DwgUpload.tsx` — admin/supervisor DWG + companion-PDF upload
- `components/forms/DwgPicker.tsx` — worker-side read-only DWG selector
- `SignatureSection.tsx`, `SignaturePad.tsx` — e-signature capture
- `SyncManager.tsx`, `PendingSubmissions.tsx` — offline sync UI
- `ErrorBoundary.tsx`, `auth-context.tsx`, `session-provider.tsx`, `theme-provider.tsx` — app-wide wrappers

### 6. Hooks (`hooks/`)
- `useWorkLogForm.ts` — form state for the create form (array helpers, seeding from previous log)
- `useOfflineSync.ts` — orchestrates online/offline submit + IndexedDB queue
- `useOnlineStatus.ts` — `navigator.onLine` listener
- `useCurrentUser.ts` — fetches `/api/me`
- `useProjectRole.ts` — derives `owner`/`contractor`/null role for a user on a project (drives signature gating)
- `useSuggestions.ts` — autocomplete options from prior worklogs on the same project
- `useToast.ts`, `useErrorHandler.ts` — UI plumbing

### 7. Offline pipeline (`lib/indexedDBHelper.ts`, `lib/syncService.ts`)
- IndexedDB store: `pendingWorkLogs` (objects with `tempId`)
- On submit while offline: payload (including base64 `data:` image URLs) is queued
- On reconnect: `syncService.replayPending()` pre-uploads `data:` URLs to Vercel Blob, swaps in HTTPS URLs, then POSTs the worklog
- `SyncManager.tsx` listens for `online`/`offline` events and triggers replay

### 8. Email (`lib/email/`)
- `sendEmail.ts` — Gmail SMTP transport, two functions: `sendSignatureNotificationEmail`, `sendWorkLogCompletedEmail`
- `lib/email/templates/` — HTML/text templates (signature notification, completion)
- Completion email attaches a generated PDF via `createWorkLogPdfAttachment` from `app/worklogs/[id]/exportToPDF.ts`

### 9. Constants & utils (`lib/constants/`, `lib/utils.ts`, `lib/imageResize.ts`, `lib/signatureUtils.ts`)
- `lib/constants/constants.ts` — page sizes, toast durations, file size limits, session cookie name, form defaults
- `lib/constants/constantValues.ts` — UI labels (mostly Greek), status enum (`FORM_STATUS`), status classes/labels
- `lib/utils.ts` — `cn()` tailwind merge helper
- `lib/imageResize.ts` — Canvas-based JPEG resize + `data:` URL helpers + Vercel Blob upload
- `lib/signatureUtils.ts` — signature ordering rules (contractor signs first, owner second), validation, status derivation

## Key Concepts

### Roles
Three roles live on the `User` document: `worker` (default), `manager` (supervisor), `admin`. `isAdmin()` treats `admin` and `manager` identically. Workers can create/edit their own logs and pick DWGs; admin/supervisors can manage projects and upload DWGs.

### Signature flow (`lib/signatureUtils.ts`)
Each project has an `ownerUserId` and `contractorUserId`. Signing must happen in a specific order: **contractor first, then owner**. The owner signature only unlocks after the contractor has signed (see `useProjectRole` + `canUserAddSignature` in `SignatureSection.tsx`). Status transitions:
- 0 signatures → `pending`
- 1 signature → `in-progress` (or similar — see `getWorkLogStatusFromSignatures`)
- 2 signatures → `completed`, triggers completion email with PDF attachment

### Photos (offline-first)
1. User picks file → resized client-side (`lib/imageResize.ts`, max 2000 px, 0.85 JPEG quality)
2. Held as `data:` URL in form state
3. **If offline** → stored in IndexedDB with the worklog payload
4. **At submit (or reconnect)** → `uploadImageBlob()` posts to `/api/upload`, returns HTTPS Vercel Blob URL; the URL replaces the `data:` URL before the worklog POST
5. DB only ever stores HTTPS URLs (see `images: string[]` on `WorkLog`)

### DWG attachments
- DWGs and an optional companion **PDF** (workers preview on phones) are uploaded at the project level by admin/supervisors via `/api/upload/dwg` and `/api/upload/pdf`, then attached with `POST /api/projects/[id]/dwgs`
- Each `WorkLog` references a *subset* of project DWGs by URL (`dwgRefs: string[]`)
- The detail page joins `dwgRefs` against `project.dwgFiles` at read time to resolve filenames (degrades gracefully if a drawing was removed from the project)
- DELETE on the project DWG is best-effort against Vercel Blob — DB is authoritative
- 25 MB cap per file (vs 8 MB for photos)

### Validation: Zod everywhere on the boundary
API routes parse incoming JSON with `lib/schemas/*Schema.ts`. Mongoose schemas in `lib/models/` are the persistence shape — usually a superset (e.g., timestamps). Don't trust the client; always re-validate at the route.

### FP Issue tracking
The project uses `fp` (not GitHub issues) for task tracking — see `FP_CLAUDE.md`. Run `fp issue list --status todo` to see open work. There's already a structured roadmap (CWL-hxzxytmd "Phase 3", CWL-okqrinkd "Phase 4", CWL-hluuxgsp "Phase 5", CWL-mykzicus "Phase 6"). All commits should be assigned to issues (`fp issue assign <id> --rev <commit>`).

## API Map

All routes are gated by `getAuthUser()` unless noted.

| Method | Path | Purpose | Role |
|---|---|---|---|
| POST | `/api/login` | Issue JWT, set `cw_session` cookie | public |
| POST | `/api/logout` | Clear session cookie | any |
| GET | `/api/me` | Current user | any |
| GET | `/api/auth/me` | Alias of `/api/me` | any |
| GET/POST | `/api/users` | List users / create user (⚠ password hashing is unsalted SHA-256 — see Gotchas) | admin |
| GET/POST | `/api/projects` | List/create projects | any/admin |
| GET | `/api/projects/[id]` | Project detail (includes `dwgFiles`) | any |
| GET | `/api/projects/default` | Bootstrap default project | any |
| POST/DELETE | `/api/projects/[id]/dwgs` | Attach/remove DWG | admin |
| GET/POST | `/api/worklogs` | List recent / list by project / create | any |
| GET/PUT/DELETE | `/api/worklogs/[id]` | Single worklog ops | any (owner check) |
| GET | `/api/worklogs/last?project=ID` | Most recent worklog for seed | any |
| GET | `/api/suggestions` | Autocomplete suggestions | any |
| POST | `/api/upload` | Photo upload to Vercel Blob (8 MB, JPEG/PNG/WebP) | any |
| POST | `/api/upload/dwg` | DWG upload (25 MB) | admin |
| POST | `/api/upload/pdf` | DWG companion PDF upload (25 MB) | admin |

## Guided Tour (recommended reading order)

1. **README.md + CLAUDE.md** — Mental model. Note the README/CLAUDE drift (CLAUDE.md is authoritative).
2. **`app/layout.tsx` → `middleware.ts` → `utils/auth.ts`** — How a request is authenticated. Notice the JWT secret length validation.
3. **`lib/models/WorkLog.ts` → `lib/schemas/workLogSchema.ts` → `types/shared.d.ts`** — The domain model (and its drift; see Gotchas).
4. **`app/api/worklogs/route.ts`** — Read GET (uses RepositoryFactory cleanly) and POST (the messier one that bypasses the abstraction). This shows both DB access styles in one file.
5. **`lib/repositories/base/BaseRepository.ts` + `WorkLogRepository.ts`** — How the repository pattern is wired and why `findByIdWithDetails` uses one aggregation pipeline instead of three queries.
6. **`hooks/useWorkLogForm.ts` + `components/WorkLogForm.tsx`** — The create form. Understand `seedFromPrevious()` (yesterday's crew autofill) and the array-field pattern.
7. **`hooks/useOfflineSync.ts` + `lib/syncService.ts` + `lib/indexedDBHelper.ts`** — The offline pipeline. Trace a submit while offline → IndexedDB → reconnect → blob upload → POST.
8. **`components/forms/PhotoUpload.tsx` + `lib/imageResize.ts`** — Client-side resize and the `data:` URL → HTTPS swap.
9. **`components/SignatureSection.tsx` + `lib/signatureUtils.ts` + `hooks/useProjectRole.ts`** — Signature ordering and gating logic.
10. **`app/worklogs/[id]/page.tsx` + `app/worklogs/[id]/exportToPDF.ts`** — The detail/render path and PDF generation. The PDF code is the largest single file.
11. **`app/projects/[id]/page.tsx` + `components/forms/DwgUpload.tsx` + `components/forms/DwgPicker.tsx`** — DWG management (admin upload, worker pick).
12. **`__tests__/verify-dwg.test.ts`** — A good example of how the team writes integration tests with `mongodb-memory-server`.

## File Map (essentials)

### Entry points
- `app/layout.tsx`, `app/page.tsx`, `middleware.ts`

### Largest / most complex files
| File | Lines | Why it matters |
|---|---|---|
| `app/worklogs/[id]/edit/page.tsx` | 533 | Edit page — duplicates much of the create form (refactor tracked in `CWL-djexrjfg`) |
| `app/worklogs/[id]/page.tsx` | 509 | Detail page — Personnel/Equipment/Materials/Photos/DWGs/Notes/Signatures |
| `components/WorkLogForm.tsx` | 467 | Create form, uses `useWorkLogForm` + `ArrayField` |
| `app/worklogs/[id]/exportToPDF.ts` | 443 | PDF generation god-function (`buildWorkLogPdfDoc`) — split tracked in `CWL-rcjpwtkv` |
| `app/worklogs/page.tsx` | 354 | Filter + list with URL-synced query params |
| `lib/repositories/WorkLogRepository.ts` | 308 | Repository with aggregation pipeline join |
| `components/forms/DwgUpload.tsx` | 296 | Admin DWG + PDF upload + draft UI |
| `hooks/useWorkLogForm.ts` | 259 | Form state with array handlers (collapse tracked in `CWL-ocpfiepl`) |

## Complexity Hotspots (approach with care)

- **`app/worklogs/[id]/exportToPDF.ts`** — 340-line `buildWorkLogPdfDoc` mutates a shared `y` cursor and page-break state across sections. Every edit risks visual regressions in exported PDFs. Don't touch without manually rendering before/after.
- **`app/api/worklogs/route.ts` POST** — Has a known shadowed-variable bug + duplicate DB lookup (`CWL-phhapqet`). Don't paper over with another conditional; fix the structure.
- **`components/SignatureSection.tsx`** — Mixed concerns: UI + role-gating logic + state. Logs PII to console (`CWL-snjospzo`). The `canUserAddSignature` helper is typed `any` and inline (`CWL-wupippll`).
- **Two database access patterns** — The repository pattern is half-rolled-out. New routes should use `RepositoryFactory.withXRepository(...)`. If you see `db.collection(...)` directly, that's legacy.
- **Type drift on `Personnel` / `Equipment` / `Material` / `Signature`** — Four independent copies exist across `types/shared.d.ts`, `WorkLogRepository.ts`, detail page, and exportToPDF (`CWL-zncnypju`). The PDF export property mismatch (`role` vs `projectRole`) is an active bug (`CWL-xodqvrbd`).

## Gotchas

1. **Password hashing is unsalted SHA-256.** `bcryptjs` is installed but unused. Tracked open in `CWL-gupyodxk` — don't go to production until this is fixed.
2. **Two MongoDB clients**: `mongoose` (models) and the official `mongodb` driver (repositories). Don't add a third pattern; converge on the repository abstraction.
3. **README is partly wrong.** The Vite/Firebase/Express description is legacy. `CLAUDE.md` has the actual stack notes.
4. **Photo storage requires `BLOB_READ_WRITE_TOKEN`** — Vercel dashboard → Storage → Blob Store. Without it photo uploads silently 500.
5. **Email requires `GMAIL_USER` + `GMAIL_APP_PASSWORD`.** Missing config logs a warning and silently disables emails — won't break the request.
6. **JWT secret must be ≥32 chars.** `validateJWTSecret()` throws if shorter; this also throws if `NEXT_JWT_SECRET` is unset. Set it in `.env.local`.
7. **`getAuthUser()` swallows verification errors and returns null** — so an expired token looks the same as no token. That's intentional (redirect to login) but be aware when debugging.
8. **Worker locale is mixed** — UI placeholders are Greek (`Εργάτης`, `Σκυρόδεμα`), but `DEFAULT_PERSONNEL/EQUIPMENT/MATERIAL` constants are in English (`'Worker'`, `'Concrete'`). Tracked in `CWL-uobsipzf`.
9. **`alert()` / `confirm()` still in use** — `SignatureSection.tsx` and `app/worklogs/[id]/page.tsx`. Prefer `sonner` + `Dialog` for new code.
10. **Tests use `mongodb-memory-server`** — integration tests boot a real Mongo binary in-process. First run on a new machine downloads the binary (~100 MB). See `__tests__/verify-dwg.test.ts` for the standard pattern.

## Where to look when you need to…

| Need | Start here |
|---|---|
| Add a field to the worklog | `lib/schemas/workLogSchema.ts` → `lib/models/WorkLog.ts` → `lib/repositories/WorkLogRepository.ts` → `hooks/useWorkLogForm.ts` → `components/WorkLogForm.tsx` AND `app/worklogs/[id]/edit/page.tsx` (until `CWL-djexrjfg` lands) → `app/worklogs/[id]/page.tsx` → `app/worklogs/[id]/exportToPDF.ts` |
| Change PDF output | `app/worklogs/[id]/exportToPDF.ts` (be careful — see hotspot) |
| Add a new API route | `app/api/<path>/route.ts`, wrap handler in `try { … } catch (e) { return ApiError.handle(e) }`, use `RepositoryFactory.withXRepository` |
| Add an offline-safe submission | Extend `useOfflineSync.ts`, register a payload shape in `lib/indexedDBHelper.ts`, replay in `lib/syncService.ts` |
| Change auth/role rules | `utils/auth.ts` + `middleware.ts` + `hooks/useProjectRole.ts` |
| Toast or alert | Always `sonner` (`import { toast } from 'sonner'`), never native `alert()` |
| Run tests | `npm test` (watch) / `npm run test:all` (run + build) |
| Lint | `npm run lint` |

## Development commands

```bash
npm run dev          # next dev on :3000
npm run build        # next build (also runs tsc)
npm run lint         # next lint
npm test             # vitest watch
npm run test:all     # vitest run + next build (the CI check)
```

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | Mongo connection string |
| `NEXT_JWT_SECRET` | yes | ≥32 chars |
| `BLOB_READ_WRITE_TOKEN` | photo/DWG uploads | Vercel Blob token |
| `GMAIL_USER` | emails | SMTP user |
| `GMAIL_APP_PASSWORD` | emails | Gmail app password |
| `GMAIL_SMTP_HOST` | optional | defaults to `smtp.gmail.com` |
| `GMAIL_SMTP_PORT` | optional | defaults to `465` |
| `RESEND_FROM_EMAIL` | optional | from-address; falls back to `GMAIL_USER` |
| `RESEND_NOTIFICATION_RECIPIENT(S)` | optional | comma-separated CC list |

---

*For the deeper graph-based view (interactive dashboard), run `/understand-anything:understand` followed by `/understand-anything:understand-dashboard`. This document covers what a graph alone won't: intent, conventions, gotchas, and the partial-migration story.*
