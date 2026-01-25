/**
 * jj (Jujutsu) integration utilities
 *
 * Strike uses jj workspaces to give each Coder agent their own isolated
 * working directory. This prevents conflicts when multiple Coders work
 * in parallel.
 */

import { spawn } from "node:child_process";
import { mkdir, rm, access } from "node:fs/promises";
import { join } from "node:path";

export interface JjResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Run a jj command and return the result
 */
export async function runJj(
  args: string[],
  options: { cwd?: string; repo?: string } = {}
): Promise<JjResult> {
  const cmdArgs = [...args];

  // Add repo flag if specified
  if (options.repo) {
    cmdArgs.unshift("-R", options.repo);
  }

  return new Promise((resolve) => {
    const proc = spawn("jj", cmdArgs, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: code ?? 1,
      });
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        stdout: "",
        stderr: err.message,
        code: 1,
      });
    });
  });
}

/**
 * Get the root of the jj repository
 */
export async function getJjRoot(cwd: string): Promise<string | null> {
  const result = await runJj(["root"], { cwd });
  return result.success ? result.stdout : null;
}

/**
 * Check if we're in a jj repository
 */
export async function isJjRepo(cwd: string): Promise<boolean> {
  const root = await getJjRoot(cwd);
  return root !== null;
}

/**
 * Get the path where workspaces are stored for a mission
 * Workspaces live in .strike/workspaces/<mission-id>/
 */
export function getWorkspacesDir(projectRoot: string, missionId: string): string {
  return join(projectRoot, ".strike", "workspaces", missionId);
}

/**
 * Get the path for the mission workspace
 */
export function getMissionWorkspacePath(
  projectRoot: string,
  missionId: string
): string {
  return getWorkspacesDir(projectRoot, missionId);
}

/**
 * Get the path for a specific task's workspace
 */
export function getTaskWorkspacePath(
  projectRoot: string,
  missionId: string,
  taskId: number
): string {
  return join(getWorkspacesDir(projectRoot, missionId), `task-${taskId}`);
}

/**
 * Create a workspace for a mission
 *
 * This creates a new jj workspace at .strike/workspaces/<mission-id>/
 * The workspace starts from the main branch.
 */
export async function createMissionWorkspace(
  projectRoot: string,
  missionId: string
): Promise<{ success: boolean; workspacePath: string; error?: string }> {
  const workspacePath = getMissionWorkspacePath(projectRoot, missionId);
  const workspaceName = `strike-${missionId}`;

  // Ensure the parent .strike/workspaces/ directory exists
  const workspacesBaseDir = join(projectRoot, ".strike", "workspaces");
  await mkdir(workspacesBaseDir, { recursive: true });

  // Check if workspace already exists
  try {
    await access(workspacePath);
    // Already exists, that's fine
    return { success: true, workspacePath };
  } catch {
    // Doesn't exist, create it
  }

  // Create the workspace
  // -r main means start from the main branch
  const result = await runJj(
    ["workspace", "add", "--name", workspaceName, "-r", "main", workspacePath],
    { cwd: projectRoot }
  );

  if (!result.success) {
    return {
      success: false,
      workspacePath,
      error: result.stderr || "Failed to create workspace",
    };
  }

  return { success: true, workspacePath };
}

/**
 * Create a workspace for a task
 *
 * This creates a new jj workspace at .strike/workspaces/<mission-id>/task-<task-id>/
 * The workspace branches from the mission workspace (strike-<mission-id>@).
 */
export async function createTaskWorkspace(
  projectRoot: string,
  missionId: string,
  taskId: number
): Promise<{ success: boolean; workspacePath: string; error?: string }> {
  const workspacePath = getTaskWorkspacePath(projectRoot, missionId, taskId);
  const workspaceName = `strike-${missionId}-task-${taskId}`;

  // Ensure the workspaces directory exists
  const workspacesDir = getWorkspacesDir(projectRoot, missionId);
  await mkdir(workspacesDir, { recursive: true });

  // Check if workspace already exists
  try {
    await access(workspacePath);
    // Already exists, that's fine
    return { success: true, workspacePath };
  } catch {
    // Doesn't exist, create it
  }

  // Create the workspace
  // -r strike-<missionId>@ means branch from the mission workspace
  const result = await runJj(
    ["workspace", "add", "--name", workspaceName, "-r", `strike-${missionId}@`, workspacePath],
    { cwd: projectRoot }
  );

  if (!result.success) {
    return {
      success: false,
      workspacePath,
      error: result.stderr || "Failed to create workspace",
    };
  }

  return { success: true, workspacePath };
}

/**
 * Delete a task workspace
 */
export async function deleteTaskWorkspace(
  projectRoot: string,
  missionId: string,
  taskId: number
): Promise<{ success: boolean; error?: string }> {
  const workspacePath = getTaskWorkspacePath(projectRoot, missionId, taskId);
  const workspaceName = `strike-${missionId}-task-${taskId}`;

  // First, forget the workspace from jj
  await runJj(["workspace", "forget", workspaceName], {
    cwd: projectRoot,
  });

  // Even if forget fails (workspace might not exist), try to remove the directory
  try {
    await rm(workspacePath, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }

  return { success: true };
}

/**
 * List all workspaces in the repository
 */
export async function listWorkspaces(
  projectRoot: string
): Promise<{ name: string; path: string }[]> {
  const result = await runJj(["workspace", "list"], { cwd: projectRoot });

  if (!result.success) {
    return [];
  }

  // Parse output: "workspace-name: /path/to/workspace"
  const workspaces: { name: string; path: string }[] = [];
  for (const line of result.stdout.split("\n")) {
    const match = line.match(/^(.+?):\s+(.+)$/);
    if (match) {
      workspaces.push({ name: match[1], path: match[2] });
    }
  }

  return workspaces;
}

/**
 * Create a new commit in a workspace with a description
 */
export async function createCommit(
  workspacePath: string,
  description: string
): Promise<{ success: boolean; commitId?: string; error?: string }> {
  // First, create a new commit
  const newResult = await runJj(["new", "-m", description], {
    cwd: workspacePath,
  });

  if (!newResult.success) {
    return { success: false, error: newResult.stderr };
  }

  // Get the commit ID
  const logResult = await runJj(
    ["log", "-r", "@-", "--no-graph", "-T", 'change_id.short() ++ "\n"'],
    { cwd: workspacePath }
  );

  return {
    success: true,
    commitId: logResult.success ? logResult.stdout.split("\n")[0] : undefined,
  };
}

/**
 * Describe (update message of) the current commit
 */
export async function describeCommit(
  workspacePath: string,
  description: string
): Promise<{ success: boolean; error?: string }> {
  const result = await runJj(["describe", "-m", description], {
    cwd: workspacePath,
  });

  return {
    success: result.success,
    error: result.success ? undefined : result.stderr,
  };
}

/**
 * Squash a commit into its parent
 */
export async function squashCommit(
  projectRoot: string,
  revision: string
): Promise<{ success: boolean; error?: string }> {
  const result = await runJj(["squash", "-r", revision], { cwd: projectRoot });

  return {
    success: result.success,
    error: result.success ? undefined : result.stderr,
  };
}

/**
 * Squash a task workspace into the mission workspace
 *
 * Since tasks branch from the same parent as the mission (they're siblings),
 * we need to rebase the task onto the mission first, then squash.
 */
export async function squashTaskIntoMission(
  projectRoot: string,
  missionId: string,
  taskId: number
): Promise<{ success: boolean; error?: string }> {
  const taskWorkspace = `strike-${missionId}-task-${taskId}@`;
  const missionWorkspace = `strike-${missionId}@`;

  // Rebase the task onto the mission workspace
  const rebaseResult = await runJj(
    ["rebase", "-r", taskWorkspace, "-d", missionWorkspace],
    { cwd: projectRoot }
  );

  if (!rebaseResult.success) {
    return {
      success: false,
      error: `Failed to rebase task onto mission: ${rebaseResult.stderr}`,
    };
  }

  // Squash the task into mission, keeping the mission's description
  const squashResult = await runJj(
    ["squash", "-r", taskWorkspace, "-u"],
    { cwd: projectRoot }
  );

  if (!squashResult.success) {
    return {
      success: false,
      error: `Failed to squash task: ${squashResult.stderr}`,
    };
  }

  await runJj(["abandon", taskWorkspace], { cwd: projectRoot });
  return { success: true };
}

/**
 * Squash all remaining task workspaces into the mission workspace.
 */
export async function squashAllTasksIntoMission(
  projectRoot: string,
  missionId: string
): Promise<{ success: boolean; error?: string }> {
  const workspaces = await listWorkspaces(projectRoot);
  const taskPrefix = `strike-${missionId}-task-`;

  const taskWorkspaces = workspaces
    .filter((ws) => ws.name.startsWith(taskPrefix))
    .map((ws) => {
      const taskIdStr = ws.name.replace(taskPrefix, "");
      return { name: ws.name, taskId: parseInt(taskIdStr, 10) };
    })
    .filter((ws) => !isNaN(ws.taskId))
    .sort((a, b) => a.taskId - b.taskId);

  for (const taskWs of taskWorkspaces) {
    const result = await squashTaskIntoMission(projectRoot, missionId, taskWs.taskId);
    if (!result.success) {
      return {
        success: false,
        error: `Failed to squash task ${taskWs.taskId}: ${result.error}`,
      };
    }
  }

  return { success: true };
}

/**
 * Squash the mission workspace commit into the default workspace
 * This is the final squash when approving a PR - puts changes at HEAD
 */
export async function squashMissionIntoMain(
  projectRoot: string,
  missionId: string
): Promise<{ success: boolean; error?: string }> {
  // First, squash any remaining tasks into the mission
  const tasksResult = await squashAllTasksIntoMission(projectRoot, missionId);
  if (!tasksResult.success) {
    return tasksResult;
  }

  const missionWorkspace = `strike-${missionId}@`;

  // Get the mission's description to preserve it
  const logResult = await runJj(
    ["log", "-r", missionWorkspace, "--no-graph", "-T", "description"],
    { cwd: projectRoot }
  );
  const missionDescription = logResult.success && logResult.stdout.trim()
    ? logResult.stdout.trim()
    : `feat: ${missionId}`;

  // Rebase mission onto the default workspace's parent (@-)
  // This puts the mission changes at the tip of our working branch
  const rebaseResult = await runJj(
    ["rebase", "-r", missionWorkspace, "-d", "@-"],
    { cwd: projectRoot }
  );

  if (!rebaseResult.success) {
    return {
      success: false,
      error: `Failed to rebase mission onto HEAD: ${rebaseResult.stderr}`,
    };
  }

  // Squash mission into its parent with the mission description
  const squashResult = await runJj(
    ["squash", "-r", missionWorkspace, "-m", missionDescription],
    { cwd: projectRoot }
  );

  if (!squashResult.success) {
    return {
      success: false,
      error: `Failed to squash mission: ${squashResult.stderr}`,
    };
  }

  await runJj(["abandon", missionWorkspace], { cwd: projectRoot });
  return { success: true };
}

/**
 * Get the current commit info
 */
export async function getCurrentCommit(
  workspacePath: string
): Promise<{ changeId: string; commitId: string; description: string } | null> {
  const result = await runJj(
    [
      "log",
      "-r",
      "@",
      "--no-graph",
      "-T",
      'change_id.short() ++ "\\n" ++ commit_id.short() ++ "\\n" ++ description',
    ],
    { cwd: workspacePath }
  );

  if (!result.success) {
    return null;
  }

  const lines = result.stdout.split("\n");
  if (lines.length < 2) {
    return null;
  }

  return {
    changeId: lines[0],
    commitId: lines[1],
    description: lines.slice(2).join("\n"),
  };
}

/**
 * Check if there are uncommitted changes in a workspace
 */
export async function hasChanges(workspacePath: string): Promise<boolean> {
  const result = await runJj(["diff", "--stat"], { cwd: workspacePath });
  return result.success && result.stdout.length > 0;
}

/**
 * Clean up all workspaces for a mission
 *
 * This forgets the mission workspace and all task workspaces, then deletes
 * the mission workspace directory. Used during PR approval cleanup.
 */
export async function cleanupMissionWorkspaces(
  projectRoot: string,
  missionId: string
): Promise<{ success: boolean; error?: string }> {
  // Get list of all workspaces
  const workspaces = await listWorkspaces(projectRoot);

  // Filter for workspaces matching this mission
  const missionWorkspaceName = `strike-${missionId}`;
  const taskWorkspacePrefix = `strike-${missionId}-task-`;

  const missionWorkspaces = workspaces.filter(
    (ws) => ws.name === missionWorkspaceName || ws.name.startsWith(taskWorkspacePrefix)
  );

  // Abandon commits and forget each workspace (be permissive - don't fail if some operations fail)
  for (const workspace of missionWorkspaces) {
    await runJj(["abandon", `${workspace.name}@`], { cwd: projectRoot });
    await runJj(["workspace", "forget", workspace.name], { cwd: projectRoot });
  }

  // Delete the mission workspace directory
  const missionWorkspacePath = getMissionWorkspacePath(projectRoot, missionId);
  try {
    await rm(missionWorkspacePath, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }

  return { success: true };
}
