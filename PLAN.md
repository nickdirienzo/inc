# Inc Implementation Plan

## Current Status

### ✅ Completed

**Phase 1: Foundation**
- [x] Project setup with TypeScript, `@anthropic-ai/claude-agent-sdk`, `commander`, `chokidar`
- [x] State schema types (`Epic`, `Task`, `Decision`, `DaemonState`, `ActiveAgent`)
- [x] File structure helpers (paths.ts, io.ts with read/write for all state files)
- [x] Global registry (~/.inc/registry.json) for cross-project epic lookup

**Phase 2: Agents**
- [x] PM agent system prompt
- [x] Tech Lead agent system prompt
- [x] Coder agent system prompt
- [x] All prompts wired up in chat command

**Phase 3: CLI**
- [x] `inc init` - Initialize .inc directory
- [x] `inc new "<description>"` - Create epic with slug
- [x] `inc status [epic-id]` - Show all epics or specific epic with tasks
- [x] `inc status -g` - Show all epics across all projects
- [x] `inc chat <epic-id> [-r role]` - Interactive chat with agents
- [x] `inc approve <spec|plan|pr> <mission-id>` - Approve phase transitions
- [x] `inc daemon start|stop|status|logs` - Daemon management

**Phase 4: Daemon (Basic)**
- [x] Background daemon with file watching (chokidar)
- [x] Agent spawning based on mission status
- [x] PID file management for start/stop
- [x] Log file for daemon output

**Phase 5: jj Integration (Basic)**
- [x] Workspace creation per task (.inc/workspaces/<epic>/<task>/)
- [x] Commit description with task info

### 🚧 In Progress / Next Up

**Phase 5: jj Integration (Advanced)**
- [ ] Squash/rebase workflow
- [ ] Conflict detection

**Phase 2: Agents**
- [ ] Review squad (5 specialized reviewers)

**Phase 4: Daemon**
- [ ] Heartbeat monitoring for agent health
- [ ] Session resurrection for PM/Tech Lead
- [ ] Review spawning when Coder completes
- [ ] Concurrency limiting for Coders

#### jj Workspace Model

Hierarchical workspace structure for parallel execution and staged review:

```
main (default workspace)
  └── epic workspace (inc-add-dark-mode)
        ├── task-1 workspace → squash into epic after task review
        ├── task-2 workspace → squash into epic after task review
        └── task-3 workspace → squash into epic after task review

      [all tasks squashed into epic workspace]

      feature-level review

      squash epic into main → create PR
```

**Workspace Structure:**
- Epic workspace: `.inc/workspaces/<epic>/` (branches off main)
- Task workspaces: `.inc/workspaces/<epic>/task-<id>/` (branches off epic)

**Two Review Stages:**
1. **Task review** - After each Coder completes, review squad checks that task's commit before squashing into epic workspace
2. **Feature review** - After all tasks squashed into epic workspace, review the whole feature before squashing into main

**jj Functions Needed:**
- `createEpicWorkspace(projectRoot, epicId)` - Create epic workspace off main
- `createTaskWorkspace(projectRoot, epicId, taskId)` - Create task workspace off epic (update existing)
- `squashTaskIntoEpic(projectRoot, epicId, taskId)` - Squash task commit into epic workspace
- `squashEpicIntoMain(projectRoot, epicId)` - Final squash for PR, cleanup all workspaces

**`approve pr` Automation:**
1. Squash epic workspace commit into main
2. Run `jj workspace forget` on epic + all task workspaces
3. Delete `.inc/workspaces/<epic>/` directory
4. Create GitHub PR via `gh pr create`

**Open Questions (TBD):**
- What happens if task review fails? (rollback strategy, retry mechanism)
- What happens if feature review fails? (reopen tasks, reassign)
- Review squad implementation details (spawning, parallelization, verdict aggregation)
- Conflict detection when squashing (what if task-1 and task-2 touch same file?)

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
│       ├── init.ts        # Initialize .inc directory
│       ├── new.ts         # Create new epic
│       ├── chat.ts        # Interactive chat with agents
│       ├── status.ts      # Show epic/task status
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
    ├── paths.ts           # Path utilities for .inc directory
    ├── io.ts              # Read/write helpers with atomic writes
    └── index.ts           # Re-exports
```

## State Files

```
.inc/
├── daemon.pid             # Daemon process ID
├── daemon.log             # Daemon logs
├── daemon.json            # Active agents state
├── workspaces/            # jj workspaces (hierarchical)
│   └── <epic-slug>/       # Epic workspace (branches off main)
│       ├── task-1/        # Task workspace (branches off epic)
│       ├── task-2/
│       └── task-3/
└── epics/
    └── <epic-slug>/
        ├── epic.json      # Epic metadata and status
        ├── spec.md        # Product spec (written by PM)
        ├── architecture.md # Technical plan (written by Tech Lead)
        ├── tasks.json     # Task breakdown (written by Tech Lead)
        └── decisions.md   # Decision log (all agents)

~/.inc/
└── registry.json          # Global index of all epics across projects
```

## Quick Start

```bash
# 1. Start the daemon (watches for epics and spawns agents)
inc daemon start

# 2. Create an epic
inc new "add dark mode support"
# Or for a detailed brief:
inc new --file brief.md
# Or open $EDITOR:
inc new

# 3. Watch it work
inc daemon logs -f

# 4. Check status anytime
inc status                    # Current project epics
inc status -g                 # All epics across projects
inc status add-dark-mode      # Specific epic details

# 5. When PM finishes spec, approve to continue
inc approve spec add-dark-mode

# 6. When Tech Lead finishes plan, approve to start coding
inc approve plan add-dark-mode

# 7. When all tasks done and PR ready, approve to complete
inc approve pr add-dark-mode
```

## Workflow (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. CREATE EPIC                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│ $ inc new "add dark mode"                                            │
│                                                                         │
│ Creates: .inc/epics/add-dark-mode/epic.json                           │
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
│   - Writes: .inc/epics/add-dark-mode/spec.md                          │
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
│ $ inc approve spec add-dark-mode                                     │
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
│ $ inc approve plan add-dark-mode                                     │
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
│   - Works in: .inc/workspaces/add-dark-mode/task-1/                   │
│   - Reads spec.md, architecture.md, their task from tasks.json          │
│   - Writes code, runs tests                                             │
│   - Creates jj commit with task description                             │
│   - Review squad evaluates the task commit (TBD: review failure flow)   │
│   - If review passes: task commits are squashed into mission revision   │
│   - Marks task status "done" in tasks.json                              │
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
│ $ inc approve pr add-dark-mode                                       │
│                                                                         │
│ Sets status: done                                                       │
│                                                                         │
│ 🎉 Epic complete!                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Manual Chat Mode

You can also drive agents manually via chat instead of daemon:

```bash
# Chat with PM about an epic
inc chat add-dark-mode -r pm

# Chat with Tech Lead
inc chat add-dark-mode -r tech-lead

# Chat with Coder for specific task
inc chat add-dark-mode -r coder -t 1
```

Chat features:
- Multiline input: type lines, empty line to send
- Animated spinner while thinking
- Transcripts saved to `.inc/epics/<id>/chats/`
- Recent chat summaries loaded for context

---

## Next Steps (Priority Order)

1. **Test chat command with real API** - Verify the SDK integration works
2. **jj integration** - Squash/rebase workflow and conflict detection
3. **Add review squad** - 5 specialized reviewers for code quality
4. **Heartbeat/resurrection** - Keep PM/Tech Lead alive across sessions
5. **PR creation** - Automate PR creation via `gh` CLI

---

## Open Questions

1. **Coder concurrency**: How many Coders run in parallel? Start with 2, tune based on conflict rate.

2. **Context size**: Tech Lead might accumulate too much context over a long-running epic. May need periodic "compaction" where we summarize and restart.

3. **Cost tracking**: Should we track API spend per epic? Useful for understanding ROI.

4. **Rollback**: If a Coder produces bad code that passes tests, how do we recover? Tech Lead review should catch most issues, but might need `inc rollback <epic> <task-id>`.

5. **Human teammates**: How do PRs from Inc interact with PRs from human engineers? Probably fine — Inc PRs go through normal review process.

---

## Design Ideas (To Implement)

### Epic Creation with Rich Context

Currently `inc new "description"` only takes a single line. Options:
- `inc new` with no args opens $EDITOR for multiline brief
- `inc new --file brief.md` reads from file
- `inc new` then first chat message becomes the brief

### Chat Redesign

The chat experience needs rethinking:

1. **Fresh sessions**: Each `inc chat` should be a net-new session, not resuming old context. The agent should read current state from files (mission.json, spec.md, etc.) rather than relying on conversation history.

2. **Chat history with summaries**: Save recent chats to `.inc/epics/<id>/chats/` with auto-generated summaries. Agent can read summaries for quick context on what was discussed before.

3. **Natural language as primary interface**: Chat should be able to do everything the CLI can (except spawn another chat):
   - "create a new epic for adding dark mode" → runs `inc new`
   - "what's the status?" → runs `inc status`
   - "approve the spec" → runs `inc approve spec`
   - "show me all my epics" → runs `inc status -g`

   This makes `inc chat` the main entry point. Other commands become shortcuts/scripting interface.

4. **Conversation structure**:
   ```
   .inc/epics/<id>/
   ├── chats/
   │   ├── 2024-01-24-1030.json   # Full transcript
   │   ├── 2024-01-24-1030.summary.md  # Auto-generated summary
   │   └── ...
   ```
