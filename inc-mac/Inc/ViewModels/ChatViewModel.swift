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

        // Set thinking state
        isThinking = true

        // TODO: Wire to TUIAgentService in task 13
        // For now, just add a placeholder agent response
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second

        addAgentMessage("This is a placeholder response. TUIAgentService will be wired in task 13.")

        isThinking = false
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
