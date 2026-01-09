import AVFoundation
import SwiftUI
import UIKit

// MARK: - Voice Notes Types (Placeholder for future API integration)

struct VoiceNoteSummary: Identifiable, Codable {
    let id: String
    let clientName: String
    let transcription: String
    let createdAt: Date
    let tags: [String]
}

struct VoiceNotesByPriority: Codable {
    let urgent: [VoiceNoteSummary]
    let high: [VoiceNoteSummary]
    let normal: [VoiceNoteSummary]
    let low: [VoiceNoteSummary]
}

struct VoiceNotesDailySummary: Codable {
    let totalNotes: Int
    let byPriority: VoiceNotesByPriority
}

struct VoiceNoteCreateInput: Codable {
    let clientId: String
    let sessionId: String?
    let noteType: String
    let priority: String
    let tags: [String]?
    let metadata: [String: String]?
    let audio: String
}

enum ExportFormat {
    case markdown
    case plainText
}

// MARK: - APIClient Extension for Voice Notes
extension APIClient {
    func getVoiceNotesDailySummary() async throws -> VoiceNotesDailySummary {
        // Placeholder - return empty summary until API is implemented
        return VoiceNotesDailySummary(
            totalNotes: 0,
            byPriority: VoiceNotesByPriority(urgent: [], high: [], normal: [], low: [])
        )
    }

    func exportVoiceNotesDaily(format: ExportFormat) async throws -> String {
        // Placeholder - return empty string until API is implemented
        return ""
    }

    func createVoiceNote(_ input: VoiceNoteCreateInput) async throws -> VoiceNoteSummary {
        // Placeholder - return dummy note until API is implemented
        return VoiceNoteSummary(
            id: UUID().uuidString,
            clientName: "",
            transcription: "",
            createdAt: Date(),
            tags: []
        )
    }
}

struct FollowUpsView: View {
    @State private var summary: VoiceNotesDailySummary?
    @State private var isLoading = false
    @State private var error: String?
    @State private var exportedText: String = ""
    @State private var showShareSheet = false

    var body: some View {
        VStack(spacing: 16) {
            header

            if isLoading {
                LoadingView()
                    .frame(maxHeight: .infinity)
            } else if let error = error {
                Text(error)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.error)
            } else {
                summaryContent
            }
        }
        .padding()
        .background(Color.theme.background)
        .navigationTitle("Follow-Ups")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Export") {
                    Task {
                        await exportSummary()
                    }
                }
                .disabled(summary == nil)
            }
        }
        .sheet(isPresented: $showShareSheet) {
            FollowUpsShareSheet(activityItems: [exportedText])
        }
        .refreshable {
            await loadSummary()
        }
        .task {
            await loadSummary()
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Daily Follow-Ups")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Text(Date().longDate)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Spacer()

            Button("Copy") {
                Task {
                    await copySummary()
                }
            }
            .disabled(summary == nil)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    @ViewBuilder
    private var summaryContent: some View {
        if let summary {
            if summary.totalNotes == 0 {
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.seal")
                        .font(.largeTitle)
                        .foregroundColor(Color.theme.success)
                    Text("No follow-ups pending")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        FollowUpsPrioritySection(title: "Urgent", notes: summary.byPriority.urgent)
                        FollowUpsPrioritySection(title: "High", notes: summary.byPriority.high)
                        FollowUpsPrioritySection(title: "Normal", notes: summary.byPriority.normal)
                        FollowUpsPrioritySection(title: "Low", notes: summary.byPriority.low)
                    }
                    .padding(.bottom, 16)
                }
            }
        } else {
            EmptyStateView(
                icon: "checklist",
                title: "No summary yet",
                message: "Record follow-ups to see them summarized here."
            )
        }
    }

    private func loadSummary() async {
        isLoading = true
        error = nil

        do {
            let summary = try await APIClient.shared.getVoiceNotesDailySummary()
            await MainActor.run {
                self.summary = summary
                isLoading = false
            }
        } catch {
            await MainActor.run {
                self.error = "Failed to load follow-ups."
                self.isLoading = false
            }
        }
    }

    private func exportSummary() async {
        do {
            let text = try await APIClient.shared.exportVoiceNotesDaily(format: .markdown)
            await MainActor.run {
                exportedText = text
                showShareSheet = true
            }
        } catch {
            await MainActor.run {
                exportedText = ""
                showShareSheet = false
            }
        }
    }

    private func copySummary() async {
        do {
            let text = try await APIClient.shared.exportVoiceNotesDaily(format: .markdown)
            await MainActor.run {
                UIPasteboard.general.string = text
            }
        } catch {
            await MainActor.run {
                UIPasteboard.general.string = nil
            }
        }
    }
}

struct FollowUpsPrioritySection: View {
    let title: String
    let notes: [VoiceNoteSummary]

    var body: some View {
        if !notes.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)

                VStack(spacing: 8) {
                    ForEach(notes) { note in
                        FollowUpRow(note: note)
                    }
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(12)
            }
        }
    }
}

struct FollowUpRow: View {
    let note: VoiceNoteSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(note.clientName)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                Text(note.createdAt.relativeString)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Text(note.transcription)
                .font(.subheadline)
                .foregroundColor(Color.theme.primaryText)

            if !note.tags.isEmpty {
                Text(note.tags.joined(separator: ", "))
                    .font(.caption2)
                    .foregroundColor(Color.theme.secondaryText)
            }
        }
        .padding()
        .background(Color.theme.surfaceSecondary)
        .cornerRadius(10)
    }
}

// MARK: - Voice Note Recorder

struct VoiceNoteRecorderView: View {
    let clientId: String
    let sessionId: String?
    var onSaved: (() -> Void)? = nil

    @StateObject private var recorder = VoiceNoteRecorder()
    @State private var isUploading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 16) {
            Text("Record Follow-Up")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            Text(recorder.isRecording ? "Listening..." : "Tap to record a follow-up note.")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)

            Button(action: toggleRecording) {
                Image(systemName: recorder.isRecording ? "stop.circle.fill" : "mic.circle.fill")
                    .font(.system(size: 64))
                    .foregroundColor(recorder.isRecording ? Color.theme.error : Color.theme.accent)
            }
            .disabled(isUploading)

            if let duration = recorder.durationText {
                Text(duration)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            if let errorMessage = errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundColor(Color.theme.error)
            }

            Button("Save Follow-Up") {
                Task { await uploadRecording() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(recorder.audioURL == nil || isUploading)
        }
        .padding()
        .onDisappear {
            recorder.stop()
        }
    }

    private func toggleRecording() {
        if recorder.isRecording {
            recorder.stop()
        } else {
            recorder.start()
        }
    }

    private func uploadRecording() async {
        guard let audioURL = recorder.audioURL else { return }
        isUploading = true
        errorMessage = nil

        do {
            let data = try Data(contentsOf: audioURL)
            let base64Audio = data.base64EncodedString()
            let input = VoiceNoteCreateInput(
                clientId: clientId,
                sessionId: sessionId,
                noteType: "follow_up",
                priority: "normal",
                tags: nil,
                metadata: nil,
                audio: base64Audio
            )
            _ = try await APIClient.shared.createVoiceNote(input)
            await MainActor.run {
                isUploading = false
                onSaved?()
            }
        } catch {
            await MainActor.run {
                errorMessage = "Failed to save follow-up."
                isUploading = false
            }
        }
    }
}

final class VoiceNoteRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    @Published var isRecording = false
    @Published var durationText: String?
    @Published var audioURL: URL?

    private var recorder: AVAudioRecorder?
    private var timer: Timer?
    private var startDate: Date?

    func start() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            return
        }

        let fileName = "followup-\(UUID().uuidString).wav"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: 16000,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false
        ]

        do {
            recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder?.delegate = self
            recorder?.record()
            audioURL = url
            isRecording = true
            startDate = Date()
            startTimer()
        } catch {
            recorder = nil
            isRecording = false
        }
    }

    func stop() {
        recorder?.stop()
        recorder = nil
        isRecording = false
        stopTimer()
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self, let startDate = self.startDate else { return }
            let elapsed = Date().timeIntervalSince(startDate)
            self.durationText = String(format: "Duration: %.1fs", elapsed)
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }
}

struct FollowUpsShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
