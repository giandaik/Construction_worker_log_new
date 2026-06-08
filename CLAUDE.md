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

- **Frontend**: React 18 with TypeScript, Vite
- **Styling**: Tailwind CSS with custom yellow/construction theme
- **UI Components**: Headless UI, Heroicons
- **Routing**: React Router v7
- **Backend**: Express.js server for file uploads
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **File Uploads**: Multer (server-side), max 5 photos per log, 5MB each

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

1. **Console Logs**: The codebase currently has extensive console.log statements in `src/App.tsx` and `src/contexts/AuthContext.tsx` for debugging authentication flow. These should be removed before production.

2. **In-Memory Storage**: The backend currently stores logs in a simple array. This needs to be replaced with a database (likely Firestore) for production.

3. **Role Assignment**: When users sign up, their role is stored in Firestore. The default role is `WORKER` if not specified or if Firestore fetch fails.

4. **Photo Storage**: Photos are currently stored in the local `uploads/` directory. For production, use Firebase Storage or another cloud storage service.

5. **Network Handling**: AuthContext includes network status monitoring and displays errors when offline.

6. **Layout Component**: The Layout component is automatically rendered by ProtectedRoute for all authenticated routes, so individual pages should not import it themselves.

7. **Tailwind Theme**: The app uses a custom yellow/construction-themed color scheme (yellow-50 through yellow-900).

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Construction_worker_log** (1354 symbols, 2450 relationships, 106 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| `gitnexus://repo/Construction_worker_log/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Construction_worker_log/clusters` | All functional areas |
| `gitnexus://repo/Construction_worker_log/processes` | All execution flows |
| `gitnexus://repo/Construction_worker_log/process/{name}` | Step-by-step execution trace |

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
