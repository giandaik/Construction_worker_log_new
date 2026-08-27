# Dependency Security Audit — Scan 2

**fp issue:** CWL-tujwurdb (parent CWL-lyljhwbl)
**Date:** 2026-08-27
**Scope:** `package.json` + `package-lock.json` at repo root
**Method:** read-only. `npm audit`, `npm audit --omit=dev`, `npm ls`, `npm outdated`, `npm view`, lockfile static analysis, GHSA/WebSearch cross-check.
**Nothing was installed, updated, or fixed. No manifest, lockfile, or git state was modified.**

Toolchain at scan time: npm 11.7.0, Node v22.21.1, registry `https://registry.npmjs.org/`.

---

## 1. Headline numbers

| Audit run | Total | Critical | High | Moderate | Low |
|---|---|---|---|---|---|
| `npm audit --omit=dev` (production) | **9** | 1 | 6 | 2 | 0 |
| `npm audit` (production + dev) | **13** | 1 | 9 | 2 | 1 |

Dependency tree: 308 prod, 522 dev, 132 optional, 7 peer (883 total lock entries).

The 4 vulnerabilities that appear only in the full audit (`brace-expansion`, `esbuild`, `form-data`, `js-yaml`) are **dev-only** — none ship in a production bundle or run on a Vercel serverless function.

---

## 2. Audit summary table

### 2a. Production exposure (9)

| Package | Installed | Severity | Advisory | Fix avail? | Prod/Dev | Path |
|---|---|---|---|---|---|---|
| **jspdf** | 3.0.4 | **CRITICAL** | [GHSA-wfv2-pwc8-crg5](https://github.com/advisories/GHSA-wfv2-pwc8-crg5) (HTML injection, CVSS 9.6)<br>[GHSA-f8cm-6447-x5h2](https://github.com/advisories/GHSA-f8cm-6447-x5h2) (LFI/path traversal)<br>[GHSA-pqxr-3g65-p328](https://github.com/advisories/GHSA-pqxr-3g65-p328), [GHSA-9vjf-qc39-jprp](https://github.com/advisories/GHSA-9vjf-qc39-jprp), [GHSA-p5xg-68wr-hm3m](https://github.com/advisories/GHSA-p5xg-68wr-hm3m), [GHSA-7x6v-j9x4-qf24](https://github.com/advisories/GHSA-7x6v-j9x4-qf24) (PDF/AcroForm injection, 8.1)<br>[GHSA-95fx-jjr5-f39c](https://github.com/advisories/GHSA-95fx-jjr5-f39c), [GHSA-67pg-wm7f-q7fj](https://github.com/advisories/GHSA-67pg-wm7f-q7fj) (BMP/GIF decoder DoS)<br>[GHSA-vm32-vv63-w422](https://github.com/advisories/GHSA-vm32-vv63-w422), [GHSA-cjw8-79x6-5cj4](https://github.com/advisories/GHSA-cjw8-79x6-5cj4) | **Y — 4.2.1 (MAJOR)** | prod (direct) | `jspdf` |
| **next** | 15.5.19 | HIGH | [GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj) (Server Action DoS)<br>[GHSA-89xv-2m56-2m9x](https://github.com/advisories/GHSA-89xv-2m56-2m9x) (SSRF, custom servers)<br>[GHSA-p9j2-gv94-2wf4](https://github.com/advisories/GHSA-p9j2-gv94-2wf4) (SSRF via rewrites)<br>[GHSA-68g3-v927-f742](https://github.com/advisories/GHSA-68g3-v927-f742), [GHSA-4633-3j49-mh5q](https://github.com/advisories/GHSA-4633-3j49-mh5q) (cache confusion)<br>[GHSA-4c39-4ccg-62r3](https://github.com/advisories/GHSA-4c39-4ccg-62r3) (unbounded Edge payload)<br>[GHSA-q8wf-6r8g-63ch](https://github.com/advisories/GHSA-q8wf-6r8g-63ch) (Image Optimization SVG DoS)<br>[GHSA-955p-x3mx-jcvp](https://github.com/advisories/GHSA-955p-x3mx-jcvp) (Server Function endpoint disclosure) | **Y — 15.5.24, in-range** | prod (direct) | `next` |
| **nodemailer** | 7.0.13 | HIGH | [GHSA-p6gq-j5cr-w38f](https://github.com/advisories/GHSA-p6gq-j5cr-w38f) (raw option → file read + SSRF)<br>[GHSA-r7g4-qg5f-qqm2](https://github.com/advisories/GHSA-r7g4-qg5f-qqm2) (improper TLS cert validation)<br>[GHSA-268h-hp4c-crq3](https://github.com/advisories/GHSA-268h-hp4c-crq3) (List-* CRLF header injection)<br>[GHSA-wqvq-jvpq-h66f](https://github.com/advisories/GHSA-wqvq-jvpq-h66f) (jsonTransport bypass)<br>[GHSA-vvjj-xcjg-gr5g](https://github.com/advisories/GHSA-vvjj-xcjg-gr5g) (EHLO CRLF)<br>[GHSA-c7w3-x93f-qmm8](https://github.com/advisories/GHSA-c7w3-x93f-qmm8) (`envelope.size`) | **Y — 9.0.5 (2 MAJORS)** | prod (direct) | `nodemailer` |
| **postcss** | 8.5.15 (root) / **8.4.31 (pinned inside `next`)** | HIGH | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) (sourceMappingURL arbitrary `.map` read)<br>[GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) (`</style>` XSS) | **Partial — 8.5.26 for root copy; `next`'s pinned 8.4.31 is NOT fixable in the 15.x line** | prod (direct) + build | `postcss`, `next/node_modules/postcss` |
| **sharp** | 0.34.5 | HIGH | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) (libvips CVE-2026-33327/33328/35590/35591) | **Y — 0.35.4**, allowed by `next`'s optional range `^0.34.3 \|\| ^0.35.3` | prod (transitive) | `next` → `sharp` |
| **undici** | 6.26.0 | HIGH | [GHSA-vxpw-j846-p89q](https://github.com/advisories/GHSA-vxpw-j846-p89q) (WS DoS)<br>[GHSA-p88m-4jfj-68fv](https://github.com/advisories/GHSA-p88m-4jfj-68fv), [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm), [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5) (header/cookie/CRLF injection)<br>[GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524), [GHSA-35p6-xmwp-9g52](https://github.com/advisories/GHSA-35p6-xmwp-9g52) (response desync / queue poisoning)<br>[GHSA-g8m3-5g58-fq7m](https://github.com/advisories/GHSA-g8m3-5g58-fq7m) (SameSite downgrade) | **Y — 6.28.0** via `@vercel/blob` 2.4.0 → 2.8.0 (in-range) | prod (transitive) | `@vercel/blob` → `undici` |
| **nanoid** | 3.3.12 | HIGH | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) (infinite loop DoS) | **Y — 3.3.18** | prod (transitive) | `next`/`tailwindcss` → `postcss` → `nanoid` |
| **mongoose** | 8.24.0 | MODERATE | [GHSA-664h-wqgq-64gw](https://github.com/advisories/GHSA-664h-wqgq-64gw) (prototype pollution via `__proto__`-prefixed dotted path in update casting, CVSS 6.5) | **Y — 8.24.1+ (8.24.4 in-range)** | prod (direct) | `mongoose` |
| **dompurify** | 3.4.8 | MODERATE | [GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7) (IN_PLACE detached-subtree XSS)<br>[GHSA-cmwh-pvxp-8882](https://github.com/advisories/GHSA-cmwh-pvxp-8882) (`ALLOWED_ATTR` pollution)<br>[GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4), [GHSA-vxr8-fq34-vvx9](https://github.com/advisories/GHSA-vxr8-fq34-vvx9) | **Y — >3.4.12**, arrives with the `jspdf` upgrade | prod (transitive) | `jspdf` → `dompurify` |

### 2b. Dev-only exposure (4)

| Package | Installed | Severity | Advisory | Fix avail? | Prod/Dev | Path |
|---|---|---|---|---|---|---|
| brace-expansion | 1.1.15 / 5.0.6 / 5.0.9 | HIGH | [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) (expansion DoS/OOM) | Y (`npm audit fix`) | **dev** | `eslint`, `eslint-config-next`, `@capacitor/cli`, `nodemon` |
| js-yaml | 4.2.0 | HIGH | [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m), [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) (quadratic CPU) | Y (`npm audit fix`) | **dev** | `eslint` → `@eslint/eslintrc` |
| form-data | 4.0.5 | HIGH | [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) (CRLF injection in multipart field names) | Y (`npm audit fix`) | **dev** | `supertest` → `superagent` |
| esbuild | 0.27.7 | LOW | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) (arbitrary file read via dev server, **Windows only**) | Y (`npm audit fix`) | **dev** | `@vitejs/plugin-react` → `vite` |

**Dev-only note:** all four are attacker-reachable only if a hostile input reaches the local toolchain (a malicious glob, YAML config, test fixture, or a shared dev server on Windows). This repo is developed on macOS (darwin). Real-world risk: low. Still worth clearing since the fix is non-breaking.

---

## 3. Exposure notes — which advisories actually matter here

These reduce (but never eliminate) the practical severity. **Do not use them as a reason to skip the upgrades.**

- **jspdf — the critical one is partly mitigated by usage.** `app/worklogs/[id]/exportToPDF.ts` uses only `addFileToVFS`, `addFont`, `text`, `addImage`, and `output('arraybuffer')`. It never calls `.html()` (the HTML-injection sink), never calls `addJS`, and builds no AcroForm fields. **However**, `addImage` is called on user-uploaded worklog photos (lines 345, 407), which puts the **BMP and GIF decoder DoS advisories directly in the request path** — and `exportToPDFBuffer` runs **server-side** (imported by `app/api/worklogs/route.ts` and `app/api/worklogs/[id]/route.ts`), so a malformed image can stall a serverless function, not just a browser tab. The path-traversal advisory targets Node-side file access, which is exactly where this code runs. Treat as genuinely critical.
- **dompurify** ships only because `jspdf` depends on it, and it is reachable only through `jspdf.html()`, which this codebase does not call. Low practical exposure; it clears itself when `jspdf` is upgraded.
- **next — Server Actions advisories do not apply.** A repo-wide grep found **zero** `'use server'` directives; all server code is API route handlers. `GHSA-p9j2-gv94-2wf4` (SSRF via rewrites) does not apply either — `next.config.mjs` declares only static `redirects()`, no `rewrites()`. What **does** apply: `GHSA-q8wf-6r8g-63ch` (Image Optimization SVG DoS — 12 `next/image` usages in `app/` and `components/`), the cache-confusion pair, and `GHSA-955p-x3mx-jcvp`. Fix is one in-range patch bump; take it.
- **nodemailer — highest real-world concern in this report after jspdf.** `lib/email/sendEmail.ts:62-64` sets `tls: { rejectUnauthorized: false }` on the SMTP transport. That is an independent finding (it disables certificate validation on the Gmail SMTP connection unconditionally, making the session MITM-able and exposing `GMAIL_APP_PASSWORD`), and it *compounds* the TLS-validation advisory [GHSA-r7g4-qg5f-qqm2](https://github.com/advisories/GHSA-r7g4-qg5f-qqm2). The `raw`, `jsonTransport`, and `envelope.size` advisories are not reachable — the code only passes `from`/`to`/`subject`/`text`/`html`/`attachments` through `createTransport({host, port, secure, auth})`. **Recommendation: remove `rejectUnauthorized: false` regardless of the version upgrade.** (Out of scope for this read-only scan; logged here for follow-up.)
- **postcss** advisories all require processing attacker-controlled CSS with a malicious `sourceMappingURL`. Here PostCSS runs only at build time over first-party Tailwind CSS. Practical exposure is low, but see §5 for the unfixable pinned copy.
- **mongoose prototype pollution** requires an attacker-controlled dotted path reaching an update operation. Worklog/project updates are Zod-validated (`lib/schemas/`), which narrows this considerably, but Zod `.passthrough()`/loose object shapes would reopen it. Patch is in-range and free.
- **undici** is reachable on every Vercel Blob upload (`@vercel/blob`), i.e. every photo and DWG upload. Cookie/CRLF-injection advisories need attacker-controlled response headers from the Blob API — unlikely — but the fix is a free in-range bump.

---

## 4. Version drift (installed vs. declared semver)

**No dependency is installed outside its declared `package.json` range.** `npm ls --depth=0` reports zero `invalid` and zero `missing` entries. The drift below is all *stale-within-range* — a plain `npm update` closes it.

Security-relevant drift (fix is already inside the declared range — the lockfile is simply old):

| Package | Declared | Installed | Wanted (in-range) | Latest | Closes |
|---|---|---|---|---|---|
| next | `^15.2.8` | 15.5.19 | **15.5.24** | 16.3.3 | all 8 `next` advisories (fixed in 15.5.21) |
| mongoose | `^8.12.1` | 8.24.0 | **8.24.4** | 9.9.4 | GHSA-664h-wqgq-64gw (fixed 8.24.1) |
| @vercel/blob | `^2.4.0` | 2.4.0 | **2.8.0** | 2.8.0 | undici → 6.28.0 |
| postcss | `^8` | 8.5.15 | **8.5.26** | 8.5.26 | root postcss + nanoid (not `next`'s pinned copy) |

Non-security drift (informational): `@axe-core/playwright` 4.11.3→4.13.0, all `@capacitor/*` 8.4.2→8.5.0, all `@radix-ui/*` (e.g. `react-dialog` 1.1.15→1.1.23), `jose` 6.2.3→6.2.10, `react-hook-form` 7.77.0→7.86.0, `playwright` 1.60.0→1.62.1, `sonner` 2.0.7→2.0.8, `uuid` 14.0.0→14.0.2, `eslint` 9.39.4→9.39.5, `vitest` 3.2.6→3.2.7, `@testing-library/user-event` 14.6.1→14.6.6, `@types/leaflet` 1.9.21→1.9.22, `@types/react` 18.3.30→18.3.31.

Deliberately-held majors (React 18 line, Tailwind 3, TypeScript 5.9, Zod 3, `@types/node` 20, `lucide-react` 0.476): these are pinned or range-capped and are **not** drift. Leave them; React 19 / Tailwind 4 / Zod 4 are separate migration projects.

**One version-alignment oddity:** `eslint-config-next@^16.0.5` (installed 16.2.7) is a major ahead of `next@^15.2.8`. Not a vulnerability, but the lint config and the framework should track the same major; expect false lint signals.

**One tree oddity:** `@emnapi/runtime@1.10.0` is reported **extraneous** — present in `node_modules` but not reachable from `package.json` or the lockfile. It is a legitimate package (emscripten Node-API runtime, normally pulled by `sharp`'s platform binaries), and it is **not** in `package-lock.json`, so it is local-install residue rather than a supply-chain injection. It will disappear on a clean `rm -rf node_modules && npm ci`. Worth doing that to confirm.

---

## 5. Lockfile integrity — **CLEAN**

Static analysis of all 884 `package-lock.json` entries:

| Check | Result |
|---|---|
| `lockfileVersion` | **3** (npm 7+ format, current — good) |
| Registry hosts | **`registry.npmjs.org` only** — 883/883 resolved URLs, single host, no mirrors or private registries |
| `http://` (non-TLS) resolved URLs | **0** |
| `git+` / GitHub / direct-tarball sources | **0** |
| `file:` / `link:` / local-path deps | **0** |
| Unparsable or malformed `resolved` values | **0** |
| Entries missing an `integrity` hash | **0** |
| Integrity hash algorithm | **sha512 across all 883 entries** — no weaker `sha1`/`sha256` fallbacks |
| Packages flagged `deprecated` in the lockfile | **1** — `whatwg-encoding@3.1.1` ("Use @exodus/bytes instead"). Dev-only, via `jsdom`. Advisory-free; informational. |
| `overrides` / `resolutions` in `package.json` | **None** — no version pins masking a transitive vulnerability |
| Lockfile / manifest git status | **Unmodified** (`git status --porcelain` clean for both files) |

**No evidence of lockfile tampering, registry substitution, or unpinned/unverifiable sources.**

---

## 6. Supply-chain and hygiene checks

### 6a. Typosquatting — **CLEAN**

All **64** declared dependencies (30 prod + 34 dev) were reviewed name-by-name. Every name resolves to the canonical, well-known package. The less-common names were verified against registry repository URLs and maintainer accounts:

| Package | Repository | Maintainer(s) | Verdict |
|---|---|---|---|
| `class-variance-authority` | github.com/joe-bell/cva | joebell93 | canonical |
| `sonner` | github.com/emilkowalski/sonner | emilkowalski | canonical |
| `next-themes` | github.com/pacocoursey/next-themes | paco, trm217 | canonical |
| `tailwind-merge` | github.com/dcastil/tailwind-merge | dcas | canonical |
| `clsx` | github.com/lukeed/clsx | lukeed | canonical |
| `jose` | github.com/panva/jose | panva | canonical |
| `bcryptjs` | github.com/dcodeIO/bcrypt.js | dcode | canonical |
| `@hookform/resolvers` | github.com/react-hook-form/resolvers | bluebill1049, kotarella1110, jorisre | canonical (scoped) |
| `@vercel/blob` | github.com/vercel/storage | vercel-release-bot et al. | canonical (scoped) |
| `tailwindcss-animate` | *(no repo URL in registry metadata)* | thejameskyle | canonical author (Jamie Kyle); widely used. Missing repo field is a metadata gap, not a red flag. |
| `trim-canvas` | github.com/agilgur5/trim-canvas | agilgur5 | canonical — same maintainer as `react-signature-canvas`, consistent |

No confusable pairs found (no `@capacitor` vs `capacitor`, no `mongose`/`mongooose`, no `reakt`, no `lodash`-style lookalikes). All scoped packages use the correct org scope.

### 6b. Loose version specifiers — **CLEAN**

Programmatic scan of all 64 specifiers for `latest`, `*`, bare `>=`, `git:`, `http:`, `file:`, `link:` returned **zero matches**. Every dependency uses `^x.y.z` or an exact pin. Exact pins in use: `@types/node@20.19.25`, `typescript@5.9.3`, `react@^18`, `react-dom@^18`, `@types/react-dom@^18`, `postcss@^8`.

Note: `react: "^18"` / `postcss: "^8"` are major-only carets. Legal and intentional, but they permit a wide range — pinning to `^18.3.1` / `^8.5.26` would make the intended floor explicit.

### 6c. `.npmrc`, `packageManager`, `engines` — checked, mostly absent

| Item | Status |
|---|---|
| Project `.npmrc` | **Does not exist.** No custom registry, no `strict-ssl=false`, no embedded auth token, no `ignore-scripts` override. Registry resolves to the default `https://registry.npmjs.org/`. Clean. |
| `packageManager` field | **ABSENT.** Not a vulnerability, but CI and contributors are free to use any npm/yarn/pnpm version, which can produce divergent trees. Recommend adding `"packageManager": "npm@11.7.0"` (matches the scanning environment). |
| `engines` field | **ABSENT.** Nothing declares the required Node version. The tree is built for Node 22 (`@types/node@20.x` declared, Node v22.21.1 in use — itself a mismatch worth tidying). Recommend `"engines": { "node": ">=20.9.0" }` or whatever Vercel's runtime is set to, so a wrong-Node install fails loudly instead of at runtime. |
| `overrides` / `resolutions` | **ABSENT** (see §5). |

---

## 7. Suspect / flagged packages

### 7.1 `react-signature-canvas@1.1.0-alpha.2` — alpha channel, unmaintained, stale transitive dep

**Flagged for maintenance risk, not for a known CVE.**

- **No known vulnerabilities.** Neither `npm audit` nor Snyk's database reports a direct advisory for this package at any version.
- **The alpha *is* the `latest` dist-tag.** The registry's `latest` tag points at `1.1.0-alpha.2`. So this is not a case of someone deliberately opting into a prerelease channel — `npm i react-signature-canvas` installs exactly this. Last publish: **2025-03-29**, ~17 months before this scan. Snyk classifies the package's maintenance status as **Inactive**.
- **The real concern is its transitive dependency.** It pins `signature_pad@^2.3.2` → resolves to **2.3.2**, while upstream `signature_pad` is at **5.1.4**. That is three majors of unreceived fixes on the canvas library that actually handles the drawn signature data. No advisory today, but it is the stalest thing in the prod tree.
- **Usage:** `components/SignaturePad.tsx` — worker/supervisor signature capture, a legally meaningful artifact in this app.
- **Recommendation:** *do not* "downgrade to stable" — `1.0.7` (2025-01-03) is older and would not help. Keep `1.1.0-alpha.2`, but add it to a watchlist and evaluate a migration to a maintained alternative (or direct `signature_pad` v5 usage) as planned work. Track the alpha explicitly rather than letting `^1.1.0-alpha.2` silently accept future prereleases.

### 7.2 `jspdf@3.0.4` — **critical, act first** (see §2a, §3)

Highest-priority item in this report. Fix requires a **major** bump to 4.2.1.

### 7.3 `nodemailer@7.0.13` — high; fix is **two majors** away, plus an independent TLS misconfiguration

See §3. The version bump (7 → 9) and the `rejectUnauthorized: false` removal are separate fixes; the second is cheaper and arguably more urgent.

### 7.4 `uuid@14.0.0` — **CLEAR**

Checked against [CVE-2026-41907 / GHSA-w5hq-g745-h8pq](https://www.miggo.io/vulnerability-database/cve/CVE-2026-41907) and CVE-2026-41988 (out-of-bounds write in `v3`/`v5`/`v6` with caller-supplied output buffers). **Those were fixed *in* 14.0.0** — the installed version is the remediated one, not the vulnerable one. `npm audit` confirms no open advisory. Usage (`hooks/useOfflineSync.ts`, `v4` only, no external buffer) would not have been in scope regardless. A patch bump to 14.0.2 is available and non-breaking, but is not security-driven.

### 7.5 `mongoose@8.24.0` — moderate, in-range fix

See §2a. Fixed in 8.24.1; `^8.12.1` already permits 8.24.4.

### 7.6 `mongodb@6.21.0` (driver) — **CLEAR**

No open advisory. `npm audit` reports nothing for the driver at 6.21.0, and a targeted search surfaced only **MongoDB server** CVEs (e.g. CVE-2026-25611, a compression-related server crash affecting server 3.4+) — those are *server-side* issues fixed by patching the MongoDB deployment, not the Node driver. If the app uses MongoDB Atlas, Atlas patches the server; if self-hosted, confirm the server version separately (out of scope for a dependency scan). Driver 7.6.0 exists but is a major bump with no security driver.

### 7.7 `next@15.5.19` — high, in-range fix

See §2a and §3. **All 8 advisories are fixed in 15.5.21**, and `^15.2.8` already permits 15.5.24. This is the cheapest large win in the report.

### 7.8 Deprecated packages

Only **one** deprecated package in the entire tree: `whatwg-encoding@3.1.1` (dev-only, via `jsdom`). No advisory. No action required.

---

## 8. Recommended upgrade order

Four waves, ordered by risk-reduction-per-unit-of-breakage. Do them as separate commits so a regression is bisectable.

### Wave 1 — free, in-range, no manifest edits (do today)

Refreshes the lockfile only; every target is already inside a declared `^` range.

```bash
npm update next mongoose @vercel/blob postcss
```

Closes: **all 8 `next` advisories**, `mongoose` prototype pollution, `undici` (7 advisories, via `@vercel/blob` 2.8.0), root `postcss`, `nanoid`. Also pulls `sharp` to 0.35.4 (allowed by `next`'s optional range `^0.34.3 || ^0.35.3`).

Breaking-change risk: **very low** — patch/minor within the same majors.

**Re-test:** `npm run test:all` (vitest + build). Specifically exercise photo upload → Vercel Blob (`@vercel/blob` minor bump touches the upload path), any `next/image` rendering, and one worklog create + one worklog update round-trip through Mongoose.

### Wave 2 — dev-only cleanup (do alongside Wave 1)

```bash
npm audit fix   # dev-tree only after Wave 1; verify with a dry run first
```

Closes: `brace-expansion`, `js-yaml`, `form-data`, `esbuild`.

Breaking-change risk: **very low**. **Re-test:** `npm run lint`, `npm test`, `npm run a11y`.

> Confirm before running that `npm audit fix` proposes no `--force`/major changes. If it does, upgrade the dev packages individually instead.

### Wave 3 — `jspdf` 3.0.4 → 4.2.1 (MAJOR — the critical fix)

```bash
# manifest edit required: "jspdf": "^4.2.1"
```

Closes: the **critical** HTML-injection advisory, path traversal, the BMP/GIF decoder DoS pair (the ones actually reachable via user-uploaded photos), and — transitively — all four `dompurify` advisories.

Breaking-change risk: **low-to-moderate**. jsPDF 4.x's documented breaking changes are narrow: it drops Internet Explorer support and **restricts filesystem access by default** (that restriction *is* the path-traversal fix). This codebase does not target IE, and it loads its font through `addFileToVFS` with an inlined base64 TTF rather than a real filesystem read (`exportToPDF.ts:98-99`) — so the fs restriction should not bite. "Should not" is not "will not."

**Re-test — this is the one that needs real verification, in both execution contexts:**
1. **Browser path:** `app/worklogs/[id]/page.tsx` → "Export to PDF". Confirm the download works and **Roboto renders correctly** (check any non-ASCII/Greek characters — the custom font registration is the most likely casualty of the fs-access change; a silent fallback to Helvetica will mangle them).
2. **Server path:** `exportToPDFBuffer` via `app/api/worklogs/route.ts` and `app/api/worklogs/[id]/route.ts` — trigger a worklog-completion email and confirm the PDF attachment is generated, non-zero-length, and opens.
3. **Image embedding:** export a worklog that has several photos attached. Verify the 2-column image grid, and confirm large/multi-page logs still paginate (`addImage` at lines 345 and 407).

### Wave 4 — `nodemailer` 7.0.13 → 9.0.5 (2 MAJORS)

```bash
# manifest edit required: "nodemailer": "^9.0.5"
```

Breaking-change risk: **moderate and under-documented.** Two major versions, and the upstream project publishes no consolidated 7→9 migration guide (verify against [the CHANGELOG](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md) and [release notes](https://github.com/nodemailer/nodemailer/releases) before starting). Note also that 9.0.0 itself shipped with a file-read/SSRF flaw fixed in 9.0.1 — **target 9.0.5, never 9.0.0.**

Mitigating factor: this codebase's API surface is small — `createTransport({host, port, secure, auth, tls})` plus `sendMail({from, to, subject, text, html, attachments})`. Those are the most stable parts of the API.

**Do this in the same PR (independent of the version bump):** remove `tls: { rejectUnauthorized: false }` from `lib/email/sendEmail.ts:62-64`. Gmail's SMTP endpoint presents a valid certificate; the override is unnecessary and it silently disables MITM protection on a connection carrying `GMAIL_APP_PASSWORD`. If it was added to work around a corporate-proxy cert, gate it behind an explicit non-production env check rather than leaving it unconditional.

**Re-test:** send one email of each of the three types — `sendSignatureNotificationEmail`, `sendWorkLogCompletedEmail` (**with** a PDF attachment — this is where Wave 3 and Wave 4 interact), and `sendRejectWorkLogEmail`. Verify TLS negotiation succeeds against `smtp.gmail.com:465` **after** removing the `rejectUnauthorized` override. Also re-run Wave 3's server-path PDF test, since attachment handling spans both changes.

### Not recommended right now

- **`next` 15 → 16, `mongoose` 8 → 9, `mongodb` 6 → 7, React 18 → 19, Tailwind 3 → 4, Zod 3 → 4, TypeScript 5 → 7.** No security driver — every open advisory is fixable without them. Each is a migration project of its own and would obscure the security-relevant diff. Schedule separately.
- **Align `eslint-config-next` with the `next` major** (currently 16.x against Next 15.x) whenever the Next 16 migration happens — not before.

### Housekeeping (no security impact)

- Add `packageManager` and `engines` to `package.json` (§6c).
- Run `rm -rf node_modules && npm ci` to clear the extraneous `@emnapi/runtime` and confirm a clean tree reproduces from the lockfile (§4).
- Consider removing `jsonwebtoken@9.0.3` and `@types/jsonwebtoken` — a repo-wide grep over `.ts`/`.tsx`/`.js`/`.mjs` (excluding `node_modules`) found **zero imports or requires**. All JWT work goes through `jose`. Two unused packages, one of them a crypto library, are avoidable attack surface. Verify against any build scripts or `mobile/` overrides before deleting.

---

## 9. Explicit clean results

Stated for the record — these checks ran and found nothing:

- ✅ **Lockfile integrity: clean.** `lockfileVersion: 3`. 883/883 resolved URLs point at `https://registry.npmjs.org` — zero `http://`, zero `git+`, zero GitHub tarballs, zero `file:`/`link:` sources, zero unparsable URLs.
- ✅ **Integrity hashes: complete and strong.** Every one of the 883 entries carries an `integrity` field, all `sha512`. No missing hashes, no weaker algorithms.
- ✅ **Typosquatting: none found.** All 64 declared dependency names verified against canonical registry entries, repository URLs, and maintainer accounts. No confusable or misspelled names, no incorrect scopes.
- ✅ **Loose version specifiers: none.** Zero dependencies pinned to `latest`, `*`, bare `>=`, or a git/http/file source. All use `^` or an exact version.
- ✅ **No project `.npmrc`.** No registry override, no `strict-ssl=false`, no `ignore-scripts` manipulation, no embedded credentials. Effective registry is the default HTTPS npm registry.
- ✅ **No `overrides` or `resolutions`** masking a transitive vulnerability.
- ✅ **No semver violations.** `npm ls --depth=0` reports zero `invalid` and zero `missing` packages — every installed version satisfies its declared range.
- ✅ **`uuid@14.0.0` is not vulnerable** to CVE-2026-41907 / CVE-2026-41988 — those were fixed *in* 14.0.0.
- ✅ **`mongodb@6.21.0` driver has no open advisory.** (MongoDB *server* CVEs are a separate, out-of-scope concern.)
- ✅ **`react-signature-canvas` has no known CVE** at any version, including the installed alpha. Flagged in §7.1 for maintenance staleness only.
- ✅ **Only one deprecated package** in the whole tree (`whatwg-encoding`, dev-only, advisory-free).
- ✅ **Next.js Server Action advisories do not apply** — zero `'use server'` directives repo-wide.
- ✅ **Next.js rewrite-SSRF advisory does not apply** — `next.config.mjs` declares only static `redirects()`, no `rewrites()`.
- ✅ **`package.json` and `package-lock.json` were not modified by this scan** — `git status --porcelain` is clean for both. No install, update, or `audit fix` was run.

---

## 10. Follow-ups raised outside dependency scope

Found while assessing exposure; each deserves its own issue.

1. **`lib/email/sendEmail.ts:62-64` — `tls: { rejectUnauthorized: false }`.** Unconditionally disables SMTP certificate validation. Makes the Gmail session MITM-able and puts `GMAIL_APP_PASSWORD` at risk. Remove, or gate behind an explicit non-production check. *(Highest-value non-dependency finding in this scan.)*
2. **Unused `jsonwebtoken` + `@types/jsonwebtoken`.** Zero source imports; `jose` does all JWT work. Removable attack surface.
3. **`@types/node@20.19.25` vs. Node v22.21.1 in use.** Type definitions lag the runtime by a major. Not a vulnerability; a correctness gap that can hide real API misuse.

---

*End of Scan 2. Read-only — no dependency, manifest, lockfile, or git state was modified.*

Sources: [jsPDF advisories](https://github.com/parallax/jsPDF/security/advisories/GHSA-f8cm-6447-x5h2) · [jsPDF releases](https://github.com/parallax/jsPDF/releases) · [Nodemailer CHANGELOG](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md) · [Nodemailer releases](https://github.com/nodemailer/nodemailer/releases) · [CVE-2026-41907 (uuid)](https://www.miggo.io/vulnerability-database/cve/CVE-2026-41907) · [uuid on Snyk](https://security.snyk.io/package/npm/uuid) · [react-signature-canvas on Snyk](https://security.snyk.io/package/npm/react-signature-canvas) · [react-signature-canvas releases](https://github.com/agilgur5/react-signature-canvas/releases) · [MongoDB Security Bulletins](https://www.mongodb.com/resources/products/mongodb-security-bulletins) · [CVE-2026-25611 analysis](https://www.catonetworks.com/blog/cato-ctrl-new-mongodb-vulnerability-cve-2026-25611/)
