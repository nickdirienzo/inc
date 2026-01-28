//
//  DocumentViewModel.swift
//  Inc
//
//  Manages document viewing (spec.md, architecture.md) in the document pane
//

import Foundation
import Combine

/// Represents a document file displayed in the document pane
struct DocumentFile: Equatable {
    let path: String
    let content: String
    let title: String
}

/// View model for the document pane that displays markdown documents
class DocumentViewModel: ObservableObject {
    @Published var currentDocument: DocumentFile? = nil

    /// Loads the spec.md file for a given epic
    /// - Parameters:
    ///   - projectPath: The root path of the project
    ///   - epicId: The ID of the epic
    func loadSpec(projectPath: String, epicId: String) {
        let projectURL = URL(fileURLWithPath: projectPath)
        let specPath = IncPaths.getSpecPath(projectRoot: projectURL, epicId: epicId)

        guard let content = loadFile(path: specPath) else {
            currentDocument = nil
            return
        }

        let title = specPath.lastPathComponent
        currentDocument = DocumentFile(path: specPath.path, content: content, title: title)
    }

    /// Loads the architecture.md file for a given epic
    /// - Parameters:
    ///   - projectPath: The root path of the project
    ///   - epicId: The ID of the epic
    func loadArchitecture(projectPath: String, epicId: String) {
        let projectURL = URL(fileURLWithPath: projectPath)
        let architecturePath = IncPaths.getArchitecturePath(projectRoot: projectURL, epicId: epicId)

        guard let content = loadFile(path: architecturePath) else {
            currentDocument = nil
            return
        }

        let title = architecturePath.lastPathComponent
        currentDocument = DocumentFile(path: architecturePath.path, content: content, title: title)
    }

    /// Closes the currently open document
    func closeDocument() {
        currentDocument = nil
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
