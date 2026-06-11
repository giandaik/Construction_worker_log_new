# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Construction Worker Daily Log is a web application for managing construction worker daily logs, project progress, and site documentation. The app features role-based access control with three user types: Workers, Site Supervisors, and Admins.

## Development Commands

### Start Development Server
```bash
npm run dev
```
Starts both the Vite frontend dev server (port 5173) and the Express backend server (port 3000) using concurrently.

### Build for Production
```bash
npm run build
```
Compiles TypeScript and builds the Vite application for production.

### Linting
```bash
npm run lint
```
Runs ESLint on TypeScript and TSX files with strict rules.

### Preview Production Build
```bash
npm run preview
```
Serves the production build locally for testing.

### Start Backend Only
```bash
npm run server
```
Starts only the Express backend server with hot reload (tsx watch).

## Tech Stack

- **Framework**: Next.js 15 (app router, TypeScript)
- **Styling**: Tailwind CSS with custom yellow/construction theme
- **UI Components**: Headless UI, Heroicons
- **Routing**: Next.js file-based routing (`app/` directory)
- **Backend**: Next.js API routes (`app/api/`)
- **Database**: MongoDB via Mongoose — `lib/models/`, `lib/schemas/`, `lib/repositories/`
- **Authentication**: JWT via `jose`; custom session cookies; `bcryptjs` in package.json (not yet wired in)
- **File Uploads**: Vercel Blob (`@vercel/blob`) — client-side resize, offline-first with IndexedDB fallback
- **Offline Sync**: `hooks/useOfflineSync.ts` + `lib/syncService.ts` — replays pending worklogs from IndexedDB on reconnect

## Architecture

### Authentication & Authorization Flow

The app uses Firebase Authentication with custom role-based access control:

1. **AuthContext** (`src/contexts/AuthContext.tsx`):
   - Wraps the entire app and manages authentication state
   - On user login, fetches role from Firestore `users` collection
   - Stores user profile with role in state
   - Monitors network status and handles offline scenarios

2. **User Roles** (`src/types/auth.ts`):
   - `WORKER`: Can access daily log entry
   - `SITE_SUPERVISOR`: Can access daily log and project log
   - `ADMIN`: Full access to all routes including admin panel

3. **ProtectedRoute** (`src/components/auth/ProtectedRoute.tsx`):
   - Wrapper component for protected routes
   - Checks authentication status and role permissions
   - Redirects to `/login` if unauthenticated
   - Redirects to `/unauthorized` if user lacks required role
   - Renders Layout component automatically for all protected routes

### Routing Structure

Routes are defined in `src/App.tsx`:

- `/login`, `/signup`, `/unauthorized` - Public auth pages
- `/` - Root redirect based on user role (WORKER → `/daily-log`, others → `/dashboard`)
- `/daily-log` - Worker daily log form (Worker, Supervisor, Admin)
- `/dashboard` - Dashboard view (Supervisor, Admin)
- `/project-log` - Project log (Supervisor, Admin) [Placeholder]
- `/admin/*` - Admin panel (Admin only) [Placeholder]

### Navigation Flow

The app implements role-based navigation:
- Workers automatically redirect to `/daily-log` on sign-in
- Supervisors and Admins redirect to `/dashboard`
- Layout component (`src/components/Layout.tsx`) is rendered by ProtectedRoute for all authenticated views

### Firebase Configuration

Firebase is initialized in `src/config/firebase.ts` using environment variables:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Environment variables must be set in `.env` or `.env.local` (not tracked in git).

### Backend API

Express server (`server/index.ts`) handles file uploads:

**POST /api/logs**
- Accepts multipart form data with log data and photos
- Stores photos in `uploads/` directory
- Returns log object with photo URLs
- In-memory storage (array) - should be replaced with database in production

**GET /api/logs**
- Returns all logs from in-memory storage

### Data Models

**Log** (`src/types/index.ts`):
```typescript
{
  id: string
  worker: string
  project: string
  task: string
  date: string
  startTime: string
  endTime: string
  equipment: string[]
  weather: string
  notes: string
  photos: string[]
  createdAt: string
}
```

**UserProfile** (`src/types/auth.ts`):
Extends Firebase User with custom role field.

## Photo Attachment Feature

Added in session 2026-06-08. Photos can be attached to any WorkLog (create and edit forms).

### Files

| File | Purpose |
|---|---|
| `app/api/upload/route.ts` | POST endpoint — multipart/form-data, calls `put()` from `@vercel/blob`. Limits: 8 MB per file, JPEG/PNG/WebP only. Pathname: `worklogs/{userId}/{timestamp}-{uuid}.{ext}`. Gated by `getAuthUser()`. |
| `lib/imageResize.ts` | `resizeImage` (Canvas, max 2000 px, 0.85 JPEG), `blobToDataUrl`, `uploadImageBlob`, `isDataUrl`, `dataUrlToBlob`. |
| `components/forms/PhotoUpload.tsx` | Reusable multi-file input with `capture="environment"` (camera), thumbnail grid, remove button, "Pending" badge for not-yet-uploaded photos. |

### Modified files

- `hooks/useWorkLogForm.ts` — `images: string[]` in form state, `updateImages` setter.
- `components/WorkLogForm.tsx` — renders `<PhotoUpload>` above signatures.
- `hooks/useOfflineSync.ts` — pre-uploads `data:` URLs before POST when online; stores them in IndexedDB payload when offline.
- `lib/syncService.ts` — uploads `data:` URLs before replaying pending worklogs.
- `lib/schemas/workLogSchema.ts` — `images: z.array(z.string()).optional()`.
- `lib/repositories/WorkLogRepository.ts` — `images?: string[]` on `WorkLog` interface.
- `app/worklogs/[id]/page.tsx` — Photos grid, click to open full-res in new tab.
- `app/worklogs/[id]/exportToPDF.ts` — async PDF export; fetches each image and embeds as data URL (2-column layout).
- `app/worklogs/[id]/edit/page.tsx` — loads existing images, renders `<PhotoUpload>`, pre-uploads `data:` URLs before PUT.

### Required env var

`BLOB_READ_WRITE_TOKEN` — obtain from Vercel dashboard → Storage → Create Blob Store → connect to project. Add to `.env.local` and Vercel project settings.

### Offline flow

1. User picks photos on form — resized client-side, stored as `data:` URLs in form state.
2. If offline: `data:` URLs saved to IndexedDB with the pending worklog.
3. On reconnect (or at submit time if online): `data:` URLs pre-uploaded to Blob, HTTPS URLs replace them, then worklog POST/PUT fires with HTTPS URLs only.
4. The MongoDB document and Blob store only ever hold HTTPS URLs.

## Code Style Guidelines (from .cursorrules)

### TypeScript Conventions
- Use TypeScript for all code; prefer interfaces over types
- Avoid enums; use maps/const objects instead (see `UserRoles` in `src/types/auth.ts`)
- Use functional components with TypeScript interfaces
- Prefer the `function` keyword for pure functions

### React Patterns
- Use functional and declarative programming patterns; avoid classes
- Structure files: exported component, subcomponents, helpers, static content, types
- Favor named exports for components
- Minimize `useState` and `useEffect`; prefer context and reducers for state management

### Naming Conventions
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`)
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)

### Error Handling
- Handle errors at the beginning of functions
- Use early returns for error conditions to avoid deeply nested if statements
- Avoid unnecessary else statements; use if-return pattern

### Performance
- Avoid unnecessary re-renders by memoizing components and using `useMemo` and `useCallback`
- Optimize images: implement lazy loading where appropriate

## Important Notes

1. **Actual Stack (NOTE: the Tech Stack section above is outdated)**: The running codebase is **Next.js 15** (app router), **MongoDB/Mongoose** for persistence (models in `lib/models/`, schemas in `lib/schemas/`, repository pattern in `lib/repositories/`), and **JWT via jose** for auth (`middleware.ts` + `app/api/login/`). The Vite/Express/Firebase description is a legacy artifact and does not reflect what is on disk.

2. **Password Hashing (open security issue — fp CWL-gupyodxk)**: Passwords are currently hashed with unsalted SHA-256 (`crypto.createHash`). `bcryptjs` is in `package.json` but unused. Replace with `bcryptjs.hash` / `bcryptjs.compare` before any real user data is stored.

3. **Role Assignment**: Roles are stored in MongoDB on the `User` document. Default role is `WORKER`. Note: `POST /api/users` currently does not persist passwords correctly (tracked in CWL-gupyodxk).

4. **Photo Storage**: Photos are stored in **Vercel Blob** (`@vercel/blob`). The upload endpoint is `app/api/upload/route.ts` (POST, multipart/form-data, max 8 MB, JPEG/PNG/WebP). Client-side resize (`lib/imageResize.ts`) compresses to ≤2000 px / 0.85 JPEG quality before upload. When offline, photos are held as `data:` URLs in form state and IndexedDB; they are pre-uploaded on reconnect or at submit time. The `WorkLog` model stores only HTTPS Blob URLs. Required env var: `BLOB_READ_WRITE_TOKEN` (Vercel dashboard → Storage → Blob Store).

5. **Network Handling**: AuthContext includes network status monitoring and displays errors when offline.

6. **Layout Component**: The Layout component is automatically rendered by ProtectedRoute for all authenticated routes, so individual pages should not import it themselves.

7. **Tailwind Theme**: The app uses a custom yellow/construction-themed color scheme (yellow-50 through yellow-900).

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Construction_worker_log_new** (1661 symbols, 2991 relationships, 139 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Construction_worker_log_new/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Construction_worker_log_new/clusters` | All functional areas |
| `gitnexus://repo/Construction_worker_log_new/processes` | All execution flows |
| `gitnexus://repo/Construction_worker_log_new/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

@FP_CLAUDE.md
