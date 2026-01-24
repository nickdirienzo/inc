import { Command } from "commander";
import { initStrikeDir } from "../../state/index.js";

export const initCommand = new Command("init")
  .description("Initialize strike in the current directory")
  .action(async () => {
    const projectRoot = process.cwd();

    try {
      await initStrikeDir(projectRoot);
      console.log("Initialized .strike directory");
    } catch (error) {
      console.error("Failed to initialize:", error);
      process.exit(1);
    }
  });
