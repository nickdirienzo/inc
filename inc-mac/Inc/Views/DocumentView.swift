//
//  DocumentView.swift
//  Inc
//
//  Document viewer for spec.md and architecture.md files
//

import SwiftUI

struct DocumentView: View {
    @ObservedObject var viewModel: DocumentViewModel

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
                // Header: document title + close button
                ContextHeader(filePath: document.path, onClose: {
                    viewModel.closeDocument()
                })

                Divider()

                // Body: Markdown rendered code (scrollable)
                ScrollView {
                    SyntaxHighlightView(code: document.content, language: "markdown")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
