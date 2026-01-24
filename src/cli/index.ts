#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { chatCommand } from "./commands/chat.js";
import { statusCommand } from "./commands/status.js";
import { approveCommand } from "./commands/approve.js";
import { daemonCommand } from "./commands/daemon.js";

const program = new Command();

program
  .name("strike")
  .description("Agent orchestration for small teams")
  .version("1.0.0");

program.addCommand(initCommand);
program.addCommand(newCommand);
program.addCommand(chatCommand);
program.addCommand(statusCommand);
program.addCommand(approveCommand);
program.addCommand(daemonCommand);

program.parse();
