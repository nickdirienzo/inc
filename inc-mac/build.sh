#!/bin/bash
set -e

# Simple build script for Inc.app
# This compiles all Swift files and creates an app bundle

echo "🔨 Building Inc.app..."

# Create app bundle structure
APP="Inc.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
mkdir -p "$APP/Contents/Resources"

# Find all Swift files
SWIFT_FILES=$(find Inc -name "*.swift" -type f | grep -v "Tests\.swift" | tr '\n' ' ')

echo "📦 Compiling Swift files..."
swiftc \
  -o "$APP/Contents/MacOS/Inc" \
  $SWIFT_FILES \
  -framework SwiftUI \
  -framework Foundation \
  -framework AppKit \
  -framework Combine \
  -sdk /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk \
  -target arm64-apple-macos13.0 \
  -O

# Create Info.plist
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
	<string>11.0</string>
	<key>NSHumanReadableCopyright</key>
	<string></string>
	<key>LSApplicationCategoryType</key>
	<string>public.app-category.developer-tools</string>
</dict>
</plist>
EOF

# Copy Assets if they exist
if [ -d "Inc/Resources/Assets.xcassets" ]; then
  cp -r "Inc/Resources/Assets.xcassets" "$APP/Contents/Resources/"
fi

echo "✅ Build complete: $APP"
echo "🚀 Run with: open $APP"
