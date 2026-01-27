//
//  Epic.swift
//  Inc
//
//  Swift model for Inc epic state
//

import Foundation

/// Epic status values matching TypeScript EpicStatus type
enum EpicStatus: String, Codable, CaseIterable {
    case new
    case spec_in_progress
    case spec_complete
    case plan_in_progress
    case plan_complete
    case coding
    case review
    case done
    case abandoned

    /// Display name for UI presentation
    var displayName: String {
        switch self {
        case .new:
            return "New"
        case .spec_in_progress:
            return "Spec In Progress"
        case .spec_complete:
            return "Spec Complete"
        case .plan_in_progress:
            return "Plan In Progress"
        case .plan_complete:
            return "Plan Complete"
        case .coding:
            return "Coding"
        case .review:
            return "Review"
        case .done:
            return "Done"
        case .abandoned:
            return "Abandoned"
        }
    }

    /// Whether this status indicates the epic is "in flight"
    var isInFlight: Bool {
        switch self {
        case .spec_in_progress, .spec_complete, .plan_in_progress, .plan_complete, .coding, .review:
            return true
        case .new, .done, .abandoned:
            return false
        }
    }
}

/// Epic model matching TypeScript Epic interface
struct Epic: Codable, Identifiable {
    let id: String
    let slug: String
    let description: String
    let status: EpicStatus
    let created_at: String
    let updated_at: String
    let needs_attention: NeedsAttention?
    let pr_number: Int?
    let workspace_path: String?
    let merged_at: String?

    /// Parsed created_at date
    var createdDate: Date? {
        ISO8601DateFormatter().date(from: created_at)
    }

    /// Parsed updated_at date
    var updatedDate: Date? {
        ISO8601DateFormatter().date(from: updated_at)
    }

    /// Whether this epic needs attention
    var needsAttention: Bool {
        needs_attention != nil
    }
}

/// Enriched epic data combining registry, epic, and tasks information
struct EpicWithTasks: Identifiable {
    let epic: Epic
    let registryEntry: RegistryEntry
    let tasksFile: TasksFile?

    /// Use epic.id as the Identifiable ID
    var id: String {
        epic.id
    }

    /// Display name from registry (slug or short ID)
    var displayName: String {
        registryEntry.displayName
    }

    /// Project path from registry
    var projectPath: String {
        registryEntry.projectPath
    }

    /// Task progress (0.0 to 1.0)
    var taskProgress: Double {
        tasksFile?.progress ?? 0.0
    }

    /// Task progress string (e.g., "3/5")
    var taskProgressString: String {
        tasksFile?.progressString ?? "0/0"
    }

    /// Whether this epic has tasks
    var hasTasks: Bool {
        tasksFile != nil && (tasksFile?.totalCount ?? 0) > 0
    }
}
