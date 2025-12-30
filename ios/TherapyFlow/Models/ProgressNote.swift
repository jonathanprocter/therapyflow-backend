import Foundation

// MARK: - Progress Note Model
struct ProgressNote: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let clientId: String
    var sessionId: String?
    let therapistId: String
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

        if let value = try? container.decodeIfPresent(Date.self, forKey: .sessionDate) {
            sessionDate = value ?? Date()
        } else {
            sessionDate = try container.decodeIfPresent(Date.self, forKey: .sessionDateCamel) ?? Date()
        }

        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []

        if let value = try? container.decodeIfPresent([String].self, forKey: .aiTags) {
            aiTags = value ?? []
        } else {
            aiTags = try container.decodeIfPresent([String].self, forKey: .aiTagsCamel) ?? []
        }

        if let value = try? container.decodeIfPresent(RiskLevel.self, forKey: .riskLevel) {
            riskLevel = value ?? .low
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

        if let value = try? container.decodeIfPresent(Bool.self, forKey: .isPlaceholder) {
            isPlaceholder = value ?? true
        } else {
            isPlaceholder = try container.decodeIfPresent(Bool.self, forKey: .isPlaceholderCamel) ?? true
        }

        if let value = try? container.decodeIfPresent(Bool.self, forKey: .requiresManualReview) {
            requiresManualReview = value ?? false
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
        session = try container.decodeIfPresent(Session.self, forKey: .session)
    }

    init(id: String = UUID().uuidString,
         clientId: String,
         sessionId: String? = nil,
         therapistId: String,
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

    var displayName: String {
        switch self {
        case .low: return "Low"
        case .moderate: return "Moderate"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }

    var color: String {
        switch self {
        case .low: return "green"
        case .moderate: return "yellow"
        case .high: return "orange"
        case .critical: return "red"
        }
    }

    var icon: String {
        switch self {
        case .low: return "checkmark.shield"
        case .moderate: return "exclamationmark.shield"
        case .high: return "exclamationmark.triangle"
        case .critical: return "xmark.octagon"
        }
    }

    private var sortOrder: Int {
        switch self {
        case .low: return 0
        case .moderate: return 1
        case .high: return 2
        case .critical: return 3
        }
    }

    static func < (lhs: RiskLevel, rhs: RiskLevel) -> Bool {
        lhs.sortOrder < rhs.sortOrder
    }
}

// MARK: - Note Status
enum NoteStatus: String, Codable, CaseIterable {
    case placeholder
    case uploaded
    case processed
    case manualReview = "manual_review"
    case completed

    var displayName: String {
        switch self {
        case .placeholder: return "Placeholder"
        case .uploaded: return "Uploaded"
        case .processed: return "Processed"
        case .manualReview: return "Manual Review"
        case .completed: return "Completed"
        }
    }

    var color: String {
        switch self {
        case .placeholder: return "gray"
        case .uploaded: return "blue"
        case .processed: return "teal"
        case .manualReview: return "orange"
        case .completed: return "green"
        }
    }
}

// MARK: - Quality Flags
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
    var tags: [String]?
    var riskLevel: RiskLevel?
    var progressRating: Int?
    var status: NoteStatus?

    enum CodingKeys: String, CodingKey {
        case content
        case sessionDate = "session_date"
        case tags
        case riskLevel = "risk_level"
        case progressRating = "progress_rating"
        case status
    }
}
