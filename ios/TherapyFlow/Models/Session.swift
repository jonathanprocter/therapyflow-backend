import Foundation

// MARK: - Session Model
struct Session: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let clientId: String
    let therapistId: String
    var scheduledAt: Date
    var duration: Int // minutes
    var sessionType: SessionType
    var status: SessionStatus
    var googleEventId: String?
    var notes: String?
    var hasProgressNotePlaceholder: Bool
    var progressNoteStatus: ProgressNoteStatusType
    var isSimplePracticeEvent: Bool
    let createdAt: Date
    var updatedAt: Date

    // Optional client reference (populated from API)
    var client: Client?

    // Computed properties
    var endTime: Date {
        Calendar.current.date(byAdding: .minute, value: duration, to: scheduledAt) ?? scheduledAt
    }

    var isPast: Bool {
        scheduledAt < Date()
    }

    var isToday: Bool {
        Calendar.current.isDateInToday(scheduledAt)
    }

    var isUpcoming: Bool {
        scheduledAt > Date() && status == .scheduled
    }

    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: scheduledAt)
    }

    var formattedTimeRange: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return "\(formatter.string(from: scheduledAt)) - \(formatter.string(from: endTime))"
    }

    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: scheduledAt)
    }

    // Support both snake_case (from backend) and camelCase (legacy) keys
    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case clientIdCamel = "clientId"
        case therapistId = "therapist_id"
        case therapistIdCamel = "therapistId"
        case scheduledAt = "scheduled_at"
        case scheduledAtCamel = "scheduledAt"
        case duration
        case sessionType = "session_type"
        case sessionTypeCamel = "sessionType"
        case status
        case googleEventId = "google_event_id"
        case googleEventIdCamel = "googleEventId"
        case notes
        case hasProgressNotePlaceholder = "has_progress_note_placeholder"
        case hasProgressNotePlaceholderCamel = "hasProgressNotePlaceholder"
        case progressNoteStatus = "progress_note_status"
        case progressNoteStatusCamel = "progressNoteStatus"
        case isSimplePracticeEvent = "is_simple_practice_event"
        case isSimplePracticeEventCamel = "isSimplePracticeEvent"
        case createdAt = "created_at"
        case createdAtCamel = "createdAt"
        case updatedAt = "updated_at"
        case updatedAtCamel = "updatedAt"
        case client
    }

    // Custom decoder to handle missing optional fields with defaults and both key formats
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)

        // Try snake_case first, then camelCase for backward compatibility
        if let value = try? container.decode(String.self, forKey: .clientId) {
            clientId = value
        } else {
            clientId = try container.decode(String.self, forKey: .clientIdCamel)
        }

        if let value = try? container.decode(String.self, forKey: .therapistId) {
            therapistId = value
        } else {
            therapistId = try container.decode(String.self, forKey: .therapistIdCamel)
        }

        if let value = try? container.decode(Date.self, forKey: .scheduledAt) {
            scheduledAt = value
        } else {
            scheduledAt = try container.decode(Date.self, forKey: .scheduledAtCamel)
        }

        duration = try container.decodeIfPresent(Int.self, forKey: .duration) ?? 50

        if let value = try? container.decodeIfPresent(SessionType.self, forKey: .sessionType) {
            sessionType = value ?? .individual
        } else {
            sessionType = try container.decodeIfPresent(SessionType.self, forKey: .sessionTypeCamel) ?? .individual
        }

        status = try container.decodeIfPresent(SessionStatus.self, forKey: .status) ?? .scheduled

        if let value = try? container.decodeIfPresent(String.self, forKey: .googleEventId) {
            googleEventId = value
        } else {
            googleEventId = try container.decodeIfPresent(String.self, forKey: .googleEventIdCamel)
        }

        notes = try container.decodeIfPresent(String.self, forKey: .notes)

        if let value = try? container.decodeIfPresent(Bool.self, forKey: .hasProgressNotePlaceholder) {
            hasProgressNotePlaceholder = value ?? false
        } else {
            hasProgressNotePlaceholder = try container.decodeIfPresent(Bool.self, forKey: .hasProgressNotePlaceholderCamel) ?? false
        }

        if let value = try? container.decodeIfPresent(ProgressNoteStatusType.self, forKey: .progressNoteStatus) {
            progressNoteStatus = value ?? .pending
        } else {
            progressNoteStatus = try container.decodeIfPresent(ProgressNoteStatusType.self, forKey: .progressNoteStatusCamel) ?? .pending
        }

        if let value = try? container.decodeIfPresent(Bool.self, forKey: .isSimplePracticeEvent) {
            isSimplePracticeEvent = value ?? false
        } else {
            isSimplePracticeEvent = try container.decodeIfPresent(Bool.self, forKey: .isSimplePracticeEventCamel) ?? false
        }

        if let value = try? container.decodeIfPresent(Date.self, forKey: .createdAt) {
            createdAt = value ?? Date()
        } else {
            createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAtCamel) ?? Date()
        }

        if let value = try? container.decodeIfPresent(Date.self, forKey: .updatedAt) {
            updatedAt = value ?? Date()
        } else {
            updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAtCamel) ?? Date()
        }

        client = try container.decodeIfPresent(Client.self, forKey: .client)
    }

    init(id: String = UUID().uuidString,
         clientId: String,
         therapistId: String,
         scheduledAt: Date,
         duration: Int = 50,
         sessionType: SessionType = .individual,
         status: SessionStatus = .scheduled,
         googleEventId: String? = nil,
         notes: String? = nil,
         hasProgressNotePlaceholder: Bool = false,
         progressNoteStatus: ProgressNoteStatusType = .pending,
         isSimplePracticeEvent: Bool = false,
         createdAt: Date = Date(),
         updatedAt: Date = Date(),
         client: Client? = nil) {
        self.id = id
        self.clientId = clientId
        self.therapistId = therapistId
        self.scheduledAt = scheduledAt
        self.duration = duration
        self.sessionType = sessionType
        self.status = status
        self.googleEventId = googleEventId
        self.notes = notes
        self.hasProgressNotePlaceholder = hasProgressNotePlaceholder
        self.progressNoteStatus = progressNoteStatus
        self.isSimplePracticeEvent = isSimplePracticeEvent
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.client = client
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Session, rhs: Session) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Session Type
enum SessionType: String, Codable, CaseIterable {
    case individual
    case couples
    case family
    case group
    case intake
    case assessment

    var displayName: String {
        switch self {
        case .individual: return "Individual"
        case .couples: return "Couples"
        case .family: return "Family"
        case .group: return "Group"
        case .intake: return "Intake"
        case .assessment: return "Assessment"
        }
    }

    var icon: String {
        switch self {
        case .individual: return "person"
        case .couples: return "person.2"
        case .family: return "person.3"
        case .group: return "person.3.sequence"
        case .intake: return "doc.text"
        case .assessment: return "list.clipboard"
        }
    }
}

// MARK: - Session Status
enum SessionStatus: String, Codable, CaseIterable {
    case scheduled
    case completed
    case cancelled
    case noShow = "no_show"

    var displayName: String {
        switch self {
        case .scheduled: return "Scheduled"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        case .noShow: return "No Show"
        }
    }

    var color: String {
        switch self {
        case .scheduled: return "blue"
        case .completed: return "green"
        case .cancelled: return "gray"
        case .noShow: return "red"
        }
    }
}

// MARK: - Progress Note Status Type
enum ProgressNoteStatusType: String, Codable, CaseIterable {
    case pending
    case uploaded
    case processed
    case needsReview = "needs_review"

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .uploaded: return "Uploaded"
        case .processed: return "Processed"
        case .needsReview: return "Needs Review"
        }
    }
}

// MARK: - Create/Update DTOs
struct CreateSessionInput: Codable {
    var clientId: String
    var scheduledAt: Date
    var duration: Int?
    var sessionType: SessionType?
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case clientId = "client_id"
        case scheduledAt = "scheduled_at"
        case duration
        case sessionType = "session_type"
        case notes
    }
}

struct UpdateSessionInput: Codable {
    var scheduledAt: Date?
    var duration: Int?
    var sessionType: SessionType?
    var status: SessionStatus?
    var notes: String?

    enum CodingKeys: String, CodingKey {
        case scheduledAt = "scheduled_at"
        case duration
        case sessionType = "session_type"
        case status
        case notes
    }
}
