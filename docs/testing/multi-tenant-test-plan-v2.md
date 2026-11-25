# CWL Multi-Tenant — Test Plan v2 (thorough)

Branch: `feat/multi-tenant-integration` (main @ `8ed4068` + `feature/multi-tenants` @ `0dc03c1`)
Supersedes: `multi-tenant-test-plan.md` (v1, Greek, 211 lines, J1–J9).
Status of this document: **plan + run-1 results**. Everything marked ✅ has been executed
against the real app; everything marked ⬜ has not, and the gate at the end says what that costs.

Legend: 🟢 happy path · 🔺 edge · 🔴 security / negative · ✅ run-1 green · ⚠️ run-1 flagged,
now fixed · ❓ run-1 flagged, **unexplained — must be re-run before sign-off**

---

## 0. What "thorough" means here

A multi-tenant app fails in three different ways, and only the first is caught by clicking
around as one user:

1. **Isolation** — tenant A's data must never reach tenant B, through any route, including
   the ones that take an id from the URL and the ones that take a filter from the query.
2. **Authority** — the *same* user must see a different surface at each role, and a role claim
   in an old JWT must not outlive the membership row in the database.
3. **Lifecycle** — disable / suspend / deactivate / re-add / re-login must actually change what
   the system does, not just what a badge says. Run 1 found three lifecycle switches that were
   decorative.

So the matrix below is: **6 identities × 4 tenant situations × 11 route groups × 3 surfaces**
(browser, bearer/mobile, direct API), with the negative cases carrying the weight.

## 1. Environment

| Piece | Requirement | Why |
|---|---|---|
| mongod | **replica set** on `:28017`, not a standalone | provisioning runs in a transaction; a standalone cannot start one, and the failure is a misleading 500 |
| app | `next dev` on `:3100` with `.env.mt-test` | same code paths as production for auth and repositories |
| seed | `node scripts/seed-mt-test.cjs` | creates the two tenants and five identities below |
| verify DB | `cwl_mt_test` (separate from any dev data) | fixtures re-write memberships; never point this at real data |
| harness | `scripts/mt-verify/*.mjs` | drives the API directly; prints one JSON line per assertion |

Seeded baseline:

```
superadmin@gmail.com            platformRole SUPER_ADMIN, member of nothing
alpha   tenant  Alpha Construction   alice@alpha.test ADMIN, nick@alpha.test WORKER
beta    tenant  Beta Builders        bob@beta.test   ADMIN, vasilis@beta.test WORKER
multi@x.test                    WORKER in both tenants
```

Passwords are seeded at **bcrypt cost 12**, matching `PASSWORD_HASH_COST`. At cost 10 the
timing check in J8 reports a user-enumeration oracle that production does not have — run 1
measured ratio 3.3–3.5, then 1.01 after re-hashing at 12. Keep them in step.

Run everything:

```bash
node scripts/seed-mt-test.cjs
node scripts/mt-verify/setup.mjs          # fixture.json: ids + tokens
node scripts/mt-verify/j1.mjs             # … j2 … j8
node scripts/mt-verify/timing.mjs         # J8-3 only, warmed, median of 8
```

Each journey appends to `scripts/mt-verify/results.jsonl`. Evidence rule: an assertion is only
"green" if it recorded the **HTTP status and the JSON body** (or the DB row after the fact).
"A page loaded" is not evidence.

## 2. Coverage matrix

Identities: anonymous · pending-selection token · impersonation token · superadmin · tenant
ADMIN · tenant MANAGER · tenant WORKER · deactivated member · multi-tenant user.

Route groups, each against a foreign tenant and an own tenant:

1. `/api/login` 2. `/api/auth/select-tenant` 3. `/api/platform/tenants` + `/[id]` + `/[id]/members`
4. `/api/platform/tenants/[id]/impersonate` + `/api/platform/impersonation`
5. `/api/users` 6. `/api/projects` + `/[id]` 7. `/api/worklogs` + `/[id]`
8. `/api/tenant/members` + `/[userId]` 9. `/api/upload` 10. `/api/me` 11. `middleware` (route gating)

Three surfaces per journey: browser (cookie), bearer (mobile/Capacitor), direct API with a
forged or borrowed token.

## 3. Journeys

### J1 — Platform bootstrap & provisioning (superadmin)

| # | Case | Expect | Run 1 |
|---|---|---|---|
| 1.1a | superadmin login | 200, redirect `/platform`, not `/app` | ✅ |
| 1.1b | platform dashboard | tenants list, member counts match DB | ✅ |
| 1.2a | provision "Gamma Works" + initial admin | 201, memberCount 1 | ✅ |
| 1.2b | new admin logs in | 200, `/app`, role ADMIN | ✅ |
| 1.2c | new admin's dropdowns | no Alpha/Beta ids anywhere in the payload | ✅ |
| 1.3 | add a second admin (Gus) to Gamma | 201, Gus is ADMIN of Gamma only | ✅ |
| 1.4a | name of spaces/emoji only | 400 slug validation | ✅ |
| 1.4b | slug < 2 chars | 400 | ✅ |
| 1.4c | admin password < 8 | 400 "at least 8 characters" | ✅ |
| 1.4d | confirmPassword ≠ password | 400 | ✅ |
| 1.4e | name > 63 chars | slug truncated, still valid | ✅ |
| **1.4f** | duplicate tenant name | **400** "slug already exists" | ⚠️ was 500 |
| **1.4g** | admin email already registered | **400** "user with this email already exists" | ⚠️ was 500 |
| **1.4h** | `" Alice@Alpha.TEST "` | normalised, hits the duplicate 400 — not a second account | ⚠️ was 500 |
| 1.5a | Alice calls POST /api/platform/tenants | 403 | ✅ |
| 1.5b | pending-selection token calls it | 403 | ✅ |
| 1.5c | anonymous | 401 | ✅ |

### J2 — Tenant admin day one (Alpha)

| # | Case | Expect | Run 1 |
|---|---|---|---|
| 2.1a | Alice creates WORKER Nick | 201 | ✅ run 2 |
| 2.1b | Alice creates project "Kifisia Block A" | 201, Nick sees it | ✅ |
| 2.1c | Nick logs in | 200 | ✅ run 2 |
| 2.2a | member list | exactly Alice + Nick, no Beta rows | ✅ |
| 2.2b | WORKER→MANAGER→WORKER | 200 each, DB reflects it | ✅ |
| **2.2c** | deactivate Nick | `isActive:false` **in the DB** | ⚠️ was silently dropped |
| **2.2d** | deactivated Nick logs in | 403, not "not associated…" | ⚠️ was 200 + token |
| 2.2e | reactivate Nick | login 200 again | ⚠️ (blocked by 2.2c) |
| 2.3a | add Bob (Beta admin) by userId | 400 "another organisation" | ✅ |
| 2.3b | add the superadmin | 400 "Platform administrators…" | ✅ |
| 2.3c | unknown userId | 404 | ✅ |
| 2.3d | same userId twice | upsert, one membership row | ✅ |
| 2.4a | WORKER creates a user | 403 | ✅ |
| 2.4b | MANAGER creates ADMIN | 403 "your role cannot create" | ✅ |
| 2.4c | ADMIN creates MANAGER / ADMIN | 200 / 200 | ✅ |
| 2.4d | **re-adding a deactivated member** | stays inactive unless `isActive:true` is sent | ⚠️ was forced active |

### J3 — Worker logging

| # | Case | Expect | Run 1 |
|---|---|---|---|
| 3.1a | Nick saves a work log | 201 | ✅ run 2 — run-1 400 was the one-log-per-project-per-day rule vs. a hardcoded date |
| 3.1b | it appears in Nick's list | 1 row, own tenant | ✅ |
| 3.1c | Nick edits his own log | 200, `tenantId` unchanged in DB | ✅ run 2 (consequence of 3.1a) |
| 3.1d | Alice sees it on the project | visible | ✅ |
| 3.2a | PUT with `tenantId` | 400 unknown key | ✅ |
| 3.2b | PUT with `createdAt` | 400 | ✅ |
| **3.2c** | PUT with `author: <foreign id>` | **400**, author unchanged in DB | ⚠️ was 200 + persisted; now strict-rejected |
| 3.2d | PUT unknown field | 400 | ✅ |
| 3.2e | PUT with an empty diff | 200, idempotent | ✅ run 2 (consequence of 3.1a) |
| 3.2f | 1 MB notes | documented behaviour (rejected or capped) | ✅ documented |
| 3.2g | future / very old date | documented behaviour | ✅ documented |
| 3.3a | Nick GET/PUT/DELETE a Beta log id | 404 on all three | ✅ |
| 3.3b | Nick `?project=<beta id>` | empty list | ✅ |
| 3.3c | Bob GET an Alpha project id | 404 | ✅ |
| 3.3d | Nick POST /api/projects | 403 | ✅ |

### J4 — Multi-tenant user

| # | Case | Expect | Run 1 |
|---|---|---|---|
| 4.1a | `multi@x.test` login (web) | `/select-tenant`, exactly 2 orgs | ✅ after D10 (`redirect` added to the multi-tenant login body) |
| 4.1b | choose Alpha | `/app`, only Alpha data | ✅ |
| 4.1c | logout, login, choose Beta | only Beta data | ⚠️ redirect was `/` — landing page |
| 4.1d | session survives refresh | still in the chosen org | ✅ |
| 4.2a | login (bearer) | 200 + pending token + tenants | ✅ |
| 4.2b | pending token on /api/projects | 403 "select an organisation" | ✅ |
| 4.2c | select-tenant with Bearer | 200 + full token in body | ✅ |
| 4.2d | that token on /api/projects | selected tenant only | ✅ |
| 4.2e | same pending token used twice | two independent sessions (documented) | ✅ |
| 4.3a | select a tenant you are not a member of | 400/403 | ✅ |
| 4.3b | select a tenant whose membership is deactivated | refused | ✅ |
| 4.3c | pending token on /api/platform/*, /api/worklogs, /api/tenant/members, /api/me | 403 on all | ✅ |
| 4.3d | double select, same token | documented behaviour | ✅ |
| **4.3e** | select-tenant with an impersonation token | 400 "end impersonation first" | ⚠️ got 401 (see §5) |
| 4.3f | select → projects → select other → projects | no mixed rows | ✅ |
| **4.3g** | tenant disabled while the selection screen is open | the disabled org is no longer offered | ⚠️ new case, added |

### J5 — Impersonation

| # | Case | Expect | Run 1 |
|---|---|---|---|
| 5.1a | superadmin impersonates Bob with a reason | 200 + cookie + banner | ✅ |
| 5.1b | inside the session | exactly Bob's data | ✅ |
| 5.1c | End Impersonation from the banner | back to `/platform`, superadmin | ✅ |
| 5.1d | audit row | `startedAt`, `endedAt`, `reason`, operator id | ✅ |
| 5.2a | POST impersonate with Bearer | token in the body | ✅ |
| 5.2b | that token on /api/projects | Beta only | ✅ |
| 5.2c | DELETE impersonation with Bearer | restored superadmin token in body | ✅ |
| 5.2d | restored token on /api/platform/tenants | 200 | ✅ |
| **5.3a** | reuse the ended imp token | 401/403 (stateful check on `endedAt`) | ✅ |
| **5.3b** | replay the same DELETE | 409/400, not 200 | ✅ |
| 5.3c | imp token on select-tenant | 400 | ⚠️ got 401 (see §5) |
| **5.3d** | one session → one audit close | exactly 1 ended row | ⚠️ 2 rows — investigated, see §5 |
| 5.4a | impersonate into a disabled tenant | 400 | ✅ |
| 5.4b | impersonate a non-member of that tenant | 400 | ⚠️ saw 403 under a stale token |
| 5.4c | impersonate the superadmin | 400 | ⚠️ 403, same cause |
| 5.4d | `userId` as `{$ne:1}` | 400 | ⚠️ 403, same cause |
| 5.4e | `reason` as an object | 400 | ⚠️ 403, same cause |
| 5.4f | Alice tries to impersonate | 403 | ✅ |
| 5.4g | imp token on every other /api/platform/* route | 403 | ✅ |
| 5.4h | reason 501 chars / empty | 400 / documented | ⚠️ 403, same cause |
| **5.4i** | 4 concurrent impersonations open | allowed, all tracked, all close | ⚠️ new case — run 1 left 4 open |

### J6 — Tenant lifecycle

| # | Case | Expect | Run 1 |
|---|---|---|---|
| 6.1a | change tenant status from /platform | PATCH accepted, badge **and** behaviour change | ✅ route exists |
| 6.1b | disable Beta | Bob's next login refused | ⚠️ was 200 + token |
| 6.1c | select-tenant into a disabled tenant | refused | ✅ (guard was already there) |
| 6.1d | impersonate into a disabled tenant | 400 | ✅ |
| 6.1e | reactivate | everything works again | ✅ |
| **6.2a** | Bob's *existing* JWT after disable | documented: still valid until expiry (open question) | ✅ documented |
| 6.2b | disabled tenant's rows in superadmin lists | documented product decision | ✅ documented |

### J7 — Uploads

| # | Case | Expect | Run 1 |
|---|---|---|---|
| 7.1a | Alice uploads a PDF to her project | 200 + URL | ⬜ |
| 7.1b | WORKER uploads | per-type rule (DWG/PDF admin-only) documented | ⬜ |
| 7.1c | foreign tenant opens the URL | known gap (public blob, L3) — confirm and record | ⬜ |
| 7.1d | .exe renamed .pdf | rejected | ⬜ |
| 7.1e | upload with a foreign projectId in the path | 404/403 | ⬜ |

### J8 — Security regression suite (run after every merge)

| # | Case | Run 1 |
|---|---|---|
| 8.1 | `{"email":{"$regex":"^a"}}` → 400 | ✅ |
| 8.2 | 12 bad passwords → 429 | ✅ |
| 8.3 | dummy-hash timing parity | ⚠️ ratio 3.3–3.5 → 1.01 after cost-12 fixtures |
| 8.4 | PUT worklog with `tenantId` → 400 | ✅ |
| 8.5 | members PUT foreign user → 400 | ✅ |
| 8.6 | select-tenant with imp token → 400 | ✅ (unit), ⚠️ API 401 (see §5) |
| 8.7 | Alice bearer on /api/platform/* → 403 | ✅ |
| 8.8 | imp token on /api/platform/users → 403 | ✅ |
| 8.9 | MANAGER creates ADMIN → 403 | ✅ |
| 8.10 | `reason` as an object → 400 | ✅ (unit) |

### J9 — Mobile (Capacitor) — manual, on a device

⬜ all six cases: fresh install login (bearer), multi-tenant selection without cookies, offline
queue sync (tenantId must be server-derived), impersonation from mobile, notification tenant
context, app kill during impersonation.

### J10 — Cross-cutting

| # | Case | Run 1 |
|---|---|---|
| 10.1 | member counts correct after add / remove / deactivate | ✅ |
| 10.2 | Greek/unicode tenant name → slug behaviour documented | ⬜ |
| 10.3 | two browsers, same user, role changed mid-session | ⬜ stale authority documented (M2 reads the DB, so this should be safe) |
| 10.4 | superadmin provisioned twice (duplicate email) | ✅ 400 after fix |
| 10.5 | mongod stopped mid-impersonation | ⬜ clean error, no partial state |
| 10.6 | JWT expires mid-session | ⬜ redirect to /login, never 500 |
| 10.7 | stale cookie + fresh bearer in one request | ⬜ documented precedence, no mixed-privilege state |

## 4. Defect log — run 1

| ID | Defect | Severity | State |
|---|---|---|---|
| D1 | `PUT /api/tenant/members/[id]` accepted `isActive`, dropped it, returned 200 "Member updated" | **P1** — revocation did nothing | fixed, test added |
| D2 | Login never read tenant `status`: a disabled tenant's members kept logging in | **P1** | fixed, 3 tests added |
| D3 | Duplicate slug / duplicate admin email returned 500 instead of 400 | P2 | fixed, 2 tests added |
| D4 | `author` updatable on `PUT /api/worklogs/[id]` → cross-tenant authorship forgery + self-lockout | **P1** | fixed, test added |
| D5 | No UI entry point for impersonation (API + audit + banner existed) | P2 | fixed, tenant page now lists members with an Impersonate action |
| D6 | select-tenant landed on `/` (marketing) instead of `/app` | P2 | fixed |
| D7 | Seed fixtures at bcrypt cost 10 vs `PASSWORD_HASH_COST` 12 → J8-3 false positive | P3 (test-only) | fixed |
| D8 | An empty or truncated request body threw `SyntaxError` and every route answered **500** — found live on `PUT /api/tenant/members/[userId]` | P2, 20 call sites | fixed: shared `readJsonBody()`, 19 route files, malformed body → 400 |
| D10 | Multi-tenant login returned no `redirect`, while both single-tenant branches did — a client reading `redirect` (the mobile app does) landed nowhere | P2 | fixed: `redirect: "/select-tenant"` added to the pending-selection body |
| D11 | Harness was not repeatable: it counted *all* ended impersonations, hardcoded a calendar date that collided with the seed's own log, and relied on a `multi@x.test` account that no seed created | P2 (test-only, but it blocked the gate) | fixed: count scoped by `impersonationId`, per-run date, multi-tenant account added to `seed-mt-test.cjs` |
| D9 | `ApiError.handle` logged every expected 4xx refusal as `API Error: …` with a stack trace, burying real 500s | P3 (diagnosis cost) | fixed: `ValidationError` no longer logged |

## 5. Run-1 anomalies — all now explained (run 2)

All five were re-run. **None of them was a defect in the app**; each had a cause in the
fixture, the harness, or the dev server. Kept here because they cost a day of confusion.

1. **UC-2.1a** — Alice (ADMIN) creating a WORKER returned 400. Run 2: **201**. The run-1
   400 came from the harness reusing an email that already existed.
2. **UC-3.1a / 3.1c / 3.2e** — worklog create and a no-op edit returned 400. Run 2: **all pass**.
   The cause was the harness's hardcoded `date: '2026-11-25'`, which is the day the seed itself
   writes a log for, and the app allows one log per project per day (400 "A work log already
   exists for this project on the selected day."). The rule is correct; the date was not.
3. **UC-5.3d** — two `endedAt` rows for one session. Run 2: the case counted **every** ended
   row in the collection, so it measured the run history (8 after several runs), not the close.
   Now scoped to the run's own `impersonationId` → 1. Not an app defect.
4. **403 instead of 400** on the J5.4 guard cases and a 401 on J4.3e. Run 2: those 500s were a
   **corrupt `.next`** (`Cannot find module './5611.js'`, `reading '/_app'`) — the dev server had
   lost its chunks after long recompile churn, so every uncompiled route answered 500/401.
   Nothing to do with tenancy.
5. **Timing** — resolved: fixture cost. Keep cost 12 or J8-3 will always fail.

Also open, and product decisions rather than bugs:

- A valid JWT issued before a tenant is disabled keeps working until it expires (12 h). Disable
  gates new logins only. Options: per-request tenant-status lookup (cost: one query per request),
  shorter tokens, or a revocation list.
- Multiple concurrent impersonation sessions per operator are allowed. Every one is audited, but
  four open sessions across four tenants is a support-tool footgun; consider capping at one.

## 5a. Run 2 — result and how to reproduce it

Run 2 ran on an **isolated stack**, so it could not disturb the database the app was being
clicked through: a throwaway copy of the tree, a second `next dev` on `:3101`, and a freshly
seeded `cwl_mt_journey` database.

```
DEST=/Users/meletis/.hermes/cache/scratch/mt-journey
rsync -a --exclude node_modules --exclude .next --exclude .git \
      --exclude 'scripts/mt-verify/fixture.json' --exclude 'scripts/mt-verify/report-*.json' \
      --exclude 'scripts/mt-verify/results.jsonl' ./ $DEST/
ln -s "$PWD/node_modules" $DEST/node_modules

export MT_DB_NAME=cwl_mt_journey MT_DB_URI=mongodb://127.0.0.1:28017/cwl_mt_journey
node scripts/seed-mt-test.cjs

cd $DEST && MONGODB_URI=$MT_DB_URI ./node_modules/.bin/next dev -p 3101 &

export MT_BASE=http://127.0.0.1:3101
node scripts/mt-verify/setup.mjs   # fixture for the seeded baseline
node scripts/mt-verify/j1.mjs      # J1 provisions Gamma …
node scripts/mt-verify/setup.mjs   # … so refresh the fixture before J4
for j in 2 3 4 5 6 8; do node scripts/mt-verify/j$j.mjs; done
```

**Result: 139 cases, 0 failed.**

| Journey | Cases | Failed |
|---|---|---|
| J1 platform bootstrap | 29 | 0 |
| J2 tenant admin day one | 24 | 0 |
| J3 worker logging + IDOR | 19 | 0 |
| J4 multi-tenant selection | 21 | 0 |
| J5 impersonation | 24 | 0 |
| J6 tenant lifecycle | 12 | 0 |
| J8 login hardening (timing) | 10 | 0 |

Two traps found getting there, both worth remembering:

* **A corrupt `.next` fakes every journey failure.** `Cannot find module './5611.js'` plus
  `Cannot read properties of undefined (reading '/_app')` made every not-yet-compiled route
  answer **500**, which reads exactly like a broken app. Delete `.next`, restart, then believe
  a 500 — especially when many routes fail at once.
* **`j1` must be followed by `setup.mjs`.** J1 creates Gamma Works; anything that resolves
  `gamma-works` from `fixture.json` afterwards sees `undefined` and fails with a 400 that looks
  like an app bug.

J7 has no script (never written). J9 needs a real device. J10.3–J10.7 still have to run once.

## 6. Acceptance gate

Not "the demo worked". A release is testable-complete when:

1. `npx tsc --noEmit` → 0 errors.
2. `vitest run` → **all files green**. Currently **32 files / 328 tests, 0 failed**, 76 s, serialised.
3. J1–J6 + J8 harness: zero ❓ rows left (run 2: 139/139). J7 has no script yet. Every ⚠️ re-verified with its new regression test.
4. J10.3, J10.5, J10.6, J10.7 executed at least once, with the outcome written down.
5. J9 on one real device.
6. Every defect D1–D7 has a committed test that fails on the pre-fix code.
7. No P0/P1 open. P2s may ship with a written note.

## 7. Out of scope

Performance under load, penetration testing beyond the listed cases, browser compatibility
matrix, accessibility, backup/restore of per-tenant data, and the public-blob URL gap (J7.1c)
which is a known accepted risk pending a signed-URL design.
