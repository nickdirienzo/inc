import { Command } from "commander";
import { resolveEpicId, submitRequest } from "../../state/index.js";

export const epicCommand = new Command("epic")
  .description("Epic management commands");

epicCommand
  .command("update")
  .description("Update epic fields (queued write)")
  .argument("<epic>", "Epic ID or short ID")
  .option("--pr-number <number>", "Set PR number", parseInt)
  .action(async (epicArg: string, options: { prNumber?: number }) => {
    const projectRoot = process.cwd();

    const resolved = await resolveEpicId(projectRoot, epicArg);
    if (!resolved) {
      console.error(`Epic not found: ${epicArg}`);
      process.exit(1);
    }

    const { epicId } = resolved;

    const fields: { pr_number?: number } = {};
    if (options.prNumber !== undefined) {
      fields.pr_number = options.prNumber;
    }

    if (Object.keys(fields).length === 0) {
      console.error("No fields to update. Use --pr-number <number>");
      process.exit(1);
    }

    const response = await submitRequest(projectRoot, {
      type: "update-epic",
      epicId,
      fields,
    });

    if (response.success) {
      console.log(`Epic ${epicId} updated: ${JSON.stringify(fields)}`);
    } else {
      console.error(`Failed to update epic: ${response.error}`);
      process.exit(1);
    }
  });
