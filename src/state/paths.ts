/**
 * Path utilities for Inc state management
 */

import { join } from "node:path";

const INC_DIR = ".inc";
const EPICS_DIR = "epics";

export function getIncDir(projectRoot: string): string {
  return join(projectRoot, INC_DIR);
}

export function getEpicsDir(projectRoot: string): string {
  return join(getIncDir(projectRoot), EPICS_DIR);
}

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
  return join(getIncDir(projectRoot), "daemon.pid");
}

export function getDaemonLogPath(projectRoot: string): string {
  return join(getIncDir(projectRoot), "daemon.log");
}

export function getDaemonStatePath(projectRoot: string): string {
  return join(getIncDir(projectRoot), "daemon.json");
}

export function getChatsDir(projectRoot: string, epicId: string): string {
  return join(getEpicDir(projectRoot, epicId), "chats");
}
