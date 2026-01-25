---
description: Create a new Inc epic. Use when the user wants to start a new project, feature, or piece of work.
---

# Create an Inc Epic

Create a new epic using the `inc new` command.

For a quick one-liner:
```bash
inc new "Add dark mode support"
```

For a detailed brief, create a file and use:
```bash
inc new --file brief.md
```

Or run `inc new` with no arguments to open $EDITOR for a multiline brief.

The epic brief can include:
- What should be built
- Why it's needed
- Any context or constraints
- Preferences for implementation

After creating, the epic will be registered globally and can be accessed from anywhere.

Use this skill when:
- User says "let's build..."
- User says "create an epic for..."
- User says "I want to add..."
- User describes a feature or project they want to start
