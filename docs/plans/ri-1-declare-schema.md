Declare `signatures` (and the fields the workflow queries) as a real server-side schema, and stop relying on an accidental spread.

Evidence
- `lib/models/WorkLog.ts` declares no `signatures` field. The whole `lib/models/` module is never imported at runtime — repositories go through `DatabaseUtils.getCollection()` (`lib/api/database.ts:30`) on `mongoose.connection.collection()`, i.e. the raw driver.
- Signatures persist today only because `lib/repositories/base/BaseRepository.ts:158` spreads `...data` into `insertOne`.
- Consequence: no declared shape, no validation, and no index exists on `signatures.*` or on the fields the per-day lookup and calendar queries actually hit.

Work
1. Extend the raw-driver `WorkLog` entity (`lib/repositories/WorkLogRepository.ts:52`) with every field the app writes: `issues`, `rejectionComment`, `signatures` (typed), plus the new integrity fields from the sibling tasks.
2. Add a schema validator, or a single `WORKLOG_SCHEMA_VERSION` with an explicit `$jsonSchema` validator applied on collection creation, so a malformed document cannot be inserted by any code path — including the raw driver.
3. Decide the fate of `lib/models/*`: either wire it back in as the single source of truth or delete it and document the raw-driver convention. Dead duplicate schemas are how this defect appeared.
4. Add the indexes the queries need: `{ project: 1, day: -1 }`, `{ tenantId: 1, status: 1 }`, `{ 'signatures.signedAt': 1 }`.
5. A migration/backfill script for existing documents: fill the new integrity fields with the best available evidence and mark them `backfilled: true` so a reader can tell reconstructed metadata from genuine.

Notes
- Keep `workLogCreateSchema` / `workLogUpdateSchema` in `lib/schemas/workLogSchema.ts` as the *request* contract; this task is about the *stored* contract.
- `BaseRepository.IMMUTABLE_FIELDS` must also cover the new integrity fields (`signatures`, `createdAt`, `contentHash`), since `update()` strips only what is listed there.
