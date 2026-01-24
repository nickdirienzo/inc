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
 * Create a workspace for a task
 *
 * This creates a new jj workspace at .strike/workspaces/<mission-id>/task-<task-id>/
 * The workspace starts from the current main branch.
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
  // -r @ means start from the current working copy commit
  const result = await runJj(
    ["workspace", "add", "--name", workspaceName, workspacePath],
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
