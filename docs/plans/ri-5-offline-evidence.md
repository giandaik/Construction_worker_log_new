Preserve the offline capture time through the sync boundary, and make the queue idempotent.

Evidence
- `lib/indexedDBHelper.ts:14` `PendingWorkLogData` carries no capture timestamp and no schema version.
- `lib/syncService.ts:75` calls `deletePendingWorkLog(log.tempId)` immediately after a successful POST — the local record is gone, so the moment of capture exists nowhere.
- `lib/syncService.ts:59` fires every pending log through `Promise.allSettled` at once, with no per-record idempotency key. A POST that succeeds on the server but times out on the wire (routine on a site connection) is retried and, once site-day uniqueness exists, will now be rejected as a duplicate — a legitimate log the supervisor has to re-enter by hand.
- The queue is not user-visible as a state: `SyncManager` reports only `successful/failed` counts.

Work
1. Add to `PendingWorkLogData`: `capturedAt` (device time at capture), `day` (site day, from the sibling site-day task), `clientClockOffsetMs`, and `schemaVersion`.
2. Stamp `capturedAt` when the record enters the queue, not when it leaves.
3. Give every queued record a client-generated idempotency key; the server records it and returns the original document instead of inserting a second copy on a retry.
4. Keep the "device clock vs server clock" evidence with the record as it syncs (the offset cannot be reconstructed later).
5. Do not delete blindly on success: delete only on a confirmed server response that carries the created document id, and only after the payload has been acknowledged for *this* idempotency key.
6. Make the queue visible: a badge/screen listing pending records with capture time and age, and a per-record failure reason. `PendingSubmissions.tsx` already exists — extend it instead of building a second surface.
7. Never silently drop a failed record: after N attempts, keep it queued with the error surfaced, so a supervisor can act rather than wondering where the entry went.

Acceptance
- A record captured offline at 17:40 and synced the next morning still shows 17:40 as "recorded at", with the offset preserved.
- Replaying the same queue (simulated network timeout after a successful insert) produces exactly one server record.
- The user can see what is queued, when each item was captured, and why anything failed.
