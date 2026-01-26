/**
 * jj (Jujutsu) integration utilities
 *
 * Inc uses jj workspaces to give each Coder agent their own isolated
 * working directory. This prevents conflicts when multiple Coders work
 * in parallel on epics.
 *
 * Workspaces are created in ~/.inc/projects/<hash>/workspaces/ to keep
 * them outside the project directory tree. This prevents agents from
 * accidentally accessing project files via relative paths.
 */

import { spawn } from "node:child_process";
import { mkdir, rm, access } from "node:fs/promises";
import { dirname } from "node:path";
import {
  getWorkspacesDir as getWorkspacesDirFromPaths,
  getEpicWorkspacePath as getEpicWorkspacePathFromPaths,
  getTaskWorkspacePath as getTaskWorkspacePathFromPaths,
} from "../state/paths.js";

export interface JjResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

export async function runJj(
  args: string[],
  options: { cwd?: string; repo?: string } = {}
): Promise<JjResult> {
  const cmdArgs = [...args];

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

export async function getJjRoot(cwd: string): Promise<string | null> {
  const result = await runJj(["root"], { cwd });
  return result.success ? result.stdout : null;
}

export async function isJjRepo(cwd: string): Promise<boolean> {
  const root = await getJjRoot(cwd);
  return root !== null;
}

export function getWorkspacesDir(projectRoot: string): string {
  return getWorkspacesDirFromPaths(projectRoot);
}

export function getEpicWorkspacePath(
  projectRoot: string,
  epicId: string
): string {
  return getEpicWorkspacePathFromPaths(projectRoot, epicId);
}

export function getTaskWorkspacePath(
  projectRoot: string,
  epicId: string,
  taskId: number
): string {
  return getTaskWorkspacePathFromPaths(projectRoot, epicId, taskId);
}

async function isValidJjWorkspace(workspacePath: string, workspaceName: string, projectRoot: string): Promise<boolean> {
  const workspaces = await listWorkspaces(projectRoot);
  const exists = workspaces.some((ws) => ws.name === workspaceName);
  if (!exists) {
    return false;
  }
  try {
    await access(workspacePath);
    return true;
  } catch {
    return false;
  }
}

async function forgetWorkspaceIfExists(workspaceName: string, projectRoot: string): Promise<void> {
  const workspaces = await listWorkspaces(projectRoot);
  if (workspaces.some((ws) => ws.name === workspaceName)) {
    await runJj(["workspace", "forget", workspaceName], { cwd: projectRoot });
  }
}

export async function createEpicWorkspace(
  projectRoot: string,
  epicId: string
): Promise<{ success: boolean; workspacePath: string; error?: string }> {
  const workspacePath = getEpicWorkspacePath(projectRoot, epicId);
  const workspaceName = `inc-${epicId}`;

  await mkdir(dirname(workspacePath), { recursive: true });

  if (await isValidJjWorkspace(workspacePath, workspaceName, projectRoot)) {
    return { success: true, workspacePath };
  }

  await forgetWorkspaceIfExists(workspaceName, projectRoot);

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

export async function createTaskWorkspace(
  projectRoot: string,
  epicId: string,
  taskId: number
): Promise<{ success: boolean; workspacePath: string; error?: string }> {
  const workspacePath = getTaskWorkspacePath(projectRoot, epicId, taskId);
  const workspaceName = `inc-${epicId}-task-${taskId}`;

  await mkdir(dirname(workspacePath), { recursive: true });

  if (await isValidJjWorkspace(workspacePath, workspaceName, projectRoot)) {
    return { success: true, workspacePath };
  }

  await forgetWorkspaceIfExists(workspaceName, projectRoot);

  const result = await runJj(
    ["workspace", "add", "--name", workspaceName, "-r", `inc-${epicId}@`, workspacePath],
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

export async function deleteTaskWorkspace(
  projectRoot: string,
  epicId: string,
  taskId: number
): Promise<{ success: boolean; error?: string }> {
  const workspacePath = getTaskWorkspacePath(projectRoot, epicId, taskId);
  const workspaceName = `inc-${epicId}-task-${taskId}`;

  await runJj(["workspace", "forget", workspaceName], {
    cwd: projectRoot,
  });

  try {
    await rm(workspacePath, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }

  return { success: true };
}

export async function listWorkspaces(
  projectRoot: string
): Promise<{ name: string; path: string }[]> {
  const result = await runJj(["workspace", "list"], { cwd: projectRoot });

  if (!result.success) {
    return [];
  }

  const workspaces: { name: string; path: string }[] = [];
  for (const line of result.stdout.split("\n")) {
    const match = line.match(/^(.+?):\s+(.+)$/);
    if (match) {
      workspaces.push({ name: match[1], path: match[2] });
    }
  }

  return workspaces;
}

export async function createCommit(
  workspacePath: string,
  description: string
): Promise<{ success: boolean; commitId?: string; error?: string }> {
  const newResult = await runJj(["new", "-m", description], {
    cwd: workspacePath,
  });

  if (!newResult.success) {
    return { success: false, error: newResult.stderr };
  }

  const logResult = await runJj(
    ["log", "-r", "@-", "--no-graph", "-T", 'change_id.short() ++ "\n"'],
    { cwd: workspacePath }
  );

  return {
    success: true,
    commitId: logResult.success ? logResult.stdout.split("\n")[0] : undefined,
  };
}

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

export async function squashTaskIntoEpic(
  projectRoot: string,
  epicId: string,
  taskId: number
): Promise<{ success: boolean; error?: string }> {
  const taskWorkspaceName = `inc-${epicId}-task-${taskId}`;
  const taskWorkspace = `${taskWorkspaceName}@`;
  const epicWorkspace = `inc-${epicId}@`;

  const workspaces = await listWorkspaces(projectRoot);
  const taskWsExists = workspaces.some((ws) => ws.name === taskWorkspaceName);
  if (!taskWsExists) {
    return { success: true };
  }

  const checkResult = await runJj(
    ["log", "-r", taskWorkspace, "--no-graph", "-T", "change_id"],
    { cwd: projectRoot }
  );
  if (!checkResult.success || !checkResult.stdout.trim()) {
    await runJj(["workspace", "forget", taskWorkspaceName], { cwd: projectRoot });
    return {
      success: false,
      error: `Task workspace ${taskWorkspaceName} has no valid working-copy commit`,
    };
  }

  const rebaseResult = await runJj(
    ["rebase", "-r", taskWorkspace, "-d", epicWorkspace],
    { cwd: projectRoot }
  );

  if (!rebaseResult.success) {
    return {
      success: false,
      error: `Failed to rebase task onto epic: ${rebaseResult.stderr}`,
    };
  }

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

  await runJj(["workspace", "forget", taskWorkspaceName], { cwd: projectRoot });

  const taskWorkspacePath = getTaskWorkspacePath(projectRoot, epicId, taskId);
  try {
    await rm(taskWorkspacePath, { recursive: true, force: true });
  } catch {
  }

  return { success: true };
}

export async function squashAllTasksIntoEpic(
  projectRoot: string,
  epicId: string
): Promise<{ success: boolean; error?: string }> {
  const workspaces = await listWorkspaces(projectRoot);
  const taskPrefix = `inc-${epicId}-task-`;

  const taskWorkspaces = workspaces
    .filter((ws) => ws.name.startsWith(taskPrefix))
    .map((ws) => {
      const taskIdStr = ws.name.replace(taskPrefix, "");
      return { name: ws.name, taskId: parseInt(taskIdStr, 10) };
    })
    .filter((ws) => !isNaN(ws.taskId))
    .sort((a, b) => a.taskId - b.taskId);

  for (const taskWs of taskWorkspaces) {
    const result = await squashTaskIntoEpic(projectRoot, epicId, taskWs.taskId);
    if (!result.success) {
      return {
        success: false,
        error: `Failed to squash task ${taskWs.taskId}: ${result.error}`,
      };
    }
  }

  return { success: true };
}

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

export async function hasChanges(workspacePath: string): Promise<boolean> {
  const result = await runJj(["diff", "--stat"], { cwd: workspacePath });
  return result.success && result.stdout.length > 0;
}

export async function cleanupEpicWorkspaces(
  projectRoot: string,
  epicId: string
): Promise<{ success: boolean; error?: string }> {
  const workspaces = await listWorkspaces(projectRoot);

  const epicWorkspaceName = `inc-${epicId}`;
  const taskWorkspacePrefix = `inc-${epicId}-task-`;

  const epicWorkspaces = workspaces.filter(
    (ws) => ws.name === epicWorkspaceName || ws.name.startsWith(taskWorkspacePrefix)
  );

  for (const workspace of epicWorkspaces) {
    await runJj(["abandon", `${workspace.name}@`], { cwd: projectRoot });
    await runJj(["workspace", "forget", workspace.name], { cwd: projectRoot });
  }

  const epicWorkspacePath = getEpicWorkspacePath(projectRoot, epicId);
  try {
    await rm(epicWorkspacePath, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }

  return { success: true };
}

export async function getDefaultBranch(
  projectRoot: string
): Promise<{ success: boolean; branch?: string; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], {
      cwd: projectRoot,
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
      if (code === 0 && stdout.trim()) {
        // Parse output like "refs/remotes/origin/main" to extract "main"
        const match = stdout.trim().match(/refs\/remotes\/origin\/(.+)$/);
        if (match) {
          resolve({ success: true, branch: match[1] });
          return;
        }
      }

      // Fallback to 'main' if detection fails
      resolve({ success: true, branch: "main" });
    });

    proc.on("error", (err) => {
      // Fallback to 'main' on error
      resolve({ success: true, branch: "main" });
    });
  });
}

export async function createBranchFromEpic(
  projectRoot: string,
  epicId: string,
  branchName: string
): Promise<{ success: boolean; error?: string }> {
  const result = await runJj(
    ["git", "push", "-r", `inc-${epicId}@`, "--branch", branchName],
    { cwd: projectRoot }
  );

  return {
    success: result.success,
    error: result.success ? undefined : result.stderr || "Failed to create branch",
  };
}

export async function createPullRequest(
  projectRoot: string,
  epicId: string,
  branchName: string,
  baseBranch: string,
  title: string,
  body: string
): Promise<{ success: boolean; prNumber?: number; prUrl?: string; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn(
      "gh",
      ["pr", "create", "--head", branchName, "--base", baseBranch, "--title", title, "--body", body],
      {
        cwd: projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        // gh pr create outputs the PR URL on success
        // Format: https://github.com/owner/repo/pull/123
        const prUrl = stdout.trim();
        const match = prUrl.match(/\/pull\/(\d+)$/);

        if (match) {
          const prNumber = parseInt(match[1], 10);
          resolve({ success: true, prNumber, prUrl });
          return;
        }

        // PR created but couldn't parse URL
        resolve({
          success: true,
          prUrl,
          error: "PR created but could not parse PR number from URL"
        });
        return;
      }

      // Handle common error cases
      let errorMessage = stderr.trim() || "Failed to create pull request";

      if (stderr.includes("gh: command not found") || stderr.includes("not found")) {
        errorMessage = "gh CLI is not installed. Install from https://cli.github.com";
      } else if (stderr.includes("authentication") || stderr.includes("GITHUB_TOKEN")) {
        errorMessage = "GitHub authentication failed. Run 'gh auth login' to authenticate";
      } else if (stderr.includes("network") || stderr.includes("connect")) {
        errorMessage = "Network error: Could not connect to GitHub";
      }

      resolve({ success: false, error: errorMessage });
    });

    proc.on("error", (err) => {
      let errorMessage = err.message;

      if (err.message.includes("ENOENT") || err.message.includes("not found")) {
        errorMessage = "gh CLI is not installed. Install from https://cli.github.com";
      }

      resolve({ success: false, error: errorMessage });
    });
  });
}

export async function checkPrStatus(
  prNumber: number
): Promise<{ success: boolean; status?: 'open' | 'merged' | 'closed'; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn("gh", ["pr", "view", prNumber.toString(), "--json", "state,mergedAt"], {
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
      if (code !== 0) {
        // Check for common error cases
        if (stderr.includes("gh: not found") || stderr.includes("command not found")) {
          resolve({
            success: false,
            error: "gh CLI is not installed",
          });
          return;
        }

        if (stderr.includes("Could not resolve") || stderr.includes("no pull requests found")) {
          resolve({
            success: false,
            error: `PR #${prNumber} not found`,
          });
          return;
        }

        // Generic error
        resolve({
          success: false,
          error: stderr.trim() || `Failed to check PR status (exit code ${code})`,
        });
        return;
      }

      // Parse JSON output
      try {
        const data = JSON.parse(stdout.trim());
        const state = data.state as string;
        const mergedAt = data.mergedAt;

        // If mergedAt exists (non-null), the PR is merged
        if (mergedAt) {
          resolve({ success: true, status: "merged" });
          return;
        }

        // Otherwise, use the state value (should be "OPEN" or "CLOSED")
        const status = state.toLowerCase() as 'open' | 'closed';
        resolve({ success: true, status });
      } catch (err) {
        resolve({
          success: false,
          error: `Failed to parse PR data: ${err instanceof Error ? err.message : "unknown error"}`,
        });
      }
    });

    proc.on("error", (err) => {
      // This handles cases where spawn itself fails (e.g., command not found)
      if (err.message.includes("ENOENT")) {
        resolve({
          success: false,
          error: "gh CLI is not installed",
        });
      } else {
        resolve({
          success: false,
          error: `Failed to execute gh command: ${err.message}`,
        });
      }
    });
  });
}

export async function updateDefaultWorkspace(
  projectRoot: string
): Promise<{ success: boolean; error?: string }> {
  // Step 1: Fetch latest from remote
  const fetchResult = await runJj(["git", "fetch"], { cwd: projectRoot });

  if (!fetchResult.success) {
    return {
      success: false,
      error: `Failed to fetch from remote: ${fetchResult.stderr}`,
    };
  }

  // Step 2: Get the default branch name
  const branchResult = await getDefaultBranch(projectRoot);

  if (!branchResult.success || !branchResult.branch) {
    return {
      success: false,
      error: `Failed to determine default branch: ${branchResult.error || "Unknown error"}`,
    };
  }

  const defaultBranch = branchResult.branch;

  // Step 3: Rebase default workspace onto latest main
  const rebaseResult = await runJj(
    ["rebase", "-d", `${defaultBranch}@origin`],
    { cwd: projectRoot }
  );

  if (!rebaseResult.success) {
    return {
      success: false,
      error: `Failed to rebase onto ${defaultBranch}@origin: ${rebaseResult.stderr}`,
    };
  }

  return { success: true };
}

export async function rebaseEpicWorkspace(
  projectRoot: string,
  epicId: string
): Promise<{ success: boolean; error?: string }> {
  const workspaceName = `inc-${epicId}`;

  // Rebase the epic workspace onto main@origin
  const rebaseResult = await runJj(
    ["rebase", "-d", "main@origin", "-r", `${workspaceName}@`],
    { cwd: projectRoot }
  );

  if (!rebaseResult.success) {
    return {
      success: false,
      error: rebaseResult.stderr,
    };
  }

  return { success: true };
}
