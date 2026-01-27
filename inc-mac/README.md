# Inc Mission Control - macOS App

Native macOS application for managing Inc epics, providing a snappy, low-resource mission control interface.

## Requirements

- macOS 13.0 (Ventura) or later
- Xcode 14.0 or later (with Swift 5.7+)
- Command Line Tools (for swiftc)

## Project Structure

```
inc-mac/
├── Inc.xcodeproj/           # Xcode project
├── Inc/
│   ├── IncApp.swift         # App entry point
│   ├── Models/              # Data models (Epic, Task, Registry, etc.)
│   ├── ViewModels/          # ObservableObject view models
│   ├── Views/               # SwiftUI views
│   ├── Services/            # File watching, JSON loading, agent communication
│   ├── Components/          # Reusable UI components
│   └── Resources/           # Assets, bundled resources
└── README.md
```

## Building the App

### Option 1: Using Xcode

1. Open `Inc.xcodeproj` in Xcode
2. Select the "Inc" scheme
3. Build and run: `⌘R` (Cmd+R)

### Option 2: Command Line (Recommended)

```bash
cd inc-mac

# Simple build (uses swiftc directly)
./build.sh

# Run the app
open Inc.app
```

**Note**: The Xcode project may require code signing setup. The `build.sh` script provides a simpler alternative that compiles all Swift files directly without Xcode project configuration.

## Configuration

### Build Settings

- **Minimum Deployment Target**: macOS 13.0 (Ventura)
- **Code Signing**: Not required when using `build.sh`
- **Sandboxing**: Disabled to allow filesystem access to `~/.inc/`
- **Hardened Runtime**: Disabled for local development
- **Swift Version**: 5.7+

### Entitlements

The app requires the following entitlements (configured in `Inc.entitlements`):

- `com.apple.security.app-sandbox`: `false` - Disabled for v1 to access `~/.inc/` directory
- `com.apple.security.files.user-selected.read-write`: Access to user-selected files
- `com.apple.security.files.downloads.read-write`: Access to Downloads folder

## Development

### Running in Debug Mode

When running from Xcode in debug mode, the app will:
- Enable SwiftUI previews for rapid development
- Show detailed error messages
- Enable debug logging

### File Watching

The app monitors these filesystem locations:
- `~/.inc/registry.json` - For epic additions/removals
- `~/.inc/projects/<project>/epics/*/epic.json` - For status changes
- `~/.inc/projects/<project>/epics/*/tasks.json` - For task progress

### Architecture

The app follows a Model-View-ViewModel (MVVM) pattern:

- **Models**: Swift structs mirroring TypeScript schemas (Epic, Task, NeedsAttention, Registry)
- **ViewModels**: ObservableObjects that watch the filesystem and manage state
- **Views**: SwiftUI components for epic list, chat interface, and context pane
- **Services**: File watching (DispatchSource), JSON parsing, TUI agent communication

## Distribution

### For Local Development

1. Build the app in Xcode
2. The built app will be in `DerivedData/Inc/Build/Products/Debug/Inc.app`
3. Copy to Applications folder or run directly

### For Distribution (Future)

1. Archive the app: `Product > Archive` in Xcode
2. Export with Developer ID signing
3. Notarize with Apple for Gatekeeper compatibility
4. Distribute via direct download or Homebrew cask

## Troubleshooting

### "Inc.app is damaged and can't be opened"

This error occurs when Gatekeeper blocks the app. To run unsigned apps in development:

```bash
xattr -cr Inc.app
```

### App can't access ~/.inc directory

Ensure sandboxing is disabled in the entitlements file (`com.apple.security.app-sandbox` = `false`).

### Build fails with code signing errors

For local development, change the signing configuration:
1. Open project settings
2. Select the "Inc" target
3. Go to "Signing & Capabilities"
4. Uncheck "Automatically manage signing"
5. Select "Sign to Run Locally"

## Performance Targets

- **Launch time**: <1s to first window (cold start)
- **Memory usage**: <50MB idle, <100MB with 50 epics loaded
- **CPU usage**: <1% average (excluding agent query execution)
- **Frame rate**: 60fps during scrolling and animations

## License

See LICENSE file in project root.
