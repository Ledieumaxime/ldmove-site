#!/bin/bash
# Build the iPhone app and send it to App Store Connect (then TestFlight).
#
#   scripts/ios-release.sh            build, sign and upload
#   scripts/ios-release.sh --no-upload  stop after the signed .ipa
#
# Bumps the build number by one each run (Apple refuses a number it has
# already received). The odd steps are deliberate, see CONTEXT.md
# (update 2026-10-19):
#   - the team has no registered iPhone, so an Xcode archive with automatic
#     signing fails ("no devices"): archive unsigned, sign at export;
#   - an unsigned archive drops the entitlements, and push needs
#     aps-environment: they are attached to the archived app with a local
#     signature before export, which keeps them through the re-signing.
set -euo pipefail
cd "$(dirname "$0")/.."

TEAM=TGL464A324
BUNDLE=com.ldmove.app
OUT="${TMPDIR:-/tmp}/ldmove-ios-release"
PBX=ios/App/App.xcodeproj/project.pbxproj
DEST=upload
[ "${1:-}" = "--no-upload" ] && DEST=export

CUR=$(grep -m1 -oE "CURRENT_PROJECT_VERSION = [0-9]+" "$PBX" | grep -oE "[0-9]+$")
NEXT=$((CUR + 1))
sed -i '' "s/CURRENT_PROJECT_VERSION = $CUR;/CURRENT_PROJECT_VERSION = $NEXT;/g" "$PBX"
echo "== build $NEXT"

rm -rf "$OUT" && mkdir -p "$OUT"
npm run build
npx cap sync ios

xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/LDMove.xcarchive" \
  CODE_SIGNING_ALLOWED=NO archive | tail -1

APP="$OUT/LDMove.xcarchive/Products/Applications/App.app"
cat > "$OUT/entitlements.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>aps-environment</key><string>production</string>
<key>application-identifier</key><string>$TEAM.$BUNDLE</string>
<key>com.apple.developer.team-identifier</key><string>$TEAM</string>
</dict></plist>
EOF
for f in "$APP"/Frameworks/*.framework; do codesign --force --sign - "$f"; done
codesign --force --sign - --entitlements "$OUT/entitlements.plist" "$APP"

cat > "$OUT/export.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>teamID</key><string>$TEAM</string>
<key>signingStyle</key><string>automatic</string>
<key>destination</key><string>$DEST</string>
<key>uploadSymbols</key><true/>
</dict></plist>
EOF
xcodebuild -exportArchive -archivePath "$OUT/LDMove.xcarchive" \
  -exportOptionsPlist "$OUT/export.plist" -exportPath "$OUT/export" \
  -allowProvisioningUpdates | grep -E "error|Upload succeeded|EXPORT" || true

if [ "$DEST" = export ]; then
  (cd "$OUT/export" && unzip -qo App.ipa && codesign -d --entitlements - --xml Payload/App.app 2>/dev/null | plutil -p - | grep aps-environment)
fi
echo "== done: build $NEXT ($DEST). Add it to the TestFlight group in App Store Connect if needed."
