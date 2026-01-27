//
//  IncPaths.swift
//  Inc
//
//  Path utilities for Inc state management
//  All inc state is stored in ~/.inc/projects/<project-hash>/
//

import Foundation
import CryptoKit

/// Path utilities for accessing Inc directories and files
struct IncPaths {

    // MARK: - Constants

    private static let incDirectoryName = ".inc"
    private static let projectsDirectoryName = "projects"
    private static let epicsDirectoryName = "epics"

    // MARK: - Global Paths

    /// Get the root ~/.inc directory
    static func getIncHome() -> URL {
        return FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(incDirectoryName)
    }

    /// Get the path to the global registry file: ~/.inc/registry.json
    static func getRegistryPath() -> URL {
        return getIncHome().appendingPathComponent("registry.json")
    }

    // MARK: - Project Hash

    /// Generate a stable hash for a project path.
    /// This is used to create a unique directory for each project in ~/.inc/
    private static func getProjectHash(projectRoot: URL) -> String {
        let projectPath = projectRoot.path
        let inputData = Data(projectPath.utf8)
        let hash = SHA256.hash(data: inputData)
        let hashString = hash.map { String(format: "%02x", $0) }.joined()
        return String(hashString.prefix(12))
    }

    // MARK: - Project Paths

    /// Get the project-specific inc directory: ~/.inc/projects/<hash>/
    static func getProjectIncDir(projectRoot: URL) -> URL {
        let hash = getProjectHash(projectRoot: projectRoot)
        return getIncHome()
            .appendingPathComponent(projectsDirectoryName)
            .appendingPathComponent(hash)
    }

    /// Get the epics directory: ~/.inc/projects/<hash>/epics/
    static func getEpicsDir(projectRoot: URL) -> URL {
        return getProjectIncDir(projectRoot: projectRoot)
            .appendingPathComponent(epicsDirectoryName)
    }

    /// Get a specific epic directory: ~/.inc/projects/<hash>/epics/<epicId>/
    private static func getEpicDir(projectRoot: URL, epicId: String) -> URL {
        return getEpicsDir(projectRoot: projectRoot)
            .appendingPathComponent(epicId)
    }

    // MARK: - Epic File Paths

    /// Get the epic.json path: ~/.inc/projects/<hash>/epics/<epicId>/epic.json
    static func getEpicJsonPath(projectRoot: URL, epicId: String) -> URL {
        return getEpicDir(projectRoot: projectRoot, epicId: epicId)
            .appendingPathComponent("epic.json")
    }

    /// Get the tasks.json path: ~/.inc/projects/<hash>/epics/<epicId>/tasks.json
    static func getTasksPath(projectRoot: URL, epicId: String) -> URL {
        return getEpicDir(projectRoot: projectRoot, epicId: epicId)
            .appendingPathComponent("tasks.json")
    }

    /// Get the spec.md path: ~/.inc/projects/<hash>/epics/<epicId>/spec.md
    static func getSpecPath(projectRoot: URL, epicId: String) -> URL {
        return getEpicDir(projectRoot: projectRoot, epicId: epicId)
            .appendingPathComponent("spec.md")
    }

    /// Get the architecture.md path: ~/.inc/projects/<hash>/epics/<epicId>/architecture.md
    static func getArchitecturePath(projectRoot: URL, epicId: String) -> URL {
        return getEpicDir(projectRoot: projectRoot, epicId: epicId)
            .appendingPathComponent("architecture.md")
    }
}
