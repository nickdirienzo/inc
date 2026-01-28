/**
 * Epic chat router for multi-agent responses
 *
 * Spawns PM and Tech Lead agents sequentially to respond to epic chat messages.
 * Both agents have read-only access to spec.md, architecture.md, and tasks.json.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AgentLogger } from "../agents/logging.js";
import { getEpicDir } from "../state/paths.js";
import type { Epic } from "../state/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const incPluginDir = join(__dirname, "../..");

/**
 * Spawn PM and Tech Lead agents to respond to an epic chat message.
 *
 * Both agents:
 * - Use a shared log file for this request
 * - Have read-only access to epic planning docs (spec.md, architecture.md, tasks.json)
 * - Write responses with role metadata to the log
 * - Execute sequentially (PM first, then Tech Lead)
 *
 * @param epic - The epic being discussed
 * @param userMessage - The user's chat message
 * @param logger - Shared logger for both agents
 * @returns Promise that resolves when both agents complete or error occurs
 */
export async function spawnEpicChatAgents(
  epic: Epic,
  userMessage: string,
  logger: AgentLogger,
  projectRoot: string
): Promise<void> {
  const epicDir = getEpicDir(projectRoot, epic.id);

  // Spawn PM agent first
  try {
    await spawnPmChatAgent(epic, userMessage, logger, epicDir, projectRoot);
  } catch (error) {
    console.error(`PM chat agent failed for ${epic.id}: ${error}`);
    // Continue to Tech Lead even if PM fails
  }

  // Spawn Tech Lead agent second
  try {
    await spawnTechLeadChatAgent(epic, userMessage, logger, epicDir, projectRoot);
  } catch (error) {
    console.error(`Tech Lead chat agent failed for ${epic.id}: ${error}`);
  }

  // Write completion marker
  await logger.log({ type: "complete" });
}

/**
 * Spawn PM agent to respond to chat message
 */
async function spawnPmChatAgent(
  epic: Epic,
  userMessage: string,
  logger: AgentLogger,
  epicDir: string,
  projectRoot: string
): Promise<void> {
  const systemPrompt = `You are PM agent. Respond to product/scope questions about this epic.

Epic ID: ${epic.id}
Epic Description: ${epic.description}
Epic Directory: ${epicDir}

You have read-only access to:
- spec.md (product specification)
- architecture.md (technical architecture)
- tasks.json (task breakdown)

Important:
- You CANNOT edit any files during chat (read-only mode)
- Keep your response focused on product scope and requirements
- Be concise and helpful

User asked: ${userMessage}`;

  const queryHandle = query({
    prompt: "Please respond to the user's question about this epic.",
    options: {
      cwd: projectRoot,
      systemPrompt,
      tools: ["Read", "Glob", "Grep"],
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "acceptEdits",
      additionalDirectories: [epicDir],
      maxTurns: 10,
      plugins: [{ type: "local", path: incPluginDir }],
    },
  });

  let responseContent = "";

  for await (const message of queryHandle) {
    // Capture text responses
    if (message.type === "assistant") {
      const betaMessage = message.message;
      for (const block of betaMessage.content) {
        if (block.type === "text") {
          responseContent += block.text;
        }
      }
    }

    // Log result
    if (message.type === "result") {
      if (message.subtype === "success") {
        console.log(`PM chat agent completed for ${epic.id}`);
      } else {
        console.log(`PM chat agent error for ${epic.id}: ${message.errors?.join(", ") || message.subtype}`);
      }
    }
  }

  // Write PM response with role metadata to shared log
  if (responseContent.trim()) {
    await logger.log({
      type: "text",
      role: "pm",
      content: responseContent.trim(),
    });
  }
}

/**
 * Spawn Tech Lead agent to respond to chat message
 */
async function spawnTechLeadChatAgent(
  epic: Epic,
  userMessage: string,
  logger: AgentLogger,
  epicDir: string,
  projectRoot: string
): Promise<void> {
  const systemPrompt = `You are Tech Lead agent. PM already responded. Respond to architecture/implementation questions.

Epic ID: ${epic.id}
Epic Description: ${epic.description}
Epic Directory: ${epicDir}

You have read-only access to:
- spec.md (product specification)
- architecture.md (technical architecture)
- tasks.json (task breakdown)

Important:
- You CANNOT edit any files during chat (read-only mode)
- The PM agent has already responded to this message
- Focus on technical architecture and implementation details
- Be concise and helpful

User asked: ${userMessage}`;

  const queryHandle = query({
    prompt: "Please respond to the user's question about this epic.",
    options: {
      cwd: projectRoot,
      systemPrompt,
      tools: ["Read", "Glob", "Grep"],
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "acceptEdits",
      additionalDirectories: [epicDir],
      maxTurns: 10,
      plugins: [{ type: "local", path: incPluginDir }],
    },
  });

  let responseContent = "";

  for await (const message of queryHandle) {
    // Capture text responses
    if (message.type === "assistant") {
      const betaMessage = message.message;
      for (const block of betaMessage.content) {
        if (block.type === "text") {
          responseContent += block.text;
        }
      }
    }

    // Log result
    if (message.type === "result") {
      if (message.subtype === "success") {
        console.log(`Tech Lead chat agent completed for ${epic.id}`);
      } else {
        console.log(`Tech Lead chat agent error for ${epic.id}: ${message.errors?.join(", ") || message.subtype}`);
      }
    }
  }

  // Write Tech Lead response with role metadata to shared log
  if (responseContent.trim()) {
    await logger.log({
      type: "text",
      role: "tech_lead",
      content: responseContent.trim(),
    });
  }
}
