import Foundation

/// A quick note captured via voice dictation - can be either a progress note or a reminder
struct QuickNote: Identifiable, Codable {
    let id: String
    var noteType: QuickNoteType
    var clientId: String?
    var clientName: String?
    var rawTranscription: String
    var processedContent: String?  // AI-enhanced version (for progress notes)
    let recordedAt: Date
    var sessionId: String?  // Link to specific session
    var sessionDate: Date?  // For reminders: which session/date this applies to
    var dueDate: Date?  // For time-specific reminders
    var isCompleted: Bool = false  // For reminders
    var status: QuickNoteStatus
    var generatedNoteId: String?  // Links to created ProgressNote (if converted)

    enum QuickNoteType: String, Codable, CaseIterable {
        case progressNote  // Will be processed into clinical note
        case reminder      // Simple reminder/to-do item

        var displayName: String {
            switch self {
            case .progressNote: return "Progress Note"
            case .reminder: return "Reminder"
            }
        }

        var icon: String {
            switch self {
            case .progressNote: return "doc.text"
            case .reminder: return "bell"
            }
        }
    }

    enum QuickNoteStatus: String, Codable {
        case recording    // Currently recording
        case transcribing // Converting speech to text
        case processing   // AI enhancing/formatting (notes only)
        case ready        // Draft ready for review
        case saved        // Saved as progress note OR reminder
        case discarded    // User deleted

        var displayName: String {
            switch self {
            case .recording: return "Recording"
            case .transcribing: return "Transcribing"
            case .processing: return "Processing"
            case .ready: return "Ready"
            case .saved: return "Saved"
            case .discarded: return "Discarded"
            }
        }

        var color: String {
            switch self {
            case .recording: return "red"
            case .transcribing: return "orange"
            case .processing: return "blue"
            case .ready: return "green"
            case .saved: return "gray"
            case .discarded: return "gray"
            }
        }
    }

    init(
        id: String = UUID().uuidString,
        noteType: QuickNoteType = .progressNote,
        clientId: String? = nil,
        clientName: String? = nil,
        rawTranscription: String = "",
        processedContent: String? = nil,
        recordedAt: Date = Date(),
        sessionId: String? = nil,
        sessionDate: Date? = nil,
        dueDate: Date? = nil,
        isCompleted: Bool = false,
        status: QuickNoteStatus = .recording,
        generatedNoteId: String? = nil
    ) {
        self.id = id
        self.noteType = noteType
        self.clientId = clientId
        self.clientName = clientName
        self.rawTranscription = rawTranscription
        self.processedContent = processedContent
        self.recordedAt = recordedAt
        self.sessionId = sessionId
        self.sessionDate = sessionDate
        self.dueDate = dueDate
        self.isCompleted = isCompleted
        self.status = status
        self.generatedNoteId = generatedNoteId
    }

    /// The content to display (processed if available, otherwise raw)
    var displayContent: String {
        processedContent ?? rawTranscription
    }

    /// Check if this reminder is for a specific date
    var hasScheduledDate: Bool {
        dueDate != nil || sessionDate != nil
    }

    /// The date this reminder should appear on (for calendar display)
    var targetDate: Date? {
        dueDate ?? sessionDate
    }

    /// Check if this reminder is overdue
    var isOverdue: Bool {
        guard noteType == .reminder, !isCompleted else { return false }
        guard let target = targetDate else { return false }
        return target < Date()
    }

    /// Check if this reminder is for today
    var isForToday: Bool {
        guard let target = targetDate else { return false }
        return Calendar.current.isDateInToday(target)
    }

    /// Check if this reminder should show on a specific session
    func shouldShowOnSession(_ session: Session) -> Bool {
        guard noteType == .reminder, !isCompleted, status == .saved else { return false }

        // Match by session ID
        if let mySessionId = sessionId, mySessionId == session.id {
            return true
        }

        // Match by client and date
        if let myClientId = clientId, myClientId == session.clientId {
            if let myDate = targetDate {
                return Calendar.current.isDate(myDate, inSameDayAs: session.scheduledAt)
            }
        }

        return false
    }
}

// MARK: - QuickNote Storage Helper
extension QuickNote {
    /// Key for UserDefaults storage
    static let storageKey = "com.therapyflow.quicknotes"

    /// Load all quick notes from storage
    static func loadAll() -> [QuickNote] {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else {
            return []
        }
        do {
            return try JSONDecoder().decode([QuickNote].self, from: data)
        } catch {
            print("Failed to decode quick notes: \(error)")
            return []
        }
    }

    /// Save all quick notes to storage
    static func saveAll(_ notes: [QuickNote]) {
        do {
            let data = try JSONEncoder().encode(notes)
            UserDefaults.standard.set(data, forKey: storageKey)
        } catch {
            print("Failed to encode quick notes: \(error)")
        }
    }

    /// Get reminders for a specific date
    static func remindersForDate(_ date: Date) -> [QuickNote] {
        let all = loadAll()
        return all.filter { note in
            note.noteType == .reminder &&
            note.status == .saved &&
            !note.isCompleted &&
            note.targetDate != nil &&
            Calendar.current.isDate(note.targetDate!, inSameDayAs: date)
        }
    }

    /// Get reminders for a specific client
    static func remindersForClient(_ clientId: String) -> [QuickNote] {
        let all = loadAll()
        return all.filter { note in
            note.noteType == .reminder &&
            note.status == .saved &&
            !note.isCompleted &&
            note.clientId == clientId
        }
    }

    /// Get reminders for a specific session
    static func remindersForSession(_ session: Session) -> [QuickNote] {
        let all = loadAll()
        return all.filter { $0.shouldShowOnSession(session) }
    }

    /// Get all pending (unsaved) notes
    static func pendingNotes() -> [QuickNote] {
        let all = loadAll()
        return all.filter { $0.status == .ready }
    }

    /// Get recent notes (last 7 days)
    static func recentNotes(days: Int = 7) -> [QuickNote] {
        let all = loadAll()
        let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        return all.filter { $0.recordedAt >= cutoff }
            .sorted { $0.recordedAt > $1.recordedAt }
    }
}
