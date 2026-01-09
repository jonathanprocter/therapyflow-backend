import SwiftUI
import AVFoundation
import Speech

/// Unified floating assistant - single edge-attached button that expands to show AI chat and quick notes
struct UnifiedFloatingAssistant: View {
    @ObservedObject private var aiService = AIAssistantService.shared
    @ObservedObject private var quickNoteService = QuickNoteService.shared
    @ObservedObject private var elevenLabs = ElevenLabsConversationalService.shared
    @ObservedObject private var wakeWord = WakeWordDetector.shared

    @State private var isExpanded = false
    @State private var selectedMode: AssistantMode = .ai
    @State private var chatInput = ""
    @State private var showingQuickNoteSheet = false
    @State private var statusMessage: String?
    @State private var statusMessageTask: Task<Void, Never>?

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let context: AIAssistantService.AppContext
    var clientId: String?

    enum AssistantMode: String, CaseIterable {
        case ai = "AI"
        case note = "Note"

        var icon: String {
            switch self {
            case .ai: return "brain.head.profile"
            case .note: return "mic.fill"
            }
        }
    }

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                Spacer()

                if isExpanded {
                    expandedPanel
                        .frame(width: min(360, geometry.size.width - 32))
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .trailing).combined(with: .opacity)
                        ))
                } else {
                    collapsedButton
                        .transition(.opacity)
                }
            }
            .frame(maxHeight: .infinity)
            .padding(.trailing, isExpanded ? 8 : 0)
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: isExpanded)
        .sheet(isPresented: $showingQuickNoteSheet) {
            QuickNoteRecordingSheet()
        }
        .onReceive(NotificationCenter.default.publisher(for: .cipherWakeWordDetected)) { _ in
            // Wake word detected - open AI mode
            // Note: ElevenLabsConversationalService handles the greeting message and starts listening
            withAnimation {
                isExpanded = true
                selectedMode = .ai
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .cipherConversationEnded)) { notification in
            let response = notification.userInfo?["response"] as? String
            showStatusMessage(response ?? "Conversation ended")
        }
        .onReceive(NotificationCenter.default.publisher(for: .cipherConversationPaused)) { notification in
            let response = notification.userInfo?["response"] as? String
            showStatusMessage(response ?? "Paused")
        }
    }

    // MARK: - Collapsed Button (Edge Tab)

    private var collapsedButton: some View {
        Button(action: { withAnimation { isExpanded = true } }) {
            VStack(spacing: 12) {
                // AI indicator
                ZStack {
                    Circle()
                        .fill(wakeWord.isListening ? Color.green.opacity(0.3) : Color.theme.primary.opacity(0.2))
                        .frame(width: 36, height: 36)

                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(wakeWord.isListening ? .green : Color.theme.primary)

                    // Wake word listening indicator
                    if wakeWord.isListening {
                        Circle()
                            .stroke(Color.green, lineWidth: 2)
                            .frame(width: 36, height: 36)
                            .scaleEffect(wakeWordPulse ? 1.3 : 1.0)
                            .opacity(wakeWordPulse ? 0 : 0.8)
                    }
                }

                // Recording indicator (for quick note)
                if quickNoteService.isRecording {
                    ZStack {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 36, height: 36)

                        Image(systemName: "stop.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.white)

                        // Recording progress ring
                        Circle()
                            .trim(from: 0, to: quickNoteService.silenceProgress)
                            .stroke(Color.white, lineWidth: 2)
                            .frame(width: 32, height: 32)
                            .rotationEffect(.degrees(-90))
                    }
                    .onTapGesture {
                        quickNoteService.stopRecording()
                    }
                } else {
                    // Mic button for quick note
                    ZStack {
                        Circle()
                            .fill(Color.theme.accent.opacity(0.2))
                            .frame(width: 36, height: 36)

                        Image(systemName: "mic.fill")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(Color.theme.accent)
                    }
                    .onTapGesture {
                        startQuickRecording()
                    }
                }
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 8)
            .background(
                Capsule()
                    .fill(.ultraThinMaterial)
                    .shadow(color: .black.opacity(0.15), radius: 8, x: -2, y: 2)
            )
            .overlay(
                Capsule()
                    .stroke(Color.theme.border.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .offset(x: 8) // Slightly overlap edge
        .onAppear {
            startWakeWordPulse()
        }
    }

    @State private var wakeWordPulse = false

    private func startWakeWordPulse() {
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: false)) {
            wakeWordPulse = true
        }
    }

    private func showStatusMessage(_ message: String) {
        statusMessageTask?.cancel()
        statusMessage = message
        statusMessageTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            statusMessage = nil
        }
    }

    // MARK: - Expanded Panel

    private var expandedPanel: some View {
        VStack(spacing: 0) {
            // Header
            panelHeader

            // Mode Selector
            modeSelector

            // Content
            Group {
                switch selectedMode {
                case .ai:
                    aiChatView
                case .note:
                    quickNoteView
                }
            }
            .frame(maxHeight: 400)
        }
        .background(Color(UIColor.systemBackground))
        .cornerRadius(20)
        .shadow(color: .black.opacity(0.15), radius: 16, x: -4, y: 4)
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color.theme.border.opacity(0.2), lineWidth: 1)
        )
    }

    private var panelHeader: some View {
        HStack {
            // Title with context
            VStack(alignment: .leading, spacing: 2) {
                Text("Cipher")
                    .font(.headline)
                    .foregroundColor(.white)

                if wakeWord.isListening {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 6, height: 6)
                        Text("Listening for \"Cipher\"")
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.7))
                    }
                } else if let statusMessage = statusMessage {
                    Text(statusMessage)
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.7))
                }
            }

            Spacer()

            // Wake word toggle
            Button(action: {
                wakeWord.setWakeWordEnabled(!wakeWord.wakeWordEnabled)
            }) {
                Image(systemName: wakeWord.wakeWordEnabled ? "ear.fill" : "ear")
                    .font(.system(size: 14))
                    .foregroundColor(wakeWord.wakeWordEnabled ? .green : .white.opacity(0.6))
            }
            .padding(.trailing, 8)

            // Close button
            Button(action: { withAnimation { isExpanded = false } }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.white.opacity(0.7))
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

    private var modeSelector: some View {
        HStack(spacing: 0) {
            ForEach(AssistantMode.allCases, id: \.self) { mode in
                Button(action: { withAnimation { selectedMode = mode } }) {
                    HStack(spacing: 6) {
                        Image(systemName: mode.icon)
                            .font(.system(size: 12))
                        Text(mode.rawValue)
                            .font(.subheadline)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(selectedMode == mode ? Color.theme.primary : .secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        selectedMode == mode
                            ? Color.theme.primary.opacity(0.1)
                            : Color.clear
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color(UIColor.secondarySystemBackground))
    }

    // MARK: - AI Chat View

    private var aiChatView: some View {
        VStack(spacing: 0) {
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if elevenLabs.conversationHistory.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "bubble.left.and.bubble.right")
                                    .font(.largeTitle)
                                    .foregroundColor(.secondary.opacity(0.5))

                                Text("Say \"Cipher\" or tap the mic to ask a question")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                            }
                            .padding(.top, 40)
                        } else {
                            ForEach(elevenLabs.conversationHistory) { message in
                                chatBubble(message)
                                    .id(message.id)
                            }
                        }

                        if elevenLabs.isProcessing || elevenLabs.isSpeaking {
                            HStack(spacing: 8) {
                                ProgressView()
                                    .scaleEffect(0.7)
                                Text(elevenLabs.isSpeaking ? "Speaking..." : "Thinking...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 8)
                        }
                    }
                    .padding()
                }
                .onChange(of: elevenLabs.conversationHistory.count) { _, _ in
                    if let last = elevenLabs.conversationHistory.last {
                        withAnimation {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Voice input indicator
            if elevenLabs.isListening {
                voiceInputIndicator
            }

            // Text input
            chatInputBar
        }
    }

    private func chatBubble(_ message: ElevenLabsConversationalService.ConversationMessage) -> some View {
        HStack {
            if message.role == "user" { Spacer(minLength: 40) }

            Text(message.content)
                .font(.subheadline)
                .padding(10)
                .background(message.role == "user"
                    ? Color.theme.primary.opacity(0.15)
                    : Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)

            if message.role == "assistant" { Spacer(minLength: 40) }
        }
    }

    private var voiceInputIndicator: some View {
        HStack(spacing: 12) {
            // Animated recording dot
            ZStack {
                Circle()
                    .fill(Color.red.opacity(0.3))
                    .frame(width: 32, height: 32)

                Circle()
                    .fill(Color.red)
                    .frame(width: 12, height: 12)
                    .scaleEffect(recordingPulse ? 1.2 : 0.8)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(elevenLabs.transcript.isEmpty ? "Listening..." : elevenLabs.transcript)
                    .font(.subheadline)
                    .foregroundColor(elevenLabs.transcript.isEmpty ? .secondary : .primary)
                    .lineLimit(2)

                if elevenLabs.autoSendOnSilence && !elevenLabs.transcript.isEmpty {
                    HStack(spacing: 4) {
                        ProgressView()
                            .scaleEffect(0.5)
                        Text("Sending on silence...")
                            .font(.caption2)
                            .foregroundColor(.green)
                    }
                }
            }

            Spacer()

            Button(action: { elevenLabs.stopListening() }) {
                Image(systemName: "stop.circle.fill")
                    .font(.title2)
                    .foregroundColor(.red)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.red.opacity(0.05))
        .onAppear { startRecordingPulse() }
    }

    @State private var recordingPulse = false

    private func startRecordingPulse() {
        withAnimation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true)) {
            recordingPulse = true
        }
    }

    private var chatInputBar: some View {
        HStack(spacing: 8) {
            TextField("Ask Cipher...", text: $chatInput)
                .textFieldStyle(.roundedBorder)
                .font(.subheadline)
                .disabled(elevenLabs.isProcessing || elevenLabs.isListening)
                .onSubmit { sendChatMessage() }

            // Mic button
            Button(action: {
                if elevenLabs.isListening {
                    elevenLabs.stopListening()
                } else {
                    elevenLabs.startListening()
                }
            }) {
                ZStack {
                    Circle()
                        .fill(elevenLabs.isListening ? Color.red : Color.theme.primary)
                        .frame(width: 36, height: 36)

                    Image(systemName: elevenLabs.isListening ? "stop.fill" : "mic.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.white)
                }
            }
            .disabled(elevenLabs.isProcessing)

            // Send button (for text)
            if !chatInput.isEmpty {
                Button(action: sendChatMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(Color.theme.primary)
                }
            }
        }
        .padding()
    }

    private func sendChatMessage() {
        let message = chatInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }

        chatInput = ""
        elevenLabs.transcript = message
        elevenLabs.sendMessage(clientId: clientId)
    }

    // MARK: - Quick Note View

    private var quickNoteView: some View {
        VStack(spacing: 16) {
            if quickNoteService.isRecording {
                // Recording state
                recordingView
            } else if let note = quickNoteService.currentNote, note.status == .ready || note.status == .transcribing || note.status == .processing {
                // Processing/ready state
                processingView(note: note)
            } else {
                // Idle state
                idleQuickNoteView
            }
        }
        .padding()
    }

    private var idleQuickNoteView: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "mic.circle.fill")
                .font(.system(size: 60))
                .foregroundColor(Color.theme.accent)

            Text("Quick Voice Note")
                .font(.headline)

            Text("Tap to start recording a note or reminder. It will auto-stop after 1.5 seconds of silence.")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: startQuickRecording) {
                Label("Start Recording", systemImage: "mic.fill")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.theme.accent)
                    .cornerRadius(12)
            }

            // Recent notes shortcut
            if !quickNoteService.recentNotes.isEmpty {
                Button(action: { showingQuickNoteSheet = true }) {
                    HStack {
                        Image(systemName: "clock.arrow.circlepath")
                        Text("\(quickNoteService.recentNotes.count) recent notes")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
    }

    private var recordingView: some View {
        VStack(spacing: 20) {
            // Waveform animation
            WaveformView()
                .frame(height: 60)

            // Duration
            Text(formatDuration(quickNoteService.recordingDuration))
                .font(.system(size: 40, weight: .light, design: .monospaced))
                .foregroundColor(Color.theme.primaryText)

            // Silence indicator
            if quickNoteService.silenceProgress > 0 {
                VStack(spacing: 4) {
                    ProgressView(value: quickNoteService.silenceProgress)
                        .tint(.orange)

                    Text("Auto-stopping...")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }

            // Live transcript
            if !quickNoteService.currentTranscript.isEmpty {
                Text(quickNoteService.currentTranscript)
                    .font(.body)
                    .foregroundColor(Color.theme.secondaryText)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(8)
            }

            // Stop button
            Button(action: { quickNoteService.stopRecording() }) {
                Label("Stop Recording", systemImage: "stop.fill")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.red)
                    .cornerRadius(12)
            }
        }
    }

    private func processingView(note: QuickNote) -> some View {
        VStack(spacing: 16) {
            // Status
            HStack(spacing: 12) {
                if note.status == .ready {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                } else {
                    ProgressView()
                }

                Text(statusText(for: note.status))
                    .font(.subheadline)
            }

            // Transcript
            Text(note.displayContent)
                .font(.body)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(8)

            if note.status == .ready {
                HStack(spacing: 12) {
                    Button(action: {
                        quickNoteService.discardCurrentNote()
                    }) {
                        Label("Discard", systemImage: "trash")
                            .font(.subheadline)
                            .foregroundColor(.red)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(10)
                    }

                    Button(action: {
                        showingQuickNoteSheet = true
                    }) {
                        Label("Save", systemImage: "checkmark")
                            .font(.subheadline)
                            .foregroundColor(.white)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(Color.theme.primary)
                            .cornerRadius(10)
                    }
                }
            }
        }
    }

    private func statusText(for status: QuickNote.QuickNoteStatus) -> String {
        switch status {
        case .recording: return "Recording..."
        case .transcribing: return "Transcribing..."
        case .processing: return "AI Processing..."
        case .ready: return "Ready to save"
        default: return ""
        }
    }

    // MARK: - Actions

    private func startQuickRecording() {
        // Stop wake word listening to avoid conflicts
        if wakeWord.isListening {
            wakeWord.stopListening()
        }

        // Start recording
        quickNoteService.startRecording()

        // Auto-show the sheet when recording completes
        Task {
            // Wait for recording to finish
            while quickNoteService.isRecording {
                try? await Task.sleep(nanoseconds: 100_000_000)
            }

            // Resume wake word if enabled
            if wakeWord.wakeWordEnabled {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    wakeWord.startListening()
                }
            }
        }
    }

    // MARK: - Helpers

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray.opacity(0.1).ignoresSafeArea()
        UnifiedFloatingAssistant(context: .dashboard)
    }
}
