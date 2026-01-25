/**
 * Path utilities for Inc state management
 *
 * All inc state is stored in ~/.inc/projects/<project-hash>/
 * This keeps the project directory clean and provides isolation.
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

const INC_HOME = join(homedir(), ".inc");
const PROJECTS_DIR = "projects";
const EPICS_DIR = "epics";
const WORKSPACES_DIR = "workspaces";

/**
 * Generate a stable hash for a project path.
 * This is used to create a unique directory for each project in ~/.inc/
 */
export function getProjectHash(projectRoot: string): string {
  return createHash("sha256").update(projectRoot).digest("hex").slice(0, 12);
}

/**
 * Get the root ~/.inc directory
 */
export function getIncHome(): string {
  return INC_HOME;
}

/**
 * Get the project-specific inc directory: ~/.inc/projects/<hash>/
 */
export function getProjectIncDir(projectRoot: string): string {
  const hash = getProjectHash(projectRoot);
  return join(INC_HOME, PROJECTS_DIR, hash);
}

/**
 * Get the epics directory: ~/.inc/projects/<hash>/epics/
 */
export function getEpicsDir(projectRoot: string): string {
  return join(getProjectIncDir(projectRoot), EPICS_DIR);
}

/**
 * Get a specific epic directory: ~/.inc/projects/<hash>/epics/<epicId>/
 */
export function getEpicDir(projectRoot: string, epicId: string): string {
  return join(getEpicsDir(projectRoot), epicId);
}

export function getEpicJsonPath(projectRoot: string, epicId: string): string {
  return join(getEpicDir(projectRoot, epicId), "epic.json");
}

export function getSpecPath(projectRoot: string, epicId: string): string {
  return join(getEpicDir(projectRoot, epicId), "spec.md");
}

export function getArchitecturePath(projectRoot: string, epicId: string): string {
  return join(getEpicDir(projectRoot, epicId), "architecture.md");
}

export function getTasksPath(projectRoot: string, epicId: string): string {
  return join(getEpicDir(projectRoot, epicId), "tasks.json");
}

export function getDecisionsPath(projectRoot: string, epicId: string): string {
  return join(getEpicDir(projectRoot, epicId), "decisions.md");
}

export function getDaemonPidPath(projectRoot: string): string {
  return join(getProjectIncDir(projectRoot), "daemon.pid");
}

export function getDaemonLogPath(projectRoot: string): string {
  return join(getProjectIncDir(projectRoot), "daemon.log");
}

export function getDaemonStatePath(projectRoot: string): string {
  return join(getProjectIncDir(projectRoot), "daemon.json");
}

export function getChatsDir(projectRoot: string, epicId: string): string {
  return join(getEpicDir(projectRoot, epicId), "chats");
}

export function getLogsDir(projectRoot: string, epicId: string): string {
  return join(getEpicDir(projectRoot, epicId), "logs");
}

/**
 * Get the workspaces directory: ~/.inc/projects/<hash>/workspaces/
 */
export function getWorkspacesDir(projectRoot: string): string {
  return join(getProjectIncDir(projectRoot), WORKSPACES_DIR);
}

/**
 * Get the epic workspace directory: ~/.inc/projects/<hash>/workspaces/<epicId>/
 */
export function getEpicWorkspacePath(projectRoot: string, epicId: string): string {
  return join(getWorkspacesDir(projectRoot), epicId);
}

/**
 * Get the task workspace directory: ~/.inc/projects/<hash>/workspaces/<epicId>/task-<taskId>/
 */
export function getTaskWorkspacePath(projectRoot: string, epicId: string, taskId: number): string {
  return join(getEpicWorkspacePath(projectRoot, epicId), `task-${taskId}`);
}

/**
 * Get project metadata path: ~/.inc/projects/<hash>/project.json
 * Stores info about the project like its path, name, etc.
 */
export function getProjectMetadataPath(projectRoot: string): string {
  return join(getProjectIncDir(projectRoot), "project.json");
}
