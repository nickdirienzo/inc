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
# Create a new mission
inc new "Add dark mode support"

# Chat with the PM to refine the spec
inc chat <mission-id>

# Check status
inc status

# Start the background daemon
inc daemon start
```

## Project Structure

```
.inc/                    # Local state directory
  missions/
    <mission-id>/
      mission.json       # Mission metadata and status
      spec.md           # PM-written specification
      architecture.md   # Tech Lead architecture doc
      tasks.json        # Breakdown of work
      chats/            # Chat transcripts

~/.inc/                  # Global state
  registry.json          # Cross-project mission lookup
```

## Status

This is an experiment. See [PLAN.md](PLAN.md) for implementation status and [ARCHITECTURE.md](ARCHITECTURE.md) for design details.

## License

MIT
