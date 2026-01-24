import { Command } from "commander";
import { createInterface } from "node:readline";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readMission, writeMission, getMissionDir } from "../../state/index.js";
import { getPmPrompt, getTechLeadPrompt, getCoderPrompt } from "../../prompts/index.js";
import { readTasks } from "../../state/index.js";
import { lookupMission, searchMissions } from "../../registry/index.js";

export const chatCommand = new Command("chat")
  .description("Chat with an agent about a mission")
  .argument("<mission-id>", "The mission to chat about")
  .option("-r, --role <role>", "Agent role: pm, tech-lead, coder", "pm")
  .option("-t, --task <id>", "Task ID (required for coder role)")
  .action(async (missionId: string, options: { role: string; task?: string }) => {
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

      console.log(`Project: ${projectRoot}`);

      // Update status if new
      if (mission.status === "new" && options.role === "pm") {
        mission.status = "spec_in_progress";
        await writeMission(projectRoot, mission);
      }

      console.log(`Chatting with ${options.role} about: ${mission.description}`);
      console.log("Type your message and press Enter. Type 'exit' to quit.");
      console.log("");

      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const missionDir = getMissionDir(projectRoot, missionId);

      // Determine which tools the agent can use based on role
      const allowedTools = getAllowedTools(options.role);
      const taskId = options.task ? parseInt(options.task, 10) : undefined;
      const systemPrompt = await getSystemPrompt(options.role, missionId, mission.description, projectRoot, taskId);

      let sessionId: string | undefined;

      const askQuestion = (): void => {
        rl.question("> ", async (input) => {
          const trimmed = input.trim();

          if (trimmed.toLowerCase() === "exit") {
            console.log("Goodbye!");
            rl.close();
            return;
          }

          if (!trimmed) {
            askQuestion();
            return;
          }

          try {
            // Run the agent
            const queryOptions: Parameters<typeof query>[0]["options"] = {
              cwd: projectRoot,
              systemPrompt,
              tools: allowedTools,
              allowedTools, // Auto-approve these tools
              permissionMode: "acceptEdits",
              persistSession: true,
              additionalDirectories: [missionDir],
            };

            // Resume session if we have one
            if (sessionId) {
              queryOptions.resume = sessionId;
            }

            let response = "";
            for await (const message of query({
              prompt: trimmed,
              options: queryOptions,
            })) {
              // Capture session ID from init message
              if (message.type === "system" && "subtype" in message && message.subtype === "init") {
                sessionId = message.session_id;
              }

              // Print assistant responses
              if (message.type === "assistant") {
                const betaMessage = message.message;
                for (const block of betaMessage.content) {
                  if (block.type === "text") {
                    response += block.text;
                  }
                }
              }

              // Handle result
              if (message.type === "result") {
                if (message.subtype === "success") {
                  console.log("");
                  console.log(response || message.result);
                  console.log("");
                } else {
                  // Error subtypes: error_during_execution, error_max_turns, etc.
                  console.error("Error:", message.errors?.join(", ") || message.subtype);
                }
              }
            }
          } catch (error) {
            console.error("Agent error:", error);
          }

          askQuestion();
        });
      };

      askQuestion();
    } catch (error) {
      console.error("Failed to start chat:", error);
      process.exit(1);
    }
  });

function getAllowedTools(role: string): string[] {
  switch (role) {
    case "pm":
      return ["Read", "Glob", "Grep", "Edit", "Write"];
    case "tech-lead":
      return ["Read", "Glob", "Grep", "Edit", "Write", "Bash"];
    case "coder":
      return ["Read", "Glob", "Grep", "Edit", "Write", "Bash"];
    default:
      return ["Read", "Glob", "Grep"];
  }
}

async function getSystemPrompt(
  role: string,
  missionId: string,
  description: string,
  projectRoot: string,
  taskId?: number
): Promise<string> {
  switch (role) {
    case "pm":
      return getPmPrompt(missionId, description);
    case "tech-lead":
      return getTechLeadPrompt(missionId, description);
    case "coder":
      if (taskId === undefined) {
        throw new Error("Coder role requires --task <id>");
      }
      const tasksFile = await readTasks(projectRoot, missionId);
      if (!tasksFile) {
        throw new Error(`No tasks found for mission: ${missionId}`);
      }
      const task = tasksFile.tasks.find((t) => t.id === taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      return getCoderPrompt(missionId, description, task.id, task.name, task.description);
    default:
      return `You are a helpful assistant working on: ${description}`;
  }
}
