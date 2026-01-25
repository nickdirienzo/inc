import { Command } from "commander";
import { createInterface } from "node:readline";
import { readEpic, writeEpic } from "../../state/index.js";
import { unregisterEpic, lookupEpic, searchEpics } from "../../registry/index.js";
import { cleanupEpicWorkspaces, isJjRepo } from "../../jj/index.js";

export const abandonCommand = new Command("abandon")
  .description("Abandon an epic")
  .argument("<epic-id>", "Epic to abandon")
  .option("--force", "Skip confirmation")
  .action(async (epicId: string, options: { force?: boolean }) => {
    let projectRoot = process.cwd();

    try {
      // First try to find epic in current directory
      let epic = await readEpic(projectRoot, epicId);

      // If not found locally, check global registry
      if (!epic) {
        const registryEntry = await lookupEpic(epicId);
        if (registryEntry) {
          projectRoot = registryEntry.projectPath;
          epic = await readEpic(projectRoot, epicId);
        }
      }

      // Still not found? Try fuzzy search
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
          console.error(`\nBe more specific.`);
          process.exit(1);
        }
      }

      if (!epic) {
        console.error(`Epic not found: ${epicId}`);
        process.exit(1);
      }

      // Show epic info and confirm unless --force is used
      if (!options.force) {
        console.log(`Epic ID: ${epic.id}`);
        console.log(`Description: ${epic.description}`);
        console.log(`Status: ${epic.status}`);
        console.log("");

        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question("Are you sure you want to abandon this epic? (y/N) ", (ans) => {
            rl.close();
            resolve(ans);
          });
        });

        if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
          console.log("Abandoned abandon. Epic continues.");
          process.exit(0);
        }
      }

      // Update epic.json
      epic.status = "abandoned";
      await writeEpic(projectRoot, epic);
      console.log(`✓ Epic status updated to abandoned`);

      // Unregister from global registry
      await unregisterEpic(epic.id);
      console.log(`✓ Epic unregistered from global registry`);

      // Clean up workspaces if in a jj repo
      const inJjRepo = await isJjRepo(projectRoot);
      if (inJjRepo) {
        try {
          const cleanupResult = await cleanupEpicWorkspaces(projectRoot, epic.id);
          if (cleanupResult.success) {
            console.log(`✓ Cleaned up epic workspaces`);
          } else {
            console.error(`⚠ Warning: Failed to cleanup workspaces: ${cleanupResult.error}`);
          }
        } catch (error) {
          console.error(`⚠ Warning: Error during workspace cleanup: ${error}`);
        }
      }

      console.log("");
      console.log(`Epic ${epic.id} has been abandoned.`);
    } catch (error) {
      console.error("Failed to abandon epic:", error);
      process.exit(1);
    }
  });
