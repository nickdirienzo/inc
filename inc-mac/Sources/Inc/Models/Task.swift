//
//  Task.swift
//  Inc
//
//  Swift model for Inc task state
//

import Foundation

/// Task status values matching TypeScript TaskStatus type
enum TaskStatus: String, Codable, CaseIterable {
    case not_started
    case in_progress
    case done
    case blocked
    case failed

    /// Display name for UI presentation
    var displayName: String {
        switch self {
        case .not_started:
            return "Not Started"
        case .in_progress:
            return "In Progress"
        case .done:
            return "Done"
        case .blocked:
            return "Blocked"
        case .failed:
            return "Failed"
        }
    }

    /// Whether this status indicates the task is completed
    var isComplete: Bool {
        self == .done
    }

    /// Whether this status indicates the task is active
    var isActive: Bool {
        self == .in_progress
    }
}

/// Task model matching TypeScript Task interface
struct Task: Codable, Identifiable {
    let id: Int
    let name: String
    let description: String
    let status: TaskStatus
    let blocked_by: [Int]
    let assignee: String?
    let jj_commit: String?
    let feedback: String?

    /// Whether this task is blocked by other tasks
    var isBlocked: Bool {
        !blocked_by.isEmpty || status == .blocked
    }

    /// Whether this task has an assignee
    var isAssigned: Bool {
        assignee != nil
    }
}

/// TasksFile wrapper matching TypeScript TasksFile interface
struct TasksFile: Codable {
    let tasks: [Task]

    /// Count of completed tasks
    var completedCount: Int {
        tasks.filter { $0.status.isComplete }.count
    }

    /// Total number of tasks
    var totalCount: Int {
        tasks.count
    }

    /// Progress as a fraction (0.0 to 1.0)
    var progress: Double {
        guard totalCount > 0 else { return 0.0 }
        return Double(completedCount) / Double(totalCount)
    }

    /// Progress as a formatted string (e.g., "3/5")
    var progressString: String {
        "\(completedCount)/\(totalCount)"
    }
}
