import { Command } from "commander";
import { createMission, initStrikeDir } from "../../state/index.js";
import { registerMission } from "../../registry/index.js";

// Simple slug generator - no external dependency needed
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export const newCommand = new Command("new")
  .description("Create a new mission")
  .argument("<description>", "Description of the mission")
  .action(async (description: string) => {
    const projectRoot = process.cwd();

    try {
      // Ensure .strike directory exists
      await initStrikeDir(projectRoot);

      // Generate slug from description
      const id = slugify(description);

      const mission = await createMission(projectRoot, id, description);

      // Register in global registry so it can be found from anywhere
      await registerMission(mission.id, projectRoot, description);

      console.log(`Created mission: ${mission.id}`);
      console.log(`  Status: ${mission.status}`);
      console.log(`  Path: .strike/missions/${mission.id}/`);
      console.log("");
      console.log(`Next: run 'strike chat ${mission.id}' to start working with the PM`);
    } catch (error) {
      console.error("Failed to create mission:", error);
      process.exit(1);
    }
  });
