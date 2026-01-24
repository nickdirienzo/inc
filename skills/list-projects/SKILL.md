---
description: List all Strike projects and missions. Use when the user asks about projects, wants to see what missions exist, or when you need to disambiguate which project they're referring to.
---

# List Strike Projects

Run `strike status -g` to list all known Strike projects and missions globally.

```bash
strike status -g
```

This shows:
- All registered projects grouped by directory
- Each mission with its current status
- Missions needing attention are marked with a warning

Use this skill when:
- User asks "what projects do we have?"
- User asks "show me all missions"
- User mentions something ambiguous and you need to know which project they mean
- User asks about status across multiple projects
