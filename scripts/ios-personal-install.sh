#!/usr/bin/env bash
# Install the app on your OWN iPhone with a free Apple "Personal Team".
#
# No Apple Developer Program membership, so: the build is signed with a
# development profile that expires 7 days after it was issued, and the app stops
# launching when it does. Re-run this script to re-sign. A personal team covers
# 3 devices, 10 App IDs and 3 apps per device — it is for your phone only, not a
# way to hand an install to someone else.
#
# Requirements:
#   * Xcode signed in with your Apple Account (Settings → Accounts) — the free
#     "Apple Development" certificate must already exist in the keychain.
#   * The iPhone plugged in with a cable (or paired over Wi-Fi), unlocked, and
#     Developer Mode switched on: Settings → Privacy & Security → Developer Mode,
#     then restart the phone.
#
# Usage: bash scripts/ios-personal-install.sh [--team <TEAMID>] [--device <UDID>]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

TEAM="${APPLE_PERSONAL_TEAM_ID:-}"
DEVICE="${IOS_DEVICE_UDID:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --team) TEAM="${2:-}"; shift 2 ;;
    --device) DEVICE="${2:-}"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# --- personal team -----------------------------------------------------------
if [ -z "$TEAM" ]; then
  # Xcode's own record is authoritative: the free team it created for the signed-in
  # Apple Account. A stale `Apple Development` certificate in the keychain can belong
  # to a different team (an older account), and xcodebuild then fails with
  # "No Account for Team <id>".
  TEAM="$(python3.12 - <<'PY'
import plistlib, sys
try:
    prefs = plistlib.load(open("/Users/%s/Library/Preferences/com.apple.dt.Xcode.plist" % __import__("getpass").getuser(), "rb"))
except Exception:
    sys.exit(0)
for teams in (prefs.get("IDEProvisioningTeamByIdentifier") or {}).values():
    for team in teams if isinstance(teams, list) else [teams]:
        if isinstance(team, dict) and team.get("teamType") == "Personal Team":
            print(team.get("teamID", ""))
            sys.exit(0)
PY
)"
fi
if [ -z "$TEAM" ]; then
  TEAM="$(security find-identity -v -p codesigning 2>/dev/null \
    | sed -nE 's/.*"Apple Development: [^"]*\(([A-Z0-9]{10})\)".*/\1/p' | head -1)"
fi
if [ -z "$TEAM" ]; then
  cat >&2 <<'MSG'
error: no Personal Team found.

Fix it once, in Xcode: Settings → Accounts → + → sign in with your Apple Account.
Xcode then creates a free "Apple Development" certificate and a Personal Team.
MSG
  exit 1
fi
echo "team:    $TEAM"

# --- the phone ---------------------------------------------------------------
if [ -z "$DEVICE" ]; then
  LIST="$(mktemp -t devicectl)"
  xcrun devicectl list devices --json-output "$LIST" >/dev/null 2>&1 || true
  DEVICE="$(python3.12 - "$LIST" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
for dev in data.get("result", {}).get("devices", []):
    conn = dev.get("connectionProperties", {}) or {}
    # Simulators report transportType "sameMachine"; a real phone is wired or on
    # the local network, and only those can be installed on.
    if conn.get("transportType") in ("wired", "localNetwork") and conn.get("pairingState") == "paired":
        print(dev.get("hardwareProperties", {}).get("udid") or dev.get("identifier"))
        break
PY
)"
fi
if [ -z "$DEVICE" ]; then
  cat >&2 <<'MSG'
error: no iPhone found.

Plug the phone in with a cable, unlock it, tap "Trust", and make sure
Settings → Privacy & Security → Developer Mode is on. Then run this again.
MSG
  # The personal team already has registered devices (the profile lists them);
  # naming them saves guessing which iPhone this machine has signed before.
  # PlistBuddy cannot read /dev/stdin here — `security cms` needs a real file.
  hint="$(mktemp -t prof)"
  for prof in ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/*.mobileprovision; do
    [ -f "$prof" ] || continue
    security cms -D -i "$prof" -o "$hint" 2>/dev/null || continue
    /usr/libexec/PlistBuddy -c 'Print :ProvisionedDevices' "$hint" 2>/dev/null \
      | grep -oE '[0-9A-F]{8}-[0-9A-F]{16}' | sed 's/^/  registered device: /'
  done | sort -u >&2
  rm -f "$hint"
  exit 1
fi
echo "device:  $DEVICE"

# --- build, signed by the personal team --------------------------------------
echo "syncing web assets…"
npm run build:mobile
npx cap sync ios

echo "building for the device…"
# -allowProvisioningUpdates lets Xcode create/renew the 7-day profile itself.
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination "id=$DEVICE" \
  -derivedDataPath build/ios-personal \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  build

APP="build/ios-personal/Build/Products/Debug-iphoneos/App.app"
[ -d "$APP" ] || { echo "error: expected $APP, build produced nothing" >&2; exit 1; }

echo "installing…"
xcrun devicectl device install app --device "$DEVICE" "$APP"

cat <<'MSG'

Installed. It launches from the home screen (trust the developer profile under
Settings → General → VPN & Device Management the first time).

This build expires 7 days after signing — re-run this script to refresh it.
MSG
