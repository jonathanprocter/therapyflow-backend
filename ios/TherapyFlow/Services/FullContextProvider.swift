import Foundation

/// FullContextProvider - Provides comprehensive context about ALL clients and practice data
///
/// This service aggregates ALL data from the practice to give the AI assistant
/// complete awareness of:
/// - All clients and their details
/// - All sessions (past, upcoming, patterns)
/// - All progress notes and themes
/// - All treatment plans and goals
/// - Risk levels and alerts
/// - Appointment history
/// - Document summaries
/// - Calendar events (Google Calendar, SimplePractice, TherapyFlow)
/// - Scheduling and availability
@MainActor
class FullContextProvider: ObservableObject {
    static let shared = FullContextProvider()

    @Published var isLoading = false
    @Published var lastRefresh: Date?
    @Published var contextSummary: ContextSummary?

    // Cached full context for AI queries
    private var cachedContext: ComprehensiveContext?
    private var cacheExpiry: Date?
    private let cacheDuration: TimeInterval = 300 // 5 minutes

    private init() {
        // Don't refresh on init - let it be triggered when actually needed
        // This prevents blocking app startup
    }

    /// Ensure context is loaded (call this before first use)
    func ensureLoaded() async {
        if cachedContext == nil {
            await refreshContext()
        }
    }

    // MARK: - Types

    struct ContextSummary {
        let totalClients: Int
        let activeClients: Int
        let upcomingSessions: Int
        let pendingNotes: Int
        let highRiskClients: Int
        let upcomingCalendarEvents: Int
    }

    struct ComprehensiveContext {
        let clients: [ClientFullContext]
        let upcomingSessions: [SessionContext]
        let recentNotes: [NoteContext]
        let riskAlerts: [RiskAlertContext]
        let treatmentPlans: [TreatmentPlanContext]
        let calendarEvents: [CalendarEventContext]
        let practiceStats: PracticeStatsContext

        /// Generate a full text representation for AI context
        func toContextString() -> String {
            var context = """
            === THERAPYFLOW PRACTICE DATA ===
            Generated: \(DateFormatter.localizedString(from: Date(), dateStyle: .medium, timeStyle: .short))

            """

            // Practice stats
            context += """
            --- PRACTICE OVERVIEW ---
            Total Clients: \(practiceStats.totalClients)
            Active Clients: \(practiceStats.activeClients)
            Sessions This Week: \(practiceStats.sessionsThisWeek)
            Calendar Events This Week: \(practiceStats.calendarEventsThisWeek)
            Upcoming Calendar Events: \(practiceStats.upcomingCalendarEvents)
            Pending Notes: \(practiceStats.pendingNotes)
            High Risk Clients: \(practiceStats.highRiskClients)


            """

            // Risk alerts (most important)
            if !riskAlerts.isEmpty {
                context += "--- RISK ALERTS (PRIORITY) ---\n"
                for alert in riskAlerts {
                    context += """
                    ! \(alert.clientName) - \(alert.riskLevel.uppercased()) RISK
                      Factors: \(alert.riskFactors.joined(separator: ", "))
                      Last Assessment: \(alert.lastAssessmentDate)

                    """
                }
                context += "\n"
            }

            // Upcoming sessions
            if !upcomingSessions.isEmpty {
                context += "--- UPCOMING SESSIONS ---\n"
                for session in upcomingSessions.prefix(50) {  // Show more sessions
                    context += """
                    • \(session.clientName) - \(session.formattedDateTime)
                      Type: \(session.sessionType) | Duration: \(session.duration) min
                      \(session.prepNotes.isEmpty ? "" : "Prep: \(session.prepNotes)")

                    """
                }
                context += "\n"
            }

            // Calendar events (all sources)
            if !calendarEvents.isEmpty {
                context += "--- CALENDAR & APPOINTMENTS ---\n"

                // Group by date for better readability
                let groupedEvents = Dictionary(grouping: calendarEvents) { event -> String in
                    let formatter = DateFormatter()
                    formatter.dateStyle = .medium
                    formatter.timeStyle = .none
                    return formatter.string(from: event.startTime)
                }

                let sortedDates = groupedEvents.keys.sorted { date1, date2 in
                    let formatter = DateFormatter()
                    formatter.dateStyle = .medium
                    formatter.timeStyle = .none
                    guard let d1 = formatter.date(from: date1),
                          let d2 = formatter.date(from: date2) else { return date1 < date2 }
                    return d1 < d2
                }

                for date in sortedDates.prefix(14) {  // Show 2 weeks
                    context += "\n[\(date)]\n"
                    if let events = groupedEvents[date] {
                        for event in events.sorted(by: { $0.startTime < $1.startTime }) {
                            var eventLine = "  • \(event.title)"
                            if !event.isAllDay {
                                let timeFormatter = DateFormatter()
                                timeFormatter.timeStyle = .short
                                eventLine += " @ \(timeFormatter.string(from: event.startTime))"
                            }
                            eventLine += " (\(event.sourceDisplayName))"
                            context += eventLine + "\n"

                            if let clientName = event.linkedClientName {
                                context += "    Client: \(clientName)\n"
                            }
                            if let location = event.location, !location.isEmpty {
                                context += "    Location: \(location)\n"
                            }
                            if !event.attendees.isEmpty {
                                context += "    Attendees: \(event.attendees.joined(separator: ", "))\n"
                            }
                            if event.isRecurring {
                                context += "    (Recurring event)\n"
                            }
                        }
                    }
                }
                context += "\n"
            }

            // All clients with full details
            context += "--- CLIENT DATABASE ---\n"
            for client in clients {
                context += """
                [\(client.name)] (ID: \(client.id))
                  Status: \(client.status)
                  Contact: \(client.email ?? "No email") | \(client.phone ?? "No phone")
                  Tags: \(client.tags.isEmpty ? "None" : client.tags.joined(separator: ", "))
                  Clinical Considerations: \(client.clinicalConsiderations.isEmpty ? "None" : client.clinicalConsiderations.joined(separator: ", "))
                  Preferred Modalities: \(client.preferredModalities.isEmpty ? "None" : client.preferredModalities.joined(separator: ", "))
                  Total Sessions: \(client.totalSessions)
                  Last Session: \(client.lastSessionDate ?? "Never")
                  Next Session: \(client.nextSessionDate ?? "Not scheduled")
                  Risk Level: \(client.currentRiskLevel)

                """

                // Recent session themes for this client
                if !client.recentThemes.isEmpty {
                    context += "  Recent Themes: \(client.recentThemes.joined(separator: ", "))\n"
                }

                // All progress notes for this client (up to 20 per client for context)
                if !client.recentNotes.isEmpty {
                    context += "  Session History:\n"
                    for note in client.recentNotes.prefix(20) {
                        context += "    - \(note.date): \(note.summary)\n"
                        if !note.themes.isEmpty {
                            context += "      Themes: \(note.themes.joined(separator: ", "))\n"
                        }
                    }
                }

                // Treatment plan if active
                if let plan = client.activeTreatmentPlan {
                    context += "  Treatment Plan: \(plan.diagnosis ?? "Not specified")\n"
                    context += "    Goals:\n"
                    for goal in plan.goals.prefix(3) {
                        context += "      • \(goal.description) (\(goal.status))\n"
                    }
                }

                context += "\n"
            }

            // Treatment plans overview
            if !treatmentPlans.isEmpty {
                context += "--- TREATMENT PLANS ---\n"
                for plan in treatmentPlans {
                    context += """
                    \(plan.clientName):
                      Diagnosis: \(plan.diagnosis ?? "Not specified")
                      Status: \(plan.status)
                      Active Goals: \(plan.activeGoalsCount)
                      Start Date: \(plan.startDate)

                    """
                }
            }

            return context
        }

        /// Generate context focused on a specific client
        func toClientFocusedContext(clientId: String) -> String {
            guard let client = clients.first(where: { $0.id == clientId }) else {
                return toContextString() // Fall back to full context
            }

            var context = """
            === CLIENT FOCUS: \(client.name) ===
            Generated: \(DateFormatter.localizedString(from: Date(), dateStyle: .medium, timeStyle: .short))

            --- CLIENT DETAILS ---
            Name: \(client.name)
            ID: \(client.id)
            Status: \(client.status)
            Email: \(client.email ?? "Not provided")
            Phone: \(client.phone ?? "Not provided")
            Tags: \(client.tags.isEmpty ? "None" : client.tags.joined(separator: ", "))

            Clinical Considerations: \(client.clinicalConsiderations.isEmpty ? "None" : client.clinicalConsiderations.joined(separator: ", "))
            Preferred Modalities: \(client.preferredModalities.isEmpty ? "None" : client.preferredModalities.joined(separator: ", "))

            --- SESSION HISTORY ---
            Total Sessions: \(client.totalSessions)
            Last Session: \(client.lastSessionDate ?? "Never")
            Next Session: \(client.nextSessionDate ?? "Not scheduled")
            Current Risk Level: \(client.currentRiskLevel)


            """

            // All progress notes for this client
            if !client.recentNotes.isEmpty {
                context += "--- SESSION NOTES (Most Recent First) ---\n"
                for note in client.recentNotes {
                    context += """
                    [\(note.date)]
                    \(note.summary)
                    Risk Level: \(note.riskLevel)
                    Themes: \(note.themes.joined(separator: ", "))

                    """
                }
            }

            // Treatment plan details
            if let plan = client.activeTreatmentPlan {
                context += """
                --- ACTIVE TREATMENT PLAN ---
                Diagnosis: \(plan.diagnosis ?? "Not specified")
                Status: \(plan.status)
                Start Date: \(plan.startDate)

                Goals:

                """
                for goal in plan.goals {
                    context += """
                    • \(goal.description)
                      Status: \(goal.status)
                      Target Date: \(goal.targetDate ?? "Not set")
                      Progress: \(goal.progressNotes ?? "No notes")

                    """
                }
            }

            // Upcoming sessions
            let clientSessions = upcomingSessions.filter { $0.clientId == clientId }
            if !clientSessions.isEmpty {
                context += "--- UPCOMING SESSIONS ---\n"
                for session in clientSessions {
                    context += "• \(session.formattedDateTime) - \(session.sessionType) (\(session.duration) min)\n"
                }
            }

            return context
        }
    }

    struct ClientFullContext {
        let id: String
        let name: String
        let status: String
        let email: String?
        let phone: String?
        let tags: [String]
        let clinicalConsiderations: [String]
        let preferredModalities: [String]
        let totalSessions: Int
        let lastSessionDate: String?
        let nextSessionDate: String?
        let currentRiskLevel: String
        let recentThemes: [String]
        let recentNotes: [NoteContext]
        let activeTreatmentPlan: TreatmentPlanContext?
    }

    struct SessionContext {
        let id: String
        let clientId: String
        let clientName: String
        let scheduledAt: Date
        let duration: Int
        let sessionType: String
        let status: String
        let prepNotes: String

        var formattedDateTime: String {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .short
            return formatter.string(from: scheduledAt)
        }
    }

    struct NoteContext {
        let id: String
        let clientId: String
        let clientName: String
        let date: String
        let summary: String
        let riskLevel: String
        let themes: [String]
    }

    struct RiskAlertContext {
        let clientId: String
        let clientName: String
        let riskLevel: String
        let riskFactors: [String]
        let lastAssessmentDate: String
    }

    struct TreatmentPlanContext {
        let id: String
        let clientId: String
        let clientName: String
        let diagnosis: String?
        let status: String
        let startDate: String
        let goals: [GoalContext]
        let activeGoalsCount: Int
    }

    struct GoalContext {
        let id: String
        let description: String
        let status: String
        let targetDate: String?
        let progressNotes: String?
    }

    struct PracticeStatsContext {
        let totalClients: Int
        let activeClients: Int
        let sessionsThisWeek: Int
        let pendingNotes: Int
        let highRiskClients: Int
        let calendarEventsThisWeek: Int
        let upcomingCalendarEvents: Int
    }

    struct CalendarEventContext {
        let id: String
        let title: String
        let source: String  // "google", "simplePractice", "therapyFlow"
        let startTime: Date
        let endTime: Date
        let isAllDay: Bool
        let location: String?
        let description: String?
        let attendees: [String]
        let linkedClientId: String?
        let linkedClientName: String?
        let linkedSessionId: String?
        let isRecurring: Bool

        var formattedDateTime: String {
            let formatter = DateFormatter()
            if isAllDay {
                formatter.dateStyle = .medium
                formatter.timeStyle = .none
                return "\(formatter.string(from: startTime)) (All Day)"
            } else {
                formatter.dateStyle = .medium
                formatter.timeStyle = .short
                return formatter.string(from: startTime)
            }
        }

        var duration: String {
            let interval = endTime.timeIntervalSince(startTime)
            let hours = Int(interval) / 3600
            let minutes = (Int(interval) % 3600) / 60
            if hours > 0 {
                return "\(hours)h \(minutes)m"
            } else {
                return "\(minutes) min"
            }
        }

        var sourceDisplayName: String {
            switch source.lowercased() {
            case "google": return "Google Calendar"
            case "simplepractice": return "SimplePractice"
            case "therapyflow": return "TherapyFlow"
            default: return source
            }
        }
    }

    // MARK: - Quick Context Types (for OpenAI fast queries)

    struct QuickStats {
        let activeClients: Int
        let sessionsToday: Int
        let sessionsThisWeek: Int
        let pendingNotes: Int
    }

    struct ClientBasicInfo {
        let name: String
        let status: String
        let nextSession: String?
    }

    struct TodaySessionInfo {
        let time: String
        let clientName: String
    }

    // MARK: - Quick Context Methods (fast, cached)

    /// Get quick stats from cache (no API calls)
    func getQuickStats() async -> QuickStats {
        if let summary = contextSummary {
            // Get sessions today from cached context
            let todaySessions = cachedContext?.upcomingSessions.filter {
                Calendar.current.isDateInToday($0.scheduledAt)
            }.count ?? 0

            return QuickStats(
                activeClients: summary.activeClients,
                sessionsToday: todaySessions,
                sessionsThisWeek: summary.upcomingSessions,
                pendingNotes: summary.pendingNotes
            )
        }

        // Fallback if no cache
        return QuickStats(activeClients: 0, sessionsToday: 0, sessionsThisWeek: 0, pendingNotes: 0)
    }

    /// Get basic client info from cache (no API calls)
    func getClientBasicInfo(clientId: String) async -> ClientBasicInfo? {
        guard let context = cachedContext,
              let client = context.clients.first(where: { $0.id == clientId }) else {
            return nil
        }

        return ClientBasicInfo(
            name: client.name,
            status: client.status,
            nextSession: client.nextSessionDate
        )
    }

    /// Get today's schedule from cache (no API calls)
    func getTodaySchedule() async -> [TodaySessionInfo] {
        guard let context = cachedContext else { return [] }

        let todaySessions = context.upcomingSessions.filter {
            Calendar.current.isDateInToday($0.scheduledAt)
        }.sorted { $0.scheduledAt < $1.scheduledAt }

        let timeFormatter = DateFormatter()
        timeFormatter.timeStyle = .short

        return todaySessions.map { session in
            TodaySessionInfo(
                time: timeFormatter.string(from: session.scheduledAt),
                clientName: session.clientName
            )
        }
    }

    // MARK: - Public Methods

    /// Get full context for AI queries (uses cache if valid)
    func getFullContext() async -> ComprehensiveContext? {
        // Check cache
        if let cached = cachedContext,
           let expiry = cacheExpiry,
           Date() < expiry {
            return cached
        }

        // Refresh cache (but don't block if already loading)
        if !isLoading {
            await refreshContext()
        }
        return cachedContext
    }

    /// Start loading context in background (non-blocking)
    func startBackgroundLoad() {
        guard cachedContext == nil && !isLoading else { return }

        Task {
            await refreshContext()
        }
    }

    /// Get context focused on a specific client
    func getClientContext(clientId: String) async -> String {
        guard let context = await getFullContext() else {
            return "Unable to load client context. Please try again."
        }
        return context.toClientFocusedContext(clientId: clientId)
    }

    /// Get full context as a string for AI
    func getFullContextString() async -> String {
        guard let context = await getFullContext() else {
            return "Unable to load practice context. Please try again."
        }
        return context.toContextString()
    }

    /// Force refresh the context
    func refreshContext() async {
        isLoading = true
        defer { isLoading = false }

        do {
            // Calculate date range for calendar events (past week to 30 days ahead)
            let pastWeek = Date().addingTimeInterval(-7 * 24 * 60 * 60)
            let thirtyDaysAhead = Date().addingTimeInterval(30 * 24 * 60 * 60)

            // Fetch ALL data in parallel - no artificial limits
            async let clientsTask = APIClient.shared.getClients()
            async let sessionsTask = APIClient.shared.getSessions(upcoming: false, limit: 500, includePast: true)  // Get all sessions
            async let notesTask = APIClient.shared.getProgressNotes(recent: false, limit: 1000)  // Get all notes
            async let treatmentPlansTask = APIClient.shared.getTreatmentPlans()
            async let calendarEventsTask = APIClient.shared.getCalendarEvents(
                startDate: pastWeek,
                endDate: thirtyDaysAhead
            )

            let clients = try await clientsTask
            let sessions = try await sessionsTask
            let notes = try await notesTask
            let treatmentPlans = (try? await treatmentPlansTask) ?? []
            let calendarEvents = (try? await calendarEventsTask) ?? []

            // Build comprehensive context
            let context = buildComprehensiveContext(
                clients: clients,
                sessions: sessions,
                notes: notes,
                treatmentPlans: treatmentPlans,
                calendarEvents: calendarEvents
            )

            cachedContext = context
            cacheExpiry = Date().addingTimeInterval(cacheDuration)
            lastRefresh = Date()

            // Update summary
            contextSummary = ContextSummary(
                totalClients: clients.count,
                activeClients: clients.filter { $0.status == .active }.count,
                upcomingSessions: sessions.filter { $0.scheduledAt > Date() }.count,
                pendingNotes: notes.filter { $0.status == .placeholder || $0.status == .manualReview }.count,
                highRiskClients: Set(notes.filter { $0.riskLevel >= .high }.map { $0.clientId }).count,
                upcomingCalendarEvents: calendarEvents.filter { $0.startTime > Date() }.count
            )

        } catch {
            print("FullContextProvider: Failed to refresh context: \(error.localizedDescription)")
        }
    }

    // MARK: - Private Methods

    private func buildComprehensiveContext(
        clients: [Client],
        sessions: [Session],
        notes: [ProgressNote],
        treatmentPlans: [TreatmentPlan],
        calendarEvents: [SyncedCalendarEvent] = []
    ) -> ComprehensiveContext {
        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium
        dateFormatter.timeStyle = .none

        // Build client contexts with full detail
        let clientContexts: [ClientFullContext] = clients.map { client in
            let clientNotes = notes.filter { $0.clientId == client.id }
                .sorted { $0.sessionDate > $1.sessionDate }

            let clientSessions = sessions.filter { $0.clientId == client.id }
            let pastSessions = clientSessions.filter { $0.scheduledAt < Date() }
            let futureSessions = clientSessions.filter { $0.scheduledAt >= Date() }
                .sorted { $0.scheduledAt < $1.scheduledAt }

            let clientPlan = treatmentPlans.first { $0.clientId == client.id && $0.status == .active }

            // Extract themes from all notes for this client
            let recentThemes = Array(Set(clientNotes.prefix(20).flatMap { $0.allTags })).prefix(20)

            // Determine current risk level
            let currentRiskLevel = clientNotes.first?.riskLevel.displayName ?? "Not assessed"

            // Build note contexts - get all notes for this client (up to 50)
            let noteContexts: [NoteContext] = clientNotes.prefix(50).map { note in
                NoteContext(
                    id: note.id,
                    clientId: note.clientId,
                    clientName: client.name,
                    date: dateFormatter.string(from: note.sessionDate),
                    summary: note.contentPreview,
                    riskLevel: note.riskLevel.displayName,
                    themes: note.allTags
                )
            }

            // Build treatment plan context
            var planContext: TreatmentPlanContext?
            if let plan = clientPlan {
                let goalContexts: [GoalContext] = plan.goals.map { goal in
                    GoalContext(
                        id: goal.id,
                        description: goal.description,
                        status: goal.status.rawValue,
                        targetDate: goal.targetDate.map { dateFormatter.string(from: $0) },
                        progressNotes: goal.progress.map { "Progress: \(Int($0))%" }
                    )
                }

                planContext = TreatmentPlanContext(
                    id: plan.id,
                    clientId: plan.clientId,
                    clientName: client.name,
                    diagnosis: plan.diagnosis,
                    status: plan.status.rawValue,
                    startDate: dateFormatter.string(from: plan.startDate),
                    goals: goalContexts,
                    activeGoalsCount: plan.goals.filter { $0.status == .inProgress }.count
                )
            }

            return ClientFullContext(
                id: client.id,
                name: client.name,
                status: client.status.displayName,
                email: client.email,
                phone: client.phone,
                tags: client.tags,
                clinicalConsiderations: client.clinicalConsiderations,
                preferredModalities: client.preferredModalities,
                totalSessions: pastSessions.count,
                lastSessionDate: pastSessions.first.map { dateFormatter.string(from: $0.scheduledAt) },
                nextSessionDate: futureSessions.first.map { dateFormatter.string(from: $0.scheduledAt) },
                currentRiskLevel: currentRiskLevel,
                recentThemes: Array(recentThemes),
                recentNotes: noteContexts,
                activeTreatmentPlan: planContext
            )
        }

        // Build session contexts - get all upcoming sessions
        let upcomingSessionContexts: [SessionContext] = sessions
            .filter { $0.scheduledAt > Date() }
            .sorted { $0.scheduledAt < $1.scheduledAt }
            .prefix(100)  // Allow up to 100 upcoming sessions
            .map { session in
                let clientName = clients.first(where: { $0.id == session.clientId })?.name ?? "Unknown"
                return SessionContext(
                    id: session.id,
                    clientId: session.clientId,
                    clientName: clientName,
                    scheduledAt: session.scheduledAt,
                    duration: session.duration,
                    sessionType: session.sessionType.displayName,
                    status: session.status.displayName,
                    prepNotes: session.notes ?? ""
                )
            }

        // Build note contexts (recent across all clients) - get more notes
        let recentNoteContexts: [NoteContext] = notes
            .sorted { $0.sessionDate > $1.sessionDate }
            .prefix(100)  // Include more recent notes in context
            .map { note in
                let clientName = clients.first(where: { $0.id == note.clientId })?.name ?? note.clientName ?? "Unknown"
                return NoteContext(
                    id: note.id,
                    clientId: note.clientId,
                    clientName: clientName,
                    date: dateFormatter.string(from: note.sessionDate),
                    summary: note.contentPreview,
                    riskLevel: note.riskLevel.displayName,
                    themes: note.allTags
                )
            }

        // Build risk alerts
        let riskAlerts: [RiskAlertContext] = notes
            .filter { $0.riskLevel >= .high }
            .sorted { $0.sessionDate > $1.sessionDate }
            .prefix(10)
            .map { note in
                let clientName = clients.first(where: { $0.id == note.clientId })?.name ?? note.clientName ?? "Unknown"
                return RiskAlertContext(
                    clientId: note.clientId,
                    clientName: clientName,
                    riskLevel: note.riskLevel.displayName,
                    riskFactors: note.allTags.filter { $0.lowercased().contains("risk") || $0.lowercased().contains("safety") },
                    lastAssessmentDate: dateFormatter.string(from: note.sessionDate)
                )
            }

        // Build treatment plan contexts
        let treatmentPlanContexts: [TreatmentPlanContext] = treatmentPlans.map { plan in
            let clientName = clients.first(where: { $0.id == plan.clientId })?.name ?? plan.clientName ?? "Unknown"
            let goalContexts: [GoalContext] = plan.goals.map { goal in
                GoalContext(
                    id: goal.id,
                    description: goal.description,
                    status: goal.status.rawValue,
                    targetDate: goal.targetDate.map { dateFormatter.string(from: $0) },
                    progressNotes: goal.progress.map { "Progress: \(Int($0))%" }
                )
            }
            return TreatmentPlanContext(
                id: plan.id,
                clientId: plan.clientId,
                clientName: clientName,
                diagnosis: plan.diagnosis,
                status: plan.status.rawValue,
                startDate: dateFormatter.string(from: plan.startDate),
                goals: goalContexts,
                activeGoalsCount: plan.goals.filter { $0.status == .inProgress }.count
            )
        }

        // Build calendar event contexts
        let calendarEventContexts: [CalendarEventContext] = calendarEvents
            .filter { $0.startTime > Date().addingTimeInterval(-24 * 60 * 60) }  // Include events from yesterday onward
            .sorted { $0.startTime < $1.startTime }
            .map { event in
                let linkedClientName = event.linkedClientId.flatMap { clientId in
                    clients.first(where: { $0.id == clientId })?.name
                }

                return CalendarEventContext(
                    id: event.id,
                    title: event.title,
                    source: event.source,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    isAllDay: event.isAllDay,
                    location: event.location,
                    description: event.description,
                    attendees: event.attendees ?? [],
                    linkedClientId: event.linkedClientId,
                    linkedClientName: linkedClientName,
                    linkedSessionId: event.linkedSessionId,
                    isRecurring: event.isRecurring
                )
            }

        // Build practice stats
        let activeClients = clients.filter { $0.status == .active }
        let thisWeekStart = Calendar.current.startOfWeek(for: Date())
        let thisWeekEnd = Calendar.current.date(byAdding: .day, value: 7, to: thisWeekStart) ?? Date()
        let thisWeekSessions = sessions.filter { $0.scheduledAt >= thisWeekStart }
        let thisWeekCalendarEvents = calendarEvents.filter { $0.startTime >= thisWeekStart && $0.startTime < thisWeekEnd }
        let upcomingCalendarEvents = calendarEvents.filter { $0.startTime >= Date() }
        let pendingNotes = notes.filter { $0.status == .placeholder || $0.status == .manualReview }
        let highRiskClients = Set(notes.filter { $0.riskLevel >= .high }.map { $0.clientId })

        let practiceStats = PracticeStatsContext(
            totalClients: clients.count,
            activeClients: activeClients.count,
            sessionsThisWeek: thisWeekSessions.count,
            pendingNotes: pendingNotes.count,
            highRiskClients: highRiskClients.count,
            calendarEventsThisWeek: thisWeekCalendarEvents.count,
            upcomingCalendarEvents: upcomingCalendarEvents.count
        )

        return ComprehensiveContext(
            clients: clientContexts,
            upcomingSessions: Array(upcomingSessionContexts),
            recentNotes: Array(recentNoteContexts),
            riskAlerts: Array(riskAlerts),
            treatmentPlans: treatmentPlanContexts,
            calendarEvents: calendarEventContexts,
            practiceStats: practiceStats
        )
    }
}

// MARK: - Calendar Extension

extension Calendar {
    func startOfWeek(for date: Date) -> Date {
        let components = dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        return self.date(from: components) ?? date
    }
}
