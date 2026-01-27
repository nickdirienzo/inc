//
//  ChatView.swift
//  Inc
//
//  Created by Inc Agent
//

import SwiftUI

/// Main chat interface view with message history, input field, and thinking indicator
struct ChatView: View {
    @ObservedObject var viewModel: ChatViewModel

    @State private var isHoveringOverSendButton = false
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Message list
            ScrollViewReader { scrollProxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(viewModel.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }

                        // Thinking indicator
                        if viewModel.isThinking {
                            thinkingIndicator
                                .id("thinking")
                        }
                    }
                    .padding(.vertical, 12)
                }
                .background(Color(nsColor: .textBackgroundColor))
                .onChange(of: viewModel.messages.count) { _ in
                    // Auto-scroll to the latest message
                    scrollToBottom(scrollProxy: scrollProxy)
                }
                .onChange(of: viewModel.isThinking) { _ in
                    // Auto-scroll when thinking indicator appears
                    scrollToBottom(scrollProxy: scrollProxy)
                }
                .onAppear {
                    // Scroll to bottom when view appears
                    scrollToBottom(scrollProxy: scrollProxy)
                }
            }

            Divider()

            // Input area
            inputArea
        }
    }

    // MARK: - Subviews

    private var thinkingIndicator: some View {
        HStack(spacing: 8) {
            ProgressView()
                .scaleEffect(0.7)
                .frame(width: 16, height: 16)

            Text("Agent is typing...")
                .font(.callout)
                .foregroundColor(.secondary)
                .italic()

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private var inputArea: some View {
        HStack(alignment: .bottom, spacing: 12) {
            // Text input field
            TextField("Type your message...", text: $viewModel.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.body)
                .lineLimit(1...6) // Allow multi-line input up to 6 lines
                .padding(10)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(nsColor: .controlBackgroundColor))
                )
                .focused($isInputFocused)
                .onSubmit {
                    sendMessage()
                }
                .disabled(viewModel.isThinking)

            // Send button
            Button(action: sendMessage) {
                Image(systemName: "paperplane.fill")
                    .font(.body)
                    .foregroundColor(canSend ? .accentColor : .secondary)
                    .frame(width: 36, height: 36)
                    .background(
                        Circle()
                            .fill(isHoveringOverSendButton && canSend
                                  ? Color.accentColor.opacity(0.1)
                                  : Color.clear)
                    )
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .onHover { hovering in
                isHoveringOverSendButton = hovering
            }
            .keyboardShortcut(.return, modifiers: [.command])
            .help("Send message (⌘↩)")
        }
        .padding(12)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    // MARK: - Computed Properties

    private var canSend: Bool {
        !viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !viewModel.isThinking
    }

    // MARK: - Methods

    private func sendMessage() {
        guard canSend else { return }

        _Concurrency.Task {
            await viewModel.sendMessage(viewModel.inputText)
        }

        // Refocus input field after sending
        isInputFocused = true
    }

    private func scrollToBottom(scrollProxy: ScrollViewProxy) {
        // Scroll to the thinking indicator if present, otherwise to the last message
        if viewModel.isThinking {
            scrollProxy.scrollTo("thinking", anchor: .bottom)
        } else if let lastMessage = viewModel.messages.last {
            scrollProxy.scrollTo(lastMessage.id, anchor: .bottom)
        }
    }
}

// MARK: - Preview
#if DEBUG
struct ChatView_Previews: PreviewProvider {
    static var previews: some View {
        ChatView(viewModel: {
            let vm = ChatViewModel()
            vm.messages = [
                ChatMessage(role: .user, content: "Hello! Can you help me with this epic?", timestamp: Date().addingTimeInterval(-300)),
                ChatMessage(role: .agent, content: "Of course! I'd be happy to help. What specific aspect would you like assistance with?", timestamp: Date().addingTimeInterval(-280)),
                ChatMessage(role: .user, content: "I need to understand the architecture approach.", timestamp: Date().addingTimeInterval(-260)),
                ChatMessage(role: .techLead, content: "Let me explain the architecture:\n\n1. We're using SwiftUI for the UI layer\n2. MVVM pattern for separation of concerns\n3. Combine for reactive data flow\n4. File watching with DispatchSource\n\nThis approach ensures native performance while maintaining clean code structure.", timestamp: Date().addingTimeInterval(-240)),
                ChatMessage(role: .user, content: "That makes sense. Thanks!", timestamp: Date().addingTimeInterval(-220))
            ]
            return vm
        }())
        .frame(width: 600, height: 500)

        // Preview with thinking indicator
        ChatView(viewModel: {
            let vm = ChatViewModel()
            vm.messages = [
                ChatMessage(role: .user, content: "What should I do next?", timestamp: Date())
            ]
            vm.isThinking = true
            return vm
        }())
        .frame(width: 600, height: 500)

        // Preview with empty state
        ChatView(viewModel: ChatViewModel())
            .frame(width: 600, height: 500)
    }
}
#endif
