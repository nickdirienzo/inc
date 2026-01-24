---
description: Search for a Strike mission by partial name or keywords. Use when the user mentions a mission name partially or you need to find a specific mission.
---

# Search Strike Missions

Search for missions by partial ID or keywords from their description.

```bash
strike status <partial-name>
```

For example:
- `strike status auth` finds missions with "auth" in their name
- `strike status dark-mode` finds the dark-mode mission

The search:
- Matches against mission IDs
- Matches against mission descriptions
- Returns all matches if multiple found

Use this skill when:
- User mentions a mission by partial name
- You need to find a mission but aren't sure of the exact ID
- User asks about something that could be a mission name
