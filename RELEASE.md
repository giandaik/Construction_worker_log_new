# Release runbook

How to produce a store-ready build. Everything the repo can own is done — what
is left is signing material and store records, which are per-account and never
committed.

## What ships

| Target | Command | Output |
|---|---|---|
| Web (existing) | `npm run build` | Vercel |
| Android | `npm run build:mobile` → `npx cap sync android` → `cd android && ./gradlew bundleRelease` | `android/app/build/outputs/bundle/release/app-release.aab` |
| iOS | `npm run build:mobile` → `npx cap sync ios` → Xcode archive | `.xcarchive` → App Store Connect |

`npm run build:mobile` stages a mobile-shaped tree (no API routes, no
middleware, client-side page overrides), runs the Next static export into
`out/`, and restores the tree afterwards. `cap sync` copies `out/` into the two
native projects. Nothing else in the web build changes.

## One-time setup

1. **Backend URL.** `.env.mobile` is gitignored; create it from the example and
   point it at the production deployment:

   ```bash
   cp .env.mobile.example .env.mobile
   # NEXT_PUBLIC_API_BASE_URL=https://<production-host>
   ```

   This is inlined at build time — a build made without it talks to nothing.

2. **Android upload key.** Create it once and keep it (losing it means a new
   app listing):

   ```bash
   keytool -genkeypair -v -keystore android/app/release.keystore \
     -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   Then `android/keystore.properties` (gitignored):

   ```properties
   storeFile=release.keystore
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```

   `android/app/build.gradle` picks it up automatically; without it the release
   build is unsigned.

3. **Apple.** Bundle id `com.constructionlog.app` must exist in the Apple
   Developer portal / App Store Connect, and the Xcode project needs a team
   (`CODE_SIGN_STYLE` is already `Automatic`). The iOS target is iPhone-only.

4. **Play Console.** Create the app record, enroll in Play App Signing, and set
   up the internal testing track before the first upload.

## Per release

```bash
# 1. Version — package.json is the single source of truth
npm version 1.0.1 --no-git-tag-version     # or edit by hand
npm run version:set                       # → Android versionCode/versionName, iOS MARKETING_VERSION/current project version
npm run version:check                     # CI runs this too

# 2. Only when the artwork changed
npm run assets:make && npm run assets:generate

# 3. Web bundle + native sync
npm run build:mobile
npx cap sync

# 4. Android
cd android && ./gradlew bundleRelease      # AAB for Play; assembleRelease for an APK

# 5. iOS
open ios/App/App.xcodeproj                 # Product → Archive, then Distribute App
```

Build numbers are derived (`major*10000 + minor*100 + patch`), so they always
increase with the version. To re-cut the same version — a store rejection, say —
set `BUILD_NUMBER` for that build:

```bash
BUILD_NUMBER=10001 npm run version:set
```

## What CI proves

`.github/workflows/mobile.yml` builds the static export, syncs it into both
native projects, assembles a debug APK, and compiles the iOS project for the
simulator. It runs on pull requests that touch app code, native projects, or the
build scripts. It does not sign anything.

## Store submission checklist

- [ ] Privacy policy URL — **required by both stores**. Nothing in the repo
      serves it yet; publish a page and paste the URL.
- [ ] App Store Connect: screenshots (iPhone 6.9" at minimum), description,
      keywords, support URL, age rating.
- [ ] Play Console: screenshots, feature graphic, short + full description,
      Data safety form (the app collects: name, email, work-log text, photos,
      precise location if a log is geotagged), content rating questionnaire.
- [ ] `ITSAppUsesNonExemptEncryption` is already `false` in `Info.plist` — the
      app only uses system TLS, which is exempt.
- [ ] Android release was built with R8 on (`minifyEnabled true`). Do one
      end-to-end pass on a real device: sign in, create a log with a photo,
      attach a signature, export the PDF. R8 problems show up as a blank WebView
      or "plugin not implemented", never at compile time.
- [ ] Data retention: work logs and photos live in MongoDB and Vercel Blob; the
      Data safety / privacy answers must say so.

## Known limitations in v1

- **Cold-start deep links to `/worklogs/<id>` and `/projects/<id>` do not
  resolve.** The static export contains one `shell` page per dynamic route, so
  in-app navigation works but a fresh load of a real id has nothing to serve.
  Nothing links into the app from outside yet (no Universal Links / App Links),
  so this is only reachable if the OS restores a killed app onto a nested route.
  Fixing it properly means either hash routing or a native URL interceptor.
- **Sessions last 12 h.** The JWT is issued with a 12-hour expiry and there is no
  refresh token, so a crew member signs in once a day.
- **Admin screens are desktop-only**; on mobile they render an explanatory gate
  page instead of the table views.
- **Offline queue retries indefinitely.** A log that the server rejects (400)
  stays queued and is retried on every sync; there is no dead-letter state.
