/**
 * Global Strike Registry
 *
 * Maps mission slugs to their project paths, allowing `strike chat <mission>`
 * to work from anywhere.
 *
 * Registry lives at ~/.strike/registry.json
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface RegistryEntry {
  missionId: string;
  projectPath: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Registry {
  version: 1;
  entries: Record<string, RegistryEntry>; // keyed by missionId
}

/**
 * Get the path to the global Strike directory
 */
export function getGlobalStrikeDir(): string {
  return join(homedir(), ".strike");
}

/**
 * Get the path to the registry file
 */
export function getRegistryPath(): string {
  return join(getGlobalStrikeDir(), "registry.json");
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
  const dir = getGlobalStrikeDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getRegistryPath(), JSON.stringify(registry, null, 2));
}

/**
 * Register a mission in the global registry
 */
export async function registerMission(
  missionId: string,
  projectPath: string,
  description: string
): Promise<void> {
  const registry = await readRegistry();
  const now = new Date().toISOString();

  const existing = registry.entries[missionId];
  registry.entries[missionId] = {
    missionId,
    projectPath,
    description,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await writeRegistry(registry);
}

/**
 * Unregister a mission from the global registry
 */
export async function unregisterMission(missionId: string): Promise<void> {
  const registry = await readRegistry();
  delete registry.entries[missionId];
  await writeRegistry(registry);
}

/**
 * Look up a mission in the registry
 */
export async function lookupMission(
  missionId: string
): Promise<RegistryEntry | null> {
  const registry = await readRegistry();
  return registry.entries[missionId] ?? null;
}

/**
 * List all registered missions
 */
export async function listRegisteredMissions(): Promise<RegistryEntry[]> {
  const registry = await readRegistry();
  return Object.values(registry.entries).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

/**
 * Search for missions by partial match on missionId or description
 */
export async function searchMissions(query: string): Promise<RegistryEntry[]> {
  const registry = await readRegistry();
  const lowerQuery = query.toLowerCase();

  return Object.values(registry.entries)
    .filter(
      (entry) =>
        entry.missionId.toLowerCase().includes(lowerQuery) ||
        entry.description.toLowerCase().includes(lowerQuery)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
