/**
 * Inc Daemon
 *
 * Watches for state changes and spawns agents as needed.
 */

import { watch } from "chokidar";
import { query, type HookCallback } from "@anthropic-ai/claude-agent-sdk";
import {
  getEpicsDir,
  getEpicDir,
  listEpics,
  readEpic,
  writeEpic,
  readTasks,
  writeTasks,
  writeDaemonState,
  getPendingRequests,
  completeRequest,
  initRequestsDir,
  type Epic,
  type Task,
  type DaemonState,
  type ActiveAgent,
  type QueueRequest,
} from "../state/index.js";
import { getPmPrompt, getTechLeadPrompt, getCoderPrompt } from "../prompts/index.js";
import {
  createTaskWorkspace,
  createEpicWorkspace,
  squashTaskIntoEpic,
  describeCommit,
  isJjRepo,
  checkPrStatus,
  updateDefaultWorkspace,
  cleanupEpicWorkspaces,
} from "../jj/index.js";
import { createConflictResolutionEpic } from "../state/index.js";
import { AgentLogger } from "../agents/logging.js";

const projectRoot = process.argv[2] || process.cwd();

const EM_INTERVAL = 30_000;

function createWriteRestrictionHook(allowedDirs: string[]): HookCallback {
  return async (input) => {
    const hookInput = input as { tool_input?: { file_path?: string }; tool_name?: string };
    const filePath = hookInput.tool_input?.file_path;
    log(`[WriteRestriction] Tool: ${hookInput.tool_name}, Path: ${filePath}, Allowed: ${allowedDirs.join(', ')}`);
    if (filePath) {
      const isAllowed = allowedDirs.some(dir => filePath.startsWith(dir));
      if (!isAllowed) {
        log(`[WriteRestriction] DENIED: ${filePath}`);
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse' as const,
            permissionDecision: 'deny' as const,
            permissionDecisionReason: `Write restricted to: ${allowedDirs.join(', ')}. Got: ${filePath}`
          }
        };
      }
    }
    return { continue: true };
  };
}
const STUCK_AGENT_THRESHOLD = 10 * 60 * 1000; // 10 minutes

// Track active agents
const activeAgents = new Map<string, ActiveAgent>();

// Task write queue for serialization
type TaskWriteOp = {
  epicId: string;
  taskId: number;
  update: Partial<Pick<Task, "status" | "feedback" | "assignee" | "jj_commit">>;
  resolve: (success: boolean) => void;
};
const taskWriteQueue: TaskWriteOp[] = [];
let taskWriteProcessing = false;

async function processTaskWriteQueue(): Promise<void> {
  if (taskWriteProcessing) return;
  taskWriteProcessing = true;

  while (taskWriteQueue.length > 0) {
    const op = taskWriteQueue.shift()!;
    try {
      const tasksFile = await readTasks(projectRoot, op.epicId);
      if (!tasksFile) {
        log(`[TaskQueue] No tasks file for ${op.epicId}`);
        op.resolve(false);
        continue;
      }

      const task = tasksFile.tasks.find((t) => t.id === op.taskId);
      if (!task) {
        log(`[TaskQueue] Task ${op.taskId} not found in ${op.epicId}`);
        op.resolve(false);
        continue;
      }

      if (op.update.status !== undefined) task.status = op.update.status;
      if (op.update.feedback !== undefined) task.feedback = op.update.feedback;
      if (op.update.assignee !== undefined) task.assignee = op.update.assignee;
      if (op.update.jj_commit !== undefined) task.jj_commit = op.update.jj_commit;

      await writeTasks(projectRoot, op.epicId, tasksFile);
      log(`[TaskQueue] Updated task ${op.taskId} in ${op.epicId}`);
      op.resolve(true);
    } catch (error) {
      log(`[TaskQueue] Error updating task ${op.taskId}: ${error}`);
      op.resolve(false);
    }
  }

  taskWriteProcessing = false;
}

function queueTaskUpdate(
  epicId: string,
  taskId: number,
  update: Partial<Pick<Task, "status" | "feedback" | "assignee" | "jj_commit">>
): Promise<boolean> {
  return new Promise((resolve) => {
    taskWriteQueue.push({ epicId, taskId, update, resolve });
    processTaskWriteQueue();
  });
}

function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function updateDaemonState(): Promise<void> {
  const state: DaemonState = {
    pid: process.pid,
    started_at: new Date().toISOString(),
    active_agents: Array.from(activeAgents.values()),
  };
  await writeDaemonState(projectRoot, state);
}

async function spawnPmAgent(epic: Epic): Promise<void> {
  const agentKey = `pm:${epic.id}`;

  if (activeAgents.has(agentKey)) {
    return; // Already running
  }

  log(`Spawning PM agent for: ${epic.id}`);

  const agent: ActiveAgent = {
    epic_id: epic.id,
    role: "pm",
    session_id: "",
    started_at: new Date().toISOString(),
  };
  activeAgents.set(agentKey, agent);
  await updateDaemonState();

  const logger = new AgentLogger(projectRoot, epic.id, "pm");

  try {
    const epicDir = getEpicDir(projectRoot, epic.id);
    const systemPrompt = getPmPrompt(epic.id, epic.description, epicDir);

    const queryHandle = query({
      prompt: "Read the epic and start working on the spec. Read the codebase to understand the context.",
      options: {
        cwd: projectRoot,
        systemPrompt,
        tools: ["Read", "Glob", "Grep", "Edit", "Write"],
        allowedTools: ["Read", "Glob", "Grep", "Edit", "Write"],
        permissionMode: "acceptEdits",
        additionalDirectories: [epicDir],
        maxTurns: 50,
        hooks: {
          PreToolUse: [{
            matcher: 'Edit|Write',
            hooks: [createWriteRestrictionHook([epicDir])]
          }]
        }
      },
    });
    agent.query_handle = queryHandle;

    for await (const message of queryHandle) {
      await logger.log(message);

      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        agent.session_id = message.session_id;
        await updateDaemonState();
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          log(`PM agent completed for ${epic.id}: ${message.result}`);
        } else {
          log(`PM agent error for ${epic.id}: ${message.errors?.join(", ") || message.subtype}`);
        }
      }
    }
  } catch (error) {
    log(`PM agent failed for ${epic.id}: ${error}`);
  } finally {
    await logger.close();
    activeAgents.delete(agentKey);
    await updateDaemonState();
  }
}

async function spawnTechLeadAgent(epic: Epic): Promise<void> {
  const agentKey = `tech_lead:${epic.id}`;

  if (activeAgents.has(agentKey)) {
    return;
  }

  log(`Spawning Tech Lead agent for: ${epic.id}`);

  // Tech Lead MUST work in epic workspace, never default
  if (!(await isJjRepo(projectRoot))) {
    log(`Cannot spawn TL for ${epic.id}: not a jj repo`);
    return;
  }

  const wsResult = await createEpicWorkspace(projectRoot, epic.id);
  if (!wsResult.success) {
    log(`Failed to create epic workspace for TL ${epic.id}: ${wsResult.error}`);
    epic.needs_attention = {
      from: "tech_lead",
      to: "user",
      question: `Failed to create epic workspace: ${wsResult.error}`,
    };
    await writeEpic(projectRoot, epic);
    return;
  }
  const workspacePath = wsResult.workspacePath;
  log(`TL using epic workspace at ${workspacePath}`);

  const agent: ActiveAgent = {
    epic_id: epic.id,
    role: "tech_lead",
    session_id: "",
    started_at: new Date().toISOString(),
  };
  activeAgents.set(agentKey, agent);
  await updateDaemonState();

  const logger = new AgentLogger(projectRoot, epic.id, "tech_lead");

  try {
    const epicDir = getEpicDir(projectRoot, epic.id);
    const systemPrompt = getTechLeadPrompt(epic.id, epic.description, epicDir);

    const queryHandle = query({
      prompt: "Read the spec and create the architecture plan and task breakdown.",
      options: {
        cwd: workspacePath,
        systemPrompt,
        tools: ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
        allowedTools: ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
        permissionMode: "acceptEdits",
        additionalDirectories: [epicDir],
        maxTurns: 50,
        hooks: {
          PreToolUse: [{
            matcher: 'Edit|Write',
            hooks: [createWriteRestrictionHook([workspacePath, epicDir])]
          }]
        }
      },
    });
    agent.query_handle = queryHandle;

    for await (const message of queryHandle) {
      await logger.log(message);

      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        agent.session_id = message.session_id;
        await updateDaemonState();
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          log(`Tech Lead agent completed for ${epic.id}: ${message.result}`);
        } else {
          log(`Tech Lead agent error for ${epic.id}: ${message.errors?.join(", ") || message.subtype}`);
        }
      }
    }
  } catch (error) {
    log(`Tech Lead agent failed for ${epic.id}: ${error}`);
  } finally {
    await logger.close();
    activeAgents.delete(agentKey);
    await updateDaemonState();
  }
}

async function spawnCoderAgent(epic: Epic, task: Task): Promise<void> {
  const agentKey = `coder:${epic.id}:${task.id}`;

  if (activeAgents.has(agentKey)) {
    return;
  }

  log(`Spawning Coder agent for task ${task.id} in ${epic.id}`);

  // Check if this is a jj repo - if so, create a workspace for the coder
  const useJjWorkspace = await isJjRepo(projectRoot);
  let workspacePath = projectRoot;

  if (useJjWorkspace) {
    log(`Creating jj workspace for task ${task.id}`);
    const wsResult = await createTaskWorkspace(projectRoot, epic.id, task.id);
    if (!wsResult.success) {
      log(`Failed to create workspace for task ${task.id}: ${wsResult.error}`);
      return;
    }
    workspacePath = wsResult.workspacePath;
    log(`Workspace created at ${workspacePath}`);
  }

  // Task status is updated by checkAndSpawnAgents before calling this function
  // to avoid race conditions with concurrent writes

  const agent: ActiveAgent = {
    epic_id: epic.id,
    role: "coder",
    task_id: task.id,
    session_id: "",
    started_at: new Date().toISOString(),
  };
  activeAgents.set(agentKey, agent);
  await updateDaemonState();

  const logger = new AgentLogger(projectRoot, epic.id, "coder", task.id);

  try {
    const epicDir = getEpicDir(projectRoot, epic.id);
    const systemPrompt = getCoderPrompt(
      epic.id,
      epic.description,
      task.id,
      task.name,
      task.description,
      epicDir
    );

    const queryHandle = query({
      prompt: "Complete your assigned task.",
      options: {
        cwd: workspacePath,
        systemPrompt,
        tools: ["Read", "Glob", "Grep", "Edit", "Write"],
        allowedTools: ["Read", "Glob", "Grep", "Edit", "Write"],
        permissionMode: "acceptEdits",
        additionalDirectories: [epicDir],
        maxTurns: 30,
        hooks: {
          PreToolUse: [{
            matcher: 'Edit|Write',
            hooks: [createWriteRestrictionHook([workspacePath])]
          }]
        }
      },
    });
    agent.query_handle = queryHandle;

    let result = "";
    for await (const message of queryHandle) {
      await logger.log(message);

      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        agent.session_id = message.session_id;
        await updateDaemonState();
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          result = message.result;
          log(`Coder agent completed task ${task.id} in ${epic.id}`);
        } else {
          log(`Coder agent error for task ${task.id} in ${epic.id}: ${message.errors?.join(", ") || message.subtype}`);
        }
      }
    }

    // If using jj, describe the commit with task info
    if (useJjWorkspace) {
      await describeCommit(
        workspacePath,
        `[inc] Task ${task.id}: ${task.name}\n\nEpic: ${epic.id}\n\n${result}`
      );
    }

    // Mark task as done (Tech Lead will review)
    const isBlocked = result.toLowerCase().includes("blocked:");
    const newStatus = isBlocked ? "blocked" : "done";
    await queueTaskUpdate(epic.id, task.id, {
      status: newStatus,
      feedback: isBlocked ? result : undefined,
    });

    // If task is done and we're using jj, squash task into epic workspace
    if (newStatus === "done" && useJjWorkspace) {
          log(`Squashing task ${task.id} into epic workspace for ${epic.id}`);
          const squashResult = await squashTaskIntoEpic(
            projectRoot,
            epic.id,
            task.id
          );
          if (!squashResult.success) {
            log(`Failed to squash task ${task.id}: ${squashResult.error}`);
            // Re-read epic to get latest state
            const currentEpic = await readEpic(projectRoot, epic.id);
            if (currentEpic) {
              currentEpic.needs_attention = {
                from: "tech_lead",
                to: "user",
                question: `Failed to squash task ${task.id} into epic workspace: ${squashResult.error}`,
              };
              await writeEpic(projectRoot, currentEpic);
            }
          } else {
            log(`Successfully squashed task ${task.id} into epic workspace`);
          }
    }
  } catch (error) {
    log(`Coder agent failed for task ${task.id} in ${epic.id}: ${error}`);

    // Mark task as failed
    await queueTaskUpdate(epic.id, task.id, {
      status: "failed",
      feedback: String(error),
    });
  } finally {
    await logger.close();
    activeAgents.delete(agentKey);
    await updateDaemonState();
  }
}

async function processQueueRequests(): Promise<void> {
  const requests = await getPendingRequests(projectRoot);

  for (const { id, request } of requests) {
    log(`[Queue] Processing request ${id}: ${request.type}`);

    try {
      switch (request.type) {
        case "task-status": {
          const success = await queueTaskUpdate(request.epicId, request.taskId, {
            status: request.status,
            feedback: request.feedback,
            assignee: request.assignee,
          });
          await completeRequest(projectRoot, id, { success });
          break;
        }
        case "attention": {
          const epic = await readEpic(projectRoot, request.epicId);
          if (!epic) {
            await completeRequest(projectRoot, id, { success: false, error: `Epic ${request.epicId} not found` });
            break;
          }

          log(`[Queue] Setting attention for ${request.epicId}: ${request.from} -> ${request.to}`);

          epic.needs_attention = {
            from: request.from,
            to: request.to,
            question: request.question,
            escalation_count: epic.needs_attention?.escalation_count || 0,
          };

          await writeEpic(projectRoot, epic);
          await completeRequest(projectRoot, id, { success: true });
          break;
        }
        case "clear-attention": {
          const epic = await readEpic(projectRoot, request.epicId);
          if (!epic) {
            await completeRequest(projectRoot, id, { success: false, error: `Epic ${request.epicId} not found` });
            break;
          }

          log(`[Queue] Clearing attention for ${request.epicId}`);
          delete epic.needs_attention;
          await writeEpic(projectRoot, epic);
          await completeRequest(projectRoot, id, { success: true });
          break;
        }
        case "set-status": {
          const epic = await readEpic(projectRoot, request.epicId);
          if (!epic) {
            await completeRequest(projectRoot, id, { success: false, error: `Epic ${request.epicId} not found` });
            break;
          }

          log(`[Queue] Setting status for ${request.epicId}: ${request.status}`);
          epic.status = request.status;
          await writeEpic(projectRoot, epic);
          await completeRequest(projectRoot, id, { success: true });
          break;
        }
        default:
          await completeRequest(projectRoot, id, { success: false, error: `Unknown request type: ${(request as QueueRequest).type}` });
      }
    } catch (error) {
      log(`[Queue] Error processing request ${id}: ${error}`);
      await completeRequest(projectRoot, id, { success: false, error: String(error) });
    }
  }
}

async function runEngineeringManager(): Promise<void> {
  log("[EM] Running engineering manager tick");

  await processQueueRequests();

  const now = Date.now();

  // Check for stuck agents and clean them up
  for (const [agentKey, agent] of activeAgents.entries()) {
    const agentAge = now - new Date(agent.started_at).getTime();
    if (agentAge > STUCK_AGENT_THRESHOLD) {
      log(`[EM] Agent ${agentKey} appears stuck (running for ${Math.round(agentAge / 60000)}m), removing from tracking`);
      if (agent.query_handle) {
        agent.query_handle.close();
      }
      activeAgents.delete(agentKey);

      // If it's a coder, reset the task to not_started so it can be picked up again
      if (agent.role === "coder" && agent.task_id) {
        log(`[EM] Resetting stuck task ${agent.task_id} to not_started`);
        await queueTaskUpdate(agent.epic_id, agent.task_id, {
          status: "not_started",
          assignee: null,
        });
      }
    }
  }

  // Check for in_progress tasks with no active agent
  const epicIds = await listEpics(projectRoot);
  for (const epicId of epicIds) {
    const tasksFile = await readTasks(projectRoot, epicId);
    if (!tasksFile) continue;

    for (const task of tasksFile.tasks) {
      if (task.status === "in_progress") {
        const agentKey = `coder:${epicId}:${task.id}`;
        if (!activeAgents.has(agentKey)) {
          log(`[EM] Task ${task.id} is in_progress but has no agent, resetting to not_started`);
          await queueTaskUpdate(epicId, task.id, {
            status: "not_started",
            assignee: null,
          });
        }
      }
    }
  }

  // Check for merged PRs and update default workspace
  for (const epicId of epicIds) {
    const epic = await readEpic(projectRoot, epicId);
    if (!epic) continue;

    // Check if this epic has a merged PR
    if (epic.status === "review" && epic.pr_number) {
      const prStatus = await checkPrStatus(epic.pr_number);

      if (prStatus.success && prStatus.status === "merged") {
        log(`[EM] PR #${epic.pr_number} for ${epicId} has been merged`);

        // Try to update default workspace
        const updateResult = await updateDefaultWorkspace(projectRoot);

        if (updateResult.success) {
          log(`[EM] Default workspace updated successfully after PR #${epic.pr_number}`);

          // Clean up epic workspaces
          await cleanupEpicWorkspaces(projectRoot, epicId);

          // Mark epic as done
          epic.status = "done";
          epic.merged_at = new Date().toISOString();
          await writeEpic(projectRoot, epic);

          log(`[EM] Epic ${epicId} marked as done and workspaces cleaned up`);
        } else {
          // Conflict detected - create conflict resolution epic
          log(`[EM] Conflict detected when updating default workspace: ${updateResult.error}`);

          const conflictEpic = await createConflictResolutionEpic(
            projectRoot,
            epic.pr_number,
            updateResult.error || "Unknown error"
          );

          log(`[EM] Created conflict resolution epic: ${conflictEpic.id}`);

          // Still mark original epic as done and clean up
          await cleanupEpicWorkspaces(projectRoot, epicId);
          epic.status = "done";
          epic.merged_at = new Date().toISOString();
          await writeEpic(projectRoot, epic);

          log(`[EM] Epic ${epicId} marked as done despite conflict`);
        }
      }
    }
  }

  await updateDaemonState();

  // Now spawn any needed agents
  await checkAndSpawnAgents();
}

async function checkAndSpawnAgents(): Promise<void> {
  const epicIds = await listEpics(projectRoot);

  for (const epicId of epicIds) {
    const epic = await readEpic(projectRoot, epicId);
    if (!epic) continue;

    // Handle attention routing
    if (epic.needs_attention) {
      const { to } = epic.needs_attention;

      if (to === "user") {
        // Skip this epic - user needs to respond (current behavior)
        continue;
      }

      // Route to agent
      log(`[EM] Routing attention from ${epic.needs_attention.from} to ${to} for epic ${epicId}: ${epic.needs_attention.question}`);

      switch (to) {
        case "em":
          // Handle EM attention requests (auto-approval logic)
          const question = epic.needs_attention.question.toLowerCase();
          if (question.includes("approve") && question.includes("spec") && epic.status === "spec_complete") {
            log(`[EM] Auto-approving spec for epic ${epicId}`);
            epic.status = "plan_in_progress";
            delete epic.needs_attention;
            await writeEpic(projectRoot, epic);
          } else {
            log(`[EM] Cannot handle question, escalating to user`);
            epic.needs_attention = {
              from: "em",
              to: "user",
              question: `EM cannot handle: ${epic.needs_attention.question}`,
              escalation_count: (epic.needs_attention.escalation_count || 0) + 1,
            };
            await writeEpic(projectRoot, epic);
          }
          break;

        case "pm":
          // Spawn PM agent to handle the attention request
          // PM will read needs_attention and respond
          spawnPmAgent(epic);
          break;

        case "tech_lead":
          // Spawn Tech Lead agent to handle the attention request
          spawnTechLeadAgent(epic);
          break;

        default:
          log(`[EM] Unknown attention target: ${to}`);
          epic.needs_attention = {
            from: "em",
            to: "user",
            question: `Unknown attention target ${to}: ${epic.needs_attention.question}`,
            escalation_count: (epic.needs_attention.escalation_count || 0) + 1,
          };
          await writeEpic(projectRoot, epic);
      }

      continue;
    }

    // Skip if abandoned
    if (epic.status === "abandoned") {
      continue;
    }

    switch (epic.status) {
      case "new":
      case "spec_in_progress":
        // PM should be working on spec
        // Update status if new
        if (epic.status === "new") {
          epic.status = "spec_in_progress";
          await writeEpic(projectRoot, epic);
        }
        spawnPmAgent(epic);
        break;

      case "plan_in_progress":
        // Tech Lead should be creating architecture/tasks
        spawnTechLeadAgent(epic);
        break;

      case "coding":
        // Create epic workspace if it doesn't exist
        const useJj = await isJjRepo(projectRoot);
        if (useJj) {
          const wsResult = await createEpicWorkspace(projectRoot, epicId);
          if (!wsResult.success) {
            log(`Failed to create epic workspace for ${epicId}: ${wsResult.error}`);
            epic.needs_attention = {
              from: "tech_lead",
              to: "user",
              question: `Failed to create epic workspace: ${wsResult.error}`,
            };
            await writeEpic(projectRoot, epic);
            continue;
          }

          // Only update epic.json if workspace path changed (avoid infinite loop)
          if (epic.workspace_path !== wsResult.workspacePath) {
            log(`Epic workspace ready at ${wsResult.workspacePath}`);
            epic.workspace_path = wsResult.workspacePath;
            await writeEpic(projectRoot, epic);
          }
        }

        // Find tasks that need coders
        const tasksFile = await readTasks(projectRoot, epicId);
        if (tasksFile) {
          const tasksToSpawn: { epic: Epic; task: typeof tasksFile.tasks[0] }[] = [];

          for (const task of tasksFile.tasks) {
            if (task.status === "not_started") {
              // Check if blocked by other tasks
              const blockers = task.blocked_by.filter((blockerId) => {
                const blocker = tasksFile.tasks.find((t) => t.id === blockerId);
                return blocker && blocker.status !== "done";
              });

              if (blockers.length === 0) {
                tasksToSpawn.push({ epic, task });
              }
            }
          }

          // Mark tasks as in_progress through queue, then spawn agents
          for (const { epic, task } of tasksToSpawn) {
            const assignee = `coder-${Date.now()}`;
            await queueTaskUpdate(epicId, task.id, {
              status: "in_progress",
              assignee,
            });
            spawnCoderAgent(epic, task);
          }

          // Check if all tasks are done
          const allDone = tasksFile.tasks.every((t) => t.status === "done");
          if (allDone && tasksFile.tasks.length > 0) {
            // Move to review
            epic.status = "review";
            await writeEpic(projectRoot, epic);
            log(`All tasks complete for ${epicId}, moving to review`);
          }
        }
        break;

      case "review":
        // Check if PR already exists
        if (!epic.pr_number) {
          // Spawn Tech Lead to create the PR
          spawnTechLeadAgent(epic);
        }
        break;
    }
  }
}

async function main(): Promise<void> {
  log(`Inc daemon starting in ${projectRoot}`);

  await initRequestsDir(projectRoot);

  // Initial EM run
  await runEngineeringManager();

  // Start EM interval
  const emInterval = setInterval(() => {
    runEngineeringManager().catch((err) => {
      log(`[EM] Error during tick: ${err}`);
    });
  }, EM_INTERVAL);

  // Watch for changes
  const epicsDir = getEpicsDir(projectRoot);
  const watcher = watch(epicsDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 2,
  });

  watcher.on("all", async (event, path) => {
    if (path.includes("/logs/")) {
      return;
    }
    log(`File ${event}: ${path}`);
    await checkAndSpawnAgents();
  });

  // Handle shutdown
  process.on("SIGTERM", () => {
    log("Received SIGTERM, shutting down");
    clearInterval(emInterval);
    watcher.close();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log("Received SIGINT, shutting down");
    clearInterval(emInterval);
    watcher.close();
    process.exit(0);
  });

  log("Daemon running, watching for changes...");
}

main().catch((error) => {
  log(`Fatal error: ${error}`);
  process.exit(1);
});
