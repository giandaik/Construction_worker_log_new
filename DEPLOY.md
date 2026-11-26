# Getting builds onto testers' phones

Two separate pipelines. Neither is automatic — each upload is a deliberate act.

| | iOS | Android |
|---|---|---|
| Needs | Apple Developer Program (paid), App Store Connect record | Play Console account (25 USD once) **or** nothing at all |
| Build machine | this Mac (Xcode 27, simulator verified) | GitHub Actions (this Mac has no JDK/SDK) |
| Fastest route to testers | TestFlight | APK link or internal app sharing |
| Review before testers | internal: none · external: ~1 day | internal: none · closed/open: days |

## Version numbers

```bash
npm run version:set      # package.json → versionName/versionCode + MARKETING_VERSION/CURRENT_PROJECT_VERSION
npm run version:check    # CI gate
```

`1.0.0` → `versionCode 10000`. Bump `package.json` for the next cut; never hand-edit the native files.

## iOS

### TestFlight (recommended)

1. App Store Connect → My Apps → **+** → new app, bundle ID `com.constructionlog.app`
   (must exist as an App ID in the developer portal first).
2. `npm run build:mobile && npx cap sync ios`
3. Open `ios/App/App.xcworkspace` (or `.xcodeproj`) → target **App** → Signing & Capabilities →
   your team, "Automatically manage signing". Distribution signing needs an **Apple Distribution**
   certificate and an App Store provisioning profile; the only identity on this Mac today is
   *Apple Development: mstath1s@hotmail.com (29BL794NHW)*.
4. Product → Destination **Any iOS Device (arm64)** → Product → **Archive**.
5. Organizer → **Distribute App → App Store Connect → Upload**.
6. App Store Connect → TestFlight:
   - **Internal testers** (up to 100, your team): available minutes after processing, no review.
   - **External testers** (up to 10 000): needs a group + the build submitted for Beta App Review,
     usually under a day. External testing also wants a "What to test" note and, if you enable
     public link, a contact email.
7. Every tester installs the **TestFlight** app and accepts the invite.

### Ad-hoc (no TestFlight, no review)

Register each tester's device UDID in the portal (Devices → +), create an **Ad Hoc** provisioning
profile for the app, Archive → Distribute → **Ad Hoc**, then either:

- send the `.ipa` and install with Apple Configurator / Finder, or
- upload it to **Firebase App Distribution** (free) and share the invite link — testers install
  through a small helper app.

Caveats: 100 devices per year per device type, and every new tester needs a new profile + rebuild.

## Android

The APK is already built: **Actions → Mobile → the `app-debug.apk` artifact** (14 days), or
`android/ConstructionLog-1.0.0-debug.apk` in the artifacts folder. It is a debug build, signed
with the debug key, and points at the production backend.

### Fastest: hand out the APK (no accounts)

1. Send the `.apk` (Slack, Drive, USB).
2. On the phone: open it → allow "install unknown apps" for that source → Install.
3. Play Protect may warn "unsafe app blocked" for a self-signed build — "Install anyway".

Good for five testers and a week. Bad for anything longer: no updates, no crash reports, no
auto-upgrade.

### Firebase App Distribution (free, no store account)

**Configured on 2026-11-26.** The resources below exist; the checklist under it is the
procedure for a rebuild of the same setup.

| Thing | Value |
|---|---|
| Firebase project | `construction-worker-log` (number `92858482408`) |
| Android app | `1:92858482408:android:40fd71c4b14ae18850935d`, package `com.constructionlog.app` |
| Tester group | `testers` (alias `testers`) |
| Service account | `firebase-distribute@construction-worker-log.iam.gserviceaccount.com`, role *Firebase App Distribution Admin* |
| Repo secrets | the six below, all present on `giandaik/Construction_worker_log_new` |
| Upload keystore | PKCS12, alias `upload`, mirrored in Bitwarden Secrets Manager → project *CWL Android Signing* (`CWL_ANDROID_KEYSTORE_BASE64`, `CWL_ANDROID_KEYSTORE_PASSWORD`, `CWL_ANDROID_KEY_ALIAS`) |

The keystore is the one thing that cannot be regenerated: every future build must be signed
with it or testers (and later Play) refuse the update. It lives at `android/app/release.keystore`
(gitignored) and in the vault; losing both means a new application id.

Set up once:

1. Firebase console → **Add project** (call it `construction-log`) → inside it, **Add app →
   Android**, package name `com.constructionlog.app`. Copy the **App ID**
   (`1:…:android:…`) — that is what the script needs, not the API key.
2. **App Distribution → Testers & Groups →** create group `testers`, add emails.
3. Project settings → Service accounts → **Generate new private key** → a `.json` file.
4. A signing key, so testers can install build N+1 over build N (see
   "First-time keystore" below), pushed into six repository secrets:

   ```bash
   gh secret set ANDROID_KEYSTORE_BASE64 < <(base64 -i android/app/release.keystore | tr -d '\n')
   gh secret set ANDROID_KEYSTORE_PASSWORD   # prompts — never on the command line
   gh secret set ANDROID_KEY_ALIAS
   gh secret set ANDROID_KEY_PASSWORD
   gh secret set FIREBASE_APP_ID_ANDROID     # 1:…:android:…
   gh secret set FIREBASE_SERVICE_ACCOUNT < service-account.json
   ```

5. Locally: `npx firebase-tools@14 login` (browser, once), then
   ```bash
   printf 'FIREBASE_APP_ID_ANDROID=1:…:android:…\n' > .env.firebase   # gitignored
   ```

Every release after that:

```bash
npm run version:set
npm run build:mobile && npx cap sync android
cd android && ./gradlew assembleRelease && cd ..   # upload-key signed
npm run dist:android -- --notes "Back button, signed-in flow"
```

or **Actions → Mobile → Run workflow** → *Distribute signed APK to Firebase testers*, which does
all of the above. Testers get an email, install the **App Tester** app once, then tap Install on
each build. Uploads land at <https://console.firebase.google.com/project/_/appdistribution>.

Notes:

- Firebase wants an **APK**, not an `.aab`, and it must be signed — an unsigned
  `assembleRelease` output installs nowhere. The CI job restores the upload keystore from
  `ANDROID_KEYSTORE_BASE64` (`scripts/ci-android-keystore.sh`) and builds `assembleRelease`.
- Builds from the plain *Export + debug APK* job are **debug-signed with a throwaway key regenerated
  on every runner**. Installing one over another fails with "App not installed" — that is why
  tester builds go through the signed job.
- iOS works too (`npm run dist:ios -- build/App.ipa`) but the `.ipa` must already be **Ad Hoc**
  signed with every tester's UDID in the profile. Firebase removes the "email me the file" step,
  not the UDID step — TestFlight is less work for anyone outside the team.
- Groups are managed in the console; no tester email ever goes into this repository.

### Google Play internal testing (the real answer for ongoing testers)

One-time: Play Console account (25 USD), create the app with package `com.constructionlog.app`,
enrol in **Play App Signing**.

Per release:

```bash
npm run version:set
npm run build:mobile && npx cap sync android
cd android && ./gradlew bundleRelease      # needs android/keystore.properties
# → android/app/build/outputs/bundle/release/app-release.aab
```

Upload the `.aab` to **Testing → Internal testing** (up to 100 testers, live in minutes, no
review). Create the tester list once, share the opt-in link. Promote the same build to Closed →
Open → Production when ready; only Production needs a full review.

Or let CI do the build: **Actions → Mobile → Run workflow** produces the signed AAB when these
secrets exist — `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`.

### First-time keystore (one machine, keep it forever)

```bash
cd android/app
keytool -genkeypair -v -keystore release.keystore -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -i release.keystore | pbcopy      # → ANDROID_KEYSTORE_BASE64
```

Back the file and both passwords up somewhere that is not this laptop. Losing the upload key
means a new app listing (Play App Signing can reset it, but only once and with paperwork).

## Store paperwork that blocks the first upload

- Privacy policy URL (the app collects name, email, work-log text, photos, site addresses).
- iOS: App Privacy answers in App Store Connect, screenshots per device size, age rating.
- Android: Data safety form, content rating questionnaire, feature graphic + screenshots.
- Both: a demo account for reviewers, since the app is useless without one.

## Known-before-shipping gaps

- The **calendar** screen and the site/project detail data gaps listed in the redesign README are
  product gaps, not chrome.
- Android has never been run on a device or emulator (`DEPLOY.md` §Android "unverified"); the
  first install should be treated as a smoke test, not a release.
