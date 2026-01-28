//
//  TUIAgentService.swift
//  Inc
//
//  Service for communicating with the TUI agent via file-based IPC
//  Mirrors the implementation from src/tui/agent/query.ts
//

import Foundation

// Import MessageRole from ChatViewModel for role information in epic chat responses
// Note: MessageRole enum is defined in ChatViewModel.swift

/// Response types from the TUI agent
enum AgentResponse {
    case text(String, role: MessageRole?)
    case thinking
    case complete
    case error(String)
}

/// Service for sending queries to the TUI agent and receiving streamed responses
class TUIAgentService {

    // MARK: - Constants

    private static let requestsDirectoryName = "requests"
    private static let logsDirectoryName = "logs"
    private static let requestType = "tui-query"
    private static let timeout: TimeInterval = 300.0 // 5 minutes - allows for long-running agent workflows
    private static let pollInterval: TimeInterval = 0.1 // 100ms polling interval

    // MARK: - Public API

    /// Send a query to the TUI agent and receive an async stream of responses
    /// - Parameters:
    ///   - message: The user's message/query
    ///   - projectRoot: The project root URL
    /// - Returns: AsyncStream of AgentResponse events
    func sendQuery(_ message: String, projectRoot: URL) async throws -> AsyncStream<AgentResponse> {
        // Generate UUID for this request
        let requestId = UUID().uuidString

        // Write request file
        try await writeRequest(requestId: requestId, message: message, projectRoot: projectRoot)

        // Stream responses by polling log files
        return AsyncStream { continuation in
            _Concurrency.Task {
                do {
                    try await pollForResponse(
                        requestId: requestId,
                        projectRoot: projectRoot,
                        continuation: continuation
                    )
                } catch {
                    continuation.yield(.error(error.localizedDescription))
                    continuation.finish()
                }
            }
        }
    }

    /// Send an epic chat query and receive an async stream of responses with role information
    /// - Parameters:
    ///   - message: The user's message/query
    ///   - epicId: The epic ID
    ///   - projectRoot: The project root URL
    /// - Returns: AsyncStream of AgentResponse events with role information
    func sendEpicChatQuery(message: String, epicId: String, projectRoot: URL) async throws -> AsyncStream<AgentResponse> {
        // Generate UUID for this request
        let requestId = UUID().uuidString

        // Write epic-chat request file
        try await writeEpicChatRequest(requestId: requestId, message: message, epicId: epicId, projectRoot: projectRoot)

        // Stream responses by polling log files with role parsing
        return AsyncStream { continuation in
            _Concurrency.Task {
                do {
                    try await pollForEpicChatResponse(
                        requestId: requestId,
                        projectRoot: projectRoot,
                        continuation: continuation
                    )
                } catch {
                    continuation.yield(.error(error.localizedDescription))
                    continuation.finish()
                }
            }
        }
    }

    // MARK: - Private Implementation

    /// Write the request JSON file to the requests directory
    private func writeRequest(requestId: String, message: String, projectRoot: URL) async throws {
        let requestsDir = getRequestsDir(projectRoot: projectRoot)

        // Ensure requests directory exists
        try FileManager.default.createDirectory(
            at: requestsDir,
            withIntermediateDirectories: true,
            attributes: nil
        )

        // Create request JSON
        let request: [String: Any] = [
            "id": requestId,
            "type": Self.requestType,
            "message": message,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: request, options: [.prettyPrinted])

        // Write to file
        let requestPath = requestsDir.appendingPathComponent("\(requestId).json")
        try jsonData.write(to: requestPath)
    }

    /// Write the epic-chat request JSON file to the requests directory
    private func writeEpicChatRequest(requestId: String, message: String, epicId: String, projectRoot: URL) async throws {
        let requestsDir = getRequestsDir(projectRoot: projectRoot)

        // Ensure requests directory exists
        try FileManager.default.createDirectory(
            at: requestsDir,
            withIntermediateDirectories: true,
            attributes: nil
        )

        // Create epic-chat request JSON
        let request: [String: Any] = [
            "id": requestId,
            "type": "epic-chat",
            "epic_id": epicId,
            "message": message,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: request, options: [.prettyPrinted])

        // Write to file
        let requestPath = requestsDir.appendingPathComponent("\(requestId).json")
        try jsonData.write(to: requestPath)
    }

    /// Poll for agent response by watching log files
    private func pollForResponse(
        requestId: String,
        projectRoot: URL,
        continuation: AsyncStream<AgentResponse>.Continuation
    ) async throws {
        let startTime = Date()
        var lastLogPosition: UInt64 = 0
        var accumulatedText = ""
        var isComplete = false

        // Emit thinking indicator initially
        continuation.yield(.thinking)

        while !isComplete {
            // Check timeout
            if Date().timeIntervalSince(startTime) > Self.timeout {
                throw TUIAgentError.timeout
            }

            // Try to find and read the log file for this request
            if let logFile = try findLogFile(requestId: requestId, projectRoot: projectRoot) {
                let (newText, newPosition, completed) = try readLogIncremental(
                    logFile: logFile,
                    fromPosition: lastLogPosition
                )

                lastLogPosition = newPosition

                // Yield any new text
                if !newText.isEmpty {
                    accumulatedText += newText
                    continuation.yield(.text(newText, role: nil))
                }

                // Check if complete
                if completed {
                    isComplete = true
                    continuation.yield(.complete)
                    continuation.finish()
                    return
                }
            }

            // Sleep before next poll
            try await _Concurrency.Task.sleep(nanoseconds: UInt64(Self.pollInterval * 1_000_000_000))
        }
    }

    /// Poll for epic chat agent response by watching log files and parsing role information
    private func pollForEpicChatResponse(
        requestId: String,
        projectRoot: URL,
        continuation: AsyncStream<AgentResponse>.Continuation
    ) async throws {
        let startTime = Date()
        var lastLogPosition: UInt64 = 0
        var isComplete = false

        // Emit thinking indicator initially
        continuation.yield(.thinking)

        while !isComplete {
            // Check timeout
            if Date().timeIntervalSince(startTime) > Self.timeout {
                throw TUIAgentError.timeout
            }

            // Try to find and read the log file for this request
            if let logFile = try findLogFile(requestId: requestId, projectRoot: projectRoot) {
                let (responses, newPosition, completed) = try readEpicChatLogIncremental(
                    logFile: logFile,
                    fromPosition: lastLogPosition
                )

                lastLogPosition = newPosition

                // Yield all responses with role information
                for response in responses {
                    continuation.yield(response)
                }

                // Check if complete
                if completed {
                    isComplete = true
                    continuation.yield(.complete)
                    continuation.finish()
                    return
                }
            }

            // Sleep before next poll
            try await _Concurrency.Task.sleep(nanoseconds: UInt64(Self.pollInterval * 1_000_000_000))
        }
    }

    /// Find the log file that corresponds to this request
    private func findLogFile(requestId: String, projectRoot: URL) throws -> URL? {
        let projectIncDir = IncPaths.getProjectIncDir(projectRoot: projectRoot)

        // Look for log files in the project's log directory
        // The daemon creates log files like: ~/.inc/projects/<hash>/logs/agent-<timestamp>.jsonl
        // We need to find logs that contain our request ID

        // For simplicity, we'll check the main logs directory
        // In a real implementation, we'd need to know which epic this belongs to
        let logsDir = projectIncDir.appendingPathComponent(Self.logsDirectoryName)

        guard FileManager.default.fileExists(atPath: logsDir.path) else {
            return nil
        }

        let files = try FileManager.default.contentsOfDirectory(
            at: logsDir,
            includingPropertiesForKeys: [.creationDateKey],
            options: [.skipsHiddenFiles]
        )

        // Find the most recent log file
        let sortedFiles = files.sorted { file1, file2 in
            let date1 = (try? file1.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date.distantPast
            let date2 = (try? file2.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? Date.distantPast
            return date1 > date2
        }

        // Return the most recent log file
        return sortedFiles.first
    }

    /// Read log file incrementally from a given position
    /// Returns: (new text, new position, is complete)
    private func readLogIncremental(
        logFile: URL,
        fromPosition: UInt64
    ) throws -> (String, UInt64, Bool) {
        guard let fileHandle = try? FileHandle(forReadingFrom: logFile) else {
            return ("", fromPosition, false)
        }

        defer {
            try? fileHandle.close()
        }

        // Seek to last read position
        if fromPosition > 0 {
            try fileHandle.seek(toOffset: fromPosition)
        }

        // Read new data
        let data = fileHandle.readDataToEndOfFile()
        let newPosition = fromPosition + UInt64(data.count)

        guard let content = String(data: data, encoding: .utf8) else {
            return ("", newPosition, false)
        }

        // Parse JSONL entries
        let lines = content.components(separatedBy: .newlines).filter { !$0.isEmpty }
        var accumulatedText = ""
        var isComplete = false

        for line in lines {
            guard let jsonData = line.data(using: .utf8),
                  let entry = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
                continue
            }

            // Extract text from log entries
            // Log entries have format: { type: "text" | "thinking" | "complete", content: string }
            if let type = entry["type"] as? String {
                switch type {
                case "text":
                    if let text = entry["content"] as? String {
                        accumulatedText += text
                    }
                case "complete":
                    isComplete = true
                case "error":
                    if let errorMsg = entry["content"] as? String {
                        accumulatedText += errorMsg
                    }
                    isComplete = true
                default:
                    break
                }
            }
        }

        return (accumulatedText, newPosition, isComplete)
    }

    /// Read epic chat log file incrementally from a given position with role parsing
    /// Returns: (array of responses, new position, is complete)
    private func readEpicChatLogIncremental(
        logFile: URL,
        fromPosition: UInt64
    ) throws -> ([AgentResponse], UInt64, Bool) {
        guard let fileHandle = try? FileHandle(forReadingFrom: logFile) else {
            return ([], fromPosition, false)
        }

        defer {
            try? fileHandle.close()
        }

        // Seek to last read position
        if fromPosition > 0 {
            try fileHandle.seek(toOffset: fromPosition)
        }

        // Read new data
        let data = fileHandle.readDataToEndOfFile()
        let newPosition = fromPosition + UInt64(data.count)

        guard let content = String(data: data, encoding: .utf8) else {
            return ([], newPosition, false)
        }

        // Parse JSONL entries
        let lines = content.components(separatedBy: .newlines).filter { !$0.isEmpty }
        var responses: [AgentResponse] = []
        var isComplete = false

        for line in lines {
            guard let jsonData = line.data(using: .utf8),
                  let entry = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
                continue
            }

            // Extract type and role from log entries
            // Epic chat log entries have format: { type: "text" | "complete" | "error", role: "pm" | "tech_lead", content: string }
            if let type = entry["type"] as? String {
                switch type {
                case "text":
                    if let text = entry["content"] as? String {
                        // Parse role from entry
                        let role = parseMessageRole(from: entry["role"] as? String)
                        responses.append(.text(text, role: role))
                    }
                case "complete":
                    isComplete = true
                case "error":
                    if let errorMsg = entry["content"] as? String {
                        responses.append(.error(errorMsg))
                    }
                    isComplete = true
                default:
                    break
                }
            }
        }

        return (responses, newPosition, isComplete)
    }

    /// Parse MessageRole from string representation
    private func parseMessageRole(from roleString: String?) -> MessageRole? {
        guard let roleString = roleString else {
            return nil
        }

        switch roleString {
        case "pm":
            return .pm
        case "tech_lead":
            return .techLead
        case "user":
            return .user
        case "system":
            return .system
        case "coder":
            return .coder
        case "agent":
            return .agent
        default:
            return nil
        }
    }

    // MARK: - Path Utilities

    /// Get the requests directory for a project
    private func getRequestsDir(projectRoot: URL) -> URL {
        return IncPaths.getProjectIncDir(projectRoot: projectRoot)
            .appendingPathComponent(Self.requestsDirectoryName)
    }
}

// MARK: - Errors

enum TUIAgentError: LocalizedError {
    case timeout
    case invalidResponse
    case fileNotFound

    var errorDescription: String? {
        switch self {
        case .timeout:
            return "Agent did not respond within 5 minutes"
        case .invalidResponse:
            return "Received invalid response from agent"
        case .fileNotFound:
            return "Agent log file not found"
        }
    }
}
