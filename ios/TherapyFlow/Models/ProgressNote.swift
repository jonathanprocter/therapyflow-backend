import Foundation

// MARK: - Date Parsing Helpers
private enum DateParsingHelper {
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
        // Try ISO8601 with fractional seconds
        if let date = iso8601Formatter.date(from: string) {
            return date
        }
        // Try ISO8601 without fractional seconds
        if let date = iso8601FormatterNoFractional.date(from: string) {
            return date
        }
        // Try fallback format
        if let date = fallbackFormatter.date(from: string) {
            return date
        }
        // Try date only
        if let date = dateOnlyFormatter.date(from: string) {
            return date
        }
        return nil
    }
}

// MARK: - Progress Note Model
struct ProgressNote: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let clientId: String
    var sessionId: String?
    let therapistId: String
    var clientName: String?
    var content: String?
    var sessionDate: Date
    var tags: [String]
    var aiTags: [String]
    var riskLevel: RiskLevel
    var progressRating: Int?
    var qualityScore: Double?
    var qualityFlags: QualityFlags?
    var status: NoteStatus
    var isPlaceholder: Bool
    var requiresManualReview: Bool
    var aiConfidenceScore: Double?
    var processingNotes: String?
    var originalDocumentId: String?
    let createdAt: Date
    var updatedAt: Date

    // Optional references
    var client: Client?
    var session: Session?

    // Computed properties
    var allTags: [String] {
        Array(Set(tags + aiTags))
    }

    var hasContent: Bool {
        guard let content = content else { return false }
        return !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var contentPreview: String {
        guard let content = content else { return "No content" }
        let preview = content.trimmingCharacters(in: .whitespacesAndNewlines)
        if preview.count > 150 {
            return String(preview.prefix(150)) + "..."
        }
        return preview
    }

    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: sessionDate)
    }

    // Support both snake_case (from backend) and camelCase (legacy) keys
    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case clientIdCamel = "clientId"
        case clientName = "client_name"
        case clientNameCamel = "clientName"
        case sessionId = "session_id"
        case sessionIdCamel = "sessionId"
        case therapistId = "therapist_id"
        case therapistIdCamel = "therapistId"
        case content
        case sessionDate = "session_date"
        case sessionDateCamel = "sessionDate"
        case tags
        case aiTags = "ai_tags"
        case aiTagsCamel = "aiTags"
        case riskLevel = "risk_level"
        case riskLevelCamel = "riskLevel"
        case progressRating = "progress_rating"
        case progressRatingCamel = "progressRating"
        case qualityScore = "quality_score"
        case qualityScoreCamel = "qualityScore"
        case qualityFlags = "quality_flags"
        case qualityFlagsCamel = "qualityFlags"
        case status
        case isPlaceholder = "is_placeholder"
        case isPlaceholderCamel = "isPlaceholder"
        case requiresManualReview = "requires_manual_review"
        case requiresManualReviewCamel = "requiresManualReview"
        case aiConfidenceScore = "ai_confidence_score"
        case aiConfidenceScoreCamel = "aiConfidenceScore"
        case processingNotes = "processing_notes"
        case processingNotesCamel = "processingNotes"
        case originalDocumentId = "original_document_id"
        case originalDocumentIdCamel = "originalDocumentId"
        case createdAt = "created_at"
        case createdAtCamel = "createdAt"
        case updatedAt = "updated_at"
        case updatedAtCamel = "updatedAt"
        case client
        case session
    }

    // Custom encoder to encode to snake_case format
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(clientId, forKey: .clientId)
        try container.encodeIfPresent(clientName, forKey: .clientName)
        try container.encodeIfPresent(sessionId, forKey: .sessionId)
        try container.encode(therapistId, forKey: .therapistId)
        try container.encodeIfPresent(content, forKey: .content)
        try container.encode(sessionDate, forKey: .sessionDate)
        try container.encode(tags, forKey: .tags)
        try container.encode(aiTags, forKey: .aiTags)
        try container.encode(riskLevel, forKey: .riskLevel)
        try container.encodeIfPresent(progressRating, forKey: .progressRating)
        try container.encodeIfPresent(qualityScore, forKey: .qualityScore)
        try container.encodeIfPresent(qualityFlags, forKey: .qualityFlags)
        try container.encode(status, forKey: .status)
        try container.encode(isPlaceholder, forKey: .isPlaceholder)
        try container.encode(requiresManualReview, forKey: .requiresManualReview)
        try container.encodeIfPresent(aiConfidenceScore, forKey: .aiConfidenceScore)
        try container.encodeIfPresent(processingNotes, forKey: .processingNotes)
        try container.encodeIfPresent(originalDocumentId, forKey: .originalDocumentId)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encodeIfPresent(client, forKey: .client)
        try container.encodeIfPresent(session, forKey: .session)
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

        if let value = try? container.decodeIfPresent(String.self, forKey: .clientName) {
            clientName = value
        } else {
            clientName = try container.decodeIfPresent(String.self, forKey: .clientNameCamel)
        }

        if let value = try? container.decodeIfPresent(String.self, forKey: .sessionId) {
            sessionId = value
        } else {
            sessionId = try container.decodeIfPresent(String.self, forKey: .sessionIdCamel)
        }

        if let value = try? container.decode(String.self, forKey: .therapistId) {
            therapistId = value
        } else {
            therapistId = try container.decode(String.self, forKey: .therapistIdCamel)
        }

        content = try container.decodeIfPresent(String.self, forKey: .content)

        // Try to decode sessionDate - handle both Date and String formats
        if let value = try? container.decode(Date.self, forKey: .sessionDate) {
            sessionDate = value
        } else if let value = try? container.decode(Date.self, forKey: .sessionDateCamel) {
            sessionDate = value
        } else if let stringValue = try? container.decode(String.self, forKey: .sessionDate),
                  let parsedDate = DateParsingHelper.parseDate(from: stringValue) {
            sessionDate = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .sessionDateCamel),
                  let parsedDate = DateParsingHelper.parseDate(from: stringValue) {
            sessionDate = parsedDate
        } else {
            sessionDate = Date()
        }

        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []

        if let value = try? container.decode([String].self, forKey: .aiTags) {
            aiTags = value
        } else {
            aiTags = try container.decodeIfPresent([String].self, forKey: .aiTagsCamel) ?? []
        }

        if let value = try? container.decode(RiskLevel.self, forKey: .riskLevel) {
            riskLevel = value
        } else {
            riskLevel = try container.decodeIfPresent(RiskLevel.self, forKey: .riskLevelCamel) ?? .low
        }

        if let value = try? container.decodeIfPresent(Int.self, forKey: .progressRating) {
            progressRating = value
        } else {
            progressRating = try container.decodeIfPresent(Int.self, forKey: .progressRatingCamel)
        }

        if let value = try? container.decodeIfPresent(Double.self, forKey: .qualityScore) {
            qualityScore = value
        } else {
            qualityScore = try container.decodeIfPresent(Double.self, forKey: .qualityScoreCamel)
        }

        if let value = try? container.decodeIfPresent(QualityFlags.self, forKey: .qualityFlags) {
            qualityFlags = value
        } else {
            qualityFlags = try container.decodeIfPresent(QualityFlags.self, forKey: .qualityFlagsCamel)
        }

        status = try container.decodeIfPresent(NoteStatus.self, forKey: .status) ?? .placeholder

        if let value = try? container.decode(Bool.self, forKey: .isPlaceholder) {
            isPlaceholder = value
        } else {
            isPlaceholder = try container.decodeIfPresent(Bool.self, forKey: .isPlaceholderCamel) ?? true
        }

        if let value = try? container.decode(Bool.self, forKey: .requiresManualReview) {
            requiresManualReview = value
        } else {
            requiresManualReview = try container.decodeIfPresent(Bool.self, forKey: .requiresManualReviewCamel) ?? false
        }

        if let value = try? container.decodeIfPresent(Double.self, forKey: .aiConfidenceScore) {
            aiConfidenceScore = value
        } else {
            aiConfidenceScore = try container.decodeIfPresent(Double.self, forKey: .aiConfidenceScoreCamel)
        }

        if let value = try? container.decodeIfPresent(String.self, forKey: .processingNotes) {
            processingNotes = value
        } else {
            processingNotes = try container.decodeIfPresent(String.self, forKey: .processingNotesCamel)
        }

        if let value = try? container.decodeIfPresent(String.self, forKey: .originalDocumentId) {
            originalDocumentId = value
        } else {
            originalDocumentId = try container.decodeIfPresent(String.self, forKey: .originalDocumentIdCamel)
        }

        // Try to decode createdAt - handle both Date and String formats
        if let value = try? container.decode(Date.self, forKey: .createdAt) {
            createdAt = value
        } else if let value = try? container.decode(Date.self, forKey: .createdAtCamel) {
            createdAt = value
        } else if let stringValue = try? container.decode(String.self, forKey: .createdAt),
                  let parsedDate = DateParsingHelper.parseDate(from: stringValue) {
            createdAt = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .createdAtCamel),
                  let parsedDate = DateParsingHelper.parseDate(from: stringValue) {
            createdAt = parsedDate
        } else {
            createdAt = Date()
        }

        // Try to decode updatedAt - handle both Date and String formats
        if let value = try? container.decode(Date.self, forKey: .updatedAt) {
            updatedAt = value
        } else if let value = try? container.decode(Date.self, forKey: .updatedAtCamel) {
            updatedAt = value
        } else if let stringValue = try? container.decode(String.self, forKey: .updatedAt),
                  let parsedDate = DateParsingHelper.parseDate(from: stringValue) {
            updatedAt = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .updatedAtCamel),
                  let parsedDate = DateParsingHelper.parseDate(from: stringValue) {
            updatedAt = parsedDate
        } else {
            updatedAt = Date()
        }

        client = try container.decodeIfPresent(Client.self, forKey: .client)
        session = try container.decodeIfPresent(Session.self, forKey: .session)
    }

    init(id: String = UUID().uuidString,
         clientId: String,
         sessionId: String? = nil,
         therapistId: String,
         clientName: String? = nil,
         content: String? = nil,
         sessionDate: Date = Date(),
         tags: [String] = [],
         aiTags: [String] = [],
         riskLevel: RiskLevel = .low,
         progressRating: Int? = nil,
         qualityScore: Double? = nil,
         qualityFlags: QualityFlags? = nil,
         status: NoteStatus = .placeholder,
         isPlaceholder: Bool = true,
         requiresManualReview: Bool = false,
         aiConfidenceScore: Double? = nil,
         processingNotes: String? = nil,
         originalDocumentId: String? = nil,
         createdAt: Date = Date(),
         updatedAt: Date = Date(),
         client: Client? = nil,
         session: Session? = nil) {
        self.id = id
        self.clientId = clientId
        self.sessionId = sessionId
        self.therapistId = therapistId
        self.clientName = clientName ?? client?.name  // Auto-populate from client if available
        self.content = content
        self.sessionDate = sessionDate
        self.tags = tags
        self.aiTags = aiTags
        self.riskLevel = riskLevel
        self.progressRating = progressRating
        self.qualityScore = qualityScore
        self.qualityFlags = qualityFlags
        self.status = status
        self.isPlaceholder = isPlaceholder
        self.requiresManualReview = requiresManualReview
        self.aiConfidenceScore = aiConfidenceScore
        self.processingNotes = processingNotes
        self.originalDocumentId = originalDocumentId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.client = client
        self.session = session
    }

    /// Returns the best available client name, never returns generic "Client"
    var displayClientName: String {
        if let name = client?.name, !name.isEmpty {
            return name
        }
        if let name = clientName, !name.isEmpty {
            return name
        }
        // Return a more informative placeholder with partial ID
        return "Client (\(String(clientId.prefix(8)))...)"
    }

    /// Hydrate the note with client data
    mutating func hydrateWith(client: Client) {
        self.client = client
        if self.clientName == nil || self.clientName?.isEmpty == true {
            self.clientName = client.name
        }
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: ProgressNote, rhs: ProgressNote) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Risk Level
enum RiskLevel: String, Codable, CaseIterable, Comparable {
    case low
    case moderate
    case high
    case critical
    case unknown  // Fallback for unexpected values

    var displayName: String {
        switch self {
        case .low: return "Low"
        case .moderate: return "Moderate"
        case .high: return "High"
        case .critical: return "Critical"
        case .unknown: return "Unknown"
        }
    }

    var color: String {
        switch self {
        case .low: return "green"
        case .moderate: return "yellow"
        case .high: return "orange"
        case .critical: return "red"
        case .unknown: return "gray"
        }
    }

    var icon: String {
        switch self {
        case .low: return "checkmark.shield"
        case .moderate: return "exclamationmark.shield"
        case .high: return "exclamationmark.triangle"
        case .critical: return "xmark.octagon"
        case .unknown: return "questionmark.circle"
        }
    }

    private var sortOrder: Int {
        switch self {
        case .low: return 0
        case .moderate: return 1
        case .high: return 2
        case .critical: return 3
        case .unknown: return -1
        }
    }

    static func < (lhs: RiskLevel, rhs: RiskLevel) -> Bool {
        lhs.sortOrder < rhs.sortOrder
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = RiskLevel(rawValue: rawValue) ?? .unknown
    }
}

// MARK: - Note Status
enum NoteStatus: String, Codable, CaseIterable {
    case placeholder
    case uploaded
    case processed
    case manualReview = "manual_review"
    case needsReview = "needs_review"  // Alternative key from backend
    case completed
    case draft
    case pending
    case unknown  // Fallback for unexpected values

    var displayName: String {
        switch self {
        case .placeholder: return "Placeholder"
        case .uploaded: return "Uploaded"
        case .processed: return "Processed"
        case .manualReview, .needsReview: return "Manual Review"
        case .completed: return "Completed"
        case .draft: return "Draft"
        case .pending: return "Pending"
        case .unknown: return "Unknown"
        }
    }

    var color: String {
        switch self {
        case .placeholder: return "gray"
        case .uploaded: return "blue"
        case .processed: return "teal"
        case .manualReview, .needsReview: return "orange"
        case .completed: return "green"
        case .draft: return "purple"
        case .pending: return "yellow"
        case .unknown: return "gray"
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = NoteStatus(rawValue: rawValue) ?? .unknown
    }
}

// MARK: - Quality Flags
// This can be either an array of strings or a dictionary from the server
struct QualityFlags: Codable, Equatable {
    var hasSubjectiveData: Bool?
    var hasObjectiveData: Bool?
    var hasAssessment: Bool?
    var hasPlan: Bool?
    var hasGoalProgress: Bool?
    var hasInterventions: Bool?
    var issues: [String]?

    init(hasSubjectiveData: Bool? = nil,
         hasObjectiveData: Bool? = nil,
         hasAssessment: Bool? = nil,
         hasPlan: Bool? = nil,
         hasGoalProgress: Bool? = nil,
         hasInterventions: Bool? = nil,
         issues: [String]? = nil) {
        self.hasSubjectiveData = hasSubjectiveData
        self.hasObjectiveData = hasObjectiveData
        self.hasAssessment = hasAssessment
        self.hasPlan = hasPlan
        self.hasGoalProgress = hasGoalProgress
        self.hasInterventions = hasInterventions
        self.issues = issues
    }

    init(from decoder: Decoder) throws {
        // Try to decode as array first (legacy format)
        if let container = try? decoder.singleValueContainer(),
           let arrayValue = try? container.decode([String].self) {
            // Convert array to issues list
            self.issues = arrayValue
            self.hasSubjectiveData = nil
            self.hasObjectiveData = nil
            self.hasAssessment = nil
            self.hasPlan = nil
            self.hasGoalProgress = nil
            self.hasInterventions = nil
            return
        }

        // Try to decode as dictionary (new format)
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.hasSubjectiveData = try container.decodeIfPresent(Bool.self, forKey: .hasSubjectiveData)
        self.hasObjectiveData = try container.decodeIfPresent(Bool.self, forKey: .hasObjectiveData)
        self.hasAssessment = try container.decodeIfPresent(Bool.self, forKey: .hasAssessment)
        self.hasPlan = try container.decodeIfPresent(Bool.self, forKey: .hasPlan)
        self.hasGoalProgress = try container.decodeIfPresent(Bool.self, forKey: .hasGoalProgress)
        self.hasInterventions = try container.decodeIfPresent(Bool.self, forKey: .hasInterventions)
        self.issues = try container.decodeIfPresent([String].self, forKey: .issues)
    }

    enum CodingKeys: String, CodingKey {
        case hasSubjectiveData = "has_subjective_data"
        case hasObjectiveData = "has_objective_data"
        case hasAssessment = "has_assessment"
        case hasPlan = "has_plan"
        case hasGoalProgress = "has_goal_progress"
        case hasInterventions = "has_interventions"
        case issues
    }
}

// MARK: - Create/Update DTOs
struct CreateProgressNoteInput: Codable {
    var clientId: String
    var sessionId: String?
    var sessionDate: Date
    var content: String
    var tags: [String]?
    var riskLevel: RiskLevel?
    var progressRating: Int?

    enum CodingKeys: String, CodingKey {
        case clientId = "client_id"
        case sessionId = "session_id"
        case sessionDate = "session_date"
        case content
        case tags
        case riskLevel = "risk_level"
        case progressRating = "progress_rating"
    }
}

struct UpdateProgressNoteInput: Codable {
    var content: String?
    var sessionDate: Date?
    var sessionId: String?
    var tags: [String]?
    var riskLevel: RiskLevel?
    var progressRating: Int?
    var status: NoteStatus?

    enum CodingKeys: String, CodingKey {
        case content
        case sessionDate = "session_date"
        case sessionId = "session_id"
        case tags
        case riskLevel = "risk_level"
        case progressRating = "progress_rating"
        case status
    }
}
