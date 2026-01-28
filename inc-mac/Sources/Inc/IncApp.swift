//
//  IncApp.swift
//  Inc
//
//  Main app entry point for Inc Mission Control
//

import SwiftUI

@main
struct IncApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .commands {
            // Standard macOS commands
            CommandGroup(replacing: .newItem) { }
        }
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified)
    }
}
