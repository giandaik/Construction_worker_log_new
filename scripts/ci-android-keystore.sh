#!/usr/bin/env bash
# Materialises the Android upload keystore for a CI build.
#
# Reads:
#   ANDROID_KEYSTORE_BASE64   base64 of release.keystore (single line)
#   ANDROID_KEYSTORE_PASSWORD
#   ANDROID_KEY_ALIAS
#   ANDROID_KEY_PASSWORD
#   ANDROID_DIR               optional, defaults to "android" (probe runs)
#
# Writes android/app/release.keystore and android/keystore.properties, both
# gitignored. Every value stays inside this script: nothing is echoed, and the
# properties file is created with mode 600.
set -euo pipefail

: "${ANDROID_KEYSTORE_BASE64:?ANDROID_KEYSTORE_BASE64 is not set — see DEPLOY.md}"

ANDROID_DIR="${ANDROID_DIR:-android}"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "::error::$ANDROID_DIR does not exist; run this from the repository root" >&2
  exit 1
fi

umask 077
printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$ANDROID_DIR/app/release.keystore"

# Sanity check: a JKS/PKCS12 file starts with the magic bytes FE ED FE ED
# (JKS) or 30 82 (DER/PKCS12). A truncated secret decodes to garbage and
# fails later inside Gradle with a message that names no cause.
magic=$(od -An -tx1 -N4 "$ANDROID_DIR/app/release.keystore" | tr -d ' \n')
case "$magic" in
  feedfeed|3082*) ;;
  *)
    echo "::error::decoded keystore is not a JKS/PKCS12 file (magic ${magic:-empty}); the secret is truncated or not base64" >&2
    exit 1
    ;;
esac

{
  echo "storeFile=release.keystore"
  echo "storePassword=${ANDROID_KEYSTORE_PASSWORD:?ANDROID_KEYSTORE_PASSWORD is not set}"
  echo "keyAlias=${ANDROID_KEY_ALIAS:?ANDROID_KEY_ALIAS is not set}"
  echo "keyPassword=${ANDROID_KEY_PASSWORD:?ANDROID_KEY_PASSWORD is not set}"
} > "$ANDROID_DIR/keystore.properties"

echo "keystore ready: $ANDROID_DIR/app/release.keystore ($(wc -c < "$ANDROID_DIR/app/release.keystore" | tr -d ' ') bytes), alias present"
