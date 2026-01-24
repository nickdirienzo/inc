import { Command } from "commander";
import { createInterface } from "node:readline";
import { readMission, writeMission } from "../../state/index.js";
import { unregisterMission, lookupMission, searchMissions } from "../../registry/index.js";
import { cleanupMissionWorkspaces, isJjRepo } from "../../jj/index.js";

export const abandonCommand = new Command("abandon")
  .description("Abandon a mission")
  .argument("<mission-id>", "Mission to abandon")
  .option("--force", "Skip confirmation")
  .action(async (missionId: string, options: { force?: boolean }) => {
    let projectRoot = process.cwd();

    try {
      // First try to find mission in current directory
      let mission = await readMission(projectRoot, missionId);

      // If not found locally, check global registry
      if (!mission) {
        const registryEntry = await lookupMission(missionId);
        if (registryEntry) {
          projectRoot = registryEntry.projectPath;
          mission = await readMission(projectRoot, missionId);
        }
      }

      // Still not found? Try fuzzy search
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
          console.error(`\nBe more specific.`);
          process.exit(1);
        }
      }

      if (!mission) {
        console.error(`Mission not found: ${missionId}`);
        process.exit(1);
      }

      // Show mission info and confirm unless --force is used
      if (!options.force) {
        console.log(`Mission ID: ${mission.id}`);
        console.log(`Description: ${mission.description}`);
        console.log(`Status: ${mission.status}`);
        console.log("");

        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question("Are you sure you want to abandon this mission? (y/N) ", (ans) => {
            rl.close();
            resolve(ans);
          });
        });

        if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
          console.log("Abandoned abandon. Mission continues.");
          process.exit(0);
        }
      }

      // Update mission.json
      mission.status = "abandoned";
      await writeMission(projectRoot, mission);
      console.log(`✓ Mission status updated to abandoned`);

      // Unregister from global registry
      await unregisterMission(mission.id);
      console.log(`✓ Mission unregistered from global registry`);

      // Clean up workspaces if in a jj repo
      const inJjRepo = await isJjRepo(projectRoot);
      if (inJjRepo) {
        try {
          const cleanupResult = await cleanupMissionWorkspaces(projectRoot, mission.id);
          if (cleanupResult.success) {
            console.log(`✓ Cleaned up mission workspaces`);
          } else {
            console.error(`⚠ Warning: Failed to cleanup workspaces: ${cleanupResult.error}`);
          }
        } catch (error) {
          console.error(`⚠ Warning: Error during workspace cleanup: ${error}`);
        }
      }

      console.log("");
      console.log(`Mission ${mission.id} has been abandoned.`);
    } catch (error) {
      console.error("Failed to abandon mission:", error);
      process.exit(1);
    }
  });
