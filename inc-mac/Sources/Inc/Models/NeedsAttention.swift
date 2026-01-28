//
//  NeedsAttention.swift
//  Inc
//
//  Swift model for Inc needs attention state
//

import Foundation

/// Role enum for NeedsAttention from/to fields
enum AttentionRole: String, Codable {
    case pm
    case tech_lead
    case coder
    case em
    case user

    /// Display name for UI presentation
    var displayName: String {
        switch self {
        case .pm:
            return "PM"
        case .tech_lead:
            return "Tech Lead"
        case .coder:
            return "Coder"
        case .em:
            return "EM"
        case .user:
            return "User"
        }
    }
}

/// NeedsAttention model matching TypeScript NeedsAttention interface
struct NeedsAttention: Codable {
    let from: AttentionRole
    let to: AttentionRole
    let question: String
    let escalation_count: Int?

    /// Number of escalations (defaults to 0 if not set)
    var escalationCount: Int {
        escalation_count ?? 0
    }

    /// Whether this has been escalated
    var isEscalated: Bool {
        escalationCount > 0
    }

    /// Formatted summary for display (e.g., "PM → User: What should we do?")
    var summary: String {
        "\(from.displayName) → \(to.displayName): \(question)"
    }
}
