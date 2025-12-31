import SwiftUI
import AVFoundation

/// Floating AI assistant helper that provides contextual suggestions and chat
struct AIContextualHelperView: View {
    @StateObject private var aiService = AIAssistantService.shared
    @State private var isExpanded = false
    @State private var isMinimized = true
    @State private var showChat = false
    @State private var chatInput = ""
    @State private var dismissedSuggestions: Set<String> = []
    @State private var audioPlayer: AVAudioPlayer?
    @State private var isPlayingAudio = false

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
            .padding()
        }
    }

    // MARK: - Minimized State

    private var minimizedButton: some View {
        Button(action: { withAnimation(.spring()) { isMinimized = false } }) {
            ZStack {
                Circle()
                    .fill(Color.theme.primary)
                    .frame(width: 56, height: 56)
                    .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)

                Image(systemName: "brain.head.profile")
                    .font(.system(size: 24))
                    .foregroundColor(.white)

                // Badge for suggestions count
                if visibleSuggestions.count > 0 {
                    Text("\(visibleSuggestions.count)")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .frame(width: 18, height: 18)
                        .background(Color.theme.accent)
                        .clipShape(Circle())
                        .offset(x: 18, y: -18)
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
                colors: [Color.theme.primary, Color.theme.secondary],
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
                    dismissedSuggestions.insert(suggestion.id)
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
                        if aiService.conversationHistory.isEmpty {
                            Text("Ask me anything about your clients or practice...")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .padding(.top, 20)
                        } else {
                            ForEach(aiService.conversationHistory) { message in
                                chatBubble(message)
                                    .id(message.id)
                            }
                        }

                        if aiService.isProcessing {
                            HStack {
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text("Thinking...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 8)
                        }
                    }
                    .padding()
                }
                .frame(height: 200)
                .onChange(of: aiService.conversationHistory.count) { _ in
                    if let last = aiService.conversationHistory.last {
                        withAnimation {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            Divider()

            // Input
            HStack(spacing: 8) {
                TextField("Type or speak...", text: $chatInput)
                    .textFieldStyle(.roundedBorder)
                    .font(.subheadline)
                    .disabled(aiService.isProcessing)
                    .onSubmit {
                        sendMessage()
                    }

                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(chatInput.isEmpty ? .gray : .theme.primary)
                }
                .disabled(chatInput.isEmpty || aiService.isProcessing)
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

    private func sendMessage() {
        let message = chatInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return }

        chatInput = ""

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

    private func playAudio(data: Data) {
        do {
            audioPlayer = try AVAudioPlayer(data: data)
            audioPlayer?.delegate = AudioPlayerDelegate { [self] in
                isPlayingAudio = false
            }
            audioPlayer?.play()
            isPlayingAudio = true
        } catch {
            print("Audio playback error: \(error)")
        }
    }

    private func stopAudio() {
        audioPlayer?.stop()
        isPlayingAudio = false
    }
}

// MARK: - Audio Player Delegate

private class AudioPlayerDelegate: NSObject, AVAudioPlayerDelegate {
    let onFinished: () -> Void

    init(onFinished: @escaping () -> Void) {
        self.onFinished = onFinished
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        onFinished()
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

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray.opacity(0.1).ignoresSafeArea()
        AIContextualHelperView(context: .dashboard)
    }
}
