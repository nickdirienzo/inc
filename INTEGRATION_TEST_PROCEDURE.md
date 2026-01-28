# Integration Test Procedure: Workspace Corruption Autonomous Recovery

## Purpose

This test verifies that the prompt changes from Tasks 1-9 enable autonomous recovery from workspace corruption without user involvement.

## Test Scenario

Reproduce the incident from the spec where workspace corruption was escalated to the user instead of being handled by Tech Lead + EM autonomously.

## Prerequisites

Before running this test, verify that all prompt changes are in place:

### Code Verification Checklist

Run these checks in the project repository:

```bash
cd /Users/nickdirienzo/code/nickdirienzo/inc

# Check Task 1 & 9: EM has workspace squashing failure handling
grep -A 3 "workspace squashing failures" src/prompts/em.ts
# Should show delegation to Tech Lead for workspace errors

# Check Task 2 & 6: Tech Lead has autonomous recovery procedures
grep -A 3 "Autonomous Recovery Procedures" src/prompts/tech-lead.ts
# Should show workspace corruption recovery section

# Check Task 8: Daemon has enhanced logging
grep "AGENT ROUTING" src/daemon/index.ts
# Should show 🤖 emoji-based logging for agent-to-agent routing

# Check Task 7: Confidence-based decision framing exists
grep -i "confidence" src/prompts/*.ts
# Should find references in all four agent prompts
```

If any of these checks fail, the test will not work correctly because the prompts won't have the autonomous behavior.

## Test Environment Setup

### 1. Ensure Clean State

```bash
# Check daemon is running
inc daemon status

# If not running, start it
inc daemon start

# Tail daemon logs in a separate terminal
tail -f ~/.inc/daemon.log
```

### 2. Note Current Epic State

```bash
# List all epics to see current state
cd /Users/nickdirienzo/code/nickdirienzo/inc
inc status

# Note how many epics exist (for comparison later)
```

## Test Execution

### Step 1: Create Test Epic

```bash
cd /Users/nickdirienzo/code/nickdirienzo/inc

# Create a simple test epic
inc new "Test workspace corruption recovery"

# Note the epic ID from output
# It will be something like: "Created epic abc12345"
export TEST_EPIC_ID="abc12345"  # Use actual ID from output
```

### Step 2: Create Simple Task

```bash
# Get the project hash (needed for path)
PROJECT_HASH="6ab1299544aa"  # Or find from: ls ~/.inc/projects/

# Edit the epic's tasks.json
cat > ~/.inc/projects/$PROJECT_HASH/epics/$TEST_EPIC_ID/tasks.json << 'EOF'
{
  "tasks": [
    {
      "id": 1,
      "name": "Create test file",
      "description": "Create a file named test.txt in the project root with content 'Hello from workspace corruption test'",
      "status": "todo",
      "blocked_by": [],
      "assignee": null,
      "jj_commit": null
    }
  ]
}
EOF

# Approve the plan so coders can start
inc approve plan $TEST_EPIC_ID
```

### Step 3: Wait for Coder to Complete Task

```bash
# Monitor daemon logs (in separate terminal)
tail -f ~/.inc/daemon.log

# Watch for:
# - "Spawning Coder agent for task 1"
# - "Coder agent completed task 1"
# - "Attempting to squash task 1 into epic workspace"

# This should take 1-5 minutes depending on coder speed

# Verify completion by checking tasks.json
cat ~/.inc/projects/$PROJECT_HASH/epics/$TEST_EPIC_ID/tasks.json
# Should show task 1 with "status": "done"
```

### Step 4: Manually Corrupt the Workspace

**This is the key step that simulates the incident from the spec.**

```bash
# List current workspaces to see it exists
jj workspace list | grep "inc-$TEST_EPIC_ID"
# Should show: inc-abc12345 @ <some-commit>

# Option A: Forget the workspace entirely (simulates severe corruption)
jj workspace forget "inc-$TEST_EPIC_ID"

# Option B: Move workspace pointer to wrong commit (simulates pointer corruption)
# (Only use if Option A doesn't create the desired error)
# cd ~/.inc/projects/$PROJECT_HASH/workspaces/$TEST_EPIC_ID/inc-$TEST_EPIC_ID
# jj edit <some-earlier-commit-without-the-work>

# Verify corruption
jj workspace list | grep "inc-$TEST_EPIC_ID"
# Option A: Should show nothing (workspace forgotten)
# Option B: Should show workspace at wrong commit
```

### Step 5: Mark Task as Done to Trigger Squashing

If the task wasn't already marked as done, update it:

```bash
# Edit tasks.json to mark task as done (if not already)
# This will trigger the daemon to attempt squashing on next tick

# Or just wait for next daemon tick (30 seconds by default)
# Daemon will try to squash completed tasks
```

### Step 6: Observe Daemon Logs

**This is where you verify the autonomous behavior.**

Watch the daemon logs carefully:

```bash
tail -f ~/.inc/daemon.log
```

**Expected log sequence (GOOD - means test passed):**

```
[Daemon] Processing epic abc12345
[Daemon] Task 1 is complete, attempting to squash into epic workspace
[Daemon] Error: Workspace 'inc-abc12345' doesn't have a working-copy commit
[Daemon] Creating attention request for workspace issue

[EM] 🤖 AGENT ROUTING for abc12345
[EM]    From: daemon → To: tech_lead
[EM]    Question: Failed to squash task 1 into epic workspace: Workspace 'inc-abc12345' doesn't have a working-copy commit
[EM]    Escalation count: 0
[EM]    (handled autonomously, no user involvement)

Spawning Tech Lead agent for: abc12345
[Tech Lead] Received attention request about workspace corruption
[Tech Lead] Assessing workspace situation...
[Tech Lead] Locating completed work in task workspace...
[Tech Lead] Rebuilding epic workspace from task commits...
[Tech Lead] Workspace recovery complete
[Tech Lead] Clearing attention request

Tech Lead agent completed for abc12345
Epic abc12345 workspace recovered successfully
```

**Undesired log sequence (BAD - means test failed):**

```
[Daemon] Error: Workspace 'inc-abc12345' doesn't have a working-copy commit
[Daemon] Creating attention request for user

[EM] ⚠️  USER ATTENTION REQUIRED for abc12345
[EM]     From: daemon
[EM]     Question: Failed to squash task...
```

If you see the "USER ATTENTION REQUIRED" message, **the test has failed** - the prompts are not implementing autonomous recovery correctly.

### Step 7: Verify Recovery

After the Tech Lead agent completes:

```bash
# Check workspace exists again
jj workspace list | grep "inc-$TEST_EPIC_ID"
# Should show the workspace restored

# Check the work is preserved
cd ~/.inc/projects/$PROJECT_HASH/workspaces/$TEST_EPIC_ID/inc-$TEST_EPIC_ID
ls -la test.txt
cat test.txt
# Should show: "Hello from workspace corruption test"

# Check tasks.json status
cat ~/.inc/projects/$PROJECT_HASH/epics/$TEST_EPIC_ID/tasks.json
# Should show task 1: "status": "done", "jj_commit": null (squashed)

# Check epic state
cat ~/.inc/projects/$PROJECT_HASH/epics/$TEST_EPIC_ID/epic.json | jq '.needs_attention'
# Should show: null (attention cleared)
```

## Success Criteria

The test **PASSES** if all of the following are true:

- ✅ Daemon detected the workspace corruption error
- ✅ EM received the attention request from daemon
- ✅ EM routed to Tech Lead (NOT to user)
- ✅ Logs show "🤖 AGENT ROUTING" (not "⚠️ USER ATTENTION REQUIRED")
- ✅ Tech Lead executed recovery procedure autonomously
- ✅ Epic workspace was rebuilt successfully
- ✅ Task 1 is marked as done with `jj_commit: null`
- ✅ Work (test.txt file) was preserved with correct content
- ✅ Attention request was cleared (needs_attention is null)
- ✅ **NO user attention request was created at any point**

The test **FAILS** if:

- ❌ User attention request was created
- ❌ EM escalated to user instead of Tech Lead
- ❌ Tech Lead asked user for guidance
- ❌ Work was lost during recovery
- ❌ Workspace remains corrupted
- ❌ Attention request remains pending

## Cleanup

After the test:

```bash
# Optionally abandon the test epic
inc abandon $TEST_EPIC_ID

# Or leave it as evidence of successful recovery
```

## Troubleshooting

### Issue: No daemon logs appear

**Solution:**
```bash
# Check if daemon is actually running
inc daemon status

# Restart daemon to ensure it processes the epic
inc daemon restart

# Check log file location
ls -la ~/.inc/daemon.log
```

### Issue: Task never gets picked up by coder

**Possible causes:**
- Daemon not running: `inc daemon start`
- Epic status not approved: `inc approve plan $TEST_EPIC_ID`
- Task has invalid format in tasks.json

### Issue: Workspace corruption doesn't trigger error

**Possible causes:**
- Workspace wasn't actually corrupted (verify with `jj workspace list`)
- Task wasn't marked as done yet (daemon only squashes completed tasks)
- Daemon hasn't run its next tick yet (wait 30 seconds)

### Issue: EM still escalates to user

**This means the prompt changes aren't working correctly.**

Check:
1. Are the prompt changes from tasks 1-9 actually in the codebase?
2. Run the verification checklist at the top of this document
3. Check if the daemon was restarted after prompt changes (prompts are loaded at startup)

## Alternative: Simpler Verification

If the full integration test is too complex, you can verify the prompts work with a simpler approach:

### Code Review Approach

1. **Read src/prompts/em.ts** - verify it has workspace squashing failure handling
2. **Read src/prompts/tech-lead.ts** - verify it has workspace recovery procedures
3. **Read src/daemon/index.ts** - verify logging distinguishes agent vs user routing
4. **Trace the logic** mentally through what would happen

This won't prove runtime behavior but will confirm the logic is correct.

### Log Analysis Approach

Look at historical daemon logs for other epics:

```bash
grep "AGENT ROUTING" ~/.inc/daemon.log
grep "USER ATTENTION REQUIRED" ~/.inc/daemon.log
```

If you see recent examples of agent-to-agent routing without user involvement, the prompts are probably working.

## Expected Test Duration

- Setup: 2-3 minutes
- Coder completing task: 1-5 minutes
- Daemon processing and recovery: 1-2 minutes
- Verification: 1 minute

**Total: ~10-15 minutes**

## Reporting Results

After running the test, document results in one of:
- Update TASK_10_SUMMARY.md with actual results
- Create a new ACTUAL_TEST_RESULTS.md file
- Report directly to Tech Lead or user

Include:
- Date/time of test
- Whether test passed or failed
- Full daemon log excerpt showing the routing
- Screenshots if helpful
- Any unexpected behavior observed

---

**Test designed by:** Coder agent (Task #10)
**Target:** Verify autonomous workspace corruption recovery from spec
**Epic:** Improve Agent Autonomy for Technical Decisions
