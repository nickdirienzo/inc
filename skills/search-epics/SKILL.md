---
description: Search for an Inc epic by partial name or keywords. Use when the user mentions an epic name partially or you need to find a specific epic.
---

# Search Inc Epics

Search for epics by partial ID or keywords from their description.

```bash
inc status <partial-name>
```

For example:
- `inc status auth` finds epics with "auth" in their name
- `inc status dark-mode` finds the dark-mode epic

The search:
- Matches against epic IDs
- Matches against epic descriptions
- Returns all matches if multiple found

Use this skill when:
- User mentions an epic by partial name
- You need to find an epic but aren't sure of the exact ID
- User asks about something that could be an epic name
