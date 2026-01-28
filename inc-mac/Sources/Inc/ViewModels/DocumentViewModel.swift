//
//  DocumentViewModel.swift
//  Inc
//
//  Manages document viewing (spec.md, architecture.md) in the document pane
//

import Foundation
import Combine
import os.log

/// Represents a document file displayed in the document pane
struct DocumentFile: Equatable {
    let path: String
    let content: String
    let title: String
}

/// Represents the state of the document viewer
enum DocumentState: Equatable {
    case none
    case loaded(DocumentFile)
    case error(String)
}

/// View model for the document pane that displays markdown documents
class DocumentViewModel: ObservableObject {
    @Published var currentDocument: DocumentState = .none
    @Published var isReloading: Bool = false
    private let logger = Logger(subsystem: "com.inc.Inc", category: "DocumentViewModel")

    // FileWatcher for auto-reloading documents when agents edit them
    private var fileWatcher: FileWatcher?
    private var currentDocumentPath: String?

    /// Loads the spec.md file for a given epic
    /// - Parameters:
    ///   - projectPath: The root path of the project
    ///   - epicId: The ID of the epic
    func loadSpec(projectPath: String, epicId: String) {
        let projectURL = URL(fileURLWithPath: projectPath)
        let specPath = IncPaths.getSpecPath(projectRoot: projectURL, epicId: epicId)

        logger.info("Attempting to load spec file: \(specPath.path)")

        guard let content = loadFile(path: specPath) else {
            logger.error("Spec file not found: \(specPath.path)")
            currentDocument = .error("Spec file not found: \(specPath.path)")
            return
        }

        logger.info("Successfully loaded spec file: \(specPath.path)")
        let title = specPath.lastPathComponent
        currentDocument = .loaded(DocumentFile(path: specPath.path, content: content, title: title))

        // Setup file watching for auto-reload when agents edit the document
        currentDocumentPath = specPath.path
        fileWatcher?.stop()
        fileWatcher = FileWatcher(paths: [specPath], debounceInterval: 0.3) { [weak self] in
            self?.reloadCurrentDocument()
        }
        fileWatcher?.start()
    }

    /// Loads the architecture.md file for a given epic
    /// - Parameters:
    ///   - projectPath: The root path of the project
    ///   - epicId: The ID of the epic
    func loadArchitecture(projectPath: String, epicId: String) {
        let projectURL = URL(fileURLWithPath: projectPath)
        let architecturePath = IncPaths.getArchitecturePath(projectRoot: projectURL, epicId: epicId)

        logger.info("Attempting to load architecture file: \(architecturePath.path)")

        guard let content = loadFile(path: architecturePath) else {
            logger.error("Architecture file not found: \(architecturePath.path)")
            currentDocument = .error("Architecture file not found: \(architecturePath.path)")
            return
        }

        logger.info("Successfully loaded architecture file: \(architecturePath.path)")
        let title = architecturePath.lastPathComponent
        currentDocument = .loaded(DocumentFile(path: architecturePath.path, content: content, title: title))

        // Setup file watching for auto-reload when agents edit the document
        currentDocumentPath = architecturePath.path
        fileWatcher?.stop()
        fileWatcher = FileWatcher(paths: [architecturePath], debounceInterval: 0.3) { [weak self] in
            self?.reloadCurrentDocument()
        }
        fileWatcher?.start()
    }

    /// Closes the currently open document
    func closeDocument() {
        fileWatcher?.stop()
        fileWatcher = nil
        currentDocumentPath = nil
        currentDocument = .none
    }

    /// Reloads the currently displayed document from disk
    private func reloadCurrentDocument() {
        guard let path = currentDocumentPath else { return }

        isReloading = true

        // Check if file still exists
        guard FileManager.default.fileExists(atPath: path) else {
            currentDocument = .error("Document was deleted: \(path)")
            isReloading = false
            return
        }

        // Reload the file
        let url = URL(fileURLWithPath: path)
        if let content = loadFile(path: url) {
            if case .loaded(let doc) = currentDocument {
                currentDocument = .loaded(DocumentFile(path: path, content: content, title: doc.title))
            }
        }

        isReloading = false
    }

    /// Loads the content of a file from disk
    /// - Parameter path: The URL to the file
    /// - Returns: The file content as a string, or nil if the file cannot be read or doesn't exist
    private func loadFile(path: URL) -> String? {
        // Check if file exists
        guard FileManager.default.fileExists(atPath: path.path) else {
            return nil
        }

        // Try to read the file content
        guard let content = try? String(contentsOf: path, encoding: .utf8) else {
            return nil
        }

        return content
    }
}
