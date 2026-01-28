//
//  FileWatcher.swift
//  Inc
//
//  Filesystem watcher using DispatchSource for low-overhead monitoring
//
//  Usage example:
//    let registryURL = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".inc/registry.json")
//    let watcher = FileWatcher(paths: [registryURL]) {
//        print("Registry file changed!")
//    }
//    watcher.start()
//

import Foundation

/// Watches files and directories for changes using Grand Central Dispatch
class FileWatcher {
    // MARK: - Properties

    private let initialPaths: [URL]  // Store initial paths for clearPaths()
    private var paths: [URL]  // All currently watched paths (initial + dynamic)
    private let debounceInterval: TimeInterval
    private let onChange: () -> Void

    private var fileDescriptors: [Int32] = []
    private var dispatchSources: [DispatchSourceFileSystemObject] = []
    private var debounceWorkItem: DispatchWorkItem?
    private let debounceQueue = DispatchQueue(label: "com.inc.filewatcher.debounce")

    private var isWatching = false
    private var pollingTimers: [Timer] = []

    // Track which paths are being watched to avoid duplicates
    private var watchedPaths: Set<String> = []

    // MARK: - Initialization

    /// Initialize a FileWatcher
    /// - Parameters:
    ///   - paths: Array of file or directory URLs to watch
    ///   - debounceInterval: Time to wait after last change before firing callback (default: 0.3s)
    ///   - onChange: Callback invoked after debounce period when changes are detected
    init(paths: [URL], debounceInterval: TimeInterval = 0.3, onChange: @escaping () -> Void) {
        self.initialPaths = paths
        self.paths = paths
        self.debounceInterval = debounceInterval
        self.onChange = onChange
    }

    deinit {
        stop()
    }

    // MARK: - Public Methods

    /// Begin watching files and directories for changes
    func start() {
        guard !isWatching else { return }
        isWatching = true

        for path in paths {
            startWatching(path: path)
        }
    }

    /// Add a new path to watch dynamically
    /// - Parameter path: The file or directory URL to start watching
    /// - Note: If already watching this path, does nothing
    func addPath(path: URL) {
        let pathString = path.path

        // Check if we're already watching this path
        guard !watchedPaths.contains(pathString) else {
            return
        }

        // Add to paths array
        paths.append(path)

        // If we're already watching, start watching this new path immediately
        if isWatching {
            startWatching(path: path)
        }
    }

    /// Clear all dynamically added paths and stop watching them
    /// - Note: Keeps watching the initial paths that were provided during initialization
    func clearPaths() {
        // Get the paths to remove (everything that's not in initialPaths)
        let pathsToRemove = Set(paths.map { $0.path }).subtracting(Set(initialPaths.map { $0.path }))

        // Reset paths to only initial paths
        paths = initialPaths

        // If we're watching, we need to stop and restart to clean up the removed paths
        if isWatching && !pathsToRemove.isEmpty {
            let wasWatching = isWatching
            stop()
            if wasWatching {
                start()
            }
        }
    }

    /// Stop watching and clean up all resources
    func stop() {
        guard isWatching else { return }
        isWatching = false

        // Cancel debounce work item
        debounceWorkItem?.cancel()
        debounceWorkItem = nil

        // Stop all polling timers
        for timer in pollingTimers {
            timer.invalidate()
        }
        pollingTimers.removeAll()

        // Clean up dispatch sources
        for source in dispatchSources {
            source.cancel()
        }
        dispatchSources.removeAll()

        // Close file descriptors
        for fd in fileDescriptors {
            close(fd)
        }
        fileDescriptors.removeAll()

        // Clear watched paths tracking
        watchedPaths.removeAll()
    }

    // MARK: - Private Methods

    private func startWatching(path: URL) {
        let filePath = path.path

        // Mark this path as being watched
        watchedPaths.insert(filePath)

        // Check if path exists
        if !FileManager.default.fileExists(atPath: filePath) {
            // Path doesn't exist yet - poll until it's created
            startPolling(path: path)
            return
        }

        // Check if it's a directory
        var isDirectory: ObjCBool = false
        FileManager.default.fileExists(atPath: filePath, isDirectory: &isDirectory)

        if isDirectory.boolValue {
            // Watch the directory itself
            setupDispatchSource(for: path)
        } else {
            // For files, watch both the file and its parent directory
            // This handles file rotation (delete + recreate)
            setupDispatchSource(for: path)

            let parentPath = path.deletingLastPathComponent()
            if FileManager.default.fileExists(atPath: parentPath.path) {
                setupDispatchSource(for: parentPath, isParentWatch: true)
            }
        }
    }

    private func setupDispatchSource(for path: URL, isParentWatch: Bool = false) {
        let filePath = path.path

        // Open file descriptor
        let fd = open(filePath, O_EVTONLY)
        guard fd >= 0 else {
            // Failed to open - might have been deleted, start polling
            if !isParentWatch {
                startPolling(path: path)
            }
            return
        }

        fileDescriptors.append(fd)

        // Create dispatch source for file system events
        let source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd,
            eventMask: [.write, .delete, .rename, .revoke],
            queue: debounceQueue
        )

        source.setEventHandler { [weak self] in
            guard let self = self else { return }

            let eventMask = source.data

            // Handle delete/rename/revoke events - file might be rotated
            if eventMask.contains(.delete) || eventMask.contains(.rename) || eventMask.contains(.revoke) {
                // Cancel this source and restart watching
                source.cancel()
                if let index = self.dispatchSources.firstIndex(where: { $0 === source }) {
                    self.dispatchSources.remove(at: index)
                }
                if let index = self.fileDescriptors.firstIndex(of: fd) {
                    close(fd)
                    self.fileDescriptors.remove(at: index)
                }

                // Restart watching this path (will poll if it doesn't exist)
                if !isParentWatch {
                    self.startWatching(path: path)
                }
            }

            // Trigger debounced callback
            self.triggerDebouncedCallback()
        }

        source.setCancelHandler {
            // File descriptor will be closed in stop() or event handler
        }

        dispatchSources.append(source)
        source.resume()
    }

    private func startPolling(path: URL) {
        // Poll every 0.5 seconds to check if file/directory has been created
        let timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }

            if FileManager.default.fileExists(atPath: path.path) {
                // File now exists, stop polling and set up proper watching
                timer.invalidate()
                if let index = self.pollingTimers.firstIndex(of: timer) {
                    self.pollingTimers.remove(at: index)
                }
                self.startWatching(path: path)

                // Trigger callback since the file was created
                self.triggerDebouncedCallback()
            }
        }

        pollingTimers.append(timer)
    }

    private func triggerDebouncedCallback() {
        // Cancel any existing debounce work item
        debounceWorkItem?.cancel()

        // Create new debounce work item
        let workItem = DispatchWorkItem { [weak self] in
            guard let self = self else { return }

            // Call the change handler on the main queue
            DispatchQueue.main.async {
                self.onChange()
            }
        }

        debounceWorkItem = workItem

        // Schedule the work item after the debounce interval
        debounceQueue.asyncAfter(deadline: .now() + debounceInterval, execute: workItem)
    }
}
