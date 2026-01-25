import { Command } from "commander";
import { readEpic, writeEpic, resolveEpicId } from "../../state/index.js";
import type { EpicStatus } from "../../state/index.js";
import { squashEpicIntoMain, cleanupEpicWorkspaces } from "../../jj/index.js";

export const approveCommand = new Command("approve")
  .description("Approve spec, plan, or PR for an epic")
  .argument("<type>", "What to approve: spec, plan, or pr")
  .argument("<epic-id>", "The epic to approve")
  .action(async (type: string, epicId: string) => {
    const projectRoot = process.cwd();

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

          // Squash epic workspace into main
          const squashResult = await squashEpicIntoMain(projectRoot, epicId);
          if (!squashResult.success) {
            console.error(`Failed to squash epic into main: ${squashResult.error}`);
            process.exit(1);
          }

          // Clean up epic workspaces
          const cleanupResult = await cleanupEpicWorkspaces(projectRoot, epicId);
          if (!cleanupResult.success) {
            console.warn(`Warning: Failed to cleanup workspaces: ${cleanupResult.error}`);
            // Continue anyway - cleanup is not critical
          }

          newStatus = "done";
          message = "PR approved. Epic is complete!";
          break;

        default:
          console.error(`Unknown approval type: ${type}. Use: spec, plan, or pr`);
          process.exit(1);
      }

      epic.status = newStatus;
      epic.needs_attention = undefined;
      await writeEpic(projectRoot, epic);

      console.log(message);
      console.log(`Epic ${epicId} status: ${newStatus}`);
    } catch (error) {
      console.error("Failed to approve:", error);
      process.exit(1);
    }
  });
