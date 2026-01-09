import SwiftUI

/// Sheet shown during/after voice dictation for reviewing and saving notes
struct QuickNoteRecordingSheet: View {
    @ObservedObject private var quickNoteService = QuickNoteService.shared
    @Environment(\.dismiss) private var dismiss

    // Form state
    @State private var selectedNoteType: QuickNote.QuickNoteType = .progressNote
    @State private var selectedClientId: String?
    @State private var selectedClientName: String?
    @State private var selectedSessionId: String?
    @State private var selectedSessionDate: Date?
    @State private var dueDate: Date = Date()
    @State private var showDueDatePicker = false
    @State private var editedContent: String = ""

    // Data
    @State private var clients: [Client] = []
    @State private var isLoadingClients = true
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Status indicator
                    statusSection

                    // Recording/Transcript section
                    if quickNoteService.isRecording {
                        recordingSection
                    } else if let note = quickNoteService.currentNote {
                        transcriptSection(note: note)
                    }

                    // Type selector
                    if !quickNoteService.isRecording && quickNoteService.currentNote != nil {
                        typeSelector
                        clientSelector

                        if selectedNoteType == .reminder {
                            reminderOptions
                        }
                    }
                }
                .padding()
            }
            .background(Color.theme.background)
            .navigationTitle("Quick Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        quickNoteService.discardCurrentNote()
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    if !quickNoteService.isRecording && quickNoteService.currentNote?.status == .ready {
                        Button("Save") {
                            saveNote()
                        }
                        .disabled(isSaving)
                    }
                }
            }
            .task {
                await loadClients()

                // Initialize edited content from current note
                if let note = quickNoteService.currentNote {
                    editedContent = note.displayContent
                    selectedNoteType = note.noteType
                }
            }
        }
    }

    // MARK: - Status Section

    private var statusSection: some View {
        HStack(spacing: 12) {
            // Status icon
            ZStack {
                Circle()
                    .fill(statusColor.opacity(0.2))
                    .frame(width: 48, height: 48)

                if quickNoteService.isRecording || quickNoteService.processingState == .processing {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: statusIcon)
                        .font(.title2)
                        .foregroundColor(statusColor)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(statusTitle)
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Text(statusSubtitle)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Spacer()
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    private var statusColor: Color {
        switch quickNoteService.processingState {
        case .recording: return .red
        case .transcribing, .processing: return .blue
        case .complete: return .green
        case .error: return .orange
        case .idle: return .gray
        }
    }

    private var statusIcon: String {
        switch quickNoteService.processingState {
        case .recording: return "waveform"
        case .transcribing: return "text.bubble"
        case .processing: return "sparkles"
        case .complete: return "checkmark.circle"
        case .error: return "exclamationmark.triangle"
        case .idle: return "mic"
        }
    }

    private var statusTitle: String {
        switch quickNoteService.processingState {
        case .recording: return "Recording..."
        case .transcribing: return "Transcribing..."
        case .processing: return "AI Processing..."
        case .complete: return "Ready to Save"
        case .error(let msg): return "Error: \(msg)"
        case .idle: return "Ready"
        }
    }

    private var statusSubtitle: String {
        switch quickNoteService.processingState {
        case .recording: return "Speak your note. Stop when done."
        case .transcribing: return "Converting speech to text..."
        case .processing: return "Enhancing your note with AI..."
        case .complete: return "Review and save your note."
        case .error: return "Please try again."
        case .idle: return "Tap the mic to start recording."
        }
    }

    // MARK: - Recording Section

    private var recordingSection: some View {
        VStack(spacing: 16) {
            // Waveform placeholder
            WaveformView()
                .frame(height: 60)

            // Duration
            Text(formatDuration(quickNoteService.recordingDuration))
                .font(.system(size: 48, weight: .light, design: .monospaced))
                .foregroundColor(Color.theme.primaryText)

            // Silence indicator
            if quickNoteService.silenceProgress > 0 {
                VStack(spacing: 4) {
                    ProgressView(value: quickNoteService.silenceProgress)
                        .tint(.orange)

                    Text("Auto-stopping in \(String(format: "%.1f", (1.0 - quickNoteService.silenceProgress) * 1.5))s...")
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
                    .background(Color.theme.surface)
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
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Transcript Section

    private func transcriptSection(note: QuickNote) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Transcription")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                if note.noteType == .progressNote && note.processedContent != nil {
                    Text("AI Enhanced")
                        .font(.caption)
                        .foregroundColor(.blue)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(6)
                }
            }

            TextEditor(text: $editedContent)
                .font(.body)
                .foregroundColor(Color.theme.primaryText)
                .frame(minHeight: 150)
                .padding(8)
                .background(Color.theme.surfaceSecondary)
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.theme.border, lineWidth: 1)
                )
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Type Selector

    private var typeSelector: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Type")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            Picker("Note Type", selection: $selectedNoteType) {
                ForEach(QuickNote.QuickNoteType.allCases, id: \.self) { type in
                    Label(type.displayName, systemImage: type.icon)
                        .tag(type)
                }
            }
            .pickerStyle(.segmented)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Client Selector

    private var clientSelector: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Client (Optional)")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            if isLoadingClients {
                HStack {
                    ProgressView()
                    Text("Loading clients...")
                        .foregroundColor(Color.theme.secondaryText)
                }
            } else {
                Picker("Select Client", selection: $selectedClientId) {
                    Text("No client").tag(nil as String?)

                    ForEach(clients) { client in
                        Text(client.name).tag(client.id as String?)
                    }
                }
                .pickerStyle(.menu)
                .onChange(of: selectedClientId) { _, newValue in
                    if let id = newValue, let client = clients.first(where: { $0.id == id }) {
                        selectedClientName = client.name
                    } else {
                        selectedClientName = nil
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Reminder Options

    private var reminderOptions: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Reminder Options")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            Toggle("Set due date", isOn: $showDueDatePicker)
                .tint(Color.theme.primary)

            if showDueDatePicker {
                DatePicker(
                    "Due date",
                    selection: $dueDate,
                    in: Date()...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .datePickerStyle(.graphical)

                Text("This reminder will appear on the calendar and session cards for this date.")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Actions

    private func loadClients() async {
        do {
            let fetchedClients = try await APIClient.shared.getClients()
            await MainActor.run {
                clients = fetchedClients.filter { $0.status == .active }
                isLoadingClients = false
            }
        } catch {
            await MainActor.run {
                isLoadingClients = false
            }
        }
    }

    private func saveNote() {
        isSaving = true

        Task {
            do {
                // Update the content if edited
                if var note = quickNoteService.currentNote {
                    if selectedNoteType == .progressNote {
                        note.processedContent = editedContent
                    } else {
                        note.rawTranscription = editedContent
                    }
                    quickNoteService.currentNote = note
                }

                _ = try await quickNoteService.saveCurrentNote(
                    noteType: selectedNoteType,
                    clientId: selectedClientId,
                    clientName: selectedClientName,
                    sessionId: selectedSessionId,
                    sessionDate: selectedSessionDate,
                    dueDate: showDueDatePicker ? dueDate : nil
                )

                await MainActor.run {
                    isSaving = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSaving = false
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

// MARK: - Waveform View

struct WaveformView: View {
    @State private var animationPhase: Double = 0

    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 3) {
                ForEach(0..<30, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.red)
                        .frame(width: 4)
                        .frame(height: barHeight(for: index, in: geometry.size.height))
                        .animation(
                            .easeInOut(duration: 0.3)
                                .repeatForever()
                                .delay(Double(index) * 0.05),
                            value: animationPhase
                        )
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onAppear {
            animationPhase = 1
        }
    }

    private func barHeight(for index: Int, in maxHeight: CGFloat) -> CGFloat {
        let baseHeight = maxHeight * 0.3
        let variation = maxHeight * 0.7 * sin(Double(index) * 0.5 + animationPhase * .pi)
        return baseHeight + abs(CGFloat(variation))
    }
}

// MARK: - Preview

#Preview {
    QuickNoteRecordingSheet()
}
