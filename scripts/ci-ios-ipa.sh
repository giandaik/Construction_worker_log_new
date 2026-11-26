#!/usr/bin/env bash
# Build an ad-hoc signed .ipa for Firebase App Distribution on a macOS runner.
#
# Needs, as repository secrets (see DEPLOY.md → iOS testers):
#   APPLE_CERT_P12_BASE64       the distribution certificate, .p12, base64
#   APPLE_CERT_PASSWORD         the .p12 password
#   APPLE_TEAM_ID               10 characters, Apple portal → Membership
#   APPLE_PROFILE_BASE64        the .mobileprovision, base64
#   APPLE_PROFILE_SPECIFIER     the profile's Name, exactly as in the portal
#   APPLE_EXPORT_METHOD         optional, default `ad-hoc`
#
# An `ad-hoc` or `development` profile only covers devices whose UDIDs are
# registered in the portal *before* the profile was generated. A build signed
# with a profile that lacks a tester's iPhone installs nowhere — that is a
# profile problem, not a build problem.
set -euo pipefail

: "${APPLE_CERT_P12_BASE64:?APPLE_CERT_P12_BASE64 is not set}"
: "${APPLE_CERT_PASSWORD:?APPLE_CERT_PASSWORD is not set}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID is not set}"
: "${APPLE_PROFILE_BASE64:?APPLE_PROFILE_BASE64 is not set}"
: "${APPLE_PROFILE_SPECIFIER:?APPLE_PROFILE_SPECIFIER is not set}"
METHOD="${APPLE_EXPORT_METHOD:-ad-hoc}"
RUNNER_TEMP="${RUNNER_TEMP:-$(mktemp -d)}"

if [ ! -d ios/App/App.xcodeproj ]; then
  echo "error: run from the repository root (ios/App/App.xcodeproj not found)" >&2
  exit 1
fi

# --- certificate into a throwaway keychain ----------------------------------
KEYCHAIN="$RUNNER_TEMP/signing.keychain-db"
KEYCHAIN_PASS="$(openssl rand -hex 16)"
security create-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN"

# openssl base64, not `base64 -d`: the -d flag differs between BSD and GNU.
printf '%s' "$APPLE_CERT_P12_BASE64" | openssl base64 -d -A -out "$RUNNER_TEMP/cert.p12"
security import "$RUNNER_TEMP/cert.p12" -k "$KEYCHAIN" -P "$APPLE_CERT_PASSWORD" \
  -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASS" \
  "$KEYCHAIN" >/dev/null
security list-keychains -d user -s "$KEYCHAIN" $(security list-keychains -d user | tr -d '"')
echo "certificate imported"

# --- provisioning profile ----------------------------------------------------
PROFILE_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$PROFILE_DIR"
printf '%s' "$APPLE_PROFILE_BASE64" | openssl base64 -d -A -out "$RUNNER_TEMP/profile.mobileprovision"
UUID="$(security cms -D -i "$RUNNER_TEMP/profile.mobileprovision" \
  | /usr/libexec/PlistBuddy -c 'Print :UUID' /dev/stdin)"
cp "$RUNNER_TEMP/profile.mobileprovision" "$PROFILE_DIR/$UUID.mobileprovision"
echo "profile installed: $UUID"

# --- archive -----------------------------------------------------------------
ARCHIVE="$RUNNER_TEMP/App.xcarchive"
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  PROVISIONING_PROFILE_SPECIFIER="$APPLE_PROFILE_SPECIFIER" \
  archive

# --- export ------------------------------------------------------------------
cat > "$RUNNER_TEMP/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>$METHOD</string>
  <key>teamID</key><string>$APPLE_TEAM_ID</string>
  <key>signingStyle</key><string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>com.constructionlog.app</key><string>$APPLE_PROFILE_SPECIFIER</string>
  </dict>
  <key>stripSwiftSymbols</key><true/>
  <key>compileBitcode</key><false/>
  <key>uploadSymbols</key><false/>
</dict>
</plist>
PLIST

rm -rf "$RUNNER_TEMP/ipa"
mkdir -p "$RUNNER_TEMP/ipa"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$RUNNER_TEMP/ipa" \
  -exportOptionsPlist "$RUNNER_TEMP/ExportOptions.plist"

IPA="$(/bin/ls "$RUNNER_TEMP"/ipa/*.ipa | head -1)"
mkdir -p build
cp "$IPA" build/App.ipa
echo "ipa: $(pwd)/build/App.ipa ($(du -h build/App.ipa | cut -f1))"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "IPA_PATH=$(pwd)/build/App.ipa" >> "$GITHUB_ENV"
fi
