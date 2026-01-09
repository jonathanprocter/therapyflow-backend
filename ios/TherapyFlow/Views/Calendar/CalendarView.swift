import SwiftUI

struct CalendarView: View {
    @State private var selectedDate = Date()
    @State private var currentMonth = Date()
    @State private var sessions: [Session] = []
    @State private var calendarEvents: [SyncedCalendarEvent] = []
    @State private var isLoading = true
    @State private var isSyncing = false
    @State private var error: Error?
    @State private var showingCreateSession = false
    @State private var googleCalendarStatus: String = ""
    @State private var lastSyncTime: Date?
    @State private var loadTask: Task<Void, Never>?

    @ObservedObject private var integrationsService = IntegrationsService.shared
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var sessionsForSelectedDate: [Session] {
        sessions.filter { $0.scheduledAt.isSameDay(as: selectedDate) }
            .sorted { $0.scheduledAt < $1.scheduledAt }
    }

    private var unlinkedCalendarEvents: [SyncedCalendarEvent] {
        let sessionIds = Set(sessions.map { $0.id })
        return calendarEvents.filter { event in
            guard let linkedSessionId = event.linkedSessionId else { return true }
            return !sessionIds.contains(linkedSessionId)
        }
    }

    var upcomingSessions: [Session] {
        sessions.filter { $0.scheduledAt >= Date() && $0.status == .scheduled }
            .sorted { $0.scheduledAt < $1.scheduledAt }
    }

    // Combined count for calendar display
    func eventCountForDate(_ date: Date) -> Int {
        let sessionCount = sessions.filter { $0.scheduledAt.isSameDay(as: date) }.count
        let eventCount = unlinkedCalendarEvents.filter { $0.startTime.isSameDay(as: date) }.count
        return sessionCount + eventCount
    }

    var body: some View {
        VStack(spacing: 0) {
            if horizontalSizeClass == .regular {
                // iPad: Side by side layout
                HStack(spacing: 0) {
                    CalendarSectionView(
                        selectedDate: $selectedDate,
                        currentMonth: currentMonth,
                        isSyncing: isSyncing,
                        googleCalendarConnected: integrationsService.googleCalendarConnected,
                        googleCalendarStatus: googleCalendarStatus,
                        eventCountForDate: eventCountForDate,
                        onPreviousMonth: previousMonth,
                        onNextMonth: nextMonth,
                        onSync: forceSync
                    )
                        .frame(maxWidth: .infinity)
                        .padding()

                    Divider()

                    SessionsPanelView(
                        selectedDate: selectedDate,
                        sessions: sessionsForSelectedDate,
                        calendarEvents: unlinkedCalendarEvents.filter { $0.startTime.isSameDay(as: selectedDate) },
                        onCreateSession: { showingCreateSession = true }
                    )
                        .frame(width: 350)
                }
            } else {
                // iPhone: Stacked layout
                ScrollView {
                    VStack(spacing: 24) {
                        CalendarSectionView(
                            selectedDate: $selectedDate,
                            currentMonth: currentMonth,
                            isSyncing: isSyncing,
                            googleCalendarConnected: integrationsService.googleCalendarConnected,
                            googleCalendarStatus: googleCalendarStatus,
                            eventCountForDate: eventCountForDate,
                            onPreviousMonth: previousMonth,
                            onNextMonth: nextMonth,
                            onSync: forceSync
                        )
                        SelectedDateSectionView(
                            selectedDate: selectedDate,
                            sessions: sessionsForSelectedDate,
                            calendarEvents: unlinkedCalendarEvents.filter { $0.startTime.isSameDay(as: selectedDate) },
                            onCreateSession: { showingCreateSession = true }
                        )
                        UpcomingSectionView(sessions: upcomingSessions)
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Calendar")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingCreateSession = true }) {
                    Image(systemName: "plus")
                }
            }

            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: { currentMonth = Date() }) {
                    Text("Today")
                        .font(.subheadline)
                }
            }
        }
        .sheet(isPresented: $showingCreateSession) {
            NavigationStack {
                SessionFormView(initialDate: selectedDate) { newSession in
                    sessions.append(newSession)
                    showingCreateSession = false
                }
            }
        }
        .refreshable {
            await loadSessionsAsync()
        }
        .onAppear {
            // Update AI context for calendar
            ContextualAIAssistant.shared.updateContext(.calendar)

            // Cancel any existing task to prevent duplicates
            loadTask?.cancel()
            loadTask = Task {
                await loadSessionsAsync()
            }
        }
        .onChange(of: integrationsService.googleCalendarConnected) { _, isConnected in
            guard isConnected else { return }
            loadTask?.cancel()
            loadTask = Task {
                await loadSessionsAsync()
            }
        }
        .onDisappear {
            // Cancel the task when view disappears to prevent -999 errors
            loadTask?.cancel()
            loadTask = nil
        }
    }

    // MARK: - Navigation
    private func previousMonth() {
        currentMonth = currentMonth.adding(months: -1)
    }

    private func nextMonth() {
        currentMonth = currentMonth.adding(months: 1)
    }

    // MARK: - Data Loading
    private func loadSessionsAsync() async {
        // Check if cancelled before starting
        guard !Task.isCancelled else { return }

        isLoading = true
        error = nil
        googleCalendarStatus = "Loading..."

        // First, load from database for instant display
        async let localSessionsTask = loadLocalSessions()
        async let cachedEventsTask = loadCachedCalendarEvents()

        let fetchedSessions = await localSessionsTask
        let cachedEvents = await cachedEventsTask

        // Check if cancelled before updating UI
        guard !Task.isCancelled else { return }

        await MainActor.run {
            sessions = fetchedSessions
            calendarEvents = cachedEvents

            if !cachedEvents.isEmpty {
                googleCalendarStatus = "\(cachedEvents.count) events (cached)"
            }

            isLoading = false
        }

        // Then sync with Google Calendar in the background
        if integrationsService.googleCalendarConnected {
            await syncWithGoogleCalendar()
        }
    }

    private func loadLocalSessions() async -> [Session] {
        do {
            return try await APIClient.shared.getSessions()
        } catch is CancellationError {
            return []
        } catch let urlError as URLError where urlError.code == .cancelled {
            // Silently handle cancelled requests
            return []
        } catch {
            print("Failed to load local sessions: \(error)")
            return []
        }
    }

    /// Load calendar events from the cache (stored from previous syncs)
    private func loadCachedCalendarEvents() async -> [SyncedCalendarEvent] {
        // Use SyncService's cached calendar events
        let cachedEvents = await SyncService.shared.getCachedCalendarEvents()

        // Check if cache is stale and needs refresh
        let isFresh = await SyncService.shared.isCachedCalendarEventsFresh()
        if !isFresh && integrationsService.googleCalendarConnected {
            // Trigger background refresh
            Task {
                try? await SyncService.shared.refreshCalendarEventsCache()
            }
        }

        return cachedEvents
    }

    /// Sync calendar events with Google Calendar and update the database
    private func syncWithGoogleCalendar() async {
        guard integrationsService.googleCalendarConnected else {
            print("Google Calendar not connected")
            return
        }

        // Check if cancelled
        guard !Task.isCancelled else { return }

        await MainActor.run {
            isSyncing = true
            googleCalendarStatus = "Syncing..."
        }

        do {
            // Get events for current month and surrounding weeks
            let startDate = currentMonth.startOfMonth.adding(days: -7)
            let endDate = currentMonth.endOfMonth.adding(days: 7)
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)

            let startString = formatter.string(from: startDate)
            let endString = formatter.string(from: endDate)

            print("Syncing calendar events from \(startString) to \(endString)")
            _ = try await APIClient.shared.syncCalendar(startDate: startString, endDate: endString)

            let synced = try await APIClient.shared.getCalendarEvents(startDate: startDate, endDate: endDate)
            let refreshedSessions = try await APIClient.shared.getSessions()

            try? await SyncService.shared.refreshCalendarEventsCache()

            // Check if cancelled before updating UI
            guard !Task.isCancelled else { return }

            await MainActor.run {
                calendarEvents = synced
                sessions = refreshedSessions
                lastSyncTime = Date()
                isSyncing = false

                if synced.isEmpty {
                    googleCalendarStatus = "No events found"
                } else {
                    googleCalendarStatus = "\(synced.count) events"
                }
            }
        } catch is CancellationError {
            print("Google Calendar sync cancelled")
            await MainActor.run {
                isSyncing = false
            }
        } catch let urlError as URLError where urlError.code == .cancelled {
            // Silently handle cancelled requests
            await MainActor.run {
                isSyncing = false
            }
        } catch let error as APIError {
            print("API error syncing calendar: \(error.localizedDescription)")
            await MainActor.run {
                isSyncing = false
                googleCalendarStatus = "Sync error (using cached)"
            }
        } catch {
            print("Failed to sync Google Calendar: \(error)")
            await MainActor.run {
                isSyncing = false
                googleCalendarStatus = "Sync error (using cached)"
            }
        }
    }

    /// Force a full sync with Google Calendar
    private func forceSync() {
        Task {
            await syncWithGoogleCalendar()
        }
    }
}

#Preview {
    NavigationStack {
        CalendarView()
    }
}
