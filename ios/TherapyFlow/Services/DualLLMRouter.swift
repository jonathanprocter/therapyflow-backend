import Foundation

/// DualLLMRouter - Intelligent task routing between Claude and OpenAI
///
/// Claude (Anthropic) is used for:
/// - Complex clinical synthesis and analysis
/// - Progress note generation from transcripts
/// - Treatment plan creation
/// - Multi-session pattern analysis
/// - Risk assessment and clinical recommendations
/// - Long-form documentation
///
/// OpenAI is used for:
/// - Quick factual queries
/// - Simple scheduling questions
/// - Data lookups and retrieval
/// - Short conversational responses
/// - Basic summarization
@MainActor
class DualLLMRouter: ObservableObject {
    static let shared = DualLLMRouter()

    @Published var lastUsedProvider: AIProvider?
    @Published var routingStats: RoutingStats = RoutingStats()

    private let integrations = IntegrationsService.shared

    // MARK: - Task Categories

    enum TaskCategory {
        case clinicalSynthesis       // Claude - complex clinical analysis
        case progressNoteGeneration  // Claude - SOAP note creation
        case treatmentPlanning       // Claude - treatment plan creation
        case patternAnalysis         // Claude - multi-session patterns
        case riskAssessment          // Claude - safety and risk evaluation
        case longFormDocumentation   // Claude - detailed documentation

        case quickQuery              // OpenAI - simple questions
        case scheduling              // OpenAI - appointment queries
        case dataLookup              // OpenAI - retrieving specific info
        case shortConversation       // OpenAI - brief responses
        case basicSummarization      // OpenAI - short summaries

        var preferredProvider: AIProvider {
            switch self {
            case .clinicalSynthesis, .progressNoteGeneration, .treatmentPlanning,
                 .patternAnalysis, .riskAssessment, .longFormDocumentation:
                return .anthropic
            case .quickQuery, .scheduling, .dataLookup, .shortConversation, .basicSummarization:
                return .openAI
            }
        }

        var description: String {
            switch self {
            case .clinicalSynthesis: return "Clinical Synthesis"
            case .progressNoteGeneration: return "Progress Note Generation"
            case .treatmentPlanning: return "Treatment Planning"
            case .patternAnalysis: return "Pattern Analysis"
            case .riskAssessment: return "Risk Assessment"
            case .longFormDocumentation: return "Documentation"
            case .quickQuery: return "Quick Query"
            case .scheduling: return "Scheduling"
            case .dataLookup: return "Data Lookup"
            case .shortConversation: return "Conversation"
            case .basicSummarization: return "Summarization"
            }
        }
    }

    struct RoutingStats {
        var claudeRequests: Int = 0
        var openAIRequests: Int = 0
        var claudeTokensUsed: Int = 0
        var openAITokensUsed: Int = 0

        var totalRequests: Int { claudeRequests + openAIRequests }

        var claudePercentage: Double {
            guard totalRequests > 0 else { return 0 }
            return Double(claudeRequests) / Double(totalRequests) * 100
        }

        var openAIPercentage: Double {
            guard totalRequests > 0 else { return 0 }
            return Double(openAIRequests) / Double(totalRequests) * 100
        }
    }

    struct LLMResponse {
        let text: String
        let provider: AIProvider
        let category: TaskCategory
        let tokensUsed: Int?
    }

    private init() {}

    // MARK: - Automatic Task Classification

    /// Classify a task based on the prompt content
    func classifyTask(_ prompt: String, context: String? = nil) -> TaskCategory {
        let lowercasePrompt = prompt.lowercased()
        let lowercaseContext = context?.lowercased() ?? ""
        let combined = lowercasePrompt + " " + lowercaseContext

        // Clinical synthesis indicators
        let clinicalKeywords = ["analyze", "synthesize", "clinical", "assessment", "evaluate",
                                "diagnosis", "therapeutic", "formulation", "conceptualization"]
        if clinicalKeywords.contains(where: { combined.contains($0) }) {
            return .clinicalSynthesis
        }

        // Progress note generation indicators
        let noteKeywords = ["soap", "progress note", "session note", "document session",
                           "write note", "generate note", "create note", "documentation"]
        if noteKeywords.contains(where: { combined.contains($0) }) {
            return .progressNoteGeneration
        }

        // Treatment planning indicators
        let planKeywords = ["treatment plan", "treatment goal", "intervention", "objective",
                           "care plan", "therapeutic goal"]
        if planKeywords.contains(where: { combined.contains($0) }) {
            return .treatmentPlanning
        }

        // Pattern analysis indicators
        let patternKeywords = ["pattern", "trend", "over time", "multiple sessions", "history",
                              "longitudinal", "progress over"]
        if patternKeywords.contains(where: { combined.contains($0) }) {
            return .patternAnalysis
        }

        // Risk assessment indicators
        let riskKeywords = ["risk", "safety", "suicidal", "self-harm", "danger", "crisis",
                           "harm", "urgent", "emergency"]
        if riskKeywords.contains(where: { combined.contains($0) }) {
            return .riskAssessment
        }

        // Long-form documentation (detected by length or specific requests)
        if prompt.count > 500 || combined.contains("detailed") || combined.contains("comprehensive") {
            return .longFormDocumentation
        }

        // Scheduling indicators
        let scheduleKeywords = ["schedule", "appointment", "calendar", "when is", "next session",
                               "availability", "book", "reschedule"]
        if scheduleKeywords.contains(where: { combined.contains($0) }) {
            return .scheduling
        }

        // Data lookup indicators
        let lookupKeywords = ["show me", "list", "what is", "who is", "find", "get", "retrieve",
                             "how many", "which client"]
        if lookupKeywords.contains(where: { combined.contains($0) }) {
            return .dataLookup
        }

        // Basic summarization (short summaries)
        let summaryKeywords = ["summarize", "brief", "quick summary", "overview", "tldr"]
        if summaryKeywords.contains(where: { combined.contains($0) }) {
            return .basicSummarization
        }

        // Default to short conversation for general questions
        if prompt.count < 100 && !combined.contains("explain") && !combined.contains("describe") {
            return .shortConversation
        }

        // Default to quick query
        return .quickQuery
    }

    // MARK: - Route and Execute

    /// Route a task to the appropriate LLM and execute
    func routeAndExecute(prompt: String, context: String? = nil, systemPrompt: String? = nil) async throws -> LLMResponse {
        let category = classifyTask(prompt, context: context)
        let preferredProvider = category.preferredProvider

        // Check if ANY provider is available first
        guard hasAnyProviderConfigured() else {
            throw LLMError.apiKeyNotConfigured(provider: preferredProvider)
        }

        // Check if preferred provider is available
        let actualProvider = selectProvider(preferred: preferredProvider)

        print("DualLLMRouter: Routing '\(category.description)' task to \(actualProvider.displayName)")

        do {
            let response = try await executeWithProvider(
                actualProvider,
                prompt: prompt,
                context: context,
                systemPrompt: systemPrompt,
                category: category
            )

            // Update stats
            updateStats(provider: actualProvider, tokensUsed: response.tokensUsed ?? 0)

            return response
        } catch let error as LLMError {
            // If the primary provider fails due to API error, try fallback
            if case .apiError = error {
                let fallback: AIProvider = actualProvider == .anthropic ? .openAI : .anthropic
                if integrations.hasAPIKey(for: fallback) {
                    print("DualLLMRouter: Primary provider \(actualProvider.displayName) failed, attempting fallback to \(fallback.displayName)")
                    let response = try await executeWithProvider(
                        fallback,
                        prompt: prompt,
                        context: context,
                        systemPrompt: systemPrompt,
                        category: category
                    )
                    updateStats(provider: fallback, tokensUsed: response.tokensUsed ?? 0)
                    return response
                }
            }
            throw error
        }
    }

    /// Check if at least one AI provider is configured
    func hasAnyProviderConfigured() -> Bool {
        return integrations.hasAPIKey(for: .anthropic) || integrations.hasAPIKey(for: .openAI)
    }

    /// Check if both providers are configured for optimal dual routing
    func hasBothProvidersConfigured() -> Bool {
        return integrations.hasAPIKey(for: .anthropic) && integrations.hasAPIKey(for: .openAI)
    }

    /// Get configuration status message for UI
    func getConfigurationStatus() -> String {
        let hasAnthropic = integrations.hasAPIKey(for: .anthropic)
        let hasOpenAI = integrations.hasAPIKey(for: .openAI)

        if hasAnthropic && hasOpenAI {
            return "Dual LLM mode active: Claude for clinical analysis, GPT-4 for quick queries"
        } else if hasAnthropic {
            return "Claude (Anthropic) configured. Add OpenAI key for optimal routing."
        } else if hasOpenAI {
            return "OpenAI configured. Add Claude key for better clinical analysis."
        } else {
            return "No AI providers configured. Add API keys in Settings > Integrations."
        }
    }

    /// Force execution with a specific provider
    func executeWithProvider(_ provider: AIProvider, prompt: String, context: String? = nil, systemPrompt: String? = nil, category: TaskCategory? = nil) async throws -> LLMResponse {
        let taskCategory = category ?? classifyTask(prompt, context: context)

        switch provider {
        case .anthropic:
            let result = try await executeWithClaude(prompt: prompt, context: context, systemPrompt: systemPrompt)
            return LLMResponse(text: result.text, provider: .anthropic, category: taskCategory, tokensUsed: result.tokensUsed)
        case .openAI:
            let result = try await executeWithOpenAI(prompt: prompt, context: context, systemPrompt: systemPrompt)
            return LLMResponse(text: result.text, provider: .openAI, category: taskCategory, tokensUsed: result.tokensUsed)
        }
    }

    // MARK: - Provider Selection

    private func selectProvider(preferred: AIProvider) -> AIProvider {
        // Check if preferred provider has API key
        if integrations.hasAPIKey(for: preferred) {
            return preferred
        }

        // Fall back to the other provider
        let fallback: AIProvider = preferred == .anthropic ? .openAI : .anthropic
        if integrations.hasAPIKey(for: fallback) {
            print("DualLLMRouter: Preferred provider \(preferred.displayName) not configured, falling back to \(fallback.displayName)")
            return fallback
        }

        // No providers configured - return preferred anyway (will throw proper error later)
        print("DualLLMRouter: WARNING - No AI providers configured!")
        return preferred
    }

    // MARK: - Claude (Anthropic) Execution

    private func executeWithClaude(prompt: String, context: String?, systemPrompt: String?) async throws -> (text: String, tokensUsed: Int?) {
        let apiKey = integrations.getAPIKey(for: .anthropic)

        guard !apiKey.isEmpty else {
            throw LLMError.apiKeyNotConfigured(provider: .anthropic)
        }

        let url = URL(string: "https://api.anthropic.com/v1/messages")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let defaultSystemPrompt = """
        You are an AI assistant for TherapyFlow, a mental health practice management application.
        You help therapists with clinical documentation, analysis, and practice management.
        Be professional, warm, and clinically accurate. Use evidence-based approaches.

        IMPORTANT: Always respond in plain text only. Do NOT use any markdown formatting such as:
        - No headers (# or ##)
        - No bold (**text**) or italic (*text*)
        - No bullet points or numbered lists with special characters
        - No code blocks or backticks
        - No links or special formatting
        Use natural paragraph breaks and plain text formatting only.
        """

        var messages: [[String: String]] = []
        if let context = context, !context.isEmpty {
            messages.append(["role": "user", "content": "Context:\n\(context)"])
            messages.append(["role": "assistant", "content": "I understand the context. How can I help?"])
        }
        messages.append(["role": "user", "content": prompt])

        let body: [String: Any] = [
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 16384,  // Max output tokens for Claude
            "system": systemPrompt ?? defaultSystemPrompt,
            "messages": messages
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw LLMError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorBody = String(data: data, encoding: .utf8) {
                print("Claude API error: \(errorBody)")
            }
            throw LLMError.apiError(statusCode: httpResponse.statusCode, message: "Claude API request failed")
        }

        struct AnthropicResponse: Decodable {
            let content: [ContentBlock]
            let usage: Usage?

            struct ContentBlock: Decodable {
                let type: String
                let text: String?
            }

            struct Usage: Decodable {
                let input_tokens: Int
                let output_tokens: Int
            }
        }

        let anthropicResponse = try JSONDecoder().decode(AnthropicResponse.self, from: data)

        guard let text = anthropicResponse.content.first?.text else {
            throw LLMError.invalidResponse
        }

        let tokensUsed = anthropicResponse.usage.map { $0.input_tokens + $0.output_tokens }

        lastUsedProvider = .anthropic
        return (text, tokensUsed)
    }

    // MARK: - OpenAI Execution

    private func executeWithOpenAI(prompt: String, context: String?, systemPrompt: String?) async throws -> (text: String, tokensUsed: Int?) {
        let apiKey = integrations.getAPIKey(for: .openAI)

        guard !apiKey.isEmpty else {
            throw LLMError.apiKeyNotConfigured(provider: .openAI)
        }

        let url = URL(string: "https://api.openai.com/v1/chat/completions")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let defaultSystemPrompt = """
        You are an AI assistant for TherapyFlow, a mental health practice management app.
        Provide concise, helpful responses for scheduling, data lookup, and quick queries.
        Be professional and efficient.

        IMPORTANT: Always respond in plain text only. Do NOT use any markdown formatting such as:
        - No headers (# or ##)
        - No bold (**text**) or italic (*text*)
        - No bullet points or numbered lists with special characters
        - No code blocks or backticks
        - No links or special formatting
        Use natural paragraph breaks and plain text formatting only.
        """

        var messages: [[String: String]] = [
            ["role": "system", "content": systemPrompt ?? defaultSystemPrompt]
        ]

        if let context = context, !context.isEmpty {
            messages.append(["role": "user", "content": "Context:\n\(context)"])
            messages.append(["role": "assistant", "content": "I understand the context. How can I help?"])
        }
        messages.append(["role": "user", "content": prompt])

        let body: [String: Any] = [
            "model": "gpt-4o",  // Latest GPT-4o model
            "messages": messages,
            "max_tokens": 16384,  // Max output tokens for GPT-4o
            "temperature": 0.7
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw LLMError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorBody = String(data: data, encoding: .utf8) {
                print("OpenAI API error: \(errorBody)")
            }
            throw LLMError.apiError(statusCode: httpResponse.statusCode, message: "OpenAI API request failed")
        }

        struct OpenAIResponse: Decodable {
            let choices: [Choice]
            let usage: Usage?

            struct Choice: Decodable {
                let message: Message

                struct Message: Decodable {
                    let content: String
                }
            }

            struct Usage: Decodable {
                let total_tokens: Int
            }
        }

        let openAIResponse = try JSONDecoder().decode(OpenAIResponse.self, from: data)

        guard let choice = openAIResponse.choices.first else {
            throw LLMError.invalidResponse
        }

        lastUsedProvider = .openAI
        return (choice.message.content, openAIResponse.usage?.total_tokens)
    }

    // MARK: - Stats

    private func updateStats(provider: AIProvider, tokensUsed: Int) {
        switch provider {
        case .anthropic:
            routingStats.claudeRequests += 1
            routingStats.claudeTokensUsed += tokensUsed
        case .openAI:
            routingStats.openAIRequests += 1
            routingStats.openAITokensUsed += tokensUsed
        }
    }

    func resetStats() {
        routingStats = RoutingStats()
    }

    // MARK: - Specialized Methods

    /// Generate a progress note (always uses Claude)
    func generateProgressNote(transcript: String, clientName: String, sessionDate: Date) async throws -> String {
        let systemPrompt = """
        You are an expert clinical documentation assistant. Generate comprehensive SOAP notes
        and therapeutic documentation from session transcripts. Follow best practices for
        clinical documentation including:
        - Clear, professional language
        - Objective observations separate from subjective reports
        - Evidence-based assessments
        - Actionable treatment plans
        """

        let prompt = """
        Generate a comprehensive progress note for the following therapy session:

        Client: \(clientName)
        Session Date: \(DateFormatter.localizedString(from: sessionDate, dateStyle: .medium, timeStyle: .none))

        Session Transcript:
        \(transcript)

        Please provide:
        1. SOAP Note (Subjective, Objective, Assessment, Plan)
        2. Key Themes (5-7 significant themes)
        3. Tonal Analysis (emotional progression through session)
        4. Significant Quotes (10-15 verbatim quotes with clinical significance)
        5. Clinical Follow-Up recommendations
        6. Keywords and Tags for categorization
        """

        let response = try await executeWithProvider(
            .anthropic,
            prompt: prompt,
            systemPrompt: systemPrompt,
            category: .progressNoteGeneration
        )

        return response.text
    }

    /// Quick client lookup (uses OpenAI)
    func quickClientLookup(query: String, clientData: String) async throws -> String {
        let prompt = """
        Based on this client data, answer the following question concisely:

        Client Data:
        \(clientData)

        Question: \(query)

        Provide a brief, direct answer.
        """

        let response = try await executeWithProvider(
            .openAI,
            prompt: prompt,
            category: .dataLookup
        )

        return response.text
    }

    /// Analyze patterns across multiple sessions (uses Claude)
    func analyzePatterns(sessions: String) async throws -> String {
        let systemPrompt = """
        You are a clinical analysis expert specializing in identifying therapeutic patterns
        and progress indicators across multiple sessions. Provide insightful, actionable
        analysis that helps therapists optimize their treatment approaches.
        """

        let response = try await executeWithProvider(
            .anthropic,
            prompt: "Analyze the following sessions for patterns, themes, and progress indicators:\n\n\(sessions)",
            systemPrompt: systemPrompt,
            category: .patternAnalysis
        )

        return response.text
    }

    /// Quick scheduling query (uses OpenAI)
    func schedulingQuery(query: String, calendarData: String) async throws -> String {
        let prompt = """
        Calendar Data:
        \(calendarData)

        Scheduling Question: \(query)

        Provide a brief, helpful response about scheduling.
        """

        let response = try await executeWithProvider(
            .openAI,
            prompt: prompt,
            category: .scheduling
        )

        return response.text
    }
}

// MARK: - LLM Error

enum LLMError: LocalizedError {
    case apiKeyNotConfigured(provider: AIProvider)
    case invalidResponse
    case apiError(statusCode: Int, message: String)
    case providerUnavailable

    var errorDescription: String? {
        switch self {
        case .apiKeyNotConfigured(let provider):
            return "\(provider.displayName) API key not configured. Please add your API key in Settings > Integrations."
        case .invalidResponse:
            return "Invalid response from AI service"
        case .apiError(let statusCode, let message):
            return "API error (\(statusCode)): \(message)"
        case .providerUnavailable:
            return "AI provider is currently unavailable"
        }
    }
}
