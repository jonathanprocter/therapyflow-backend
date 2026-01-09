import SwiftUI
import AVFoundation
import Speech
import Foundation

struct AIContextualHelperView: View {
    @ObservedObject private var aiService = AIAssistantService.shared
    @StateObject private var audioCoordinator = AudioCoordinator()
    @StateObject private var speechRecognizer = SpeechRecognizer()
    @ObservedObject private var elevenLabs = ElevenLabsConversationalService.shared
    @State private var isExpanded = false
    @State private var isMinimized = true
    @State private var showChat = false
    @State private var chatInput = ""
    @State private var dismissedSuggestions: Set<String> = []
    @State private var isVoiceMode = false
    @State private var useElevenLabs = true // Use ElevenLabs by default when available

    let context: AIAssistantService.AppContext
    var clientId: String?

    var body: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()
                if isMinimized {
                    minimizedButton
                } else {
                    expandedPanel
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 80) // Move up above tab bar "More" button
        }
    }

    // MARK: - Minimized State

    private var minimizedButton: some View {
        Button(action: { withAnimation(.spring()) { isMinimized = false } }) {
            ZStack {
                Circle()
                    .fill(Color.theme.primary)
                    .frame(width: 44, height: 44)
                    .shadow(color: .black.opacity(0.2), radius: 6, x: 0, y: 3)

                Image(systemName: "brain.head.profile")
                    .font(.system(size: 18))
                    .foregroundColor(.white)

                // Badge for suggestions count
                if visibleSuggestions.count > 0 {
                    Text("\(visibleSuggestions.count)")
                        .font(.system(size: 9))
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .frame(width: 16, height: 16)
                        .background(Color.theme.accent)
                        .clipShape(Circle())
                        .offset(x: 14, y: -14)
                }
            }
        }
        .accessibilityLabel("AI Assistant")
    }

    // MARK: - Expanded Panel

    private var expandedPanel: some View {
        VStack(spacing: 0) {
            // Header
            panelHeader

            if isExpanded {
                if showChat {
                    chatView
                } else {
                    suggestionsView
                }
            } else {
                collapsedSummary
            }
        }
        .frame(width: 320)
        .background(Color(UIColor.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.15), radius: 12, x: 0, y: 4)
    }

    private var panelHeader: some View {
        HStack {
            Image(systemName: "brain.head.profile")
                .foregroundColor(.white)

            Text("AI Assistant")
                .font(.headline)
                .foregroundColor(.white)

            Spacer()

            // Expand/Collapse button
            Button(action: { withAnimation { isExpanded.toggle() } }) {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.up")
                    .foregroundColor(.white.opacity(0.8))
            }

            // Minimize button
            Button(action: { withAnimation(.spring()) { isMinimized = true } }) {
                Image(systemName: "xmark")
                    .foregroundColor(.white.opacity(0.8))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            LinearGradient(
                colors: [Color.theme.primary, Color.theme.accent],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
    }

    private var collapsedSummary: some View {
        HStack {
            Text("\(visibleSuggestions.count) suggestions available")
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    // MARK: - Suggestions View

    private var suggestionsView: some View {
        VStack(spacing: 12) {
            ScrollView {
                VStack(spacing: 8) {
                    if visibleSuggestions.isEmpty {
                        Text("No suggestions right now. Keep up the great work!")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding()
                    } else {
                        ForEach(visibleSuggestions) { suggestion in
                            suggestionCard(suggestion)
                        }
                    }
                }
                .padding()
            }
            .frame(maxHeight: 250)

            // Quick Actions
            quickActionsBar
        }
    }

    private func suggestionCard(_ suggestion: AIAssistantService.ContextualSuggestion) -> some View {
        HStack(alignment: .top, spacing: 12) {
            suggestionIcon(for: suggestion.type)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(suggestion.title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    suggestionBadge(for: suggestion.type)
                }

                Text(suggestion.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                if let actionLabel = suggestion.actionLabel {
                    Button(action: {}) {
                        Text("\(actionLabel) →")
                            .font(.caption)
                            .foregroundColor(.theme.accent)
                    }
                }
            }

            Spacer()

            Button(action: {
                withAnimation {
                    _ = dismissedSuggestions.insert(suggestion.id)
                }
            }) {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(12)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(8)
    }

    private func suggestionIcon(for type: AIAssistantService.ContextualSuggestion.SuggestionType) -> some View {
        Group {
            switch type {
            case .tip:
                Image(systemName: "lightbulb.fill")
                    .foregroundColor(.yellow)
            case .action:
                Image(systemName: "sparkles")
                    .foregroundColor(.blue)
            case .insight:
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundColor(.green)
            case .warning:
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)
            }
        }
        .font(.system(size: 16))
    }

    private func suggestionBadge(for type: AIAssistantService.ContextualSuggestion.SuggestionType) -> some View {
        Text(type.rawValue)
            .font(.system(size: 9))
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(badgeColor(for: type).opacity(0.15))
            .foregroundColor(badgeColor(for: type))
            .cornerRadius(4)
    }

    private func badgeColor(for type: AIAssistantService.ContextualSuggestion.SuggestionType) -> Color {
        switch type {
        case .tip: return .yellow
        case .action: return .blue
        case .insight: return .green
        case .warning: return .orange
        }
    }

    private var quickActionsBar: some View {
        HStack(spacing: 12) {
            Button(action: {}) {
                Label("New Note", systemImage: "doc.text")
                    .font(.caption)
            }
            .buttonStyle(.bordered)

            Button(action: {
                withAnimation { showChat = true }
            }) {
                Label("Ask AI", systemImage: "mic.fill")
                    .font(.caption)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.horizontal)
        .padding(.bottom, 12)
    }

    // MARK: - Chat View

    private var chatView: some View {
        VStack(spacing: 0) {
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if conversationHistoryMessages.isEmpty {
                            Text("Ask me anything about your clients or practice...")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .padding(.top, 20)
                        } else {
                            ForEach(conversationHistoryMessages, id: \.id) { message in
                                chatBubbleUnified(role: message.role, content: message.content, hasAudio: message.hasAudio)
                                    .id(message.id)
                            }
                        }

                        if isCurrentlyProcessing {
                            HStack {
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text(elevenLabs.isSpeaking ? "Speaking..." : "Thinking...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 8)
                        }

                        // Show error if present
                        if let errorMessage = currentError {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.orange)
                                Text(errorMessage)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(10)
                            .background(Color.orange.opacity(0.1))
                            .cornerRadius(8)
                            .padding(.vertical, 4)
                        }
                    }
                    .padding()
                }
                .frame(height: 200)
                .onChange(of: conversationHistoryMessages.count) { _, _ in
                    if let last = conversationHistoryMessages.last {
                        withAnimation {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Voice recording indicator
            if isVoiceMode && isCurrentlyListening {
                voiceRecordingIndicator
            }

            // Input
            HStack(spacing: 8) {
                if isVoiceMode {
                    // Show transcript in voice mode
                    Text(currentTranscript.isEmpty ? "Listening..." : currentTranscript)
                        .font(.subheadline)
                        .foregroundColor(currentTranscript.isEmpty ? .secondary : .primary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(8)
                } else {
                    TextField("Type or speak...", text: $chatInput)
                        .textFieldStyle(.roundedBorder)
                        .font(.subheadline)
                        .disabled(aiService.isProcessing)
                        .onSubmit {
                            sendMessage()
                        }
                }

                // Voice/Send toggle button
                Button(action: {
                    if isVoiceMode {
                        if speechRecognizer.isListening {
                            stopVoiceRecording()
                        } else {
                            startVoiceRecording()
                        }
                    } else {
                        sendMessage()
                    }
                }) {
                    Image(systemName: isVoiceMode
                        ? (speechRecognizer.isListening ? "stop.circle.fill" : "mic.circle.fill")
                        : "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(isVoiceMode
                            ? (speechRecognizer.isListening ? .red : .theme.primary)
                            : (chatInput.isEmpty ? .gray : .theme.primary))
                }
                .disabled(!isVoiceMode && chatInput.isEmpty && !aiService.isProcessing)
            }
            .padding()

            // Bottom controls
            HStack {
                Button(action: {
                    withAnimation { showChat = false }
                }) {
                    Text("Back to tips")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Voice mode toggle
                Button(action: {
                    withAnimation {
                        isVoiceMode.toggle()
                        if !isVoiceMode && speechRecognizer.isListening {
                            speechRecognizer.stop()
                        }
                    }
                }) {
                    Image(systemName: isVoiceMode ? "keyboard" : "mic.fill")
                        .font(.caption)
                        .foregroundColor(isVoiceMode ? .theme.accent : .secondary)
                }

                if isPlayingAudio {
                    Button(action: stopAudio) {
                        Label("Stop", systemImage: "stop.fill")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }

                Button(action: {
                    aiService.voiceEnabled.toggle()
                }) {
                    Image(systemName: aiService.voiceEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                        .font(.caption)
                        .foregroundColor(aiService.voiceEnabled ? .theme.primary : .secondary)
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 12)
        }
    }

    // MARK: - Voice Recording Indicator

    private var voiceRecordingIndicator: some View {
        VStack(spacing: 4) {
            // Authorization warning if needed
            if useElevenLabs {
                if !elevenLabs.isAuthorized {
                    HStack(spacing: 4) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text("Microphone or speech not authorized")
                            .font(.caption2)
                            .foregroundColor(.orange)
                    }
                    .padding(.horizontal)
                    .padding(.top, 4)
                }
            } else if !speechRecognizer.isAuthorized || !speechRecognizer.isMicAuthorized {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                    Text(speechRecognizer.authorizationStatus)
                        .font(.caption2)
                        .foregroundColor(.orange)
                }
                .padding(.horizontal)
                .padding(.top, 4)
            }

            // Error display
            if let error = useElevenLabs ? elevenLabs.lastError : speechRecognizer.lastError?.localizedDescription {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(.red)
                    Text(error)
                        .font(.caption2)
                        .foregroundColor(.red)
                        .lineLimit(2)
                }
                .padding(.horizontal)
            }

            HStack(spacing: 8) {
                // Recording indicator with silence progress
                ZStack {
                    Circle()
                        .stroke(Color.red.opacity(0.3), lineWidth: 2)
                        .frame(width: 12, height: 12)

                    // Silence progress ring (fills as silence is detected)
                    if useElevenLabs && elevenLabs.isListening {
                        Circle()
                            .trim(from: 0, to: elevenLabs.silenceProgress)
                            .stroke(Color.green, lineWidth: 2)
                            .frame(width: 12, height: 12)
                            .rotationEffect(.degrees(-90))
                    }

                    Circle()
                        .fill(Color.red)
                        .frame(width: 6, height: 6)
                        .opacity(isCurrentlyListening ? 1 : 0)
                        .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: isCurrentlyListening)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(isCurrentlyListening ? "Recording..." : "Tap mic to start")
                        .font(.caption)
                        .foregroundColor(isCurrentlyListening ? .red : .secondary)

                    if useElevenLabs && elevenLabs.autoSendOnSilence && isCurrentlyListening {
                        Text("Auto-send on silence")
                            .font(.system(size: 9))
                            .foregroundColor(.green)
                    }
                }

                Spacer()

                // Show current transcript
                if !currentTranscript.isEmpty {
                    // Auto-send indicator when using ElevenLabs
                    if useElevenLabs && elevenLabs.autoSendOnSilence {
                        HStack(spacing: 4) {
                            ProgressView()
                                .scaleEffect(0.6)
                            Text("Sending soon...")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    } else {
                        Button(action: sendVoiceMessage) {
                            Text("Send")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 4)
                                .background(Color.theme.primary)
                                .cornerRadius(12)
                        }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color.red.opacity(isCurrentlyListening ? 0.1 : 0.05))
    }

    private var isCurrentlyListening: Bool {
        useElevenLabs ? elevenLabs.isListening : speechRecognizer.isListening
    }

    private var currentTranscript: String {
        useElevenLabs ? elevenLabs.transcript : speechRecognizer.transcript
    }

    // MARK: - Voice Recording Functions

    private func startVoiceRecording() {
        if useElevenLabs {
            elevenLabs.startListening()
        } else {
            speechRecognizer.start()
        }
    }

    private func stopVoiceRecording() {
        if useElevenLabs {
            // ElevenLabs handles auto-send via silence detection
            elevenLabs.stopListening()
            // If auto-send is disabled, manually trigger send
            if !elevenLabs.autoSendOnSilence && !elevenLabs.transcript.isEmpty {
                elevenLabs.sendMessage(clientId: clientId)
            }
            return
        }

        // Legacy speech recognizer path
        // Capture transcript before stopping (stop() may clear state)
        let legacyTranscript = speechRecognizer.transcript.trimmingCharacters(in: .whitespacesAndNewlines)

        speechRecognizer.stop()

        // Auto-send if there's a transcript - use small delay to ensure UI updates
        if !legacyTranscript.isEmpty {
            // Set transcript back if it was cleared during stop
            if speechRecognizer.transcript.isEmpty {
                speechRecognizer.transcript = legacyTranscript
            }
            // Small delay to allow UI to update
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                self.sendVoiceMessage()
            }
        }
    }

    private func sendVoiceMessage() {
        let message = speechRecognizer.transcript.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
        guard !message.isEmpty else { return }

        // Clear transcript immediately for better UX
        let capturedMessage = message
        speechRecognizer.transcript = ""

        // Stop recording if still active
        if speechRecognizer.isListening {
            speechRecognizer.stop()
        }

        Task {
            do {
                let (_, audioData) = try await aiService.sendVoiceQuery(capturedMessage, clientId: clientId)
                if let audioData = audioData, aiService.voiceEnabled {
                    playAudio(data: audioData)
                }
            } catch {
                print("AI Voice Error: \(error)")
                // Error is handled in the service and shown via lastError
            }
        }
    }

    private func chatBubble(_ message: AIAssistantService.ChatMessage) -> some View {
        HStack {
            if message.role == "user" { Spacer() }

            VStack(alignment: message.role == "user" ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .font(.subheadline)
                    .padding(10)
                    .background(message.role == "user" ? Color.theme.primary.opacity(0.15) : Color(UIColor.secondarySystemBackground))
                    .cornerRadius(12)

                if message.hasAudio && message.role == "assistant" {
                    HStack(spacing: 4) {
                        Image(systemName: "speaker.wave.2")
                        Text("Audio")
                    }
                    .font(.caption2)
                    .foregroundColor(.theme.primary)
                }
            }

            if message.role == "assistant" { Spacer() }
        }
    }

    // MARK: - Helpers

    private var visibleSuggestions: [AIAssistantService.ContextualSuggestion] {
        aiService.getSuggestions(for: context).filter { !dismissedSuggestions.contains($0.id) }
    }

    private var isPlayingAudio: Bool {
        useElevenLabs ? elevenLabs.isSpeaking : audioCoordinator.isPlaying
    }

    private var isCurrentlyProcessing: Bool {
        useElevenLabs ? (elevenLabs.isProcessing || elevenLabs.isSpeaking) : aiService.isProcessing
    }

    private var currentError: String? {
        useElevenLabs ? elevenLabs.lastError : aiService.lastError
    }

    // Unified message type for displaying conversation history
    private struct UnifiedMessage: Identifiable {
        let id: String
        let role: String
        let content: String
        let hasAudio: Bool
    }

    private var conversationHistoryMessages: [UnifiedMessage] {
        if useElevenLabs {
            return elevenLabs.conversationHistory.map { msg in
                UnifiedMessage(id: msg.id, role: msg.role, content: msg.content, hasAudio: msg.hasAudio)
            }
        } else {
            return aiService.conversationHistory.map { msg in
                UnifiedMessage(id: msg.id, role: msg.role, content: msg.content, hasAudio: msg.hasAudio)
            }
        }
    }

    private func chatBubbleUnified(role: String, content: String, hasAudio: Bool) -> some View {
        HStack {
            if role == "user" { Spacer() }

            VStack(alignment: role == "user" ? .trailing : .leading, spacing: 4) {
                Text(content)
                    .font(.subheadline)
                    .padding(10)
                    .background(role == "user" ? Color.theme.primary.opacity(0.15) : Color(UIColor.secondarySystemBackground))
                    .cornerRadius(12)

                if hasAudio && role == "assistant" {
                    HStack(spacing: 4) {
                        Image(systemName: "speaker.wave.2")
                        Text("Audio")
                    }
                    .font(.caption2)
                    .foregroundColor(.theme.primary)
                }
            }

            if role == "assistant" { Spacer() }
        }
    }

    private func sendMessage() {
        let message = chatInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }

        chatInput = ""

        if useElevenLabs {
            // Use ElevenLabs - set transcript and trigger send
            elevenLabs.transcript = message
            elevenLabs.sendMessage(clientId: clientId)
        } else {
            Task {
                do {
                    let (_, audioData) = try await aiService.sendVoiceQuery(message, clientId: clientId)
                    if let audioData = audioData, aiService.voiceEnabled {
                        playAudio(data: audioData)
                    }
                } catch {
                    print("AI Error: \(error)")
                }
            }
        }
    }

    private func playAudio(data: Data) {
        audioCoordinator.play(data: data)
    }

    private func stopAudio() {
        if useElevenLabs {
            elevenLabs.stopSpeaking()
        } else {
            audioCoordinator.stop()
        }
    }
}

// MARK: - Audio Coordinator

@MainActor
class AudioCoordinator: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published var isPlaying = false
    private var audioPlayer: AVAudioPlayer?
    
    func play(data: Data) {
        do {
            audioPlayer = try AVAudioPlayer(data: data)
            audioPlayer?.delegate = self
            audioPlayer?.play()
            isPlaying = true
        } catch {
            print("Audio playback error: \(error)")
        }
    }
    
    func stop() {
        audioPlayer?.stop()
        audioPlayer?.delegate = nil
        audioPlayer = nil
        isPlaying = false
    }
    
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            isPlaying = false
        }
    }
}

// MARK: - Suggestion Type Extension

extension AIAssistantService.ContextualSuggestion.SuggestionType {
    var rawValue: String {
        switch self {
        case .tip: return "tip"
        case .action: return "action"
        case .insight: return "insight"
        case .warning: return "warning"
        }
    }
}

// MARK: - Speech Recognizer

final class SpeechRecognizer: NSObject, ObservableObject, SFSpeechRecognizerDelegate {
    @Published var transcript: String = ""
    @Published var isListening: Bool = false
    @Published var isAuthorized: Bool = false
    @Published var isMicAuthorized: Bool = false
    @Published var lastError: Error?
    @Published var authorizationStatus: String = "Not checked"

    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    override init() {
        super.init()
        speechRecognizer?.delegate = self
        checkAllAuthorizations()
    }

    func checkAllAuthorizations() {
        // Check speech recognition authorization
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                self?.isAuthorized = (status == .authorized)
                switch status {
                case .authorized:
                    self?.authorizationStatus = "Speech: Authorized"
                case .denied:
                    self?.authorizationStatus = "Speech: Denied - Enable in Settings"
                case .restricted:
                    self?.authorizationStatus = "Speech: Restricted"
                case .notDetermined:
                    self?.authorizationStatus = "Speech: Not Determined"
                @unknown default:
                    self?.authorizationStatus = "Speech: Unknown"
                }
            }
        }

        // Check microphone authorization
        AVAudioApplication.requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                self?.isMicAuthorized = granted
                if !granted {
                    self?.authorizationStatus = "Microphone: Denied - Enable in Settings"
                }
            }
        }
    }

    func start() {
        guard !isListening else { return }

        // Check authorizations first
        if !isAuthorized || !isMicAuthorized {
            checkAllAuthorizations()
            DispatchQueue.main.async {
                self.lastError = NSError(
                    domain: "SpeechRecognizer",
                    code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "Microphone or speech recognition not authorized. Please enable in Settings."]
                )
            }
            return
        }

        lastError = nil
        transcript = ""

        // Cancel any existing task
        task?.cancel()
        task = nil

        // Configure audio session for recording
        let session = AVAudioSession.sharedInstance()
        do {
            // Use playAndRecord to allow audio output during/after recording
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            DispatchQueue.main.async {
                self.lastError = error
            }
            print("Audio session error: \(error)")
            return
        }

        // Create recognition request
        request = SFSpeechAudioBufferRecognitionRequest()
        guard let request = request else {
            DispatchQueue.main.async {
                self.lastError = NSError(
                    domain: "SpeechRecognizer",
                    code: -2,
                    userInfo: [NSLocalizedDescriptionKey: "Failed to create speech recognition request"]
                )
            }
            return
        }

        request.shouldReportPartialResults = true
        request.addsPunctuation = true

        // Get the input node and configure it
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        // Check if format is valid
        guard recordingFormat.sampleRate > 0 && recordingFormat.channelCount > 0 else {
            DispatchQueue.main.async {
                self.lastError = NSError(
                    domain: "SpeechRecognizer",
                    code: -3,
                    userInfo: [NSLocalizedDescriptionKey: "Invalid audio format. Please check microphone permissions."]
                )
            }
            return
        }

        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }

        audioEngine.prepare()

        do {
            try audioEngine.start()
        } catch {
            DispatchQueue.main.async {
                self.lastError = error
            }
            print("Audio engine start error: \(error)")
            return
        }

        DispatchQueue.main.async {
            self.isListening = true
        }

        // Start recognition task
        task = speechRecognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }

            var isFinal = false

            if let result = result {
                DispatchQueue.main.async {
                    self.transcript = result.bestTranscription.formattedString
                }
                isFinal = result.isFinal
            }

            if error != nil || isFinal {
                self.audioEngine.stop()
                self.audioEngine.inputNode.removeTap(onBus: 0)
                self.request = nil
                self.task = nil

                DispatchQueue.main.async {
                    self.isListening = false
                    if let error = error as? NSError, error.domain == "kAFAssistantErrorDomain" {
                        // Common speech recognition errors - silence ended, etc.
                        // Don't show these as errors to user
                        print("Speech recognition ended: \(error.localizedDescription)")
                    } else if let error = error {
                        self.lastError = error
                    }
                }
            }
        }
    }

    func stop() {
        guard isListening else { return }

        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.finish()

        request = nil
        task = nil

        DispatchQueue.main.async {
            self.isListening = false
        }

        // Reset audio session
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            print("Failed to deactivate audio session: \(error)")
        }
    }

    // MARK: - SFSpeechRecognizerDelegate

    func speechRecognizer(_ speechRecognizer: SFSpeechRecognizer, availabilityDidChange available: Bool) {
        DispatchQueue.main.async {
            if !available {
                self.lastError = NSError(
                    domain: "SpeechRecognizer",
                    code: -4,
                    userInfo: [NSLocalizedDescriptionKey: "Speech recognition is not available"]
                )
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray.opacity(0.1).ignoresSafeArea()
        AIContextualHelperView(context: .dashboard)
    }
}
