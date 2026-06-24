# Copy / reuse dropdown catalog options across projects

**Date:** 2026-06-24
**Issue:** CWL-msvzscgj
**Status:** Approved

## The human & job-to-be-done

An admin or site supervisor (`admin` / `manager` role) sets up a project. Each
project carries four option lists — Ρόλοι Προσωπικού, Μηχανήματα, Υλικά, Μονάδες
Μέτρησης — edited on the project detail page (`ProjectCatalogManager`). The pain:
they create their 3rd, 4th, 5th site and re-type the *exact same* list every
time.

**How might we** let an admin populate a new project's option lists in seconds by
reusing what they already configured elsewhere — without forcing them to keep
lists in sync by hand?

## Decisions (from brainstorming)

- **One-time copy**, not a live master link. Editing the source later does not
  propagate. Lowest risk, builds on existing per-project storage.
- **Merge (additive, dedup)** into whatever the target already has. Nothing is
  deleted → no scary warnings, safe by design.
- Available **both** on the project detail catalog manager **and** at project
  creation.

## Architecture

No data-model change. Catalog stays as the four `string[]` arrays on `Project`.
Copy = "read from source, merge into target".

### Server

1. `ProjectRepository.mergeCatalog(id, partial)` — one atomic update; per-kind
   union with dedup/trim against the existing arrays. Returns updated project.
2. `ProjectRepository.findCatalogSummaries()` — lightweight `{ _id, name, total }`
   per project (total = sum of the four catalog lengths) to drive the source
   picker and flag empty sources.
3. `GET /api/projects/catalog-sources` — returns the summaries above. Gated to
   admin/manager.
4. `POST /api/projects/[id]/catalog/import` — body `{ sourceProjectId }`. Reads
   the source's catalog server-side, calls `mergeCatalog`, returns the updated
   project. Gated to admin/manager. Server is the source of truth for the merge
   (client-side preview is informational only). 404 if source or target missing;
   400 if `sourceProjectId === id`.

For the creation case (no target project exists yet) the client fetches the
source's actual values via the existing `GET /api/projects/[id]` and merges into
form state locally.

### UI — `CatalogImportDialog` (reusable, two modes)

- Trigger button: **«Αντιγραφή επιλογών από άλλο project»** (copy icon).
- Dialog body:
  - Searchable list of *other* projects (current excluded). Empty sources show
    **«(κενός κατάλογος)»** and are not selectable.
  - On selection, fetch the source's full catalog and render a **preview**: per
    category, how many *new* options will be added vs already present
    (e.g. «+5 ρόλοι, +3 μηχανήματα, 2 ήδη υπάρχουν»). Transparency = trust.
  - Confirm **«Αντιγραφή»**.
- **Detail mode** (`mode="apply"`): confirm → `POST …/catalog/import`
  → on success calls `onImported(updatedProject)`; toast «Αντιγράφηκαν Χ επιλογές».
- **Create mode** (`mode="prefill"`): confirm → calls `onPrefill(mergedCatalog)`;
  no API write. The arrays flow out with the existing `POST /api/projects`.

### Small refactor (improve-as-you-go)

Extract the grid of four `CatalogEditor`s into a pure controlled `CatalogFields`
component, used by both:
- `ProjectCatalogManager` (API-persisted, detail page), and
- `NewProjectForm` (local form state, inside a collapsible
  «Κατάλογος επιλογών (προαιρετικό)» section so the create form stays light).

## Components / files

**Added**
- `lib/catalog/mergeCatalog.ts` — pure merge helper (`mergeCatalogValues`,
  `mergeCatalog`) shared by repo + client preview/prefill. Unit-tested.
- `app/api/projects/catalog-sources/route.ts` — GET source summaries.
- `app/api/projects/[id]/catalog/import/route.ts` — POST import.
- `components/projects/CatalogImportDialog.tsx` — the picker + preview dialog.
- `components/projects/CatalogFields.tsx` — controlled 4-field grid.

**Modified**
- `lib/repositories/ProjectRepository.ts` — `mergeCatalog`, `findCatalogSummaries`.
- `components/projects/ProjectCatalogManager.tsx` — use `CatalogFields`; add
  import button in `apply` mode.
- `components/admin/NewProjectForm.tsx` — local catalog state + collapsible
  `CatalogFields` + import button in `prefill` mode; arrays in POST body.

## Error handling

- Auth: both new routes return 401/403 for non-admin/manager.
- Import: 400 on self-import or invalid body; 404 on missing source/target.
- Dialog: fetch failures surface a toast; nothing is mutated. Merge never
  deletes, so retries are safe/idempotent.

## Testing

`__tests__/verify-catalog-copy.test.ts` (vitest):
- `mergeCatalogValues`: dedup, trim, empty target, empty source, order stable.
- `mergeCatalog` (repo, mongodb-memory or mocked collection): merges all four
  kinds, dedups against existing, returns updated project.
- `POST …/catalog/import`: auth gate, happy path, self-import 400,
  missing source 404.
- `GET …/catalog-sources`: auth gate, returns totals.

## Out of scope (YAGNI)

- Live master/org-level catalog with propagation.
- Named catalog templates/presets.
- Per-kind selective import (merge applies to all four; preview shows the split).
