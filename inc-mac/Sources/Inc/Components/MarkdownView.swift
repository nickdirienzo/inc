//
//  MarkdownView.swift
//  Inc
//
//  Renders markdown content using MarkdownUI
//

import SwiftUI
import MarkdownUI

struct MarkdownView: View {
    let content: String
    @State private var parsedContent: MarkdownContent?

    var body: some View {
        Group {
            if let parsedContent {
                Markdown(parsedContent)
                    .textSelection(.enabled)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .task(id: content) {
            parsedContent = nil
            let markdown = content
            let parsed = await withCheckedContinuation { continuation in
                DispatchQueue.global(qos: .userInitiated).async {
                    let result = MarkdownContent(markdown)
                    continuation.resume(returning: result)
                }
            }
            parsedContent = parsed
        }
    }
}

struct MarkdownView_Previews: PreviewProvider {
    static var previews: some View {
        MarkdownView(content: """
        # Heading 1

        ## Heading 2

        This is **bold** and *italic* text.

        - Item 1
        - Item 2
        - Item 3

        `inline code`

        ```swift
        func hello() {
            print("Hello, world!")
        }
        ```
        """)
        .padding()
    }
}
