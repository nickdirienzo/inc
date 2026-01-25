/**
 * Inc CLI tools for use in chat
 *
 * These functions wrap CLI commands so agents can execute them
 * via natural language in the chat interface.
 */

import {
  createMission,
  initIncDir,
  listMissions,
  readMission,
  writeMission,
  readTasks,
  readDaemonPid,
  type MissionStatus,
} from "../../state/index.js";
import { registerMission, listRegisteredMissions, searchMissions } from "../../registry/index.js";

/**
 * List all known Inc projects/missions globally
 * Use this when the user is ambiguous about which project they mean
 */
export async function incListProjects(): Promise<string> {
  const allMissions = await listRegisteredMissions();

  if (allMissions.length === 0) {
    return "No Inc projects found. Create one with 'inc new \"your mission\"'";
  }

  const lines: string[] = ["Known Inc projects:\n"];

  // Group by project path
  const byProject = new Map<string, typeof allMissions>();
  for (const entry of allMissions) {
    const existing = byProject.get(entry.projectPath) || [];
    existing.push(entry);
    byProject.set(entry.projectPath, existing);
  }

  for (const [projectPath, missions] of byProject) {
    lines.push(`📁 ${projectPath}`);
    for (const m of missions) {
      const mission = await readMission(m.projectPath, m.missionId);
      const status = mission?.status ?? "unknown";
      const attention = mission?.needs_attention ? " ⚠️" : "";
      // Truncate description to first line, max 60 chars
      const desc = m.description.split("\n")[0].slice(0, 60);
      lines.push(`   • ${m.missionId} (${status}${attention})`);
      lines.push(`     "${desc}${m.description.length > 60 ? "..." : ""}"`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Search for a mission by partial name or description
 */
export async function incSearchMissions(query: string): Promise<string> {
  const matches = await searchMissions(query);

  if (matches.length === 0) {
    return `No missions found matching "${query}"`;
  }

  if (matches.length === 1) {
    const m = matches[0];
    return `Found 1 match: ${m.missionId} in ${m.projectPath}`;
  }

  const lines: string[] = [`Found ${matches.length} missions matching "${query}":\n`];
  for (const m of matches.slice(0, 10)) {
    const mission = await readMission(m.projectPath, m.missionId);
    const status = mission?.status ?? "unknown";
    lines.push(`  • ${m.missionId} (${status})`);
    lines.push(`    ${m.projectPath}`);
  }

  if (matches.length > 10) {
    lines.push(`\n  ... and ${matches.length - 10} more`);
  }

  return lines.join("\n");
}

/**
 * Create a new mission
 */
export async function incNew(
  projectRoot: string,
  description: string
): Promise<string> {
  // Generate slug from first line
  const firstLine = description.split("\n")[0].trim();
  const id = firstLine
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  await initIncDir(projectRoot);
  const mission = await createMission(projectRoot, id, description);
  await registerMission(mission.id, projectRoot, description);

  return `Created mission: ${mission.id}\nStatus: ${mission.status}\nPath: .inc/missions/${mission.id}/\n\nNext: run 'inc chat ${mission.id}' to start working with the PM`;
}

/**
 * Get status of missions
 */
export async function incStatus(
  projectRoot: string,
  missionId?: string,
  global?: boolean
): Promise<string> {
  const lines: string[] = [];

  // If global, show all registered missions
  if (global && !missionId) {
    const allMissions = await listRegisteredMissions();
    if (allMissions.length === 0) {
      return "No missions registered globally. Create missions with 'inc new \"your mission\"'";
    }

    lines.push("All Inc missions:\n");
    for (const entry of allMissions) {
      const mission = await readMission(entry.projectPath, entry.missionId);
      const status = mission?.status ?? "unknown";
      const attention = mission?.needs_attention ? " ⚠️" : "";
      lines.push(`  ${entry.missionId}: ${status}${attention}`);
      lines.push(`    ${entry.description}`);
      lines.push(`    → ${entry.projectPath}`);
      lines.push("");
    }
    return lines.join("\n");
  }

  // Check daemon status
  const daemonPid = await readDaemonPid(projectRoot);
  if (daemonPid) {
    try {
      process.kill(daemonPid, 0);
      lines.push(`Daemon: running (PID ${daemonPid})`);
    } catch {
      lines.push("Daemon: not running (stale PID file)");
    }
  } else {
    lines.push("Daemon: not running");
  }
  lines.push("");

  if (missionId) {
    // Show specific mission
    let actualProjectRoot = projectRoot;
    let mission = await readMission(projectRoot, missionId);

    if (!mission) {
      const matches = await searchMissions(missionId);
      if (matches.length === 1) {
        actualProjectRoot = matches[0].projectPath;
        mission = await readMission(actualProjectRoot, matches[0].missionId);
      } else if (matches.length > 1) {
        return `Multiple missions match "${missionId}":\n${matches.slice(0, 5).map((m) => `  - ${m.missionId} (${m.projectPath})`).join("\n")}`;
      }
    }

    if (!mission) {
      return `Mission not found: ${missionId}`;
    }

    lines.push(`Mission: ${mission.id}`);
    lines.push(`  Description: ${mission.description}`);
    lines.push(`  Status: ${mission.status}`);
    lines.push(`  Created: ${mission.created_at}`);
    lines.push(`  Updated: ${mission.updated_at}`);

    if (mission.needs_attention) {
      lines.push(`  ⚠️  Needs attention from ${mission.needs_attention.from}: ${mission.needs_attention.question}`);
    }

    if (mission.pr_number) {
      lines.push(`  PR: #${mission.pr_number}`);
    }

    // Show tasks
    const tasksFile = await readTasks(actualProjectRoot, missionId);
    if (tasksFile && tasksFile.tasks.length > 0) {
      lines.push("");
      lines.push("Tasks:");
      for (const task of tasksFile.tasks) {
        const statusIcon = getTaskStatusIcon(task.status);
        lines.push(`  ${statusIcon} [${task.id}] ${task.name} (${task.status})`);
        if (task.assignee) {
          lines.push(`       Assignee: ${task.assignee}`);
        }
        if (task.feedback) {
          lines.push(`       Feedback: ${task.feedback}`);
        }
      }
    }
  } else {
    // Show all missions in current project
    const missionIds = await listMissions(projectRoot);

    if (missionIds.length === 0) {
      lines.push("No missions found. Run 'inc new \"your mission\"' to create one.");
    } else {
      lines.push("Missions:");
      for (const id of missionIds) {
        const mission = await readMission(projectRoot, id);
        if (mission) {
          const attentionFlag = mission.needs_attention ? " ⚠️" : "";
          lines.push(`  ${mission.id}: ${mission.status}${attentionFlag}`);
        }
      }
    }
  }

  return lines.join("\n");
}

/**
 * Approve spec, plan, or PR
 */
export async function incApprove(
  projectRoot: string,
  type: "spec" | "plan" | "pr",
  missionId: string
): Promise<string> {
  let actualProjectRoot = projectRoot;
  let mission = await readMission(projectRoot, missionId);

  if (!mission) {
    const matches = await searchMissions(missionId);
    if (matches.length === 1) {
      actualProjectRoot = matches[0].projectPath;
      mission = await readMission(actualProjectRoot, matches[0].missionId);
    }
  }

  if (!mission) {
    return `Mission not found: ${missionId}`;
  }

  let newStatus: MissionStatus;
  let message: string;

  switch (type) {
    case "spec":
      if (mission.status !== "spec_complete") {
        return `Cannot approve spec: mission status is ${mission.status}, expected spec_complete`;
      }
      newStatus = "plan_in_progress";
      message = "Spec approved. Tech Lead will now create the architecture plan.";
      break;

    case "plan":
      if (mission.status !== "plan_complete") {
        return `Cannot approve plan: mission status is ${mission.status}, expected plan_complete`;
      }
      newStatus = "coding";
      message = "Plan approved. Coders will now start working on tasks.";
      break;

    case "pr":
      if (mission.status !== "review") {
        return `Cannot approve PR: mission status is ${mission.status}, expected review`;
      }
      newStatus = "done";
      message = "PR approved. Mission is complete!";
      break;

    default:
      return `Unknown approval type: ${type}. Use: spec, plan, or pr`;
  }

  mission.status = newStatus;
  mission.needs_attention = undefined;
  await writeMission(actualProjectRoot, mission);

  return `${message}\nMission ${missionId} status: ${newStatus}`;
}

function getTaskStatusIcon(status: string): string {
  switch (status) {
    case "done":
      return "✓";
    case "in_progress":
      return "→";
    case "failed":
      return "✗";
    case "blocked":
      return "⊘";
    default:
      return "○";
  }
}

/**
 * Tool definitions for the agent SDK
 */
export const incToolDefinitions = [
  {
    name: "inc_list_projects",
    description: "List all known Inc projects and missions globally. Use this when you need to see what projects exist or when the user is ambiguous about which project they mean.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "inc_search",
    description: "Search for a mission by partial name or description. Use this to disambiguate when the user mentions something that could match multiple missions.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query - partial mission ID or keywords from description",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "inc_new",
    description: "Create a new Inc mission. Use this when the user wants to create a new project, feature, or task to work on.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "Description of what the mission should accomplish. Can be multiline.",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "inc_status",
    description: "Show status of Inc missions. Use this to check on mission progress, see tasks, or list all missions.",
    input_schema: {
      type: "object" as const,
      properties: {
        mission_id: {
          type: "string",
          description: "Specific mission ID to show details for (optional)",
        },
        global: {
          type: "boolean",
          description: "If true, show all missions across all projects",
        },
      },
      required: [],
    },
  },
  {
    name: "inc_approve",
    description: "Approve a spec, plan, or PR for a mission. Use this when the user wants to move the mission forward to the next phase.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["spec", "plan", "pr"],
          description: "What to approve: 'spec' (approve product spec), 'plan' (approve architecture), or 'pr' (approve pull request)",
        },
        mission_id: {
          type: "string",
          description: "The mission ID to approve",
        },
      },
      required: ["type", "mission_id"],
    },
  },
];

/**
 * Execute a Strike tool by name
 */
export async function executeIncTool(
  toolName: string,
  input: Record<string, unknown>,
  projectRoot: string
): Promise<string> {
  switch (toolName) {
    case "inc_list_projects":
      return incListProjects();

    case "inc_search":
      return incSearchMissions(input.query as string);

    case "inc_new":
      return incNew(projectRoot, input.description as string);

    case "inc_status":
      return incStatus(
        projectRoot,
        input.mission_id as string | undefined,
        input.global as boolean | undefined
      );

    case "inc_approve":
      return incApprove(
        projectRoot,
        input.type as "spec" | "plan" | "pr",
        input.mission_id as string
      );

    default:
      return `Unknown Inc tool: ${toolName}`;
  }
}
