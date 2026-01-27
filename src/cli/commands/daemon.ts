import { Command } from "commander";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  readDaemonPid,
  writeDaemonPid,
  removeDaemonPid,
  getDaemonLogPath,
  requireProjectRoot,
} from "../../state/index.js";
import { existsSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const daemonCommand = new Command("daemon")
  .description("Manage the inc daemon");

daemonCommand
  .command("start")
  .description("Start the daemon")
  .action(async () => {
    const projectRoot = requireProjectRoot();

    // Check if already running
    const existingPid = await readDaemonPid(projectRoot);
    if (existingPid) {
      try {
        process.kill(existingPid, 0);
        console.log(`Daemon already running (PID ${existingPid})`);
        return;
      } catch {
        // Process not running, clean up stale PID
        await removeDaemonPid(projectRoot);
      }
    }

    // Ensure log directory exists
    const logPath = getDaemonLogPath(projectRoot);
    const logDir = dirname(logPath);
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true });
    }

    // Find the daemon script
    const daemonScript = join(__dirname, "..", "..", "daemon", "index.js");

    // Open log file and get file descriptor for detached spawn
    const logFd = openSync(logPath, "a");

    const child = spawn(process.execPath, [daemonScript, projectRoot], {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      cwd: projectRoot,
    });

    child.unref();

    if (child.pid) {
      await writeDaemonPid(projectRoot, child.pid);
      console.log(`Daemon started (PID ${child.pid})`);
      console.log(`Logs: ${logPath}`);
    } else {
      console.error("Failed to start daemon");
      process.exit(1);
    }
  });

daemonCommand
  .command("stop")
  .description("Stop the daemon")
  .action(async () => {
    const projectRoot = requireProjectRoot();

    const pid = await readDaemonPid(projectRoot);
    if (!pid) {
      console.log("Daemon is not running");
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
      await removeDaemonPid(projectRoot);
      console.log(`Daemon stopped (PID ${pid})`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        await removeDaemonPid(projectRoot);
        console.log("Daemon was not running (cleaned up stale PID)");
      } else {
        console.error("Failed to stop daemon:", error);
        process.exit(1);
      }
    }
  });

daemonCommand
  .command("status")
  .description("Check daemon status")
  .action(async () => {
    const projectRoot = requireProjectRoot();

    const pid = await readDaemonPid(projectRoot);
    if (!pid) {
      console.log("Daemon: not running");
      return;
    }

    try {
      process.kill(pid, 0);
      console.log(`Daemon: running (PID ${pid})`);
    } catch {
      console.log("Daemon: not running (stale PID file)");
    }
  });

daemonCommand
  .command("logs")
  .description("Tail daemon logs")
  .option("-f, --follow", "Follow log output", false)
  .action(async (options: { follow: boolean }) => {
    const projectRoot = requireProjectRoot();
    const logPath = getDaemonLogPath(projectRoot);

    if (!existsSync(logPath)) {
      console.log("No daemon logs found");
      return;
    }

    const tailArgs = options.follow ? ["-f", logPath] : ["-50", logPath];
    const tail = spawn("tail", tailArgs, { stdio: "inherit" });

    tail.on("error", (error) => {
      console.error("Failed to tail logs:", error);
      process.exit(1);
    });
  });
