# ios/AppUITests — on-device journey tests

A standalone XCUITest bundle that drives the **installed** app by bundle id, so it needs
no host-app target, no code signing and no desktop permissions. `simctl` alone cannot tap
a simulator; this is the supported way to get real touches.

## Run

```bash
cd ios/AppUITests
xcodegen generate            # writes AppUITests.xcodeproj from project.yml
SIM_UDID=<device-udid> python3 run_uitest.py AppUITests/JourneyTests
```

`run_uitest.py` reads `CWL_USER` / `CWL_PASS` from Bitwarden Secrets Manager (needs
`BWS_ACCESS_TOKEN` in the environment), passes them to the test through the
`TEST_RUNNER_` prefix, and never prints them. The xcodebuild log goes to `$TMPDIR`.

Build the app first, then install it on the target simulator:

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -derivedDataPath ios/App/build build
xcrun simctl install <udid> ios/App/build/Build/Products/Debug-iphonesimulator/App.app
```

## Tests

- `TreeDumpTests` — launches and prints the accessibility tree (`TREE-START` … `TREE-END`
  in the log). Start here: Capacitor/WKWebView exposes links, buttons and inputs with
  their aria labels, so journeys are written against real labels, not coordinates.
- `LoginTests` / `JourneyTests` — sign-in and new-log journeys.
- `FormDumpTests` — opens the new-log form and dumps it.

## Writing tests

- Type into a field with `field.tap()` then `app.typeText(...)`; `field.typeText` fails with
  "Neither element nor any descendant has keyboard focus".
- The keyboard covers lower buttons — dismiss it with the accessory bar's `Done` button
  before tapping anything underneath, and assert `isHittable` first.
- A control that changes label ("Sign in" → "Signing in…") and goes `Disabled` is a hung
  request, not a slow one: poll it instead of sleeping.

## State on device (2026-11-25)

**The bundled app now completes the whole journey on the simulator:** cold launch
restores the session from `Preferences` (WORK LOGS 47 / PROJECTS 11), New → site
picker lists the 11 projects, picking one opens the form, and Submit writes the
entry and routes to the work-log list. Verified server-side: 47 → 48 records,
then the test entry was deleted back to 47. Logout also reaches the sign-in form
now, so the dashboard is no longer a dead end.

### Why it used to hang

Two shell-level faults, both invisible from the API side:

1. **The session cookie never reaches the WebView.** `POST /api/login` sets
   `cw_session` with `Secure; HttpOnly; SameSite=lax`; the WebView origin is
   `capacitor://localhost`, which is not a secure origin, so WebKit drops the
   cookie. Every later call was a 401, which is what the Vercel log showed.
   The response body also carries a JWT, so the app's `Authorization: Bearer`
   path is the one that works — it is what `lib/mobile-auth.ts` stores.
2. **`await import('@capacitor/core')` never settles inside WKWebView.** That
   promise neither resolves nor rejects, so `isMobileApp()` never answered and
   every `apiFetch` hung before it touched the network — no fetch, no plugin
   call, no error. Symptom: "Signing in…" forever, "Loading sites…" forever.
   The shell injects the same objects as `window.Capacitor`, so
   `lib/native-bridge.ts` reads them synchronously and `apiFetch` sends through
   `CapacitorHttp` (URLSession) instead of the WebView hop.

The earlier note that "the shell's networking is fine" was measured through a
probe page that called `window.Capacitor` directly — true, and still true; the
bridge was never the problem, the module loader was.

`cap copy` + `xcodebuild` + `simctl install` is the loop for getting a rebuilt
bundle onto the device; `simctl` alone cannot tap, which is why this bundle exists.


