# Strike Implementation Plan

## Current Status

### ✅ Completed

**Phase 1: Foundation**
- [x] Project setup with TypeScript, `@anthropic-ai/claude-agent-sdk`, `commander`, `chokidar`
- [x] State schema types (`Mission`, `Task`, `Decision`, `DaemonState`, `ActiveAgent`)
- [x] File structure helpers (paths.ts, io.ts with read/write for all state files)
- [x] Global registry (~/.strike/registry.json) for cross-project mission lookup

**Phase 2: Agents**
- [x] PM agent system prompt
- [x] Tech Lead agent system prompt
- [x] Coder agent system prompt
- [x] All prompts wired up in chat command

**Phase 3: CLI**
- [x] `strike init` - Initialize .strike directory
- [x] `strike new "<description>"` - Create mission with slug
- [x] `strike status [mission-id]` - Show all missions or specific mission with tasks
- [x] `strike status -g` - Show all missions across all projects
- [x] `strike chat <mission-id> [-r role]` - Interactive chat with agents
- [x] `strike approve <spec|plan|pr> <mission-id>` - Approve phase transitions
- [x] `strike daemon start|stop|status|logs` - Daemon management

**Phase 4: Daemon (Basic)**
- [x] Background daemon with file watching (chokidar)
- [x] Agent spawning based on mission status
- [x] PID file management for start/stop
- [x] Log file for daemon output

**Phase 5: jj Integration (Basic)**
- [x] Workspace creation per task (.strike/workspaces/<mission>/<task>/)
- [x] Commit description with task info

### 🚧 In Progress / Next Up

**Phase 2: Agents**
- [ ] Review squad (5 specialized reviewers)

**Phase 4: Daemon**
- [ ] Heartbeat monitoring for agent health
- [ ] Session resurrection for PM/Tech Lead
- [ ] Review spawning when Coder completes
- [ ] Concurrency limiting for Coders

**Phase 5: jj Integration (Advanced)**
- [ ] Squash/rebase workflow
- [ ] Conflict detection

### 📋 Not Started

**Phase 6: GitHub Integration**
- [ ] PR creation via `gh` CLI
- [ ] PR status polling

**Phase 7: Polish**
- [ ] CTO agent for meta-level queries
- [ ] Cost tracking per mission
- [ ] Desktop notifications
- [ ] Config file support

---

## Architecture

```
src/
├── cli/
│   ├── index.ts           # Main CLI entry point (commander)
│   └── commands/
│       ├── init.ts        # Initialize .strike directory
│       ├── new.ts         # Create new idea
│       ├── chat.ts        # Interactive chat with agents
│       ├── status.ts      # Show idea/task status
│       ├── approve.ts     # Approve spec/plan/PR
│       └── daemon.ts      # Start/stop/status/logs daemon
├── daemon/
│   └── index.ts           # Background daemon, watches files, spawns agents
├── prompts/
│   ├── pm.ts              # PM agent system prompt
│   ├── tech-lead.ts       # Tech Lead agent system prompt
│   ├── coder.ts           # Coder agent system prompt
│   └── index.ts           # Re-exports
└── state/
    ├── schema.ts          # TypeScript types for all state
    ├── paths.ts           # Path utilities for .strike directory
    ├── io.ts              # Read/write helpers with atomic writes
    └── index.ts           # Re-exports
```

## State Files

```
.strike/
├── daemon.pid             # Daemon process ID
├── daemon.log             # Daemon logs
├── daemon.json            # Active agents state
├── workspaces/            # jj workspaces for parallel Coder execution
│   └── <mission-slug>/
│       └── task-<id>/     # Each task gets its own workspace
└── missions/
    └── <mission-slug>/
        ├── mission.json   # Mission metadata and status
        ├── spec.md        # Product spec (written by PM)
        ├── architecture.md # Technical plan (written by Tech Lead)
        ├── tasks.json     # Task breakdown (written by Tech Lead)
        └── decisions.md   # Decision log (all agents)

~/.strike/
└── registry.json          # Global index of all missions across projects
```

## Quick Start

```bash
# 1. Start the daemon (watches for missions and spawns agents)
strike daemon start

# 2. Create a mission
strike new "add dark mode support"
# Or for a detailed brief:
strike new --file brief.md
# Or open $EDITOR:
strike new

# 3. Watch it work
strike daemon logs -f

# 4. Check status anytime
strike status                    # Current project missions
strike status -g                 # All missions across projects
strike status add-dark-mode      # Specific mission details

# 5. When PM finishes spec, approve to continue
strike approve spec add-dark-mode

# 6. When Tech Lead finishes plan, approve to start coding
strike approve plan add-dark-mode

# 7. When all tasks done and PR ready, approve to complete
strike approve pr add-dark-mode
```

## Workflow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. CREATE MISSION                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ $ strike new "add dark mode"                                            │
│                                                                         │
│ Creates: .strike/missions/add-dark-mode/mission.json                    │
│ Status:  new                                                            │
│                                                                         │
│ Daemon sees "new" → sets status to "spec_in_progress" → spawns PM       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. PM AGENT WORKS                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ PM reads codebase, writes clarifying questions to needs_attention       │
│ (if blocked), otherwise writes spec.md                                  │
│                                                                         │
│ When done:                                                              │
│   - Writes: .strike/missions/add-dark-mode/spec.md                      │
│   - Sets status: spec_complete                                          │
│   - Sets needs_attention: { from: "pm", question: "please review" }     │
│                                                                         │
│ ⏸️  WAITING: User must approve spec                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. USER APPROVES SPEC                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ $ strike approve spec add-dark-mode                                     │
│                                                                         │
│ Sets status: plan_in_progress                                           │
│ Clears needs_attention                                                  │
│                                                                         │
│ Daemon sees "plan_in_progress" → spawns Tech Lead                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. TECH LEAD AGENT WORKS                                                │
├─────────────────────────────────────────────────────────────────────────┤
│ Tech Lead reads spec.md, studies codebase architecture                  │
│                                                                         │
│ When done:                                                              │
│   - Writes: architecture.md (technical design)                          │
│   - Writes: tasks.json (task breakdown with dependencies)               │
│   - Sets status: plan_complete                                          │
│                                                                         │
│ ⏸️  WAITING: User must approve plan                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. USER APPROVES PLAN                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ $ strike approve plan add-dark-mode                                     │
│                                                                         │
│ Sets status: coding                                                     │
│                                                                         │
│ Daemon sees "coding" → spawns Coder for each unblocked task             │
│ (Each Coder runs in its own jj workspace if jj repo detected)           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. CODER AGENTS WORK (PARALLEL)                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Each Coder:                                                             │
│   - Works in: .strike/workspaces/add-dark-mode/task-1/                  │
│   - Reads spec.md, architecture.md, their task from tasks.json          │
│   - Writes code, runs tests                                             │
│   - When done: marks task status "done" in tasks.json                   │
│   - Creates jj commit with task description                             │
│                                                                         │
│ When ALL tasks are "done":                                              │
│   - Daemon sets status: review                                          │
│                                                                         │
│ ⏸️  WAITING: User must approve PR                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. USER APPROVES PR                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ $ strike approve pr add-dark-mode                                       │
│                                                                         │
│ Sets status: done                                                       │
│                                                                         │
│ 🎉 Mission complete!                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Manual Chat Mode

You can also drive agents manually via chat instead of daemon:

```bash
# Chat with PM about a mission
strike chat add-dark-mode -r pm

# Chat with Tech Lead
strike chat add-dark-mode -r tech-lead

# Chat with Coder for specific task
strike chat add-dark-mode -r coder -t 1
```

Chat features:
- Multiline input: type lines, empty line to send
- Animated spinner while thinking
- Transcripts saved to `.strike/missions/<id>/chats/`
- Recent chat summaries loaded for context

---

## Next Steps (Priority Order)

1. **Test chat command with real API** - Verify the SDK integration works
2. **Add review squad** - 5 specialized reviewers for code quality
3. **jj integration** - Worktrees and commit management
4. **Heartbeat/resurrection** - Keep PM/Tech Lead alive across sessions
5. **PR creation** - Automate PR creation via `gh` CLI

---

## Open Questions

1. **Coder concurrency**: How many Coders run in parallel? Start with 2, tune based on conflict rate.

2. **Context size**: Tech Lead might accumulate too much context over a long-running mission. May need periodic "compaction" where we summarize and restart.

3. **Cost tracking**: Should we track API spend per mission? Useful for understanding ROI.

4. **Rollback**: If a Coder produces bad code that passes tests, how do we recover? Tech Lead review should catch most issues, but might need `strike rollback <mission> <task-id>`.

5. **Human teammates**: How do PRs from Strike interact with PRs from human engineers? Probably fine — Strike PRs go through normal review process.

---

## Design Ideas (To Implement)

### Mission Creation with Rich Context

Currently `strike new "description"` only takes a single line. Options:
- `strike new` with no args opens $EDITOR for multiline brief
- `strike new --file brief.md` reads from file
- `strike new` then first chat message becomes the brief

### Chat Redesign

The chat experience needs rethinking:

1. **Fresh sessions**: Each `strike chat` should be a net-new session, not resuming old context. The agent should read current state from files (mission.json, spec.md, etc.) rather than relying on conversation history.

2. **Chat history with summaries**: Save recent chats to `.strike/missions/<id>/chats/` with auto-generated summaries. Agent can read summaries for quick context on what was discussed before.

3. **Natural language as primary interface**: Chat should be able to do everything the CLI can (except spawn another chat):
   - "create a new mission for adding dark mode" → runs `strike new`
   - "what's the status?" → runs `strike status`
   - "approve the spec" → runs `strike approve spec`
   - "show me all my missions" → runs `strike status -g`

   This makes `strike chat` the main entry point. Other commands become shortcuts/scripting interface.

4. **Conversation structure**:
   ```
   .strike/missions/<id>/
   ├── chats/
   │   ├── 2024-01-24-1030.json   # Full transcript
   │   ├── 2024-01-24-1030.summary.md  # Auto-generated summary
   │   └── ...
   ```
