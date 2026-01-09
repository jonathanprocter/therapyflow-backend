import Foundation

// MARK: - Date Parsing Helpers for Session
private enum SessionDateParsingHelper {
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

    /// Returns the best available client name with fallback
    var displayClientName: String {
        if let name = client?.name, !name.isEmpty {
            return name
        }
        // Return a placeholder with partial ID
        return "Client (\(String(clientId.prefix(8)))...)"
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

    // Custom encoder to encode to snake_case format
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(clientId, forKey: .clientId)
        try container.encode(therapistId, forKey: .therapistId)
        try container.encode(scheduledAt, forKey: .scheduledAt)
        try container.encode(duration, forKey: .duration)
        try container.encode(sessionType, forKey: .sessionType)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(googleEventId, forKey: .googleEventId)
        try container.encodeIfPresent(notes, forKey: .notes)
        try container.encode(hasProgressNotePlaceholder, forKey: .hasProgressNotePlaceholder)
        try container.encode(progressNoteStatus, forKey: .progressNoteStatus)
        try container.encode(isSimplePracticeEvent, forKey: .isSimplePracticeEvent)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encodeIfPresent(client, forKey: .client)
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

        // Handle scheduledAt - Date or String format
        if let value = try? container.decode(Date.self, forKey: .scheduledAt) {
            scheduledAt = value
        } else if let value = try? container.decode(Date.self, forKey: .scheduledAtCamel) {
            scheduledAt = value
        } else if let stringValue = try? container.decode(String.self, forKey: .scheduledAt),
                  let parsedDate = SessionDateParsingHelper.parseDate(from: stringValue) {
            scheduledAt = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .scheduledAtCamel),
                  let parsedDate = SessionDateParsingHelper.parseDate(from: stringValue) {
            scheduledAt = parsedDate
        } else {
            scheduledAt = Date()
        }

        duration = try container.decodeIfPresent(Int.self, forKey: .duration) ?? 50

        if let value = try? container.decode(SessionType.self, forKey: .sessionType) {
            sessionType = value
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

        if let value = try? container.decode(Bool.self, forKey: .hasProgressNotePlaceholder) {
            hasProgressNotePlaceholder = value
        } else {
            hasProgressNotePlaceholder = try container.decodeIfPresent(Bool.self, forKey: .hasProgressNotePlaceholderCamel) ?? false
        }

        if let value = try? container.decode(ProgressNoteStatusType.self, forKey: .progressNoteStatus) {
            progressNoteStatus = value
        } else {
            progressNoteStatus = try container.decodeIfPresent(ProgressNoteStatusType.self, forKey: .progressNoteStatusCamel) ?? .pending
        }

        if let value = try? container.decode(Bool.self, forKey: .isSimplePracticeEvent) {
            isSimplePracticeEvent = value
        } else {
            isSimplePracticeEvent = try container.decodeIfPresent(Bool.self, forKey: .isSimplePracticeEventCamel) ?? false
        }

        // Handle createdAt - Date or String format
        if let value = try? container.decode(Date.self, forKey: .createdAt) {
            createdAt = value
        } else if let value = try? container.decode(Date.self, forKey: .createdAtCamel) {
            createdAt = value
        } else if let stringValue = try? container.decode(String.self, forKey: .createdAt),
                  let parsedDate = SessionDateParsingHelper.parseDate(from: stringValue) {
            createdAt = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .createdAtCamel),
                  let parsedDate = SessionDateParsingHelper.parseDate(from: stringValue) {
            createdAt = parsedDate
        } else {
            createdAt = Date()
        }

        // Handle updatedAt - Date or String format
        if let value = try? container.decode(Date.self, forKey: .updatedAt) {
            updatedAt = value
        } else if let value = try? container.decode(Date.self, forKey: .updatedAtCamel) {
            updatedAt = value
        } else if let stringValue = try? container.decode(String.self, forKey: .updatedAt),
                  let parsedDate = SessionDateParsingHelper.parseDate(from: stringValue) {
            updatedAt = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .updatedAtCamel),
                  let parsedDate = SessionDateParsingHelper.parseDate(from: stringValue) {
            updatedAt = parsedDate
        } else {
            updatedAt = Date()
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
    case unknown  // Fallback for unexpected values

    var displayName: String {
        switch self {
        case .individual: return "Individual"
        case .couples: return "Couples"
        case .family: return "Family"
        case .group: return "Group"
        case .intake: return "Intake"
        case .assessment: return "Assessment"
        case .unknown: return "Session"
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
        case .unknown: return "calendar"
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = SessionType(rawValue: rawValue) ?? .unknown
    }
}

// MARK: - Session Status
enum SessionStatus: String, Codable, CaseIterable {
    case scheduled
    case completed
    case cancelled
    case noShow = "no_show"
    case unknown  // Fallback for unexpected values

    var displayName: String {
        switch self {
        case .scheduled: return "Scheduled"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        case .noShow: return "No Show"
        case .unknown: return "Unknown"
        }
    }

    var color: String {
        switch self {
        case .scheduled: return "blue"
        case .completed: return "green"
        case .cancelled: return "gray"
        case .noShow: return "red"
        case .unknown: return "gray"
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = SessionStatus(rawValue: rawValue) ?? .unknown
    }
}

// MARK: - Progress Note Status Type
enum ProgressNoteStatusType: String, Codable, CaseIterable {
    case pending
    case uploaded
    case processed
    case needsReview = "needs_review"
    case unknown  // Fallback for unexpected values

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .uploaded: return "Uploaded"
        case .processed: return "Processed"
        case .needsReview: return "Needs Review"
        case .unknown: return "Unknown"
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = ProgressNoteStatusType(rawValue: rawValue) ?? .unknown
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

    /// Validation errors for session input
    enum ValidationError: LocalizedError {
        case emptyClientId
        case invalidDuration
        case durationTooShort
        case durationTooLong
        case notesTooLong

        var errorDescription: String? {
            switch self {
            case .emptyClientId:
                return "Please select a client for this session"
            case .invalidDuration:
                return "Session duration must be a positive number"
            case .durationTooShort:
                return "Session duration must be at least 15 minutes"
            case .durationTooLong:
                return "Session duration cannot exceed 480 minutes (8 hours)"
            case .notesTooLong:
                return "Notes cannot exceed 10,000 characters"
            }
        }
    }

    /// Validate the input before sending to the API
    func validate() throws {
        // Client ID is required
        guard !clientId.isEmpty else {
            throw ValidationError.emptyClientId
        }

        // Validate duration if provided
        if let duration = duration {
            guard duration > 0 else {
                throw ValidationError.invalidDuration
            }
            guard duration >= 15 else {
                throw ValidationError.durationTooShort
            }
            guard duration <= 480 else {
                throw ValidationError.durationTooLong
            }
        }

        // Validate notes length if provided
        if let notes = notes {
            guard notes.count <= 10000 else {
                throw ValidationError.notesTooLong
            }
        }
    }

    /// Check if the input is valid without throwing
    var isValid: Bool {
        do {
            try validate()
            return true
        } catch {
            return false
        }
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

    /// Validate the input before sending to the API
    func validate() throws {
        // Validate duration if provided
        if let duration = duration {
            guard duration > 0 else {
                throw CreateSessionInput.ValidationError.invalidDuration
            }
            guard duration >= 15 else {
                throw CreateSessionInput.ValidationError.durationTooShort
            }
            guard duration <= 480 else {
                throw CreateSessionInput.ValidationError.durationTooLong
            }
        }

        // Validate notes length if provided
        if let notes = notes {
            guard notes.count <= 10000 else {
                throw CreateSessionInput.ValidationError.notesTooLong
            }
        }
    }
}
