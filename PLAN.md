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

## Workflow

```
1. strike new "add dark mode"
   → Creates .strike/missions/add-dark-mode/mission.json (status: new)
   → User runs: strike chat add-dark-mode

2. PM agent works on spec
   → Reads codebase, asks questions
   → Writes spec.md
   → Sets status: spec_complete

3. User approves: strike approve spec add-dark-mode
   → Sets status: plan_in_progress
   → Daemon spawns Tech Lead

4. Tech Lead creates architecture
   → Reads spec, studies codebase
   → Writes architecture.md, tasks.json
   → Sets status: plan_complete

5. User approves: strike approve plan add-dark-mode
   → Sets status: coding
   → Daemon spawns Coders for ready tasks (each in own jj workspace)

6. Coders complete tasks
   → Each works on one task in isolated workspace
   → Tech Lead reviews and squashes
   → Creates PR when all done
   → Sets status: review

7. User approves: strike approve pr add-dark-mode
   → Sets status: done
```

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
