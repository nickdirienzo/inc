/**
 * jj (Jujutsu) integration utilities
 *
 * Inc uses jj workspaces to give each Coder agent their own isolated
 * working directory. This prevents conflicts when multiple Coders work
 * in parallel on epics.
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

export function getWorkspacesDir(projectRoot: string, epicId: string): string {
  return join(projectRoot, ".inc", "workspaces", epicId);
}

export function getEpicWorkspacePath(
  projectRoot: string,
  epicId: string
): string {
  return getWorkspacesDir(projectRoot, epicId);
}

export function getTaskWorkspacePath(
  projectRoot: string,
  epicId: string,
  taskId: number
): string {
  return join(getWorkspacesDir(projectRoot, epicId), `task-${taskId}`);
}

export async function createEpicWorkspace(
  projectRoot: string,
  epicId: string
): Promise<{ success: boolean; workspacePath: string; error?: string }> {
  const workspacePath = getEpicWorkspacePath(projectRoot, epicId);
  const workspaceName = `inc-${epicId}`;

  const workspacesBaseDir = join(projectRoot, ".inc", "workspaces");
  await mkdir(workspacesBaseDir, { recursive: true });

  try {
    await access(workspacePath);
    return { success: true, workspacePath };
  } catch {
    // Doesn't exist, create it
  }

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

  const workspacesDir = getWorkspacesDir(projectRoot, epicId);
  await mkdir(workspacesDir, { recursive: true });

  try {
    await access(workspacePath);
    return { success: true, workspacePath };
  } catch {
    // Doesn't exist, create it
  }

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
  const taskWorkspace = `inc-${epicId}-task-${taskId}@`;
  const epicWorkspace = `inc-${epicId}@`;

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

  await runJj(["abandon", taskWorkspace], { cwd: projectRoot });
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

export async function squashEpicIntoMain(
  projectRoot: string,
  epicId: string
): Promise<{ success: boolean; error?: string }> {
  const tasksResult = await squashAllTasksIntoEpic(projectRoot, epicId);
  if (!tasksResult.success) {
    return tasksResult;
  }

  const epicWorkspace = `inc-${epicId}@`;

  const logResult = await runJj(
    ["log", "-r", epicWorkspace, "--no-graph", "-T", "description"],
    { cwd: projectRoot }
  );
  const epicDescription = logResult.success && logResult.stdout.trim()
    ? logResult.stdout.trim()
    : `feat: ${epicId}`;

  // Rebase epic onto @- (the parent of the default workspace's working copy)
  // This puts the epic changes at the tip of the current branch
  const rebaseResult = await runJj(
    ["rebase", "-r", epicWorkspace, "-d", "@-"],
    { cwd: projectRoot }
  );

  if (!rebaseResult.success) {
    return {
      success: false,
      error: `Failed to rebase epic onto HEAD: ${rebaseResult.stderr}`,
    };
  }

  const squashResult = await runJj(
    ["squash", "-r", epicWorkspace, "-m", epicDescription],
    { cwd: projectRoot }
  );

  if (!squashResult.success) {
    return {
      success: false,
      error: `Failed to squash epic: ${squashResult.stderr}`,
    };
  }

  await runJj(["abandon", epicWorkspace], { cwd: projectRoot });
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
