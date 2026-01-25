import { Command } from "commander";
import { start } from "../../tui/index.js";

export const tuiCommand = new Command("tui")
  .description("Launch TUI mission control interface")
  .action(async () => {
    // Start the TUI
    start();
  });
