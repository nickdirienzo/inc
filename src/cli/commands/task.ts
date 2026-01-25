import { Command } from "commander";
import { resolveEpicId, submitRequest } from "../../state/index.js";

export const taskCommand = new Command("task")
  .description("Manage tasks within an epic")
  .argument("<epic>", "Epic ID or short ID")
  .argument("<task-id>", "Task ID (number)")
  .argument("<action>", "Action: set-status")
  .argument("[value]", "Value for the action")
  .option("--feedback <feedback>", "Feedback message")
  .option("--assignee <assignee>", "Assignee")
  .action(async (epicArg: string, taskIdArg: string, action: string, value: string | undefined, options: { feedback?: string; assignee?: string }) => {
    const projectRoot = process.cwd();
    const taskId = parseInt(taskIdArg, 10);

    if (isNaN(taskId)) {
      console.error(`Invalid task ID: ${taskIdArg}`);
      process.exit(1);
    }

    const resolved = await resolveEpicId(projectRoot, epicArg);
    if (!resolved) {
      console.error(`Epic not found: ${epicArg}`);
      process.exit(1);
    }

    const { epicId } = resolved;

    switch (action) {
      case "set-status": {
        if (!value) {
          console.error("Status value required");
          process.exit(1);
        }
        const validStatuses = ["not_started", "in_progress", "done", "blocked", "failed"];
        if (!validStatuses.includes(value)) {
          console.error(`Invalid status: ${value}. Valid: ${validStatuses.join(", ")}`);
          process.exit(1);
        }

        const response = await submitRequest(projectRoot, {
          type: "task-status",
          epicId,
          taskId,
          status: value as "not_started" | "in_progress" | "done" | "blocked" | "failed",
          feedback: options.feedback,
          assignee: options.assignee,
        });

        if (response.success) {
          console.log(`Task ${taskId} status set to ${value}`);
        } else {
          console.error(`Failed to update task: ${response.error}`);
          process.exit(1);
        }
        break;
      }
      default:
        console.error(`Unknown action: ${action}. Valid: set-status`);
        process.exit(1);
    }
  });
