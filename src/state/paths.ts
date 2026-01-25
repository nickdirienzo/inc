/**
 * Path utilities for Inc state management
 */

import { join } from "node:path";

const INC_DIR = ".inc";
const MISSIONS_DIR = "missions";

export function getIncDir(projectRoot: string): string {
  return join(projectRoot, INC_DIR);
}

export function getMissionsDir(projectRoot: string): string {
  return join(getIncDir(projectRoot), MISSIONS_DIR);
}

export function getMissionDir(projectRoot: string, missionId: string): string {
  return join(getMissionsDir(projectRoot), missionId);
}

export function getMissionJsonPath(projectRoot: string, missionId: string): string {
  return join(getMissionDir(projectRoot, missionId), "mission.json");
}

export function getSpecPath(projectRoot: string, missionId: string): string {
  return join(getMissionDir(projectRoot, missionId), "spec.md");
}

export function getArchitecturePath(projectRoot: string, missionId: string): string {
  return join(getMissionDir(projectRoot, missionId), "architecture.md");
}

export function getTasksPath(projectRoot: string, missionId: string): string {
  return join(getMissionDir(projectRoot, missionId), "tasks.json");
}

export function getDecisionsPath(projectRoot: string, missionId: string): string {
  return join(getMissionDir(projectRoot, missionId), "decisions.md");
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

export function getChatsDir(projectRoot: string, missionId: string): string {
  return join(getMissionDir(projectRoot, missionId), "chats");
}
