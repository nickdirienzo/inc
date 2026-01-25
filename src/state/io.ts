/**
 * State I/O utilities for reading and writing Inc state files
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Epic, TasksFile, DaemonState } from "./schema.js";
import * as paths from "./paths.js";

/**
 * Ensure a directory exists, creating it if necessary
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Read and parse a JSON file
 */
async function readJson<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null;
  }
  const content = await readFile(filePath, "utf-8");
  if (!content.trim()) {
    return null;
  }
  return JSON.parse(content) as T;
}

/**
 * Write an object as JSON to a file
 */
async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Read a text file
 */
async function readText(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) {
    return null;
  }
  return readFile(filePath, "utf-8");
}

/**
 * Write text to a file
 */
async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, "utf-8");
}

// ============================================================================
// Epic operations
// ============================================================================

export async function readEpic(projectRoot: string, epicId: string): Promise<Epic | null> {
  return readJson<Epic>(paths.getEpicJsonPath(projectRoot, epicId));
}

export async function writeEpic(projectRoot: string, epic: Epic): Promise<void> {
  epic.updated_at = new Date().toISOString();
  await writeJson(paths.getEpicJsonPath(projectRoot, epic.id), epic);
}

export async function listEpics(projectRoot: string): Promise<string[]> {
  const epicsDir = paths.getEpicsDir(projectRoot);
  if (!existsSync(epicsDir)) {
    return [];
  }
  const entries = await readdir(epicsDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function createEpic(
  projectRoot: string,
  id: string,
  description: string
): Promise<Epic> {
  const now = new Date().toISOString();
  const epic: Epic = {
    id,
    description,
    status: "new",
    created_at: now,
    updated_at: now,
  };
  await writeEpic(projectRoot, epic);
  return epic;
}

// ============================================================================
// Spec operations
// ============================================================================

export async function readSpec(projectRoot: string, epicId: string): Promise<string | null> {
  return readText(paths.getSpecPath(projectRoot, epicId));
}

export async function writeSpec(projectRoot: string, epicId: string, content: string): Promise<void> {
  await writeText(paths.getSpecPath(projectRoot, epicId), content);
}

// ============================================================================
// Architecture operations
// ============================================================================

export async function readArchitecture(projectRoot: string, epicId: string): Promise<string | null> {
  return readText(paths.getArchitecturePath(projectRoot, epicId));
}

export async function writeArchitecture(projectRoot: string, epicId: string, content: string): Promise<void> {
  await writeText(paths.getArchitecturePath(projectRoot, epicId), content);
}

// ============================================================================
// Tasks operations
// ============================================================================

export async function readTasks(projectRoot: string, epicId: string): Promise<TasksFile | null> {
  const filePath = paths.getTasksPath(projectRoot, epicId);
  if (!existsSync(filePath)) {
    return null;
  }
  const content = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(content);

  // Handle both formats: raw array [...] or wrapped object {tasks: [...]}
  if (Array.isArray(parsed)) {
    return { tasks: parsed };
  }
  return parsed as TasksFile;
}

export async function writeTasks(projectRoot: string, epicId: string, tasks: TasksFile): Promise<void> {
  await writeJson(paths.getTasksPath(projectRoot, epicId), tasks);
}

// ============================================================================
// Decisions operations
// ============================================================================

export async function readDecisions(projectRoot: string, epicId: string): Promise<string | null> {
  return readText(paths.getDecisionsPath(projectRoot, epicId));
}

export async function appendDecision(
  projectRoot: string,
  epicId: string,
  role: "pm" | "tech_lead" | "coder",
  decision: string,
  reasoning: string
): Promise<void> {
  const existing = (await readDecisions(projectRoot, epicId)) || "";
  const timestamp = new Date().toISOString();
  const roleTitle = role === "pm" ? "PM" : role === "tech_lead" ? "Tech Lead" : "Coder";

  const entry = `\n## ${roleTitle} Decision - ${timestamp}\n\n**Decision:** ${decision}\n\n**Reasoning:** ${reasoning}\n`;

  await writeText(paths.getDecisionsPath(projectRoot, epicId), existing + entry);
}

// ============================================================================
// Daemon state operations
// ============================================================================

export async function readDaemonState(projectRoot: string): Promise<DaemonState | null> {
  return readJson<DaemonState>(paths.getDaemonStatePath(projectRoot));
}

export async function writeDaemonState(projectRoot: string, state: DaemonState): Promise<void> {
  await writeJson(paths.getDaemonStatePath(projectRoot), state);
}

export async function readDaemonPid(projectRoot: string): Promise<number | null> {
  const pidPath = paths.getDaemonPidPath(projectRoot);
  if (!existsSync(pidPath)) {
    return null;
  }
  const content = await readFile(pidPath, "utf-8");
  return parseInt(content.trim(), 10);
}

export async function writeDaemonPid(projectRoot: string, pid: number): Promise<void> {
  await ensureDir(dirname(paths.getDaemonPidPath(projectRoot)));
  await writeFile(paths.getDaemonPidPath(projectRoot), String(pid), "utf-8");
}

export async function removeDaemonPid(projectRoot: string): Promise<void> {
  const pidPath = paths.getDaemonPidPath(projectRoot);
  if (existsSync(pidPath)) {
    const { unlink } = await import("node:fs/promises");
    await unlink(pidPath);
  }
}

// ============================================================================
// Initialization
// ============================================================================

export async function initIncDir(projectRoot: string): Promise<void> {
  await ensureDir(paths.getIncDir(projectRoot));
  await ensureDir(paths.getEpicsDir(projectRoot));
}
