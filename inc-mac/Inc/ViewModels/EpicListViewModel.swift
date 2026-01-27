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

    // MARK: - Initialization

    init() {
        loadEpics()
        startWatching()
    }

    deinit {
        stopWatching()
    }

    // MARK: - Public Methods

    /// Load all epics from the filesystem
    func loadEpics() {
        isLoading = true
        logger.info("Loading epics from filesystem")

        // Load epics on a background thread to avoid blocking UI
        Task {
            let loadedEpics = await Task.detached {
                return EpicLoader.loadAllEpics()
            }.value

            // Update on main thread
            await MainActor.run {
                self.epics = loadedEpics
                self.isLoading = false
                self.logger.info("Successfully loaded \(loadedEpics.count) epics")
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
            Task { @MainActor in
                self.logger.info("Registry file changed, reloading epics")
                self.loadEpics()
            }
        }

        fileWatcher?.start()
    }

    /// Stop watching for file changes
    func stopWatching() {
        logger.info("Stopping file watcher")
        fileWatcher?.stop()
        fileWatcher = nil
    }
}
