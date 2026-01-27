//
//  ContentView.swift
//  Inc
//
//  Main split view layout for the application
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        HStack(spacing: 0) {
            // Placeholder for epic list (left sidebar)
            VStack {
                Text("Epic List")
                    .font(.headline)
                    .padding()
                Spacer()
            }
            .frame(minWidth: 250, idealWidth: 300, maxWidth: 400)
            .background(Color(NSColor.controlBackgroundColor))

            Divider()

            // Placeholder for chat view (center pane)
            VStack {
                Text("Chat Interface")
                    .font(.headline)
                    .padding()
                Spacer()
            }
            .frame(minWidth: 400)

            Divider()

            // Placeholder for context view (right pane)
            VStack {
                Text("Context Pane")
                    .font(.headline)
                    .padding()
                Spacer()
            }
            .frame(minWidth: 300, idealWidth: 400, maxWidth: 600)
            .background(Color(NSColor.controlBackgroundColor))
        }
        .frame(minWidth: 1000, minHeight: 600)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
