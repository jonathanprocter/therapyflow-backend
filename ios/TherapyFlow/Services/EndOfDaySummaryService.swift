import Foundation
import UserNotifications
import UIKit

/// Service for managing end-of-day summaries and notifications
/// Compiles daily notes and presents them at 21:30 (9:30 PM)
@MainActor
class EndOfDaySummaryService: ObservableObject {
    static let shared = EndOfDaySummaryService()

    // MARK: - Published State
    @Published var isNotificationsEnabled = false
    @Published var summaryTime: DateComponents = {
        var components = DateComponents()
        components.hour = 21
        components.minute = 30
        return components
    }()
    @Published var lastSummaryDate: Date?
    @Published var pendingSummary: DailySummary?

    // MARK: - Notification Identifiers
    private let endOfDayNotificationId = "com.therapyflow.endofday.summary"
    private let summaryTimeKey = "endOfDaySummaryTime"
    private let lastSummaryKey = "lastEndOfDaySummaryDate"

    // MARK: - Types

    struct DailySummary: Codable {
        let date: Date
        let quickNotes: [QuickNoteSummary]
        let reminders: [ReminderSummary]
        let clientsSeen: [ClientSummary]
        let totalNotes: Int
        let pendingReminders: Int
        let generatedAt: Date

        var hasContent: Bool {
            !quickNotes.isEmpty || !reminders.isEmpty
        }
    }

    struct QuickNoteSummary: Codable {
        let id: String
        let clientName: String?
        let content: String
        let recordedAt: Date
        let noteType: String
    }

    struct ReminderSummary: Codable {
        let id: String
        let clientName: String?
        let content: String
        let dueDate: Date?
        let isOverdue: Bool
        let linkedSessionDate: Date?
    }

    struct ClientSummary: Codable {
        let clientId: String
        let clientName: String
        let notesCount: Int
        let remindersCount: Int
    }

    // MARK: - Initialization

    private init() {
        loadSettings()
        checkNotificationAuthorization()
    }

    // MARK: - Settings

    private func loadSettings() {
        if let savedHour = UserDefaults.standard.object(forKey: "\(summaryTimeKey).hour") as? Int,
           let savedMinute = UserDefaults.standard.object(forKey: "\(summaryTimeKey).minute") as? Int {
            summaryTime.hour = savedHour
            summaryTime.minute = savedMinute
        }

        if let lastDate = UserDefaults.standard.object(forKey: lastSummaryKey) as? Date {
            lastSummaryDate = lastDate
        }
    }

    func updateSummaryTime(hour: Int, minute: Int) {
        summaryTime.hour = hour
        summaryTime.minute = minute
        UserDefaults.standard.set(hour, forKey: "\(summaryTimeKey).hour")
        UserDefaults.standard.set(minute, forKey: "\(summaryTimeKey).minute")

        // Reschedule notification with new time
        if isNotificationsEnabled {
            scheduleEndOfDayNotification()
        }
    }

    // MARK: - Authorization

    func checkNotificationAuthorization() {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            DispatchQueue.main.async {
                self?.isNotificationsEnabled = settings.authorizationStatus == .authorized
            }
        }
    }

    func requestNotificationPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .sound, .badge]
            )
            await MainActor.run {
                isNotificationsEnabled = granted
            }
            if granted {
                scheduleEndOfDayNotification()
            }
            return granted
        } catch {
            print("EndOfDaySummaryService: Failed to request notification permission: \(error)")
            return false
        }
    }

    // MARK: - Notification Scheduling

    func scheduleEndOfDayNotification() {
        guard isNotificationsEnabled else {
            print("EndOfDaySummaryService: Notifications not enabled")
            return
        }

        // Remove existing notification
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [endOfDayNotificationId]
        )

        // Create notification content
        let content = UNMutableNotificationContent()
        content.title = "Daily Summary Ready"
        content.body = "Review your notes and reminders from today's sessions."
        content.sound = .default
        content.categoryIdentifier = "END_OF_DAY_SUMMARY"
        content.userInfo = ["type": "end_of_day_summary"]

        // Create trigger for the specified time daily
        let trigger = UNCalendarNotificationTrigger(
            dateMatching: summaryTime,
            repeats: true
        )

        // Create and schedule the request
        let request = UNNotificationRequest(
            identifier: endOfDayNotificationId,
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("EndOfDaySummaryService: Failed to schedule notification: \(error)")
            } else {
                print("EndOfDaySummaryService: Scheduled end-of-day notification for \(self.summaryTime.hour ?? 21):\(self.summaryTime.minute ?? 30)")
            }
        }

        // Register notification category with actions
        registerNotificationCategory()
    }

    private func registerNotificationCategory() {
        let viewAction = UNNotificationAction(
            identifier: "VIEW_SUMMARY",
            title: "View Summary",
            options: [.foreground]
        )

        let dismissAction = UNNotificationAction(
            identifier: "DISMISS",
            title: "Dismiss",
            options: []
        )

        let category = UNNotificationCategory(
            identifier: "END_OF_DAY_SUMMARY",
            actions: [viewAction, dismissAction],
            intentIdentifiers: [],
            options: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([category])
    }

    func cancelEndOfDayNotification() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(
            withIdentifiers: [endOfDayNotificationId]
        )
    }

    // MARK: - Summary Generation

    /// Generate the end-of-day summary for today (or a specific date)
    func generateSummary(for date: Date = Date()) -> DailySummary {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? date

        // Load all quick notes
        let allNotes = QuickNote.loadAll()

        // Filter notes from today
        let todaysNotes = allNotes.filter { note in
            note.recordedAt >= startOfDay && note.recordedAt < endOfDay
        }

        // Separate progress notes and reminders
        let progressNotes = todaysNotes.filter { $0.noteType == .progressNote }
        let reminders = todaysNotes.filter { $0.noteType == .reminder }

        // Also get reminders that are DUE today (even if recorded earlier)
        let remindersDueToday = allNotes.filter { note in
            note.noteType == .reminder &&
            !note.isCompleted &&
            note.status == .saved &&
            note.targetDate != nil &&
            calendar.isDate(note.targetDate!, inSameDayAs: date)
        }

        // Combine and deduplicate reminders
        var allRelevantReminders = Set(reminders.map { $0.id })
        let combinedReminders = reminders + remindersDueToday.filter { !allRelevantReminders.contains($0.id) }

        // Group by client
        var clientStats: [String: (name: String, notes: Int, reminders: Int)] = [:]

        for note in todaysNotes {
            if let clientId = note.clientId, let clientName = note.clientName {
                var stats = clientStats[clientId] ?? (name: clientName, notes: 0, reminders: 0)
                if note.noteType == .progressNote {
                    stats.notes += 1
                } else {
                    stats.reminders += 1
                }
                clientStats[clientId] = stats
            }
        }

        // Build summary
        let quickNoteSummaries = progressNotes.map { note in
            QuickNoteSummary(
                id: note.id,
                clientName: note.clientName,
                content: String(note.displayContent.prefix(200)),
                recordedAt: note.recordedAt,
                noteType: note.noteType.rawValue
            )
        }

        let reminderSummaries = combinedReminders.map { note in
            ReminderSummary(
                id: note.id,
                clientName: note.clientName,
                content: note.displayContent,
                dueDate: note.dueDate,
                isOverdue: note.isOverdue,
                linkedSessionDate: note.sessionDate
            )
        }

        let clientSummaries = clientStats.map { (clientId, stats) in
            ClientSummary(
                clientId: clientId,
                clientName: stats.name,
                notesCount: stats.notes,
                remindersCount: stats.reminders
            )
        }.sorted { $0.clientName < $1.clientName }

        let pendingCount = combinedReminders.filter { !$0.isCompleted }.count

        return DailySummary(
            date: date,
            quickNotes: quickNoteSummaries,
            reminders: reminderSummaries,
            clientsSeen: clientSummaries,
            totalNotes: todaysNotes.count,
            pendingReminders: pendingCount,
            generatedAt: Date()
        )
    }

    /// Check and show summary if we haven't shown one today
    func checkAndShowSummaryIfNeeded() {
        let today = Calendar.current.startOfDay(for: Date())

        // Check if we've already shown summary today
        if let lastDate = lastSummaryDate,
           Calendar.current.isDate(lastDate, inSameDayAs: today) {
            return
        }

        // Check if it's past the summary time
        let now = Date()
        let calendar = Calendar.current
        let currentHour = calendar.component(.hour, from: now)
        let currentMinute = calendar.component(.minute, from: now)
        let summaryHour = summaryTime.hour ?? 21
        let summaryMinute = summaryTime.minute ?? 30

        let isPastSummaryTime = currentHour > summaryHour ||
            (currentHour == summaryHour && currentMinute >= summaryMinute)

        if isPastSummaryTime {
            pendingSummary = generateSummary()
            lastSummaryDate = today
            UserDefaults.standard.set(today, forKey: lastSummaryKey)
        }
    }

    /// Mark summary as viewed
    func dismissSummary() {
        pendingSummary = nil
    }

    // MARK: - Quick Notes for Session Prep

    /// Get pending reminders and notes for a specific client's next session
    /// This is used to inject follow-up items into session prep
    func getFollowUpItemsForClient(clientId: String) -> [String] {
        let allNotes = QuickNote.loadAll()

        // Get all pending reminders for this client
        let pendingReminders = allNotes.filter { note in
            note.noteType == .reminder &&
            note.status == .saved &&
            !note.isCompleted &&
            note.clientId == clientId
        }

        // Format as follow-up items
        return pendingReminders.map { reminder in
            var item = reminder.displayContent
            if let dueDate = reminder.dueDate {
                let formatter = DateFormatter()
                formatter.dateStyle = .short
                item += " (due: \(formatter.string(from: dueDate)))"
            }
            return item
        }
    }

    /// Get all pending reminders with client info for session prep sync
    func getPendingRemindersForSync() -> [[String: Any]] {
        let allNotes = QuickNote.loadAll()

        let pending = allNotes.filter { note in
            note.noteType == .reminder &&
            note.status == .saved &&
            !note.isCompleted
        }

        return pending.map { reminder in
            var dict: [String: Any] = [
                "id": reminder.id,
                "content": reminder.displayContent,
                "recordedAt": ISO8601DateFormatter().string(from: reminder.recordedAt)
            ]
            if let clientId = reminder.clientId {
                dict["clientId"] = clientId
            }
            if let clientName = reminder.clientName {
                dict["clientName"] = clientName
            }
            if let dueDate = reminder.dueDate {
                dict["dueDate"] = ISO8601DateFormatter().string(from: dueDate)
            }
            if let sessionDate = reminder.sessionDate {
                dict["sessionDate"] = ISO8601DateFormatter().string(from: sessionDate)
            }
            if let sessionId = reminder.sessionId {
                dict["sessionId"] = sessionId
            }
            return dict
        }
    }
}

// MARK: - Notification Handling Extension

extension EndOfDaySummaryService: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        guard userInfo["type"] as? String == "end_of_day_summary" else {
            completionHandler()
            return
        }

        switch response.actionIdentifier {
        case "VIEW_SUMMARY", UNNotificationDefaultActionIdentifier:
            // Navigate to summary view
            Task { @MainActor in
                self.pendingSummary = self.generateSummary()
                // Post notification to show summary view
                NotificationCenter.default.post(
                    name: .showEndOfDaySummary,
                    object: nil
                )
            }
        case "DISMISS":
            // Just dismiss
            break
        default:
            break
        }

        completionHandler()
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let showEndOfDaySummary = Notification.Name("showEndOfDaySummary")
}
