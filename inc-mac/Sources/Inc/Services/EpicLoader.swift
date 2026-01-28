//
//  EpicLoader.swift
//  Inc
//
//  Service for loading epic data from the filesystem
//

import Foundation
import os.log

/// Service class that loads epic data from ~/.inc filesystem
struct EpicLoader {

    private static let logger = Logger(subsystem: "com.inc.app", category: "EpicLoader")

    // MARK: - Public Methods

    /// Load all epics from the registry with their associated data
    /// - Returns: Array of EpicWithTasks sorted by updated_at descending
    static func loadAllEpics() -> [EpicWithTasks] {
        // Load registry
        guard let registry = loadRegistry() else {
            logger.warning("Failed to load registry, returning empty epic list")
            return []
        }

        // Load each epic from the registry
        var epicsWithTasks: [EpicWithTasks] = []

        for registryEntry in registry.entries.values {
            // Construct project root URL from projectPath
            let projectRootURL = URL(fileURLWithPath: registryEntry.projectPath)

            // Load epic.json
            guard let epic = loadEpic(projectRoot: projectRootURL, epicId: registryEntry.epicId) else {
                logger.warning("Failed to load epic.json for epicId: \(registryEntry.epicId), skipping")
                continue
            }

            // Attempt to load tasks.json (optional, may not exist for new epics)
            let tasksFile = loadTasks(projectRoot: projectRootURL, epicId: registryEntry.epicId)

            // Combine into EpicWithTasks
            let epicWithTasks = EpicWithTasks(
                epic: epic,
                registryEntry: registryEntry,
                tasksFile: tasksFile
            )

            epicsWithTasks.append(epicWithTasks)
        }

        // Sort by epic.updated_at descending
        let sortedEpics = epicsWithTasks.sorted { epic1, epic2 in
            guard let date1 = epic1.epic.updatedDate,
                  let date2 = epic2.epic.updatedDate else {
                // Fallback to string comparison if date parsing fails
                return epic1.epic.updated_at > epic2.epic.updated_at
            }
            return date1 > date2
        }

        logger.info("Loaded \(sortedEpics.count) epics from registry")
        return sortedEpics
    }

    // MARK: - Private Methods

    /// Load the global registry from ~/.inc/registry.json
    /// - Returns: Registry object or nil if loading fails
    private static func loadRegistry() -> Registry? {
        let registryPath = IncPaths.getRegistryPath()

        guard FileManager.default.fileExists(atPath: registryPath.path) else {
            logger.warning("Registry file not found at: \(registryPath.path)")
            return nil
        }

        do {
            let data = try Data(contentsOf: registryPath)
            let decoder = JSONDecoder()
            let registry = try decoder.decode(Registry.self, from: data)
            return registry
        } catch {
            logger.error("Failed to decode registry.json: \(error.localizedDescription)")
            return nil
        }
    }

    /// Load epic.json for a specific epic
    /// - Parameters:
    ///   - projectRoot: Project root URL
    ///   - epicId: Epic ID
    /// - Returns: Epic object or nil if loading fails
    private static func loadEpic(projectRoot: URL, epicId: String) -> Epic? {
        let epicPath = IncPaths.getEpicJsonPath(projectRoot: projectRoot, epicId: epicId)

        guard FileManager.default.fileExists(atPath: epicPath.path) else {
            logger.warning("Epic file not found at: \(epicPath.path)")
            return nil
        }

        do {
            let data = try Data(contentsOf: epicPath)
            let decoder = JSONDecoder()
            let epic = try decoder.decode(Epic.self, from: data)
            return epic
        } catch {
            logger.error("Failed to decode epic.json for \(epicId): \(error.localizedDescription)")
            return nil
        }
    }

    /// Load tasks.json for a specific epic (optional, may not exist)
    /// - Parameters:
    ///   - projectRoot: Project root URL
    ///   - epicId: Epic ID
    /// - Returns: TasksFile object or nil if file doesn't exist or loading fails
    private static func loadTasks(projectRoot: URL, epicId: String) -> TasksFile? {
        let tasksPath = IncPaths.getTasksPath(projectRoot: projectRoot, epicId: epicId)

        // Gracefully handle missing tasks.json (common for new epics)
        guard FileManager.default.fileExists(atPath: tasksPath.path) else {
            logger.debug("Tasks file not found at: \(tasksPath.path) - this is normal for new epics")
            return nil
        }

        do {
            let data = try Data(contentsOf: tasksPath)
            let decoder = JSONDecoder()
            let tasksFile = try decoder.decode(TasksFile.self, from: data)
            return tasksFile
        } catch {
            logger.warning("Failed to decode tasks.json for \(epicId): \(error.localizedDescription)")
            return nil
        }
    }
}
