//
//  SyntaxHighlightView.swift
//  Inc
//
//  Syntax-highlighted code viewer using WKWebView and highlight.js
//

import SwiftUI
import WebKit

struct SyntaxHighlightView: View {
    let code: String
    let language: String

    var body: some View {
        WebViewRepresentable(code: code, language: language)
    }
}

// MARK: - WebKit Integration

struct WebViewRepresentable: NSViewRepresentable {
    let code: String
    let language: String

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()

        // Disable JavaScript editing and navigation
        configuration.preferences.setValue(false, forKey: "allowFileAccessFromFileURLs")
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

        let webView = WKWebView(frame: .zero, configuration: configuration)

        // Configure for read-only display
        webView.setValue(false, forKey: "drawsBackground") // Transparent background
        webView.navigationDelegate = context.coordinator

        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        // Load the HTML template with syntax highlighting
        if let htmlContent = generateHTML(code: code, language: language) {
            webView.loadHTMLString(htmlContent, baseURL: nil)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    private func generateHTML(code: String, language: String) -> String? {
        // Load the HTML template from Resources
        guard let templateURL = Bundle.main.url(forResource: "highlight", withExtension: "html"),
              let template = try? String(contentsOf: templateURL) else {
            return nil
        }

        // Escape the code content for HTML
        let escapedCode = code
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")

        // Map common file extensions to highlight.js language identifiers
        let languageMap: [String: String] = [
            "ts": "typescript",
            "tsx": "typescript",
            "js": "javascript",
            "jsx": "javascript",
            "py": "python",
            "swift": "swift",
            "json": "json",
            "md": "markdown",
            "sh": "bash",
            "bash": "bash",
            "zsh": "bash"
        ]

        let highlightLanguage = languageMap[language.lowercased()] ?? language.lowercased()

        // Replace placeholders in template
        let html = template
            .replacingOccurrences(of: "{{CODE}}", with: escapedCode)
            .replacingOccurrences(of: "{{LANGUAGE}}", with: highlightLanguage)

        return html
    }

    // MARK: - Coordinator

    class Coordinator: NSObject, WKNavigationDelegate {
        // Prevent navigation
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .other {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
            }
        }
    }
}

// MARK: - Preview

struct SyntaxHighlightView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // TypeScript example
            SyntaxHighlightView(
                code: """
                interface User {
                    id: string;
                    name: string;
                    email: string;
                }

                function greetUser(user: User): string {
                    return `Hello, ${user.name}!`;
                }
                """,
                language: "typescript"
            )
            .previewDisplayName("TypeScript - Light")
            .preferredColorScheme(.light)

            // Swift example
            SyntaxHighlightView(
                code: """
                struct Epic: Codable {
                    let id: String
                    let title: String
                    let status: EpicStatus
                    let updatedAt: Date
                }

                enum EpicStatus: String, Codable {
                    case planning
                    case coding
                    case reviewing
                    case done
                }
                """,
                language: "swift"
            )
            .previewDisplayName("Swift - Dark")
            .preferredColorScheme(.dark)

            // JSON example
            SyntaxHighlightView(
                code: """
                {
                    "id": "abc123",
                    "title": "Implement SyntaxHighlightView",
                    "status": "coding",
                    "tasks": [
                        { "id": "1", "title": "Create component", "done": true },
                        { "id": "2", "title": "Add tests", "done": false }
                    ]
                }
                """,
                language: "json"
            )
            .previewDisplayName("JSON - Dark")
            .preferredColorScheme(.dark)
        }
        .frame(width: 600, height: 400)
    }
}
