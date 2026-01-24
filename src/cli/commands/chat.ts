import { Command } from "commander";
import { createInterface } from "node:readline";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readMission, writeMission, getMissionDir, getChatsDir } from "../../state/index.js";
import { getPmPrompt, getTechLeadPrompt, getCoderPrompt } from "../../prompts/index.js";
import { readTasks } from "../../state/index.js";
import { lookupMission, searchMissions, listRegisteredMissions } from "../../registry/index.js";
import { mkdir, readdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Get the Strike package root (where .claude-plugin lives)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// From dist/cli/commands/chat.js -> package root
const STRIKE_PLUGIN_PATH = join(__dirname, "..", "..", "..");

/**
 * Build a summary of all known Strike projects for context
 */
async function buildGlobalProjectsContext(): Promise<string> {
  const allMissions = await listRegisteredMissions();

  if (allMissions.length === 0) {
    return "";
  }

  const lines: string[] = [
    "# Known Strike Projects",
    "",
    "You have access to information about these projects. If the user mentions something ambiguous, you can ask which project they mean.",
    "",
  ];

  // Group by project path
  const byProject = new Map<string, typeof allMissions>();
  for (const entry of allMissions) {
    const existing = byProject.get(entry.projectPath) || [];
    existing.push(entry);
    byProject.set(entry.projectPath, existing);
  }

  for (const [projectPath, missions] of byProject) {
    lines.push(`## ${projectPath}`);
    for (const m of missions) {
      const mission = await readMission(m.projectPath, m.missionId);
      const status = mission?.status ?? "unknown";
      const desc = m.description.split("\n")[0].slice(0, 80);
      lines.push(`- **${m.missionId}** (${status}): ${desc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatTranscript {
  missionId: string;
  agentRole: string;
  startedAt: string;
  endedAt?: string;
  messages: ChatMessage[];
  summary?: string;
}

/**
 * Generate a timestamp-based filename for a chat transcript
 */
function generateChatFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hours}${minutes}`;
}

/**
 * Load recent chat summaries for context
 */
async function loadRecentSummaries(chatsDir: string, limit = 3): Promise<string[]> {
  try {
    const files = await readdir(chatsDir);
    const summaryFiles = files
      .filter((f) => f.endsWith(".summary.md"))
      .sort()
      .reverse()
      .slice(0, limit);

    const summaries: string[] = [];
    for (const file of summaryFiles) {
      const content = await readFile(join(chatsDir, file), "utf-8");
      summaries.push(content);
    }
    return summaries;
  } catch {
    return [];
  }
}

/**
 * Save chat transcript and generate a simple summary
 */
async function saveTranscript(
  chatsDir: string,
  transcript: ChatTranscript
): Promise<void> {
  await mkdir(chatsDir, { recursive: true });

  const filename = generateChatFilename();

  // Save full transcript
  await writeFile(
    join(chatsDir, `${filename}.json`),
    JSON.stringify(transcript, null, 2)
  );

  // Generate and save a simple summary
  // For now, just extract the first line of each assistant message
  const summary = generateSummary(transcript);
  await writeFile(join(chatsDir, `${filename}.summary.md`), summary);
}

/**
 * Generate a simple summary of the chat
 */
function generateSummary(transcript: ChatTranscript): string {
  const lines: string[] = [
    `# Chat Summary`,
    ``,
    `**Date**: ${transcript.startedAt}`,
    `**Agent**: ${transcript.agentRole}`,
    `**Mission**: ${transcript.missionId}`,
    ``,
    `## Key Points`,
    ``,
  ];

  // Extract key points from assistant messages
  for (const msg of transcript.messages) {
    if (msg.role === "assistant" && msg.content.trim()) {
      // Take first sentence or first 100 chars
      const firstLine = msg.content.split(/[.!?\n]/)[0].trim();
      if (firstLine.length > 0 && firstLine.length < 200) {
        lines.push(`- ${firstLine}`);
      }
    }
  }

  // Add user questions
  lines.push(``, `## User Questions`, ``);
  for (const msg of transcript.messages) {
    if (msg.role === "user" && msg.content.trim()) {
      const question = msg.content.slice(0, 100);
      lines.push(`- "${question}${msg.content.length > 100 ? "..." : ""}"`);
    }
  }

  return lines.join("\n");
}

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
      const chatsDir = getChatsDir(projectRoot, missionId);

      // Load recent summaries for context
      const recentSummaries = await loadRecentSummaries(chatsDir);

      // Load global project context
      const globalContext = await buildGlobalProjectsContext();

      // Determine which tools the agent can use based on role
      const allowedTools = getAllowedTools(options.role);
      const taskId = options.task ? parseInt(options.task, 10) : undefined;
      const systemPrompt = await getSystemPrompt(
        options.role,
        missionId,
        mission.description,
        projectRoot,
        taskId,
        recentSummaries,
        globalContext
      );

      // Initialize transcript for this session
      const transcript: ChatTranscript = {
        missionId,
        agentRole: options.role,
        startedAt: new Date().toISOString(),
        messages: [],
      };

      const cleanup = async (): Promise<void> => {
        // Save transcript on exit
        transcript.endedAt = new Date().toISOString();
        if (transcript.messages.length > 0) {
          await saveTranscript(chatsDir, transcript);
          console.log("Chat transcript saved.");
        }
      };

      const askQuestion = (): void => {
        rl.question("> ", async (input) => {
          const trimmed = input.trim();

          if (trimmed.toLowerCase() === "exit") {
            await cleanup();
            console.log("Goodbye!");
            rl.close();
            return;
          }

          if (!trimmed) {
            askQuestion();
            return;
          }

          // Record user message
          transcript.messages.push({
            role: "user",
            content: trimmed,
            timestamp: new Date().toISOString(),
          });

          try {
            // Fresh session each time - no resume
            // Include Skill tool and Strike plugin for CLI commands
            const allTools = [...allowedTools, "Skill", "Bash"];
            const queryOptions: Parameters<typeof query>[0]["options"] = {
              cwd: projectRoot,
              systemPrompt,
              tools: allTools,
              allowedTools: allTools,
              permissionMode: "acceptEdits",
              additionalDirectories: [missionDir],
              plugins: [{ type: "local", path: STRIKE_PLUGIN_PATH }],
            };

            let response = "";
            for await (const message of query({
              prompt: trimmed,
              options: queryOptions,
            })) {
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
                  console.error("Error:", message.errors?.join(", ") || message.subtype);
                }
              }
            }

            // Record assistant response
            if (response) {
              transcript.messages.push({
                role: "assistant",
                content: response,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (error) {
            console.error("Agent error:", error);
          }

          askQuestion();
        });
      };

      // Handle Ctrl+C gracefully
      process.on("SIGINT", async () => {
        await cleanup();
        process.exit(0);
      });

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
  taskId?: number,
  recentSummaries?: string[],
  globalContext?: string
): Promise<string> {
  let basePrompt: string;

  switch (role) {
    case "pm":
      basePrompt = getPmPrompt(missionId, description);
      break;
    case "tech-lead":
      basePrompt = getTechLeadPrompt(missionId, description);
      break;
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
      basePrompt = getCoderPrompt(missionId, description, task.id, task.name, task.description);
      break;
    default:
      basePrompt = `You are a helpful assistant working on: ${description}`;
  }

  // Append global projects context
  if (globalContext) {
    basePrompt += `\n\n${globalContext}`;
  }

  // Append recent chat summaries for context
  if (recentSummaries && recentSummaries.length > 0) {
    basePrompt += `\n\n# Recent Chat Context\n\nHere are summaries of recent conversations about this mission:\n\n`;
    for (const summary of recentSummaries) {
      basePrompt += `---\n${summary}\n`;
    }
    basePrompt += `\n---\n\nUse this context to understand what has been discussed before, but don't assume any previous conversation state.`;
  }

  return basePrompt;
}
