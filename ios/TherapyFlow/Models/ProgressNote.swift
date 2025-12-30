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

    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case sessionId = "session_id"
        case therapistId = "therapist_id"
        case content
        case sessionDate = "session_date"
        case tags
        case aiTags = "ai_tags"
        case riskLevel = "risk_level"
        case progressRating = "progress_rating"
        case qualityScore = "quality_score"
        case qualityFlags = "quality_flags"
        case status
        case isPlaceholder = "is_placeholder"
        case requiresManualReview = "requires_manual_review"
        case aiConfidenceScore = "ai_confidence_score"
        case processingNotes = "processing_notes"
        case originalDocumentId = "original_document_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case client
        case session
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
