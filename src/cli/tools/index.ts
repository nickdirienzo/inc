/**
 * Inc CLI tools for use in chat
 *
 * These functions wrap CLI commands so agents can execute them
 * via natural language in the chat interface.
 */

import {
  createEpic,
  initIncDir,
  listEpics,
  readEpic,
  writeEpic,
  readTasks,
  readDaemonPid,
  type EpicStatus,
} from "../../state/index.js";
import { registerEpic, listRegisteredEpics, searchEpics } from "../../registry/index.js";

/**
 * List all known Inc projects/epics globally
 * Use this when the user is ambiguous about which project they mean
 */
export async function incListProjects(): Promise<string> {
  const allEpics = await listRegisteredEpics();

  if (allEpics.length === 0) {
    return "No Inc projects found. Create one with 'inc new \"your epic\"'";
  }

  const lines: string[] = ["Known Inc projects:\n"];

  // Group by project path
  const byProject = new Map<string, typeof allEpics>();
  for (const entry of allEpics) {
    const existing = byProject.get(entry.projectPath) || [];
    existing.push(entry);
    byProject.set(entry.projectPath, existing);
  }

  for (const [projectPath, epics] of byProject) {
    lines.push(`📁 ${projectPath}`);
    for (const e of epics) {
      const epic = await readEpic(e.projectPath, e.epicId);
      const status = epic?.status ?? "unknown";
      const attention = epic?.needs_attention ? " ⚠️" : "";
      // Truncate description to first line, max 60 chars
      const desc = e.description.split("\n")[0].slice(0, 60);
      lines.push(`   • ${e.epicId} (${status}${attention})`);
      lines.push(`     "${desc}${e.description.length > 60 ? "..." : ""}"`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Search for an epic by partial name or description
 */
export async function incSearchEpics(query: string): Promise<string> {
  const matches = await searchEpics(query);

  if (matches.length === 0) {
    return `No epics found matching "${query}"`;
  }

  if (matches.length === 1) {
    const e = matches[0];
    return `Found 1 match: ${e.epicId} in ${e.projectPath}`;
  }

  const lines: string[] = [`Found ${matches.length} epics matching "${query}":\n`];
  for (const e of matches.slice(0, 10)) {
    const epic = await readEpic(e.projectPath, e.epicId);
    const status = epic?.status ?? "unknown";
    lines.push(`  • ${e.epicId} (${status})`);
    lines.push(`    ${e.projectPath}`);
  }

  if (matches.length > 10) {
    lines.push(`\n  ... and ${matches.length - 10} more`);
  }

  return lines.join("\n");
}

/**
 * Create a new epic
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
  const epic = await createEpic(projectRoot, id, description);
  await registerEpic(epic.id, projectRoot, description);

  return `Created epic: ${epic.id}\nStatus: ${epic.status}\nPath: .inc/epics/${epic.id}/\n\nNext: run 'inc chat ${epic.id}' to start working with the PM`;
}

/**
 * Get status of epics
 */
export async function incStatus(
  projectRoot: string,
  epicId?: string,
  global?: boolean
): Promise<string> {
  const lines: string[] = [];

  // If global, show all registered epics
  if (global && !epicId) {
    const allEpics = await listRegisteredEpics();
    if (allEpics.length === 0) {
      return "No epics registered globally. Create epics with 'inc new \"your epic\"'";
    }

    lines.push("All Inc epics:\n");
    for (const entry of allEpics) {
      const epic = await readEpic(entry.projectPath, entry.epicId);
      const status = epic?.status ?? "unknown";
      const attention = epic?.needs_attention ? " ⚠️" : "";
      lines.push(`  ${entry.epicId}: ${status}${attention}`);
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

  if (epicId) {
    // Show specific epic
    let actualProjectRoot = projectRoot;
    let epic = await readEpic(projectRoot, epicId);

    if (!epic) {
      const matches = await searchEpics(epicId);
      if (matches.length === 1) {
        actualProjectRoot = matches[0].projectPath;
        epic = await readEpic(actualProjectRoot, matches[0].epicId);
      } else if (matches.length > 1) {
        return `Multiple epics match "${epicId}":\n${matches.slice(0, 5).map((e) => `  - ${e.epicId} (${e.projectPath})`).join("\n")}`;
      }
    }

    if (!epic) {
      return `Epic not found: ${epicId}`;
    }

    lines.push(`Epic: ${epic.id}`);
    lines.push(`  Description: ${epic.description}`);
    lines.push(`  Status: ${epic.status}`);
    lines.push(`  Created: ${epic.created_at}`);
    lines.push(`  Updated: ${epic.updated_at}`);

    if (epic.needs_attention) {
      lines.push(`  ⚠️  Needs attention from ${epic.needs_attention.from}: ${epic.needs_attention.question}`);
    }

    if (epic.pr_number) {
      lines.push(`  PR: #${epic.pr_number}`);
    }

    // Show tasks
    const tasksFile = await readTasks(actualProjectRoot, epicId);
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
    // Show all epics in current project
    const epicIds = await listEpics(projectRoot);

    if (epicIds.length === 0) {
      lines.push("No epics found. Run 'inc new \"your epic\"' to create one.");
    } else {
      lines.push("Epics:");
      for (const id of epicIds) {
        const epic = await readEpic(projectRoot, id);
        if (epic) {
          const attentionFlag = epic.needs_attention ? " ⚠️" : "";
          lines.push(`  ${epic.id}: ${epic.status}${attentionFlag}`);
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
  epicId: string
): Promise<string> {
  let actualProjectRoot = projectRoot;
  let epic = await readEpic(projectRoot, epicId);

  if (!epic) {
    const matches = await searchEpics(epicId);
    if (matches.length === 1) {
      actualProjectRoot = matches[0].projectPath;
      epic = await readEpic(actualProjectRoot, matches[0].epicId);
    }
  }

  if (!epic) {
    return `Epic not found: ${epicId}`;
  }

  let newStatus: EpicStatus;
  let message: string;

  switch (type) {
    case "spec":
      if (epic.status !== "spec_complete") {
        return `Cannot approve spec: epic status is ${epic.status}, expected spec_complete`;
      }
      newStatus = "plan_in_progress";
      message = "Spec approved. Tech Lead will now create the architecture plan.";
      break;

    case "plan":
      if (epic.status !== "plan_complete") {
        return `Cannot approve plan: epic status is ${epic.status}, expected plan_complete`;
      }
      newStatus = "coding";
      message = "Plan approved. Coders will now start working on tasks.";
      break;

    case "pr":
      if (epic.status !== "review") {
        return `Cannot approve PR: epic status is ${epic.status}, expected review`;
      }
      newStatus = "done";
      message = "PR approved. Epic is complete!";
      break;

    default:
      return `Unknown approval type: ${type}. Use: spec, plan, or pr`;
  }

  epic.status = newStatus;
  epic.needs_attention = undefined;
  await writeEpic(actualProjectRoot, epic);

  return `${message}\nEpic ${epicId} status: ${newStatus}`;
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
    description: "List all known Inc projects and epics globally. Use this when you need to see what projects exist or when the user is ambiguous about which project they mean.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "inc_search",
    description: "Search for an epic by partial name or description. Use this to disambiguate when the user mentions something that could match multiple epics.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query - partial epic ID or keywords from description",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "inc_new",
    description: "Create a new Inc epic. Use this when the user wants to create a new project, feature, or task to work on.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "Description of what the epic should accomplish. Can be multiline.",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "inc_status",
    description: "Show status of Inc epics. Use this to check on epic progress, see tasks, or list all epics.",
    input_schema: {
      type: "object" as const,
      properties: {
        epic_id: {
          type: "string",
          description: "Specific epic ID to show details for (optional)",
        },
        global: {
          type: "boolean",
          description: "If true, show all epics across all projects",
        },
      },
      required: [],
    },
  },
  {
    name: "inc_approve",
    description: "Approve a spec, plan, or PR for an epic. Use this when the user wants to move the epic forward to the next phase.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["spec", "plan", "pr"],
          description: "What to approve: 'spec' (approve product spec), 'plan' (approve architecture), or 'pr' (approve pull request)",
        },
        epic_id: {
          type: "string",
          description: "The epic ID to approve",
        },
      },
      required: ["type", "epic_id"],
    },
  },
];

/**
 * Execute an Inc tool by name
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
      return incSearchEpics(input.query as string);

    case "inc_new":
      return incNew(projectRoot, input.description as string);

    case "inc_status":
      return incStatus(
        projectRoot,
        input.epic_id as string | undefined,
        input.global as boolean | undefined
      );

    case "inc_approve":
      return incApprove(
        projectRoot,
        input.type as "spec" | "plan" | "pr",
        input.epic_id as string
      );

    default:
      return `Unknown Inc tool: ${toolName}`;
  }
}
