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
    private let maxMessageHistory = 20

    /// The root URL of the selected epic project
    @Published var projectRoot: URL?

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
        addUserMessage(trimmedContent)

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
            // Send query to TUI agent service
            let stream = try await tuiService.sendQuery(trimmedContent, projectRoot: projectRoot)

            // Variable to accumulate text for current agent message
            var currentAgentMessage: ChatMessage?

            // Process streamed responses
            for await response in stream {
                switch response {
                case .text(let text):
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
                        // Create new agent message
                        let message = ChatMessage(role: .agent, content: text)
                        currentAgentMessage = message
                        appendMessage(message)
                    }

                case .thinking:
                    // Already handled by isThinking property
                    break

                case .complete:
                    // Response complete
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
