/**
 * Global Inc Registry
 *
 * Maps epic slugs to their project paths, allowing `inc chat <epic>`
 * to work from anywhere.
 *
 * Registry lives at ~/.inc/registry.json
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface RegistryEntry {
  epicId: string;
  shortId?: string;
  projectPath: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Registry {
  version: 1;
  entries: Record<string, RegistryEntry>; // keyed by epicId
}

/**
 * Get the path to the global Inc directory
 */
export function getGlobalIncDir(): string {
  return join(homedir(), ".inc");
}

/**
 * Get the path to the registry file
 */
export function getRegistryPath(): string {
  return join(getGlobalIncDir(), "registry.json");
}

/**
 * Read the global registry
 */
export async function readRegistry(): Promise<Registry> {
  try {
    const content = await readFile(getRegistryPath(), "utf-8");
    return JSON.parse(content) as Registry;
  } catch {
    // Return empty registry if doesn't exist
    return { version: 1, entries: {} };
  }
}

/**
 * Write the global registry
 */
export async function writeRegistry(registry: Registry): Promise<void> {
  const dir = getGlobalIncDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getRegistryPath(), JSON.stringify(registry, null, 2));
}

/**
 * Register an epic in the global registry
 */
export async function registerEpic(
  epicId: string,
  projectPath: string,
  description: string,
  shortId?: string
): Promise<void> {
  const registry = await readRegistry();
  const now = new Date().toISOString();

  const existing = registry.entries[epicId];
  registry.entries[epicId] = {
    epicId,
    shortId: shortId ?? existing?.shortId,
    projectPath,
    description,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await writeRegistry(registry);
}

/**
 * Unregister an epic from the global registry
 */
export async function unregisterEpic(epicId: string): Promise<void> {
  const registry = await readRegistry();
  delete registry.entries[epicId];
  await writeRegistry(registry);
}

/**
 * Look up an epic in the registry by epicId or shortId
 */
export async function lookupEpic(
  idOrShortId: string
): Promise<RegistryEntry | null> {
  const registry = await readRegistry();

  if (registry.entries[idOrShortId]) {
    return registry.entries[idOrShortId];
  }

  const matches: RegistryEntry[] = [];
  for (const entry of Object.values(registry.entries)) {
    if (entry.shortId === idOrShortId) {
      return entry;
    }
    if (entry.shortId?.startsWith(idOrShortId)) {
      matches.push(entry);
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  return null;
}

/**
 * List all registered epics
 */
export async function listRegisteredEpics(): Promise<RegistryEntry[]> {
  const registry = await readRegistry();
  return Object.values(registry.entries).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

/**
 * Search for epics by partial match on epicId, shortId, or description
 */
export async function searchEpics(query: string): Promise<RegistryEntry[]> {
  const registry = await readRegistry();
  const lowerQuery = query.toLowerCase();

  return Object.values(registry.entries)
    .filter(
      (entry) =>
        entry.epicId.toLowerCase().includes(lowerQuery) ||
        entry.shortId?.toLowerCase().includes(lowerQuery) ||
        entry.description.toLowerCase().includes(lowerQuery)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
