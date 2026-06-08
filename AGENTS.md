# Project Context

## Tech Stack (as of 2026-06-08)
- **Framework**: Next.js 15 (app router, TypeScript)
- **Database**: MongoDB via Mongoose (`lib/models/`, `lib/schemas/`, `lib/repositories/`)
- **Auth**: JWT via `jose`; custom session cookies; `bcryptjs` in package.json (not yet wired in)
- **File Uploads**: Vercel Blob (`@vercel/blob`) — client-side resize via Canvas, offline-first with IndexedDB fallback
- **Offline Sync**: `hooks/useOfflineSync.ts` + `lib/syncService.ts`

## Photo Attachment Feature (added 2026-06-08)
Key files: `app/api/upload/route.ts`, `lib/imageResize.ts`, `components/forms/PhotoUpload.tsx`.
Required env var: `BLOB_READ_WRITE_TOKEN` (Vercel Blob Store).
Offline flow: `data:` URLs held in IndexedDB, pre-uploaded to Blob before worklog POST/PUT.

## Open Security Issue (fp CWL-gupyodxk)
Passwords hashed with unsalted SHA-256 — switch to `bcryptjs`. `POST /api/users` does not persist passwords. Fix before production.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Construction_worker_log_new** (1493 symbols, 2694 relationships, 125 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
