//
//  RightPaneViewModel.swift
//  Inc
//
//  Coordinates between DocumentView and ContextView in the right pane
//

import Foundation
import Combine

/// Represents the type of content displayed in the right pane
enum RightPaneContent {
    case none
    case document
    case context
}

/// View model for coordinating the right pane content
@MainActor
class RightPaneViewModel: ObservableObject {
    /// The currently active content type in the right pane
    @Published var activeContent: RightPaneContent = .none

    /// Shows the document view in the right pane
    func showDocument() {
        activeContent = .document
    }

    /// Shows the context view in the right pane
    func showContext() {
        activeContent = .context
    }

    /// Hides all content in the right pane
    func hide() {
        activeContent = .none
    }
}
