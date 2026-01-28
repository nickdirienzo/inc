//
//  EpicListViewModel.swift
//  Inc
//
//  View model for epic list state management
//

import Foundation
import Combine
import os.log

/// View model for managing epic list state and file watching
@MainActor
class EpicListViewModel: ObservableObject {

    // MARK: - Published Properties

    /// Array of all loaded epics with their tasks
    @Published var epics: [EpicWithTasks] = []

    /// Whether to hide done epics
    @Published var hideDone: Bool = true

    /// ID of the currently selected epic
    @Published var selectedEpicId: String?

    /// Whether the view model is currently loading data
    @Published var isLoading: Bool = false

    // MARK: - Private Properties

    /// File watcher for registry.json changes
    private var fileWatcher: FileWatcher?

    /// Logger for debugging
    private let logger = Logger(subsystem: "com.inc.app", category: "EpicListViewModel")

    // MARK: - Computed Properties

    /// Returns the currently selected epic, if any
    var selectedEpic: EpicWithTasks? {
        guard let selectedId = selectedEpicId else {
            return nil
        }
        return epics.first { $0.epic.id == selectedId }
    }

    /// Returns filtered epics based on hideDone setting
    var filteredEpics: [EpicWithTasks] {
        if hideDone {
            return epics.filter { $0.epic.status != .done && $0.epic.status != .abandoned }
        }
        return epics
    }

    // MARK: - Initialization

    init() {
        loadEpics()
        startWatching()
    }

    deinit {
        fileWatcher?.stop()
        fileWatcher = nil
    }

    // MARK: - Public Methods

    /// Load all epics from the filesystem
    func loadEpics() {
        isLoading = true
        logger.info("Loading epics from filesystem")

        // Load epics on a background thread to avoid blocking UI
        _Concurrency.Task {
            let loadedEpics = await _Concurrency.Task.detached {
                return EpicLoader.loadAllEpics()
            }.value

            // Update on main thread
            await MainActor.run {
                self.epics = loadedEpics
                self.isLoading = false
                self.logger.info("Successfully loaded \(loadedEpics.count) epics")

                // Setup epic directory watchers after epics are loaded
                self.setupEpicDirectoryWatchers()
            }
        }
    }

    /// Select an epic by ID
    /// - Parameter epicId: The ID of the epic to select
    func selectEpic(_ epicId: String) {
        selectedEpicId = epicId
        logger.debug("Selected epic: \(epicId)")
    }

    /// Start watching registry.json for changes
    func startWatching() {
        let registryPath = IncPaths.getRegistryPath()

        logger.info("Starting file watcher for registry at: \(registryPath.path)")

        fileWatcher = FileWatcher(paths: [registryPath], debounceInterval: 0.3) { [weak self] in
            guard let self = self else { return }
            _Concurrency.Task { @MainActor in
                self.logger.info("Registry file changed, reloading epics")
                self.loadEpics()
                // Note: setupEpicDirectoryWatchers() is also called inside loadEpics() after completion
                // This call ensures watchers are updated even if loadEpics() is already running
                self.setupEpicDirectoryWatchers()
            }
        }

        fileWatcher?.start()
    }

    /// Set up watchers for epic directories to catch task.json changes
    func setupEpicDirectoryWatchers() {
        guard let fileWatcher = fileWatcher else {
            logger.warning("Cannot setup epic directory watchers - fileWatcher is nil")
            return
        }

        // Clear any previously added paths (keeps initial registry.json watch)
        fileWatcher.clearPaths()

        // Get unique project paths from all loaded epics
        let uniqueProjectPaths = Set(epics.map { $0.registryEntry.projectPath })

        logger.info("Setting up epic directory watchers for \(uniqueProjectPaths.count) project(s)")

        // Add a watcher for each project's epics directory
        for projectPath in uniqueProjectPaths {
            let projectRootURL = URL(fileURLWithPath: projectPath)
            let epicsDir = IncPaths.getEpicsDir(projectRoot: projectRootURL)

            logger.debug("Adding watcher for epics directory: \(epicsDir.path)")
            fileWatcher.addPath(path: epicsDir)
        }
    }

    /// Stop watching for file changes
    func stopWatching() {
        logger.info("Stopping file watcher")
        fileWatcher?.stop()
        fileWatcher = nil
    }

    /// Create a new epic by calling the inc CLI
    /// - Parameters:
    ///   - description: The description for the new epic
    ///   - projectRoot: The project root directory path
    /// - Returns: The ID of the newly created epic
    /// - Throws: Error if epic creation fails
    func createEpic(description: String, projectRoot: String) async throws -> String {
        logger.info("Creating epic with description: '\(description)' in project: \(projectRoot)")

        // Validate description
        guard !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            logger.error("Epic description cannot be empty")
            throw EpicCreationError.emptyDescription
        }

        // Create process to run inc new command
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["inc", "new", description]
        process.currentDirectoryURL = URL(fileURLWithPath: projectRoot)

        // Setup pipes to capture output
        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

        // Run the process
        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            logger.error("Failed to execute inc command: \(error.localizedDescription)")
            throw EpicCreationError.incNotFound
        }

        // Check exit status
        guard process.terminationStatus == 0 else {
            let errorData = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let errorOutput = String(data: errorData, encoding: .utf8) ?? "Unknown error"
            logger.error("inc command failed with status \(process.terminationStatus): \(errorOutput)")
            throw EpicCreationError.processFailure(errorOutput)
        }

        // Parse output to extract epic ID
        let outputData = outputPipe.fileHandleForReading.readDataToEndOfFile()
        guard let output = String(data: outputData, encoding: .utf8) else {
            logger.error("Failed to decode inc command output")
            throw EpicCreationError.outputParseFailure
        }

        logger.debug("inc new output: \(output)")

        // Extract epic ID from output
        // Expected format: "Created epic: <epic-id>" or similar
        // Try to find the epic ID in the output
        guard let epicId = extractEpicId(from: output) else {
            logger.error("Failed to extract epic ID from output: \(output)")
            throw EpicCreationError.outputParseFailure
        }

        logger.info("Successfully created epic: \(epicId)")

        // Reload epics to show the new one
        loadEpics()

        return epicId
    }

    /// Extract epic ID from inc command output
    private func extractEpicId(from output: String) -> String? {
        // Look for patterns like "Created epic: <id>" or "Epic <id> created"
        // Also handle case where the output just contains the epic ID
        let patterns = [
            #"Created epic:?\s+([a-f0-9]+)"#,
            #"Epic\s+([a-f0-9]+)\s+created"#,
            #"epic\s+([a-f0-9]+)"#,
            #"\b([a-f0-9]{8,})\b"#  // fallback: any hex string 8+ chars
        ]

        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
               let match = regex.firstMatch(in: output, range: NSRange(output.startIndex..., in: output)),
               let range = Range(match.range(at: 1), in: output) {
                return String(output[range])
            }
        }

        return nil
    }
}

/// Errors that can occur during epic creation
enum EpicCreationError: LocalizedError {
    case emptyDescription
    case incNotFound
    case processFailure(String)
    case outputParseFailure

    var errorDescription: String? {
        switch self {
        case .emptyDescription:
            return "Epic description cannot be empty"
        case .incNotFound:
            return "inc command not found. Make sure inc is installed and in your PATH."
        case .processFailure(let message):
            return "Failed to create epic: \(message)"
        case .outputParseFailure:
            return "Epic may have been created, but failed to parse the epic ID from output."
        }
    }
}
