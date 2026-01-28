//
//  MarkdownView.swift
//  Inc
//
//  Renders markdown content using AttributedString
//

import SwiftUI

struct MarkdownView: View {
    let content: String

    var body: some View {
        if let attributedString = try? AttributedString(markdown: content, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)) {
            Text(attributedString)
                .textSelection(.enabled)
        } else {
            Text(content)
                .textSelection(.enabled)
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
        """)
        .padding()
    }
}
