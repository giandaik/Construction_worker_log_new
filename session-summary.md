# Session Summary — 2026-06-11 (planning session)

## Project: Construction Worker Daily Log

A Next.js 15 web application for managing construction worker daily logs, project progress, and site documentation with role-based access control (Workers, Site Supervisors, Admins). Stack: Next.js 15 (app router), MongoDB/Mongoose, JWT/jose, Vercel Blob, Tailwind CSS.

---

## What Happened This Session

**Planning only — no code written.** Scoped three new feature initiatives and broke them into 11 atomic fp subissues. Discussed tradeoffs, locked the high-level design decisions, and queued issues in the recommended implementation order.

### Three feature initiatives scoped

| fp root | Feature | Subissues |
|---|---|---|
| **CWL-stfdsadi** | Per-project calendar view of worklog counts | 3 |
| **CWL-yapwnfum** | Upgrade `/projects` into a PM project grid with sort/filter + log counts | 3 |
| **CWL-mjmzwgxn** | Admin-managed type collections for personnel / material / equipment | 5 |

### Subissue breakdown

**CWL-stfdsadi — Per-project calendar**
- CWL-nxzflhul — API: `GET /api/projects/[id]/worklog-counts?month=YYYY-MM`
- CWL-obmxvyda — `/projects/[id]/calendar` month-grid page
- CWL-ajrzsmfb — "Calendar" link from `/projects` card and `/projects/[id]` detail

**CWL-yapwnfum — Project grid upgrade**
- CWL-dwpciyex — Backend: include `worklogCount` + `lastLogDate` on `GET /api/projects`
- CWL-kbhyhobv — Responsive 1/2/3-col grid with denser cards
- CWL-ykzqwqeo — Sort + status filter + name/location search controls

**CWL-mjmzwgxn — Admin-managed types**
- CWL-nnrajzlf — Mongoose models + Zod schemas + repositories for 3 type collections
- CWL-jxhumviq — Admin CRUD API routes for type collections
- CWL-qwlvghjg — Admin pages `/admin/personnel-types`, `/admin/material-types`, `/admin/equipment-types`
- CWL-gyneueco — Rewire WorkLogForm Comboboxes to use new type endpoints
- CWL-oxocrztc — Migration script: extract distinct values from existing worklogs into type collections

### Key design decisions (locked)

- **Calendar is per-project, not portfolio-wide.** User chose one-project-at-a-time over a multi-project badge calendar. Picker at top of the calendar page selects which project to render.
- **Type collections are global and admin-managed.** Not hardcoded constants, not per-project. Admins curate without a deploy. Three small collections: `PersonnelType`, `MaterialType`, `EquipmentType`.
- **Migration approach: import distinct existing values.** Not "keep free-text fallback" and not "hard cutover". A one-time script (`scripts/migrate-types.mjs`) scans worklogs, extracts distinct trimmed non-empty values for `personnel.role` / `equipment.type` / `materials.name` / `materials.unit`, and upserts type records.
- **Project grid: upgrade existing `/projects` route**, do not add a parallel PM-only selector. Avoids two near-duplicate routes.

### Dependencies & ordering

- **CWL-oxocrztc depends on CWL-mghvmqng** (existing issue under CWL-hxzxytmd, "Backfill: dedupe & normalize stub values in worklog.personnel.role / equipment.type / materials.name|unit"). Run the dedupe first or alongside, otherwise the type-import migration will copy garbage values into the new collections.
- **CWL-mjmzwgxn builds on CWL-ooafxbcl** (already done — "Win #2: Replace free-text role/type/unit/weather with pickers"). The Combobox UX stays; only its suggestion source swaps from `useSuggestions` (history-derived) to fetched admin-curated types.
- **Recommended implementation order:**
  1. **CWL-yapwnfum** (project grid) — smallest, no migration risk, warm-up.
  2. **CWL-stfdsadi** (calendar) — depends on the grid for navigation entry points.
  3. **CWL-mjmzwgxn** (types) — largest, touches the worklog form and requires a migration.

### Files NOT changed this session

No application code was modified. The two uncommitted files (`AGENTS.md`, `CLAUDE.md`) carry only GitNexus index stat bumps (symbols 1828→1896, relationships 3349→3497, flows 154→160), unrelated to this session.

---

# Session Summary — 2026-06-11 (DWG attachments)

## Project: Construction Worker Daily Log

A Next.js 15 web application for managing construction worker daily logs, project progress, and site documentation with role-based access control (Workers, Site Supervisors, Admins). Stack: Next.js 15 (app router), MongoDB/Mongoose, JWT/jose, Vercel Blob, Tailwind CSS.

---

## What Happened This Session

### DWG (AutoCAD Drawing) File Attachments — End-to-End

Shipped a complete DWG attachment system: admins/supervisors upload AutoCAD `.dwg` files to a project; workers select a per-worklog subset via checkbox, creating an audit trail of which drawings were referenced on each log entry.

fp parent issue: **CWL-zudetbeq** — all 8 subissues closed and assigned to commits.

| Subissue | Commit | What it covers |
|---|---|---|
| CWL-qzsljhaa | 4e95b79 | Data model — `dwgFiles` on Project, `dwgRefs` on WorkLog |
| CWL-ypzbbvwq | 01e43e6 | Upload endpoint `POST /api/upload/dwg` |
| CWL-vnydakov | 23e296e | Project DWG attach/remove API |
| CWL-opklmhmt | 2f066ba | `DwgUpload` component |
| CWL-aqajbqzn | 2f066ba | Project detail page |
| CWL-sweldynu | 30b06d7 | `DwgPicker` component |
| CWL-gulfaqoy | 30b06d7 | Wire picker into worklog form |
| CWL-tgoiqegi | 30b06d7 | Worklog detail download links |

Test commit: 917da88

#### Files created

| File | Purpose |
|---|---|
| `app/api/upload/dwg/route.ts` | POST endpoint, multipart/form-data, calls `put()` from `@vercel/blob`. Limit: 25 MB, `.dwg` only. Gated by `getAuthUser()` + admin/supervisor role check. |
| `app/api/projects/[id]/route.ts` | GET single project (did not previously exist). |
| `app/api/projects/[id]/dwgs/route.ts` | POST attach + DELETE remove, both gated to admin/supervisor. DELETE does best-effort Vercel Blob `del()`. |
| `app/projects/[id]/page.tsx` | Project detail page (did not previously exist). Metadata + DWG list + upload UI. |
| `components/forms/DwgUpload.tsx` | Admin/supervisor UI: DWG list with remove button and file input. |
| `components/forms/DwgPicker.tsx` | Worker checkbox list fetching project DWGs, used in worklog form. |
| `__tests__/verify-dwg.test.ts` | 17 vitest unit tests — all passing. |

#### Files modified

| File | Change |
|---|---|
| `lib/models/Project.ts` | `dwgFiles` subdoc array |
| `lib/models/WorkLog.ts` | `dwgRefs: string[]` |
| `lib/schemas/projectSchema.ts` | `dwgFileSchema` + included in `projectSchema` |
| `lib/schemas/workLogSchema.ts` | `dwgRefs: z.array(z.string()).optional()` |
| `lib/repositories/ProjectRepository.ts` | `DwgFile` interface; `addDwgFile()` + `removeDwgFile()` with atomic `$push`/`$pull` |
| `lib/repositories/WorkLogRepository.ts` | `dwgRefs?: string[]` on `WorkLog` interface |
| `hooks/useWorkLogForm.ts` | `dwgRefs` state + `updateDwgRefs` setter + reset |
| `components/WorkLogForm.tsx` | Renders `<DwgPicker>` below `<PhotoUpload>` |
| `app/worklogs/[id]/page.tsx` | Drawings section; joins refs against project at read time |
| `app/worklogs/[id]/edit/page.tsx` | Local `dwgRefs` state hydrated from worklog, included in PUT |
| `app/projects/page.tsx` | "View" button on project cards linking to detail page |

#### Architectural decisions

- **Access**: Admin + supervisor only for upload/manage. Worker role = `user`; `isAdmin` helper covers `admin` + `manager`.
- **Max file size**: 25 MB per DWG (vs 8 MB for photos). Enforced client-side and in upload route.
- **Per-worklog linking**: Worker picks a subset of project DWGs at worklog time. "Show all project DWGs" was intentionally rejected — the audit trail is the point.
- **No in-browser preview**: DWGs render as download links only. AutoCAD/Navisworks is the client's problem.
- **No offline DWG upload**: 25 MB files are impractical for IndexedDB. Admins/supervisors are assumed to be online.
- **Worklog stores URLs only** (`dwgRefs: string[]`); detail page joins against `project.dwgFiles` at read time for human filenames. Degrades to "(no longer available)" if a referenced DWG was removed.
- **DELETE is best-effort** on Vercel Blob — DB is authoritative; blob failures are logged and swallowed.
- **No new env var**: reuses existing `BLOB_READ_WRITE_TOKEN`.

#### Verification

- 17 vitest unit tests in `__tests__/verify-dwg.test.ts`: schema persistence, backward compat (empty default), Zod schemas, upload route auth gates (401/403/400/200), attach/remove route auth gates + happy paths.
- Live end-to-end against dev server + real Vercel Blob + real MongoDB confirmed: upload, attach, GET, DELETE, worklog POST with `dwgRefs`, worklog GET.

---

## Git State at Session End

- Branch: `main`
- 7 commits ahead of `origin/main` — **NOT pushed** (user to push when ready)
- `AGENTS.md` and `CLAUDE.md` have unstaged user edits (GitNexus stat bump) — committed together with session wrap-up docs

---

## Open Follow-ups

- **Browser verification**: User was asking for test credentials at session wrap. Admin test user: `test@local.dev` / `test1234` (seed with `scripts/seed-test-user.mjs`, role: `admin`). Worker test user is not yet seeded — no script exists.
- **Push**: 7 commits on `main` need to be pushed to `https://github.com/giandaik/Construction_worker_log_new.git` when ready.
- **CWL-gupyodxk**: Password hashing (unsalted SHA-256 → bcrypt) remains open. Priority before any real user data.
- **Pre-existing TS errors**: `__tests__/` workLog fixture shape mismatches and `resend-email` `signatureTimestamp` — untouched, not regressions from this session.
- **ESLint**: Circular structure in ESLint config — pre-existing, not introduced this session.

---

## Next Session Priorities

1. `git push origin main` — ship the 7 commits.
2. Verify DWG flow in browser (admin login, upload a DWG to a project, switch to worker, create worklog, pick the DWG, verify it appears on the detail page as a download link).
3. Seed a worker test user if browser testing of the worker flow is needed.
4. Pick up **CWL-gupyodxk**: replace unsalted SHA-256 with `bcryptjs`, fix `POST /api/users` password persistence.

---

## Architectural Notes (Actual Stack)

- **Framework**: Next.js 15, `app/` router
- **Database**: MongoDB via Mongoose — `lib/models/`, `lib/schemas/`, `lib/repositories/`
- **Auth**: JWT via `jose`; `bcryptjs` in `package.json` but unused (see CWL-gupyodxk)
- **File Uploads**: Vercel Blob — photos (8 MB, offline-first) + DWGs (25 MB, online-only for admins/supervisors)
- **Offline Sync**: `hooks/useOfflineSync.ts` + `lib/syncService.ts` (photos only; DWGs excluded)
- **API Routes**: `app/api/` Next.js route handlers
- **Middleware**: `middleware.ts` at project root — JWT verification

---

# Session Summary — 2026-06-08

## Project: Construction Worker Daily Log

A Next.js 15 web application for managing construction worker daily logs, project progress, and site documentation with role-based access control (Workers, Site Supervisors, Admins). Stack: Next.js 15 (app router), MongoDB/Mongoose, JWT/jose, Vercel Blob, Tailwind CSS.

---

## What Happened This Session

### Photo Attachment Support (create + edit forms)

Added end-to-end photo attachment capability to WorkLog forms. Photos flow from phone camera or file picker → client-side resize → Vercel Blob (when online) or IndexedDB `data:` URL (when offline) → HTTPS URL stored in MongoDB.

#### Architectural decisions

- **Storage backend: Vercel Blob** (`@vercel/blob`). Chosen because the app deploys on Vercel; free tier (1 GB / 10 GB bandwidth) covers current scale of ~2 users × ~4 photos/day ≈ 90 MB/month. Migration path to Cloudflare R2 is open if needed.
- **Client-side resize**: Canvas-based, max 2000 px on the long edge, JPEG quality 0.85. Drops ~5 MB phone photos to ~400 KB — critical for unreliable construction-site cell signal.
- **Offline-first**: When offline, photos are stored as `data:` URLs in form state + IndexedDB. On reconnect (or at submit time if online) they are uploaded to Blob and the URL replaces the `data:` URL. MongoDB only ever stores HTTPS URLs.
- **Auth**: Upload route gated by the existing `getAuthUser()` cookie/JWT system (not NextAuth — custom `jose`-based session).

#### Files created

| File | Purpose |
|---|---|
| `app/api/upload/route.ts` | POST endpoint, multipart/form-data, calls `put()` from `@vercel/blob`. Limits: 8 MB, JPEG/PNG/WebP. Pathname: `worklogs/{userId}/{timestamp}-{uuid}.{ext}`. Gated by `getAuthUser()`. |
| `lib/imageResize.ts` | `resizeImage`, `blobToDataUrl`, `uploadImageBlob`, `isDataUrl`, `dataUrlToBlob`. Uses `createImageBitmap` + Canvas. |
| `components/forms/PhotoUpload.tsx` | Reusable component: multi-file input with `capture="environment"` (phone camera), thumbnail grid, remove button, "Pending" badge for not-yet-uploaded photos. |

#### Files modified

| File | Change |
|---|---|
| `hooks/useWorkLogForm.ts` | Added `images: string[]` to form state, `updateImages` setter. |
| `components/WorkLogForm.tsx` | Renders `<PhotoUpload>` above signatures. |
| `hooks/useOfflineSync.ts` | Pre-uploads `data:` URLs before POST when online; includes `images` in IndexedDB pending payload when offline. |
| `lib/syncService.ts` | Uploads `data:` URLs before replaying pending worklogs from IndexedDB. |
| `lib/schemas/workLogSchema.ts` | Added `images: z.array(z.string()).optional()`. |
| `lib/repositories/WorkLogRepository.ts` | Added `images?: string[]` to `WorkLog` interface. |
| `app/worklogs/[id]/page.tsx` | Photos grid section — click thumbnail to open full-res in new tab. |
| `app/worklogs/[id]/exportToPDF.ts` | Made async; added Photos section that fetches images and embeds as data URLs in jsPDF (2-column layout). |
| `app/worklogs/[id]/edit/page.tsx` | Loads existing images, renders `<PhotoUpload>`, pre-uploads `data:` URLs before PUT. |

#### Dependency added

`@vercel/blob` (^2.4.0) — in `package.json` and `package-lock.json`.

---

## What the User Still Needs to Do

1. **Add `BLOB_READ_WRITE_TOKEN` env var**: Vercel dashboard → Storage → Create Blob Store → connect to project. Copy the token into `.env.local` and the Vercel project environment settings.
2. **Test the flow**: `npm run dev` → create a worklog → attach photos from phone camera → submit → verify photos appear on the detail page and in PDF export.

---

## Pre-existing Issues (NOT caused by this session)

- TypeScript errors in `__tests__/` files — pre-existing fixture shape mismatches. All new/modified files type-check clean.
- `npm run lint` fails on a circular structure error in the ESLint config — predates this work.
- Next.js workspace root detection warns about multiple lockfiles (`/Users/meletis/package-lock.json` vs project root) — predates this work.

---

## Open Issues (fp)

| ID | Title | Status |
|---|---|---|
| CWL-gupyodxk | Replace unsalted SHA-256 password hashing with bcrypt; fix broken user-creation path | todo |

---

## Next Session Priorities

1. **Set `BLOB_READ_WRITE_TOKEN`** and smoke-test photos end-to-end (see above).
2. **Pick up CWL-gupyodxk**: `fp issue update --status in-progress CWL-gupyodxk`
   - Replace `createHash("sha256")` in `app/api/login/route.ts` with `bcryptjs.compare`.
   - Add `password` field to `lib/schemas/userSchema.ts` and `UserRepository.ts` interface.
   - Hash password on user creation, verify on login.
3. Decide on `middleware.ts` redirect behavior (JSON vs redirect for unauthenticated page routes).
4. Add role check to `GET /api/users`.

---

## Architectural Notes (Actual Stack)

- **Framework**: Next.js 15, `app/` router
- **Database**: MongoDB via Mongoose — models in `lib/models/`, schemas in `lib/schemas/`, repository pattern in `lib/repositories/`
- **Auth**: JWT via `jose`; `bcryptjs` in `package.json` but unused (see CWL-gupyodxk)
- **File Uploads**: Vercel Blob — client-side resize, offline-first with IndexedDB fallback
- **Offline Sync**: `hooks/useOfflineSync.ts` + `lib/syncService.ts`
- **API Routes**: `app/api/` Next.js route handlers
- **Middleware**: `middleware.ts` at project root handles JWT verification

---

## Previous Session Notes (2026-06-07)

- GitNexus indexed: 1,370 symbols, 2,460 relationships, 106 execution flows.
- fp issue tracking adopted (`fp init --prefix "CWL"`). Issue CWL-gupyodxk filed.
- Identified that CLAUDE.md was severely stale (described Vite/Firebase codebase vs actual Next.js/MongoDB). CLAUDE.md has now been updated as of this session to reflect the real stack.
