//
//  MessageBubble.swift
//  Inc
//
//  Created by Inc Agent
//

import SwiftUI

/// A chat message bubble that displays role, timestamp, and content
struct MessageBubble: View {
    let message: ChatMessage

    // Shared date formatter for timestamp display
    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    private var roleColor: Color {
        switch message.role {
        case .user:
            return .blue
        case .agent:
            return .green
        case .pm:
            return .purple
        case .techLead:
            return .orange
        case .coder:
            return .cyan
        case .system:
            return .gray
        }
    }

    private var isUserMessage: Bool {
        message.role == .user
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if isUserMessage {
                Spacer(minLength: 60)
            }

            VStack(alignment: isUserMessage ? .trailing : .leading, spacing: 4) {
                // Header with role and timestamp
                HStack(spacing: 6) {
                    Text(message.role.displayName)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(roleColor)

                    Text(Self.dateFormatter.string(from: message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                // Message content
                Text(message.content)
                    .font(.body)
                    .foregroundColor(.primary)
                    .textSelection(.enabled)
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(isUserMessage ? Color.blue.opacity(0.1) : Color(nsColor: .controlBackgroundColor))
                    )
                    .frame(maxWidth: .infinity, alignment: isUserMessage ? .trailing : .leading)
            }

            if !isUserMessage {
                Spacer(minLength: 60)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
    }
}

// MARK: - Preview
#if DEBUG
struct MessageBubble_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            MessageBubble(message: ChatMessage(
                role: .user,
                content: "Hello, can you help me with this epic?"
            ))

            MessageBubble(message: ChatMessage(
                role: .agent,
                content: "Of course! I'd be happy to help. What would you like to know?"
            ))

            MessageBubble(message: ChatMessage(
                role: .pm,
                content: "Let me review the spec and get back to you."
            ))

            MessageBubble(message: ChatMessage(
                role: .techLead,
                content: "Here's the architecture approach I recommend:\n\n1. Use SwiftUI for the UI layer\n2. Implement MVVM pattern\n3. Use Combine for reactive updates"
            ))

            MessageBubble(message: ChatMessage(
                role: .coder,
                content: "I've completed the implementation. Ready for review!"
            ))
        }
        .padding()
        .frame(maxWidth: 600)
    }
}
#endif
