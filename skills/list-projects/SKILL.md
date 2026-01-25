---
description: List all Inc projects and epics. Use when the user asks about projects, wants to see what epics exist, or when you need to disambiguate which project they're referring to.
---

# List Inc Projects

Run `inc status -g` to list all known Inc projects and epics globally.

```bash
inc status -g
```

This shows:
- All registered projects grouped by directory
- Each epic with its current status
- Epics needing attention are marked with a warning

Use this skill when:
- User asks "what projects do we have?"
- User asks "show me all epics"
- User mentions something ambiguous and you need to know which project they mean
- User asks about status across multiple projects
