//
//  ContextView.swift
//  Inc
//
//  Context pane for viewing files with syntax highlighting
//

import SwiftUI

struct ContextView: View {
    @ObservedObject var viewModel: ContextViewModel

    var body: some View {
        if let file = viewModel.currentFile {
            VStack(spacing: 0) {
                // Header: file path + close button
                ContextHeader(filePath: file.path, onClose: {
                    viewModel.closeFile()
                })

                Divider()

                // Body: Syntax-highlighted code (scrollable)
                ScrollView {
                    SyntaxHighlightView(code: file.content, language: file.language)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                Divider()

                // Footer: line count indicator
                ContextFooter(lineCount: countLines(in: file.content))
            }
        } else {
            // No file open - hide the context pane
            EmptyView()
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

// MARK: - Header Component

struct ContextHeader: View {
    let filePath: String
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            // File path with middle truncation
            Text(truncatedPath)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Close button
            Button(action: onClose) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .help("Close file")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(NSColor.controlBackgroundColor))
    }

    /// Converts absolute path to tilde path and formats for display
    private var truncatedPath: String {
        let nsPath = NSString(string: filePath)
        let homeDir = NSHomeDirectory()

        // Replace home directory with ~
        if filePath.hasPrefix(homeDir) {
            let relativePath = String(filePath.dropFirst(homeDir.count))
            return "~\(relativePath)"
        }

        return filePath
    }
}

// MARK: - Footer Component

struct ContextFooter: View {
    let lineCount: Int

    var body: some View {
        HStack {
            Text("\(lineCount) lines")
                .font(.system(size: 11))
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

// MARK: - Preview

struct ContextView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Preview with file open
            ContextView(viewModel: {
                let vm = ContextViewModel()
                vm.openFile(path: "/Users/test/code/project/src/main.ts")
                return vm
            }())
            .frame(width: 400, height: 600)
            .previewDisplayName("With File - Light")
            .preferredColorScheme(.light)

            // Preview with file open (Dark Mode)
            ContextView(viewModel: {
                let vm = ContextViewModel()
                vm.openFile(path: "/Users/test/code/project/src/components/Button.tsx")
                return vm
            }())
            .frame(width: 400, height: 600)
            .previewDisplayName("With File - Dark")
            .preferredColorScheme(.dark)

            // Preview with no file open
            ContextView(viewModel: ContextViewModel())
                .frame(width: 400, height: 600)
                .previewDisplayName("No File Open")
        }
    }
}
