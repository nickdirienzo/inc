/**
 * Mission monitoring hook for TUI
 *
 * Provides global mission visibility by:
 * - Reading ~/.inc/registry.json
 * - Loading mission.json for each registry entry
 * - Watching for changes with chokidar
 * - Debouncing updates (300ms)
 */

import { watch, FSWatcher } from "chokidar";
import { readRegistry, getRegistryPath } from "../../registry/index.js";
import { readMission, getMissionJsonPath } from "../../state/index.js";
import type { MissionWithProject } from "./types.js";

export interface UseMissionsResult {
  missions: MissionWithProject[];
  needsAttention: MissionWithProject[];
  loading: boolean;
}

export interface UseMissionsState {
  missions: MissionWithProject[];
  needsAttention: MissionWithProject[];
  loading: boolean;
  watchers: FSWatcher[];
  debounceTimer: NodeJS.Timeout | null;
}

/**
 * Load all missions from the registry
 */
async function loadMissions(): Promise<MissionWithProject[]> {
  const registry = await readRegistry();
  const missions: MissionWithProject[] = [];

  for (const entry of Object.values(registry.entries)) {
    const mission = await readMission(entry.projectPath, entry.missionId);
    if (mission) {
      missions.push({
        ...mission,
        projectPath: entry.projectPath,
      });
    }
  }

  return missions;
}

/**
 * Filter missions that need attention
 */
function filterNeedsAttention(
  missions: MissionWithProject[]
): MissionWithProject[] {
  return missions.filter((m) => m.needs_attention !== undefined);
}

/**
 * Create a mission monitoring instance
 */
export function createUseMissions(
  onChange: (result: UseMissionsResult) => void
): {
  start: () => Promise<void>;
  stop: () => void;
} {
  const state: UseMissionsState = {
    missions: [],
    needsAttention: [],
    loading: true,
    watchers: [],
    debounceTimer: null,
  };

  /**
   * Update state and notify listeners (debounced)
   */
  function scheduleUpdate() {
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }

    state.debounceTimer = setTimeout(async () => {
      state.debounceTimer = null;
      await updateMissions();
    }, 300);
  }

  /**
   * Load missions and update state
   */
  async function updateMissions() {
    try {
      const missions = await loadMissions();
      state.missions = missions;
      state.needsAttention = filterNeedsAttention(missions);
      state.loading = false;

      onChange({
        missions: state.missions,
        needsAttention: state.needsAttention,
        loading: state.loading,
      });
    } catch (error) {
      console.error("Error loading missions:", error);
      state.loading = false;
      onChange({
        missions: state.missions,
        needsAttention: state.needsAttention,
        loading: state.loading,
      });
    }
  }

  /**
   * Setup file watchers
   */
  async function setupWatchers() {
    // Watch registry file
    const registryPath = getRegistryPath();
    const registryWatcher = watch(registryPath, {
      ignoreInitial: true,
      persistent: true,
    });

    registryWatcher.on("change", () => {
      scheduleUpdate();
    });

    registryWatcher.on("add", () => {
      scheduleUpdate();
    });

    state.watchers.push(registryWatcher);

    // Watch all mission.json files
    const registry = await readRegistry();
    for (const entry of Object.values(registry.entries)) {
      const missionJsonPath = getMissionJsonPath(
        entry.projectPath,
        entry.missionId
      );

      const missionWatcher = watch(missionJsonPath, {
        ignoreInitial: true,
        persistent: true,
      });

      missionWatcher.on("change", () => {
        scheduleUpdate();
      });

      missionWatcher.on("add", () => {
        scheduleUpdate();
      });

      state.watchers.push(missionWatcher);
    }
  }

  /**
   * Start monitoring missions
   */
  async function start() {
    state.loading = true;
    onChange({
      missions: [],
      needsAttention: [],
      loading: true,
    });

    // Initial load
    await updateMissions();

    // Setup file watchers
    await setupWatchers();
  }

  /**
   * Stop monitoring and cleanup watchers
   */
  function stop() {
    // Clear debounce timer
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }

    // Close all watchers
    for (const watcher of state.watchers) {
      watcher.close();
    }
    state.watchers = [];
  }

  return {
    start,
    stop,
  };
}
