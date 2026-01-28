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

## Features

### Group Chat with Planning Docs

The Inc Mac app provides a **unified group chat interface** where you can discuss epic planning documents with PM and Tech Lead agents simultaneously. This eliminates the need to think about which agent to talk to - both agents respond based on their expertise.

#### How It Works

1. **Select an epic** from the left sidebar
2. **View a planning document** (spec.md or architecture.md) by clicking "View Spec" or "View Architecture"
3. **Click "Chat about this epic"** button in the document header
4. **Ask questions naturally** - PM and Tech Lead both see your message and respond based on their domain:
   - **PM Agent** (purple badge) responds to product/scope/requirements questions
   - **Tech Lead Agent** (orange badge) responds to architecture/implementation questions

#### Example Conversation

```
You: Is feature X in scope for this epic?

PM: Yes, feature X is in scope. It's covered by requirement R3 in the spec.
The goal is to enable users to...

Tech Lead: Architecturally, we'll implement feature X using the existing
API layer. I'll add a new endpoint at /api/feature-x that...
```

Both agents respond to the same message, giving you a complete picture from both product and technical perspectives.

#### Chat Features

- **Multi-agent responses**: Both PM and Tech Lead can respond to the same question
- **Role badges**: Each message shows which agent responded (PM, Tech Lead, or System)
- **Chat history**: Conversations persist across sessions - close and reopen the epic to resume
- **Real-time streaming**: See agent responses as they're being written
- **Read-only context**: Agents can read spec.md, architecture.md, and tasks.json but cannot edit during chat (v1 limitation)

#### When to Use Chat vs CLI

**Use the Mac app chat when:**
- You want to discuss or clarify the spec or architecture
- You need both product and technical perspectives
- You're reviewing planning docs and have questions
- You want to explore alternatives without committing to changes

**Use CLI commands when:**
- You want to make definitive changes to epic status
- You're creating new epics or tasks
- You're approving plans or managing workflow state
- You need to run bulk operations

#### Keyboard Shortcuts

- **Send message**: `⌘↩` (Cmd+Return)
- **New line in message**: `↩` (Return)
- **Focus chat input**: Click "Chat about this epic" button

#### Chat History Storage

Chat conversations are stored in `~/.inc/projects/<hash>/epics/<epic-id>/chat.jsonl` as JSONL (JSON Lines) format. Each message is a single line with role, content, and timestamp.

**Note**: The Mac app keeps the last 20 messages in memory for performance, but the full history is preserved in chat.jsonl.

#### Limitations (v1)

- **No automatic spec/architecture sync**: When PM mentions updating the spec during chat, Tech Lead doesn't automatically update architecture. You need to ask Tech Lead explicitly as a follow-up.
- **No agent-to-agent conversation**: Agents don't talk to each other directly. They only respond to your messages.
- **No file editing during chat**: Agents can't edit spec.md or architecture.md during chat. Use CLI commands like `inc chat` for interactive editing sessions.
- **No document auto-reload**: If you ask an agent to update a document, you'll need to close and reopen it to see changes (auto-reload feature planned for v2).

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
