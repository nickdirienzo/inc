---
description: Create a new Strike mission. Use when the user wants to start a new project, feature, or piece of work.
---

# Create a Strike Mission

Create a new mission using the `strike new` command.

For a quick one-liner:
```bash
strike new "Add dark mode support"
```

For a detailed brief, create a file and use:
```bash
strike new --file brief.md
```

Or run `strike new` with no arguments to open $EDITOR for a multiline brief.

The mission brief can include:
- What should be built
- Why it's needed
- Any context or constraints
- Preferences for implementation

After creating, the mission will be registered globally and can be accessed from anywhere.

Use this skill when:
- User says "let's build..."
- User says "create a mission for..."
- User says "I want to add..."
- User describes a feature or project they want to start
