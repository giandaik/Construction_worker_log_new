# Code Vulnerability Scan — Scan 1

**fp issue:** CWL-eaeeygzg (parent CWL-lyljhwbl)
**Date:** 2026-08-27
**Commit scanned:** `e329bff` (branch `main`)
**Scope:** `app/`, `components/`, `lib/`, `hooks/`, `utils/auth.ts`, `middleware.ts`, `middleware-helpers.ts`
**Method:** read-only static review. Every finding below was confirmed by reading the cited lines; no source file was modified. Exploitability claims marked *confirmed* were reasoned through against the actual installed dependency versions (`next@15.5.19`, `react@18.3.1`, `zod@3.25.76`, `bcryptjs@3.0.3`, `jose@6`).

**Stack correction (affects several categories):** `CLAUDE.md` describes Firebase Authentication, Vite and Express. None of that is on disk. Authentication is a self-issued HS256 JWT (`jose`) in an httpOnly cookie plus a mobile bearer token; persistence is the **raw MongoDB driver** via `lib/repositories/`, not Mongoose models. The raw-driver detail matters: there is no schema-level casting or field stripping between a request body and `insertOne` / `$set`, which is the root cause of findings H-1, H-3 and C-1.

---

## Summary table

| # | Finding | Severity | File | One-line description |
|---|---|---|---|---|
| C-1 | Stored XSS via unvalidated `images[]` rendered into `href` | **CRITICAL** | `app/worklogs/[id]/page.tsx:549` | Any worker can store a `javascript:` URL in a worklog photo list; an admin clicking the tile runs attacker JS in-origin → can create an admin account. |
| H-1 | No server-side schema validation on worklog create/update | **HIGH** | `app/api/worklogs/route.ts:83`, `app/api/worklogs/[id]/route.ts:62` | Raw request body is spread straight into `insertOne`/`$set`; enables C-1, H-2 and author reassignment. |
| H-2 | Blind SSRF in server-side PDF generation | **HIGH** | `app/worklogs/[id]/exportToPDF.ts:50-51` | `fetch()` on any string in `images[]`, invoked from two API routes with no scheme/host allowlist. |
| H-3 | NoSQL operator injection in the login route | **HIGH** | `app/api/login/route.ts:23` | Unauthenticated `{"email":{"$regex":…}}` + non-string password gives a 500/401 boolean oracle → enumerate every registered email. |
| H-4 | SMTP TLS certificate verification disabled | **HIGH** | `lib/email/sendEmail.ts:63` | `rejectUnauthorized: false` — an on-path attacker captures the Gmail app password and every worklog PDF (names + e-signatures). |
| H-5 | IDOR: any authenticated user reads any worklog | **HIGH** | `app/api/worklogs/[id]/route.ts:18-37` | `GET` has no auth guard and no ownership/project check; returns signatures, photos and personnel names for any id. |
| H-6 | Hardcoded default admin credentials | **HIGH** | `lib/repositories/UserRepository.ts:113` | `default@example.com` / `changeme123` auto-provisioned as `role: 'admin'` when the users collection is empty. |
| M-1 | No token revocation; role is trusted from the JWT for 12 h | **MEDIUM** | `utils/auth.ts:112-128` | No DB lookup on verify — a deleted or demoted user keeps their old role until the token expires. |
| M-2 | Mass assignment lets an author reassign worklog authorship | **MEDIUM** | `app/api/worklogs/[id]/route.ts:62,149` | `author` is normalized and `$set` from the client body, forging attribution on a signed legal record. |
| M-3 | No rate limiting or lockout on any auth endpoint | **MEDIUM** | `app/api/login/route.ts:8` | Unlimited credential stuffing / password spraying against `/api/login` and `/api/signup`. |
| M-4 | All user emails exposed to every authenticated user | **MEDIUM** | `app/api/users/route.ts:7-24` | `GET /api/users` has an authN check but no `isAdmin`; `findSummary()` projects `email` and `role`. |
| M-5 | Project owner/contractor emails exposed to every authenticated user | **MEDIUM** | `app/api/projects/route.ts:6-33` | `GET` has no route-level guard; `findSummary()` projects `ownerEmail`, `contractorEmail`. |
| M-6 | Internal exception messages returned to clients | **MEDIUM** | `lib/api/errorHandling.ts:25-30` | `error.message` echoed verbatim in 500 bodies — driver errors and env-var config errors leak. |
| M-7 | Four API routes rely solely on middleware for authN | **MEDIUM** | `app/api/worklogs/[id]/route.ts:18`, `app/api/projects/route.ts:6`, `app/api/projects/[id]/route.ts:6`, `app/api/projects/default/route.ts:4` | No defence in depth; the mobile static export ships without middleware entirely. |
| M-8 | Any authenticated user can create a worklog on any project | **MEDIUM** | `app/api/worklogs/route.ts:92` | `data.project` is never checked against the caller's project assignment. |
| L-1 | Uploaded photos and signatures stored with public blob access | LOW | `app/api/upload/route.ts:33-36` | `access: 'public'` — unauthenticated, unexpiring URLs to site photos and e-signature images. |
| L-2 | `z.string().url()` accepts `javascript:` and `data:` schemes | LOW | `app/api/projects/[id]/dwgs/route.ts:8,12` | Admin-reachable second path to the C-1 sink via `project.dwgFiles`. |
| L-3 | `http://localhost` allowlisted for credentialed CORS in production | LOW | `lib/cors.ts:22,52` | Any page served on the victim's port 80 is a permitted credentialed origin. |
| L-4 | `GET` requests perform writes | LOW | `app/api/projects/default/route.ts:23`, `app/api/projects/route.ts:10` | `insertOne` on a `GET`; violates safe-method semantics and is cache/prefetch triggerable. |
| L-5 | No security response headers | LOW | `next.config.mjs` | No CSP, HSTS, `X-Content-Type-Options` or frame-ancestors policy — CSP would have blunted C-1. |
| L-6 | Recipient email addresses written to server logs | LOW | `lib/email/sendEmail.ts:82,128,147` | PII in logs; stripped from production builds by `compiler.removeConsole`, so dev/preview only. |
| L-7 | Signup reveals whether an email is registered | LOW | `app/api/signup/route.ts:23-25` | `"Email is already in use"` is an unauthenticated account-existence oracle. |
| L-8 | Weak password policy | LOW | `lib/schemas/userSchema.ts:10` | 8 characters, no complexity, no breach-list check, no maximum. |

---

## Detailed findings

### C-1 — CRITICAL — Stored XSS: unvalidated `images[]` rendered into an `href`

**Location:** `app/worklogs/[id]/page.tsx:546-560` (sink), `app/api/worklogs/route.ts:83,137-141` and `app/api/worklogs/[id]/route.ts:52,62,149` (injection point)

The worklog detail page wraps each photo in an anchor whose `href` is the raw stored string:

```tsx
// app/worklogs/[id]/page.tsx:547-556
{workLog.images.map((src, index) => (
  <a key={index} href={src} target="_blank" rel="noopener noreferrer" …>
    <Image src={src} … />
```

`images` is never validated server-side. `lib/schemas/workLogSchema.ts:48` declares it as `z.array(z.string()).optional()` — no URL or scheme constraint — and, more importantly, **that schema is never applied on the server**. Grepping every usage of `workLogSchema` returns exactly two hits, both the client-side `zodResolver` in `app/worklogs/[id]/edit/page.tsx:50`. `POST /api/worklogs` reads `await request.json()` at line 83 and spreads it at line 137; `PUT /api/worklogs/[id]` spreads it at line 62. Because `lib/repositories/` uses the raw MongoDB driver (`BaseRepository.create` → `insertOne`, `BaseRepository.update` → `$set`, `lib/repositories/base/BaseRepository.ts:73,95-99`), there is no schema layer to strip or cast the value either.

React 18.3.1 is installed. React 16.9+ emits a console warning for `javascript:` URLs in `href` but **still renders the attribute**; blocking only landed in React 19. Confirmed via `node_modules/react/package.json` → `18.3.1`.

`next/image`'s `remotePatterns` allowlist (`next.config.mjs:6-13`) rejects the non-blob host, so the thumbnail renders broken — but the anchor remains clickable across the full tile area.

**Exploitability path (confirmed):**
1. Attacker is any user with the lowest role (`user`/worker) — self-registration via `POST /api/signup` is open.
2. They `POST /api/worklogs` with `{"date":"…","project":"<any id>","workDescription":"…","images":["javascript:fetch('/api/users',{method:'POST',body:JSON.stringify({name:'x',email:'x@e.com',password:'aaaaaaaa',role:'admin'}),headers:{'Content-Type':'application/json'}})"]}`. No validation rejects it. (Note H-8: `project` need not be one of theirs.)
3. A supervisor or admin opens `/worklogs/<id>` and clicks the broken photo tile.
4. The `javascript:` URL executes in the app's own origin. The session cookie is `httpOnly` so it cannot be read, but it **is** attached to same-origin requests the script makes. If the viewer is an `admin` or `manager`, `POST /api/users` succeeds (`app/api/users/route.ts:32`) and the attacker now owns a persistent admin account. Lesser targets still allow approving/rejecting worklogs as the victim.

That is privilege escalation from the lowest role to full admin, gated only on one click.

**Remediation:**
1. Validate `images[]` server-side with a scheme allowlist, not `z.string()`. Reject anything that is not an `https:` URL on the blob host:
   ```ts
   const blobUrl = z.string().url().refine(
     (u) => { const p = new URL(u); return p.protocol === 'https:' && p.hostname.endsWith('.public.blob.vercel-storage.com'); },
     'images must be https Vercel Blob URLs',
   );
   ```
2. Apply a **server-side** Zod schema to `POST /api/worklogs` and `PUT /api/worklogs/[id]` and persist only `parsed.data` — never `{...requestData}`. This closes H-1, H-2 and M-2 at the same time.
3. Sanitise at the sink as defence in depth: a `safeHref()` helper returning `undefined` for anything not `https:`/`http:`, applied at `page.tsx:549`, `:596`, `:606` and `components/forms/DwgUpload.tsx:256,267`.
4. Add a CSP without `unsafe-inline` (see L-5); it would neutralise this class of sink.

---

### H-1 — HIGH — No server-side schema validation on worklog create/update

**Location:** `app/api/worklogs/route.ts:83,137-141`; `app/api/worklogs/[id]/route.ts:52,62,149`

```ts
// app/api/worklogs/route.ts:137-141
const workLogData = { ...data, author: user.userId, status };
const workLog = await workLogRepo.create(workLogData);
```

```ts
// app/api/worklogs/[id]/route.ts:62
let updateData = { ...requestData };
// …:149
const workLog = await workLogRepo.update(id, updateData);
```

Every other write route in the tree validates (`app/api/projects/route.ts:47`, `app/api/users/route.ts:39`, `app/api/projects/[id]/catalog/route.ts:18`, `app/api/projects/[id]/dwgs/route.ts:31`). The worklog routes — the ones handling the PII, the photos and the e-signatures — are the two that do not. `lib/schemas/workLogSchema.ts` exists but is wired only into the client form resolver.

Two mitigations that *do* hold, and are worth recording so the fix is scoped correctly: `author` and `status` are overwritten **after** the spread on create (lines 139-140) and `status` is overwritten after the spread on update (line 132), so neither can be forged. `_id` cannot be injected on update either — MongoDB rejects `$set` on an immutable field and the route 500s.

**Exploitability path:** this is the enabler for C-1 (arbitrary `images[]` strings), H-2 (arbitrary `images[]` URLs reaching a server-side `fetch`) and M-2 (arbitrary `author`). Independently, any authenticated user can write unbounded arbitrary keys into worklog documents — a cheap storage-exhaustion and data-integrity vector against a collection that is meant to be an auditable legal record.

**Remediation:** define a request schema per route (create vs. update, with the update variant `.partial()`), `safeParse` it, and pass only `parsed.data` to the repository. Use `.strict()` so unknown keys are rejected rather than silently persisted.

---

### H-2 — HIGH — Blind SSRF in server-side PDF generation

**Location:** `app/worklogs/[id]/exportToPDF.ts:50-51` (sink), `:334` (call), invoked server-side from `app/api/worklogs/route.ts:183-184` and `app/api/worklogs/[id]/route.ts:170-171`

```ts
// app/worklogs/[id]/exportToPDF.ts:50-52
async function fetchAsDataUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
```

```ts
// app/worklogs/[id]/exportToPDF.ts:334
const dataUrl = src.startsWith('data:') ? src : await fetchAsDataUrl(src);
```

Despite living under `app/worklogs/[id]/`, `createWorkLogPdfAttachment` runs **on the server**: it is imported and awaited by two API route handlers when an owner signature is added, to attach the PDF to the completion email. There is no scheme allowlist, no host allowlist, no redirect cap and no timeout. `next.config.mjs`'s `images.remotePatterns` does not apply — this is a bare `fetch`, not `next/image`.

**Exploitability path (confirmed):**
1. Any authenticated user creates a worklog with `images: ["http://<internal-host>:<port>/<path>"]` — H-1 means nothing validates it.
2. The worklog reaches `completed` (contractor signs, then project owner signs). `PUT /api/worklogs/[id]` calls `createWorkLogPdfAttachment` at line 171.
3. The server issues a GET to the attacker's chosen host from inside the deployment's network. Reachable targets include the app's own loopback interface, anything in the same VPC/private network as the MongoDB instance, and internal service endpoints not exposed publicly.
4. It is blind in the general case — `doc.getImageProperties()` throws on non-image bytes and the error is caught at line 419 — but response/error timing and the presence or absence of the image in the delivered PDF give a reliable oracle for internal host and port discovery.
5. **Content exfiltration** is possible where the attacker also controls the destination: the fetched bytes are base64-embedded in the PDF and emailed to `projectOwnerEmail` / `projectContractorEmail`. A `manager` (who satisfies `isAdmin`, `utils/auth.ts:137`) can create a project naming an attacker-controlled mailbox as owner, then use that project to exfiltrate any internal endpoint that returns image-parseable bytes.

Note that a cloud instance-metadata endpoint is not reachable on Vercel Functions specifically, so this is scoped to internal-network reach rather than a credential-theft-by-IMDS scenario — but it is a full unauthenticated-to-internal request primitive for any logged-in worker.

**Remediation:**
1. Fix at the source with the `images[]` blob-host allowlist from C-1 — that alone removes the primitive.
2. Additionally harden `fetchAsDataUrl`: reject non-`https:` schemes, allowlist the blob hostname, set `redirect: 'error'`, add an `AbortSignal.timeout(5000)`, and cap the response size before buffering.
3. Reject non-image `Content-Type` before `blob.arrayBuffer()`.

---

### H-3 — HIGH — NoSQL operator injection in the login route

**Location:** `app/api/login/route.ts:10,12,23,25,64-69`

```ts
// app/api/login/route.ts:10-25
const { email, password } = await request.json();
if (!email || !password) { … 400 … }
await dbConnect();
const usersCollection = mongoose.connection.collection("users");
const user = await usersCollection.findOne({ email });
if (!user || !user.password || !(await compare(password, user.password))) { … 401 … }
```

`email` is placed into the filter as an object with no type check. `mongoose.connection.collection()` returns a thin wrapper over the native driver collection — there is no Mongoose schema casting on this path — so a JSON object value is interpreted as a query operator. The `!email` guard does not help: `{"$ne": null}` is truthy.

This does not bypass authentication on its own (`bcryptjs.compare` still needs the real password), but it yields a clean unauthenticated boolean oracle:

**Exploitability path (confirmed):** `bcryptjs@3.0.3` `compare()` rejects with `Error("Illegal arguments: …")` when either argument is not a string (`node_modules/bcryptjs/index.js:248-258`). The login route's outer `catch` turns that into **500 `"Failed to login"`** (lines 64-69). A non-matching email short-circuits at `!user` and returns **401 `"Invalid credentials"`**. So:

```json
POST /api/login  {"email": {"$regex": "^a"}, "password": {"not":"a string"}}
```

- 500 → at least one registered address matches `^a`
- 401 → none do

Unauthenticated, deterministic, no timing analysis needed. Walking the regex character by character enumerates the complete list of registered email addresses. With no rate limiting (M-3) this runs at full speed. `{"email":{"$regex":"^admin"}}` locates privileged accounts directly, which then feed credential stuffing against the same unthrottled endpoint.

Even with a string password the bcrypt cost-12 comparison (~250 ms) versus the immediate 401 leaves an obvious timing oracle, so type-checking the password alone is not a sufficient fix.

**Remediation:**
1. Type-check both fields before the query: `if (typeof email !== 'string' || typeof password !== 'string') return 400`.
2. Validate the body with Zod (`z.object({ email: z.string().email(), password: z.string() })`), consistent with the other write routes.
3. Always compare against a dummy bcrypt hash when the user is not found, so the response time is constant regardless of account existence.
4. Never let an unexpected exception on this path become a distinguishable status code — return 401 for any credential-verification failure and log the real cause server-side only.

**Also on this path (not security-relevant, worth cleaning while you are in the file):** lines 32-37 are dead — `!user` was already handled at line 25.

---

### H-4 — HIGH — SMTP TLS certificate verification disabled

**Location:** `lib/email/sendEmail.ts:54-65`

```ts
return nodemailer.createTransport({
  host, port, secure,
  auth: { user, pass },
  tls: { rejectUnauthorized: false },   // :63
});
```

`rejectUnauthorized: false` disables X.509 verification on the SMTP TLS connection. The transport authenticates with `GMAIL_USER` / `GMAIL_APP_PASSWORD` (lines 46-47) and carries the completed-worklog emails, whose PDF attachments contain worker names, work descriptions, site photos and rendered e-signature images.

**Exploitability path:** an attacker with an on-path position or DNS control between the deployment and `smtp.gmail.com` (compromised resolver, hostile egress proxy, BGP/DNS hijack, or simply a misconfigured `GMAIL_SMTP_HOST`) presents any self-signed certificate. The client accepts it, completes AUTH, and hands over the Gmail app password in plaintext-over-attacker-TLS. That credential is reusable against Google's SMTP directly. Every subsequent notification — including the PDFs with signatures — is readable and modifiable by the attacker. Because `rejectUnauthorized: false` also defeats the "is this really Gmail" check, the attacker's relay can silently drop or rewrite approval notifications.

**Remediation:** delete the `tls` block. Nodemailer's default (`rejectUnauthorized: true`) is correct for `smtp.gmail.com`. If a specific environment genuinely needs a private CA, supply `tls: { ca: [fs.readFileSync(...)] }` rather than disabling verification, and gate it behind an explicit non-production env var. Rotate `GMAIL_APP_PASSWORD` after the fix, since it may already have been exposed.

---

### H-5 — HIGH — IDOR: any authenticated user reads any worklog

**Location:** `app/api/worklogs/[id]/route.ts:18-37`

```ts
export async function GET(request: Request, { params }) {
  const { id } = await params;
  return await RepositoryFactory.withWorkLogRepository(async (workLogRepo) => {
    const workLog = await workLogRepo.findByIdWithDetails(id);
    if (!workLog) return ApiError.notFound('Work log');
    return ApiError.success(workLog);
  });
}
```

No `getAuthUser`, no `canModify`, no project-membership check. The `PUT` and `DELETE` handlers in the same file both authorise properly (lines 46-91, 204-221) — `GET` was missed. `findByIdWithDetails` (`lib/repositories/WorkLogRepository.ts:292-328`) returns the full document plus joined `projectName`, `projectLocation` and `authorName`: personnel names and roles, work descriptions, notes, photo URLs, and `signatures[]` including each base64 signature image and `signedBy` name.

The same gap exists on the page route — `/worklogs/[id]` is protected by middleware for authN only, with no per-resource check.

**Exploitability path (confirmed):**
1. Attacker self-registers via `POST /api/signup` (open, always assigned `role: 'user'`).
2. The middleware (`middleware.ts:44-66`) verifies their JWT signature and lets the request through. That is the **only** check.
3. They enumerate `GET /api/worklogs/<id>` across projects they have no relationship to. MongoDB ObjectIds are not random — the leading 4 bytes are a Unix timestamp and the trailing 3 a monotonic counter — so ids are substantially guessable, and `GET /api/worklogs` (line 17) hands out recent ids directly with only an authN check.
4. Result: complete read access to every construction log in the system, including third-party e-signature images and site photos.

This directly contradicts the public claim on the marketing page (`app/page.tsx:115`: *"access is role-based — workers, supervisors and the office each see only what their role allows"*), which has GDPR-representation implications for an app holding named-person records and biometric-adjacent signature images.

**Remediation:**
1. Add `const user = await getAuthUser(request); if (!user) return ApiError.unauthorized();` to the `GET` handler.
2. Add an authorisation check after the fetch — the caller must be the author, an admin/manager, or the project's assigned owner/contractor. `fetchProjectContext` (`lib/api/projectContext.ts`) already resolves `projectOwnerUserId` and `projectContractorUserId` for exactly this purpose in the `PUT` and reject routes; reuse it.
3. Apply the same predicate to the `/worklogs/[id]` page and to `GET /api/worklogs` list scoping (see M-7).

---

### H-6 — HIGH — Hardcoded default admin credentials

**Location:** `lib/repositories/UserRepository.ts:106-119`, triggered from `app/api/users/route.ts:15`

```ts
async ensureDefaultUser(): Promise<void> {
  const count = await this.count();
  if (count === 0) {
    const defaultUser = {
      name: 'Default User',
      email: 'default@example.com',
      password: await hash('changeme123', 12),   // :113
      role: 'admin',                             // :114
    };
    await this.create(defaultUser);
  }
}
```

A well-known credential pair provisioned at the highest privilege level, from a literal in committed source.

**Exploitability path:** the trigger is `GET /api/users`, which requires a valid JWT — so this cannot be reached on a genuinely empty deployment. It becomes reachable because **JWT verification never consults the database** (see M-1): any token signed with the current `NEXT_JWT_SECRET` is accepted for its full 12-hour life regardless of whether the user still exists. So the sequence is:

1. The users collection becomes empty — a database restore to an empty snapshot, a fresh environment reusing the production `NEXT_JWT_SECRET`, a migration, or an admin bulk-delete.
2. Any still-valid token (or one minted from a leaked/shared secret) hits `GET /api/users`.
3. `ensureDefaultUser()` fires and creates `default@example.com` with the publicly known password `changeme123` and `role: 'admin'`.
4. Anyone who has read this repository logs in as a full administrator.

The equivalent `ensureDefaultProject()` (`lib/repositories/ProjectRepository.ts:141`) is triggered by `GET /api/projects`, which has no auth guard at all (M-7) — same auto-provisioning pattern, lower impact since it creates no credential.

**Remediation:**
1. Delete `ensureDefaultUser()` and its call site. First-admin bootstrap belongs in an explicit, operator-run script (`scripts/`), reading the password from the environment and requiring a change on first login.
2. If a runtime bootstrap must exist, generate a random password, never assign `role: 'admin'` implicitly, and log the credential to the operator once rather than committing it.
3. Audit production now for a `default@example.com` account; if present, delete it and review its activity.

---

### M-1 — MEDIUM — No token revocation; role is trusted from the JWT for 12 hours

**Location:** `utils/auth.ts:99-131`, `middleware.ts:62-66`, `app/api/login/route.ts:41-45`

`getAuthUser` returns `{ userId, name, role }` straight from the verified JWT payload (lines 120-124) with no database lookup. `role` is baked in at login (`app/api/login/route.ts:41`) with a 12-hour expiry (line 44), and `setSessionCookie` uses `maxAge: 12 * 60 * 60` (`utils/auth.ts:30`). There is no denylist, no token version, no `jti` tracking, and no logout-side invalidation — `POST /api/logout` only clears the cookie (`app/api/logout/route.ts:6-11`), which does nothing for a mobile bearer token held in `@capacitor/preferences`.

**Exploitability path:** an admin demotes a user from `manager` to `user`, or deletes the account outright, in response to an incident. The revoked party keeps full `isAdmin` privileges — creating users, creating and editing projects, uploading DWG/PDF drawings — until their token naturally expires, for up to 12 hours. On mobile the token survives logout entirely and is replayable from the device. This is also the precondition that makes H-6 reachable.

**Remediation:** resolve the user from the database on each authenticated request (`userRepo.findById(payload.userId)`) and take `role` from the document, not the token. Cache it briefly if the extra read matters. Add a `tokenVersion` field to the user document, embed it in the JWT, and bump it on logout, password change, role change and deletion. Shorten the access-token lifetime and add a refresh flow rather than a 12-hour bearer.

---

### M-2 — MEDIUM — Mass assignment lets an author reassign worklog authorship

**Location:** `app/api/worklogs/[id]/route.ts:62,149`; `lib/repositories/WorkLogRepository.ts:396-398`; `lib/repositories/base/BaseRepository.ts:95-99`

`updateData` starts as `{...requestData}` (line 62). Unlike the create path, `author` is **not** overwritten afterwards — only `status` is (line 132). `WorkLogRepository.update` then normalizes any supplied `author` into an `ObjectId` (lines 396-398) and `BaseRepository.update` writes it via `$set` (lines 95-99).

**Exploitability path:** a worker who authored a worklog (or any admin/manager, who passes `canModify` for every log) sends `PUT /api/worklogs/<id>` with `{"author":"<another user's ObjectId>"}`. Authorship of a signed daily log — a document intended as contractual evidence of who reported what work on which day — is silently reassigned to an innocent third party. The reassignment also moves the log out of the original author's `findMostRecentByAuthorAndProject` and `/api/suggestions` scope, and the same request can inject arbitrary additional keys into the document.

The owner-approval branch shows the intended pattern and does this correctly (lines 114-119: `updateData = { signatures: updatedSignatures }` — an explicit allowlist, with a comment explaining why).

**Remediation:** extend the explicit-allowlist approach to the whole handler. Validate with a `.strict()` update schema that omits `author`, `_id`, `createdAt` and `status`, and build the `$set` payload from `parsed.data` only. Covered by the H-1 fix.

---

### M-3 — MEDIUM — No rate limiting or lockout on any auth endpoint

**Location:** `app/api/login/route.ts:8`, `app/api/signup/route.ts:9`; no rate-limit implementation anywhere in the tree

A tree-wide search for `rate limit`, `ratelimit` and `throttle` across `app/`, `lib/`, `components/`, `hooks/` and `middleware.ts` returns nothing. There is no `vercel.json`, no WAF configuration, no attempt counter on the user document, no lockout, no CAPTCHA and no exponential backoff.

**Exploitability path:** unlimited-rate credential stuffing and password spraying against `POST /api/login`. Combined with H-3 (enumerate every registered email) and L-7 (confirm any guessed address) and L-8 (8-character passwords with no complexity requirement), an attacker gets a complete, verified target list and unbounded guessing attempts against it. `POST /api/signup` is equally unthrottled, permitting mass account creation — and every account created is a valid credential for the H-5 IDOR.

**Remediation:** apply a rate limit in `middleware.ts` keyed on IP plus submitted email — e.g. `@upstash/ratelimit` with Vercel KV, or Vercel's built-in firewall rules. Suggested: 5 failed logins per email per 15 minutes with progressive delay, and a separate per-IP cap. Add a per-account lockout with an out-of-band unlock, and throttle `/api/signup` per IP.

---

### M-4 — MEDIUM — All user emails exposed to every authenticated user

**Location:** `app/api/users/route.ts:7-24`; `lib/repositories/UserRepository.ts:73-81`

The `GET` handler checks authentication (line 9) but never checks `isAdmin` — unlike the `POST` handler directly below it (line 32). It returns `findSummary()`, which explicitly projects `email` and `role`:

```ts
// lib/repositories/UserRepository.ts:74-78
.find({})
.project({ _id: 1, name: 1, email: 1, role: 1 })
```

**Exploitability path:** a self-registered worker calls `GET /api/users` and receives the full staff directory — every name, every email address, and every role. The `role` field is the more damaging half: it identifies exactly which accounts are `admin` or `manager`, turning the list into a ranked target set for the unthrottled login endpoint (M-3). Under GDPR this is an unauthorised disclosure of employee personal data to every account holder.

Note that `mapToEntity` does correctly strip `password` (lines 176-182), so hashes are not exposed.

**Remediation:** decide what the endpoint is for. If it backs admin user management, add `if (!isAdmin(authUser)) return ApiError.forbidden(...)`. If it backs a non-admin dropdown, add a second projection that returns `_id` and `name` only, and serve that to non-admins. Also move `ensureDefaultUser()` out of this handler (H-6).

---

### M-5 — MEDIUM — Project owner/contractor emails exposed to every authenticated user

**Location:** `app/api/projects/route.ts:6-33`; `lib/repositories/ProjectRepository.ts:127-135`; `app/api/projects/[id]/route.ts:6-20`

`GET /api/projects` has no route-level auth check whatsoever (line 6 — note the handler takes no `request` parameter, so it could not call `getAuthUser(request)` even if it wanted to). It returns `findSummary()`, projecting `ownerEmail` and `contractorEmail` for every project:

```ts
// lib/repositories/ProjectRepository.ts:130
.project({ _id: 1, name: 1, …, ownerEmail: 1, contractorEmail: 1, ownerUserId: 1, contractorUserId: 1 })
```

`GET /api/projects/[id]` (line 6) likewise has no guard and returns the whole document via `mapToEntity`'s `{...document}` spread (`ProjectRepository.ts:336-342`) — including `budget`, `client`, coordinates, and the full `dwgFiles` list with blob URLs.

**Exploitability path:** any authenticated user (and, if middleware coverage ever regresses, any anonymous caller — see M-7) harvests the client-side contact list for every project: owner and contractor names, email addresses and the internal user ids that map them to accounts. That is a ready-made target list for business-email-compromise against the project owners who approve worklogs, and it discloses commercial data (`budget`, `client`) across project boundaries.

**Remediation:** add `getAuthUser(request)` to both handlers (changing the `GET()` signature on the list route). Scope the list to projects the caller is associated with unless they are `isAdmin`. Drop `ownerEmail`/`contractorEmail` from `findSummary()`'s projection and expose them only to admins on the detail route.

---

### M-6 — MEDIUM — Internal exception messages returned to clients

**Location:** `lib/api/errorHandling.ts:25-30`

```ts
if (error instanceof Error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

`ApiError.handle` is the catch-all for every route handler in the app, and it echoes the raw exception message into the response body.

**Exploitability path:** an attacker triggers failures and reads back internal detail. Concretely reachable messages include `"NEXT_JWT_SECRET environment variable is not configured"` and `"NEXT_JWT_SECRET must be at least 32 characters long for security"` (`utils/auth.ts:14,18`), `"Please define the MONGODB_URI environment variable inside .env.local"` (`lib/dbConnect.ts:6-8`), `"Database connection timeout"` (`lib/api/database.ts:19`), `"BLOB_READ_WRITE_TOKEN is not configured"` (`app/api/upload/route.ts:14`), `"Email already in use"` (`UserRepository.ts:149` — an enumeration oracle on the admin create path), and any raw `MongoServerError`, which can disclose collection names, index names and driver/server versions. This is exactly the fingerprinting an attacker uses to select further exploits, and it is also the vehicle for H-3's 500-based oracle.

**Remediation:** log the full error server-side (line 14 already does) but return a generic `"An unexpected error occurred"` with a correlation id for genuine 500s. Keep specific messages only for the deliberate 4xx helpers (`badRequest`, `forbidden`, `notFound`), which are already separate methods.

---

### M-7 — MEDIUM — Four API routes rely solely on middleware for authentication

**Location:** `app/api/worklogs/[id]/route.ts:18` (GET), `app/api/projects/route.ts:6` (GET), `app/api/projects/[id]/route.ts:6` (GET), `app/api/projects/default/route.ts:4` (GET)

Every other handler under `app/api/` calls `getAuthUser` itself. These four do not, leaving `middleware.ts` as the single point of failure for their authentication.

**Verified as NOT currently exploitable, and why it still matters:**
- CVE-2025-29927 (the `x-middleware-subrequest` middleware bypass) is **not** applicable: `node_modules/next/package.json` reports `15.5.19`, and the `package.json` floor of `^15.2.8` is above the patched `15.2.3`. Confirmed clean.
- The `matcher` (`middleware.ts:86-88`) excludes only `_next/static`, `_next/image`, `favicon.ico`, `sitely-logo.png`, `hero-construction.jpg` and `screenshots/` — none of which shadow an API path. The comment on lines 80-85 shows the narrow-exclusion decision was deliberate and correct.

The residual risk is structural. Any future addition to that matcher exclusion list, any change to `isPublicPath` (note `middleware.ts:17` uses `startsWith`, so a careless entry such as `"/api"` would silently open everything), or any Next.js middleware regression converts all four routes from authenticated to anonymous in one step — exposing every worklog, every project and every owner email with no second line of defence. The mobile static export makes this concrete: `scripts/build-mobile.mjs` moves `middleware.ts` aside entirely, which `CLAUDE.md` documents as "a UX gap, not a security hole" *because the API routes enforce auth server-side* — an assumption these four routes break.

**Remediation:** add `getAuthUser(request)` to each of the four handlers (changing `GET()` to `GET(request: Request)` on the two that take no parameter). Middleware should be the coarse filter, never the only check. A route-level lint rule or a test asserting every exported handler under `app/api/` calls `getAuthUser` would prevent regressions.

---

### M-8 — MEDIUM — Any authenticated user can create a worklog on any project

**Location:** `app/api/worklogs/route.ts:74-144` (notably `:92`, `:137`)

The handler authenticates the caller (line 77) and reads `data.project` from the body, but never checks that the caller has any relationship to that project — no membership table, no owner/contractor comparison, no admin requirement. `data.project` flows into `findByProjectAndDay` (line 92) and then into the created document (line 137).

**Exploitability path:** a self-registered worker enumerates project ids from the unguarded `GET /api/projects` (M-5) and posts worklogs into any of them. Consequences: false work records injected into another company's project log; denial of service on legitimate reporting, since `findByProjectAndDay` enforces one worklog per project per day (lines 92-96) so a squatted date **blocks the real crew from filing**; and this is the delivery vehicle for C-1 and H-2 into projects whose owners and admins the attacker specifically wants to target.

**Remediation:** require that the caller is the project's assigned contractor, owner, or an admin/manager before accepting a worklog for it. `fetchProjectContext` already returns `projectOwnerUserId` and `projectContractorUserId`. If workers are meant to be assignable to projects more generally, add an explicit assignment list to the project document and check membership against it.

---

### L-1 — LOW — Uploaded photos and signatures stored with public blob access

**Location:** `app/api/upload/route.ts:33-36`; also `app/api/upload/dwg/route.ts:55-58`, `app/api/upload/pdf/route.ts:49-52`

```ts
const blob = await put(pathname, file, { access: 'public', contentType: file.type });
```

Every site photo, and every DWG/PDF drawing, is served from an unauthenticated, non-expiring Vercel Blob URL. Security rests entirely on the UUID in the pathname (`worklogs/{userId}/{timestamp}-{uuid}.{ext}`).

**Exploitability path:** once a URL leaks it grants permanent anonymous access, with no way to revoke short of deleting the blob. URLs leak through the H-5 IDOR (which hands them to any authenticated user), through email forwarding of completion PDFs, through `Referer` headers when a user follows a link out of the app, and through browser history and corporate proxy logs. For construction site photos containing identifiable workers, and DWGs containing client floor plans, that is an indefinite unauthenticated exposure of personal and commercial data.

`access: 'public'` is currently the only value `@vercel/blob` `put()` accepts, so this is a platform constraint rather than a coding mistake — recording it so the risk is an explicit, documented decision rather than an implicit one.

**Remediation:** keep `access: 'public'` but stop treating the URL as a capability: proxy media through an authenticated route (`GET /api/worklogs/[id]/photos/[n]`) that checks the same authorisation predicate as H-5 and streams or 302s to a short-lived signed URL. At minimum, document the exposure in the privacy notice and add blob lifecycle deletion aligned to your retention policy.

---

### L-2 — LOW — `z.string().url()` accepts `javascript:` and `data:` schemes

**Location:** `app/api/projects/[id]/dwgs/route.ts:8,12`

```ts
url: z.string().url(),
pdfUrl: z.string().url().optional(),
```

Verified empirically against the installed `zod@3.25.76`: `z.string().url().safeParse('javascript:alert(1)').success === true`, and the same for `data:text/html,<script>…`. Zod's `.url()` delegates to `new URL()`, which validates syntax, not scheme.

**Exploitability path:** these values are rendered into `href` at `app/worklogs/[id]/page.tsx:596,606` and `components/forms/DwgUpload.tsx:256,267` — the same React 18 sink as C-1. An `admin` or `manager` (or anyone who has compromised such a session, e.g. via C-1) attaches a `javascript:` "drawing" to a project; every worker who clicks "Download DWG" on any worklog referencing it executes attacker script in-origin. Lower severity than C-1 only because the injection point already requires elevated privilege — the sink and the payload are identical.

The route's authorisation is otherwise correct (`getAuthUser` + `isAdmin`, lines 26-28), and the `DELETE` handler's `del(url)` call cannot reach outside the deployment's own blob store because the token scopes it.

**Remediation:** replace `z.string().url()` with a refinement asserting `protocol === 'https:'` and an allowlisted hostname, matching the C-1 fix. Apply the same `safeHref()` sink guard at all four render sites.

---

### L-3 — LOW — `http://localhost` allowlisted for credentialed CORS in production

**Location:** `lib/cors.ts:19-23,50-60`

```ts
const WEBVIEW_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',    // :22 — Android (no port)
];
```

`isAllowedOrigin` returns true for these unconditionally, in every environment (line 52), and `corsHeaders` then emits `Access-Control-Allow-Credentials: true` with the echoed origin (lines 68-77).

**Exploitability path:** any page the victim loads from `http://localhost` on port 80 — a local dev server, a desktop app with an embedded HTTP server, a malicious npm postinstall spinning up a listener — is a permitted credentialed origin against the production API and can read the responses.

Two things keep this at LOW, both verified: the session cookie is `sameSite: 'lax'` (`utils/auth.ts:27`), so the browser will not attach it to a cross-site `fetch` regardless of what CORS permits; and the bearer-token path requires a token the attacker page has no way to obtain. So `credentials: 'include'` from a hostile `http://localhost` currently yields an unauthenticated request. The exposure would become real if the cookie were ever relaxed to `SameSite=None` — which `CLAUDE.md` names as a candidate fix for the mobile cookie problem. Fix it before that change, not after.

Secondary note: `environmentOrigins()` auto-allowlists `process.env.VERCEL_URL` (line 38), so every preview deployment URL is a permitted credentialed origin. Acceptable, but worth being deliberate about.

**Remediation:** gate the plain-HTTP WebView origins on the Android build only, or drop `http://localhost` and rely on the bearer token (which does not need CORS credentials at all) — `apiFetch` already sends `Authorization` and keeps `credentials: 'include'` only opportunistically (`lib/apiClient.ts:58-63`). Add a regression test asserting `isAllowedOrigin('http://localhost') === false` when `NODE_ENV === 'production'`.

---

### L-4 — LOW — `GET` requests perform writes

**Location:** `app/api/projects/default/route.ts:4-28` (`insertOne` at `:23`); `app/api/projects/route.ts:10` (`ensureDefaultProject()`); `app/api/users/route.ts:15` (`ensureDefaultUser()`)

Three `GET` handlers mutate state. `GET /api/projects/default` inserts a project document, hardcoding `manager: "65f8a7b2c4e8f3a1d2b3c4d5"` — a literal ObjectId with no corresponding user (line 18).

**Exploitability path:** safe methods are assumed side-effect-free by browsers, prefetchers, link scanners, CDNs and monitoring probes, none of which are CSRF-token-aware. Any of them touching these URLs while a session cookie is present creates documents. Impact is limited to unwanted rows in this case, but the pattern is what makes H-6 reachable via a `GET`.

**Remediation:** move provisioning out of read paths into an explicit migration or seed script run at deploy time. If runtime provisioning must stay, make it a `POST` with an admin check. Remove the placeholder `manager` id.

---

### L-5 — LOW — No security response headers

**Location:** `next.config.mjs` (no `headers()`); no `vercel.json`

The Next config sets `eslint.ignoreDuringBuilds`, `images.remotePatterns`, `compiler.removeConsole` and `redirects()`, but defines no `headers()`. There is no `vercel.json`. So the app ships without Content-Security-Policy, Strict-Transport-Security, `X-Content-Type-Options: nosniff`, `Referrer-Policy` or a frame-ancestors restriction.

**Exploitability path:** the absent CSP is the notable one — a `script-src` policy without `unsafe-inline` blocks `javascript:` URL navigation, which would have contained C-1 and L-2 at the browser level. Missing HSTS leaves a first-visit downgrade window. Missing `Referrer-Policy` means full worklog URLs (containing worklog ids) leak in the `Referer` header when a user follows a photo or DWG link off-site — which combines with L-1 to leak blob URLs to third parties.

**Remediation:** add an `async headers()` block applying to all routes: a `Content-Security-Policy` (start in `Content-Security-Policy-Report-Only` to find violations, and note that Next requires `'unsafe-inline'` for styles and a nonce or `'unsafe-eval'` in dev), `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `frame-ancestors 'none'` in the CSP.

---

### L-6 — LOW — Recipient email addresses written to server logs

**Location:** `lib/email/sendEmail.ts:82,128,147`

```ts
console.log('[SMTP] Sending email', { to: mailOptions.to, subject: mailOptions.subject });   // :82
console.log('[SMTP] Preparing completed work log email for recipients:', recipients);        // :128
console.log('[SMTP] Preparing rejection notification email for recipients:',
            payload.projectContractorEmail);                                                // :147
```

Project owner and contractor email addresses are written to stdout, which on Vercel means the platform log store with its own retention and its own access-control surface.

**Mitigating factor, verified:** `next.config.mjs:14-16` sets `compiler.removeConsole: process.env.NODE_ENV === 'production'`. With the value `true` (rather than `{ exclude: ['error'] }`) the SWC transform strips **all** `console.*` calls from compiled code, server-side handlers included. So these statements are absent from production builds. The exposure is real in development and preview deployments only, which is why this is LOW rather than MEDIUM.

**Also checked — the known issue CWL-snjospzo is already fixed.** `components/SignatureSection.tsx` previously logged the full current-user object and project role to the browser console; `git show 3b68834` confirms `console.log('Current user:', user)` and `console.log('Project role:', projectRole)` were both removed in commit `3b68834`. The current file (read in full) contains no `console` calls. No further action needed on that issue.

No other PII logging was found. A tree-wide sweep of `console.log|info|warn|debug` across `app/`, `components/`, `lib/`, `hooks/`, `utils/` and `middleware.ts` returned 19 hits; the remaining 16 log only timing, lifecycle and IndexedDB `tempId` values. `middleware.ts:68` logs the JWT verification *error* object, not the token itself.

**Remediation:** drop the recipient addresses from these three statements (subject and message id are enough for debugging), or route them through a logger that redacts PII by field name. Do not rely on `removeConsole` as a privacy control — it is a bundle-size feature and a config change would silently re-expose this.

---

### L-7 — LOW — Signup reveals whether an email is registered

**Location:** `app/api/signup/route.ts:23-25`

```ts
if (await userRepo.isEmailTaken(email)) {
  return ApiError.badRequest("Email is already in use");
}
```

An unauthenticated 400-versus-201 oracle confirming whether any given address has an account. Distinct from H-3 in that it confirms a *specific* guess rather than enumerating the space; together they let an attacker enumerate with H-3 and verify with this.

`UserRepository.create` also throws `"Email already in use"` (line 149), which `ApiError.handle` surfaces verbatim (M-6) on the admin create path.

**Remediation:** the privacy-preserving pattern is to return the same 202 regardless and send a "you already have an account" email to the address, so the answer goes to the mailbox owner rather than the requester. If the UX cost is unacceptable, at least require a CAPTCHA and rate-limit the endpoint (M-3) so the oracle cannot be queried at scale.

---

### L-8 — LOW — Weak password policy

**Location:** `lib/schemas/userSchema.ts:10`

```ts
password: z.string().min(8, 'Password must be at least 8 characters'),
```

Eight characters, no complexity requirement, no breach-corpus check, no maximum length, and no server-side rejection of obvious values — `changeme123` would pass (see H-6). This schema governs both `POST /api/signup` and admin-created accounts via `POST /api/users`.

**Exploitability path:** an 8-character password is within reach of an online guessing attack given M-3's absence of rate limiting and H-3's ability to produce a verified target list of admin accounts.

**Remediation:** raise the minimum to 12 characters, add a `.max(128)` bound (unbounded input into bcrypt is a cheap CPU-exhaustion vector, and bcrypt silently truncates past 72 bytes), and screen against a breached-password list (`zxcvbn` for strength, or the Have I Been Pwned k-anonymity range API). Note that `bcryptjs.hash(password, 12)` is used consistently and correctly on all three creation paths.

---

## Categories with no issues found

Each of the following was actively checked and came back clean.

**Command injection — no issue found.** No `child_process`, `exec`, `execSync`, `spawn`, `eval` or `new Function` anywhere in `app/`, `components/`, `lib/` or `hooks/`. The single regex match for the search pattern was `/^Bearer[ \t]+(.+)$/i.exec(...)` at `utils/auth.ts:64` — a `RegExp.exec`, unrelated to process execution.

**XSS via `dangerouslySetInnerHTML` — no issue found.** Zero occurrences across all `.ts`, `.tsx`, `.js` and `.jsx` files in scope. All user content renders through JSX text interpolation, which React escapes. (XSS *was* found, but via the `href` URL sink — see C-1 and L-2 — not via raw HTML injection.)

**HTML injection into email templates — no issue found.** All three templates in `lib/email/templates/` route user-controlled values through `escapeHtml` (`lib/email/escapeHtml.ts`, which covers `& < > " '`): `signerName`, `signerRole` and `projectName` at `signatureNotificationTemplate.ts:63,69,76`, and `projectName` and `rejectionComment` at `rejectWorkLogTemplate.ts:62,74`. The unescaped interpolations are `workLogUrl` (server-constructed from `getAppUrl()` plus a route param that must already be a valid ObjectId, or `findById` throws) and `formattedDate` (a `toLocaleString()` result). The email `subject` at `signatureNotificationTemplate.ts:32` interpolates the client-controlled `signerName` unescaped, but Nodemailer encodes and strips control characters in header values, so header injection does not land.

**NoSQL injection in `lib/repositories/` — no issue found.** Every id-taking method routes through `ValidationUtils.normalizeObjectId` (`lib/api/validation.ts:33-41`), which throws unless the value is a valid ObjectId string or an `ObjectId` instance — so no object literal survives into a filter. The aggregation pipelines (`countByDayForProject:187-203`, `findByProjectAndDay:220-235`, `findByIdWithDetails:295-323`, `getProjectStats:246-256`) build their `$match` stages from normalized ObjectIds and server-side literals only. `app/api/suggestions/route.ts` is a good example of the right pattern: the `field` parameter is checked against a hardcoded `ALLOWED_FIELDS` map (lines 6-11, 26-28) rather than interpolated, and `projectId` is `ObjectId.isValid`-checked before use (line 36). `app/api/projects/[id]/worklog-counts/route.ts:5,30` validates `month` against `/^\d{4}-(0[1-9]|1[0-2])$/` before it reaches `getMonthBounds`. The injection that *does* exist (H-3) is in `app/api/login/route.ts`, which bypasses the repository layer and queries `mongoose.connection.collection("users")` directly.

**ReDoS via user-supplied `$regex` — no issue found (unreachable).** `WorkLogRepository.searchByDescription:353-367` and `UserRepository.search:86-100` both pass a `searchTerm` straight into `{ $regex: searchTerm }`. Both are **dead code**: a tree-wide search found no caller in any route, page, component or hook. Left as-is they are a live trap for the next developer who wires up a search box — recommend either deleting them or making them escape the input now, before a caller exists.

**JWT algorithm confusion — no issue found.** Both verification sites (`utils/auth.ts:115-118`, `middleware.ts:64`) call `jose`'s `jwtVerify` with a `Uint8Array` key from `TextEncoder().encode(secret)`. `jose` derives the permitted algorithm set from the key type: a symmetric `Uint8Array` restricts verification to `HS256`/`HS384`/`HS512`, so an `RS256`→`HS256` confusion attack has no path. `jose` also rejects unsecured JWTs (`alg: none`) in `jwtVerify` by design — that requires the separate `UnsecuredJWT` API, which is not used. Both signing sites (`app/api/login/route.ts:42`, `app/api/signup/route.ts:40`) pin `alg: "HS256"` explicitly. *Hardening suggestion only:* pass `{ algorithms: ['HS256'] }` to both `jwtVerify` calls to make the constraint explicit and survive a future key-type change.

**`jsonwebtoken` dependency — no issue found.** `jsonwebtoken@^9.0.2` is declared in `package.json` but a tree-wide search of `app/`, `components/`, `lib/`, `hooks/`, `utils/`, `middleware.ts`, `scripts/` and `__tests__/` found **zero** imports or requires. All JWT work goes through `jose`. There is no dual-library algorithm-confusion surface. Recommend removing the unused dependency to shrink the attack surface and prevent a future contributor from reaching for the weaker API.

**JWT secret entropy and expiry — no issue found.** `validateJWTSecret` (`utils/auth.ts:10-22`) fails closed on a missing secret and enforces a 32-character minimum. The configured value in `.env.local` is 64 characters (`y6***9z`), comfortably above the HS256 requirement. Tokens carry `setIssuedAt()` and `setExpirationTime("12h")` (`app/api/login/route.ts:43-44`, `app/api/signup/route.ts:41-42`), and the cookie's `maxAge` matches at 12 hours (`utils/auth.ts:30`). The cookie is `httpOnly`, `sameSite: 'lax'`, `secure` in production and scoped to `path: '/'` (lines 25-31). *Separate concern:* 12 hours with no revocation mechanism is the substance of M-1 — the secret and the expiry claim themselves are sound.

**Hardcoded secrets in source — no issue found.** No API keys, tokens, connection strings or private keys are embedded in `app/`, `components/`, `lib/`, `hooks/` or `middleware.ts`. Every secret is read from `process.env`: `NEXT_JWT_SECRET`, `MONGODB_URI`, `BLOB_READ_WRITE_TOKEN`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CORS_ALLOWED_ORIGINS`, `RESEND_*`. The one hardcoded credential is the *default admin password* at `lib/repositories/UserRepository.ts:113`, reported as H-6.

**`.env` tracked by git — no issue found.** `git ls-files` matching `.env|secret|credential` returns exactly one file: `.env.mobile.example`, which contains only the placeholder `NEXT_PUBLIC_API_BASE_URL=https://your-app.vercel.app` and explanatory comments. `.env.local` (holding `MONGODB_URI` with credentials, `NEXT_JWT_SECRET`, `BLOB_READ_WRITE_TOKEN`) and `.env.mobile` are both present on disk and both correctly untracked — covered by `.gitignore:29` (`.env*.local`) and `.gitignore:32` (`.env.mobile`). Values in `.env.local` were read only to assess entropy and are reported redacted (`MONGODB_URI` → `mo***er`, `BLOB_READ_WRITE_TOKEN` → `"v***l"`). The `VITE_FIREBASE_*` entries are stale artifacts of the abandoned Vite/Firebase stack; nothing in the current tree reads them, and per scope instructions the public-by-design Firebase values are not flagged.

**Server-only secrets reachable from client bundles — no issue found.** Every file in `app/`, `components/`, `lib/` and `hooks/` carrying a `'use client'` directive was checked for `process.env` references outside `NEXT_PUBLIC_*` and `NODE_ENV`. Zero hits. The only `NEXT_PUBLIC_*` values inlined into the browser bundle are `NEXT_PUBLIC_API_BASE_URL` (`lib/apiClient.ts:19`), `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_FEATURE_RISK_SIGNAL` — all non-sensitive by design. Server-only values (`NEXT_JWT_SECRET`, `MONGODB_URI`, `BLOB_READ_WRITE_TOKEN`, `GMAIL_APP_PASSWORD`) are referenced only from route handlers, `middleware.ts` and server-side `lib/` modules.

**Path traversal in upload handlers — no issue found.** All three upload routes construct the blob pathname entirely server-side from trusted components, never from `file.name`: `app/api/upload/route.ts:31` uses `worklogs/${user.userId}/${Date.now()}-${crypto.randomUUID()}.${ext}` where `ext` is derived from a MIME type already checked against an allowlist (line 23); `app/api/upload/dwg/route.ts:53` and `app/api/upload/pdf/route.ts:47` use `projects/${projectId}/…` where `projectId` has passed `ValidationUtils.normalizeObjectId` (lines 41 / 35), so it is a 24-character hex string and cannot contain `/` or `..`. Size limits (8 MB / 25 MB) and extension checks are enforced server-side, not merely client-side. There are no download or file-read handlers in the tree, so there is no read-side traversal surface.

**Open redirect — no issue found.** Every redirect target is a compile-time literal: `middleware.ts:59` builds `new URL("/login", request.url)`; `app/admin/users/page.tsx:12,16` and `app/admin/projects/new/page.tsx:9,13` redirect to `"/login"` and `"/"`; `app/login/page.tsx:43` and `app/signup/page.tsx:53` push `"/app"`. No `?next=`, `?redirect=` or `?returnUrl=` parameter is read anywhere. The only `URLSearchParams` reads in the tree are `app/page.tsx:241` and `app/sample-log/page.tsx` fetching a `lang` preference, whose value is used to select from a fixed translation object, never as a navigation target.

**Insecure deserialization — no issue found.** No `node-serialize`, no `js-yaml`, no `vm` module, no custom deserializer. Request bodies are parsed with `request.json()` / `request.formData()`, both of which produce inert data structures. Notably, `app/api/worklogs/[id]/reject/route.ts:23` even guards the parse (`.catch(() => ({}))`) so a malformed body is a 400 rather than a 500. Prototype-pollution via `__proto__` in a JSON body was considered: the raw bodies are spread into new object literals (`{...data}`) and written through MongoDB `insertOne`/`$set`, and `JSON.parse` does not create a prototype link from a `"__proto__"` key, so there is no pollution path. (Arbitrary *keys* being persisted is nonetheless a real problem — see H-1.)

**Next.js middleware bypass (CVE-2025-29927) — no issue found.** The installed version is `next@15.5.19` (`node_modules/next/package.json`), well past the `15.2.3` patch. The `package.json` floor of `^15.2.8` is also above the patched version, so a fresh `npm install` cannot resolve to a vulnerable release. The `x-middleware-subrequest` header bypass does not apply. This matters because four routes depend on middleware as their only auth check (M-7).

**Admin surface gating — no issue found.** Both pages under `app/admin/` are server components that authorise before rendering: `app/admin/users/page.tsx:9-17` and `app/admin/projects/new/page.tsx:6-14` each call `await getAuthUser()`, `redirect("/login")` if unauthenticated, and `redirect("/")` if `!isAdmin(authUser)`. This is server-side enforcement, not a client-side hide, so the check cannot be bypassed from the browser. The corresponding write APIs enforce `isAdmin` independently (`app/api/users/route.ts:32`, `app/api/projects/route.ts:40`, `app/api/projects/[id]/route.ts:30`, `app/api/projects/[id]/catalog/route.ts:13`, `app/api/projects/[id]/catalog/import/route.ts:18`, `app/api/projects/[id]/dwgs/route.ts:28,56`, `app/api/upload/dwg/route.ts:24`, `app/api/upload/pdf/route.ts:18`, `app/api/projects/catalog-sources/route.ts:13`). Note `isAdmin` deliberately covers both `admin` and `manager` (`utils/auth.ts:137`), as documented.

**bcryptjs usage and legacy SHA-256 passwords — no issue found.** All three password-creation paths use `hash(password, 12)`: `app/api/signup/route.ts:30`, `app/api/users/route.ts:50`, `lib/repositories/UserRepository.ts:113`. Verification uses `compare` (`app/api/login/route.ts:25`). Cost 12 is appropriate for 2026. A search for `sha256`, `createHash` and `md5` across `app/`, `components/`, `lib/`, `hooks/`, `utils/` and `middleware.ts` returned **zero** hits — no legacy verification fallback remains in the runtime code, so the migration described in `CLAUDE.md` appears complete and there is no downgrade path an attacker could force. `UserRepository.mapToEntity:176-182` destructures `password` out of every returned document, so hashes are never serialized into an API response. *Separate concern:* the policy governing what may be hashed is weak — see L-8.

**Privilege escalation via the signup role field — no issue found.** `userSchema` includes an optional `role: z.enum(['admin','user','manager'])` (`lib/schemas/userSchema.ts:11`), and `POST /api/signup` validates the body against that schema — so a client *can* submit `role: 'admin'` and pass validation. But the handler destructures only `{ name, email, password }` from `parsed.data` (`app/api/signup/route.ts:20`) and hardcodes `role: "user"` in the document it creates (line 31). The submitted value is discarded. Verified by reading the full handler. The `role` field is honoured only on `POST /api/users`, which is correctly `isAdmin`-gated.

**Feature-flag override abuse — no issue found.** `stampFlagOverrides` returns early when `process.env.NODE_ENV === 'production'` (`middleware-helpers.ts:13`), so `?ff_<key>=1` cannot enable gated features in production. `flagOverridesFromQuery` accepts only keys present in the hardcoded `FLAG_KEYS` array and only the exact values `'1'` or `'0'` (`lib/features/flags.ts:63-72`). The cookie-parsing regex is likewise anchored to a known key and a strict `1|0` (line 55). The design comment at `flags.ts:7-9` states the production-exclusion intent and the code matches it.

**Token storage on the client — no issue found.** No JWT is written to `localStorage` or `sessionStorage`. The only `localStorage` usage in the tree is a language preference (`app/page.tsx:242,257`, `app/sample-log/page.tsx:104,118`). Web sessions use an `httpOnly` cookie; mobile stores the token in `@capacitor/preferences` via `lib/mobile-auth.ts`, loaded by dynamic import so the plugin never enters the web bundle or an SSR render (lines 21-43). *Related residual risk, informational:* offline pending worklogs are held unencrypted in IndexedDB (`lib/indexedDBHelper.ts`) and include signature data URLs and photo payloads — inherent to the documented offline-first design, and shared-device exposure should be an explicit accepted risk rather than an oversight.

---

## Top 5 fixes, ordered by impact

1. **Validate the worklog request body server-side, with a scheme+host allowlist on `images[]`.**
   `app/api/worklogs/route.ts:83,137` and `app/api/worklogs/[id]/route.ts:52,62`. One change — `safeParse` a `.strict()` schema and persist only `parsed.data` — closes the CRITICAL stored-XSS-to-admin chain (C-1), the SSRF primitive (H-2), the authorship-forgery mass assignment (M-2), and the arbitrary-key write (H-1). Highest impact per line changed of anything in this report, and it brings these two routes in line with every other write route in the app.

2. **Add the missing auth and authorisation checks to the five unguarded `GET` handlers.**
   `app/api/worklogs/[id]/route.ts:18` is the urgent one — it exposes every worklog's signatures, photos and personnel names to any self-registered account (H-5). Then `app/api/projects/route.ts:6`, `app/api/projects/[id]/route.ts:6`, `app/api/projects/default/route.ts:4` (M-5, M-7) and the `isAdmin` check on `app/api/users/route.ts:7` (M-4). Reuse `fetchProjectContext` for the ownership predicate — it already resolves the ids you need. This is the finding most directly at odds with the role-based-access claim the product makes publicly.

3. **Fix the login route: type-check inputs, constant-time failure, no 500 oracle.**
   `app/api/login/route.ts:10-30,64-69`. Reject non-string `email`/`password` before the query, compare against a dummy hash when no user is found, and return 401 for every credential failure. This removes the unauthenticated NoSQL-injection email-enumeration oracle (H-3) and the timing side channel. Pair it with rate limiting in `middleware.ts` (M-3) — the oracle and the unthrottled endpoint are only dangerous together, and the same limiter blunts credential stuffing generally.

4. **Delete `tls: { rejectUnauthorized: false }` and rotate the SMTP credential.**
   `lib/email/sendEmail.ts:63`. A one-line deletion that stops handing the Gmail app password and every worklog PDF — names, work records, rendered e-signatures — to any on-path attacker (H-4). Rotate `GMAIL_APP_PASSWORD` afterwards, since it may already have been exposed.

5. **Remove the hardcoded default admin, and stop trusting the JWT's role claim.**
   `lib/repositories/UserRepository.ts:106-119` plus its call site at `app/api/users/route.ts:15` (H-6), and a database lookup for `role` in `utils/auth.ts:112-128` with a `tokenVersion` claim for revocation (M-1). These are one fix in practice: the stale-token problem is what makes the `changeme123` admin reachable, and the absence of revocation is what keeps a fired employee's `manager` privileges alive for 12 hours. Audit production for an existing `default@example.com` account before closing this out.
