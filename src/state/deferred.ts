/**
 * Deferred item operations
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { DeferredItem } from "./schema.js";
import * as paths from "./paths.js";

/**
 * Ensure a directory exists, creating it if necessary
 */
async function ensureDir(dirPath: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Read and parse a JSON file
 */
async function readJson<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null;
  }
  const content = await readFile(filePath, "utf-8");
  if (!content.trim()) {
    return null;
  }
  return JSON.parse(content) as T;
}

/**
 * Write an object as JSON to a file
 */
async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Generate a short random ID for deferred items
 */
function generateShortId(): string {
  return randomBytes(4).toString("hex");
}

/**
 * Create a new deferred item
 */
export async function createDeferredItem(
  projectRoot: string,
  params: {
    title: string;
    description: string;
    rationale: string;
    source_epic_id: string;
    created_by: "user" | "pm" | "tech_lead" | "em";
  }
): Promise<DeferredItem> {
  const id = generateShortId();
  const now = new Date().toISOString();

  const item: DeferredItem = {
    id,
    title: params.title,
    description: params.description,
    rationale: params.rationale,
    source_epic_id: params.source_epic_id,
    created_at: now,
    created_by: params.created_by,
  };

  await writeJson(paths.getDeferredItemPath(projectRoot, id), item);
  return item;
}

/**
 * Read a deferred item by ID
 */
export async function readDeferredItem(
  projectRoot: string,
  itemId: string
): Promise<DeferredItem | null> {
  return readJson<DeferredItem>(paths.getDeferredItemPath(projectRoot, itemId));
}

/**
 * List all deferred items
 */
export async function listDeferredItems(
  projectRoot: string,
  options?: { includePromoted?: boolean }
): Promise<DeferredItem[]> {
  const deferredDir = paths.getDeferredDir(projectRoot);
  if (!existsSync(deferredDir)) {
    return [];
  }

  const entries = await readdir(deferredDir);
  const items: DeferredItem[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;

    const itemId = entry.replace(".json", "");
    const item = await readDeferredItem(projectRoot, itemId);

    if (!item) continue;

    // Filter out promoted items unless explicitly requested
    if (!options?.includePromoted && item.promoted_to_epic_id) {
      continue;
    }

    items.push(item);
  }

  // Sort by created_at descending (newest first)
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return items;
}

/**
 * Promote a deferred item to an epic
 */
export async function promoteDeferredItem(
  projectRoot: string,
  itemId: string,
  epicId: string
): Promise<void> {
  const item = await readDeferredItem(projectRoot, itemId);
  if (!item) {
    throw new Error(`Deferred item not found: ${itemId}`);
  }

  if (item.promoted_to_epic_id) {
    throw new Error(
      `Deferred item already promoted to epic: ${item.promoted_to_epic_id}`
    );
  }

  item.promoted_to_epic_id = epicId;
  item.promoted_at = new Date().toISOString();

  await writeJson(paths.getDeferredItemPath(projectRoot, itemId), item);
}
