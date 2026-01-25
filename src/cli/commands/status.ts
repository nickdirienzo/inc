import { Command } from "commander";
import { listEpics, readEpic, readTasks, readDaemonPid } from "../../state/index.js";
import { listRegisteredEpics, lookupEpic, searchEpics } from "../../registry/index.js";

export const statusCommand = new Command("status")
  .description("Show status of epics")
  .argument("[epic-id]", "Specific epic to show (optional)")
  .option("-g, --global", "Show all epics across all projects")
  .option("--include-abandoned", "Include abandoned epics in output")
  .action(async (epicId: string | undefined, options: { global?: boolean; includeAbandoned?: boolean }) => {
    let projectRoot = process.cwd();

    try {
      // If --global flag, show all registered epics
      if (options.global && !epicId) {
        const allEpics = await listRegisteredEpics();
        if (allEpics.length === 0) {
          console.log("No epics registered globally. Create epics with 'inc new \"your epic\"'");
          return;
        }

        // Filter out abandoned epics unless --include-abandoned is set
        const filteredEpics = [];
        for (const entry of allEpics) {
          const epic = await readEpic(entry.projectPath, entry.epicId);
          if (epic?.status !== "abandoned" || options.includeAbandoned) {
            filteredEpics.push({ entry, epic });
          }
        }

        if (filteredEpics.length === 0) {
          console.log("No active epics found. Use --include-abandoned to see abandoned epics.");
          return;
        }

        console.log("All Inc epics:\n");
        for (const { entry, epic } of filteredEpics) {
          const status = epic?.status ?? "unknown";
          const attention = epic?.needs_attention ? " ⚠️" : "";
          console.log(`  ${entry.epicId}: ${status}${attention}`);
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

      if (epicId) {
        // Show specific epic - first try local, then registry
        let epic = await readEpic(projectRoot, epicId);

        if (!epic) {
          const registryEntry = await lookupEpic(epicId);
          if (registryEntry) {
            projectRoot = registryEntry.projectPath;
            epic = await readEpic(projectRoot, epicId);
          }
        }

        if (!epic) {
          const matches = await searchEpics(epicId);
          if (matches.length === 1) {
            projectRoot = matches[0].projectPath;
            epic = await readEpic(projectRoot, matches[0].epicId);
          } else if (matches.length > 1) {
            console.error(`Multiple epics match "${epicId}":`);
            for (const match of matches.slice(0, 5)) {
              console.error(`  - ${match.epicId} (${match.projectPath})`);
            }
            process.exit(1);
          }
        }

        if (!epic) {
          console.error(`Epic not found: ${epicId}`);
          process.exit(1);
        }

        console.log(`Project: ${projectRoot}`);

        console.log(`Epic: ${epic.id}`);
        console.log(`  Description: ${epic.description}`);
        console.log(`  Status: ${epic.status}`);
        console.log(`  Created: ${epic.created_at}`);
        console.log(`  Updated: ${epic.updated_at}`);

        if (epic.needs_attention) {
          console.log(`  ⚠️  Needs attention from ${epic.needs_attention.from}: ${epic.needs_attention.question}`);
        }

        if (epic.pr_number) {
          console.log(`  PR: #${epic.pr_number}`);
        }

        // Show tasks if they exist
        const tasksFile = await readTasks(projectRoot, epicId);
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
        // Show all epics
        const epicIds = await listEpics(projectRoot);

        if (epicIds.length === 0) {
          console.log("No epics found. Run 'inc new \"your epic\"' to create one.");
          return;
        }

        // Filter out abandoned epics unless --include-abandoned is set
        const activeEpics = [];
        for (const id of epicIds) {
          const epic = await readEpic(projectRoot, id);
          if (epic && (epic.status !== "abandoned" || options.includeAbandoned)) {
            activeEpics.push(epic);
          }
        }

        if (activeEpics.length === 0) {
          console.log("No active epics found. Use --include-abandoned to see abandoned epics.");
          return;
        }

        console.log("Epics:");
        for (const epic of activeEpics) {
          const attentionFlag = epic.needs_attention ? " ⚠️" : "";
          console.log(`  ${epic.id}: ${epic.status}${attentionFlag}`);
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
