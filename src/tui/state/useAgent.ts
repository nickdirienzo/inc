/**
 * Agent response parser for TUI mission control interface
 *
 * Handles parsing agent responses to detect file references and load their content
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { ContextFile } from "./types.js";

/**
 * Regular expression to match [FILE: path] pattern in agent responses
 * Captures the file path from the pattern
 */
const FILE_PATTERN = /\[FILE:\s*([^\]]+)\]/g;

/**
 * Parse an agent response to extract file references
 *
 * @param response - The agent's text response
 * @returns Array of file paths found in the response, or null if none found
 */
export function parseFileReferences(response: string): string[] | null {
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  FILE_PATTERN.lastIndex = 0;

  while ((match = FILE_PATTERN.exec(response)) !== null) {
    const filePath = match[1].trim();
    if (filePath) {
      matches.push(filePath);
    }
  }

  return matches.length > 0 ? matches : null;
}

/**
 * Read file content from disk
 *
 * @param path - Absolute or relative path to the file
 * @param cwd - Current working directory for resolving relative paths
 * @returns File content as string, or null if file doesn't exist or can't be read
 */
export async function readFileContent(path: string, cwd: string = process.cwd()): Promise<string | null> {
  try {
    // Resolve relative paths against cwd
    const resolvedPath = path.startsWith('/') ? path : `${cwd}/${path}`;

    if (!existsSync(resolvedPath)) {
      return null;
    }

    const content = await readFile(resolvedPath, "utf-8");
    return content;
  } catch (error) {
    // Gracefully handle read errors (permissions, encoding issues, etc.)
    console.error(`Error reading file ${path}:`, error);
    return null;
  }
}

/**
 * Process an agent response and extract context file
 *
 * This function searches for [FILE: path] patterns in the agent response,
 * reads the first file found, and returns a ContextFile object.
 *
 * @param response - The agent's text response
 * @param cwd - Current working directory for resolving relative paths
 * @returns ContextFile object if a file reference was found and successfully read, null otherwise
 */
export async function processAgentResponse(
  response: string,
  cwd: string = process.cwd()
): Promise<ContextFile | null> {
  const filePaths = parseFileReferences(response);

  if (!filePaths || filePaths.length === 0) {
    return null;
  }

  // Use the first file reference found
  const firstPath = filePaths[0];
  const content = await readFileContent(firstPath, cwd);

  if (content === null) {
    return null;
  }

  return {
    path: firstPath,
    content,
  };
}

/**
 * State manager for agent responses with file detection
 *
 * This class maintains the contextFile state and provides methods to update it
 * based on agent responses.
 */
export class AgentResponseState {
  private contextFile: ContextFile | null = null;
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Get the current context file
   */
  getContextFile(): ContextFile | null {
    return this.contextFile;
  }

  /**
   * Update state based on a new agent response
   *
   * @param response - The agent's text response
   * @returns The updated context file (or null if none found)
   */
  async updateFromResponse(response: string): Promise<ContextFile | null> {
    this.contextFile = await processAgentResponse(response, this.cwd);
    return this.contextFile;
  }

  /**
   * Clear the context file state
   */
  clearContextFile(): void {
    this.contextFile = null;
  }

  /**
   * Set the working directory for resolving relative paths
   */
  setWorkingDirectory(cwd: string): void {
    this.cwd = cwd;
  }
}
