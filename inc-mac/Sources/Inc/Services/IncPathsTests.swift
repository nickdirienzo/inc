//
//  IncPathsTests.swift
//  Inc
//
//  Simple verification tests for IncPaths utility
//  These demonstrate the API usage patterns
//

import Foundation

/// Example usage of IncPaths utility
/// This file is for documentation purposes and can be removed once unit tests are added
struct IncPathsTests {

    static func demonstrateUsage() {
        // Example project root
        let projectRoot = URL(fileURLWithPath: "/Users/example/my-project")
        let epicId = "abc123def456"

        // Global paths
        let incHome = IncPaths.getIncHome()
        print("Inc home: \(incHome.path)")
        // Expected: /Users/<user>/.inc

        let registryPath = IncPaths.getRegistryPath()
        print("Registry: \(registryPath.path)")
        // Expected: /Users/<user>/.inc/registry.json

        // Project paths
        let projectIncDir = IncPaths.getProjectIncDir(projectRoot: projectRoot)
        print("Project dir: \(projectIncDir.path)")
        // Expected: /Users/<user>/.inc/projects/<hash>

        let epicsDir = IncPaths.getEpicsDir(projectRoot: projectRoot)
        print("Epics dir: \(epicsDir.path)")
        // Expected: /Users/<user>/.inc/projects/<hash>/epics

        // Epic file paths
        let epicJsonPath = IncPaths.getEpicJsonPath(projectRoot: projectRoot, epicId: epicId)
        print("Epic JSON: \(epicJsonPath.path)")
        // Expected: /Users/<user>/.inc/projects/<hash>/epics/abc123def456/epic.json

        let tasksPath = IncPaths.getTasksPath(projectRoot: projectRoot, epicId: epicId)
        print("Tasks: \(tasksPath.path)")
        // Expected: /Users/<user>/.inc/projects/<hash>/epics/abc123def456/tasks.json

        let specPath = IncPaths.getSpecPath(projectRoot: projectRoot, epicId: epicId)
        print("Spec: \(specPath.path)")
        // Expected: /Users/<user>/.inc/projects/<hash>/epics/abc123def456/spec.md

        let architecturePath = IncPaths.getArchitecturePath(projectRoot: projectRoot, epicId: epicId)
        print("Architecture: \(architecturePath.path)")
        // Expected: /Users/<user>/.inc/projects/<hash>/epics/abc123def456/architecture.md
    }
}
