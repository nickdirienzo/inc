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
    let question: String?
    let message: String?
    let escalation_count: Int?

    var text: String {
        question ?? message ?? ""
    }

    var escalationCount: Int {
        escalation_count ?? 0
    }

    var isEscalated: Bool {
        escalationCount > 0
    }

    var summary: String {
        "\(from.displayName) → \(to.displayName): \(text)"
    }
}
