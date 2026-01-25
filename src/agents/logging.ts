import { appendFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { getLogsDir } from "../state/paths.js";

export interface AgentLogEntry {
  timestamp: string;
  type: string;
  subtype?: string;
  content?: unknown;
}

export class AgentLogger {
  private logPath: string;
  private buffer: AgentLogEntry[] = [];
  private flushPromise: Promise<void> | null = null;

  constructor(
    private projectRoot: string,
    private epicId: string,
    private role: string,
    private taskId?: number
  ) {
    const logsDir = getLogsDir(projectRoot, epicId);
    const filename = taskId !== undefined ? `${role}-task-${taskId}.jsonl` : `${role}.jsonl`;
    this.logPath = join(logsDir, filename);
  }

  async log(message: unknown): Promise<void> {
    const entry: AgentLogEntry = {
      timestamp: new Date().toISOString(),
      type: typeof message === "object" && message !== null && "type" in message
        ? String((message as Record<string, unknown>).type)
        : "unknown",
      subtype: typeof message === "object" && message !== null && "subtype" in message
        ? String((message as Record<string, unknown>).subtype)
        : undefined,
      content: message,
    };

    this.buffer.push(entry);

    if (!this.flushPromise) {
      this.flushPromise = this.flush();
    }
  }

  private async flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const entries = this.buffer;
    this.buffer = [];
    this.flushPromise = null;

    if (entries.length === 0) return;

    try {
      await mkdir(dirname(this.logPath), { recursive: true });

      const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      await appendFile(this.logPath, lines);
    } catch (error) {
      console.error(`Failed to write agent log: ${error}`);
    }
  }

  async close(): Promise<void> {
    if (this.flushPromise) {
      await this.flushPromise;
    }
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }
}
