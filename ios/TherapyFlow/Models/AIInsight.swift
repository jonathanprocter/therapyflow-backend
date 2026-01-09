import Foundation
import SwiftUI

// MARK: - Date Parsing Helpers for AIInsight
private enum AIInsightDateParsingHelper {
    static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let iso8601FormatterNoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let fallbackFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    static func parseDate(from string: String) -> Date? {
        if let date = iso8601Formatter.date(from: string) {
            return date
        }
        if let date = iso8601FormatterNoFractional.date(from: string) {
            return date
        }
        if let date = fallbackFormatter.date(from: string) {
            return date
        }
        if let date = dateOnlyFormatter.date(from: string) {
            return date
        }
        return nil
    }
}

// MARK: - AI Insight Model
struct AIInsight: Identifiable, Codable, Equatable {
    let id: String
    var clientId: String?
    let therapistId: String
    var type: InsightType
    var title: String
    var description: String
    var priority: InsightPriority
    var isRead: Bool
    var metadata: InsightMetadata?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case therapistId = "therapist_id"
        case type
        case title
        case description
        case priority
        case isRead = "is_read"
        case metadata
        case createdAt = "created_at"
    }

    init(id: String = UUID().uuidString,
         clientId: String? = nil,
         therapistId: String,
         type: InsightType,
         title: String,
         description: String,
         priority: InsightPriority = .medium,
         isRead: Bool = false,
         metadata: InsightMetadata? = nil,
         createdAt: Date = Date()) {
        self.id = id
        self.clientId = clientId
        self.therapistId = therapistId
        self.type = type
        self.title = title
        self.description = description
        self.priority = priority
        self.isRead = isRead
        self.metadata = metadata
        self.createdAt = createdAt
    }

    // Custom decoder to handle date formats and optional fields
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        therapistId = try container.decode(String.self, forKey: .therapistId)
        type = try container.decodeIfPresent(InsightType.self, forKey: .type) ?? .unknown
        title = try container.decode(String.self, forKey: .title)
        description = try container.decode(String.self, forKey: .description)
        priority = try container.decodeIfPresent(InsightPriority.self, forKey: .priority) ?? .medium
        isRead = try container.decodeIfPresent(Bool.self, forKey: .isRead) ?? false
        metadata = try container.decodeIfPresent(InsightMetadata.self, forKey: .metadata)

        // Handle createdAt - Date or String format
        if let value = try? container.decode(Date.self, forKey: .createdAt) {
            createdAt = value
        } else if let stringValue = try? container.decode(String.self, forKey: .createdAt),
                  let parsedDate = AIInsightDateParsingHelper.parseDate(from: stringValue) {
            createdAt = parsedDate
        } else {
            createdAt = Date()
        }
    }
}

// MARK: - Insight Type
enum InsightType: String, Codable, CaseIterable {
    case patternRecognition = "pattern_recognition"
    case progressMilestone = "progress_milestone"
    case riskAlert = "risk_alert"
    case resourceMatch = "resource_match"
    case treatmentSuggestion = "treatment_suggestion"
    case sessionPrep = "session_prep"
    case unknown

    var displayName: String {
        switch self {
        case .patternRecognition: return "Pattern Recognition"
        case .progressMilestone: return "Progress Milestone"
        case .riskAlert: return "Risk Alert"
        case .resourceMatch: return "Resource Match"
        case .treatmentSuggestion: return "Treatment Suggestion"
        case .sessionPrep: return "Session Prep"
        case .unknown: return "Insight"
        }
    }

    var icon: String {
        switch self {
        case .patternRecognition: return "brain"
        case .progressMilestone: return "flag.checkered"
        case .riskAlert: return "exclamationmark.triangle"
        case .resourceMatch: return "book"
        case .treatmentSuggestion: return "lightbulb"
        case .sessionPrep: return "list.clipboard"
        case .unknown: return "sparkles"
        }
    }

    var color: Color {
        switch self {
        case .patternRecognition: return .purple
        case .progressMilestone: return .green
        case .riskAlert: return .red
        case .resourceMatch: return .blue
        case .treatmentSuggestion: return .orange
        case .sessionPrep: return .teal
        case .unknown: return .gray
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = InsightType(rawValue: rawValue) ?? .unknown
    }
}

// MARK: - Insight Priority
enum InsightPriority: String, Codable, CaseIterable, Comparable {
    case low
    case medium
    case high
    case urgent
    case unknown

    var displayName: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .urgent: return "Urgent"
        case .unknown: return "Unknown"
        }
    }

    var color: String {
        switch self {
        case .low: return "gray"
        case .medium: return "blue"
        case .high: return "orange"
        case .urgent: return "red"
        case .unknown: return "gray"
        }
    }

    private var sortOrder: Int {
        switch self {
        case .low: return 0
        case .medium: return 1
        case .high: return 2
        case .urgent: return 3
        case .unknown: return -1
        }
    }

    static func < (lhs: InsightPriority, rhs: InsightPriority) -> Bool {
        lhs.sortOrder < rhs.sortOrder
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = InsightPriority(rawValue: rawValue) ?? .unknown
    }
}

// MARK: - Insight Metadata
struct InsightMetadata: Codable, Equatable {
    var relatedNoteIds: [String]?
    var relatedSessionIds: [String]?
    var confidence: Double?
    var actionItems: [String]?
    var resources: [InsightResource]?
    var patterns: [String]?
    var themes: [String]?

    enum CodingKeys: String, CodingKey {
        case relatedNoteIds = "related_note_ids"
        case relatedSessionIds = "related_session_ids"
        case confidence
        case actionItems = "action_items"
        case resources
        case patterns
        case themes
    }
}

// MARK: - Insight Resource
struct InsightResource: Codable, Equatable, Identifiable {
    var id: String { title }
    var title: String
    var url: String?
    var type: String?
}

// MARK: - Dashboard Stats
struct DashboardStats: Codable, Equatable {
    var activeClients: Int
    var weeklySchedule: Int
    var totalNotes: Int
    var aiInsights: Int
    var pendingNotes: Int?
    var upcomingSessionsToday: Int?

    // Backend returns camelCase keys, Swift property names match directly
    // No CodingKeys enum needed since property names match JSON keys

    init(activeClients: Int = 0,
         weeklySchedule: Int = 0,
         totalNotes: Int = 0,
         aiInsights: Int = 0,
         pendingNotes: Int? = nil,
         upcomingSessionsToday: Int? = nil) {
        self.activeClients = activeClients
        self.weeklySchedule = weeklySchedule
        self.totalNotes = totalNotes
        self.aiInsights = aiInsights
        self.pendingNotes = pendingNotes
        self.upcomingSessionsToday = upcomingSessionsToday
    }
}

// MARK: - Session Prep
struct SessionPrep: Identifiable, Codable, Equatable {
    let id: String
    let sessionId: String
    let clientId: String
    let therapistId: String
    var prep: SessionPrepContent
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case clientId = "client_id"
        case therapistId = "therapist_id"
        case prep
        case createdAt = "created_at"
    }
}

// MARK: - Session Prep Content
struct SessionPrepContent: Codable, Equatable {
    var summary: String?
    var keyThemes: [String]?
    var suggestedTopics: [String]?
    var recentProgress: String?
    var riskFactors: [String]?
    var treatmentGoalUpdates: [String]?
    var recommendedInterventions: [String]?

    enum CodingKeys: String, CodingKey {
        case summary
        case keyThemes = "key_themes"
        case suggestedTopics = "suggested_topics"
        case recentProgress = "recent_progress"
        case riskFactors = "risk_factors"
        case treatmentGoalUpdates = "treatment_goal_updates"
        case recommendedInterventions = "recommended_interventions"
    }
}
