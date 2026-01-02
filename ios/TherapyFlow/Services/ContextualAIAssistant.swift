import Foundation
import SwiftUI

// MARK: - Screen Context
enum ScreenContext: String, Codable {
    case dashboard
    case clientList
    case clientDetail
    case sessionDetail
    case calendar
    case progressNotes
    case progressNoteDetail
    case settings
    case unknown

    var displayName: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .clientList: return "Clients"
        case .clientDetail: return "Client Details"
        case .sessionDetail: return "Session"
        case .calendar: return "Calendar"
        case .progressNotes: return "Progress Notes"
        case .progressNoteDetail: return "Progress Note"
        case .settings: return "Settings"
        case .unknown: return "App"
        }
    }
}

// MARK: - Contextual Suggestion
struct ContextualSuggestion: Identifiable, Codable {
    let id: String
    let question: String
    let category: SuggestionCategory
    let priority: Int

    init(id: String = UUID().uuidString, question: String, category: SuggestionCategory, priority: Int = 0) {
        self.id = id
        self.question = question
        self.category = category
        self.priority = priority
    }

    enum SuggestionCategory: String, Codable {
        case clinical
        case documentation
        case scheduling
        case insights
        case help
    }
}

// MARK: - AI Assistant Response
struct AIAssistantResponse: Codable {
    let answer: String
    let suggestions: [String]?
    let relatedClients: [String]?
    let relatedSessions: [String]?

    enum CodingKeys: String, CodingKey {
        case answer
        case suggestions
        case relatedClients = "related_clients"
        case relatedSessions = "related_sessions"
    }
}

// MARK: - Contextual AI Assistant Service
@MainActor
class ContextualAIAssistant: ObservableObject {
    static let shared = ContextualAIAssistant()

    @Published var isLoading = false
    @Published var currentContext: ScreenContext = .unknown
    @Published var suggestions: [ContextualSuggestion] = []
    @Published var lastResponse: AIAssistantResponse?
    @Published var conversationHistory: [(question: String, answer: String)] = []

    // Context-specific data
    private var currentClient: Client?
    private var currentSession: Session?
    private var currentNote: ProgressNote?

    private init() {}

    // MARK: - Context Updates

    func updateContext(_ context: ScreenContext, client: Client? = nil, session: Session? = nil, note: ProgressNote? = nil) {
        currentContext = context
        currentClient = client
        currentSession = session
        currentNote = note
        generateSuggestions()
    }

    // MARK: - Suggestion Generation

    private func generateSuggestions() {
        var newSuggestions: [ContextualSuggestion] = []

        switch currentContext {
        case .dashboard:
            newSuggestions = [
                ContextualSuggestion(question: "Which clients need attention this week?", category: .clinical, priority: 1),
                ContextualSuggestion(question: "Are there any overdue progress notes?", category: .documentation, priority: 2),
                ContextualSuggestion(question: "Show me today's schedule", category: .scheduling, priority: 3),
                ContextualSuggestion(question: "What patterns are emerging across my caseload?", category: .insights, priority: 4)
            ]

        case .clientList:
            newSuggestions = [
                ContextualSuggestion(question: "Which clients have the highest risk levels?", category: .clinical, priority: 1),
                ContextualSuggestion(question: "Who haven't I seen in over 2 weeks?", category: .scheduling, priority: 2),
                ContextualSuggestion(question: "Show clients with pending documentation", category: .documentation, priority: 3),
                ContextualSuggestion(question: "What are common themes across my caseload?", category: .insights, priority: 4)
            ]

        case .clientDetail:
            if let client = currentClient {
                newSuggestions = [
                    ContextualSuggestion(question: "Summarize \(client.name)'s treatment progress", category: .clinical, priority: 1),
                    ContextualSuggestion(question: "What themes recur in \(client.name)'s sessions?", category: .insights, priority: 2),
                    ContextualSuggestion(question: "Suggest interventions for \(client.name)", category: .clinical, priority: 3),
                    ContextualSuggestion(question: "Are there any risk factors to monitor?", category: .clinical, priority: 4),
                    ContextualSuggestion(question: "What should I focus on in the next session?", category: .clinical, priority: 5)
                ]
            }

        case .sessionDetail:
            if let session = currentSession, let client = currentClient ?? session.client {
                newSuggestions = [
                    ContextualSuggestion(question: "Prepare me for this session with \(client.name)", category: .clinical, priority: 1),
                    ContextualSuggestion(question: "What did we cover in the last session?", category: .clinical, priority: 2),
                    ContextualSuggestion(question: "Suggest opening questions for this session", category: .clinical, priority: 3),
                    ContextualSuggestion(question: "What homework was assigned last time?", category: .clinical, priority: 4)
                ]
            }

        case .calendar:
            newSuggestions = [
                ContextualSuggestion(question: "What's my availability this week?", category: .scheduling, priority: 1),
                ContextualSuggestion(question: "Which sessions have missing notes?", category: .documentation, priority: 2),
                ContextualSuggestion(question: "Are there any scheduling conflicts?", category: .scheduling, priority: 3),
                ContextualSuggestion(question: "How many sessions do I have this month?", category: .insights, priority: 4)
            ]

        case .progressNotes:
            newSuggestions = [
                ContextualSuggestion(question: "Which notes need my review?", category: .documentation, priority: 1),
                ContextualSuggestion(question: "Show notes flagged for follow-up", category: .clinical, priority: 2),
                ContextualSuggestion(question: "Are there any incomplete notes?", category: .documentation, priority: 3),
                ContextualSuggestion(question: "Summarize this week's sessions", category: .insights, priority: 4)
            ]

        case .progressNoteDetail:
            if let note = currentNote {
                let clientName = currentClient?.name ?? "this client"
                newSuggestions = [
                    ContextualSuggestion(question: "Suggest clinical tags for this note", category: .documentation, priority: 1),
                    ContextualSuggestion(question: "What risk factors are mentioned?", category: .clinical, priority: 2),
                    ContextualSuggestion(question: "How does this compare to previous sessions?", category: .insights, priority: 3),
                    ContextualSuggestion(question: "Suggest follow-up actions", category: .clinical, priority: 4)
                ]
            }

        case .settings:
            newSuggestions = [
                ContextualSuggestion(question: "How do I sync my calendar?", category: .help, priority: 1),
                ContextualSuggestion(question: "How do I import progress notes?", category: .help, priority: 2),
                ContextualSuggestion(question: "What AI features are available?", category: .help, priority: 3)
            ]

        case .unknown:
            newSuggestions = [
                ContextualSuggestion(question: "What can you help me with?", category: .help, priority: 1),
                ContextualSuggestion(question: "Show me my dashboard", category: .help, priority: 2)
            ]
        }

        suggestions = newSuggestions.sorted { $0.priority < $1.priority }
    }

    // MARK: - Ask Question

    func askQuestion(_ question: String) async throws -> AIAssistantResponse {
        isLoading = true
        defer { isLoading = false }

        // Build context for the API request
        var contextData: [String: Any] = [
            "question": question,
            "screen_context": currentContext.rawValue
        ]

        if let client = currentClient {
            contextData["client_id"] = client.id
            contextData["client_name"] = client.name
        }

        if let session = currentSession {
            contextData["session_id"] = session.id
            contextData["session_date"] = ISO8601DateFormatter().string(from: session.scheduledAt)
        }

        if let note = currentNote {
            contextData["note_id"] = note.id
        }

        // Add conversation history for context
        if !conversationHistory.isEmpty {
            let historyStrings = conversationHistory.suffix(5).map { "Q: \($0.question)\nA: \($0.answer)" }
            contextData["conversation_history"] = historyStrings
        }

        let response: AIAssistantResponse = try await APIClient.shared.request(
            endpoint: "/api/ai/assistant",
            method: .post,
            body: contextData
        )

        lastResponse = response
        conversationHistory.append((question: question, answer: response.answer))

        // Keep conversation history manageable
        if conversationHistory.count > 20 {
            conversationHistory.removeFirst(10)
        }

        return response
    }

    func clearConversation() {
        conversationHistory.removeAll()
        lastResponse = nil
    }
}
