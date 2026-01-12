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

// MARK: - AI Assistant Request (Enhanced with Full Context)
struct AIAssistantRequest: Codable {
    let question: String
    let screenContext: String
    let clientId: String?
    let clientName: String?
    let sessionId: String?
    let sessionDate: String?
    let noteId: String?
    let conversationHistory: [String]?

    // Enhanced context for full application access
    let fullContext: FullApplicationContext?

    enum CodingKeys: String, CodingKey {
        case question
        case screenContext = "screen_context"
        case clientId = "client_id"
        case clientName = "client_name"
        case sessionId = "session_id"
        case sessionDate = "session_date"
        case noteId = "note_id"
        case conversationHistory = "conversation_history"
        case fullContext = "full_context"
    }
}

// MARK: - Full Application Context
struct FullApplicationContext: Codable {
    let caseloadSummary: CaseloadSummary?
    let recentClients: [ClientSummary]?
    let recentNotes: [NoteSummary]?
    let upcomingSessions: [SessionSummary]?
    let riskAlerts: [RiskAlert]?
    let treatmentPlanSummaries: [TreatmentPlanSummary]?

    enum CodingKeys: String, CodingKey {
        case caseloadSummary = "caseload_summary"
        case recentClients = "recent_clients"
        case recentNotes = "recent_notes"
        case upcomingSessions = "upcoming_sessions"
        case riskAlerts = "risk_alerts"
        case treatmentPlanSummaries = "treatment_plan_summaries"
    }
}

struct CaseloadSummary: Codable {
    let totalClients: Int
    let activeClients: Int
    let totalSessionsThisWeek: Int
    let pendingNotes: Int
    let highRiskClients: Int

    enum CodingKeys: String, CodingKey {
        case totalClients = "total_clients"
        case activeClients = "active_clients"
        case totalSessionsThisWeek = "total_sessions_this_week"
        case pendingNotes = "pending_notes"
        case highRiskClients = "high_risk_clients"
    }
}

struct ClientSummary: Codable {
    let id: String
    let name: String
    let status: String
    let lastSessionDate: String?
    let riskLevel: String?
    let tags: [String]?

    enum CodingKeys: String, CodingKey {
        case id, name, status
        case lastSessionDate = "last_session_date"
        case riskLevel = "risk_level"
        case tags
    }
}

struct NoteSummary: Codable {
    let id: String
    let clientName: String
    let sessionDate: String
    let contentPreview: String?
    let riskLevel: String?
    let tags: [String]?

    enum CodingKeys: String, CodingKey {
        case id
        case clientName = "client_name"
        case sessionDate = "session_date"
        case contentPreview = "content_preview"
        case riskLevel = "risk_level"
        case tags
    }
}

struct SessionSummary: Codable {
    let id: String
    let clientName: String
    let scheduledAt: String
    let sessionType: String
    let hasPrep: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case clientName = "client_name"
        case scheduledAt = "scheduled_at"
        case sessionType = "session_type"
        case hasPrep = "has_prep"
    }
}

struct RiskAlert: Codable {
    let clientId: String
    let clientName: String
    let riskLevel: String
    let riskFactors: [String]?
    let lastAssessmentDate: String?

    enum CodingKeys: String, CodingKey {
        case clientId = "client_id"
        case clientName = "client_name"
        case riskLevel = "risk_level"
        case riskFactors = "risk_factors"
        case lastAssessmentDate = "last_assessment_date"
    }
}

struct TreatmentPlanSummary: Codable {
    let id: String
    let clientName: String
    let diagnosis: String?
    let activeGoals: Int
    let status: String

    enum CodingKeys: String, CodingKey {
        case id
        case clientName = "client_name"
        case diagnosis
        case activeGoals = "active_goals"
        case status
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
    @Published var fullContextEnabled = true  // Enable full application context by default

    // Context-specific data
    private var currentClient: Client?
    private var currentSession: Session?
    private var currentNote: ProgressNote?

    // Use FullContextProvider for comprehensive context
    private var lastContextRefresh: Date?

    private init() {
        // Context is loaded by FullContextProvider on init
    }

    // MARK: - Full Context Management

    /// Refresh the comprehensive context from FullContextProvider
    func refreshFullContext() async {
        guard fullContextEnabled else { return }
        await FullContextProvider.shared.refreshContext()
        lastContextRefresh = Date()
    }

    /// Get comprehensive context from FullContextProvider and convert to API format
    private func getFullContext() async -> FullApplicationContext? {
        guard fullContextEnabled else { return nil }

        // Get context from unified provider
        guard let comprehensiveContext = await FullContextProvider.shared.getFullContext() else {
            return nil
        }

        // Convert to FullApplicationContext format for API compatibility
        let caseloadSummary = CaseloadSummary(
            totalClients: comprehensiveContext.practiceStats.totalClients,
            activeClients: comprehensiveContext.practiceStats.activeClients,
            totalSessionsThisWeek: comprehensiveContext.practiceStats.sessionsThisWeek,
            pendingNotes: comprehensiveContext.practiceStats.pendingNotes,
            highRiskClients: comprehensiveContext.practiceStats.highRiskClients
        )

        // Map all clients (no truncation)
        let clientSummaries = comprehensiveContext.clients.map { client in
            ClientSummary(
                id: client.id,
                name: client.name,
                status: client.status,
                lastSessionDate: client.lastSessionDate,
                riskLevel: client.currentRiskLevel,
                tags: client.tags
            )
        }

        // Map all recent notes (increased limit)
        let noteSummaries = comprehensiveContext.recentNotes.map { note in
            NoteSummary(
                id: note.id,
                clientName: note.clientName,
                sessionDate: note.date,
                contentPreview: note.summary,
                riskLevel: note.riskLevel,
                tags: note.themes
            )
        }

        // Map all upcoming sessions (increased limit)
        let sessionSummaries = comprehensiveContext.upcomingSessions.map { session in
            SessionSummary(
                id: session.id,
                clientName: session.clientName,
                scheduledAt: session.formattedDateTime,
                sessionType: session.sessionType,
                hasPrep: !session.prepNotes.isEmpty
            )
        }

        // Map risk alerts
        let riskAlerts = comprehensiveContext.riskAlerts.map { alert in
            RiskAlert(
                clientId: alert.clientId,
                clientName: alert.clientName,
                riskLevel: alert.riskLevel,
                riskFactors: alert.riskFactors,
                lastAssessmentDate: alert.lastAssessmentDate
            )
        }

        // Map treatment plans
        let treatmentPlanSummaries = comprehensiveContext.treatmentPlans.map { plan in
            TreatmentPlanSummary(
                id: plan.id,
                clientName: plan.clientName,
                diagnosis: plan.diagnosis,
                activeGoals: plan.activeGoalsCount,
                status: plan.status
            )
        }

        lastContextRefresh = Date()

        return FullApplicationContext(
            caseloadSummary: caseloadSummary,
            recentClients: clientSummaries,
            recentNotes: noteSummaries,
            upcomingSessions: sessionSummaries,
            riskAlerts: riskAlerts,
            treatmentPlanSummaries: treatmentPlanSummaries
        )
    }

    /// Get full context string for AI prompts (includes calendar events)
    func getFullContextString() async -> String {
        guard fullContextEnabled else { return "" }
        return await FullContextProvider.shared.getFullContextString()
    }

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
            if currentNote != nil {
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

        // Build history strings
        var historyStrings: [String]? = nil
        if !conversationHistory.isEmpty {
            historyStrings = conversationHistory.suffix(5).map { "Q: \($0.question)\nA: \($0.answer)" }
        }

        // Get full context if enabled
        let fullContext = await getFullContext()

        // Build the request using the Codable struct with full context
        let requestBody = AIAssistantRequest(
            question: question,
            screenContext: currentContext.rawValue,
            clientId: currentClient?.id,
            clientName: currentClient?.name,
            sessionId: currentSession?.id,
            sessionDate: currentSession.map { ISO8601DateFormatter().string(from: $0.scheduledAt) },
            noteId: currentNote?.id,
            conversationHistory: historyStrings,
            fullContext: fullContext
        )

        do {
            let response: AIAssistantResponse = try await APIClient.shared.request(
                endpoint: "/api/ai/assistant",
                method: .post,
                body: requestBody
            )

            lastResponse = response
            conversationHistory.append((question: question, answer: response.answer))

            // Keep conversation history manageable
            if conversationHistory.count > 20 {
                conversationHistory.removeFirst(10)
            }

            return response
        } catch {
            // Backend API failed - try local AI with full context
            print("Backend AI assistant failed: \(error.localizedDescription), trying local AI with context")
            return try await askQuestionLocally(question, fullContext: fullContext, historyStrings: historyStrings)
        }
    }

    /// Fallback: Ask question using direct Anthropic API with local context data
    private func askQuestionLocally(_ question: String, fullContext: FullApplicationContext?, historyStrings: [String]?) async throws -> AIAssistantResponse {
        // Get API key from IntegrationsService
        let apiKey = IntegrationsService.shared.getAPIKey(for: .anthropic)

        guard !apiKey.isEmpty else {
            let errorAnswer = "I'm unable to access the AI service right now. Please configure your API key in Settings > Integrations, or ensure your internet connection is working."
            let response = AIAssistantResponse(answer: errorAnswer, suggestions: nil, relatedClients: nil, relatedSessions: nil)
            conversationHistory.append((question: question, answer: errorAnswer))
            return response
        }

        // Build comprehensive system prompt with FULL practice data (including calendar events)
        let systemPrompt = await buildComprehensiveSystemPrompt()

        // Build conversation messages
        var messages: [[String: String]] = []

        // Add conversation history
        if let history = historyStrings {
            for historyItem in history.suffix(3) {
                // Parse Q: and A: format
                let parts = historyItem.components(separatedBy: "\nA: ")
                if parts.count == 2 {
                    let userQuestion = parts[0].replacingOccurrences(of: "Q: ", with: "")
                    let assistantAnswer = parts[1]
                    messages.append(["role": "user", "content": userQuestion])
                    messages.append(["role": "assistant", "content": assistantAnswer])
                }
            }
        }

        // Add current question
        messages.append(["role": "user", "content": question])

        let url = URL(string: "https://api.anthropic.com/v1/messages")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let body: [String: Any] = [
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 2048,
            "system": systemPrompt,
            "messages": messages
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "ContextualAIAssistant", code: -1, userInfo: [NSLocalizedDescriptionKey: "AI service temporarily unavailable"])
        }

        // Parse Anthropic response
        struct AnthropicResponse: Decodable {
            let content: [ContentBlock]

            struct ContentBlock: Decodable {
                let type: String
                let text: String?
            }
        }

        let anthropicResponse = try JSONDecoder().decode(AnthropicResponse.self, from: data)

        guard let textContent = anthropicResponse.content.first?.text else {
            throw NSError(domain: "ContextualAIAssistant", code: -2, userInfo: [NSLocalizedDescriptionKey: "Invalid response from AI"])
        }

        let aiResponse = AIAssistantResponse(
            answer: textContent,
            suggestions: generateFollowUpSuggestions(for: question),
            relatedClients: extractRelatedClients(from: textContent, context: fullContext),
            relatedSessions: nil
        )

        lastResponse = aiResponse
        conversationHistory.append((question: question, answer: textContent))

        // Keep conversation history manageable
        if conversationHistory.count > 20 {
            conversationHistory.removeFirst(10)
        }

        return aiResponse
    }

    /// Build a comprehensive system prompt using FullContextProvider (includes calendar events)
    private func buildComprehensiveSystemPrompt() async -> String {
        // Get the full context string from FullContextProvider (includes ALL data)
        let fullPracticeData = await FullContextProvider.shared.getFullContextString()

        var prompt = """
        You are an AI assistant for TherapyFlow, a mental health practice management application.
        You are helping a therapist manage their practice. You have FULL ACCESS to their entire practice:
        - ALL clients and their complete details
        - ALL sessions (past, scheduled, recurring)
        - ALL progress notes with themes and risk assessments
        - ALL treatment plans and goals
        - ALL calendar events (Google Calendar, SimplePractice, and TherapyFlow appointments)
        - Scheduling and availability information

        IMPORTANT: You CAN and SHOULD provide specific information about clients, sessions, notes,
        and calendar events when asked. The therapist has authorized you to access all their practice data.

        Be conversational, warm, and professional. Provide specific, actionable information.
        When discussing clients, use their names and reference specific details from their records.
        When discussing schedule or availability, reference calendar events from all sources.

        Current screen context: \(currentContext.displayName)
        """

        // Add current client context if viewing a specific client
        if let client = currentClient {
            prompt += """

            \n--- CURRENTLY VIEWING CLIENT ---
            Name: \(client.name)
            Status: \(client.status.displayName)
            Email: \(client.email ?? "Not provided")
            Phone: \(client.phone ?? "Not provided")
            Tags: \(client.tags.joined(separator: ", "))
            Clinical Considerations: \(client.clinicalConsiderations.joined(separator: ", "))
            Preferred Modalities: \(client.preferredModalities.joined(separator: ", "))
            """
        }

        // Add current session context
        if let session = currentSession {
            prompt += """

            \n--- CURRENT SESSION ---
            Date: \(session.formattedDate)
            Time: \(session.formattedTimeRange)
            Type: \(session.sessionType.displayName)
            Duration: \(session.duration) minutes
            Status: \(session.status.displayName)
            Notes: \(session.notes ?? "None")
            """
        }

        // Add current note context
        if let note = currentNote {
            prompt += """

            \n--- CURRENT PROGRESS NOTE ---
            Client: \(note.clientName ?? note.client?.name ?? "Unknown")
            Session Date: \(note.formattedDate)
            Risk Level: \(note.riskLevel.displayName)
            Tags: \(note.allTags.joined(separator: ", "))
            Content Preview: \(note.contentPreview)
            """
        }

        // Add full practice data from FullContextProvider
        prompt += "\n\n"
        prompt += fullPracticeData

        prompt += """

        \n\n--- INSTRUCTIONS ---
        - Always provide specific, helpful information based on the data above
        - If asked about a specific client, search the client database and provide their details
        - If asked about upcoming sessions or schedule, reference the calendar & appointments section
        - If asked about notes or documentation, reference the session notes
        - If asked about availability, check the calendar events across all sources
        - Be proactive in offering relevant insights from the data
        - If you genuinely don't have certain information, say so clearly but offer what you do have

        --- FORMATTING ---
        IMPORTANT: Always respond in plain text only. Do NOT use any markdown formatting such as:
        - No headers (# or ##)
        - No bold (**text**) or italic (*text*)
        - No bullet points or numbered lists with special characters
        - No code blocks or backticks
        - No links or special formatting
        Use natural paragraph breaks and plain text formatting only.
        """

        return prompt
    }

    /// Build a system prompt with FullApplicationContext (for API compatibility)
    private func buildSystemPromptWithContext(_ fullContext: FullApplicationContext?) -> String {
        var prompt = """
        You are an AI assistant for TherapyFlow, a mental health practice management application.
        You are helping a therapist manage their practice. You have FULL ACCESS to their client data,
        session schedules, progress notes, and all other practice information.

        IMPORTANT: You CAN and SHOULD provide specific information about clients, sessions, and notes
        when asked. The therapist has authorized you to access all their practice data.

        Be conversational, warm, and professional. Provide specific, actionable information.
        When discussing clients, use their names and reference specific details from their records.

        FORMATTING: Always respond in plain text only. Do NOT use markdown formatting (no headers, bold, italic, bullets, code blocks, or links). Use natural paragraph breaks only.

        Current screen context: \(currentContext.displayName)
        """

        // Add current client context if viewing a specific client
        if let client = currentClient {
            prompt += """

            \n--- CURRENTLY VIEWING CLIENT ---
            Name: \(client.name)
            Status: \(client.status.displayName)
            Email: \(client.email ?? "Not provided")
            Phone: \(client.phone ?? "Not provided")
            Tags: \(client.tags.joined(separator: ", "))
            Clinical Considerations: \(client.clinicalConsiderations.joined(separator: ", "))
            Preferred Modalities: \(client.preferredModalities.joined(separator: ", "))
            """
        }

        // Add current session context
        if let session = currentSession {
            prompt += """

            \n--- CURRENT SESSION ---
            Date: \(session.formattedDate)
            Time: \(session.formattedTimeRange)
            Type: \(session.sessionType.displayName)
            Duration: \(session.duration) minutes
            Status: \(session.status.displayName)
            Notes: \(session.notes ?? "None")
            """
        }

        // Add current note context
        if let note = currentNote {
            prompt += """

            \n--- CURRENT PROGRESS NOTE ---
            Client: \(note.clientName ?? note.client?.name ?? "Unknown")
            Session Date: \(note.formattedDate)
            Risk Level: \(note.riskLevel.displayName)
            Tags: \(note.allTags.joined(separator: ", "))
            Content Preview: \(note.contentPreview)
            """
        }

        // Add full practice context if available
        if let context = fullContext {
            prompt += "\n\n--- FULL PRACTICE DATA ---"

            if let summary = context.caseloadSummary {
                prompt += """

                \nCASELOAD SUMMARY:
                - Total Clients: \(summary.totalClients)
                - Active Clients: \(summary.activeClients)
                - Sessions This Week: \(summary.totalSessionsThisWeek)
                - Pending Notes: \(summary.pendingNotes)
                - High Risk Clients: \(summary.highRiskClients)
                """
            }

            if let clients = context.recentClients, !clients.isEmpty {
                prompt += "\n\nCLIENT LIST:"
                for client in clients {
                    prompt += "\n- \(client.name) (Status: \(client.status), Tags: \(client.tags?.joined(separator: ", ") ?? "none"))"
                }
            }

            if let sessions = context.upcomingSessions, !sessions.isEmpty {
                prompt += "\n\nUPCOMING SESSIONS:"
                for session in sessions {
                    prompt += "\n- \(session.clientName) on \(session.scheduledAt) (\(session.sessionType))"
                }
            }

            if let notes = context.recentNotes, !notes.isEmpty {
                prompt += "\n\nRECENT PROGRESS NOTES:"
                for note in notes {
                    prompt += "\n- \(note.clientName) (\(note.sessionDate)): \(note.contentPreview ?? "No preview")"
                    if let riskLevel = note.riskLevel {
                        prompt += " [Risk: \(riskLevel)]"
                    }
                }
            }

            if let alerts = context.riskAlerts, !alerts.isEmpty {
                prompt += "\n\nRISK ALERTS:"
                for alert in alerts {
                    prompt += "\n- \(alert.clientName): \(alert.riskLevel) risk"
                    if let factors = alert.riskFactors {
                        prompt += " (Factors: \(factors.joined(separator: ", ")))"
                    }
                }
            }

            if let plans = context.treatmentPlanSummaries, !plans.isEmpty {
                prompt += "\n\nTREATMENT PLANS:"
                for plan in plans {
                    prompt += "\n- \(plan.clientName): \(plan.activeGoals) active goals, Status: \(plan.status)"
                    if let diagnosis = plan.diagnosis {
                        prompt += ", Diagnosis: \(diagnosis)"
                    }
                }
            }
        }

        prompt += """

        \n\n--- INSTRUCTIONS ---
        - Always provide specific, helpful information based on the data above
        - If asked about a specific client, search the client list and provide their details
        - If asked about upcoming sessions, reference the session list
        - If asked about notes or documentation, reference the recent notes
        - Be proactive in offering relevant insights from the data
        - If you genuinely don't have certain information, say so clearly but offer what you do have
        """

        return prompt
    }

    /// Generate follow-up suggestions based on the question
    private func generateFollowUpSuggestions(for question: String) -> [String]? {
        let lowercaseQuestion = question.lowercased()

        if lowercaseQuestion.contains("client") || lowercaseQuestion.contains("patient") {
            return [
                "What are their recent session themes?",
                "Are there any risk factors to monitor?",
                "What interventions have been effective?"
            ]
        } else if lowercaseQuestion.contains("session") || lowercaseQuestion.contains("appointment") {
            return [
                "What should I prepare for this session?",
                "What did we cover last time?",
                "Are there any pending notes?"
            ]
        } else if lowercaseQuestion.contains("note") || lowercaseQuestion.contains("documentation") {
            return [
                "Which notes need review?",
                "Are there overdue notes?",
                "Show notes with risk flags"
            ]
        }

        return [
            "Tell me more about my caseload",
            "Which clients need attention?",
            "What's on my schedule today?"
        ]
    }

    /// Extract related client names from AI response
    private func extractRelatedClients(from response: String, context: FullApplicationContext?) -> [String]? {
        guard let clients = context?.recentClients else { return nil }

        var mentioned: [String] = []
        for client in clients {
            if response.localizedCaseInsensitiveContains(client.name) {
                mentioned.append(client.id)
            }
        }

        return mentioned.isEmpty ? nil : mentioned
    }

    /// Ask a question with explicit full context refresh
    func askQuestionWithFullContext(_ question: String) async throws -> AIAssistantResponse {
        // Force refresh context before asking
        await refreshFullContext()
        return try await askQuestion(question)
    }

    func clearConversation() {
        conversationHistory.removeAll()
        lastResponse = nil
    }
}
