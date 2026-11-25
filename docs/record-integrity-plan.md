# Record integrity plan — making the work log defensible

*Written 2026-09-22. Every claim below was verified against the code at the time of writing;
file:line references are the evidence, not estimates.*

## Why

The product's commercial wedge is compliance and dispute protection: the ημερολόγιο έργου is a
legal record (Ν.4412/2016 άρθρο 146), and the sales message is "signed, timestamped, exported for
the επίβλεψη". Five adjacent industries solved this problem decades ago and converged on the same
requirements. The app currently satisfies almost none of them:

| Adjacent domain | What it demands | Where the app stands |
|---|---|---|
| Ship's deck log / official log | No amendment or deletion; cancellation = single strike + initial; date and time on every entry; signed by author and witness | Any signed entry can be silently overwritten (`BaseRepository.update` → `$set`) |
| DVIR (49 CFR 396.11, eDVIR per 390.32) | Signature chain: operator → counterparty certification → operator acknowledgement; **proof of consent** to electronic records; reproducible on demand | One bitmap signature per party, no consent record |
| Aviation technical log + MEL | A defect is rectified or **formally deferred** with a category and a deadline that starts the day after discovery | `equipment[].count` only; idle machines have no item, cause, or deadline |
| 21 CFR Part 11 / ALCOA+ | Computer-generated time-stamped audit trail; **changes must not obscure previously recorded information**; no shared logins; no user-adjustable clocks | No history of any kind; `updatedAt` is single-valued |
| Nursing / EMS ePCR | Late entry is allowed only if labelled with both times and a reason; unsigned attestation is a tracked open item | No addendum concept; rejection deletes signatures |

## Verified defects

1. **Client-supplied signature timestamps.** `lib/schemas/workLogSchema.ts:29` and `:109` accept
   `signedAt` as a string from the request body, and `components/SignatureSection.tsx:61` sets it
   with `new Date().toISOString()` on the device. Nothing on the server stamps it. A repudiable
   timestamp on the record that is supposed to settle disputes.
2. **The record shape is undeclared.** `lib/models/WorkLog.ts` has no `signatures` field at all, and
   the whole `lib/models/` module is never imported at runtime — repositories use
   `mongoose.connection.collection()` (`lib/api/database.ts:30`) via the raw driver. Persistence of
   `signatures` works only because `BaseRepository.create():158` spreads `...data` into `insertOne`.
   No server-side schema, no indexes on the fields the workflow queries.
3. **Day identity is UTC, and uniqueness is not enforced.** `app/api/worklogs/route.ts:40` and `:105`
   derive the day with `toISOString().split('T')[0]`, and `WorkLogRepository.findByProjectAndDay():217`
   matches with `$dateToString` (also UTC). A 01:00 EEST entry belongs to the previous day — the
   check misses the real duplicate and the log is filed under the wrong date. The client default is
   equally wrong between 00:00 and 03:00 EEST (`hooks/useWorkLogForm.ts:30,243`).
4. **No audit trail.** `status`, `signatures`, `rejectionComment` and every field are overwritten in
   place; `app/api/worklogs/[id]/route.ts:118` blocks edits only once status is `completed`.
   `reject/route.ts` sets `signatures: []` — destroying the record of who had already signed.
5. **Offline capture forgets when it happened.** `lib/syncService.ts:75` deletes the IndexedDB record
   after a successful POST, and `PendingWorkLogData` carries no captured-at time. Once synced, only
   server receipt time exists — contemporaneity is unprovable.
6. **No consent to electronic records**, which 49 CFR 390.32(d) and EU practice both require before
   an electronic signature can stand in for a handwritten one.
7. **Signatures are only bitmaps.** `signatureSchema.data` is a base64 PNG drawing; no credential
   identity, no provider abstraction. If an επίβλεψη requires a digital signature (some ΕΣΥ already
   do), eIDAS QES is the only level with handwritten equivalence — the model must allow it.
8. **Legal field coverage is partial.** Against άρθρο 146(α)–(ιδ): weather, personnel by category,
   machines, work description and materials are covered. Missing: μηχανήματα σε ημεραργία, εντολές
   και παρατηρήσεις επίβλεψης, καθυστερήσεις/ατυχήματα/ζημίες with stop and restart times, εργασίες
   χωρίς πρόοδο and why, επισκέψεις/επικοινωνίες, κυκλοφοριακές ρυθμίσεις, εργαστηριακές δοκιμές,
   work location, and the 7-day forwarding of the detachable leaf.

## Order of work

Phase 1 is the spine and cannot be retrofitted onto entries already produced: declare the schema,
make the server the only source of time, fix day identity, and start the history collection. Phase 2
(legal field coverage, deferrals, signature provider) is product work that sits on top.

Both phases are captured as `fp` issues: parent `Record integrity: make the log defensible` (phase 1)
and `Defensible field coverage: legal + deferral model` (phase 2).

## Decisions required from the product owner

1. **Day identity.** Recommended: the device decides the site day (it already collects one — the form
   has a date field) and sends `day` as `YYYY-MM-DD` explicitly; the server stamps a separate
   `serverReceivedAt`. Do not derive one from the other. This is the only option that is correct both
   offline and in dispute. The alternative — treating the server receipt instant as the day — files
   legitimate night-shift entries on the wrong day.
2. **Time source.** Recommended: device clock with a visible skew warning when the client and server
   clocks disagree by more than a few minutes, plus `serverReceivedAt` as the authoritative instant.
   The alternative — full server authority — is unimplementable offline, which is the app's core
   promise.
