import { Command } from "commander";
import { listMissions, readMission, readTasks, readDaemonPid } from "../../state/index.js";
import { listRegisteredMissions, lookupMission, searchMissions } from "../../registry/index.js";

export const statusCommand = new Command("status")
  .description("Show status of missions")
  .argument("[mission-id]", "Specific mission to show (optional)")
  .option("-g, --global", "Show all missions across all projects")
  .action(async (missionId: string | undefined, options: { global?: boolean }) => {
    let projectRoot = process.cwd();

    try {
      // If --global flag, show all registered missions
      if (options.global && !missionId) {
        const allMissions = await listRegisteredMissions();
        if (allMissions.length === 0) {
          console.log("No missions registered globally. Create missions with 'strike new \"your mission\"'");
          return;
        }

        console.log("All Strike missions:\n");
        for (const entry of allMissions) {
          const mission = await readMission(entry.projectPath, entry.missionId);
          const status = mission?.status ?? "unknown";
          const attention = mission?.needs_attention ? " ⚠️" : "";
          console.log(`  ${entry.missionId}: ${status}${attention}`);
          console.log(`    ${entry.description}`);
          console.log(`    → ${entry.projectPath}`);
          console.log("");
        }
        return;
      }

      // Check daemon status for current project
      const daemonPid = await readDaemonPid(projectRoot);
      if (daemonPid) {
        try {
          process.kill(daemonPid, 0);
          console.log(`Daemon: running (PID ${daemonPid})`);
        } catch {
          console.log("Daemon: not running (stale PID file)");
        }
      } else {
        console.log("Daemon: not running");
      }
      console.log("");

      if (missionId) {
        // Show specific mission - first try local, then registry
        let mission = await readMission(projectRoot, missionId);

        if (!mission) {
          const registryEntry = await lookupMission(missionId);
          if (registryEntry) {
            projectRoot = registryEntry.projectPath;
            mission = await readMission(projectRoot, missionId);
          }
        }

        if (!mission) {
          const matches = await searchMissions(missionId);
          if (matches.length === 1) {
            projectRoot = matches[0].projectPath;
            mission = await readMission(projectRoot, matches[0].missionId);
          } else if (matches.length > 1) {
            console.error(`Multiple missions match "${missionId}":`);
            for (const match of matches.slice(0, 5)) {
              console.error(`  - ${match.missionId} (${match.projectPath})`);
            }
            process.exit(1);
          }
        }

        if (!mission) {
          console.error(`Mission not found: ${missionId}`);
          process.exit(1);
        }

        console.log(`Project: ${projectRoot}`);

        console.log(`Mission: ${mission.id}`);
        console.log(`  Description: ${mission.description}`);
        console.log(`  Status: ${mission.status}`);
        console.log(`  Created: ${mission.created_at}`);
        console.log(`  Updated: ${mission.updated_at}`);

        if (mission.needs_attention) {
          console.log(`  ⚠️  Needs attention from ${mission.needs_attention.from}: ${mission.needs_attention.question}`);
        }

        if (mission.pr_number) {
          console.log(`  PR: #${mission.pr_number}`);
        }

        // Show tasks if they exist
        const tasksFile = await readTasks(projectRoot, missionId);
        if (tasksFile && tasksFile.tasks.length > 0) {
          console.log("");
          console.log("Tasks:");
          for (const task of tasksFile.tasks) {
            const statusIcon = getTaskStatusIcon(task.status);
            console.log(`  ${statusIcon} [${task.id}] ${task.name} (${task.status})`);
            if (task.assignee) {
              console.log(`       Assignee: ${task.assignee}`);
            }
            if (task.feedback) {
              console.log(`       Feedback: ${task.feedback}`);
            }
          }
        }
      } else {
        // Show all missions
        const missionIds = await listMissions(projectRoot);

        if (missionIds.length === 0) {
          console.log("No missions found. Run 'strike new \"your mission\"' to create one.");
          return;
        }

        console.log("Missions:");
        for (const id of missionIds) {
          const mission = await readMission(projectRoot, id);
          if (mission) {
            const attentionFlag = mission.needs_attention ? " ⚠️" : "";
            console.log(`  ${mission.id}: ${mission.status}${attentionFlag}`);
          }
        }
      }
    } catch (error) {
      console.error("Failed to get status:", error);
      process.exit(1);
    }
  });

function getTaskStatusIcon(status: string): string {
  switch (status) {
    case "done":
      return "✓";
    case "in_progress":
      return "→";
    case "failed":
      return "✗";
    case "blocked":
      return "⊘";
    default:
      return "○";
  }
}
