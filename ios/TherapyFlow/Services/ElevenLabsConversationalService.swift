import Foundation
import AVFoundation
import Speech
import Combine

/// ElevenLabs Conversational AI Service
/// Provides bidirectional voice conversations with automatic speech detection and text-to-speech
@MainActor
class ElevenLabsConversationalService: NSObject, ObservableObject {
    static let shared = ElevenLabsConversationalService()

    // MARK: - Published State
    @Published var isListening = false
    @Published var isSpeaking = false
    @Published var isProcessing = false
    @Published var transcript = ""
    @Published var lastResponse = ""
    @Published var lastError: String?
    @Published var conversationHistory: [ConversationMessage] = []
    @Published var isAuthorized = false
    @Published var silenceProgress: Double = 0 // 0 to 1, for UI feedback
    @Published private(set) var isAPIKeyConfigured = false

    // MARK: - Configuration
    @Published var voiceId: String = "EXAVITQu4vr4xnSDxMaL" // Default: Sarah
    @Published var autoSendOnSilence = true
    @Published var silenceThreshold: TimeInterval = 1.5 // seconds of silence before auto-send
    @Published var voiceEnabled = true

    // MARK: - Private Properties
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var audioPlayer: AVAudioPlayer?

    // Silence detection
    private var lastSpeechTime: Date?
    private var silenceTimer: Timer?
    private var silenceCheckTimer: Timer?

    // Barge-in detection (user interrupting Cipher)
    private var isBargeInEnabled = true
    private var lastSpokenResponse: String?
    private var speechWasInterrupted = false

    // API Configuration
    private let elevenLabsBaseURL = "https://api.elevenlabs.io/v1"
    private var apiKey: String {
        // Check keychain for ElevenLabs key
        if let data = try? KeychainService.shared.retrieve(key: "com.therapyflow.elevenlabs.apikey"),
           let key = String(data: data, encoding: .utf8), !key.isEmpty {
            return key
        }
        return ""
    }

    // MARK: - Types
    struct ConversationMessage: Identifiable, Codable {
        let id: String
        let role: String // "user" or "assistant"
        let content: String
        let timestamp: Date
        var hasAudio: Bool

        init(id: String = UUID().uuidString, role: String, content: String, hasAudio: Bool = false) {
            self.id = id
            self.role = role
            self.content = content
            self.timestamp = Date()
            self.hasAudio = hasAudio
        }
    }

    struct ElevenLabsVoice: Identifiable, Codable {
        let voice_id: String
        let name: String
        let category: String?
        let description: String?

        var id: String { voice_id }
    }

    // MARK: - Cipher Wake Word Integration
    private var wakeWordObserver: NSObjectProtocol?
    private var conversationEndedObserver: NSObjectProtocol?
    private var conversationPausedObserver: NSObjectProtocol?
    private var readyForNextQueryObserver: NSObjectProtocol?

    // MARK: - Initialization
    override private init() {
        super.init()
        speechRecognizer?.delegate = self
        checkAuthorization()
        setupWakeWordIntegration()
        isAPIKeyConfigured = !apiKey.isEmpty
    }

    private func setupWakeWordIntegration() {
        // Listen for Cipher wake word detection
        wakeWordObserver = NotificationCenter.default.addObserver(
            forName: .cipherWakeWordDetected,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self else { return }

            // Get the activation response
            let response = notification.userInfo?["response"] as? String ?? "How can I help?"

            Task { @MainActor in
                // Add Cipher's greeting to conversation history (using safe method to prevent duplicates)
                self.addMessageToHistory(role: "assistant", content: response, hasAudio: self.voiceEnabled)

                self.lastResponse = response

                // Speak the response if voice is enabled
                if self.voiceEnabled && self.hasAPIKey() {
                    try? await self.synthesizeAndPlaySpeech(response)
                }

                // Start listening for user's query after speaking
                // Small delay to let TTS finish
                try? await Task.sleep(nanoseconds: 500_000_000)
                self.startListening()
            }
        }

        // Listen for conversation ended ("Cipher, that's all")
        conversationEndedObserver = NotificationCenter.default.addObserver(
            forName: .cipherConversationEnded,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self else { return }

            let response = notification.userInfo?["response"] as? String ?? "Alright, just say my name when you need me."

            Task { @MainActor in
                // Add farewell to conversation history (using safe method to prevent duplicates)
                self.addMessageToHistory(role: "assistant", content: response, hasAudio: self.voiceEnabled)

                self.lastResponse = response

                // Speak the farewell
                if self.voiceEnabled && self.hasAPIKey() {
                    try? await self.synthesizeAndPlaySpeech(response)
                }

                // Stop listening - wake word detector will resume
                self.stopListening()
            }
        }

        // Listen for conversation paused ("Cipher, wait" / "Let me think")
        conversationPausedObserver = NotificationCenter.default.addObserver(
            forName: .cipherConversationPaused,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self else { return }

            let response = notification.userInfo?["response"] as? String ?? "Take your time."

            Task { @MainActor in
                // Add pause acknowledgment to conversation history (using safe method to prevent duplicates)
                self.addMessageToHistory(role: "assistant", content: response, hasAudio: self.voiceEnabled)

                self.lastResponse = response

                // Speak the acknowledgment
                if self.voiceEnabled && self.hasAPIKey() {
                    try? await self.synthesizeAndPlaySpeech(response)
                }

                // Stop listening - wake word detector will resume
                self.stopListening()
            }
        }

        // Listen for ready for next query (after AI responds in active conversation)
        readyForNextQueryObserver = NotificationCenter.default.addObserver(
            forName: .cipherReadyForNextQuery,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }

            Task { @MainActor in
                // Continue listening for next query
                self.startListening()
            }
        }
    }

    deinit {
        if let observer = wakeWordObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = conversationEndedObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = conversationPausedObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = readyForNextQueryObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Authorization
    func checkAuthorization() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                self?.isAuthorized = (status == .authorized)
            }
        }

        AVAudioApplication.requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                if !granted {
                    self?.isAuthorized = false
                }
            }
        }
    }

    // MARK: - Save ElevenLabs API Key
    func saveAPIKey(_ key: String) throws {
        let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedKey.isEmpty, let data = trimmedKey.data(using: .utf8) else {
            throw NSError(domain: "ElevenLabs", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid API key format"])
        }
        try KeychainService.shared.save(key: "com.therapyflow.elevenlabs.apikey", data: data)
        guard let saved = try KeychainService.shared.retrieve(key: "com.therapyflow.elevenlabs.apikey"),
              String(data: saved, encoding: .utf8) == trimmedKey else {
            throw NSError(domain: "ElevenLabs", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to verify saved API key"])
        }
        isAPIKeyConfigured = true
    }

    func hasAPIKey() -> Bool {
        return isAPIKeyConfigured || !apiKey.isEmpty
    }

    func removeAPIKey() throws {
        try KeychainService.shared.delete(key: "com.therapyflow.elevenlabs.apikey")
        isAPIKeyConfigured = false
    }

    // MARK: - Start Listening
    func startListening() {
        guard !isListening else { return }
        guard isAuthorized else {
            lastError = "Speech recognition not authorized. Please enable in Settings."
            return
        }

        lastError = nil
        transcript = ""

        // Cancel any existing task
        recognitionTask?.cancel()
        recognitionTask = nil

        // Configure audio session
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            lastError = "Failed to configure audio: \(error.localizedDescription)"
            return
        }

        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else {
            lastError = "Failed to create speech recognition request"
            return
        }

        recognitionRequest.shouldReportPartialResults = true
        recognitionRequest.addsPunctuation = true

        // Configure audio input
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        guard recordingFormat.sampleRate > 0 && recordingFormat.channelCount > 0 else {
            lastError = "Invalid audio format. Please check microphone permissions."
            return
        }

        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()

        do {
            try audioEngine.start()
        } catch {
            lastError = "Audio engine error: \(error.localizedDescription)"
            return
        }

        isListening = true
        lastSpeechTime = Date()
        startSilenceDetection()

        // Start recognition
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self else { return }

            if let result = result {
                let newTranscript = result.bestTranscription.formattedString

                // Only update if content changed (to detect silence vs speaking)
                if newTranscript != self.transcript {
                    DispatchQueue.main.async {
                        // Barge-in: If Cipher is speaking and user starts talking, stop Cipher
                        if self.isSpeaking && self.isBargeInEnabled && newTranscript.count > 3 {
                            self.handleBargeIn()
                        }

                        self.transcript = newTranscript
                        self.lastSpeechTime = Date()
                        self.silenceProgress = 0
                    }
                }

                if result.isFinal {
                    DispatchQueue.main.async {
                        self.handleSpeechEnd()
                    }
                }
            }

            if let error = error as? NSError {
                // Ignore common "speech ended" errors
                if error.domain != "kAFAssistantErrorDomain" {
                    DispatchQueue.main.async {
                        self.lastError = error.localizedDescription
                    }
                }
            }
        }
    }

    // MARK: - Barge-In Handling
    /// Handle user interrupting Cipher's speech
    private func handleBargeIn() {
        print("ElevenLabs: Barge-in detected - user interrupted Cipher")
        speechWasInterrupted = true

        // Stop Cipher from speaking immediately
        stopSpeaking()

        // Don't clear lastSpokenResponse - we want to know what was interrupted
        // to avoid repeating it
    }

    /// Start listening specifically for barge-in detection (while speaking)
    private func startListeningForBargeIn() {
        guard !isListening else { return }
        guard isAuthorized else { return }

        // Configure audio session to allow simultaneous playback and recording
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("ElevenLabs: Failed to configure audio for barge-in: \(error.localizedDescription)")
            return
        }

        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else { return }

        recognitionRequest.shouldReportPartialResults = true
        recognitionRequest.addsPunctuation = false  // Faster for barge-in

        // Configure audio input
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        guard recordingFormat.sampleRate > 0 && recordingFormat.channelCount > 0 else { return }

        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()

        do {
            try audioEngine.start()
        } catch {
            print("ElevenLabs: Audio engine error for barge-in: \(error.localizedDescription)")
            return
        }

        isListening = true
        transcript = ""  // Clear transcript for barge-in mode
        // Don't start silence detection during barge-in listening

        // Start recognition (minimal processing, just detect speech)
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, _ in
            guard let self else { return }

            if let result = result {
                let newTranscript = result.bestTranscription.formattedString

                if newTranscript.count > 3 && !newTranscript.isEmpty {
                    DispatchQueue.main.async {
                        // User is talking - trigger barge-in
                        if self.isSpeaking {
                            self.transcript = newTranscript
                            self.lastSpeechTime = Date()
                            self.handleBargeIn()
                        }
                    }
                }
            }
        }
    }

    // MARK: - Stop Listening
    func stopListening() {
        stopSilenceDetection()

        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.finish()

        recognitionRequest = nil
        recognitionTask = nil

        isListening = false
        silenceProgress = 0

        // Reset audio session
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: - Silence Detection
    private func startSilenceDetection() {
        guard autoSendOnSilence else { return }

        // Check every 100ms for silence
        silenceCheckTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self else { return }

            Task { @MainActor in
                guard self.isListening, !self.transcript.isEmpty else {
                    self.silenceProgress = 0
                    return
                }

                guard let lastSpeech = self.lastSpeechTime else { return }

                let silenceDuration = Date().timeIntervalSince(lastSpeech)
                self.silenceProgress = min(silenceDuration / self.silenceThreshold, 1.0)

                if silenceDuration >= self.silenceThreshold {
                    self.handleSilenceDetected()
                }
            }
        }
    }

    private func stopSilenceDetection() {
        silenceCheckTimer?.invalidate()
        silenceCheckTimer = nil
        silenceTimer?.invalidate()
        silenceTimer = nil
    }

    private func handleSilenceDetected() {
        guard isListening, !transcript.isEmpty else { return }

        stopListening()
        sendMessage()
    }

    private func handleSpeechEnd() {
        if autoSendOnSilence && !transcript.isEmpty {
            stopListening()
            sendMessage()
        }
    }

    // MARK: - Add System Message
    /// Add a message to conversation history (e.g., Cipher's greeting)
    func addSystemMessage(_ message: String) {
        // Using safe method to prevent duplicates
        addMessageToHistory(role: "assistant", content: message, hasAudio: false)
    }

    // MARK: - Send Message
    func sendMessage(clientId: String? = nil) {
        let message = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }

        // Reset the conversation inactivity timer since user is interacting
        WakeWordDetector.shared.notifyConversationActivity()

        // Check if this is an end or pause phrase before processing
        WakeWordDetector.shared.processActiveConversationTranscript(message)

        // If conversation was ended or paused, don't process as a query
        if WakeWordDetector.shared.conversationMode != .activeConversation {
            transcript = ""
            return
        }

        // Add to history (using safe method to prevent duplicates)
        addMessageToHistory(role: "user", content: message)
        transcript = ""

        isProcessing = true

        Task {
            do {
                let response = try await processWithAI(message: message, clientId: clientId)
                await MainActor.run {
                    self.lastResponse = response
                    // Add AI response to history (using safe method to prevent duplicates)
                    self.addMessageToHistory(role: "assistant", content: response, hasAudio: self.voiceEnabled)
                    self.isProcessing = false
                }

                // Generate and play speech
                // Note: After speech finishes, audioPlayerDidFinishPlaying handles
                // resuming listening - we don't need to call continueConversation here
                // to avoid duplicate listening restarts
                if voiceEnabled && hasAPIKey() {
                    try await synthesizeAndPlaySpeech(response)
                    // audioPlayerDidFinishPlaying will handle resuming listening
                } else {
                    // No voice - manually continue conversation
                    if WakeWordDetector.shared.conversationMode == .activeConversation {
                        try? await Task.sleep(nanoseconds: 300_000_000)
                        WakeWordDetector.shared.continueConversation()
                    }
                }
            } catch {
                await MainActor.run {
                    self.lastError = error.localizedDescription
                    self.isProcessing = false
                }
                // On error, still try to continue conversation
                WakeWordDetector.shared.deactivate()
            }
        }
    }

    // MARK: - AI Processing with Intelligent Dual LLM Routing
    private func processWithAI(message: String, clientId: String?) async throws -> String {
        // Use DualLLMRouter for intelligent task classification
        let router = DualLLMRouter.shared
        let taskCategory = router.classifyTask(message)

        print("Cipher: Classified task as '\(taskCategory.description)' -> \(taskCategory.preferredProvider.displayName)")

        let context: String
        if let clientId = clientId {
            context = await FullContextProvider.shared.getClientContext(clientId: clientId)
        } else {
            context = await FullContextProvider.shared.getFullContextString()
        }

        let systemPrompt = """
        You are Cipher, an AI assistant for TherapyFlow mental health practice management.
        You help therapists with clinical documentation, scheduling, client insights, and practice management.
        Be conversational, warm, and professional. Provide concise but helpful responses.
        You have full access to the practice data provided in the context.
        """

        // Route to appropriate LLM
        let response = try await router.routeAndExecute(
            prompt: message,
            context: context,
            systemPrompt: systemPrompt
        )

        print("Cipher: Response from \(response.provider.displayName) (\(response.tokensUsed ?? 0) tokens)")

        return response.text
    }

    /// Get lightweight context for quick queries (OpenAI)
    private func getQuickContext(clientId: String?) async -> String {
        // Just get basic summary info, not full context
        let stats = await FullContextProvider.shared.getQuickStats()

        var context = """
        [Practice Summary]
        - Active clients: \(stats.activeClients)
        - Sessions today: \(stats.sessionsToday)
        - Sessions this week: \(stats.sessionsThisWeek)
        - Pending notes: \(stats.pendingNotes)
        """

        if let clientId = clientId,
           let client = await FullContextProvider.shared.getClientBasicInfo(clientId: clientId) {
            context += """

            [Current Client: \(client.name)]
            - Status: \(client.status)
            - Next session: \(client.nextSession ?? "Not scheduled")
            """
        }

        // Add today's schedule
        let todaySessions = await FullContextProvider.shared.getTodaySchedule()
        if !todaySessions.isEmpty {
            context += "\n\n[Today's Schedule]\n"
            for session in todaySessions {
                context += "- \(session.time): \(session.clientName)\n"
            }
        }

        return context
    }

    // MARK: - ElevenLabs Text-to-Speech
    private func synthesizeAndPlaySpeech(_ text: String) async throws {
        guard !apiKey.isEmpty else {
            print("ElevenLabs API key not configured")
            return
        }

        // Check if this is a repeat of the last response (avoid repetition)
        if text == lastSpokenResponse {
            print("ElevenLabs: Skipping duplicate response")
            return
        }

        // Reset interrupted flag before speaking
        speechWasInterrupted = false

        await MainActor.run {
            self.isSpeaking = true
            self.lastSpokenResponse = text
        }

        defer {
            Task { @MainActor in
                self.isSpeaking = false
            }
        }

        // Start listening while speaking to detect barge-in
        // This allows us to detect when user starts talking
        if isBargeInEnabled && !isListening {
            await MainActor.run {
                self.startListeningForBargeIn()
            }
        }

        let url = URL(string: "\(elevenLabsBaseURL)/text-to-speech/\(voiceId)")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("audio/mpeg", forHTTPHeaderField: "Accept")

        let body: [String: Any] = [
            "text": text,
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": [
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": true
            ]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, urlResponse) = try await URLSession.shared.data(for: request)

        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            throw NSError(domain: "ElevenLabs", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw NSError(domain: "ElevenLabs", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "ElevenLabs error: \(errorMessage)"])
        }

        // Play the audio
        await playAudio(data: data)
    }

    private func playAudio(data: Data) async {
        await MainActor.run {
            do {
                // Configure audio session for playback
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
                try AVAudioSession.sharedInstance().setActive(true)

                self.audioPlayer = try AVAudioPlayer(data: data)
                self.audioPlayer?.delegate = self
                self.audioPlayer?.play()
            } catch {
                self.lastError = "Audio playback error: \(error.localizedDescription)"
                self.isSpeaking = false
            }
        }
    }

    func stopSpeaking() {
        audioPlayer?.stop()
        audioPlayer = nil
        isSpeaking = false
    }

    // MARK: - Voice Management
    func fetchAvailableVoices() async throws -> [ElevenLabsVoice] {
        guard !apiKey.isEmpty else {
            throw NSError(domain: "ElevenLabs", code: -1, userInfo: [NSLocalizedDescriptionKey: "API key not configured"])
        }

        let url = URL(string: "\(elevenLabsBaseURL)/voices")!

        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")

        let (data, urlResponse) = try await URLSession.shared.data(for: request)

        guard let httpResponse = urlResponse as? HTTPURLResponse else {
            throw NSError(domain: "ElevenLabs", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw NSError(domain: "ElevenLabs", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "ElevenLabs error: \(errorMessage)"])
        }

        struct VoicesResponse: Decodable {
            let voices: [ElevenLabsVoice]
        }

        let decodedResponse = try JSONDecoder().decode(VoicesResponse.self, from: data)
        return decodedResponse.voices
    }

    // MARK: - Conversation Management
    func clearHistory() {
        conversationHistory.removeAll()
        transcript = ""
        lastResponse = ""
    }

    /// Check if this message would be a duplicate of the last message in history
    private func isDuplicateMessage(role: String, content: String) -> Bool {
        guard let lastMessage = conversationHistory.last else { return false }
        return lastMessage.role == role && lastMessage.content == content
    }

    /// Safely add a message to conversation history (prevents duplicates)
    private func addMessageToHistory(role: String, content: String, hasAudio: Bool = false) {
        // Don't add duplicates
        if isDuplicateMessage(role: role, content: content) {
            print("ElevenLabs: Skipping duplicate message in history")
            return
        }
        conversationHistory.append(ConversationMessage(role: role, content: content, hasAudio: hasAudio))
    }

    /// Toggle listening state - for voice button
    func toggleListening() {
        if isListening {
            stopListening()
            // If we have transcript, send it
            if !transcript.isEmpty {
                sendMessage()
            }
        } else {
            startListening()
        }
    }
}

// MARK: - SFSpeechRecognizerDelegate
extension ElevenLabsConversationalService: SFSpeechRecognizerDelegate {
    nonisolated func speechRecognizer(_ speechRecognizer: SFSpeechRecognizer, availabilityDidChange available: Bool) {
        Task { @MainActor in
            if !available {
                lastError = "Speech recognition is not available"
            }
        }
    }
}

// MARK: - AVAudioPlayerDelegate
extension ElevenLabsConversationalService: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            isSpeaking = false

            // If speech finished naturally (not interrupted), start normal listening
            if !speechWasInterrupted && flag {
                // Transition from barge-in listening to full listening mode
                // Restart listening with silence detection
                if WakeWordDetector.shared.conversationMode == .activeConversation {
                    // Short delay then start listening for user response
                    try? await Task.sleep(nanoseconds: 200_000_000)
                    self.stopListening()  // Stop barge-in listening
                    self.startListening()  // Start full listening with silence detection
                }
            } else if speechWasInterrupted {
                // Was interrupted - transition to full listening immediately
                // The transcript should already have the user's interruption
                self.startSilenceDetection()
            }
        }
    }
}
