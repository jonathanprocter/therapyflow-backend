import Foundation
import Combine

/// Service for AI assistant chat and voice functionality
class AIAssistantService: ObservableObject {
    static let shared = AIAssistantService()

    @Published var isProcessing = false
    @Published var lastError: String?
    @Published var conversationHistory: [ChatMessage] = []
    @Published var availableVoices: [VoiceOption] = []
    @Published var selectedVoiceId: String = ""
    @Published var voiceEnabled = true

    private var cancellables = Set<AnyCancellable>()

    // MARK: - App Context
    
    /// Represents the current context/screen in the app for contextual AI assistance
    enum AppContext: Equatable {
        case dashboard
        case clients
        case calendar
        case notes
        case clientDetail(String)
    }

    struct ChatMessage: Identifiable, Codable {
        let id: String
        let role: String // "user" or "assistant"
        let content: String
        let timestamp: Date
        var hasAudio: Bool = false

        init(id: String = UUID().uuidString, role: String, content: String, timestamp: Date = Date(), hasAudio: Bool = false) {
            self.id = id
            self.role = role
            self.content = content
            self.timestamp = timestamp
            self.hasAudio = hasAudio
        }
    }

    struct VoiceOption: Identifiable, Codable {
        let id: String
        let name: String
        let description: String?
        let premium: Bool?
    }

    struct ChatResponse: Codable {
        let success: Bool
        let response: String?
        let responseText: String?
        let conversationId: String?
        let error: String?
    }

    struct VoiceAssistantResponse: Codable {
        let success: Bool
        let text: String?
        let audio: String? // Base64 encoded audio
        let hasAudio: Bool?
        let error: String?
    }

    struct VoicesResponse: Codable {
        let voices: [VoiceOption]
        let currentVoice: String?
    }

    private init() {
        loadVoices()
    }

    // MARK: - Chat

    /// Send a text message to the AI assistant
    /// - Parameters:
    ///   - message: The message to send
    ///   - clientId: Optional client context
    ///   - skipHistory: If true, don't add messages to conversationHistory (for callers managing their own history)
    func sendMessage(_ message: String, clientId: String? = nil, skipHistory: Bool = false) async throws -> String {
        guard !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AIError.emptyMessage
        }

        await MainActor.run {
            isProcessing = true
            lastError = nil
            if !skipHistory {
                conversationHistory.append(ChatMessage(role: "user", content: message))
            }
        }

        defer {
            Task { @MainActor in
                isProcessing = false
            }
        }

        struct ChatRequest: Encodable {
            let message: String
            let includeContext: Bool
            let clientId: String?

            enum CodingKeys: String, CodingKey {
                case message
                case includeContext = "include_context"
                case clientId = "client_id"
            }
        }

        let body = ChatRequest(
            message: message,
            includeContext: true,
            clientId: clientId
        )

        let response: ChatResponse = try await APIClient.shared.request(
            endpoint: "/api/ai/chat",
            method: .post,
            body: body
        )

        guard response.success, let responseText = response.responseText ?? response.response else {
            let errorMessage = response.error ?? "Failed to get response"
            await MainActor.run {
                lastError = errorMessage
            }
            throw AIError.apiError(errorMessage)
        }

        await MainActor.run {
            if !skipHistory {
                conversationHistory.append(ChatMessage(role: "assistant", content: responseText))
            }
        }

        return responseText
    }

    /// Send a voice query to the AI assistant (with optional audio response)
    /// Falls back to text chat endpoint if voice endpoint is unavailable
    /// - Parameters:
    ///   - query: The voice query text
    ///   - clientId: Optional client context
    ///   - skipHistory: If true, don't add messages to conversationHistory (for callers managing their own history)
    func sendVoiceQuery(_ query: String, clientId: String? = nil, skipHistory: Bool = false) async throws -> (text: String, audioData: Data?) {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AIError.emptyMessage
        }

        await MainActor.run {
            isProcessing = true
            lastError = nil
            if !skipHistory {
                conversationHistory.append(ChatMessage(role: "user", content: query))
            }
        }

        defer {
            Task { @MainActor in
                isProcessing = false
            }
        }

        // Try voice endpoint first
        do {
            struct VoiceRequest: Encodable {
                let query: String
                let voiceId: String?
                let context: [String: String]?
            }

            let body = VoiceRequest(
                query: query,
                voiceId: selectedVoiceId.isEmpty ? nil : selectedVoiceId,
                context: clientId != nil ? ["client_id": clientId!] : nil
            )

            let response: VoiceAssistantResponse = try await APIClient.shared.request(
                endpoint: "/api/voice/assistant",
                method: .post,
                body: body
            )

            if response.success, let text = response.text {
                var audioData: Data?
                if let base64Audio = response.audio {
                    audioData = Data(base64Encoded: base64Audio)
                }

                let hasAudio = audioData != nil

                await MainActor.run {
                    if !skipHistory {
                        conversationHistory.append(ChatMessage(
                            role: "assistant",
                            content: text,
                            hasAudio: hasAudio
                        ))
                    }
                }

                return (text, audioData)
            }

            // Voice endpoint returned error, fall through to text chat
            print("Voice endpoint returned error: \(response.error ?? "unknown"), falling back to text chat")
        } catch {
            // Voice endpoint failed, fall back to text chat
            print("Voice endpoint failed: \(error.localizedDescription), falling back to text chat")
        }

        // Fallback to text chat endpoint
        do {
            struct ChatRequest: Encodable {
                let message: String
                let includeContext: Bool
                let clientId: String?

                enum CodingKeys: String, CodingKey {
                    case message
                    case includeContext = "include_context"
                    case clientId = "client_id"
                }
            }

            let chatBody = ChatRequest(
                message: query,
                includeContext: true,
                clientId: clientId
            )

            let chatResponse: ChatResponse = try await APIClient.shared.request(
                endpoint: "/api/ai/chat",
                method: .post,
                body: chatBody
            )

            if chatResponse.success, let responseText = chatResponse.responseText ?? chatResponse.response {
                await MainActor.run {
                    if !skipHistory {
                        conversationHistory.append(ChatMessage(
                            role: "assistant",
                            content: responseText,
                            hasAudio: false
                        ))
                    }
                }
                return (responseText, nil)
            }

            let errorMessage = chatResponse.error ?? "Failed to get response from AI"
            await MainActor.run {
                lastError = errorMessage
            }
            throw AIError.apiError(errorMessage)
        } catch let chatError {
            // Both endpoints failed - try a direct Anthropic API call as last resort
            print("Text chat also failed: \(chatError.localizedDescription), trying direct AI call")

            let directResponse = try await sendDirectAIQuery(query, clientId: clientId, skipHistory: skipHistory)
            return (directResponse, nil)
        }
    }

    /// Direct AI query using Anthropic API as fallback
    private func sendDirectAIQuery(_ query: String, clientId: String?, skipHistory: Bool = false) async throws -> String {
        // Get API key from IntegrationsService
        let apiKey = await IntegrationsService.shared.getAPIKey(for: .anthropic)

        guard !apiKey.isEmpty else {
            let errorMessage = "No AI API key configured. Please add your API key in Settings > Integrations."
            await MainActor.run {
                lastError = errorMessage
                if !skipHistory {
                    conversationHistory.append(ChatMessage(
                        role: "assistant",
                        content: "I'm having trouble connecting to the AI service. Please check that your API key is configured in Settings > Integrations.",
                        hasAudio: false
                    ))
                }
            }
            throw AIError.apiError(errorMessage)
        }

        let url = URL(string: "https://api.anthropic.com/v1/messages")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let systemPrompt = """
        You are a helpful AI assistant for a mental health practice management app called TherapyFlow.
        You help therapists with their practice by answering questions about their clients, sessions, and clinical documentation.
        Be conversational, warm, and professional. Keep responses concise but helpful.
        If you don't have specific information about a client or session, acknowledge that and offer general guidance.
        """

        let body: [String: Any] = [
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "system": systemPrompt,
            "messages": [
                ["role": "user", "content": query]
            ]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = "AI service temporarily unavailable"
            await MainActor.run {
                lastError = errorMessage
            }
            throw AIError.apiError(errorMessage)
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
            throw AIError.apiError("Invalid response from AI")
        }

        await MainActor.run {
            if !skipHistory {
                conversationHistory.append(ChatMessage(
                    role: "assistant",
                    content: textContent,
                    hasAudio: false
                ))
            }
        }

        return textContent
    }

    // MARK: - Voices

    func loadVoices() {
        Task {
            do {
                let response: VoicesResponse = try await APIClient.shared.request(
                    endpoint: "/api/voice/recommended"
                )
                await MainActor.run {
                    self.availableVoices = response.voices
                    if let currentVoice = response.currentVoice, !currentVoice.isEmpty {
                        self.selectedVoiceId = currentVoice
                    } else if let first = response.voices.first {
                        self.selectedVoiceId = first.id
                    }
                }
            } catch {
                print("Failed to load voices: \(error)")
            }
        }
    }

    func setVoice(_ voiceId: String) async throws {
        struct SetVoiceRequest: Encodable {
            let voiceId: String
        }
        
        struct SetVoiceResponse: Decodable {
            let success: Bool
        }
        
        let _: SetVoiceResponse = try await APIClient.shared.request(
            endpoint: "/api/voice/set-voice",
            method: .post,
            body: SetVoiceRequest(voiceId: voiceId)
        )

        await MainActor.run {
            selectedVoiceId = voiceId
        }
    }

    // MARK: - Utilities

    func clearHistory() {
        conversationHistory.removeAll()
    }

    // MARK: - Contextual Suggestions

    struct ContextualSuggestion: Identifiable {
        let id: String
        let type: SuggestionType
        let title: String
        let description: String
        let actionLabel: String?
        let actionDestination: String?

        enum SuggestionType {
            case tip, action, insight, warning
        }
    }

    func getSuggestions(for context: AppContext) -> [ContextualSuggestion] {
        switch context {
        case .dashboard:
            return [
                ContextualSuggestion(
                    id: "dash-1",
                    type: .tip,
                    title: "Quick Session Prep",
                    description: "Tap on any upcoming session to generate AI-powered preparation notes.",
                    actionLabel: nil,
                    actionDestination: nil
                ),
                ContextualSuggestion(
                    id: "dash-2",
                    type: .action,
                    title: "Review AI Insights",
                    description: "You have new AI-generated insights about client progress patterns.",
                    actionLabel: "View Insights",
                    actionDestination: "ai-dashboard"
                )
            ]
        case .clients:
            return [
                ContextualSuggestion(
                    id: "cli-1",
                    type: .tip,
                    title: "Client Journey",
                    description: "Tap on a client to see their therapeutic journey timeline and progress.",
                    actionLabel: nil,
                    actionDestination: nil
                ),
                ContextualSuggestion(
                    id: "cli-2",
                    type: .insight,
                    title: "Pattern Analysis",
                    description: "AI continuously analyzes session notes to identify progress patterns.",
                    actionLabel: nil,
                    actionDestination: nil
                )
            ]
        case .calendar:
            return [
                ContextualSuggestion(
                    id: "cal-1",
                    type: .tip,
                    title: "Session Preparation",
                    description: "Use the prep button on any session for AI-powered preparation materials.",
                    actionLabel: nil,
                    actionDestination: nil
                )
            ]
        case .notes:
            return [
                ContextualSuggestion(
                    id: "note-1",
                    type: .tip,
                    title: "AI-Assisted Writing",
                    description: "Create notes with AI-powered SOAP note generation and suggestions.",
                    actionLabel: nil,
                    actionDestination: nil
                ),
                ContextualSuggestion(
                    id: "note-2",
                    type: .insight,
                    title: "Clinical Tags",
                    description: "Notes are automatically tagged with clinical themes and risk indicators.",
                    actionLabel: nil,
                    actionDestination: nil
                )
            ]
        case .clientDetail(let clientId):
            return [
                ContextualSuggestion(
                    id: "client-\(clientId)-1",
                    type: .action,
                    title: "Generate Insights",
                    description: "Ask AI about this client's progress, patterns, or treatment recommendations.",
                    actionLabel: "Ask AI",
                    actionDestination: nil
                )
            ]
        }
    }

    enum AIError: LocalizedError {
        case emptyMessage
        case apiError(String)
        case networkError

        var errorDescription: String? {
            switch self {
            case .emptyMessage:
                return "Message cannot be empty"
            case .apiError(let message):
                return message
            case .networkError:
                return "Network connection error"
            }
        }
    }
}
