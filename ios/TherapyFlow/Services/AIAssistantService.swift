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
    func sendMessage(_ message: String, clientId: String? = nil) async throws -> String {
        guard !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AIError.emptyMessage
        }

        await MainActor.run {
            isProcessing = true
            lastError = nil
            conversationHistory.append(ChatMessage(role: "user", content: message))
        }

        defer {
            Task { @MainActor in
                isProcessing = false
            }
        }

        var body: [String: Any] = [
            "message": message,
            "includeContext": true
        ]

        if let clientId = clientId {
            body["clientId"] = clientId
        }

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
            conversationHistory.append(ChatMessage(role: "assistant", content: responseText))
        }

        return responseText
    }

    /// Send a voice query to the AI assistant (with optional audio response)
    func sendVoiceQuery(_ query: String, clientId: String? = nil) async throws -> (text: String, audioData: Data?) {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AIError.emptyMessage
        }

        await MainActor.run {
            isProcessing = true
            lastError = nil
            conversationHistory.append(ChatMessage(role: "user", content: query))
        }

        defer {
            Task { @MainActor in
                isProcessing = false
            }
        }

        var body: [String: Any] = [
            "query": query
        ]

        if !selectedVoiceId.isEmpty {
            body["voiceId"] = selectedVoiceId
        }

        if let clientId = clientId {
            body["context"] = ["clientId": clientId]
        }

        let response: VoiceAssistantResponse = try await APIClient.shared.request(
            endpoint: "/api/voice/assistant",
            method: .post,
            body: body
        )

        guard response.success ?? true, let text = response.text else {
            let errorMessage = response.error ?? "Failed to get response"
            await MainActor.run {
                lastError = errorMessage
            }
            throw AIError.apiError(errorMessage)
        }

        var audioData: Data?
        if let base64Audio = response.audio {
            audioData = Data(base64Encoded: base64Audio)
        }

        await MainActor.run {
            conversationHistory.append(ChatMessage(
                role: "assistant",
                content: text,
                hasAudio: audioData != nil
            ))
        }

        return (text, audioData)
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
        let _: [String: Any] = try await APIClient.shared.request(
            endpoint: "/api/voice/set-voice",
            method: .post,
            body: ["voiceId": voiceId]
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

    enum AppContext {
        case dashboard
        case clients
        case calendar
        case notes
        case clientDetail(String)
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
