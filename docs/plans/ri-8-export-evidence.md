Export needs to reproduce the record as evidence, not summarise it.

Evidence
- `app/worklogs/[id]/exportToPDF.ts:239` prints a single `Created` timestamp, `:245` prints the date via `toLocaleDateString()`, and the signature block (`:367`) prints `Signed by` / `Role` / `Date`. There is no capture time, no receipt time, no clock offset, no record history, and no signature level.

Work
1. Header block, in plain labels a supervisor can read without the app:
   - site day (as filed) and the precise date/time of the entry
   - "recorded at" (device capture time) and "received by server at", both rendered in site timezone with the offset stated
   - the clock offset when it exceeded the threshold, as a visible note rather than small print
2. Per-signature block: signer name, role, signature level (`drawn` / `qualified`), server signing time, whether signing happened offline, and the content hash the signature covers.
3. Append the record history section at the end: every event from `worklog_events` (create, edits with reasons, signatures, rejection, approval, voiding), with actor and time. Original values next to corrected ones.
4. Add a document footer with the log id, the tenant, the export time and the exporting user — an exhibit has to identify itself.
5. Use a fixed locale and timezone for numbers and dates in the export (an export must not change meaning depending on the phone that generated it). Render in site timezone with an explicit label; never rely on the device default.
6. Cover the new sections from the legal-coverage task (ri-7) in the same layout pass, keeping the order of άρθρο 146.

Acceptance
- The exported PDF shows recorded-at and received-at, each labelled, with the timezone stated.
- A corrected log's PDF shows both values and the reason.
- The history section lists every event with actor and time.
- No date in the PDF is rendered from an unspecified device locale.

Note
- Also verify the server-side attachment path (`createWorkLogPdfAttachment`, used by the completion and rejection emails) renders the same content as the on-demand export; today they are two entry points into one renderer, so keep it to one renderer.
