import { Command } from "commander";
import { readMission, writeMission } from "../../state/index.js";
import type { MissionStatus } from "../../state/index.js";

export const approveCommand = new Command("approve")
  .description("Approve spec, plan, or PR for a mission")
  .argument("<type>", "What to approve: spec, plan, or pr")
  .argument("<mission-id>", "The mission to approve")
  .action(async (type: string, missionId: string) => {
    const projectRoot = process.cwd();

    try {
      const mission = await readMission(projectRoot, missionId);
      if (!mission) {
        console.error(`Mission not found: ${missionId}`);
        process.exit(1);
      }

      let newStatus: MissionStatus;
      let message: string;

      switch (type) {
        case "spec":
          if (mission.status !== "spec_complete") {
            console.error(`Cannot approve spec: mission status is ${mission.status}, expected spec_complete`);
            process.exit(1);
          }
          newStatus = "plan_in_progress";
          message = "Spec approved. Tech Lead will now create the architecture plan.";
          break;

        case "plan":
          if (mission.status !== "plan_complete") {
            console.error(`Cannot approve plan: mission status is ${mission.status}, expected plan_complete`);
            process.exit(1);
          }
          newStatus = "coding";
          message = "Plan approved. Coders will now start working on tasks.";
          break;

        case "pr":
          if (mission.status !== "review") {
            console.error(`Cannot approve PR: mission status is ${mission.status}, expected review`);
            process.exit(1);
          }
          newStatus = "done";
          message = "PR approved. Mission is complete!";
          break;

        default:
          console.error(`Unknown approval type: ${type}. Use: spec, plan, or pr`);
          process.exit(1);
      }

      mission.status = newStatus;
      mission.needs_attention = undefined;
      await writeMission(projectRoot, mission);

      console.log(message);
      console.log(`Mission ${missionId} status: ${newStatus}`);
    } catch (error) {
      console.error("Failed to approve:", error);
      process.exit(1);
    }
  });
