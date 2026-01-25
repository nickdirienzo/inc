/**
 * Strike Daemon
 *
 * Watches for state changes and spawns agents as needed.
 */

import { watch } from "chokidar";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  getMissionsDir,
  getMissionDir,
  listMissions,
  readMission,
  writeMission,
  readTasks,
  writeTasks,
  writeDaemonState,
  type Mission,
  type Task,
  type DaemonState,
  type ActiveAgent,
} from "../state/index.js";
import { getPmPrompt, getTechLeadPrompt, getCoderPrompt } from "../prompts/index.js";
import {
  createTaskWorkspace,
  createMissionWorkspace,
  squashTaskIntoMission,
  describeCommit,
  isJjRepo,
} from "../jj/index.js";
import { AgentLogger } from "../agents/logging.js";

const projectRoot = process.argv[2] || process.cwd();

// Track active agents
const activeAgents = new Map<string, ActiveAgent>();

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

async function spawnPmAgent(mission: Mission): Promise<void> {
  const agentKey = `pm:${mission.id}`;

  if (activeAgents.has(agentKey)) {
    return; // Already running
  }

  log(`Spawning PM agent for: ${mission.id}`);

  const agent: ActiveAgent = {
    mission_id: mission.id,
    role: "pm",
    session_id: "",
    started_at: new Date().toISOString(),
  };
  activeAgents.set(agentKey, agent);
  await updateDaemonState();

  const logger = new AgentLogger(projectRoot, mission.id, "pm");

  try {
    const systemPrompt = getPmPrompt(mission.id, mission.description);
    const missionDir = getMissionDir(projectRoot, mission.id);

    for await (const message of query({
      prompt: "Read the mission and start working on the spec. Read the codebase to understand the context.",
      options: {
        cwd: projectRoot,
        systemPrompt,
        tools: ["Read", "Glob", "Grep", "Edit", "Write"],
        allowedTools: ["Read", "Glob", "Grep", "Edit", "Write"],
        permissionMode: "acceptEdits",
        additionalDirectories: [missionDir],
        maxTurns: 50,
      },
    })) {
      await logger.log(message);

      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        agent.session_id = message.session_id;
        await updateDaemonState();
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          log(`PM agent completed for ${mission.id}: ${message.result}`);
        } else {
          log(`PM agent error for ${mission.id}: ${message.errors?.join(", ") || message.subtype}`);
        }
      }
    }
  } catch (error) {
    log(`PM agent failed for ${mission.id}: ${error}`);
  } finally {
    await logger.close();
    activeAgents.delete(agentKey);
    await updateDaemonState();
  }
}

async function spawnTechLeadAgent(mission: Mission): Promise<void> {
  const agentKey = `tech_lead:${mission.id}`;

  if (activeAgents.has(agentKey)) {
    return;
  }

  log(`Spawning Tech Lead agent for: ${mission.id}`);

  const agent: ActiveAgent = {
    mission_id: mission.id,
    role: "tech_lead",
    session_id: "",
    started_at: new Date().toISOString(),
  };
  activeAgents.set(agentKey, agent);
  await updateDaemonState();

  const logger = new AgentLogger(projectRoot, mission.id, "tech_lead");

  try {
    const systemPrompt = getTechLeadPrompt(mission.id, mission.description);
    const missionDir = getMissionDir(projectRoot, mission.id);

    for await (const message of query({
      prompt: "Read the spec and create the architecture plan and task breakdown.",
      options: {
        cwd: projectRoot,
        systemPrompt,
        tools: ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
        allowedTools: ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
        permissionMode: "acceptEdits",
        additionalDirectories: [missionDir],
        maxTurns: 50,
      },
    })) {
      await logger.log(message);

      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        agent.session_id = message.session_id;
        await updateDaemonState();
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          log(`Tech Lead agent completed for ${mission.id}: ${message.result}`);
        } else {
          log(`Tech Lead agent error for ${mission.id}: ${message.errors?.join(", ") || message.subtype}`);
        }
      }
    }
  } catch (error) {
    log(`Tech Lead agent failed for ${mission.id}: ${error}`);
  } finally {
    await logger.close();
    activeAgents.delete(agentKey);
    await updateDaemonState();
  }
}

async function spawnCoderAgent(mission: Mission, task: Task): Promise<void> {
  const agentKey = `coder:${mission.id}:${task.id}`;

  if (activeAgents.has(agentKey)) {
    return;
  }

  log(`Spawning Coder agent for task ${task.id} in ${mission.id}`);

  // Check if this is a jj repo - if so, create a workspace for the coder
  const useJjWorkspace = await isJjRepo(projectRoot);
  let workspacePath = projectRoot;

  if (useJjWorkspace) {
    log(`Creating jj workspace for task ${task.id}`);
    const wsResult = await createTaskWorkspace(projectRoot, mission.id, task.id);
    if (!wsResult.success) {
      log(`Failed to create workspace for task ${task.id}: ${wsResult.error}`);
      return;
    }
    workspacePath = wsResult.workspacePath;
    log(`Workspace created at ${workspacePath}`);
  }

  // Mark task as in_progress
  const tasksFile = await readTasks(projectRoot, mission.id);
  if (tasksFile) {
    const t = tasksFile.tasks.find((t) => t.id === task.id);
    if (t) {
      t.status = "in_progress";
      t.assignee = `coder-${Date.now()}`;
      await writeTasks(projectRoot, mission.id, tasksFile);
    }
  }

  const agent: ActiveAgent = {
    mission_id: mission.id,
    role: "coder",
    task_id: task.id,
    session_id: "",
    started_at: new Date().toISOString(),
  };
  activeAgents.set(agentKey, agent);
  await updateDaemonState();

  const logger = new AgentLogger(projectRoot, mission.id, "coder", task.id);

  try {
    const systemPrompt = getCoderPrompt(
      mission.id,
      mission.description,
      task.id,
      task.name,
      task.description
    );
    const missionDir = getMissionDir(projectRoot, mission.id);

    let result = "";
    for await (const message of query({
      prompt: "Complete your assigned task.",
      options: {
        cwd: workspacePath,
        systemPrompt,
        tools: ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
        allowedTools: ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
        permissionMode: "acceptEdits",
        additionalDirectories: [missionDir],
        maxTurns: 30,
      },
    })) {
      await logger.log(message);

      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        agent.session_id = message.session_id;
        await updateDaemonState();
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          result = message.result;
          log(`Coder agent completed task ${task.id} in ${mission.id}`);
        } else {
          log(`Coder agent error for task ${task.id} in ${mission.id}: ${message.errors?.join(", ") || message.subtype}`);
        }
      }
    }

    // If using jj, describe the commit with task info
    if (useJjWorkspace) {
      await describeCommit(
        workspacePath,
        `[strike] Task ${task.id}: ${task.name}\n\nMission: ${mission.id}\n\n${result}`
      );
    }

    // Mark task as done (Tech Lead will review)
    const updatedTasks = await readTasks(projectRoot, mission.id);
    if (updatedTasks) {
      const t = updatedTasks.tasks.find((t) => t.id === task.id);
      if (t) {
        // Check if blocked
        if (result.toLowerCase().includes("blocked:")) {
          t.status = "blocked";
          t.feedback = result;
        } else {
          t.status = "done";
        }
        await writeTasks(projectRoot, mission.id, updatedTasks);

        // If task is done and we're using jj, squash task into mission workspace
        if (t.status === "done" && useJjWorkspace) {
          log(`Squashing task ${task.id} into mission workspace for ${mission.id}`);
          const squashResult = await squashTaskIntoMission(
            projectRoot,
            mission.id,
            task.id
          );
          if (!squashResult.success) {
            log(`Failed to squash task ${task.id}: ${squashResult.error}`);
            // Re-read mission to get latest state
            const currentMission = await readMission(projectRoot, mission.id);
            if (currentMission) {
              currentMission.needs_attention = {
                from: "tech_lead",
                question: `Failed to squash task ${task.id} into mission workspace: ${squashResult.error}`,
              };
              await writeMission(projectRoot, currentMission);
            }
          } else {
            log(`Successfully squashed task ${task.id} into mission workspace`);
          }
        }
      }
    }
  } catch (error) {
    log(`Coder agent failed for task ${task.id} in ${mission.id}: ${error}`);

    // Mark task as failed
    const failedTasks = await readTasks(projectRoot, mission.id);
    if (failedTasks) {
      const t = failedTasks.tasks.find((t) => t.id === task.id);
      if (t) {
        t.status = "failed";
        t.feedback = String(error);
        await writeTasks(projectRoot, mission.id, failedTasks);
      }
    }
  } finally {
    await logger.close();
    activeAgents.delete(agentKey);
    await updateDaemonState();
  }
}

async function checkAndSpawnAgents(): Promise<void> {
  const missionIds = await listMissions(projectRoot);

  for (const missionId of missionIds) {
    const mission = await readMission(projectRoot, missionId);
    if (!mission) continue;

    // Skip if needs user attention
    if (mission.needs_attention) {
      continue;
    }

    // Skip if abandoned
    if (mission.status === "abandoned") {
      continue;
    }

    switch (mission.status) {
      case "new":
      case "spec_in_progress":
        // PM should be working on spec
        // Update status if new
        if (mission.status === "new") {
          mission.status = "spec_in_progress";
          await writeMission(projectRoot, mission);
        }
        spawnPmAgent(mission);
        break;

      case "plan_in_progress":
        // Tech Lead should be creating architecture/tasks
        spawnTechLeadAgent(mission);
        break;

      case "coding":
        // Create mission workspace if it doesn't exist
        const useJj = await isJjRepo(projectRoot);
        if (useJj) {
          const wsResult = await createMissionWorkspace(projectRoot, missionId);
          if (!wsResult.success) {
            log(`Failed to create mission workspace for ${missionId}: ${wsResult.error}`);
            mission.needs_attention = {
              from: "tech_lead",
              question: `Failed to create mission workspace: ${wsResult.error}`,
            };
            await writeMission(projectRoot, mission);
            continue;
          }
          log(`Mission workspace ready at ${wsResult.workspacePath}`);

          // Store workspace path in mission.json
          mission.workspace_path = wsResult.workspacePath;
          await writeMission(projectRoot, mission);
        }

        // Find tasks that need coders
        const tasksFile = await readTasks(projectRoot, missionId);
        if (tasksFile) {
          for (const task of tasksFile.tasks) {
            if (task.status === "not_started") {
              // Check if blocked by other tasks
              const blockers = task.blocked_by.filter((blockerId) => {
                const blocker = tasksFile.tasks.find((t) => t.id === blockerId);
                return blocker && blocker.status !== "done";
              });

              if (blockers.length === 0) {
                spawnCoderAgent(mission, task);
              }
            }
          }

          // Check if all tasks are done
          const allDone = tasksFile.tasks.every((t) => t.status === "done");
          if (allDone && tasksFile.tasks.length > 0) {
            // Move to review
            mission.status = "review";
            await writeMission(projectRoot, mission);
            log(`All tasks complete for ${missionId}, moving to review`);
          }
        }
        break;
    }
  }
}

async function main(): Promise<void> {
  log(`Strike daemon starting in ${projectRoot}`);

  // Initial check
  await checkAndSpawnAgents();

  // Watch for changes
  const missionsDir = getMissionsDir(projectRoot);
  const watcher = watch(missionsDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 2,
  });

  watcher.on("all", async (event, path) => {
    log(`File ${event}: ${path}`);
    await checkAndSpawnAgents();
  });

  // Handle shutdown
  process.on("SIGTERM", () => {
    log("Received SIGTERM, shutting down");
    watcher.close();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log("Received SIGINT, shutting down");
    watcher.close();
    process.exit(0);
  });

  log("Daemon running, watching for changes...");
}

main().catch((error) => {
  log(`Fatal error: ${error}`);
  process.exit(1);
});
