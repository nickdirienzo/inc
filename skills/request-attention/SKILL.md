---
description: Request attention from another agent before escalating to the user. Use when you need help from PM, EM, or Tech Lead.
---

# Request Attention from Another Agent

Instead of escalating to the user, request help from other agents who might be able to answer.

## Who Can You Ask?

**PM Agents** can ask:
- **EM**: For spec approval or high-level product strategy questions
  ```bash
  inc attention <epic-id> em "Review this spec and approve if ready"
  ```

**Tech Lead Agents** can ask:
- **PM**: For requirements clarification or product decisions
  ```bash
  inc attention <epic-id> pm "Should feature X handle edge case Y?"
  ```
- **EM**: For high-level product strategy questions
  ```bash
  inc attention <epic-id> em "Is this architectural approach aligned with product direction?"
  ```

**Coder Agents**:
- Cannot directly use this skill (no access to epic.json)
- Should report blocks in task feedback: "blocked: Need Tech Lead clarification on X"
- Tech Lead will see and can escalate if needed

## How It Works

1. You run the command with the epic ID, who to ask, and your question
2. The request goes through a queue system (no race conditions)
3. The daemon's EM will:
   - Spawn the target agent to answer your question
   - Or handle it directly (e.g., EM auto-approves specs)
4. The target agent can:
   - Answer and clear the attention request
   - Escalate to another agent
   - Escalate to the user if no agent can help

## When to Use This

- **Before setting needs_attention for user**: Try asking another agent first
- **When you need domain-specific knowledge**: PM for product, Tech Lead for technical
- **For approval workflows**: PM asks EM to review and approve specs

## When to Escalate to User

Only escalate directly to the user when:
- No other agent has the context to answer
- You need a user-specific decision (e.g., business priority, budget)
- Multiple agents have already tried and couldn't resolve it

Use:
```bash
inc attention <epic-id> user "Your question for the user"
```

This minimizes user interruptions while maintaining quality.
