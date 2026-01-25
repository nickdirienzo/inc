#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { chatCommand } from "./commands/chat.js";
import { statusCommand } from "./commands/status.js";
import { approveCommand } from "./commands/approve.js";
import { abandonCommand } from "./commands/abandon.js";
import { daemonCommand } from "./commands/daemon.js";
import { tuiCommand } from "./commands/tui.js";
import { taskCommand } from "./commands/task.js";

const program = new Command();

program
  .name("inc")
  .description("An experiment with Claude Code orchestration")
  .version("1.0.0");

program.addCommand(initCommand);
program.addCommand(newCommand);
program.addCommand(chatCommand);
program.addCommand(statusCommand);
program.addCommand(approveCommand);
program.addCommand(abandonCommand);
program.addCommand(daemonCommand);
program.addCommand(tuiCommand);

program.parse();
