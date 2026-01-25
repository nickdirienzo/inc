import { Command } from "commander";
import { initIncDir, getProjectIncDir, getProjectHash } from "../../state/index.js";

export const initCommand = new Command("init")
  .description("Initialize inc in the current directory")
  .action(async () => {
    const projectRoot = process.cwd();

    try {
      await initIncDir(projectRoot);
      const incDir = getProjectIncDir(projectRoot);
      const hash = getProjectHash(projectRoot);
      console.log(`Initialized inc for this project`);
      console.log(`  Project hash: ${hash}`);
      console.log(`  State directory: ${incDir}`);
    } catch (error) {
      console.error("Failed to initialize:", error);
      process.exit(1);
    }
  });
