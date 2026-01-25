---
description: Approve an Inc epic's spec, plan, or PR. Use when the user wants to move an epic forward to the next phase.
---

# Approve Epic Phase

Move an epic forward by approving its current phase.

## Approve a Spec
When epic is in `spec_complete` status:
```bash
inc approve spec <epic-id>
```
This moves the epic to `plan_in_progress` - Tech Lead will create the architecture.

## Approve a Plan
When epic is in `plan_complete` status:
```bash
inc approve plan <epic-id>
```
This moves the epic to `coding` - Coders will start on tasks.

## Approve a PR
When epic is in `review` status:
```bash
inc approve pr <epic-id>
```
This marks the epic as `done`.

Use this skill when:
- User says "approve the spec"
- User says "looks good, move forward"
- User says "let's start coding"
- User says "ship it" or "merge it"
- User says "approve" (then ask which phase if unclear)

Always confirm the epic ID and phase before approving.
