/**
 * State I/O utilities for reading and writing Inc state files
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
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

export interface ResolvedEpic {
  epic: Epic;
  epicId: string;
}

export async function resolveEpicId(
  projectRoot: string,
  idOrShortId: string
): Promise<ResolvedEpic | null> {
  const epicIds = await listEpics(projectRoot);
  const matches: ResolvedEpic[] = [];

  for (const epicId of epicIds) {
    const epic = await readEpic(projectRoot, epicId);
    if (!epic) continue;

    if (epicId === idOrShortId) {
      return { epic, epicId };
    }
    if (epic.slug === idOrShortId) {
      return { epic, epicId };
    }
    if (epic.slug?.startsWith(idOrShortId)) {
      matches.push({ epic, epicId });
    }
    if (epicId.startsWith(idOrShortId)) {
      matches.push({ epic, epicId });
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  return null;
}

function generateShortId(): string {
  return randomBytes(4).toString("hex");
}

export async function createEpic(
  projectRoot: string,
  slug: string,
  description: string
): Promise<Epic> {
  const now = new Date().toISOString();
  const id = generateShortId();
  const epic: Epic = {
    id,
    slug,
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
  if (!content.trim()) {
    return null;
  }
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

export interface ProjectMetadata {
  projectRoot: string;
  projectName: string;
  createdAt: string;
}

export async function readProjectMetadata(projectRoot: string): Promise<ProjectMetadata | null> {
  return readJson<ProjectMetadata>(paths.getProjectMetadataPath(projectRoot));
}

export async function writeProjectMetadata(projectRoot: string, metadata: ProjectMetadata): Promise<void> {
  await writeJson(paths.getProjectMetadataPath(projectRoot), metadata);
}

export async function initIncDir(projectRoot: string): Promise<void> {
  await ensureDir(paths.getProjectIncDir(projectRoot));
  await ensureDir(paths.getEpicsDir(projectRoot));
  await ensureDir(paths.getWorkspacesDir(projectRoot));

  // Write project metadata if it doesn't exist
  const existingMetadata = await readProjectMetadata(projectRoot);
  if (!existingMetadata) {
    const projectName = projectRoot.split("/").pop() || "unknown";
    await writeProjectMetadata(projectRoot, {
      projectRoot,
      projectName,
      createdAt: new Date().toISOString(),
    });
  }
}

export async function createConflictResolutionEpic(
  projectRoot: string,
  prNumber: number,
  error: string
): Promise<Epic> {
  const epicId = `resolve-conflict-after-pr-${prNumber}`;
  const description = `Resolve merge conflict between main and default workspace after PR #${prNumber}`;

  // Create the epic
  const epic = await createEpic(projectRoot, epicId, description);

  // Write the spec with conflict details
  const specContent = `# Resolve Conflict After PR #${prNumber}

The default workspace failed to rebase onto main after PR #${prNumber} was merged.

Error:
\`\`\`
${error}
\`\`\`

Resolve the conflicts and get the default workspace back in sync with main.
`;
  await writeSpec(projectRoot, epicId, specContent);

  // Set status to plan_in_progress (skip PM, go to Tech Lead)
  epic.status = "plan_in_progress";
  await writeEpic(projectRoot, epic);

  return epic;
}
