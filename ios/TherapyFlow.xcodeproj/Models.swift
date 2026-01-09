import Foundation

// MARK: - Core Models (complementing existing Session.swift and AuthModels.swift)
// NOTE: Session, SessionType, and SessionStatus are already defined in Session.swift

// MARK: - Client Model (if not in AuthModels)
struct Client: Identifiable, Codable {
    let id: String
    var name: String
    var email: String?
    var phone: String?
    var dateOfBirth: Date?
    var status: ClientStatus
    var tags: [String]
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case email
        case phone
        case dateOfBirth = "date_of_birth"
        case status
        case tags
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
    
    var initials: String {
        let components = name.split(separator: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1) + components[1].prefix(1))
        } else if let first = components.first {
            return String(first.prefix(2))
        }
        return "??"
    }
}

// MARK: - Client Status
enum ClientStatus: String, Codable, CaseIterable {
    case active = "active"
    case inactive = "inactive"
    case archived = "archived"
    
    var displayName: String {
        rawValue.capitalized
    }
}

// MARK: - Document Model
struct Document: Identifiable, Codable {
    let id: String
    var filename: String
    var fileUrl: String
    var clientId: String?
    var clientName: String?
    var extractedText: String?
    var tags: [String]
    var fileSize: Int?
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case filename
        case fileUrl = "file_url"
        case clientId = "client_id"
        case clientName = "client_name"
        case extractedText = "extracted_text"
        case tags
        case fileSize = "file_size"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
    
    var fileExtension: String {
        (filename as NSString).pathExtension.lowercased()
    }
}

// MARK: - Progress Note Model
struct ProgressNote: Identifiable, Codable {
    let id: String
    let sessionId: String
    let clientId: String
    var content: String
    var tags: [String]
    var riskLevel: RiskLevel?
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case clientId = "client_id"
        case content
        case tags
        case riskLevel = "risk_level"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Risk Level
enum RiskLevel: String, Codable, CaseIterable {
    case none = "none"
    case low = "low"
    case medium = "medium"
    case high = "high"
    
    var displayName: String {
        switch self {
        case .none: return "No Risk"
        case .low: return "Low Risk"
        case .medium: return "Medium Risk"
        case .high: return "High Risk"
        }
    }
}

// MARK: - Treatment Plan Model
struct TreatmentPlan: Identifiable, Codable {
    let id: String
    let clientId: String
    var title: String
    var goals: [TreatmentGoal]
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case title
        case goals
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Treatment Goal
struct TreatmentGoal: Identifiable, Codable {
    let id: String
    var description: String
    var targetDate: Date?
    var status: GoalStatus
    var progress: Int // 0-100
    
    enum CodingKeys: String, CodingKey {
        case id
        case description
        case targetDate = "target_date"
        case status
        case progress
    }
}

// MARK: - Goal Status
enum GoalStatus: String, Codable, CaseIterable {
    case notStarted = "not_started"
    case inProgress = "in_progress"
    case completed = "completed"
    case onHold = "on_hold"
    
    var displayName: String {
        switch self {
        case .notStarted: return "Not Started"
        case .inProgress: return "In Progress"
        case .completed: return "Completed"
        case .onHold: return "On Hold"
        }
    }
}

// MARK: - AI Insight Model
struct AIInsight: Identifiable, Codable {
    let id: String
    let clientId: String?
    let type: InsightType
    let title: String
    let content: String
    let priority: InsightPriority
    let createdAt: Date
    var isRead: Bool
    
    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case type
        case title
        case content
        case priority
        case createdAt = "created_at"
        case isRead = "is_read"
    }
}

// MARK: - Insight Type
enum InsightType: String, Codable {
    case pattern = "pattern"
    case risk = "risk"
    case progress = "progress"
    case recommendation = "recommendation"
}

// MARK: - Insight Priority
enum InsightPriority: String, Codable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case critical = "critical"
}

// MARK: - User Model (if not in AuthModels)
struct User: Identifiable, Codable {
    let id: String
    var name: String
    var email: String
    var professionalTitle: String?
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case email
        case professionalTitle = "professional_title"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Calendar Event (if not in AuthModels)
struct CalendarEvent: Identifiable, Codable {
    let id: String
    var title: String
    var startTime: Date
    var endTime: Date
    var location: String?
    var description: String?
    var attendees: [String]?
    var source: EventSource
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case startTime = "start_time"
        case endTime = "end_time"
        case location
        case description
        case attendees
        case source
    }
    
    enum EventSource: String, Codable {
        case therapyFlow = "therapy_flow"
        case google = "google"
        case simplePractice = "simple_practice"
    }
}
