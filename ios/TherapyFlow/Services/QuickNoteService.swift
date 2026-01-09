import Foundation
import Speech
import AVFoundation
import Combine

/// Service for quick voice dictation of notes and reminders
@MainActor
class QuickNoteService: NSObject, ObservableObject {
    static let shared = QuickNoteService()

    // Callback when recording starts/stops (for coordinating with WakeWordDetector)
    var onRecordingStateChanged: ((Bool) -> Void)?

    // MARK: - Published State
    @Published var isRecording = false
    @Published var currentTranscript = ""
    @Published var currentNote: QuickNote?
    @Published var recentNotes: [QuickNote] = []
    @Published var silenceProgress: Double = 0
    @Published var processingState: ProcessingState = .idle
    @Published var recordingDuration: TimeInterval = 0
    @Published var errorMessage: String?

    enum ProcessingState: Equatable {
        case idle
        case recording
        case transcribing
        case processing
        case complete
        case error(String)
    }

    // MARK: - Speech Recognition
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    // MARK: - Silence Detection
    private var silenceTimer: Timer?
    private var lastSpeechTime: Date?
    private let silenceThreshold: TimeInterval = 1.5  // Auto-stop after 1.5s silence
    private var recordingStartTime: Date?
    private var durationTimer: Timer?

    // MARK: - Authorization
    @Published var speechAuthorizationStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined
    @Published var isMicrophoneAuthorized: Bool = false

    private override init() {
        super.init()
        loadRecentNotes()
        checkAuthorization()
    }

    // MARK: - Authorization

    func checkAuthorization() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                self?.speechAuthorizationStatus = status
            }
        }

        // Use AVAudioApplication for iOS 17+
        if #available(iOS 17.0, *) {
            isMicrophoneAuthorized = AVAudioApplication.shared.recordPermission == .granted
        } else {
            isMicrophoneAuthorized = AVAudioSession.sharedInstance().recordPermission == .granted
        }
    }

    func requestPermissions() async -> Bool {
        // Request speech recognition permission
        let speechStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }

        await MainActor.run {
            speechAuthorizationStatus = speechStatus
        }

        guard speechStatus == .authorized else { return false }

        // Request microphone permission using iOS 17+ API
        let micStatus: Bool
        if #available(iOS 17.0, *) {
            micStatus = await AVAudioApplication.requestRecordPermission()
        } else {
            micStatus = await withCheckedContinuation { continuation in
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
        }

        await MainActor.run {
            isMicrophoneAuthorized = micStatus
        }

        return micStatus
    }

    var isAuthorized: Bool {
        speechAuthorizationStatus == .authorized && isMicrophoneAuthorized
    }

    // MARK: - Recording

    /// Start recording a new quick note
    func startRecording(clientId: String? = nil, clientName: String? = nil, noteType: QuickNote.QuickNoteType = .progressNote) {
        guard !isRecording else { return }
        guard isAuthorized else {
            Task {
                let granted = await requestPermissions()
                if granted {
                    startRecording(clientId: clientId, clientName: clientName, noteType: noteType)
                }
            }
            return
        }

        // Notify that recording is starting (for coordinating with WakeWordDetector)
        onRecordingStateChanged?(true)

        // Create new note
        currentNote = QuickNote(
            noteType: noteType,
            clientId: clientId,
            clientName: clientName,
            status: .recording
        )
        currentTranscript = ""
        processingState = .recording
        errorMessage = nil
        recordingDuration = 0
        recordingStartTime = Date()

        // Configure audio session
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetoothA2DP])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            print("QuickNoteService: Failed to configure audio session: \(error)")
            processingState = .error("Failed to configure audio: \(error.localizedDescription)")
            errorMessage = error.localizedDescription
            onRecordingStateChanged?(false)
            return
        }

        // Start speech recognition
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        recognitionRequest?.shouldReportPartialResults = true
        recognitionRequest?.addsPunctuation = true

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        // Validate audio format
        guard recordingFormat.sampleRate > 0 && recordingFormat.channelCount > 0 else {
            print("QuickNoteService: Invalid audio format")
            processingState = .error("Invalid audio format")
            errorMessage = "Microphone not available"
            onRecordingStateChanged?(false)
            return
        }

        inputNode.removeTap(onBus: 0) // Remove any existing tap
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest!) { [weak self] result, error in
            guard let self = self else { return }

            if let result = result {
                Task { @MainActor in
                    self.currentTranscript = result.bestTranscription.formattedString
                    self.lastSpeechTime = Date()
                    self.silenceProgress = 0
                }
            }

            if error != nil || result?.isFinal == true {
                Task { @MainActor in
                    self.finishRecording()
                }
            }
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
            isRecording = true
            print("QuickNoteService: Recording started successfully")

            // Start duration timer
            durationTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    guard let self = self, let startTime = self.recordingStartTime else { return }
                    self.recordingDuration = Date().timeIntervalSince(startTime)
                }
            }

            // Start silence detection
            lastSpeechTime = Date()
            startSilenceDetection()

        } catch {
            print("QuickNoteService: Failed to start audio engine: \(error)")
            processingState = .error("Failed to start recording")
            errorMessage = error.localizedDescription
            onRecordingStateChanged?(false)
        }
    }

    /// Stop recording manually
    func stopRecording() {
        guard isRecording else { return }
        finishRecording()
    }

    private func finishRecording() {
        // Stop timers
        silenceTimer?.invalidate()
        silenceTimer = nil
        durationTimer?.invalidate()
        durationTimer = nil

        // Stop audio
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil

        isRecording = false
        print("QuickNoteService: Recording finished")

        // Notify that recording has ended
        onRecordingStateChanged?(false)

        // Deactivate audio session
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        // Update note with transcription
        guard var note = currentNote, !currentTranscript.isEmpty else {
            print("QuickNoteService: No transcript captured")
            processingState = .idle
            currentNote = nil
            return
        }

        print("QuickNoteService: Transcript captured: \(currentTranscript.prefix(50))...")
        note.rawTranscription = currentTranscript
        note.status = .transcribing
        currentNote = note
        processingState = .transcribing

        // Process based on type
        Task {
            await processNote(note)
        }
    }

    // MARK: - Silence Detection

    private func startSilenceDetection() {
        silenceTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self = self, let lastSpeech = self.lastSpeechTime else { return }

                let silenceDuration = Date().timeIntervalSince(lastSpeech)
                let progress = min(silenceDuration / self.silenceThreshold, 1.0)

                self.silenceProgress = progress

                if silenceDuration >= self.silenceThreshold && !self.currentTranscript.isEmpty {
                    self.stopRecording()
                }
            }
        }
    }

    // MARK: - Processing

    private func processNote(_ note: QuickNote) async {
        if note.noteType == .progressNote {
            // AI processing for progress notes - update state first
            var processingNote = note
            processingNote.status = .processing
            let noteForProcessing = processingNote  // Create immutable copy for closure
            await MainActor.run {
                processingState = .processing
                currentNote = noteForProcessing
            }

            // Process with AI
            let processedContent = await processWithAI(note.rawTranscription)

            // Create final note with processed content
            var finalNote = processingNote
            finalNote.processedContent = processedContent
            finalNote.status = .ready
            let completedNote = finalNote  // Create immutable copy for closure
            await MainActor.run {
                currentNote = completedNote
                processingState = .complete
            }
        } else {
            // Reminders don't need AI processing
            var readyNote = note
            readyNote.status = .ready
            let completedReminder = readyNote  // Create immutable copy for closure
            await MainActor.run {
                currentNote = completedReminder
                processingState = .complete
            }
        }
    }

    private func processWithAI(_ transcription: String) async -> String {
        // Try to use the AI service to enhance the note
        do {
            let enhanced = try await AIAssistantService.shared.enhanceNoteContent(transcription)
            return enhanced
        } catch {
            print("AI processing failed, using raw transcription: \(error)")
            return transcription
        }
    }

    // MARK: - Saving

    /// Save the current note
    func saveCurrentNote(
        noteType: QuickNote.QuickNoteType? = nil,
        clientId: String? = nil,
        clientName: String? = nil,
        sessionId: String? = nil,
        sessionDate: Date? = nil,
        dueDate: Date? = nil
    ) async throws -> QuickNote {
        guard var note = currentNote else {
            throw QuickNoteError.noCurrentNote
        }

        // Update with provided values
        if let type = noteType { note.noteType = type }
        if let cid = clientId { note.clientId = cid }
        if let cname = clientName { note.clientName = cname }
        if let sid = sessionId { note.sessionId = sid }
        if let sdate = sessionDate { note.sessionDate = sdate }
        if let ddate = dueDate { note.dueDate = ddate }

        resolveReminderLink(for: &note)
        note.status = .saved

        // Save to storage
        var allNotes = QuickNote.loadAll()
        allNotes.insert(note, at: 0)
        QuickNote.saveAll(allNotes)

        // If it's a progress note, also create a ProgressNote in the backend
        if note.noteType == .progressNote, let clientId = note.clientId {
            do {
                let progressNote = try await createProgressNote(from: note, clientId: clientId)
                note.generatedNoteId = progressNote.id
            } catch {
                print("Failed to create backend progress note: \(error)")
                // Continue - the quick note is still saved locally
            }
        }

        await MainActor.run {
            loadRecentNotes()
            currentNote = nil
            processingState = .idle
        }

        return note
    }

    private func createProgressNote(from quickNote: QuickNote, clientId: String) async throws -> ProgressNote {
        let input = CreateProgressNoteInput(
            clientId: clientId,
            sessionId: quickNote.sessionId,
            sessionDate: quickNote.sessionDate ?? quickNote.recordedAt,
            content: quickNote.displayContent,
            tags: nil,
            riskLevel: .low,
            progressRating: nil
        )
        return try await APIClient.shared.createProgressNote(input)
    }

    /// Discard the current note
    func discardCurrentNote() {
        guard var note = currentNote else { return }
        note.status = .discarded
        currentNote = nil
        processingState = .idle
    }

    // MARK: - Note Management

    func loadRecentNotes() {
        recentNotes = QuickNote.recentNotes(days: 7)
    }

    func deleteNote(id: String) {
        var allNotes = QuickNote.loadAll()
        allNotes.removeAll { $0.id == id }
        QuickNote.saveAll(allNotes)
        loadRecentNotes()
    }

    func toggleReminderComplete(id: String) {
        var allNotes = QuickNote.loadAll()
        if let index = allNotes.firstIndex(where: { $0.id == id }) {
            allNotes[index].isCompleted.toggle()
            QuickNote.saveAll(allNotes)
            loadRecentNotes()
        }
    }

    func updateNoteClient(noteId: String, clientId: String, clientName: String) {
        var allNotes = QuickNote.loadAll()
        if let index = allNotes.firstIndex(where: { $0.id == noteId }) {
            allNotes[index].clientId = clientId
            allNotes[index].clientName = clientName
            QuickNote.saveAll(allNotes)
            loadRecentNotes()
        }
    }

    private func resolveReminderLink(for note: inout QuickNote) {
        guard note.noteType == .reminder else { return }

        if note.clientId == nil {
            let transcript = note.displayContent.lowercased()
            let clients = PersistenceController.shared.fetchClients(therapistId: "")
            if let match = clients.first(where: { transcript.contains($0.name.lowercased()) }) {
                note.clientId = match.id
                note.clientName = match.name
            }
        }

        guard let clientId = note.clientId else { return }

        let sessions = PersistenceController.shared.fetchSessions(therapistId: "", upcoming: true)
            .filter { $0.clientId == clientId }
            .sorted { $0.scheduledAt < $1.scheduledAt }

        guard !sessions.isEmpty else { return }

        if let targetDate = note.targetDate,
           let match = sessions.first(where: { Calendar.current.isDate($0.scheduledAt, inSameDayAs: targetDate) }) {
            note.sessionId = match.id
            note.sessionDate = match.scheduledAt
            return
        }

        if note.sessionId == nil && note.sessionDate == nil {
            if let next = sessions.first {
                note.sessionId = next.id
                note.sessionDate = next.scheduledAt
            }
        }
    }

    /// Get reminders to show on a session card
    func remindersForSession(_ session: Session) -> [QuickNote] {
        return QuickNote.remindersForSession(session)
    }

    /// Get reminders for a specific date (for calendar view)
    func remindersForDate(_ date: Date) -> [QuickNote] {
        return QuickNote.remindersForDate(date)
    }
}

// MARK: - Errors

enum QuickNoteError: LocalizedError {
    case noCurrentNote
    case notAuthorized
    case recordingFailed
    case processingFailed

    var errorDescription: String? {
        switch self {
        case .noCurrentNote: return "No note is currently being recorded"
        case .notAuthorized: return "Speech recognition is not authorized"
        case .recordingFailed: return "Failed to start recording"
        case .processingFailed: return "Failed to process the note"
        }
    }
}

// MARK: - AIAssistantService Extension

extension AIAssistantService {
    /// Enhance note content with AI
    func enhanceNoteContent(_ rawContent: String) async throws -> String {
        let prompt = """
        Please enhance this dictated clinical session note. Keep the same information but:
        1. Fix any transcription errors
        2. Improve clarity and professional language
        3. Organize into clear sections if appropriate
        4. Keep it concise

        Dictated note:
        \(rawContent)

        Return only the enhanced note text, no commentary.
        """

        // Use existing AI infrastructure - sendMessage returns String directly
        return try await sendMessage(prompt)
    }
}
