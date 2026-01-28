//
//  ContentView.swift
//  Inc
//
//  Main split view layout for the application
//

import SwiftUI

struct ContentView: View {
    // MARK: - State Objects

    @StateObject private var epicListViewModel = EpicListViewModel()
    @StateObject private var chatViewModel = ChatViewModel()
    @StateObject private var contextViewModel = ContextViewModel()
    @StateObject private var documentViewModel = DocumentViewModel()
    @StateObject private var rightPaneViewModel = RightPaneViewModel()

    // MARK: - State Properties

    /// Current project root directory (initialized to current working directory)
    @State private var projectRoot: String = FileManager.default.currentDirectoryPath

    /// Trigger for focusing the chat input field
    @State private var shouldFocusChat: Bool = false

    var body: some View {
        HStack(spacing: 0) {
            // Left sidebar: Epic list
            EpicListView(projectRoot: projectRoot, viewModel: epicListViewModel)

            Divider()

            // Center pane: Document action buttons + Chat view
            VStack(spacing: 0) {
                // Document action buttons
                HStack(spacing: 12) {
                    Button("View Spec") {
                        if let selectedEpic = epicListViewModel.selectedEpic {
                            documentViewModel.loadSpec(
                                projectPath: selectedEpic.projectPath,
                                epicId: selectedEpic.epic.id
                            )
                            rightPaneViewModel.showDocument()
                        }
                    }
                    .disabled(epicListViewModel.selectedEpicId == nil)

                    Button("View Architecture") {
                        if let selectedEpic = epicListViewModel.selectedEpic {
                            documentViewModel.loadArchitecture(
                                projectPath: selectedEpic.projectPath,
                                epicId: selectedEpic.epic.id
                            )
                            rightPaneViewModel.showDocument()
                        }
                    }
                    .disabled(epicListViewModel.selectedEpicId == nil)

                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)

                Divider()

                // Chat interface
                ChatView(viewModel: chatViewModel, shouldFocus: $shouldFocusChat)
            }
            .frame(minWidth: 400)

            Divider()

            // Right pane: Context or Document viewer
            Group {
                switch rightPaneViewModel.activeContent {
                case .context:
                    ContextView(viewModel: contextViewModel)
                case .document:
                    DocumentView(viewModel: documentViewModel, onChatAboutEpic: {
                        // Trigger chat focus and optionally add a system message
                        shouldFocusChat = true
                        chatViewModel.addMessage(
                            role: .system,
                            content: "You are now chatting about this epic with PM and Tech Lead agents"
                        )
                    })
                case .none:
                    // Empty state
                    EmptyView()
                }
            }
            .frame(minWidth: 300, idealWidth: 400, maxWidth: 600)
            .background(Color(NSColor.controlBackgroundColor))
            .onChange(of: contextViewModel.currentFile) { file in
                // When context file is opened, show the context pane
                // When context file is closed, hide the right pane
                if file != nil {
                    rightPaneViewModel.showContext()
                } else if rightPaneViewModel.activeContent == .context {
                    rightPaneViewModel.hide()
                }
            }
        }
        .frame(minWidth: 1000, minHeight: 600)
        .onChange(of: epicListViewModel.selectedEpicId) { _ in
            // Update chat view model with selected epic's project root and epic ID
            if let selectedEpic = epicListViewModel.selectedEpic {
                chatViewModel.projectRoot = URL(fileURLWithPath: selectedEpic.projectPath)
                chatViewModel.epicId = selectedEpic.epic.id
            } else {
                chatViewModel.projectRoot = nil
                chatViewModel.epicId = nil
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
