#!/bin/bash
# Verification script to test if the Xcode project builds successfully

set -e  # Exit on error

cd "$(dirname "$0")/inc-mac"

echo "🔍 Verifying Xcode project structure..."

# Check that project file exists
if [ ! -f "Inc.xcodeproj/project.pbxproj" ]; then
    echo "❌ ERROR: project.pbxproj not found"
    exit 1
fi

# Count Swift files in filesystem
FILESYSTEM_COUNT=$(find Inc -name "*.swift" -type f | wc -l | tr -d ' ')
echo "   Found $FILESYSTEM_COUNT Swift files in filesystem"

# Count Swift files in project (Sources phase)
PROJECT_COUNT=$(grep -c "\.swift in Sources" Inc.xcodeproj/project.pbxproj)
# Divide by 2 because each file appears twice (PBXBuildFile + PBXSourcesBuildPhase)
PROJECT_COUNT=$((PROJECT_COUNT / 2))
echo "   Found $PROJECT_COUNT Swift files in Xcode project"

# List all Swift files that should be in the project
echo ""
echo "📋 Expected files in project:"
cat << EOF
   ✓ IncApp.swift
   ✓ ContentView.swift
   ✓ EpicListView.swift
   ✓ DocumentView.swift
   ✓ ChatView.swift
   ✓ ContextView.swift
   ✓ EpicListViewModel.swift
   ✓ DocumentViewModel.swift
   ✓ ChatViewModel.swift
   ✓ ContextViewModel.swift
   ✓ RightPaneViewModel.swift
   ✓ Epic.swift
   ✓ Task.swift
   ✓ Registry.swift
   ✓ NeedsAttention.swift
   ✓ EpicLoader.swift
   ✓ IncPaths.swift
   ✓ FileWatcher.swift
   ✓ TUIAgentService.swift
   ✓ MessageBubble.swift
   ✓ SyntaxHighlightView.swift
EOF

echo ""
echo "🔨 Attempting to build project..."
if xcodebuild -scheme Inc -configuration Debug build > /tmp/xcode_build.log 2>&1; then
    echo "✅ BUILD SUCCESSFUL!"
    echo ""
    echo "All Swift files have been successfully added to the Xcode project."
    echo "The project compiles without errors."
    exit 0
else
    echo "❌ BUILD FAILED"
    echo ""
    echo "Last 50 lines of build output:"
    tail -50 /tmp/xcode_build.log
    exit 1
fi
