---
description: Capture deferred work when making scoping decisions. Use when you defer a feature/task to keep it from getting lost.
---

# Deferred Work Tracking

When you make a scoping decision to defer work to a future iteration, capture it so it doesn't get lost.

## Creating a Deferred Item

```bash
inc deferred add \
  --title "Title of deferred work" \
  --description "Full description of what this involves" \
  --rationale "Why this was deferred (e.g., out of scope, nice-to-have, future enhancement)" \
  --source-epic <current-epic-id>
```

The CLI will:
1. Generate a unique ID for the item
2. Store it in the project's deferred items directory
3. Link it back to your current epic

## When to Use

- You're scoping an epic and decide a feature is "nice to have but not MVP"
- You discover a tech debt issue but it's not blocking current work
- You identify a follow-up improvement while working on a task
- An EM or PM asks you to defer something for scope control

## Example

While working on epic `66410d29` (CI setup), you decide automated failure handling is out of scope:

```bash
inc deferred add \
  --title "Automated CI failure handling" \
  --description "Add webhook/polling to detect PR CI failures and automatically create fix tasks. Requires: webhook infrastructure, decision logic for auto-fix vs alert, safeguards against infinite loops." \
  --rationale "Current epic scope is 'add CI' - automated failure handling is a follow-up enhancement" \
  --source-epic 66410d29
```

## Reviewing Deferred Items

Later, you or the user can:

```bash
inc deferred list              # see all open deferred items
inc deferred show <item-id>    # see full details
inc deferred promote <item-id> # convert to a new epic
```

## Available Commands

### Add a deferred item
```bash
inc deferred add --title "..." --description "..." --rationale "..." --source-epic <epic-id>
```

### List all open deferred items
```bash
inc deferred list       # show only open items
inc deferred list --all # show all items including promoted ones
```

### Show details of a specific item
```bash
inc deferred show <item-id>
```

### Promote to a new epic
```bash
inc deferred promote <item-id>
```

This creates a new epic with the deferred work context pre-filled and marks the deferred item as promoted.
