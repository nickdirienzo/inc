/**
 * TUI-specific type definitions for mission control interface
 */

import { Mission, NeedsAttention } from "../../state/index.js";

/**
 * Mission with additional project path information for TUI display
 */
export interface MissionWithProject extends Mission {
  projectPath: string;
}

/**
 * Agent message for conversation display in TUI
 */
export interface AgentMessage {
  role: "pm" | "tech_lead" | "coder" | "user";
  content: string;
  timestamp: string;
}

/**
 * Context file for displaying file contents in TUI
 */
export interface ContextFile {
  path: string;
  content: string;
}

/**
 * Complete TUI state for mission control interface
 */
export interface TUIState {
  missions: MissionWithProject[];
  needsAttention: Array<{
    missionId: string;
    attention: NeedsAttention;
  }>;
  contextFile: ContextFile | null;
}

/**
 * Proactive alert for notifying user of important events
 */
export interface ProactiveAlert {
  missionId: string;
  message: string;
  timestamp: string;
}
