import { Command } from "commander";
import { initIncDir, getProjectIncDir, getProjectHash } from "../../state/index.js";

export const registerCommand = new Command("register")
  .description("Register a project directory with Inc")
  .argument("[path]", "Path to the project directory to register (defaults to current directory)", process.cwd())
  .action(async (path: string) => {
    const projectRoot = path;

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
