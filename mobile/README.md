# Mobile (Capacitor) build overrides

`npm run build:mobile` produces a Next.js **static export** (`out/`) for the iOS
and Android WebViews. A static export has no server, so a handful of things the
web app relies on cannot exist in it:

- **API route handlers** (`app/api/`) — removed from the export. The mobile app
  calls the deployed Vercel backend instead (Phase 2 wires up the base URL).
- **`middleware.ts`** — Next refuses to build middleware with `output: 'export'`.
  Auth becomes client-side only on mobile (Phase 3 adds bearer-token auth).
- **Server components that read the request** — `getAuthUser()` needs a session
  cookie, and `app/page.tsx` queries MongoDB directly. Those pages have
  client-side replacements here.

## How it works

`scripts/build-mobile.mjs` stages a mobile-shaped tree, runs `next build`, and
restores the working tree afterwards — on success, on failure, and on Ctrl-C.
Nothing in `app/` or `next.config.mjs` is left modified. The web build is
completely untouched by any of this.

Every file under `app-overrides/` is copied to the matching path under `app/`
for the duration of the build.

| Override | Replaces | Why |
|---|---|---|
| `page.tsx` | `app/page.tsx` | Web landing is a marketing page; mobile bounces straight to `/app` (no server-side redirects in a static export). |
| `app/page.tsx` | `app/app/page.tsx` | Web dashboard queries MongoDB directly and reads the session cookie; the mobile one fetches `/api/projects` + `/api/worklogs`. |
| `admin/users/page.tsx` | same path in `app/` | Server `getAuthUser()` + `isAdmin()` gate → `<MobileAdminGate>`. |
| `admin/projects/new/page.tsx` | same path in `app/` | Same gate swap. |
| `projects/[id]/edit/page.tsx` | same path in `app/` | Same gate swap, plus `useParams()` instead of the server `params` promise. |
| `projects/[id]/layout.tsx` | *(new)* | Supplies `generateStaticParams()` for the dynamic segment. |
| `worklogs/[id]/layout.tsx` | *(new)* | Same. |

## Known limitation: deep links to dynamic routes

`/worklogs/[id]` and `/projects/[id]` are exported as a single `shell` page each,
because real ids only exist at runtime. In-app navigation works (the Next client
router handles it and the pages read their id from `useParams()`), but a cold
load straight to `/worklogs/abc123` has no file to serve. Handling that properly
belongs to the Phase 2/3 routing work.

## Adding an override

Drop the file at the path it should occupy under `app/`, mirroring the directory
structure, and add a row to the table above. No script changes needed.

## App icon and splash assets

The icon and splash set is generated from the brand logo, so it is reproducible
rather than hand-assembled. Two commands, in this order:

```bash
npm run assets:make       # builds assets/*.png from public/sitely-logo.png
npm run assets:generate   # writes every iOS/Android/PWA size
```

`scripts/make-icon-assets.mjs` crops the mark out of `public/sitely-logo.png`
(the isometric mark above the wordmark — the bounding box is detected from the
alpha channel, so a re-exported logo keeps working) and composes:

| File | Contents | Used for |
|---|---|---|
| `assets/icon.png` | mark on the dark `#151a21` surface with an amber halo, 62% height | app icon |
| `assets/icon-foreground.png` | mark alone, transparent, 42% height | Android adaptive foreground |
| `assets/icon-background.png` | dark surface + halo | Android adaptive background |
| `assets/splash.png` | amber `#FBBF24` field, mark on a dark rounded plate | launch screen |
| `assets/splash-dark.png` | inverted: dark field, bare mark | launch screen, dark mode |

The light splash keeps the amber field from `capacitor.config.ts` but sits the
mark on a dark plate — the mark's own gold is invisible against amber otherwise.
The icon is dark so it survives a light home screen wallpaper.

`assets:generate` writes directly into `ios/App/App/Assets.xcassets/` and
`android/app/src/main/res/`, both of which are committed, so review the diff and
commit it. Re-run both commands whenever the artwork changes; `npx cap sync` does
**not** regenerate icons.

Splash artwork must stay centred and safe within the middle ~1200×1200 — the
outer area gets cropped on tall or wide screens. Keep the generated splash
background in step with `SplashScreen.backgroundColor` in `capacitor.config.ts`
and `STATUS_BAR_COLOR` in `lib/mobile-statusbar.ts`.
