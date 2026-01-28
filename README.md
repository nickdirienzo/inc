# inc

An experiment with Claude Code orchestration.

## What is this?

Inc explores agent orchestration for software development using a "strike team" model:

- **PM Agent** - Takes vague ideas, asks clarifying questions, writes specs
- **Tech Lead Agent** - Produces architecture, breaks work into tasks, reviews code
- **Coder Agents** - Execute well-scoped tasks in isolated workspaces

The thesis: instead of one long-running agent session, use specialized agents that spin up, execute, and dissolve around problems.

## Installation

```bash
npm install
npm run build
npm link
```

## Usage

```bash
# Create a new epic
inc new "Add dark mode support"

# Chat with the PM to refine the spec
inc chat <epic-id>

# Check status
inc status

# Start the background daemon
inc daemon start

# Launch the Mac app (macOS only)
open inc-mac/Inc.app
```

### Mac App: Group Chat Experience

The **Inc Mission Control** Mac app provides a visual interface for managing epics with a unique **group chat** feature. Instead of choosing which agent to talk to, you can discuss planning documents with PM and Tech Lead agents in a unified chat interface.

**Key features:**
- 📄 View spec.md and architecture.md side-by-side with chat
- 💬 Ask questions naturally - both PM and Tech Lead respond based on expertise
- 🎨 Color-coded role badges (PM=purple, Tech Lead=orange)
- 💾 Chat history persists across sessions
- ⚡ Real-time agent responses with streaming

**Quick start:**
1. Build the app: `cd inc-mac && ./build.sh`
2. Run: `open Inc.app`
3. Select an epic, click "View Spec", then "Chat about this epic"

See [inc-mac/README.md](inc-mac/README.md) for detailed documentation.

## Project Structure

```
.inc/                    # Local state directory
  epics/
    <epic-id>/
      epic.json          # Epic metadata and status
      spec.md           # PM-written specification
      architecture.md   # Tech Lead architecture doc
      tasks.json        # Breakdown of work
      chats/            # Chat transcripts

~/.inc/                  # Global state
  registry.json          # Cross-project epic lookup
```

## Status

This is an experiment. See [PLAN.md](PLAN.md) for implementation status and [ARCHITECTURE.md](ARCHITECTURE.md) for design details.

## License

MIT
