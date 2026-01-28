//
//  FileWatcher.swift
//  Inc
//
//  Filesystem watcher using FSEvents for recursive directory monitoring
//

import Foundation
import CoreServices

/// Watches files and directories for changes using FSEvents (supports recursive watching)
class FileWatcher {
    private let initialPaths: [URL]
    private var paths: [URL]
    private let debounceInterval: TimeInterval
    private let onChange: () -> Void

    private var streamRef: FSEventStreamRef?
    private var debounceWorkItem: DispatchWorkItem?
    private let debounceQueue = DispatchQueue(label: "com.inc.filewatcher.debounce")
    private var isWatching = false

    init(paths: [URL], debounceInterval: TimeInterval = 0.3, onChange: @escaping () -> Void) {
        self.initialPaths = paths
        self.paths = paths
        self.debounceInterval = debounceInterval
        self.onChange = onChange
    }

    deinit {
        stop()
    }

    func start() {
        guard !isWatching else { return }
        isWatching = true
        createStream()
    }

    func addPath(path: URL) {
        guard !paths.contains(where: { $0.path == path.path }) else { return }
        paths.append(path)
        if isWatching {
            stop()
            isWatching = true
            createStream()
        }
    }

    func clearPaths() {
        paths = initialPaths
        if isWatching {
            stop()
            isWatching = true
            createStream()
        }
    }

    func stop() {
        guard isWatching else { return }
        isWatching = false
        debounceWorkItem?.cancel()
        debounceWorkItem = nil

        if let stream = streamRef {
            FSEventStreamStop(stream)
            FSEventStreamInvalidate(stream)
            FSEventStreamRelease(stream)
            streamRef = nil
        }
    }

    private func createStream() {
        let pathsToWatch = paths.map { $0.path } as CFArray

        var context = FSEventStreamContext(
            version: 0,
            info: Unmanaged.passUnretained(self).toOpaque(),
            retain: nil,
            release: nil,
            copyDescription: nil
        )

        let callback: FSEventStreamCallback = { _, info, _, _, _, _ in
            guard let info = info else { return }
            let watcher = Unmanaged<FileWatcher>.fromOpaque(info).takeUnretainedValue()
            watcher.triggerDebouncedCallback()
        }

        guard let stream = FSEventStreamCreate(
            nil,
            callback,
            &context,
            pathsToWatch,
            FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
            0.1,
            UInt32(kFSEventStreamCreateFlagUseCFTypes | kFSEventStreamCreateFlagFileEvents)
        ) else { return }

        streamRef = stream
        FSEventStreamSetDispatchQueue(stream, DispatchQueue.main)
        FSEventStreamStart(stream)
    }

    private func triggerDebouncedCallback() {
        debounceWorkItem?.cancel()
        let workItem = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            DispatchQueue.main.async {
                self.onChange()
            }
        }
        debounceWorkItem = workItem
        debounceQueue.asyncAfter(deadline: .now() + debounceInterval, execute: workItem)
    }
}
