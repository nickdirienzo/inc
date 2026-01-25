/**
 * TUI Agent Query Wrapper
 *
 * Wraps the Claude Agent SDK's query() function for use in the TUI.
 * Handles streaming responses, tool execution, and error handling.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { getTuiAgentPrompt } from "../../prompts/index.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INC_PLUGIN_PATH = join(__dirname, "..", "..", "..");

let currentSessionId: string | null = null;

export function getSessionId(): string | null {
  return currentSessionId;
}

export function clearSession(): void {
  currentSessionId = null;
}

/**
 * Response types from the agent
 */
export type AgentResponse =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content?: string }
  | { type: 'complete'; content?: string }
  | { type: 'error'; error: string };

/**
 * Execute a TUI agent query with streaming responses
 *
 * @param prompt - The user's message/question
 * @param projectRoot - The project root directory for tool execution context
 * @yields AgentResponse objects as they arrive from the SDK
 */
export async function* executeTuiAgentQuery(
  prompt: string,
  projectRoot: string
): AsyncGenerator<AgentResponse> {
  const systemPrompt = getTuiAgentPrompt();

  try {
    const tools = ["Read", "Glob", "Grep", "Edit", "Write", "Bash", "Skill"];
    const queryOptions: Parameters<typeof query>[0]["options"] = {
      cwd: projectRoot,
      systemPrompt,
      tools,
      allowedTools: tools,
      permissionMode: "acceptEdits",
      plugins: [{ type: "local", path: INC_PLUGIN_PATH }],
      ...(currentSessionId ? { resume: currentSessionId } : {}),
    };

    let responseText = "";

    // Stream responses from the SDK
    for await (const message of query({
      prompt,
      options: queryOptions,
    })) {
      // Handle different message types
      if ("session_id" in message && message.session_id) {
        currentSessionId = message.session_id;
      }

      if (message.type === "assistant") {
        const betaMessage = message.message;
        for (const block of betaMessage.content) {
          if (block.type === "text") {
            responseText += block.text;
            yield { type: 'text', content: block.text };
          }
        }
      } else if (message.type === "tool_progress") {
        yield { type: 'thinking' };
      } else if (message.type === "result") {
        // Handle final result
        if (message.subtype === "success") {
          yield {
            type: 'complete',
            content: responseText || message.result
          };
        } else {
          // Error occurred
          const errorMsg = message.errors?.join(", ") || message.subtype;
          yield { type: 'error', error: errorMsg };
        }
      }
    }
  } catch (error) {
    // Catch and yield any unexpected errors
    const errorMsg = error instanceof Error ? error.message : String(error);
    yield { type: 'error', error: errorMsg };
  }
}
