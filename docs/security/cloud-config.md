# Cloud & Configuration Security Audit — Scan 3

**Issue:** CWL-ctynvpkr (parent CWL-lyljhwbl)
**Date:** 2026-08-27
**Commit at scan time:** `e329bff` (branch `main`)
**Scope:** environment/secret handling, git history, `next.config.*`, `middleware.ts`, `capacitor.config.ts`, Firebase, JWT/CORS, Vercel Blob, MongoDB.
**Method:** read-only static review. No files were modified, no commits made. All secret values in this document are redacted to first-2 + last-2 characters.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 7 |
| LOW | 6 |

**No secret has ever been committed to git**, and **no server-only secret reaches the client bundle** — the two failure modes that would have been CRITICAL are both clean and were verified empirically, not just by inspection.

The three HIGH findings are: SMTP certificate verification disabled, no authentication inside three `GET` handlers (middleware is the only gate), and the total absence of HTTP security headers.

---

## Area 1 — Environment variable exposure

### Inventory

Three `.env*` files exist. `.env.local` and `.env.mobile` are correctly gitignored (`.gitignore:24` covers `.env*.local`; `.gitignore:27` covers `.env.mobile`). Only `.env.mobile.example` is tracked, and it contains a placeholder.

**`.env.local`** (untracked, local only):

| Variable | Value (redacted) | Len | Classification | Reaches client? |
|---|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | `AI***n8` | 39 | Public-by-design (Firebase) | No — `VITE_` prefix is meaningless to Next.js |
| `VITE_FIREBASE_AUTH_DOMAIN` | `co***om` | 39 | Public-by-design | No |
| `VITE_FIREBASE_PROJECT_ID` | `co***og` | 23 | Public-by-design | No |
| `VITE_FIREBASE_STORAGE_BUCKET` | `co***pp` | 43 | Public-by-design | No |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `92***08` | 11 | Public-by-design | No |
| `VITE_FIREBASE_APP_ID` | `1:***5d` | 40 | Public-by-design | No |
| `MONGODB_URI` | `mo***er` | 124 | **SERVER-ONLY** | No — verified |
| `NEXT_JWT_SECRET` | `y6***9z` | 64 | **SERVER-ONLY** | No — verified |
| `BLOB_STORE_ID` | `"s***C"` | 24 | **SERVER-ONLY** | No — verified |
| `BLOB_READ_WRITE_TOKEN` | `"v***l"` | 64 | **SERVER-ONLY** | No — verified |

**`.env.mobile`** (untracked): `NEXT_PUBLIC_API_BASE_URL` = `https://<redacted-host>` — client-exposed by design, and it is a **non-secret HTTPS URL**. Correct.

**`.env.mobile.example`** (tracked): placeholder `https://your-app.vercel.app` only. Correct.

**Referenced in code but not present in any local `.env` file** (set on Vercel only, so not auditable from this repo): `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_SMTP_HOST`, `GMAIL_SMTP_PORT`, `RESEND_FROM_EMAIL`, `RESEND_NOTIFICATION_RECIPIENT(S)`, `CORS_ALLOWED_ORIGINS`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_FEATURE_RISK_SIGNAL`.

### Client-bundle verification (the important check)

Every reference to a server-only secret name lives in a server context. Confirmed by grep across `app/`, `components/`, `hooks/`, `lib/`, `utils/`:

- `MONGODB_URI` → `lib/dbConnect.ts:4` and `scripts/*.mjs` only.
- `NEXT_JWT_SECRET` → `utils/auth.ts:11` only.
- `BLOB_READ_WRITE_TOKEN` → `app/api/upload/route.ts:13`, `app/api/upload/pdf/route.ts:20`, `app/api/upload/dwg/route.ts:26`, `app/api/projects/[id]/dwgs/route.ts:76` — all API route handlers.
- SMTP credentials → `lib/email/sendEmail.ts:46-47`, imported only by API routes.

**Zero hits in any file carrying `'use client'`.**

Then verified against the actual compiled output rather than trusting the source review — the literal secret values from `.env.local` were searched across `out/`, `.next/static/`, and `public/`:

```
=== scanning out ===         clean: MONGO_PW / JWT / BLOB
=== scanning .next/static == clean: MONGO_PW / JWT / BLOB
=== scanning public ===      clean: MONGO_PW / JWT / BLOB
```

No `mongodb+srv` string anywhere in any built asset. `NEXT_PUBLIC_API_BASE_URL` *is* inlined into `out/_next/static/chunks/*` — correct and intended.

**One residual risk worth naming.** `scripts/build-mobile.mjs:24-27` falls back to reading `.env.local` when `.env.mobile` is absent. That fallback only reads `NEXT_PUBLIC_API_BASE_URL`, and Next only inlines `NEXT_PUBLIC_*`, so the server-only vars in `.env.local` cannot be inlined — but it does mean `.env.local` is loaded into the mobile build environment. This is safe as designed; it becomes unsafe the moment anyone prefixes a secret with `NEXT_PUBLIC_`.

### Findings

**[LOW] `.env.local:9,10` — quoted values for `BLOB_STORE_ID` and `BLOB_READ_WRITE_TOKEN`**
The values are wrapped in literal double quotes. `scripts/build-mobile.mjs:82` strips surrounding quotes, but Next.js's own `.env` loader and `process.env` at runtime may retain them, producing a token with embedded quote characters.
*Exposure path:* not an exposure — a correctness/reliability issue that manifests as confusing auth failures against Vercel Blob.
*Impact:* Blob uploads fail with an opaque error; the natural debugging response is to start echoing the token, which is how tokens end up in logs.
*Remediation:* remove the surrounding quotes.

**[LOW] `.env.local:1-6` — dead Firebase credentials**
Six `VITE_FIREBASE_*` values for a real Firebase project. Firebase is **not a dependency** (`package.json` has no `firebase` or `firebase-admin`) and there is **not one `firebase` reference** in `app/`, `lib/`, `components/`, `hooks/`, or `utils/`. See Area 6.
*Remediation:* delete them, and delete the Firebase project if it is genuinely unused.

**No issue found:** no server-only secret is imported, referenced, or inlined anywhere client-reachable. Both the source review and the compiled-bundle scan are clean.

---

## Area 2 — Git history

Four independent checks were run. All clean.

**1. Env files ever added to any branch** (`git log --all --diff-filter=A -- '*.env*'`): exactly one result — `.env.mobile.example`, added in `784223b` ("feat: API base URL + CORS for Capacitor mobile (Phase 2)"). That file contains a placeholder URL and no secret.

**2. Pickaxe on the literal current secret values** — the real `MONGODB_URI`, its extracted password component (16 chars), `NEXT_JWT_SECRET`, `BLOB_READ_WRITE_TOKEN`, and `VITE_FIREBASE_API_KEY` were each fed to `git log --all -S`. **Every search returned zero commits.**

**3. Pickaxe on the variable names** (`-S 'MONGODB_URI'`, `-S 'NEXT_JWT_SECRET'`, `-S 'BLOB_READ_WRITE_TOKEN'`, `-S 'mongodb+srv'`) returned many commits — all of them are `process.env.X` references in source, test setup, and documentation. Expected and benign. `-S 'vercel_blob_rw'` returned nothing.

**4. Content scan of every reachable blob** across the last 400 commits on all refs for a credentialed connection-string pattern (`mongodb+srv://…:…@`) and for the Vercel Blob token prefix: **zero matches**. A `git grep` over the current tree for the same patterns, plus a scan of all tracked `*.md` for `password|secret|token|api_key` assigned a 20+ char literal: **zero matches**.

**Repository visibility note:** `origin` is `https://github.com/giandaik/Construction_worker_log_new.git`, `upstream` is `https://github.com/mstath1s/Construction_worker_log.git` (a different account from the committing user, `mstathis@cognity.gr`). Worth confirming that the fork relationship and each repo's public/private status are intentional — a clean history in a repo that shouldn't be public is still a problem.

**No issue found:** no secret has ever been committed to this repository, on any branch, at any point in its history. No history rewrite or credential rotation is required on these grounds.

---

## Area 3 — `next.config.mjs`

**[HIGH] `next.config.mjs:1-25` — no security headers whatsoever**
There is no `async headers()` block in `next.config.mjs`, none in `next.config.mobile.mjs`, and no `vercel.json` exists. A repo-wide grep for `Content-Security-Policy|Strict-Transport-Security|X-Frame-Options|Referrer-Policy|Permissions-Policy` across all `.ts`/`.mjs`/`.json` returns **zero results**.

Absent, in order of consequence:

| Header | Consequence of absence |
|---|---|
| `Content-Security-Policy` | No mitigation layer against XSS. The app renders user-supplied worklog text, project names, and personnel/material strings. |
| `X-Frame-Options` / `frame-ancestors` | Clickjacking. An attacker frames `/worklogs/[id]/edit` or the admin user-creation page and overlays bait UI. |
| `Strict-Transport-Security` | Vercel terminates TLS but does not add HSTS unless configured. First-visit downgrade / SSL-strip on hostile networks — a live concern for a construction-site app on public Wi-Fi and cellular. |
| `Referrer-Policy` | Full URLs (including `/worklogs/<objectid>`) leak in `Referer` to third-party origins. Directly relevant given the OSM Nominatim reverse-geocode call documented in `CLAUDE.md`, which the docs say deliberately identifies the app via `Referer`. |
| `Permissions-Policy` | Camera and geolocation — both actively used — are not restricted, so any embedded iframe inherits access. |

*Exposure path:* every unauthenticated internet user, on every page and API response.
*Impact:* removes the standard browser-side defence layer beneath the app. On its own it exploits nothing; combined with any XSS or any framing attack it is the difference between a contained bug and account takeover.
*Remediation:* add an `async headers()` block returning at minimum `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy: camera=(self), geolocation=(self), microphone=()`. Introduce CSP in `Content-Security-Policy-Report-Only` first — Next.js inline bootstrap scripts need a nonce or hash, so a blind enforcing CSP will break the app.

**[MEDIUM] `next.config.mjs:8-11` — over-broad `images.remotePatterns` wildcard**

```js
remotePatterns: [
  { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
]
```

The wildcard matches **every Vercel Blob store on the platform**, not only this project's. There is no `pathname` constraint either.
*Exposure path:* any authenticated user (self-signup is open — `POST /api/signup`, `app/api/signup/route.ts:9`) requests `/_next/image?url=https://<attacker-store>.public.blob.vercel-storage.com/x.png&w=…`.
*Impact:* the deployment becomes an open image proxy — attacker content served from your origin (with your cache and your reputation), plus optimizer CPU/bandwidth billed to your account. Not a data-confidentiality breach.
*Remediation:* pin the exact store hostname (derivable from `BLOB_STORE_ID`) and add `pathname: '/worklogs/**'` plus the project paths actually used.

**[LOW] `next.config.mjs:3-5` and `next.config.mobile.mjs:22-24` — `eslint.ignoreDuringBuilds: true`**
Lint is not enforced at build. Any security-relevant lint rule (`react/no-danger`, `@next/next/no-html-link-for-pages`, and anything added later) is advisory only. Mitigated in practice by the pre-commit gate in `19629d1`, but a CI-only path or `--no-verify` bypasses it.

**No issue found — rewrites/proxies:** neither config declares `rewrites()`, `async proxy`, or any catch-all destination. The only `redirects()` entry is `next.config.mjs:20`, a static `/forms/new → /logs/new` permanent redirect with no user-controlled component — no open-redirect surface.

**No issue found — `compiler.removeConsole`:** enabled in production in both configs (`next.config.mjs:15`, `next.config.mobile.mjs:30`), which suppresses the `console.error` calls in `utils/auth.ts:126` and `middleware.ts:68` client-side. Correct.

---

## Area 4 — `middleware.ts`

### Route matcher enumeration

**Matcher** (`middleware.ts:86-88`) — middleware runs on everything except:
`_next/static`, `_next/image`, `favicon.ico`, `sitely-logo.png`, `hero-construction.jpg`, `screenshots/`.

The explicit-allowlist approach here is correct and the inline comment explains why: a blanket image-extension exclusion would have bypassed auth on dynamic routes like `/worklogs/x.png`. Good call.

**Public paths** (`middleware.ts:12-18`) — `/` (exact match only), `/login`, `/signup`, `/sample-log`, `/api/login`, `/api/signup`, `/api/logout`, `/_next`, `/favicon.ico`.

The exact-match treatment of `/` is correct and deliberately commented — a `"/"` entry under `startsWith` semantics would have made the entire application public. That is a real trap, and it is handled.

**Protected** — everything else, including all 15 non-auth API route files and all page routes (`/app`, `/worklogs/*`, `/projects/*`, `/logs/new`, `/admin/*`).

**Verified:** no sensitive route falls outside the matcher, and no sensitive route is reachable through a `PUBLIC_PATHS` prefix. The admin surface (`app/admin/users/page.tsx`, `app/admin/projects/new/page.tsx`) is inside the matcher and not on the public list.

### Findings

**[MEDIUM] `middleware.ts:17` — `startsWith` prefix matching on public paths**

```js
return PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath));
```

`/login` also matches `/login-admin`, `/loginbypass`, `/signup-internal`, `/api/loginbackdoor`. No such route exists today, so **this is latent, not live**.
*Exposure path:* becomes live the moment anyone adds a route whose path is a prefix-extension of a public one — a plausible future addition like `/signup-invite` or `/api/logout-all` would be silently unauthenticated.
*Impact:* unauthenticated access to a route the author assumed was protected. Silent, with no failing test.
*Remediation:* exact-match the page routes and use `startsWith` only for the genuinely prefix-shaped entries (`/_next`), e.g. `PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))`.

**[MEDIUM] `middleware.ts:62-66` — signature-only verification; no revocation, no role check**
The middleware verifies the JWT signature and expiry and nothing else. The token carries `role` (`app/api/login/route.ts:41`) and lives for 12 hours (`utils/auth.ts:30`, `.setExpirationTime("12h")`).
*Exposure path:* an admin demoted to `user`, or a user deleted outright, keeps their previous role for up to 12 hours. There is no revocation list, no token version, and no session store.
*Impact:* offboarding and demotion do not take effect until the token expires. For an app whose whole point is an auditable record of who signed off on site work, a 12-hour window where a removed supervisor can still sign logs is a meaningful gap.
*Remediation:* short-lived access tokens (15-60 min) with refresh; or a `tokenVersion` claim checked against the user document; or at minimum an explicit revocation check on state-changing routes.

**[LOW] `middleware.ts:68` — `console.error("JWT ERROR:", err)` on every failed verification**
Every expired or malformed token writes a stack trace to the Vercel function log. `removeConsole` strips client-side consoles but not server-side ones. Unauthenticated callers can inflate log volume, and the traces add nothing over a counter.

**[LOW] `middleware-helpers.ts:16-20` — feature-flag cookies set with `httpOnly: false`**
`stampFlagOverrides` writes `ff_<key>` cookies readable by JS. Correctly gated by `if (process.env.NODE_ENV === 'production') return response;` at line 13, so this never reaches production. Noted for completeness — the guard is the right one and it is in the right place.

**No issue found:** the CORS preflight ordering at `middleware.ts:28-30` is correct and non-obvious. `OPTIONS` is answered *before* the auth check, because preflight carries no cookies and a 401 there would prevent the real request from ever being sent. The reasoning is documented inline. Equally, `withCors` is applied to the 401 responses (`:50`, `:69`) so the WebView can actually read the error and know to re-authenticate.

---

## Area 5 — `capacitor.config.ts`

Full contents reviewed (20 lines) alongside the generated native configs at `android/app/src/main/assets/capacitor.config.json` and `ios/App/App/capacitor.config.json`.

| Check | Result |
|---|---|
| `server.url` set | **No** — absent. No cleartext-HTTP live-reload URL shipped. |
| `server.cleartext` | **No** — absent. |
| `server.androidScheme` | **Not set** — defaults to `https`, which is the secure default. |
| `server.allowNavigation` | **No** — absent. WebView navigation is not broadened to any external host. |
| `android:usesCleartextTraffic` | **Not set** in `AndroidManifest.xml`. |
| `networkSecurityConfig` | Not set; `android/app/src/main/res/xml/` contains only `config.xml` and `file_paths.xml`. |
| iOS `NSAppTransportSecurity` | **Absent** from `Info.plist` — ATS fully enforced, no exceptions. |
| API base URL scheme | `https://` in both `.env.mobile` and `.env.mobile.example`. |

The `packageClassList` in the iOS config is appropriately narrow: `CAPCameraPlugin`, `CAPNetworkPlugin`, `PreferencesPlugin`, `SplashScreenPlugin`, `StatusBarPlugin`. No filesystem, no WebView-bridge, no permissive plugins.

Token storage (`lib/mobile-auth.ts:15`) uses `@capacitor/preferences` under key `cw_jwt_token`. On iOS this is `UserDefaults`, **not** the Keychain — see Area 7 for the finding.

**No issue found:** the Capacitor configuration is clean. No cleartext transport, no navigation broadening, secure schemes throughout, minimal plugin surface, and ATS left fully enforced. This is the strongest area in the audit.

---

## Area 6 — Firebase

**Firebase is not used by this application.**

- `package.json` declares neither `firebase` nor `firebase-admin`.
- A recursive grep for `firebase` (case-insensitive) across `app/`, `lib/`, `components/`, `hooks/`, and `utils/` returns **zero matches**.
- `firestore.rules`, `storage.rules`, and `firebase.json` **do not exist** in the repository.
- The `src/config/firebase.ts`, `src/contexts/AuthContext.tsx`, and `src/components/auth/ProtectedRoute.tsx` paths described in `CLAUDE.md` do not exist on disk. `CLAUDE.md` flags this itself under "Important Notes" — the Firebase/Vite/Express description is documented as a legacy artifact.

Authentication is entirely JWT-via-`jose` (Area 7). There is no ID-token verification path, no anonymous sign-in, and no `authDomain` in active use, because there is no Firebase integration to have them.

**[MEDIUM] Orphaned Firebase project with unauditable rules**
`.env.local:1-6` holds live configuration for a real Firebase project (`VITE_FIREBASE_PROJECT_ID` = `co***og`) that no code uses.
*Exposure path:* if that project still exists in the Firebase console with the default permissive Firestore/Storage rules (`allow read, write: if true`, common during prototyping), the API key in `.env.local` is sufficient for anyone holding it to read and write the database. Firebase API keys are public by design **precisely because** security rules are the actual control — with no `firestore.rules` or `storage.rules` in this repo, that control cannot be verified from here.
*Impact:* unknown, and unknowable from the repository alone. If the project was ever populated with real data during the Vite-era prototype, that data may be world-readable today.
*Remediation:* check the Firebase console. If the project is unused, **delete it** — that closes the question permanently. If it must persist, set `allow read, write: if false` and commit the rules files so they are auditable. Then remove the six `VITE_FIREBASE_*` lines from `.env.local`.

**No issue found — anonymous sign-in / token verification:** not applicable. There is no Firebase auth path, so there is no unverified-token-decode risk. This is an area where the legacy documentation describes risk the code does not have.

---

## Area 7 — JWT & CORS

### JWT

Library: **`jose` v6.1.3** exclusively. `jsonwebtoken` v9.0.2 and `@types/jsonwebtoken` are declared in `package.json` (lines 41, 65) but a grep for `from 'jsonwebtoken'` / `require('jsonwebtoken')` across all `.ts`/`.tsx`/`.mjs`/`.js` returns **zero matches** — it is an unused dependency, not a second auth path.

Signing (`app/api/login/route.ts:42`, `app/api/signup/route.ts:40`) pins `alg: "HS256"` explicitly. Verification (`middleware.ts:64`, `utils/auth.ts:115`) calls `jwtVerify(token, new TextEncoder().encode(secret))` with **no `algorithms` option**.

`validateJWTSecret()` (`utils/auth.ts:10-22`) enforces presence and a 32-character minimum. The live secret is 64 characters. Good.

**[LOW] `utils/auth.ts:115-118`, `middleware.ts:64` — verification algorithm not explicitly pinned**
*Assessment:* **not currently exploitable.** Because the key is passed as a `Uint8Array`, `jose` restricts verification to the HMAC family — `alg: none` is rejected, and RS256/HS256 confusion is impossible since no asymmetric key is ever accepted. This is a defence-in-depth note, not a live vulnerability.
*Remediation:* pass `{ algorithms: ['HS256'] }` as the third argument to both `jwtVerify` calls. One line each, and it stays correct if the key type ever changes.

**[MEDIUM] `app/api/login/route.ts:23` — NoSQL operator injection in the login lookup**

```js
const { email, password } = await request.json();
...
const user = await usersCollection.findOne({ email });
```

`email` is destructured from parsed JSON and passed to `findOne` **without a type check**. A JSON body of `{"email": {"$regex": "^admin"}, "password": "guess"}` makes the query select the first account whose email starts with `admin`.
*Exposure path:* unauthenticated. `/api/login` is on `PUBLIC_PATHS` (`middleware.ts:12`).
*Impact:* **not an authentication bypass** — `compare(password, user.password)` at line 25 still runs and still requires the correct bcrypt password. The real impact is that an attacker can *select which account to attack* without knowing any email address, and can enumerate the user base one regex at a time via the 401-vs-timing difference. Combined with the missing rate limit below, this turns "guess the admin's email, then guess their password" into "just guess the admin's password."
*Remediation:* `if (typeof email !== 'string' || typeof password !== 'string') return 400;` before the query. Validating the login body with the existing Zod setup would be the consistent fix — every other route already does this.

**[HIGH] `app/api/login/route.ts` (whole file), `app/api/signup/route.ts` — no rate limiting on any authentication endpoint**
A repo-wide grep for `rate.?limit|upstash|@vercel/kv` across `app/`, `lib/`, and `package.json` returns **zero results**. There is no rate limiting anywhere in the application.
*Exposure path:* unauthenticated, over the public internet, against `/api/login` and `/api/signup`.
*Impact:* unlimited credential brute-forcing. bcrypt cost 12 (`app/api/signup/route.ts:30`) throttles the attacker to roughly 3-4 attempts/sec/worker, which is real protection against offline cracking but does not stop online guessing against a weak password. `/api/signup` is separately abusable for unlimited account creation — and since **any authenticated user can read the full user directory including every email address** (Area 9 finding on `GET /api/users`), one throwaway signup hands an attacker the complete target list for the login attack. These two findings compose.
*Remediation:* rate-limit by IP and by email on `/api/login` (e.g. 5 attempts / 15 min), add exponential backoff or account lockout, and rate-limit `/api/signup` by IP. `@upstash/ratelimit` with Vercel KV is the low-friction option on this stack. Consider CAPTCHA on signup.

**[MEDIUM] `app/api/login/route.ts:58`, `app/api/signup/route.ts:56` — JWT returned in the response body to web clients too**
The token is returned in JSON unconditionally, then *also* set as an `httpOnly` cookie (`utils/auth.ts:25-31`). The mobile client needs the body copy (`app/login/page.tsx:41` → `setMobileToken`); the web client does not.
*Exposure path:* the `httpOnly` flag on the cookie exists to keep the session token out of JavaScript's reach. Handing the identical token back in a JS-readable response body defeats that protection for the duration of the login response.
*Impact:* narrows the value of `httpOnly`. Any XSS that runs during login, or any logging/monitoring/error-reporting layer that captures response bodies, gets a 12-hour bearer token. `lib/mobile-auth.ts` is a no-op on web and nothing writes the token to `localStorage` (verified — zero grep hits for token-related storage), so the exposure is transient rather than persistent.
*Remediation:* return `token` only when the request is cross-origin (`isCrossOriginApi()` already models exactly this distinction) or gate it on an explicit client header from `apiFetch`.

**[LOW] `lib/mobile-auth.ts:15,63` — mobile JWT stored in Preferences, not the Keychain**
`@capacitor/preferences` maps to `UserDefaults` (iOS) and `SharedPreferences` (Android) — plaintext, and included in device backups. On a jailbroken/rooted device, or from an unencrypted iTunes backup, the 12-hour token is readable.
*Remediation:* `@capacitor-community/secure-storage` or an equivalent Keychain/Keystore-backed plugin. Lower priority than it looks, given the 12-hour expiry and the physical-access precondition.

**[LOW] CSRF — no tokens, but largely mitigated**
No CSRF token or double-submit pattern exists on any state-changing route. `sameSite: "lax"` (`utils/auth.ts:27`) blocks the cookie on cross-site `POST`/`PUT`/`DELETE`, and every mutating route in this app is a non-GET method. All three `GET` handlers are read-only. So the standard CSRF path is closed by the cookie policy. Retained as LOW because the protection is incidental to the `SameSite` default rather than deliberate — a future `GET`-triggered state change, or a downgrade to `sameSite: 'none'` for a mobile cookie fix, would open it with no test failing. Note `secure: process.env.NODE_ENV === "production"` at `utils/auth.ts:28` is correct.

### CORS — `lib/cors.ts`

The design is sound and well-reasoned: origins are **echoed rather than wildcarded** (`lib/cors.ts:69`), which is mandatory given `Access-Control-Allow-Credentials: true` at line 72; unknown origins get **no CORS headers at all** (`:67`) rather than a permissive fallback; and `Vary: Origin` is set (`:76`) so a shared cache cannot serve one origin's headers to another. That last one is frequently missed.

**[MEDIUM] `lib/cors.ts:22` — `http://localhost` is an allowed credentialed origin in production**
`WEBVIEW_ORIGINS` includes `'http://localhost'` for Android, and `isAllowedOrigin` (`:52`) checks it unconditionally — including in production.
*Exposure path:* any process on a victim's machine serving content on `http://localhost:80` — a malicious local app, a compromised dev server, a browser extension with a local listener — can issue credentialed cross-origin requests to the production API and **read the responses**.
*Impact:* bounded but real. The `SameSite=Lax` session cookie will *not* be attached to these cross-site subresource requests, so a browser-based attack cannot ride the web session. The genuine risk is a local process that has obtained a bearer token (see the Preferences storage finding) using it against production with full response access. Also note `'ionic://localhost'` (`:21`) is carried for "older Capacitor/Ionic shells" that this app has never shipped — dead allowlist entries only ever grow.
*Remediation:* the Android WebView origin is only meaningful to a native shell; nothing legitimate on the web should be sending `Origin: http://localhost` to production. Either drop `http://localhost` and `ionic://localhost` in production, or require a corroborating signal (a custom header the native client sets). At minimum remove `ionic://localhost` — it protects a shell that does not exist.

**[LOW] `lib/cors.ts:56` — any `localhost` port allowed outside production**
`/^https?:\/\/localhost(:\d+)?$/` in non-production. Correctly gated by `process.env.NODE_ENV !== 'production'` and justified in the comment (`npx serve out` against a local backend). Noted only because it depends entirely on `NODE_ENV` being correct in every non-local deployment — a preview environment built without `NODE_ENV=production` inherits the permissive rule.

**No issue found — env-driven origins:** `environmentOrigins()` (`lib/cors.ts:30-48`) does exact string comparison via `.includes()` at line 53. No regex, no `endsWith`, no suffix matching — so the classic `evil-yourdomain.com` bypass does not apply. `CORS_ALLOWED_ORIGINS` entries are trimmed and empty-filtered; Vercel URLs are forced to `https://` (`:45`).

---

## Area 8 — Vercel Blob

`BLOB_READ_WRITE_TOKEN` is read in exactly four places, all server-side route handlers:

| File | Line | Use |
|---|---|---|
| `app/api/upload/route.ts` | 13 | presence check before `put()` |
| `app/api/upload/pdf/route.ts` | 20 | presence check before `put()` |
| `app/api/upload/dwg/route.ts` | 26 | presence check before `put()` |
| `app/api/projects/[id]/dwgs/route.ts` | 76 | guards a best-effort `del()` |

The token is never passed to `put()` explicitly — the `@vercel/blob` SDK reads it from the environment server-side. It is **not present in any client bundle** (verified against `out/` and `.next/static/`).

### Upload endpoint controls

| Endpoint | Auth | Role | Size | Type validation | Blob pathname |
|---|---|---|---|---|---|
| `/api/upload` | `getAuthUser` :10 | any authenticated | 8 MB :26 | MIME allowlist :23 | `worklogs/{userId}/{ts}-{uuid}.{ext}` |
| `/api/upload/pdf` | `getAuthUser` :16 | `isAdmin` :18 | 25 MB :43 | `.pdf` extension :37 **and** MIME :40 | `projects/{projectId}/pdfs/{ts}-{uuid}.pdf` |
| `/api/upload/dwg` | `getAuthUser` :22 | `isAdmin` :24 | 25 MB :49 | `.dwg` extension :43 **and** MIME :46 | `projects/{projectId}/dwgs/{ts}-{uuid}.dwg` |

Path traversal is not possible on any of the three. `/api/upload` derives its extension from the already-allowlisted MIME type (`file.type.split('/')[1]`, `:30`), so `ext` can only be `jpeg`, `png`, or `webp` — the user-supplied filename is never used. The other two run `projectId` through `ValidationUtils.normalizeObjectId()` (`:35`, `:41`) and hardcode the extension. `crypto.randomUUID()` in every pathname prevents collision and enumeration.

**[MEDIUM] All three upload routes — `access: 'public'` with no authorization on read**
`app/api/upload/route.ts:34`, `app/api/upload/pdf/route.ts:51`, `app/api/upload/dwg/route.ts:56` all set `access: 'public'`.
*Exposure path:* anyone with the URL — no session required. URLs reach the browser through `app/worklogs/[id]/page.tsx`, get embedded in exported PDFs (`app/worklogs/[id]/exportToPDF.ts`), and land in `Referer` headers (compounded by the missing `Referrer-Policy` from Area 3).
*Impact:* site photographs, signed daily logs, and AutoCAD drawings are world-readable to anyone who obtains a URL. For construction documentation — site conditions, personnel, incident evidence, client drawings — this is a confidentiality question with contractual weight, not just a technical one. The `{uuid}` makes URLs unguessable, so this is "secret URL" security: adequate against enumeration, useless once a URL leaks.
*Remediation:* Vercel Blob supports private stores with time-limited signed URLs. Move to private access and mint short-lived signed URLs from an authenticated route. If `public` must stay for cost or plan reasons, add `Referrer-Policy: no-referrer` on pages rendering blob URLs and document the exposure explicitly for clients.

**[MEDIUM] `BLOB_READ_WRITE_TOKEN` used where scoped credentials would suffice**
A single read-write token is shared across photo upload (worker-reachable), PDF upload (admin), DWG upload (admin), and deletion (`app/api/projects/[id]/dwgs/route.ts:76`).
*Exposure path:* any server-side RCE, SSRF-to-env, or log leak yields full read-write-delete over the **entire** blob store.
*Impact:* no separation between the low-trust worker photo path and the destructive delete path. Compromise is all-or-nothing.
*Remediation:* Vercel Blob does not currently offer per-path scoped tokens, so the practical mitigation is client-side upload tokens (`handleUpload` from `@vercel/blob/client`) which mint a short-lived, single-upload token per request. That removes the standing read-write token from the photo path entirely — the highest-volume, lowest-trust route.

**[MEDIUM] No rate limiting or quota on `/api/upload`**
Any authenticated user — and signup is open — can upload 8 MB images without limit. There is no per-user quota, no per-hour cap, and no total-storage check.
*Exposure path:* register via `POST /api/signup`, then loop `POST /api/upload`.
*Impact:* unbounded Vercel Blob storage and bandwidth billing. A financial denial-of-service, not a data breach.
*Remediation:* per-user upload rate limit and a storage quota. Shares infrastructure with the Area 7 rate-limiting fix.

**[LOW] `app/api/upload/pdf/route.ts:8-12` and `app/api/upload/dwg/route.ts:9-18` — MIME allowlists include `application/octet-stream` and `''`**
Both accept an empty MIME type and `octet-stream`. The comment at `dwg/route.ts:8` correctly explains why (browsers are inconsistent for DWG), and both routes back this with a mandatory extension check, so it is a considered trade-off rather than an oversight. Content is never executed server-side and `contentType` is forced on write (`pdf:52`, `dwg:57`). Residual risk: a file with `.pdf`/`.dwg` extension and arbitrary bytes is stored and served from a `*.public.blob.vercel-storage.com` origin — separate from the app origin, so no same-origin script execution.
*Remediation:* magic-byte validation (`%PDF-` for PDF; `AC10xx` for DWG) would close the gap cheaply.

**No issue found — token exposure and auth gating:** the read-write token appears in no client bundle, and all three upload endpoints check authentication before touching `formData`, with the two admin routes additionally checking role. The ordering is correct — auth first, parse second.

---

## Area 9 — MongoDB

**`MONGODB_URI` is handled server-only.** Referenced at `lib/dbConnect.ts:4` and in four `scripts/*.mjs` utilities (`seed-test-user`, `migrate-sha256-passwords`, `list-users`, `analyze-project-repeat`), each of which reads it from `.env.local` at runtime rather than embedding it. Test files set `process.env.MONGODB_URI` to an in-memory `mongodb-memory-server` URI. No connection string is hardcoded in any source file, script, doc, or code comment — verified by `git grep` for a credentialed `mongodb+srv://…:…@` pattern across the tree and across history (Area 2).

**Connection string composition** (credentials redacted):
`mongodb+srv://REDACTED@REDACTED-HOST/construction_log?appName=helloWorldCluster`

**[MEDIUM] `lib/dbConnect.ts:46-48` — minimal connection options; no explicit durability or resilience settings**

```js
const opts = {
  bufferCommands: false,
};
```

The URI carries only `appName`. Missing:

| Option | Consequence |
|---|---|
| `retryWrites=true` | Driver default is `true` for `mongodb+srv`, so this is currently satisfied — but implicitly, and a driver-default change or a URI edit would silently remove it. |
| `w=majority` | Write concern falls to the cluster default. For an append-only legal record of site work, acknowledged-but-not-replicated writes can be rolled back on failover. **This is the one that matters here.** |
| `tls=true` | `mongodb+srv` implies TLS, so transport is encrypted. Satisfied implicitly. |
| `maxPoolSize` | Unbounded pooling from serverless functions can exhaust Atlas connection limits under concurrency. |
| `serverSelectionTimeoutMS` | Defaults to 30 s; a stalled selection holds a Vercel function open to its timeout. |

*Exposure path:* not attacker-reachable — this is a durability and availability concern.
*Impact:* under a replica-set failover, a worklog the app reported as saved may not survive. Given the app's purpose (signed daily logs used as project record), silent write loss is a serious correctness failure even though it is not a security breach.
*Remediation:* append `&retryWrites=true&w=majority` to the URI and add `maxPoolSize: 10, serverSelectionTimeoutMS: 5000` to `opts`.

**[HIGH] `app/api/worklogs/[id]/route.ts:18`, `app/api/projects/[id]/route.ts:6`, `app/api/projects/route.ts:6` — `GET` handlers perform no authentication or authorization**

Three read handlers query the database and return results with **no `getAuthUser()` call**:

- `app/api/worklogs/[id]/route.ts:18-37` — `findByIdWithDetails(id)` returned unconditionally. The sibling `PUT` (`:46`) and `DELETE` (`:204`) both authenticate and both call `canModify`. The `GET` does neither.
- `app/api/projects/[id]/route.ts:6-20` — `findById(id)` returned unconditionally. `getAuthUser` and `isAdmin` are imported at line 4 and used only in `PUT` (`:27`).
- `app/api/projects/route.ts:6-33` — full project list plus worklog statistics. `POST` is admin-gated at `:40`; `GET` takes no `request` parameter at all.

(`app/api/projects/default/route.ts` is in the same category.)

*Exposure path:* **currently mitigated** — `middleware.ts` gates all of `/api/*` and none of these paths are on `PUBLIC_PATHS`, so a valid JWT is required to reach them. This is a defence-in-depth failure, not a live unauthenticated hole. But it is the most consequential structural weakness in the codebase, for three reasons:

1. **Middleware is the only gate.** Any change to the matcher at `middleware.ts:86-88`, any `PUBLIC_PATHS` prefix collision (the Area 4 `startsWith` finding), or any deployment where middleware does not run exposes worklog and project data to the open internet immediately.
2. **`CLAUDE.md` states that API routes enforce auth server-side**, and explicitly relies on this to classify the missing mobile middleware as "a UX gap, not a security hole." For these four handlers that claim is not true. A documented invariant that does not hold is worse than one that was never claimed.
3. **Even with middleware working, there is no per-record authorization.** Any authenticated user — including a self-registered worker — can read *any* worklog and *any* project by ID. `PUT`/`DELETE` correctly enforce `canModify`; `GET` enforces nothing. That is a live IDOR across the entire worklog and project corpus, not a hypothetical one.

*Impact:* every worklog (crew names, hours, site conditions, signatures, photo URLs, drawings) and every project (client, location, GPS coordinates, DWG inventory) is readable by any account. Signup is open, so "any account" means "anyone."
*Remediation:* add `const user = await getAuthUser(request); if (!user) return ApiError.unauthorized();` to all four handlers — the imports are already present in two of them. Then add record-level authorization: scope worklog reads to the author, project members, or admins, mirroring the `canModify` logic already used by `PUT`/`DELETE`. `app/api/projects/route.ts:6` must also be changed to accept `request`.

**[MEDIUM] `app/api/users/route.ts:7-25` — full user directory readable by any authenticated user**
`GET /api/users` authenticates (`:9`) but performs **no role check**, then calls `findSummary()`, which projects `{ _id: 1, name: 1, email: 1, role: 1 }` (`lib/repositories/UserRepository.ts:73-81`) across **all** users with no filter.
*Exposure path:* any authenticated user. Self-signup is open, so: register → `GET /api/users` → complete staff directory with email addresses and roles.
*Impact:* every employee's name, email, and role — including which accounts are `admin`. This is the reconnaissance step that makes the Area 7 findings dangerous: the NoSQL injection lets an attacker target an account without knowing its email, and this endpoint simply hands over the emails and identifies the privileged ones. The absent rate limit then permits unlimited guessing. **Three findings, one chain.**
*Remediation:* the endpoint exists to populate dropdowns, so it needs `_id` and `name` — not `email`, and not `role`. Drop both from the projection, or gate the full response behind `isAdmin` and serve a name-only variant to everyone else.

**[MEDIUM] `lib/api/errorHandling.ts:25-30` — internal error messages returned verbatim to clients**

```js
if (error instanceof Error) {
  return NextResponse.json({ error: error.message }, { status: 500 })
}
```

Every uncaught error's `.message` is sent to the caller with HTTP 500, in all environments.
*Exposure path:* any user who can trigger an error on any route — all 22 route files funnel through `ApiError.handle`.
*Impact:* Mongoose and MongoDB driver errors carry internal detail. `MongoServerSelectionError` messages embed replica-set hostnames and topology; validation errors reveal schema field names and constraints. The upload routes make this concrete and deliberate: `ApiError.handle(new Error('BLOB_READ_WRITE_TOKEN is not configured'))` (`app/api/upload/route.ts:14`) tells an unauthenticated-adjacent caller exactly which environment variable is missing. Credential *values* are not exposed — the Mongo password does not appear in driver error messages — but infrastructure topology is.
*Remediation:* log the full error server-side (already done at `:14`) and return a generic message plus a correlation ID in production; keep verbose messages behind `NODE_ENV !== 'production'`.

**No issue found — password handling:** `bcryptjs.hash(password, 12)` on creation (`app/api/signup/route.ts:30`, `app/api/users/route.ts:50`) and `compare` on login (`app/api/login/route.ts:25`). Cost 12 is appropriate. `findSummary()` does not project the `password` field. The legacy SHA-256 migration (`scripts/migrate-sha256-passwords.mjs`, commit `c6a5534`) is present.

**No issue found — injection outside the login route:** `app/api/suggestions/route.ts` is a model of how to do this — a hardcoded `ALLOWED_FIELDS` map (`:6-11`), membership-checked before use (`:26`), `ObjectId` coercion on both `user.userId` and `projectId` (`:34`, `:37`), and a `$match` on `author` that scopes results to the caller's own logs. The aggregation pipeline is built entirely from allowlisted constants. `app/api/login/route.ts:23` is the sole injection point found.

---

## Hardening checklist — ordered by effort vs. impact

### Tier 1 — high impact, under an hour each

1. **Add `getAuthUser()` to the four unauthenticated `GET` handlers.** `app/api/worklogs/[id]/route.ts:18`, `app/api/projects/[id]/route.ts:6`, `app/api/projects/route.ts:6`, `app/api/projects/default/route.ts`. Two already import it. Four lines each; removes total dependence on middleware and makes `CLAUDE.md`'s security claim true. *(HIGH)*
2. **Type-check `email` and `password` in the login route.** `app/api/login/route.ts:10` — a two-line guard, or run the body through Zod like every other route. Closes the NoSQL operator injection. *(MEDIUM, enables HIGH)*
3. **Set `tls: { rejectUnauthorized: true }` in the SMTP transport.** `lib/email/sendEmail.ts:62-64` — delete three lines. Stops the Gmail app password being handed to any MITM. *(HIGH — see note below)*
4. **Add the security-headers block to `next.config.mjs`.** Start with `X-Frame-Options`, `HSTS`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy` — skip CSP for now. *(HIGH)*
5. **Drop `email` and `role` from the `GET /api/users` projection,** or gate the full payload behind `isAdmin`. `lib/repositories/UserRepository.ts:76`. Breaks the recon→injection→brute-force chain at its first link. *(MEDIUM)*
6. **Pin the `images.remotePatterns` hostname** to this project's blob store and add a `pathname` constraint. `next.config.mjs:10`. *(MEDIUM)*
7. **Append `&retryWrites=true&w=majority` to `MONGODB_URI`.** Protects the durability of signed work records. *(MEDIUM)*
8. **Un-quote the two `BLOB_*` values in `.env.local`.** *(LOW)*
9. **Pass `{ algorithms: ['HS256'] }` to both `jwtVerify` calls.** `middleware.ts:64`, `utils/auth.ts:115`. *(LOW)*
10. **Remove `ionic://localhost` from `WEBVIEW_ORIGINS`.** `lib/cors.ts:21` — a shell this app has never shipped. *(LOW)*

### Tier 2 — high impact, half a day each

11. **Rate-limit `/api/login` and `/api/signup`.** `@upstash/ratelimit` + Vercel KV; by IP and by email, with backoff. The single highest-value addition in this list. *(HIGH)*
12. **Genericize 500-level error messages in production.** `lib/api/errorHandling.ts:25-30` — log server-side, return a correlation ID. *(MEDIUM)*
13. **Replace prefix matching in `isPublicPath` with exact-match plus an explicit prefix list.** `middleware.ts:14-18`. *(MEDIUM)*
14. **Restrict or corroborate the `http://localhost` CORS origin in production.** `lib/cors.ts:22`. *(MEDIUM)*
15. **Resolve the orphaned Firebase project.** Check the console; delete it if unused, otherwise lock the rules to `if false` and commit `firestore.rules` / `storage.rules`. Then remove the six `VITE_FIREBASE_*` lines from `.env.local`. *(MEDIUM)*
16. **Rate-limit and quota `/api/upload`.** Shares infrastructure with item 11. *(MEDIUM)*
17. **Return the JWT in the login/signup body only for cross-origin clients.** `isCrossOriginApi()` already draws the line. *(MEDIUM)*
18. **Confirm the visibility and fork relationship of both git remotes** (`giandaik/…` and `mstath1s/…`). *(process)*

### Tier 3 — meaningful, multi-day

19. **Add record-level authorization to worklog and project reads.** Scope to author / project membership / admin, mirroring the `canModify` logic that `PUT` and `DELETE` already use. This is the real fix behind item 1. *(HIGH)*
20. **Move Vercel Blob to private access with signed URLs,** or adopt client-upload tokens (`handleUpload`) to eliminate the standing read-write token on the worker-reachable path. *(MEDIUM)*
21. **Add JWT revocation** — a `tokenVersion` claim, or shorter access tokens with refresh — so demotion and offboarding take effect immediately rather than within 12 hours. *(MEDIUM)*
22. **Roll out CSP,** `Content-Security-Policy-Report-Only` first, then enforce with nonces for Next's inline bootstrap. *(HIGH, but only after Tier 1 item 4)*
23. **Move the mobile JWT to Keychain/Keystore-backed storage.** *(LOW)*
24. **Add magic-byte validation to the PDF and DWG uploads.** *(LOW)*
25. **Remove the unused `jsonwebtoken` and `@types/jsonwebtoken` dependencies.** Prevents a future contributor introducing a second, unpinned verification path. *(LOW)*
26. **Stop enabling `eslint.ignoreDuringBuilds`,** so security lint rules are enforced in CI rather than only at pre-commit. *(LOW)*

---

## Appendix — finding outside the nine scan areas

One issue surfaced while tracing SMTP environment variables in Area 1. It is not in the assigned scope but is the most directly exploitable finding in the audit, so it is recorded here rather than dropped.

**[HIGH] `lib/email/sendEmail.ts:62-64` — TLS certificate verification disabled on the SMTP transport**

```js
tls: {
  rejectUnauthorized: false,
},
```

`createTransporter()` authenticates to `smtp.gmail.com:465` with `GMAIL_USER` and `GMAIL_APP_PASSWORD` (`:46-47`) while instructing Node to accept **any** TLS certificate.

*Exposure path:* an attacker positioned between the Vercel function and the SMTP host — DNS poisoning, BGP hijack, or a compromised egress path — presents a self-signed certificate. Node accepts it. The connection completes and the credentials are transmitted to the attacker.
*Impact:* disclosure of a Gmail app password, which grants send-as authority for the account. An attacker can send mail as the organization to the recipients configured in `RESEND_NOTIFICATION_RECIPIENTS`, and outbound worklog notifications — including any PDF attachments (`sendMailOptions.attachments`, `:20-24`) — can be intercepted in transit. Note that `rejectUnauthorized: false` removes the *only* protection against this; port 465 gives implicit TLS, but implicit TLS without certificate verification is encryption without authentication.
*Remediation:* delete the `tls` block, or set `rejectUnauthorized: true` explicitly. `smtp.gmail.com` presents a valid publicly-trusted certificate, so this requires no other change. If it was added to work around a corporate TLS-inspection proxy in a local environment, gate it on `NODE_ENV !== 'production'` — it must never be active on a deployed function.

---

*Read-only audit. No source or configuration files were modified and no commits were made. All secret values are redacted throughout.*
