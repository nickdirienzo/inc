import { Command } from "commander";
import { readEpic, writeEpic, resolveEpicId, requireProjectRoot } from "../../state/index.js";
import type { EpicStatus } from "../../state/index.js";

export const approveCommand = new Command("approve")
  .description("Approve spec, plan, or PR for an epic")
  .argument("<type>", "What to approve: spec, plan, or pr")
  .argument("<epic-id>", "The epic to approve")
  .action(async (type: string, epicId: string) => {
    const projectRoot = requireProjectRoot();

    try {
      const resolved = await resolveEpicId(projectRoot, epicId);
      const epic = resolved?.epic ?? await readEpic(projectRoot, epicId);
      if (!epic) {
        console.error(`Epic not found: ${epicId}`);
        process.exit(1);
      }
      epicId = resolved?.epicId ?? epicId;

      let newStatus: EpicStatus;
      let message: string;

      switch (type) {
        case "spec":
          if (epic.status !== "spec_complete") {
            console.error(`Cannot approve spec: epic status is ${epic.status}, expected spec_complete`);
            process.exit(1);
          }
          newStatus = "plan_in_progress";
          message = "Spec approved. Tech Lead will now create the architecture plan.";
          // Clear needs_attention in case PM set it expecting EM auto-approval
          // This provides backward compatibility during transition to agent-driven approval
          delete epic.needs_attention;
          break;

        case "plan":
          if (epic.status !== "plan_complete") {
            console.error(`Cannot approve plan: epic status is ${epic.status}, expected plan_complete`);
            process.exit(1);
          }
          newStatus = "coding";
          message = "Plan approved. Coders will now start working on tasks.";
          break;

        case "pr":
          if (epic.status !== "review") {
            console.error(`Cannot approve PR: epic status is ${epic.status}, expected review`);
            process.exit(1);
          }

          if (!epic.pr_number) {
            console.error('Cannot approve PR: no PR has been created yet. Wait for Tech Lead to create the PR.');
            process.exit(1);
          }

          newStatus = "done";
          message = "PR approved. Epic is complete!";
          break;

        default:
          console.error(`Unknown approval type: ${type}. Use: spec, plan, or pr`);
          process.exit(1);
      }

      epic.status = newStatus;
      delete epic.needs_attention;
      await writeEpic(projectRoot, epic);

      console.log(message);
      console.log(`Epic ${epicId} status: ${newStatus}`);
    } catch (error) {
      console.error("Failed to approve:", error);
      process.exit(1);
    }
  });
