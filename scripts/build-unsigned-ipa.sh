#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
DERIVED_DATA="$BUILD_DIR/DerivedData"
PACKAGE_DIR="$BUILD_DIR/ipa-package"
OUTPUT_IPA="$BUILD_DIR/pure-reader-unsigned.ipa"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "error: iPhone device binaries require macOS and Xcode." >&2
  exit 1
fi

command -v xcodebuild >/dev/null || { echo "error: xcodebuild is unavailable." >&2; exit 1; }
command -v pod >/dev/null || { echo "error: CocoaPods is unavailable." >&2; exit 1; }

cd "$ROOT_DIR"

if [[ ! -d node_modules ]]; then
  npm ci
fi

# expo-modules-jsi 57.0.3 needs an explicit Swift namespace with Swift 6.2.
node scripts/patch-expo-modules-jsi.mjs

# Generate a fresh native project so the IPA always matches app.json and package-lock.json.
npx expo prebuild --platform ios --clean --no-install

cd "$ROOT_DIR/ios"
pod install

PROJECT_PATH="$(find . -maxdepth 1 -name '*.xcodeproj' -print -quit)"
WORKSPACE_PATH="$(find . -maxdepth 1 -name '*.xcworkspace' -print -quit)"

if [[ -z "$PROJECT_PATH" || -z "$WORKSPACE_PATH" ]]; then
  echo "error: Expo prebuild did not generate an Xcode project and workspace." >&2
  exit 1
fi

SCHEME="$(xcodebuild -project "$PROJECT_PATH" -list -json | /usr/bin/ruby -rjson -e '
  data = JSON.parse(STDIN.read)
  schemes = data.dig("project", "schemes") || []
  abort "No shared application scheme found" if schemes.empty?
  puts schemes.first
')"

echo "Building workspace=$WORKSPACE_PATH scheme=$SCHEME"
rm -rf "$DERIVED_DATA" "$PACKAGE_DIR" "$OUTPUT_IPA"

xcodebuild \
  -workspace "$WORKSPACE_PATH" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  DEVELOPMENT_TEAM='' \
  build

APP_PATH="$(find "$DERIVED_DATA/Build/Products/Release-iphoneos" -maxdepth 1 -name '*.app' -print -quit)"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "error: Release iphoneos .app was not produced." >&2
  exit 1
fi

EXECUTABLE_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_PATH/Info.plist")"
EXECUTABLE_PATH="$APP_PATH/$EXECUTABLE_NAME"

if ! /usr/bin/lipo -info "$EXECUTABLE_PATH" | grep -q 'arm64'; then
  echo "error: built executable is not arm64: $(/usr/bin/lipo -info "$EXECUTABLE_PATH")" >&2
  exit 1
fi

if /usr/bin/codesign --verify "$APP_PATH" >/dev/null 2>&1; then
  echo "error: expected an unsigned app, but codesign verification succeeded." >&2
  exit 1
fi

mkdir -p "$PACKAGE_DIR/Payload"
cp -R "$APP_PATH" "$PACKAGE_DIR/Payload/"
(
  cd "$PACKAGE_DIR"
  /usr/bin/zip -qry "$OUTPUT_IPA" Payload
)

/usr/bin/unzip -tq "$OUTPUT_IPA"

echo "IPA_PATH=$OUTPUT_IPA"
echo "APP_BUNDLE=$(basename "$APP_PATH")"
echo "ARCHITECTURES=$(/usr/bin/lipo -info "$EXECUTABLE_PATH")"
echo "SIGNING=unsigned (ready for enterprise re-signing)"
