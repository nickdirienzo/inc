//
//  Registry.swift
//  Inc
//
//  Swift model for Inc global registry
//

import Foundation

/// Registry entry model matching TypeScript RegistryEntry interface
struct RegistryEntry: Codable, Identifiable {
    let epicId: String
    let slug: String?
    let projectPath: String
    let description: String
    let createdAt: String
    let updatedAt: String

    /// Use epicId as the Identifiable ID
    var id: String {
        epicId
    }

    /// Parsed createdAt date
    var createdDate: Date? {
        ISO8601DateFormatter().date(from: createdAt)
    }

    /// Parsed updatedAt date
    var updatedDate: Date? {
        ISO8601DateFormatter().date(from: updatedAt)
    }

    /// Display name (slug or short epicId)
    var displayName: String {
        slug ?? String(epicId.prefix(8))
    }
}

/// Registry model matching TypeScript Registry interface
struct Registry: Codable {
    let version: Int
    let entries: [String: RegistryEntry]  // keyed by epicId

    /// Get all entries as an array, sorted by updatedAt descending
    var sortedEntries: [RegistryEntry] {
        entries.values.sorted { entry1, entry2 in
            entry2.updatedAt.compare(entry1.updatedAt) == .orderedAscending
        }
    }

    /// Get entries grouped by project path
    var entriesByProject: [String: [RegistryEntry]] {
        Dictionary(grouping: entries.values, by: { $0.projectPath })
    }

    /// Find an entry by epicId
    func entry(forEpicId epicId: String) -> RegistryEntry? {
        entries[epicId]
    }

    /// Find entries matching a search query (epicId, slug, or description)
    func search(query: String) -> [RegistryEntry] {
        let lowercaseQuery = query.lowercased()
        return entries.values.filter { entry in
            entry.epicId.lowercased().contains(lowercaseQuery) ||
            entry.slug?.lowercased().contains(lowercaseQuery) == true ||
            entry.description.lowercased().contains(lowercaseQuery)
        }.sorted { entry1, entry2 in
            entry2.updatedAt.compare(entry1.updatedAt) == .orderedAscending
        }
    }
}
