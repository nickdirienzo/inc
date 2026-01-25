/**
 * State I/O utilities for reading and writing Inc state files
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Mission, TasksFile, DaemonState } from "./schema.js";
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
// Mission operations
// ============================================================================

export async function readMission(projectRoot: string, missionId: string): Promise<Mission | null> {
  return readJson<Mission>(paths.getMissionJsonPath(projectRoot, missionId));
}

export async function writeMission(projectRoot: string, mission: Mission): Promise<void> {
  mission.updated_at = new Date().toISOString();
  await writeJson(paths.getMissionJsonPath(projectRoot, mission.id), mission);
}

export async function listMissions(projectRoot: string): Promise<string[]> {
  const missionsDir = paths.getMissionsDir(projectRoot);
  if (!existsSync(missionsDir)) {
    return [];
  }
  const entries = await readdir(missionsDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function createMission(
  projectRoot: string,
  id: string,
  description: string
): Promise<Mission> {
  const now = new Date().toISOString();
  const mission: Mission = {
    id,
    description,
    status: "new",
    created_at: now,
    updated_at: now,
  };
  await writeMission(projectRoot, mission);
  return mission;
}

// ============================================================================
// Spec operations
// ============================================================================

export async function readSpec(projectRoot: string, missionId: string): Promise<string | null> {
  return readText(paths.getSpecPath(projectRoot, missionId));
}

export async function writeSpec(projectRoot: string, missionId: string, content: string): Promise<void> {
  await writeText(paths.getSpecPath(projectRoot, missionId), content);
}

// ============================================================================
// Architecture operations
// ============================================================================

export async function readArchitecture(projectRoot: string, missionId: string): Promise<string | null> {
  return readText(paths.getArchitecturePath(projectRoot, missionId));
}

export async function writeArchitecture(projectRoot: string, missionId: string, content: string): Promise<void> {
  await writeText(paths.getArchitecturePath(projectRoot, missionId), content);
}

// ============================================================================
// Tasks operations
// ============================================================================

export async function readTasks(projectRoot: string, missionId: string): Promise<TasksFile | null> {
  const filePath = paths.getTasksPath(projectRoot, missionId);
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

export async function writeTasks(projectRoot: string, missionId: string, tasks: TasksFile): Promise<void> {
  await writeJson(paths.getTasksPath(projectRoot, missionId), tasks);
}

// ============================================================================
// Decisions operations
// ============================================================================

export async function readDecisions(projectRoot: string, missionId: string): Promise<string | null> {
  return readText(paths.getDecisionsPath(projectRoot, missionId));
}

export async function appendDecision(
  projectRoot: string,
  missionId: string,
  role: "pm" | "tech_lead" | "coder",
  decision: string,
  reasoning: string
): Promise<void> {
  const existing = (await readDecisions(projectRoot, missionId)) || "";
  const timestamp = new Date().toISOString();
  const roleTitle = role === "pm" ? "PM" : role === "tech_lead" ? "Tech Lead" : "Coder";

  const entry = `\n## ${roleTitle} Decision - ${timestamp}\n\n**Decision:** ${decision}\n\n**Reasoning:** ${reasoning}\n`;

  await writeText(paths.getDecisionsPath(projectRoot, missionId), existing + entry);
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
  await ensureDir(paths.getMissionsDir(projectRoot));
}
