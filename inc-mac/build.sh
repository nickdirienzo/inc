#!/bin/bash
set -e

echo "🔨 Building Inc.app..."

swift build -c release

APP="Inc.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
mkdir -p "$APP/Contents/Resources"

cp .build/release/Inc "$APP/Contents/MacOS/Inc"

cp -r Sources/Inc/Resources/Assets.xcassets "$APP/Contents/Resources/" 2>/dev/null || true
cp Sources/Inc/Resources/highlight.html "$APP/Contents/Resources/" 2>/dev/null || true

cat > "$APP/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleExecutable</key>
	<string>Inc</string>
	<key>CFBundleIdentifier</key>
	<string>com.inc.Inc</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>Inc</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>LSMinimumSystemVersion</key>
	<string>13.0</string>
	<key>NSHumanReadableCopyright</key>
	<string></string>
	<key>LSApplicationCategoryType</key>
	<string>public.app-category.developer-tools</string>
	<key>NSHighResolutionCapable</key>
	<true/>
</dict>
</plist>
EOF

echo "✅ Build complete: $APP"
echo "🚀 Run with: open $APP"
