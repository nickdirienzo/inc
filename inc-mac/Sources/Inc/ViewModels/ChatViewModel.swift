//
//  ChatViewModel.swift
//  Inc
//
//  Created by Inc Agent
//

import Foundation
import Combine

/// Represents a single chat message
struct ChatMessage: Identifiable, Codable {
    let id: UUID
    let role: MessageRole
    let content: String
    let timestamp: Date

    init(id: UUID = UUID(), role: MessageRole, content: String, timestamp: Date = Date()) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
    }
}

/// Role of the message sender
enum MessageRole: String, Codable {
    case user
    case agent
    case pm
    case techLead = "tech_lead"
    case coder
    case system

    var displayName: String {
        switch self {
        case .user: return "You"
        case .agent: return "Agent"
        case .pm: return "PM"
        case .techLead: return "Tech Lead"
        case .coder: return "Coder"
        case .system: return "System"
        }
    }

    var color: String {
        switch self {
        case .user: return "blue"
        case .agent: return "green"
        case .pm: return "purple"
        case .techLead: return "orange"
        case .coder: return "teal"
        case .system: return "gray"
        }
    }
}

/// ViewModel for managing chat state and interactions
@MainActor
class ChatViewModel: ObservableObject {
    /// Array of chat messages (max 20 messages to match TUI)
    @Published var messages: [ChatMessage] = []

    /// Whether the agent is currently thinking/processing
    @Published var isThinking: Bool = false

    /// Current text input from the user
    @Published var inputText: String = ""

    /// Maximum number of messages to keep in history
    private let maxMessageHistory = 100

    /// The root URL of the selected epic project
    @Published var projectRoot: URL?

    /// The ID of the selected epic (for epic chat mode)
    @Published var epicId: String? {
        didSet {
            if epicId != oldValue {
                _Concurrency.Task {
                    await loadChatHistory()
                }
            }
        }
    }

    /// TUI Agent Service for communicating with the agent
    private let tuiService = TUIAgentService()

    init() {
        // Initialize with empty state
    }

    /// Send a message to the agent
    func sendMessage(_ content: String) async {
        // Trim whitespace
        let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedContent.isEmpty else {
            return
        }

        // Add user message
        let userMessage = ChatMessage(role: .user, content: trimmedContent)
        appendMessage(userMessage)

        // Append user message to history if in epic chat mode
        if epicId != nil {
            await appendMessageToHistory(userMessage)
        }

        // Clear input
        inputText = ""

        // Check if a project is selected
        guard let projectRoot = projectRoot else {
            addMessage(role: .system, content: "No epic selected. Please select an epic to chat with the agent.")
            return
        }

        // Ensure isThinking is always reset
        defer {
            isThinking = false
        }

        // Set thinking state
        isThinking = true

        do {
            // Choose the appropriate service method based on whether epicId is set
            let stream: AsyncStream<AgentResponse>
            if let epicId = epicId {
                // Use epic chat query for multi-agent epic chat
                stream = try await tuiService.sendEpicChatQuery(
                    message: trimmedContent,
                    epicId: epicId,
                    projectRoot: projectRoot
                )
            } else {
                // Use regular query for non-epic chat
                stream = try await tuiService.sendQuery(trimmedContent, projectRoot: projectRoot)
            }

            // Variable to accumulate text for current agent message
            var currentAgentMessage: ChatMessage?

            // Process streamed responses
            for await response in stream {
                switch response {
                case .text(let text, let role):
                    // Accumulate text into the current agent message
                    if var message = currentAgentMessage {
                        // Update existing message content
                        message = ChatMessage(
                            id: message.id,
                            role: message.role,
                            content: message.content + text,
                            timestamp: message.timestamp
                        )
                        currentAgentMessage = message

                        // Update the message in the array
                        if let index = messages.firstIndex(where: { $0.id == message.id }) {
                            messages[index] = message
                        }
                    } else {
                        // Create new agent message with appropriate role
                        let messageRole = role ?? .agent
                        let message = ChatMessage(role: messageRole, content: text)
                        currentAgentMessage = message
                        appendMessage(message)
                    }

                case .thinking:
                    // Already handled by isThinking property
                    break

                case .complete:
                    // Response complete - append agent message to history if in epic chat mode
                    if let agentMessage = currentAgentMessage, epicId != nil {
                        await appendMessageToHistory(agentMessage)
                    }
                    isThinking = false

                case .error(let errorMessage):
                    // Show error as system message
                    addMessage(role: .system, content: "Agent error: \(errorMessage)")
                    isThinking = false
                }
            }
        } catch {
            // Handle connection errors
            addMessage(
                role: .system,
                content: "Failed to connect to agent service. Make sure the Inc daemon is running. Error: \(error.localizedDescription)"
            )
        }
    }

    /// Clear all messages
    func clearMessages() {
        messages.removeAll()
    }

    /// Load chat history from chat.jsonl file
    func loadChatHistory() async {
        // Clear existing messages
        messages.removeAll()

        // Check if epicId and projectRoot are set
        guard let epicId = epicId, let projectRoot = projectRoot else {
            return
        }

        // Get path to chat.jsonl
        let chatHistoryPath = getChatHistoryPath(projectRoot: projectRoot, epicId: epicId)

        // Check if file exists
        guard FileManager.default.fileExists(atPath: chatHistoryPath.path) else {
            // No chat history yet - this is normal for new epics
            return
        }

        do {
            // Read the chat.jsonl file
            let content = try String(contentsOf: chatHistoryPath, encoding: .utf8)

            // Parse JSONL entries
            let lines = content.components(separatedBy: .newlines).filter { !$0.isEmpty }

            for line in lines {
                guard let jsonData = line.data(using: .utf8),
                      let entry = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
                    continue
                }

                // Parse role, content, and timestamp
                guard let roleString = entry["role"] as? String,
                      let content = entry["content"] as? String,
                      let timestampString = entry["timestamp"] as? String else {
                    continue
                }

                // Parse role
                let role = MessageRole(rawValue: roleString) ?? .system

                // Parse timestamp
                let timestamp: Date
                if let date = ISO8601DateFormatter().date(from: timestampString) {
                    timestamp = date
                } else {
                    timestamp = Date()
                }

                // Create and append message
                let message = ChatMessage(role: role, content: content, timestamp: timestamp)
                messages.append(message)
            }
        } catch {
            // Failed to read chat history - log error but don't crash
            print("Failed to load chat history: \(error)")
        }
    }

    /// Get the path to chat.jsonl for a given epic
    private func getChatHistoryPath(projectRoot: URL, epicId: String) -> URL {
        return IncPaths.getEpicsDir(projectRoot: projectRoot)
            .appendingPathComponent(epicId)
            .appendingPathComponent("chat.jsonl")
    }

    /// Append a message to chat.jsonl file
    private func appendMessageToHistory(_ message: ChatMessage) async {
        // Check if epicId and projectRoot are set
        guard let epicId = epicId, let projectRoot = projectRoot else {
            return
        }

        // Get path to chat.jsonl
        let chatHistoryPath = getChatHistoryPath(projectRoot: projectRoot, epicId: epicId)

        // Ensure the epic directory exists
        let epicDir = chatHistoryPath.deletingLastPathComponent()
        try? FileManager.default.createDirectory(
            at: epicDir,
            withIntermediateDirectories: true,
            attributes: nil
        )

        // Create JSONL entry
        let entry: [String: Any] = [
            "role": message.role.rawValue,
            "content": message.content,
            "timestamp": ISO8601DateFormatter().string(from: message.timestamp)
        ]

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: entry, options: [])
            guard var jsonString = String(data: jsonData, encoding: .utf8) else {
                return
            }
            jsonString += "\n"

            // Append to file
            if let fileHandle = try? FileHandle(forWritingTo: chatHistoryPath) {
                defer {
                    try? fileHandle.close()
                }
                fileHandle.seekToEndOfFile()
                if let data = jsonString.data(using: .utf8) {
                    fileHandle.write(data)
                }
            } else {
                // File doesn't exist yet - create it
                try jsonString.write(to: chatHistoryPath, atomically: true, encoding: .utf8)
            }
        } catch {
            print("Failed to append message to chat history: \(error)")
        }
    }

    /// Add a user message to the chat
    private func addUserMessage(_ content: String) {
        let message = ChatMessage(role: .user, content: content)
        appendMessage(message)
    }

    /// Add an agent message to the chat
    private func addAgentMessage(_ content: String) {
        let message = ChatMessage(role: .agent, content: content)
        appendMessage(message)
    }

    /// Append a message and enforce history limit
    private func appendMessage(_ message: ChatMessage) {
        messages.append(message)

        // Enforce max history limit (remove oldest messages)
        if messages.count > maxMessageHistory {
            messages.removeFirst(messages.count - maxMessageHistory)
        }
    }

    /// Add a message from a specific role (for agent service integration)
    func addMessage(role: MessageRole, content: String) {
        let message = ChatMessage(role: role, content: content)
        appendMessage(message)
    }
}
