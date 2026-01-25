/**
 * State schema for Inc epics and tasks
 */

import { Query } from "@anthropic-ai/claude-agent-sdk";

export type EpicStatus =
  | "new"
  | "spec_in_progress"
  | "spec_complete"
  | "plan_in_progress"
  | "plan_complete"
  | "coding"
  | "review"
  | "done"
  | "abandoned";

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "done"
  | "blocked"
  | "failed";

export interface NeedsAttention {
  from: "pm" | "tech_lead" | "coder";
  question: string;
}

export interface Epic {
  id: string;
  shortId: string;
  description: string;
  status: EpicStatus;
  created_at: string;
  updated_at: string;
  needs_attention?: NeedsAttention;
  pr_number?: number;
  workspace_path?: string;
}

export interface Task {
  id: number;
  name: string;
  description: string;
  status: TaskStatus;
  blocked_by: number[];
  assignee: string | null;
  jj_commit: string | null;
  feedback?: string;
}

export interface TasksFile {
  tasks: Task[];
}

export interface Decision {
  timestamp: string;
  role: "pm" | "tech_lead" | "coder";
  decision: string;
  reasoning: string;
}

/**
 * Structure of the .inc directory for an epic
 */
export interface EpicDirectory {
  epicJson: Epic;
  specMd?: string;
  architectureMd?: string;
  tasksJson?: TasksFile;
  decisionsMd?: string;
}

/**
 * Daemon state persisted to disk
 */
export interface DaemonState {
  pid: number;
  started_at: string;
  active_agents: ActiveAgent[];
}

export interface ActiveAgent {
  epic_id: string;
  role: "pm" | "tech_lead" | "coder";
  task_id?: number;
  session_id: string;
  started_at: string;
  query_handle?: Query;
}
