/**
 * Epic monitoring hook for TUI
 *
 * Provides global epic visibility by:
 * - Reading ~/.inc/registry.json
 * - Loading epic.json for each registry entry
 * - Watching for changes with chokidar
 * - Debouncing updates (300ms)
 */

import { watch, FSWatcher } from "chokidar";
import { readRegistry, getRegistryPath } from "../../registry/index.js";
import { readEpic, getEpicJsonPath, readTasks, getTasksPath } from "../../state/index.js";
import type { EpicWithProject } from "./types.js";

export interface UseEpicsResult {
  epics: EpicWithProject[];
  needsAttention: EpicWithProject[];
  loading: boolean;
}

export interface UseEpicsState {
  epics: EpicWithProject[];
  needsAttention: EpicWithProject[];
  loading: boolean;
  watchers: FSWatcher[];
  debounceTimer: NodeJS.Timeout | null;
}

/**
 * Load all epics from the registry
 */
async function loadEpics(): Promise<EpicWithProject[]> {
  const registry = await readRegistry();
  const epics: EpicWithProject[] = [];

  for (const entry of Object.values(registry.entries)) {
    const epic = await readEpic(entry.projectPath, entry.epicId);
    if (epic) {
      const epicWithProject: EpicWithProject = {
        ...epic,
        projectPath: entry.projectPath,
      };

      // Load task completion data for epics in coding status
      if (epic.status === "coding") {
        try {
          const tasksFile = await readTasks(entry.projectPath, entry.epicId);
          if (tasksFile && tasksFile.tasks.length > 0) {
            const completed = tasksFile.tasks.filter(t => t.status === "done").length;
            epicWithProject.tasksCompleted = completed;
            epicWithProject.tasksTotal = tasksFile.tasks.length;
          }
        } catch (error) {
          // Silently ignore task loading errors - don't crash the TUI
          // Task progress simply won't be displayed for this epic
        }
      }

      epics.push(epicWithProject);
    }
  }

  return epics;
}

/**
 * Filter epics that need attention
 */
function filterNeedsAttention(
  epics: EpicWithProject[]
): EpicWithProject[] {
  return epics.filter((e) => e.needs_attention !== undefined);
}

/**
 * Create an epic monitoring instance
 */
export function createUseEpics(
  onChange: (result: UseEpicsResult) => void
): {
  start: () => Promise<void>;
  stop: () => void;
} {
  const state: UseEpicsState = {
    epics: [],
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
      await updateEpics();
    }, 300);
  }

  /**
   * Load epics and update state
   */
  async function updateEpics() {
    try {
      const epics = await loadEpics();
      state.epics = epics;
      state.needsAttention = filterNeedsAttention(epics);
      state.loading = false;

      onChange({
        epics: state.epics,
        needsAttention: state.needsAttention,
        loading: state.loading,
      });
    } catch (error) {
      console.error("Error loading epics:", error);
      state.loading = false;
      onChange({
        epics: state.epics,
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

    // Watch all epic.json files
    const registry = await readRegistry();
    for (const entry of Object.values(registry.entries)) {
      const epicJsonPath = getEpicJsonPath(
        entry.projectPath,
        entry.epicId
      );

      const epicWatcher = watch(epicJsonPath, {
        ignoreInitial: true,
        persistent: true,
      });

      epicWatcher.on("change", () => {
        scheduleUpdate();
      });

      epicWatcher.on("add", () => {
        scheduleUpdate();
      });

      state.watchers.push(epicWatcher);

      // Watch tasks.json for this epic
      const tasksPath = getTasksPath(entry.projectPath, entry.epicId);
      const tasksWatcher = watch(tasksPath, {
        ignoreInitial: true,
        persistent: true,
      });

      tasksWatcher.on("change", () => {
        scheduleUpdate();
      });

      tasksWatcher.on("add", () => {
        scheduleUpdate();
      });

      state.watchers.push(tasksWatcher);
    }
  }

  /**
   * Start monitoring epics
   */
  async function start() {
    state.loading = true;
    onChange({
      epics: [],
      needsAttention: [],
      loading: true,
    });

    // Initial load
    await updateEpics();

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
