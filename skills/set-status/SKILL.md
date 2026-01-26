---
description: Set the status of an epic. Use when you've completed a phase (e.g., spec_complete after writing the spec).
---

# Set Epic Status

Set an epic's status to advance it through the workflow.

## Usage

```bash
inc status set <epic-id> <status>
```

## Valid Statuses

- `spec_complete` - PM has finished writing the spec
- `plan_complete` - Tech Lead has finished the architecture and task breakdown
- `abandoned` - Epic is no longer being worked on

## When to Use

**PM agents**: Run `inc status set <epic-id> spec_complete` after writing spec.md

**Tech Lead agents**: Run `inc status set <epic-id> plan_complete` after writing architecture.md and tasks.json

## Example

```bash
inc status set 1ec512f4 spec_complete
```
