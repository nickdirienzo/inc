//
//  ContextViewModel.swift
//  Inc
//
//  Manages file viewing in the context pane
//

import Foundation
import Combine

/// Represents a file displayed in the context pane
struct ContextFile {
    let path: String
    let content: String
    let language: String
}

/// View model for the context pane that displays file contents
class ContextViewModel: ObservableObject {
    @Published var currentFile: ContextFile? = nil

    /// Opens a file at the specified path and loads its content
    /// - Parameter path: The absolute path to the file to open
    func openFile(path: String) {
        guard let content = loadFileContent(path: path) else {
            // If file cannot be loaded, set currentFile to nil
            currentFile = nil
            return
        }

        let language = detectLanguage(path: path)
        currentFile = ContextFile(path: path, content: content, language: language)
    }

    /// Closes the currently open file
    func closeFile() {
        currentFile = nil
    }

    /// Loads the content of a file from disk
    /// - Parameter path: The absolute path to the file
    /// - Returns: The file content as a string, or nil if the file cannot be read
    private func loadFileContent(path: String) -> String? {
        // Expand ~ in path if present
        let expandedPath = NSString(string: path).expandingTildeInPath

        // Try to read the file content
        guard let content = try? String(contentsOfFile: expandedPath, encoding: .utf8) else {
            return nil
        }

        return content
    }

    /// Detects the programming language from the file extension
    /// - Parameter path: The file path
    /// - Returns: The language identifier for syntax highlighting
    private func detectLanguage(path: String) -> String {
        let pathExtension = (path as NSString).pathExtension.lowercased()

        // Map file extensions to language identifiers for syntax highlighting
        switch pathExtension {
        case "swift":
            return "swift"
        case "ts":
            return "typescript"
        case "tsx":
            return "typescript"
        case "js":
            return "javascript"
        case "jsx":
            return "javascript"
        case "json":
            return "json"
        case "md":
            return "markdown"
        case "py":
            return "python"
        case "rb":
            return "ruby"
        case "go":
            return "go"
        case "rs":
            return "rust"
        case "java":
            return "java"
        case "kt":
            return "kotlin"
        case "c":
            return "c"
        case "cpp", "cc", "cxx":
            return "cpp"
        case "h", "hpp":
            return "cpp"
        case "cs":
            return "csharp"
        case "php":
            return "php"
        case "html", "htm":
            return "html"
        case "css":
            return "css"
        case "scss", "sass":
            return "scss"
        case "xml":
            return "xml"
        case "yaml", "yml":
            return "yaml"
        case "toml":
            return "toml"
        case "sql":
            return "sql"
        case "sh", "bash":
            return "bash"
        case "zsh":
            return "bash"
        case "fish":
            return "bash"
        case "vim":
            return "vim"
        case "r":
            return "r"
        case "dockerfile":
            return "dockerfile"
        case "makefile":
            return "makefile"
        default:
            return "plaintext"
        }
    }
}
