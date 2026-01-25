# Inc: Agent Orchestration for Small Teams

## The Problem

Claude Code is powerful but has operational issues at scale:
1. Sessions die randomly, losing context
2. Permission prompts interrupt constantly ("can I run find?")
3. Running multiple features in parallel means constant notifications
4. Context rots over time, requiring manual session restarts
5. No middle layer to absorb routine decisions

The result: you spend more time babysitting agents than doing actual CTO work (vision, architecture, taste).

## The Thesis

We've already solved these problems with human organizations. The org chart exists because it's the natural decomposition of software work:

- **PM**: Makes product micro-decisions, writes specs, clarifies ambiguity
- **Tech Lead**: Makes architecture decisions, breaks work into tasks, reviews code
- **Engineers**: Execute well-scoped tasks, escalate when stuck

The insight: agents don't have human ramp-up costs. They can read ADRs, grep the codebase, and understand the domain in seconds. So we can form **inc teams** around problems (not domains) that spin up, execute, and dissolve.

Conway's Law inverts: instead of your architecture mirroring your org structure, your org structure (inc teams) mirrors the problem structure.

## Architecture

```
You (CTO - vision, taste, final approval)
 │
 └── CLI (`inc` commands)
      │
      ├── Daemon (background process)
      │    ├── Heartbeat monitor
      │    ├── Session resurrection  
      │    ├── Webhook routing (GitHub → teams)
      │    └── State file management
      │
      └── Inc Teams (one per idea)
           │
           ├── PM Agent
           │    ├── Takes vague input, asks clarifying questions
           │    ├── Writes spec.md
           │    ├── Makes product micro-decisions
           │    └── Escalates product ambiguity to you
           │
           ├── Tech Lead Agent
           │    ├── Reads spec, produces architecture.md
           │    ├── Breaks work into tasks.json
           │    ├── Triages review verdicts (accept/reject)
           │    ├── Manages jj commits (squash/abandon)
           │    └── Escalates architecture questions to you
           │
           ├── Coder Agents (ephemeral pool)
           │    ├── Gets one task
           │    ├── Works in isolated jj commit
           │    ├── Submits when done or stuck
           │    └── Dies, replaced by fresh context
           │
           └── Review Squad (parallel, per task)
                ├── Security Reviewer
                ├── Performance Reviewer
                ├── Style/Consistency Reviewer
                ├── Test Coverage Reviewer
                └── Task Compliance Reviewer
```

## State Schema

Each idea lives in `.inc/ideas/<idea-slug>/`:

```
.inc/
  config.json              # global config (model preferences, project root)
  daemon.pid               # daemon process ID
  daemon.log               # daemon logs
  ideas/
    dashboard-perf/
      idea.json            # metadata (created, status, pr_number)
      spec.md              # PM's output (frozen once approved)
      architecture.md      # Tech Lead's plan (frozen once approved)
      tasks.json           # task status, assignees, blockers
      decisions.md         # "we chose X because Y" log
      conversations/       # agent conversation logs for debugging
        pm.jsonl
        tech-lead.jsonl
        coder-1.jsonl
```

### idea.json

```json
{
  "id": "dashboard-perf",
  "created": "2025-01-24T10:00:00Z",
  "status": "spec",
  "description": "dashboard feels slow, lazy load widgets",
  "worktree": null,
  "pr_number": null,
  "needs_attention": null
}
```

Status transitions: `spec` → `spec_complete` → `planning` → `plan_complete` → `coding` → `review` → `done`

`needs_attention` is set when an agent needs human input:
```json
{
  "from": "pm",
  "question": "Should the skeleton show for all widgets or only slow-loading ones?"
}
```

### tasks.json

```json
{
  "tasks": [
    {
      "id": 1,
      "name": "Add React.lazy to widget components",
      "description": "Wrap each widget in React.lazy for code splitting",
      "status": "done",
      "blocked_by": [],
      "assignee": null,
      "jj_commit": "abc123"
    },
    {
      "id": 2,
      "name": "Create SkeletonWidget component", 
      "status": "in_progress",
      "assignee": "coder-1",
      "blocked_by": [],
      "jj_commit": "def456"
    },
    {
      "id": 3,
      "name": "Add Suspense boundary to dashboard",
      "status": "blocked",
      "assignee": null,
      "blocked_by": [2],
      "jj_commit": null
    }
  ]
}
```

Task statuses: `not_started` → `in_progress` → `in_review` → `done` | `blocked` | `failed`

**Important:** Only the daemon writes to tasks.json. Coders report their status via their result message, and the daemon updates the file. This avoids race conditions with multiple Coders.

### reviews.json

Per-task review verdicts, written by daemon as reviewers complete:

```json
{
  "task_id": 2,
  "reviews": [
    {
      "reviewer": "security",
      "verdict": "pass",
      "notes": "No obvious security issues. Input validation present.",
      "timestamp": "2025-01-24T10:50:00Z"
    },
    {
      "reviewer": "performance",
      "verdict": "pass",
      "notes": "CSS animation is GPU-accelerated, good choice.",
      "timestamp": "2025-01-24T10:50:05Z"
    },
    {
      "reviewer": "style",
      "verdict": "fail",
      "notes": "Component should use styled-components to match existing pattern.",
      "timestamp": "2025-01-24T10:50:03Z"
    },
    {
      "reviewer": "tests",
      "verdict": "pass",
      "notes": "Unit tests cover main render cases.",
      "timestamp": "2025-01-24T10:50:08Z"
    },
    {
      "reviewer": "compliance",
      "verdict": "pass", 
      "notes": "Implementation matches task description.",
      "timestamp": "2025-01-24T10:50:02Z"
    }
  ],
  "summary": {
    "pass": 4,
    "fail": 1,
    "pending": 0
  }
}
```

Stored in `.inc/ideas/<idea>/reviews/task-<id>.json`

### decisions.md

Append-only log written by the daemon based on agent results:

```markdown
## PM Decisions

### 2025-01-24T10:15:00Z
Scoping notifications to admin users only for v1. Can expand to all users later.

## Tech Lead Decisions

### 2025-01-24T10:30:00Z
Using React.lazy instead of dynamic imports for consistency with existing patterns.

## Task 2: Create SkeletonWidget component

**Completed:** 2025-01-24T10:45:00Z

**Decisions:**
- Used CSS animation instead of JS for performance
- Put skeleton styles in separate file to match existing pattern
```

## CLI Commands

```bash
# Daemon
inc daemon start           # start background daemon
inc daemon stop            # stop daemon  
inc daemon status          # is it running?

# Ideas
inc new "<description>"    # create idea, start PM conversation
inc status                 # show all ideas + progress
inc chat [idea-slug]       # talk to CTO (no arg) or idea's PM
inc logs <idea-slug>       # tail agent activity

# Approvals  
inc approve spec <idea>    # approve PM's spec → planning
inc approve plan <idea>    # approve Tech Lead's plan → coding
inc approve pr <idea>      # final blessing → team review

# Debugging
inc inspect <idea>         # dump full state
inc kill <idea>            # stop all agents for an idea
inc retry <idea> [task-id] # retry a failed task
```

### `inc status` output

```
STRIKE TEAMS

  dashboard-perf     ███████░░░  3/4 tasks    PR #847 ready
  notifications      ██░░░░░░░░  1/5 tasks    coding
  billing            spec        —            waiting for input

NEEDS ATTENTION

  billing: PM asks "should notifications go to all users or just admins?"

Run `inc chat billing` to respond.
```

### `inc chat` flow

No argument → talk to CTO agent (status, prioritization, general questions)
With idea slug → talk to that idea's PM (or Tech Lead if past spec phase)

```
$ inc chat billing

You: just admins for now, we can expand later

PM: Got it. I'll update the spec to scope notifications to admin users 
    only, with a note that we may expand to all users in a future iteration.
    
    Spec updated. Ready for your approval.

Run `inc approve spec billing` to proceed to planning.
```

## Agent Roles Summary

| Role | Writes | Tools | Permission Mode |
|------|--------|-------|-----------------|
| PM | spec.md, idea.json, decisions.md | Read, Grep, Glob, Write (restricted) | acceptEdits |
| Tech Lead | architecture.md, tasks.json, idea.json, decisions.md, code | Read, Grep, Glob, Write, Edit, Bash (jj, gh, tests) | acceptEdits |
| Coder | code only | Read, Grep, Glob, Write, Edit, Bash (tests only) | bypassPermissions |
| Reviewers | nothing (read-only) | Read, Grep, Glob | bypassPermissions |

See PROMPTS.md for full system prompts.

## Review Squad

When a Coder completes a task, the daemon spawns 5 review agents in parallel:

| Reviewer | Focus | Key Questions |
|----------|-------|---------------|
| Security | Vulnerabilities, injection, auth | "Does this introduce security risks?" |
| Performance | Efficiency, memory, complexity | "Will this be slow or resource-heavy?" |
| Style | Patterns, conventions, consistency | "Does this match how we do things here?" |
| Tests | Coverage, edge cases, assertions | "Is this adequately tested?" |
| Compliance | Task requirements, scope | "Does this actually do what was asked?" |

Each reviewer reads:
- The task description
- The diff (jj show)
- Relevant existing code for context

Each reviewer outputs:
- **Verdict**: `pass` or `fail`
- **Notes**: Brief explanation

Reviewers run in parallel with `bypassPermissions` (read-only, no interrupts). All 5 must complete before Tech Lead sees verdicts.

### Tech Lead Triage

Tech Lead doesn't do code review — they triage verdicts:

- **All pass** → `jj squash`, task done
- **Any fail** → Read the notes, decide:
  - Agree with rejection → `jj abandon`, task back to queue with feedback
  - Disagree with rejection → `jj squash` anyway, note the override in decisions.md

This keeps Tech Lead context light. They're a merge queue manager, not a code reviewer.

### Why jj

`jj abandon` is the key operation. When reviews fail:
- Git: orphaned commit, reflog archaeology, manual cleanup
- jj: `jj abandon`, commit gone, clean state

`jj undo` is the escape hatch. Tech Lead squashes, then late reviewer finds issue:
- Git: revert commit, messy history
- jj: `jj undo`, back to pre-squash state, fix and re-squash

## Daemon Responsibilities

### 1. Heartbeat Monitoring
- Polls active agent sessions every 30s
- Detects dead/hung sessions
- Triggers resurrection for PM and Tech Lead

### 2. Session Resurrection  
- When PM or Tech Lead dies, spawn fresh session
- Fresh session reads state files, reconstructs context
- Continues where the last session left off
- Coders are never resurrected (ephemeral by design)

### 3. Result Handling
When any agent session ends:
- Parse result message
- If Coder:
  - Update tasks.json (mark `in_review`)
  - Append decisions to decisions.md
  - Spawn review squad (5 reviewers in parallel)
- If Reviewer:
  - Write verdict to reviews/task-<id>.json
  - If all 5 complete, notify Tech Lead to triage
- If PM/Tech Lead dies unexpectedly:
  - Log error
  - Trigger resurrection

### 4. Review Spawning
- When task enters `in_review`, spawn all 5 reviewers in parallel
- Each reviewer is ephemeral (like Coders)
- All run with `bypassPermissions` (read-only)
- Daemon collects verdicts, writes to reviews/task-<id>.json
- When all 5 complete, daemon notifies Tech Lead

### 5. Coder Spawning
- Watches tasks.json for `not_started` tasks with no blockers
- Spawns Coders up to concurrency limit
- Assigns task to Coder, updates tasks.json

### 6. State Coordination
- Watches idea.json for status changes
- `spec_complete` → spawn Tech Lead
- `plan_complete` → start spawning Coders
- All tasks done → notify Tech Lead to create PR

## jj Workflow

Each idea gets a worktree:
```bash
jj workspace add .inc/worktrees/dashboard-perf
```

Each Coder works in an isolated commit:
```bash
jj new -m "task-1: Add React.lazy to widgets"
# ... do work ...
# (session ends, daemon records commit)
```

Tech Lead squashes and rebases as tasks complete:
```bash
jj squash  # squash completed task into feature
jj rebase -d main  # when ready for PR
```

## Project Structure

```
/inc
  /src
    /daemon
      index.ts           # main daemon entry
      heartbeat.ts       # session monitoring
      spawner.ts         # agent lifecycle management
      watcher.ts         # file system watching
      results.ts         # handle agent results, update state
    /agents
      base.ts            # shared spawn logic, streaming
      pm.ts              # PM agent config
      tech-lead.ts       # Tech Lead agent config  
      coder.ts           # Coder agent config
    /state
      schema.ts          # TypeScript types for state files
      reader.ts          # read state files
      writer.ts          # write state files (atomic)
    /cli
      index.ts           # CLI entry point
      commands/
        new.ts
        status.ts
        chat.ts
        approve.ts
        logs.ts
        daemon.ts
        inspect.ts
        kill.ts
    /utils
      jj.ts              # jj command helpers
      github.ts          # gh CLI helpers
  package.json
  tsconfig.json
  README.md
  ARCHITECTURE.md
  PROMPTS.md
```

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Tech Lead context blowup | Monitor token usage, add manual compaction command |
| Coders produce bad code | Tech Lead reviews everything before squash |
| jj conflicts pile up | Keep tasks small and independent, Tech Lead resolves immediately |
| Daemon crashes | Stateless design — restart reads state files and recovers |
| API costs explode | Add `maxBudgetUsd` per idea, show costs in status |
| Agent goes rogue | Restricted tool permissions, worktree isolation, no direct main access |
| tasks.json race condition | Only daemon writes to tasks.json, Coders report via results |

## Success Criteria

1. Can run `inc new "make dashboard faster"` and have a PM conversation
2. Can approve spec and have Tech Lead produce architecture + tasks
3. Can watch Coders execute tasks without any permission prompts
4. Can see PR appear with all work squashed
5. Total human interaction: 3 approvals + answering PM questions
6. Time from idea to PR: < 2 hours for a small feature
