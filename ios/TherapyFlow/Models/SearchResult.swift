import Foundation

// MARK: - Search Result Model
struct SearchResult: Identifiable, Codable, Equatable {
    let id: String
    var type: SearchResultType
    var title: String
    var content: String
    var matchedText: String?
    var relevanceScore: Double
    var clientName: String?
    var sessionDate: Date?
    var themes: [String]?
    var riskLevel: RiskLevel?

    // Computed properties
    var formattedRelevance: String {
        String(format: "%.0f%%", relevanceScore * 100)
    }

    var formattedDate: String? {
        guard let date = sessionDate else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    var icon: String {
        switch type {
        case .note: return "doc.text"
        case .session: return "calendar"
        case .client: return "person"
        case .document: return "doc"
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case title
        case content
        case matchedText = "matched_text"
        case relevanceScore = "relevance_score"
        case clientName = "client_name"
        case sessionDate = "session_date"
        case themes
        case riskLevel = "risk_level"
    }
}

// MARK: - Search Result Type
enum SearchResultType: String, Codable, CaseIterable {
    case note
    case session
    case client
    case document

    var displayName: String {
        switch self {
        case .note: return "Progress Note"
        case .session: return "Session"
        case .client: return "Client"
        case .document: return "Document"
        }
    }

    var icon: String {
        switch self {
        case .note: return "doc.text"
        case .session: return "calendar"
        case .client: return "person"
        case .document: return "doc"
        }
    }
}

// MARK: - Search Query
struct SearchQuery {
    var query: String
    var type: SearchResultType?
    var clientId: String?
    var dateRange: DateRange?
    var limit: Int = 20
    var offset: Int = 0

    var queryParameters: [String: String] {
        var params: [String: String] = ["query": query]
        if let type = type {
            params["type"] = type.rawValue
        }
        if let clientId = clientId {
            params["client_id"] = clientId
        }
        if let dateRange = dateRange {
            params["dateRange"] = dateRange.rawValue
        }
        params["limit"] = String(limit)
        params["offset"] = String(offset)
        return params
    }
}

// MARK: - Date Range
enum DateRange: String, CaseIterable {
    case all
    case week
    case month
    case quarter
    case year

    var displayName: String {
        switch self {
        case .all: return "All Time"
        case .week: return "Past Week"
        case .month: return "Past Month"
        case .quarter: return "Past 3 Months"
        case .year: return "Past Year"
        }
    }

    var startDate: Date? {
        let calendar = Calendar.current
        switch self {
        case .all: return nil
        case .week: return calendar.date(byAdding: .day, value: -7, to: Date())
        case .month: return calendar.date(byAdding: .month, value: -1, to: Date())
        case .quarter: return calendar.date(byAdding: .month, value: -3, to: Date())
        case .year: return calendar.date(byAdding: .year, value: -1, to: Date())
        }
    }
}

// MARK: - Search Response
struct SearchResponse: Codable {
    var results: [SearchResult]
    var totalCount: Int
    var hasMore: Bool
    var query: String
    var processingTime: Double?

    enum CodingKeys: String, CodingKey {
        case results
        case totalCount = "total_count"
        case hasMore = "has_more"
        case query
        case processingTime = "processing_time"
    }
}

// MARK: - Example Search Queries
struct ExampleSearchQuery: Identifiable {
    let id = UUID()
    let query: String
    let description: String
    let icon: String

    static let examples: [ExampleSearchQuery] = [
        ExampleSearchQuery(
            query: "anxiety management techniques",
            description: "Find notes about anxiety interventions",
            icon: "brain"
        ),
        ExampleSearchQuery(
            query: "progress with depression",
            description: "Track depression treatment progress",
            icon: "chart.line.uptrend.xyaxis"
        ),
        ExampleSearchQuery(
            query: "family conflict discussions",
            description: "Find family-related sessions",
            icon: "person.3"
        ),
        ExampleSearchQuery(
            query: "coping strategies for stress",
            description: "Search for stress management notes",
            icon: "heart.circle"
        ),
        ExampleSearchQuery(
            query: "medication changes",
            description: "Find notes about medication updates",
            icon: "pills"
        ),
        ExampleSearchQuery(
            query: "crisis intervention",
            description: "Locate crisis-related sessions",
            icon: "exclamationmark.triangle"
        )
    ]
}
