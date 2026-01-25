import { Command } from "commander";
import { createInterface } from "node:readline";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readEpic, writeEpic, getEpicDir, getChatsDir, resolveEpicId } from "../../state/index.js";
import { getPmPrompt, getTechLeadPrompt, getCoderPrompt } from "../../prompts/index.js";
import { readTasks } from "../../state/index.js";
import { lookupEpic, searchEpics, listRegisteredEpics } from "../../registry/index.js";
import { mkdir, readdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Get the Inc package root (where .claude-plugin lives)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// From dist/cli/commands/chat.js -> package root
const INC_PLUGIN_PATH = join(__dirname, "..", "..", "..");

// Animated spinner with fun messages
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const THINKING_MESSAGES = [
  "thinking",
  "pondering",
  "cooking",
  "brewing",
  "mulling",
  "considering",
  "plotting",
  "scheming",
  "ruminating",
  "percolating",
];

class Spinner {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private messageIndex = 0;
  private tickCount = 0;

  start(): void {
    this.frameIndex = 0;
    this.messageIndex = Math.floor(Math.random() * THINKING_MESSAGES.length);
    this.tickCount = 0;

    // Hide cursor
    process.stdout.write("\x1B[?25l");

    this.intervalId = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length;
      this.tickCount++;

      // Change message every ~3 seconds (30 ticks at 100ms)
      if (this.tickCount % 30 === 0) {
        this.messageIndex = (this.messageIndex + 1) % THINKING_MESSAGES.length;
      }

      const frame = SPINNER_FRAMES[this.frameIndex];
      const message = THINKING_MESSAGES[this.messageIndex];
      const dots = ".".repeat((this.tickCount % 4));

      // Clear line and write spinner
      process.stdout.write(`\r\x1B[K${frame} ${message}${dots}`);
    }, 100);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Clear spinner line and show cursor
    process.stdout.write("\r\x1B[K");
    process.stdout.write("\x1B[?25h");
  }
}

/**
 * Build a summary of all known Inc projects for context
 */
async function buildGlobalProjectsContext(): Promise<string> {
  const allEpics = await listRegisteredEpics();

  if (allEpics.length === 0) {
    return "";
  }

  const lines: string[] = [
    "# Known Inc Projects",
    "",
    "You have access to information about these projects. If the user mentions something ambiguous, you can ask which project they mean.",
    "",
  ];

  // Group by project path
  const byProject = new Map<string, typeof allEpics>();
  for (const entry of allEpics) {
    const existing = byProject.get(entry.projectPath) || [];
    existing.push(entry);
    byProject.set(entry.projectPath, existing);
  }

  for (const [projectPath, epics] of byProject) {
    lines.push(`## ${projectPath}`);
    for (const e of epics) {
      const epic = await readEpic(e.projectPath, e.epicId);
      const status = epic?.status ?? "unknown";
      const desc = e.description.split("\n")[0].slice(0, 80);
      lines.push(`- **${e.epicId}** (${status}): ${desc}`);
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
  epicId: string;
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
    `**Epic**: ${transcript.epicId}`,
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
  .description("Chat with an agent about an epic")
  .argument("<epic-id>", "The epic to chat about")
  .option("-r, --role <role>", "Agent role: pm, tech-lead, coder", "pm")
  .option("-t, --task <id>", "Task ID (required for coder role)")
  .action(async (epicId: string, options: { role: string; task?: string }) => {
    let projectRoot = process.cwd();

    try {
      // First try to resolve epic ID (supports short IDs) in current directory
      let resolvedEpicId = epicId;
      const resolved = await resolveEpicId(projectRoot, epicId);
      let epic = resolved?.epic ?? null;
      if (resolved) {
        resolvedEpicId = resolved.epicId;
      }

      // If not found locally, check global registry
      if (!epic) {
        const registryEntry = await lookupEpic(epicId);
        if (registryEntry) {
          projectRoot = registryEntry.projectPath;
          const localResolved = await resolveEpicId(projectRoot, epicId);
          epic = localResolved?.epic ?? await readEpic(projectRoot, epicId);
          if (localResolved) resolvedEpicId = localResolved.epicId;
        }
      }

      // Still not found? Try fuzzy search
      if (!epic) {
        const matches = await searchEpics(epicId);
        if (matches.length === 1) {
          projectRoot = matches[0].projectPath;
          resolvedEpicId = matches[0].epicId;
          epic = await readEpic(projectRoot, matches[0].epicId);
        } else if (matches.length > 1) {
          console.error(`Multiple epics match "${epicId}":`);
          for (const match of matches.slice(0, 5)) {
            console.error(`  - ${match.epicId} (${match.projectPath})`);
          }
          console.error(`\nBe more specific.`);
          process.exit(1);
        }
      }

      if (!epic) {
        console.error(`Epic not found: ${epicId}`);
        process.exit(1);
      }

      // Use resolved ID for all subsequent operations
      epicId = resolvedEpicId;

      console.log(`Project: ${projectRoot}`);

      // Update status if new
      if (epic.status === "new" && options.role === "pm") {
        epic.status = "spec_in_progress";
        await writeEpic(projectRoot, epic);
      }

      console.log(`Chatting with ${options.role} about: ${epic.description}`);
      console.log("Enter sends. Empty line after text = multiline done. 'exit' to quit.");
      console.log("");

      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // Collect input with multiline support
      // Pattern: accumulate lines, empty line after content submits
      const collectInput = (): Promise<string> => {
        const lines: string[] = [];

        return new Promise((resolve) => {
          const readLine = (): void => {
            const prompt = lines.length === 0 ? "> " : "  ";
            rl.question(prompt, (line) => {
              // Empty line after content = submit
              if (line === "" && lines.length > 0) {
                resolve(lines.join("\n"));
                return;
              }

              // First empty line = just keep prompting
              if (line === "" && lines.length === 0) {
                readLine();
                return;
              }

              // Accumulate the line
              lines.push(line);
              readLine();
            });
          };

          readLine();
        });
      };

      const epicDir = getEpicDir(projectRoot, epicId);
      const chatsDir = getChatsDir(projectRoot, epicId);

      // Load recent summaries for context
      const recentSummaries = await loadRecentSummaries(chatsDir);

      // Load global project context
      const globalContext = await buildGlobalProjectsContext();

      // Determine which tools the agent can use based on role
      const allowedTools = getAllowedTools(options.role);
      const taskId = options.task ? parseInt(options.task, 10) : undefined;
      const systemPrompt = await getSystemPrompt(
        options.role,
        epicId,
        epic.description,
        projectRoot,
        epicDir,
        taskId,
        recentSummaries,
        globalContext
      );

      // Initialize transcript for this session
      const transcript: ChatTranscript = {
        epicId,
        agentRole: options.role,
        startedAt: new Date().toISOString(),
        messages: [],
      };

      // Track session ID for multi-turn conversation within this chat session
      // This is NOT persisted between different `inc chat` invocations
      let sessionId: string | undefined;

      const cleanup = async (): Promise<void> => {
        // Save transcript on exit
        transcript.endedAt = new Date().toISOString();
        if (transcript.messages.length > 0) {
          await saveTranscript(chatsDir, transcript);
          console.log("Chat transcript saved.");
        }
      };

      const askQuestion = async (): Promise<void> => {
        const input = await collectInput();
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

        const spinner = new Spinner();
        spinner.start();

        try {
          // Include Skill tool and Strike plugin for CLI commands
          const allTools = [...allowedTools, "Skill", "Bash"];
          const queryOptions: Parameters<typeof query>[0]["options"] = {
            cwd: projectRoot,
            systemPrompt,
            tools: allTools,
            allowedTools: allTools,
            permissionMode: "acceptEdits",
            additionalDirectories: [epicDir],
            plugins: [{ type: "local", path: INC_PLUGIN_PATH }],
          };

          // Resume session for multi-turn conversation within this chat
          if (sessionId) {
            queryOptions.resume = sessionId;
          }

          let response = "";
          for await (const message of query({
            prompt: trimmed,
            options: queryOptions,
          })) {
            // Capture session ID from init message for multi-turn conversation
            if (message.type === "system" && message.subtype === "init") {
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
              spinner.stop();
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
          spinner.stop();
          console.error("Agent error:", error);
        }

        askQuestion();
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
  epicId: string,
  description: string,
  projectRoot: string,
  epicDir: string,
  taskId?: number,
  recentSummaries?: string[],
  globalContext?: string
): Promise<string> {
  let basePrompt: string;

  switch (role) {
    case "pm":
      basePrompt = getPmPrompt(epicId, description, epicDir);
      break;
    case "tech-lead":
      basePrompt = getTechLeadPrompt(epicId, description, epicDir);
      break;
    case "coder":
      if (taskId === undefined) {
        throw new Error("Coder role requires --task <id>");
      }
      const tasksFile = await readTasks(projectRoot, epicId);
      if (!tasksFile) {
        throw new Error(`No tasks found for epic: ${epicId}`);
      }
      const task = tasksFile.tasks.find((t) => t.id === taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      basePrompt = getCoderPrompt(epicId, description, task.id, task.name, task.description, epicDir);
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
    basePrompt += `\n\n# Recent Chat Context\n\nHere are summaries of recent conversations about this epic:\n\n`;
    for (const summary of recentSummaries) {
      basePrompt += `---\n${summary}\n`;
    }
    basePrompt += `\n---\n\nUse this context to understand what has been discussed before, but don't assume any previous conversation state.`;
  }

  return basePrompt;
}
