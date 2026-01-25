/**
 * TUI-specific type definitions for epic control interface
 */

import { Epic, NeedsAttention } from "../../state/index.js";

/**
 * Epic with additional project path information for TUI display
 */
export interface EpicWithProject extends Epic {
  projectPath: string;
}

/**
 * Agent message for conversation display in TUI
 */
export interface AgentMessage {
  role: "pm" | "tech_lead" | "coder" | "mission_control" | "user";
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
 * Complete TUI state for epic control interface
 */
export interface TUIState {
  epics: EpicWithProject[];
  needsAttention: Array<{
    epicId: string;
    attention: NeedsAttention;
  }>;
  contextFile: ContextFile | null;
}

/**
 * Proactive alert for notifying user of important events
 */
export interface ProactiveAlert {
  epicId: string;
  message: string;
  timestamp: string;
}
