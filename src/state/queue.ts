import { mkdir, writeFile, readFile, unlink, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getProjectIncDir } from "./paths.js";

const REQUESTS_DIR = "requests";
const POLL_INTERVAL = 100;
const REQUEST_TIMEOUT = 30_000;

export interface TaskStatusRequest {
  type: "task-status";
  epicId: string;
  taskId: number;
  status: "not_started" | "in_progress" | "done" | "blocked" | "failed";
  feedback?: string;
  assignee?: string | null;
}

export interface AttentionRequest {
  type: "attention";
  epicId: string;
  from: "pm" | "tech_lead" | "coder";
  to: "em" | "pm" | "tech_lead" | "user";
  question: string;
}

export type QueueRequest = TaskStatusRequest | AttentionRequest;

export interface QueueResponse {
  success: boolean;
  error?: string;
}

function getRequestsDir(projectRoot: string): string {
  return join(getProjectIncDir(projectRoot), REQUESTS_DIR);
}

function getRequestPath(projectRoot: string, requestId: string): string {
  return join(getRequestsDir(projectRoot), `${requestId}.json`);
}

function getResponsePath(projectRoot: string, requestId: string): string {
  return join(getRequestsDir(projectRoot), `${requestId}.response.json`);
}

export async function submitRequest(projectRoot: string, request: QueueRequest): Promise<QueueResponse> {
  const requestsDir = getRequestsDir(projectRoot);
  if (!existsSync(requestsDir)) {
    await mkdir(requestsDir, { recursive: true });
  }

  const requestId = randomBytes(8).toString("hex");
  const requestPath = getRequestPath(projectRoot, requestId);
  const responsePath = getResponsePath(projectRoot, requestId);

  await writeFile(requestPath, JSON.stringify(request));

  const startTime = Date.now();
  while (Date.now() - startTime < REQUEST_TIMEOUT) {
    if (existsSync(responsePath)) {
      const content = await readFile(responsePath, "utf-8");
      await unlink(responsePath);
      return JSON.parse(content) as QueueResponse;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  try {
    await unlink(requestPath);
  } catch {}

  return { success: false, error: "Request timeout" };
}

export async function getPendingRequests(projectRoot: string): Promise<{ id: string; request: QueueRequest }[]> {
  const requestsDir = getRequestsDir(projectRoot);
  if (!existsSync(requestsDir)) {
    return [];
  }

  const files = await readdir(requestsDir);
  const requests: { id: string; request: QueueRequest }[] = [];

  for (const file of files) {
    if (file.endsWith(".json") && !file.endsWith(".response.json")) {
      const id = file.replace(".json", "");
      const content = await readFile(join(requestsDir, file), "utf-8");
      requests.push({ id, request: JSON.parse(content) as QueueRequest });
    }
  }

  return requests;
}

export async function completeRequest(projectRoot: string, requestId: string, response: QueueResponse): Promise<void> {
  const requestPath = getRequestPath(projectRoot, requestId);
  const responsePath = getResponsePath(projectRoot, requestId);

  await writeFile(responsePath, JSON.stringify(response));

  try {
    await unlink(requestPath);
  } catch {}
}

export async function initRequestsDir(projectRoot: string): Promise<void> {
  const requestsDir = getRequestsDir(projectRoot);
  if (!existsSync(requestsDir)) {
    await mkdir(requestsDir, { recursive: true });
  }
}
