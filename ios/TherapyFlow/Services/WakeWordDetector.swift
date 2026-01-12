import Foundation
import Speech
import AVFoundation
import Combine

/// WakeWordDetector - Listens for "Cipher" or "Hey Cipher" wake word
///
/// When the wake word is detected, it triggers the AI assistant to respond
/// and begin listening for the user's query.
///
/// Conversation Flow:
/// - User says "Cipher" → Cipher responds and stays engaged
/// - Cipher continues listening and responding until:
///   - User says "Cipher, that's all" → Ends conversation, resumes wake word listening
///   - User says "Cipher, wait" or "Let me think" → Pauses, resumes wake word listening
/// - User can restart anytime with "Hey Cipher"
@MainActor
class WakeWordDetector: NSObject, ObservableObject {
    static let shared = WakeWordDetector()

    // MARK: - Published State
    @Published var isListening = false
    @Published var isActivated = false  // True when in active conversation
    @Published var wakeWordEnabled = true
    @Published var lastDetectedPhrase = ""
    @Published var isAuthorized = false
    @Published var conversationMode: ConversationMode = .waitingForWakeWord

    // MARK: - Conversation Mode
    enum ConversationMode {
        case waitingForWakeWord     // Listening only for wake word
        case activeConversation     // Engaged in back-and-forth conversation
        case paused                 // User asked to pause, waiting for wake word again
    }

    // MARK: - Wake Word Configuration
    let wakeWords = ["cipher", "hey cipher", "hi cipher", "okay cipher", "ok cipher", "yo cipher", "hey cypher", "hi cypher"]
    let assistantName = "Cipher"

    // Extended phonetic variations that speech recognition might produce
    let phoneticVariations = [
        "cypher", "syphur", "sipher", "sypher", "psypher",
        "sigh fur", "psi fur", "cyber", "cifer", "sifer",
        "sai fur", "sy fur", "ci fur", "psych fur",
        "cyfer", "syfer", "cyphur", "siphur",
        "hey syphur", "hey cyfer", "hey sifer",
        "hey psi fur", "hey cyber", "hey sigh fur"
    ]

    // End conversation phrases
    let endConversationPhrases = [
        "cipher that's all",
        "cipher, that's all",
        "cipher thats all",
        "cipher, thats all",
        "cipher that is all",
        "cipher that's it",
        "cipher, that's it",
        "cipher thats it",
        "cipher, thats it",
        "that's all cipher",
        "that's all, cipher",
        "cipher we're done",
        "cipher, we're done",
        "cipher thank you that's all",
        "thanks cipher that's all",
        "cipher stop",
        "cipher, stop",
        "stop cipher",
        "cipher end conversation",
        "end conversation cipher",
        "cipher goodbye",
        "goodbye cipher"
    ]

    // Pause conversation phrases
    let pausePhrases = [
        "cipher wait",
        "cipher, wait",
        "wait cipher",
        "let me think",
        "give me a moment",
        "hold on",
        "one moment",
        "cipher hold on",
        "cipher, hold on",
        "cipher pause",
        "cipher, pause"
    ]

    // MARK: - Callbacks
    var onWakeWordDetected: (() -> Void)?
    var onActivationResponse: ((String) -> Void)?
    var onConversationEnded: (() -> Void)?
    var onConversationPaused: (() -> Void)?

    // MARK: - Private Properties
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    // Debounce and reliability
    private var lastWakeWordTime: Date?
    private let wakeWordDebounce: TimeInterval = 2.0  // Ignore repeat detections within 2 seconds
    private var consecutiveErrors = 0
    private let maxConsecutiveErrors = 8  // More tolerance before giving up
    private let baseErrorRecoveryDelay: UInt64 = 150_000_000  // 150ms base delay (faster recovery)

    // Conversation inactivity timeout
    private var conversationInactivityTimer: Task<Void, Never>?
    private let conversationTimeoutDuration: TimeInterval = 30.0  // Auto-deactivate after 30 seconds of inactivity

    // Activation responses
    private let activationResponses = [
        "How can I help you?",
        "Yes, I'm here. What do you need?",
        "Hi! What can I assist you with?",
        "I'm listening. How can I help?",
        "Yes? What would you like to know?",
        "Cipher here. What can I do for you?",
        "I'm ready to help. What do you need?",
        "At your service. What can I help with?"
    ]

    // End conversation responses
    private let endConversationResponses = [
        "Alright, just say my name when you need me again.",
        "Sounds good. I'll be here when you need me.",
        "Got it. Say 'Cipher' whenever you're ready.",
        "No problem. I'm here whenever you need assistance.",
        "Okay, talk to you later!"
    ]

    // Pause responses
    private let pauseResponses = [
        "Take your time. Just say 'Cipher' when you're ready.",
        "No rush. I'll be here.",
        "Of course. Let me know when you're ready to continue.",
        "Sure thing. I'll wait for you."
    ]

    // Continue conversation responses (after AI responds)
    private let continuePrompts = [
        "Is there anything else?",
        "What else can I help with?",
        "Anything else you need?",
        ""  // Sometimes no prompt, just wait
    ]

    // MARK: - Initialization
    override private init() {
        super.init()
        speechRecognizer?.delegate = self
        checkAuthorization()
    }

    // MARK: - Authorization

    func checkAuthorization() {
        Task {
            await requestAuthorizationAsync()
        }
    }

    /// Async authorization that properly chains speech and microphone permissions
    func requestAuthorizationAsync() async {
        // First request speech recognition permission
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }

        guard speechStatus == .authorized else {
            await MainActor.run {
                self.isAuthorized = false
                print("WakeWordDetector: Speech recognition not authorized (status: \(speechStatus.rawValue))")
            }
            return
        }

        // Then request microphone permission
        let micGranted = await AVAudioApplication.requestRecordPermission()

        await MainActor.run {
            self.isAuthorized = micGranted
            if micGranted {
                print("WakeWordDetector: Fully authorized for speech and microphone")
                // Auto-start listening if enabled and authorized
                if self.wakeWordEnabled && !self.isListening && !self.isActivated {
                    self.startListening()
                }
            } else {
                print("WakeWordDetector: Microphone permission denied")
            }
        }
    }

    /// Check if already authorized (non-blocking)
    func checkExistingAuthorization() -> Bool {
        let speechStatus = SFSpeechRecognizer.authorizationStatus()
        let micStatus = AVAudioApplication.shared.recordPermission
        return speechStatus == .authorized && micStatus == .granted
    }

    // MARK: - Start Wake Word Listening

    /// Start continuous listening for the wake word
    func startListening() {
        guard wakeWordEnabled else { return }
        guard !isListening else { return }
        guard isAuthorized else {
            print("WakeWordDetector: Speech recognition not authorized")
            return
        }

        // Cancel any existing task
        recognitionTask?.cancel()
        recognitionTask = nil

        // Configure audio session for background listening
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("WakeWordDetector: Failed to configure audio session: \(error)")
            return
        }

        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else {
            print("WakeWordDetector: Failed to create recognition request")
            return
        }

        recognitionRequest.shouldReportPartialResults = true
        recognitionRequest.addsPunctuation = false

        // Configure audio input
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        guard recordingFormat.sampleRate > 0 && recordingFormat.channelCount > 0 else {
            print("WakeWordDetector: Invalid audio format")
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
            print("WakeWordDetector: Audio engine error: \(error)")
            return
        }

        isListening = true
        print("WakeWordDetector: Started listening for wake word '\(assistantName)'")

        // Start recognition
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self else { return }

            if let result = result {
                let transcript = result.bestTranscription.formattedString.lowercased()

                Task { @MainActor in
                    self.lastDetectedPhrase = transcript
                    self.consecutiveErrors = 0  // Reset error count on successful recognition

                    // Check if wake word is in the transcript (with debounce)
                    if self.containsWakeWord(transcript) && !self.isActivated {
                        // Debounce: ignore if we just detected wake word
                        if let lastTime = self.lastWakeWordTime,
                           Date().timeIntervalSince(lastTime) < self.wakeWordDebounce {
                            print("WakeWordDetector: Ignoring duplicate wake word (debounce)")
                            return
                        }
                        self.lastWakeWordTime = Date()
                        self.handleWakeWordDetected()
                    }
                }
            }

            if let error = error {
                Task { @MainActor in
                    self.consecutiveErrors += 1
                    let nsError = error as NSError

                    // Only log non-timeout errors (1110 is normal speech timeout)
                    if nsError.domain != "kAFAssistantErrorDomain" || nsError.code != 1110 {
                        print("WakeWordDetector: Recognition error (\(self.consecutiveErrors)): \(error.localizedDescription)")
                    }

                    // Restart listening after a brief pause (if not too many errors)
                    // Use faster recovery with exponential backoff capped at 500ms
                    if self.wakeWordEnabled && !self.isActivated && self.consecutiveErrors < self.maxConsecutiveErrors {
                        let delay = min(self.baseErrorRecoveryDelay * UInt64(self.consecutiveErrors), 500_000_000)
                        try? await Task.sleep(nanoseconds: delay)
                        self.restartListening()
                    } else if self.consecutiveErrors >= self.maxConsecutiveErrors {
                        print("WakeWordDetector: Too many consecutive errors, pausing for 3 seconds")
                        try? await Task.sleep(nanoseconds: 3_000_000_000)  // Reduced from 10s to 3s
                        self.consecutiveErrors = 0
                        if self.wakeWordEnabled && !self.isActivated {
                            self.restartListening()
                        }
                    }
                }
            }
        }
    }

    /// Stop wake word listening
    func stopListening() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.finish()

        recognitionRequest = nil
        recognitionTask = nil

        isListening = false
        print("WakeWordDetector: Stopped listening")

        // Reset audio session
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Restart listening (used after timeouts or errors)
    private func restartListening() {
        stopListening()

        // Brief delay before restarting
        Task {
            try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 seconds
            if wakeWordEnabled && !isActivated {
                startListening()
            }
        }
    }

    // MARK: - Wake Word Detection

    private func normalizeTranscript(_ transcript: String) -> String {
        let stripped = transcript
            .lowercased()
            .replacingOccurrences(of: "'", with: "")
            .replacingOccurrences(of: "[^a-z0-9]+", with: " ", options: .regularExpression)
        return stripped.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }

    private func containsWakeWord(_ transcript: String) -> Bool {
        let normalized = normalizeTranscript(transcript)

        // Check primary wake words
        for wakeWord in wakeWords {
            if normalized.contains(normalizeTranscript(wakeWord)) {
                return true
            }
        }

        // Check extended phonetic variations
        for variation in phoneticVariations {
            let normalizedVariation = normalizeTranscript(variation)
            if normalized.contains(normalizedVariation) {
                return true
            }
        }

        // Check for partial matches at word boundaries (more aggressive matching)
        let words = normalized.split(separator: " ").map { String($0) }
        for word in words {
            // Match words that sound like "cipher" - starts with 's', 'c', or 'ps' and ends with 'er', 'ur', or 'r'
            if (word.hasPrefix("s") || word.hasPrefix("c") || word.hasPrefix("ps")) &&
               (word.hasSuffix("er") || word.hasSuffix("ur") || word.hasSuffix("r") || word.hasSuffix("fur")) &&
               word.count >= 4 && word.count <= 8 {
                // Additional check: contains 'i', 'y', or 'ai' sound
                if word.contains("i") || word.contains("y") || word.contains("ai") {
                    return true
                }
            }
        }

        return false
    }

    private func containsEndConversationPhrase(_ transcript: String) -> Bool {
        let normalized = normalizeTranscript(transcript)
        return endConversationPhrases.contains { normalized.contains(normalizeTranscript($0)) }
    }

    private func containsPausePhrase(_ transcript: String) -> Bool {
        let normalized = normalizeTranscript(transcript)
        return pausePhrases.contains { normalized.contains(normalizeTranscript($0)) }
    }

    /// Process transcript during active conversation
    func processActiveConversationTranscript(_ transcript: String) {
        let lowercased = transcript.lowercased()

        // Check for end conversation phrase
        if containsEndConversationPhrase(lowercased) {
            handleConversationEnded()
            return
        }

        // Check for pause phrase
        if containsPausePhrase(lowercased) {
            handleConversationPaused()
            return
        }

        // Otherwise, it's a regular query - let the conversation service handle it
    }

    private func handleWakeWordDetected() {
        print("WakeWordDetector: Wake word detected!")

        isActivated = true
        conversationMode = .activeConversation

        // Stop wake word listening (will switch to full query listening)
        stopListening()

        // Start the conversation inactivity timer
        // If no activity happens within the timeout, we'll resume wake word listening
        resetConversationInactivityTimer()

        // Generate activation response
        let response = activationResponses.randomElement() ?? "How can I help?"

        // Notify callbacks
        onWakeWordDetected?()
        onActivationResponse?(response)

        // Post notification for other parts of the app
        NotificationCenter.default.post(
            name: .cipherWakeWordDetected,
            object: nil,
            userInfo: ["response": response]
        )
    }

    private func handleConversationEnded() {
        print("WakeWordDetector: Conversation ended by user")

        let response = endConversationResponses.randomElement() ?? "Alright, just say my name when you need me."

        // Post notification
        NotificationCenter.default.post(
            name: .cipherConversationEnded,
            object: nil,
            userInfo: ["response": response]
        )

        onConversationEnded?()

        // Deactivate and return to wake word listening
        deactivateAndResume()
    }

    private func handleConversationPaused() {
        print("WakeWordDetector: Conversation paused by user")

        conversationMode = .paused

        let response = pauseResponses.randomElement() ?? "Take your time. Just say 'Cipher' when you're ready."

        // Post notification
        NotificationCenter.default.post(
            name: .cipherConversationPaused,
            object: nil,
            userInfo: ["response": response]
        )

        onConversationPaused?()

        // Deactivate and return to wake word listening
        deactivateAndResume()
    }

    // MARK: - Conversation Inactivity Timer

    /// Start or reset the conversation inactivity timer
    private func resetConversationInactivityTimer() {
        // Cancel existing timer
        conversationInactivityTimer?.cancel()

        // Start new timer
        conversationInactivityTimer = Task { @MainActor in
            do {
                try await Task.sleep(nanoseconds: UInt64(conversationTimeoutDuration * 1_000_000_000))

                // Timer fired - check if still in active conversation
                if self.conversationMode == .activeConversation || self.isActivated {
                    print("WakeWordDetector: Conversation timeout - resuming wake word listening")
                    self.deactivateAndResume()
                }
            } catch {
                // Task was cancelled, which is expected
            }
        }
    }

    /// Cancel the conversation inactivity timer
    private func cancelConversationInactivityTimer() {
        conversationInactivityTimer?.cancel()
        conversationInactivityTimer = nil
    }

    /// Notify that there was activity in the conversation (resets timeout)
    func notifyConversationActivity() {
        if conversationMode == .activeConversation {
            resetConversationInactivityTimer()
        }
    }

    // MARK: - Deactivation

    /// Call this when the AI has finished responding - stays in active conversation mode
    func continueConversation() {
        // Stay activated, continue listening for next query
        // The ElevenLabsConversationalService will call this after responding

        guard conversationMode == .activeConversation else { return }

        // Reset the inactivity timer since there was activity
        resetConversationInactivityTimer()

        // Post notification that we're ready for more
        NotificationCenter.default.post(
            name: .cipherReadyForNextQuery,
            object: nil
        )
    }

    /// Deactivate and resume wake word listening
    func deactivateAndResume() {
        // Cancel the inactivity timer
        cancelConversationInactivityTimer()

        isActivated = false
        conversationMode = .waitingForWakeWord

        // Resume wake word listening if enabled
        if wakeWordEnabled {
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds delay
                startListening()
            }
        }
    }

    /// Legacy method - now calls deactivateAndResume
    func deactivate() {
        deactivateAndResume()
    }

    // MARK: - Configuration

    func setWakeWordEnabled(_ enabled: Bool) {
        wakeWordEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: "cipherWakeWordEnabled")

        if enabled && !isListening && !isActivated {
            startListening()
        } else if !enabled {
            stopListening()
        }
    }

    func loadSettings() {
        wakeWordEnabled = UserDefaults.standard.bool(forKey: "cipherWakeWordEnabled")
        // Default to enabled if not set
        if !UserDefaults.standard.bool(forKey: "cipherWakeWordSettingsInitialized") {
            wakeWordEnabled = true
            UserDefaults.standard.set(true, forKey: "cipherWakeWordEnabled")
            UserDefaults.standard.set(true, forKey: "cipherWakeWordSettingsInitialized")
        }
    }
}

// MARK: - SFSpeechRecognizerDelegate

extension WakeWordDetector: SFSpeechRecognizerDelegate {
    nonisolated func speechRecognizer(_ speechRecognizer: SFSpeechRecognizer, availabilityDidChange available: Bool) {
        Task { @MainActor in
            if !available {
                print("WakeWordDetector: Speech recognition became unavailable")
            }
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let cipherWakeWordDetected = Notification.Name("cipherWakeWordDetected")
    static let cipherConversationEnded = Notification.Name("cipherConversationEnded")
    static let cipherConversationPaused = Notification.Name("cipherConversationPaused")
    static let cipherReadyForNextQuery = Notification.Name("cipherReadyForNextQuery")
}
