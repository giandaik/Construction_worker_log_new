Fix site-day identity and actually enforce one log per project per day.

Evidence
- `app/api/worklogs/route.ts:40` (duplicate check) and `:105` (create) derive the day with `selectedDate.toISOString().split('T')[0]` — UTC, regardless of the site's timezone.
- `lib/repositories/WorkLogRepository.findByProjectAndDay():217` matches with `$dateToString` on the stored `date`, also UTC.
- `hooks/useWorkLogForm.ts:30,243` defaults the form date with `new Date().toISOString().split('T')[0]` — the wrong day between 00:00 and 03:00 EEST (site time = UTC+2/+3).
- Effect: an entry at 01:00 EEST belongs to the previous day. The duplicate check misses an existing log for the real site day, and the filed date is wrong in the record that an επίβλεψη reads.
- `app/worklogs/[id]/edit/page.tsx:89` does `workLog.date.split('T')[0]` — a third, inconsistent day derivation.

Decision taken (recommended option in `docs/record-integrity-plan.md`)
- The device decides the *site day*; it already collects a date in the form. Send `day` as an explicit `YYYY-MM-DD` string and store it as its own indexed field.
- The server always stamps its own `serverReceivedAt` separately. Neither value is derived from the other.

Work
1. Add `day: string` (`YYYY-MM-DD`) to the request schemas and the entity; keep `date` for the precise instant (weather, shift start/end).
2. Derive `day` once on the device from local time (a small `toSiteDay(date)` helper in `lib/`), and use it in `useWorkLogForm`, the edit page, and the calendar.
3. Rewrite `findByProjectAndDay` and `countByDayForProject` to match on `day` directly — drop the `$dateToString` conversion, then the `{ project: 1, day: 1 }` index becomes usable.
4. Add a partial unique index on `{ tenantId: 1, project: 1, day: 1 }` and handle the duplicate-key error in POST as the existing `DUPLICATE_WORKLOG_MESSAGE`. The current check is a read-then-write race: two supervisors on a two-bar signal both pass the check and both insert.
5. Backfill `day` for existing documents from `date`, and record that the backfill assumed UTC so the assumption is visible.
6. Add tests around the boundary: 23:30 EEST, 00:30 EEST, and a UTC-stored timestamp read back across the boundary.

Acceptance
- Two logs for the same project on the same site day are impossible, even under a concurrent double-submit.
- A log created at 01:00 site time is filed under that site day, in the list, the calendar, and the PDF.
- One helper derives the day; no third derivation remains.
