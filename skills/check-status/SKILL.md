---
description: Check the status of an Inc epic. Use when the user asks how an epic is going, what the current state is, or wants to see tasks.
---

# Check Epic Status

Check the status of a specific epic:

```bash
inc status <epic-id>
```

This shows:
- Epic description and current status
- When it was created and last updated
- Any attention flags
- All tasks with their status (if in coding phase)
- PR number (if in review)

Epic statuses:
- `new` - Just created
- `spec_in_progress` - PM is working on the spec
- `spec_complete` - Spec ready for approval
- `plan_in_progress` - Tech Lead creating architecture
- `plan_complete` - Plan ready for approval
- `coding` - Coders working on tasks
- `review` - PR created, awaiting review
- `done` - Complete

Use this skill when:
- User asks "how is X going?"
- User asks "what's the status of..."
- User wants to see tasks for an epic
- User asks about progress
