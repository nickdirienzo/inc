//
//  DocumentView.swift
//  Inc
//
//  Document viewer for spec.md and architecture.md files
//

import SwiftUI

struct DocumentView: View {
    @ObservedObject var viewModel: DocumentViewModel

    /// Callback to trigger when "Chat about this epic" button is clicked
    var onChatAboutEpic: (() -> Void)? = nil

    var body: some View {
        switch viewModel.currentDocument {
        case .none:
            // No document open
            VStack(spacing: 12) {
                Text("No Document Selected")
                    .font(.headline)
                    .foregroundColor(.secondary)
                Text("Click 'View Spec' or 'View Architecture' to view a document")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding()

        case .loaded(let document):
            // Document loaded successfully
            VStack(spacing: 0) {
                // Header: document title + chat button + close button
                documentHeader(document: document)

                Divider()

                // Body: Markdown rendered content (scrollable)
                ScrollView {
                    MarkdownView(content: document.content)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                }
                .overlay(alignment: .topTrailing) {
                    if viewModel.isReloading {
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text("Updating...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(8)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color(NSColor.windowBackgroundColor).opacity(0.9))
                                .shadow(radius: 2)
                        )
                        .padding(.trailing, 12)
                        .padding(.top, 8)
                        .transition(.opacity)
                        .animation(.easeInOut(duration: 0.2), value: viewModel.isReloading)
                    }
                }

                Divider()

                // Footer: line count indicator
                ContextFooter(lineCount: countLines(in: document.content))
            }

        case .error(let message):
            // Error loading document
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 48))
                    .foregroundColor(.secondary)
                Text(message)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                Spacer()
            }
            .padding()
        }
    }

    /// Counts the number of lines in the given content
    /// - Parameter content: The file content
    /// - Returns: The number of lines
    private func countLines(in content: String) -> Int {
        let lines = content.components(separatedBy: .newlines)
        return lines.count
    }

    /// Custom header for document view with chat button
    private func documentHeader(document: DocumentFile) -> some View {
        HStack(spacing: 8) {
            // File path with middle truncation
            Text(truncatedPath(document.path))
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)

            // "Chat about this epic" button
            if let onChatAboutEpic = onChatAboutEpic {
                Button(action: onChatAboutEpic) {
                    HStack(spacing: 4) {
                        Image(systemName: "message.fill")
                            .font(.system(size: 12))
                        Text("Chat about this epic")
                            .font(.system(size: 12))
                    }
                    .foregroundColor(.accentColor)
                }
                .buttonStyle(.plain)
                .help("Start a chat about this epic with PM and Tech Lead agents")
            }

            // Close button
            Button(action: {
                viewModel.closeDocument()
            }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .help("Close document")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(NSColor.windowBackgroundColor))
    }

    /// Truncates a file path for display
    private func truncatedPath(_ path: String) -> String {
        path
    }
}

// MARK: - Preview

struct DocumentView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Preview with document open
            DocumentView(viewModel: {
                let vm = DocumentViewModel()
                // Simulate a loaded spec
                vm.currentDocument = .loaded(DocumentFile(
                    path: "/Users/test/.inc/projects/abc123/epics/test123/spec.md",
                    content: """
                    # Spec: Example Epic

                    ## Goal

                    Build something awesome.

                    ## Requirements

                    - R1: Feature should work
                    - R2: Feature should be fast
                    """,
                    title: "spec.md"
                ))
                return vm
            }())
            .frame(width: 400, height: 600)
            .previewDisplayName("With Document - Light")
            .preferredColorScheme(.light)

            // Preview with no document open
            DocumentView(viewModel: DocumentViewModel())
                .frame(width: 400, height: 600)
                .previewDisplayName("No Document Open")

            // Preview with error state
            DocumentView(viewModel: {
                let vm = DocumentViewModel()
                vm.currentDocument = .error("Spec file not found: /Users/test/.inc/projects/abc123/epics/test123/spec.md")
                return vm
            }())
            .frame(width: 400, height: 600)
            .previewDisplayName("Error State")
        }
    }
}
