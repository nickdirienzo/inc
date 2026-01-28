/**
 * Chat history persistence utilities
 *
 * Manages JSONL-based chat history for epic planning docs.
 */

import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { getEpicDir } from "./paths.js";

/**
 * Chat message interface
 */
export interface ChatMessage {
  role: "user" | "pm" | "tech_lead" | "system";
  content: string;
  timestamp: string;
}

/**
 * Get the path to the chat.jsonl file for an epic
 */
function getChatPath(projectRoot: string, epicId: string): string {
  return join(getEpicDir(projectRoot, epicId), "chat.jsonl");
}

/**
 * Load chat history from chat.jsonl
 * Returns an array of ChatMessage objects
 */
export async function loadChatHistory(projectRoot: string, epicId: string): Promise<ChatMessage[]> {
  const chatPath = getChatPath(projectRoot, epicId);

  if (!existsSync(chatPath)) {
    return [];
  }

  const content = await readFile(chatPath, "utf-8");
  const lines = content.trim().split("\n").filter(line => line.trim());

  const messages: ChatMessage[] = [];
  for (const line of lines) {
    try {
      const message = JSON.parse(line) as ChatMessage;
      messages.push(message);
    } catch (error) {
      console.error(`Failed to parse chat message: ${line}`, error);
    }
  }

  return messages;
}

/**
 * Append a message to chat.jsonl
 * Creates the file if it doesn't exist
 */
export async function appendChatMessage(
  projectRoot: string,
  epicId: string,
  message: ChatMessage
): Promise<void> {
  const chatPath = getChatPath(projectRoot, epicId);
  const epicDir = dirname(chatPath);

  // Ensure epic directory exists
  if (!existsSync(epicDir)) {
    await mkdir(epicDir, { recursive: true });
  }

  // Append message as JSONL entry
  const jsonLine = JSON.stringify(message) + "\n";

  if (existsSync(chatPath)) {
    await appendFile(chatPath, jsonLine, "utf-8");
  } else {
    await writeFile(chatPath, jsonLine, "utf-8");
  }
}

/**
 * Prune old messages to keep only the latest N messages
 * Default: keep 100 messages
 */
export async function pruneOldMessages(
  projectRoot: string,
  epicId: string,
  maxMessages: number = 100
): Promise<void> {
  const messages = await loadChatHistory(projectRoot, epicId);

  if (messages.length <= maxMessages) {
    return; // No pruning needed
  }

  // Keep only the latest maxMessages
  const pruned = messages.slice(-maxMessages);

  const chatPath = getChatPath(projectRoot, epicId);
  const content = pruned.map(msg => JSON.stringify(msg)).join("\n") + "\n";

  await writeFile(chatPath, content, "utf-8");
}
