Make the server the only source of authoritative time on a work log, and preserve the device's capture time as a distinct, labelled fact.

Evidence
- `lib/schemas/workLogSchema.ts:29` (form) and `:109` (request) accept `signedAt` as `z.string()` — a value chosen entirely by the client.
- `components/SignatureSection.tsx:61` sets it with `new Date().toISOString()` on the device.
- `lib/syncService.ts:75` deletes the IndexedDB record after a successful POST, and `PendingWorkLogData` (`lib/indexedDBHelper.ts:14`) carries no captured-at field. Once synced, only server receipt time survives.
- 21 CFR 11.10(e) requires a computer-generated, time-stamped record; ALCOA+ requires contemporaneity to be *provable*. Both are currently unprovable here.

Work
1. Per-record time set, all server-stamped in the route, never accepted from the body:
   - `serverReceivedAt` — stamped at POST/PUT entry.
   - `clientCapturedAt` — sent by the client, stored as *claimed* time, rendered as "recorded at" and never used for ordering, uniqueness, or expiry.
   - per-signature `signedAt` — stamped server-side from the signing request.
   - `clientSignedAt` — the device's claimed signing time, kept alongside for the offline gap.
2. Add `clientClockOffsetMs` (device time minus server time at sync) to every synced record. This is the evidence a dispute needs: when the site handset clock disagreed with the server, by how much, and in which direction.
3. Make `signedAt` server-set and `clientSignedAt` client-set; the request schemas must reject `signedAt` outright (`.strict()` currently allows it because it is declared — remove it from `signatureEntrySchema`).
4. Surface the offset in the UI when it exceeds a threshold: a one-line warning at save time, and a flagged marker on the record. Do not block the save — a field handset in a basement is not a reason to lose the entry.
5. Persist `clientCapturedAt` + `clientClockOffsetMs` through the offline queue instead of dropping them at sync (`lib/syncService.ts`).

Acceptance
- No request body can influence `signedAt`, `serverReceivedAt`, or any other authoritative timestamp.
- A log captured offline at 17:40 and synced at 22:10 shows both times plus the offset, on screen and in the PDF export (`app/worklogs/[id]/exportToPDF.ts`).
- Existing tests still pass; add coverage for the offset field surviving a simulated offline round-trip.
