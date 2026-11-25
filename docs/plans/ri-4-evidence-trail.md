Add an append-only history so no change can obscure a previously recorded value.

Evidence
- Every write path overwrites in place: `Lib/repositories/base/BaseRepository.ts:183` issues a plain `$set` with a fresh `updatedAt`; `app/api/worklogs/[id]/route.ts:118` blocks edits only once `status === 'completed'`.
- `app/api/worklogs/[id]/reject/route.ts` sets `signatures: []` on rejection — the record of who had already signed is destroyed, not superseded.
- There is no history collection anywhere in the repo (`ImpersonationLogRepository` is the only event-style collection, and it is unrelated).
- 21 CFR 11.10(e): "Record changes shall not obscure previously recorded information." Today, a correction and a fabrication are indistinguishable after the fact.

Work
1. New collection `worklog_events`, written by the repository — never by a client. One document per mutation:
   `{ tenantId, workLogId, at, actor: { userId, name, role }, action, changes: [{ field, from, to }], reason?, ip?, userAgent? }`
   with `action` in `created | updated | signed | rejected | approved | addendum_added | exported`.
2. Write events inside the same repository methods that perform the mutation, so no route can bypass them. `BaseRepository.update` is shared: either add a hook there or have `WorkLogRepository` own its own `update` that writes both.
3. Strip values that must not be duplicated into history: never store the signature bitmap `data` in `changes` — store a hash/length and the fact of signing.
4. Replace the destructive rejection: on reject, do **not** clear `signatures`. Append a rejection event and mark the affected signatures `supersededAt` + `supersededReason`. The UI may still show the log as returned for correction.
5. Require a `reason` on any edit to a log that already carries a signature — the nursing "late entry" rule: what changed, why, and when it was written.
6. Never hard-delete a signed log: `DELETE` (`app/api/worklogs/[id]/route.ts:216`) should mark `voidedAt` + `voidedReason` and keep the document. An unsent draft may still be deleted outright.
7. Index `{ tenantId: 1, workLogId: 1, at: 1 }`; render the trail on the work-log detail page and append it to the PDF export as a "record history" section.

Acceptance
- Every create/update/sign/reject/approve leaves an event with actor and reason.
- No code path can change a signed log's values without leaving the previous values readable.
- A rejected log still shows which party had signed before the rejection, and when.
- The PDF of a corrected log shows both the original and corrected values.
