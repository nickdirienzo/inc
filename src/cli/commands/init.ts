import { Command } from "commander";
import { initIncDir } from "../../state/index.js";

export const initCommand = new Command("init")
  .description("Initialize inc in the current directory")
  .action(async () => {
    const projectRoot = process.cwd();

    try {
      await initIncDir(projectRoot);
      console.log("Initialized .inc directory");
    } catch (error) {
      console.error("Failed to initialize:", error);
      process.exit(1);
    }
  });
