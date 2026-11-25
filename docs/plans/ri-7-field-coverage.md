Close the gap between the current work log and the field set the ημερολόγιο έργου legally carries (Ν.4412/2016 άρθρο 146), and model anything that can go wrong as an item with a deadline rather than a count.

Part A — legal field coverage

Άρθρο 146 requires, in summary: weather conditions over the 24 hours (α); personnel by category, including staff idle through the employer's delay (β); machines used and machines idle through the employer's delay (γ); position and description of works, plus works with no progress and the reasons (δ); start and finish times of critical works (ε); arrivals and departures of main equipment (στ); traffic-arrangement conditions and problems with them (ζ); materials delivered and works executed (η); laboratory tests (θ); delays, difficulties, accidents, damage, unusual conditions, and stoppage/restart times (ι); **instructions and observations of the supervising organ** (ια); incidents (ιβ); significant visits or communications with authorities or adjoining owners (ιγ); anything else material (ιδ). The log is signed by the contractor's representative and the supervising organ when present, and the detachable leaf reaches the supervising service within 7 days.

Already covered: weather/temperature, personnel by role, equipment, work description, materials.
Missing: staff idle through employer delay; idle machines and the cause; work location; works with no progress + reason; critical-work start/end times; equipment arrivals/departures; traffic arrangements; lab tests; delays/accidents with stop and restart times; supervising-organ instructions; visits and communications; the 7-day forwarding.

Work
1. Extend the sections on the form: `labourIdle[]`, `equipmentIdle[]`, `stoppages[]` (cause, from, to), `instructions[]` (issuing organ, text, time), `visits[]`, `labTests[]`, `trafficArrangements`, `location` (per entry, from the project's locations), and a `noProgress` note on the work description.
2. Keep the field names in a single bilingual label map (the app is Greek-facing: `lib/constants/constantValues.ts` already holds the Greek form labels) so the PDF and the UI never drift apart.
3. Extend the PDF layout to render the new sections in the order the article lists them — an επίβλεψη reading the export should be able to follow the article top to bottom.
4. Add a "completeness" indicator that is advisory only: never block a save because a rarely-filled field is empty. A field worker who cannot file a log is worse than a log with an empty section.
5. Confirm the taxonomy question with a real civil engineer: whether the work description should reference ΕΤΕΠ (442 in force) / ΑΤΟΕ item codes. Design the field so an item code can be attached later without a migration.

Part B — idle equipment and deferrals (from the aviation technical log)

Evidence
- `Equipment` (`lib/repositories/WorkLogRepository.ts:20`) is `{ type, count, hours? }` and `issues` is free text. A machine that broke on Tuesday and is still down on Friday is invisible as an open item; nothing computes a deadline, nothing flags it on later logs.

Work
1. Model an open item: `{ assetId|type, openedOn, openedByLogId, description, cause, category, deadline, status: open|closed, closedByLogId, closedAt, closureNote }`.
2. Borrow the aviation category/deadline semantics: a category whose rectification interval starts **the day after discovery**, excluding the discovery day. Map the local equivalents for construction (for example: safety-critical before the next shift; 3 days; 10 days; 120 days) and put the mapping in one table that the product owner signs off.
3. Show open items on every later log for that project with their remaining time, so the daily log becomes the mechanism that keeps them visible — which is exactly what a deferred defect does in a technical log.
4. Close only by an explicit act, with a note, by an authorised role; closure is an event in the evidence trail (see Phase 1, ri-4).
5. Do the same for the άρθρο 146 categories that are structurally similar: stoppages with a cause, and instructions from the supervising organ that stay open until answered.

Acceptance
- A machine reported idle on one log appears as an open item on subsequent logs until explicitly closed, with a deadline and a remaining time.
- An instruction from the επίβλεψη stays open until answered, and the answer is attributable and timestamped.
- The PDF shows open items with their ages at the time of export.
