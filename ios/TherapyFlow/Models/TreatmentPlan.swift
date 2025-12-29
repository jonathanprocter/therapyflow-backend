import Foundation

// Type alias for backwards compatibility
typealias Goal = TreatmentGoal

// MARK: - Treatment Plan Status
enum TreatmentPlanStatus: String, Codable, CaseIterable {
    case active
    case completed
    case onHold
    case discontinued

    var displayName: String {
        switch self {
        case .active: return "Active"
        case .completed: return "Completed"
        case .onHold: return "On Hold"
        case .discontinued: return "Discontinued"
        }
    }
}

// MARK: - Treatment Plan Model
struct TreatmentPlan: Identifiable, Codable, Equatable {
    let id: String
    let clientId: String
    let therapistId: String
    var clientName: String?
    var diagnosis: String?
    var goals: [TreatmentGoal]
    var interventions: [String]
    var frequency: SessionFrequency?
    var estimatedDuration: Int? // number of sessions
    var startDate: Date
    var targetEndDate: Date?
    var isActive: Bool
    var status: TreatmentPlanStatus
    let createdAt: Date
    var updatedAt: Date

    // Computed properties
    var completedGoalsCount: Int {
        goals.filter { $0.status == .achieved }.count
    }

    var progressPercentage: Double {
        guard !goals.isEmpty else { return 0 }
        let totalProgress = goals.reduce(0.0) { $0 + ($1.progress ?? 0) }
        return totalProgress / Double(goals.count)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case therapistId = "therapist_id"
        case clientName = "client_name"
        case diagnosis
        case goals
        case interventions
        case frequency
        case estimatedDuration = "estimated_duration"
        case startDate = "start_date"
        case targetEndDate = "target_end_date"
        case isActive = "is_active"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(id: String = UUID().uuidString,
         clientId: String,
         therapistId: String,
         clientName: String? = nil,
         diagnosis: String? = nil,
         goals: [TreatmentGoal] = [],
         interventions: [String] = [],
         frequency: SessionFrequency? = nil,
         estimatedDuration: Int? = nil,
         startDate: Date = Date(),
         targetEndDate: Date? = nil,
         isActive: Bool = true,
         status: TreatmentPlanStatus = .active,
         createdAt: Date = Date(),
         updatedAt: Date = Date()) {
        self.id = id
        self.clientId = clientId
        self.therapistId = therapistId
        self.clientName = clientName
        self.diagnosis = diagnosis
        self.goals = goals
        self.interventions = interventions
        self.frequency = frequency
        self.estimatedDuration = estimatedDuration
        self.startDate = startDate
        self.targetEndDate = targetEndDate
        self.status = status
        self.isActive = isActive
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Treatment Goal
struct TreatmentGoal: Identifiable, Codable, Equatable {
    let id: String
    var description: String
    var targetDate: Date?
    var status: GoalStatus
    var progress: Double? // 0-100

    init(id: String = UUID().uuidString,
         description: String,
         targetDate: Date? = nil,
         status: GoalStatus = .notStarted,
         progress: Double? = nil) {
        self.id = id
        self.description = description
        self.targetDate = targetDate
        self.status = status
        self.progress = progress
    }
}

// MARK: - Goal Status
enum GoalStatus: String, Codable, CaseIterable {
    case notStarted = "not_started"
    case inProgress = "in_progress"
    case achieved
    case discontinued

    var displayName: String {
        switch self {
        case .notStarted: return "Not Started"
        case .inProgress: return "In Progress"
        case .achieved: return "Achieved"
        case .discontinued: return "Discontinued"
        }
    }

    var color: String {
        switch self {
        case .notStarted: return "gray"
        case .inProgress: return "blue"
        case .achieved: return "green"
        case .discontinued: return "orange"
        }
    }

    var icon: String {
        switch self {
        case .notStarted: return "circle"
        case .inProgress: return "circle.lefthalf.filled"
        case .achieved: return "checkmark.circle.fill"
        case .discontinued: return "xmark.circle"
        }
    }
}

// MARK: - Session Frequency
enum SessionFrequency: String, Codable, CaseIterable {
    case weekly
    case biweekly
    case monthly
    case asNeeded = "as_needed"

    var displayName: String {
        switch self {
        case .weekly: return "Weekly"
        case .biweekly: return "Bi-weekly"
        case .monthly: return "Monthly"
        case .asNeeded: return "As Needed"
        }
    }
}

// MARK: - Case Conceptualization (5 P's Framework)
struct CaseConceptualization: Identifiable, Codable, Equatable {
    let id: String
    let clientId: String
    let therapistId: String
    var presenting: String // Presenting problems
    var predisposing: String // Predisposing factors
    var precipitating: String // Precipitating factors
    var perpetuating: String // Perpetuating factors
    var protective: String // Protective factors
    var formulation: String?
    let createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case therapistId = "therapist_id"
        case presenting
        case predisposing
        case precipitating
        case perpetuating
        case protective
        case formulation
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Alliance Score
struct AllianceScore: Identifiable, Codable, Equatable {
    let id: String
    let clientId: String
    var sessionId: String?
    let therapistId: String
    var score: Double // 1-10 scale
    var factors: AllianceFactors?
    var assessmentDate: Date
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case sessionId = "session_id"
        case therapistId = "therapist_id"
        case score
        case factors
        case assessmentDate = "assessment_date"
        case createdAt = "created_at"
    }
}

// MARK: - Alliance Factors
struct AllianceFactors: Codable, Equatable {
    var trust: Double?
    var rapport: Double?
    var collaboration: Double?
    var goalAgreement: Double?
    var taskAgreement: Double?
    var bond: Double?
}

// MARK: - Create Treatment Plan Input
struct CreateTreatmentPlanInput: Codable {
    var clientId: String
    var diagnosis: String?
    var startDate: Date?
    var targetEndDate: Date?
    var goals: [TreatmentGoalInput]?
    var interventions: [String]?
    var frequency: SessionFrequency?
    var estimatedDuration: Int?

    enum CodingKeys: String, CodingKey {
        case clientId = "client_id"
        case diagnosis
        case startDate = "start_date"
        case targetEndDate = "target_end_date"
        case goals
        case interventions
        case frequency
        case estimatedDuration = "estimated_duration"
    }

    init(clientId: String,
         diagnosis: String? = nil,
         startDate: Date? = nil,
         targetEndDate: Date? = nil,
         goals: [TreatmentGoalInput]? = nil,
         interventions: [String]? = nil,
         frequency: SessionFrequency? = nil,
         estimatedDuration: Int? = nil) {
        self.clientId = clientId
        self.diagnosis = diagnosis
        self.startDate = startDate
        self.targetEndDate = targetEndDate
        self.goals = goals
        self.interventions = interventions
        self.frequency = frequency
        self.estimatedDuration = estimatedDuration
    }
}

// MARK: - Treatment Goal Input
struct TreatmentGoalInput: Codable {
    var description: String
    var targetDate: Date?

    enum CodingKeys: String, CodingKey {
        case description
        case targetDate = "target_date"
    }

    init(description: String, targetDate: Date? = nil) {
        self.description = description
        self.targetDate = targetDate
    }
}
