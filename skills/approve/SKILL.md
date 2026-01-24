---
description: Approve a Strike mission's spec, plan, or PR. Use when the user wants to move a mission forward to the next phase.
---

# Approve Mission Phase

Move a mission forward by approving its current phase.

## Approve a Spec
When mission is in `spec_complete` status:
```bash
strike approve spec <mission-id>
```
This moves the mission to `plan_in_progress` - Tech Lead will create the architecture.

## Approve a Plan
When mission is in `plan_complete` status:
```bash
strike approve plan <mission-id>
```
This moves the mission to `coding` - Coders will start on tasks.

## Approve a PR
When mission is in `review` status:
```bash
strike approve pr <mission-id>
```
This marks the mission as `done`.

Use this skill when:
- User says "approve the spec"
- User says "looks good, move forward"
- User says "let's start coding"
- User says "ship it" or "merge it"
- User says "approve" (then ask which phase if unclear)

Always confirm the mission ID and phase before approving.
