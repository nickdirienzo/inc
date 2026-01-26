import { Command } from "commander";
import { resolveEpicId, submitRequest } from "../../state/index.js";

export const attentionCommand = new Command("attention")
  .description("Manage attention requests between agents");

attentionCommand
  .command("request")
  .description("Request attention from another agent or user")
  .argument("<epic>", "Epic ID or short ID")
  .argument("<to>", "Who to ask: em, pm, tech_lead, or user")
  .argument("<question>", "Your question")
  .action(async (epicArg: string, to: string, question: string) => {
    const projectRoot = process.cwd();

    const validTargets = ["em", "pm", "tech_lead", "user"];
    if (!validTargets.includes(to)) {
      console.error(`Invalid target: ${to}. Valid: ${validTargets.join(", ")}`);
      process.exit(1);
    }

    const resolved = await resolveEpicId(projectRoot, epicArg);
    if (!resolved) {
      console.error(`Epic not found: ${epicArg}`);
      process.exit(1);
    }

    const { epicId } = resolved;

    const from = process.env.INC_AGENT_ROLE as "pm" | "tech_lead" | "coder" || "pm";

    const response = await submitRequest(projectRoot, {
      type: "attention",
      epicId,
      from,
      to: to as "em" | "pm" | "tech_lead" | "user",
      question,
    });

    if (response.success) {
      console.log(`Attention request sent to ${to}`);
    } else {
      console.error(`Failed to send attention request: ${response.error}`);
      process.exit(1);
    }
  });

attentionCommand
  .command("clear")
  .description("Clear the attention request for an epic")
  .argument("<epic>", "Epic ID or short ID")
  .action(async (epicArg: string) => {
    const projectRoot = process.cwd();

    const resolved = await resolveEpicId(projectRoot, epicArg);
    if (!resolved) {
      console.error(`Epic not found: ${epicArg}`);
      process.exit(1);
    }

    const { epicId } = resolved;

    const response = await submitRequest(projectRoot, {
      type: "clear-attention",
      epicId,
    });

    if (response.success) {
      console.log(`Attention cleared for epic ${epicId}`);
    } else {
      console.error(`Failed to clear attention: ${response.error}`);
      process.exit(1);
    }
  });
