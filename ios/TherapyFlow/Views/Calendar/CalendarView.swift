import SwiftUI

struct CalendarView: View {
    @State private var selectedDate = Date()
    @State private var currentMonth = Date()
    @State private var sessions: [Session] = []
    @State private var calendarEvents: [CalendarEvent] = []
    @State private var syncedEvents: [SyncedCalendarEvent] = [] // Database-synced events
    @State private var isLoading = true
    @State private var isSyncing = false
    @State private var error: Error?
    @State private var showingCreateSession = false
    @State private var googleCalendarStatus: String = ""
    @State private var lastSyncTime: Date?
    @State private var loadTask: Task<Void, Never>?

    @StateObject private var integrationsService = IntegrationsService.shared
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var sessionsForSelectedDate: [Session] {
        sessions.filter { $0.scheduledAt.isSameDay(as: selectedDate) }
            .sorted { $0.scheduledAt < $1.scheduledAt }
    }

    var calendarEventsForSelectedDate: [CalendarEvent] {
        calendarEvents.filter { $0.startTime.isSameDay(as: selectedDate) }
            .sorted { $0.startTime < $1.startTime }
    }

    var upcomingSessions: [Session] {
        sessions.filter { $0.scheduledAt >= Date() && $0.status == .scheduled }
            .sorted { $0.scheduledAt < $1.scheduledAt }
    }

    var upcomingCalendarEvents: [CalendarEvent] {
        calendarEvents.filter { $0.startTime >= Date() }
            .sorted { $0.startTime < $1.startTime }
    }

    // Combined count for calendar display
    func eventCountForDate(_ date: Date) -> Int {
        let sessionCount = sessions.filter { $0.scheduledAt.isSameDay(as: date) }.count
        let eventCount = calendarEvents.filter { $0.startTime.isSameDay(as: date) }.count
        return sessionCount + eventCount
    }

    func hasEventsForDate(_ date: Date) -> Bool {
        eventCountForDate(date) > 0
    }

    var body: some View {
        VStack(spacing: 0) {
            if horizontalSizeClass == .regular {
                // iPad: Side by side layout
                HStack(spacing: 0) {
                    calendarSection
                        .frame(maxWidth: .infinity)
                        .padding()

                    Divider()

                    sessionsPanel
                        .frame(width: 350)
                }
            } else {
                // iPhone: Stacked layout
                ScrollView {
                    VStack(spacing: 24) {
                        calendarSection
                        selectedDateSection
                        upcomingSection
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
            // Cancel any existing task to prevent duplicates
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

    // MARK: - Calendar Section
    private var calendarSection: some View {
        VStack(spacing: 16) {
            // Month navigation
            HStack {
                Button(action: previousMonth) {
                    Image(systemName: "chevron.left")
                        .font(.title3)
                        .foregroundColor(Color.theme.primary)
                }

                Spacer()

                Text(currentMonth.monthYear)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                Button(action: nextMonth) {
                    Image(systemName: "chevron.right")
                        .font(.title3)
                        .foregroundColor(Color.theme.primary)
                }
            }
            .padding(.horizontal)

            // Day names (Monday first)
            HStack(spacing: 0) {
                ForEach(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], id: \.self) { day in
                    Text(day)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.secondaryText)
                        .frame(maxWidth: .infinity)
                }
            }

            // Calendar grid
            let weeks = Date.weeksInMonth(for: currentMonth)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 8) {
                ForEach(0..<weeks.count, id: \.self) { weekIndex in
                    ForEach(0..<7, id: \.self) { dayIndex in
                        if let date = weeks[weekIndex][dayIndex] {
                            CalendarDayCell(
                                date: date,
                                isSelected: date.isSameDay(as: selectedDate),
                                hasSession: hasEventsForDate(date),
                                sessionCount: eventCountForDate(date)
                            ) {
                                selectedDate = date
                            }
                        } else {
                            Color.clear
                                .frame(height: 44)
                        }
                    }
                }
            }

            // Google Calendar connection status
            if integrationsService.googleCalendarConnected {
                HStack(spacing: 8) {
                    HStack(spacing: 4) {
                        if isSyncing {
                            ProgressView()
                                .scaleEffect(0.6)
                        } else {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption2)
                                .foregroundColor(Color.theme.success)
                        }
                        Text("Google Calendar")
                            .font(.caption2)
                            .foregroundColor(Color.theme.secondaryText)
                        if !googleCalendarStatus.isEmpty {
                            Text("• \(googleCalendarStatus)")
                                .font(.caption2)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }

                    Spacer()

                    // Sync button
                    Button(action: forceSync) {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.caption2)
                            Text("Sync")
                                .font(.caption2)
                        }
                        .foregroundColor(Color.theme.primary)
                    }
                    .disabled(isSyncing)
                    .opacity(isSyncing ? 0.5 : 1)
                }
                .padding(.top, 8)
            } else {
                NavigationLink(destination: IntegrationsView()) {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar.badge.plus")
                            .font(.caption2)
                        Text("Connect Google Calendar")
                            .font(.caption2)
                    }
                    .foregroundColor(Color.theme.primary)
                }
                .padding(.top, 8)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(16)
    }

    // MARK: - Selected Date Section
    private var selectedDateSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text(selectedDate.smartDateString)
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                let totalCount = sessionsForSelectedDate.count + calendarEventsForSelectedDate.count
                Text("\(totalCount) \(totalCount == 1 ? "event" : "events")")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            if sessionsForSelectedDate.isEmpty && calendarEventsForSelectedDate.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.largeTitle)
                        .foregroundColor(Color.theme.primaryLight)

                    Text("No events scheduled")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)

                    Button(action: { showingCreateSession = true }) {
                        Text("Schedule Session")
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else {
                VStack(spacing: 8) {
                    // Show TherapyFlow sessions
                    ForEach(sessionsForSelectedDate) { session in
                        NavigationLink(destination: SessionDetailView(session: session)) {
                            SessionListRow(session: session)
                        }
                        .buttonStyle(.plain)
                    }

                    // Show Google Calendar events
                    ForEach(calendarEventsForSelectedDate) { event in
                        CalendarEventRow(event: event)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Upcoming Section
    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Upcoming Sessions")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            if upcomingSessions.isEmpty {
                Text("No upcoming sessions")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .padding()
            } else {
                VStack(spacing: 8) {
                    ForEach(upcomingSessions.prefix(5)) { session in
                        NavigationLink(destination: SessionDetailView(session: session)) {
                            SessionListRow(session: session, showDate: true)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Sessions Panel (iPad)
    private var sessionsPanel: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(selectedDate.smartDateString)
                        .font(.headline)
                        .foregroundColor(Color.theme.primaryText)

                    Text("\(sessionsForSelectedDate.count) sessions")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }

                Spacer()

                Button(action: { showingCreateSession = true }) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundColor(Color.theme.primary)
                }
            }
            .padding()
            .background(Color.theme.surfaceSecondary)

            Divider()

            // Sessions list
            if sessionsForSelectedDate.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "calendar")
                        .font(.system(size: 48))
                        .foregroundColor(Color.theme.primaryLight)

                    Text("No sessions")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                    Spacer()
                }
            } else {
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(sessionsForSelectedDate) { session in
                            NavigationLink(destination: SessionDetailView(session: session)) {
                                SessionListRow(session: session)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.surface)
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
            // Convert cached synced events to CalendarEvent for display
            calendarEvents = cachedEvents.map { $0.toCalendarEvent() }
            syncedEvents = cachedEvents

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

    /// Load calendar events from the database (cached from previous syncs)
    private func loadCachedCalendarEvents() async -> [SyncedCalendarEvent] {
        do {
            let startDate = currentMonth.startOfMonth.adding(days: -7)
            let endDate = currentMonth.endOfMonth.adding(days: 7)
            let events = try await APIClient.shared.getCalendarEvents(startDate: startDate, endDate: endDate)
            print("Loaded \(events.count) cached calendar events from database")
            return events
        } catch is CancellationError {
            return []
        } catch let urlError as URLError where urlError.code == .cancelled {
            return []
        } catch {
            print("Failed to load cached calendar events: \(error)")
            return []
        }
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
            print("Fetching Google Calendar events from \(startDate) to \(endDate)")
            let googleEvents = try await integrationsService.getGoogleCalendarEvents(startDate: startDate, endDate: endDate)
            print("Fetched \(googleEvents.count) Google Calendar events")

            // Convert to sync request format
            let syncEvents = googleEvents.map { event in
                CreateCalendarEventInput(
                    externalId: event.id,
                    source: event.source.rawValue,
                    title: event.title,
                    description: event.description,
                    location: event.location,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    isAllDay: false,
                    attendees: event.attendees,
                    linkedClientId: nil,
                    linkedSessionId: nil,
                    rawData: nil
                )
            }

            // Sync to database
            let syncRequest = CalendarEventSyncRequest(events: syncEvents, source: "google")
            let syncResponse = try await APIClient.shared.syncCalendarEvents(syncRequest)
            print("Sync result: \(syncResponse.message)")

            // Reload from database to get the synced data
            let updatedEvents = try await APIClient.shared.getCalendarEvents(startDate: startDate, endDate: endDate)

            // Check if cancelled before updating UI
            guard !Task.isCancelled else { return }

            await MainActor.run {
                syncedEvents = updatedEvents
                calendarEvents = updatedEvents.map { $0.toCalendarEvent() }
                lastSyncTime = Date()
                isSyncing = false

                if updatedEvents.isEmpty {
                    googleCalendarStatus = "No events found"
                } else {
                    googleCalendarStatus = "\(updatedEvents.count) events"
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
        } catch let error as IntegrationError {
            print("Integration error syncing Google Calendar: \(error.localizedDescription)")
            await MainActor.run {
                isSyncing = false
                // Keep cached data, just update status
                if case .tokenExpired = error {
                    googleCalendarStatus = "Token expired - reconnect"
                } else if case .notConnected = error {
                    googleCalendarStatus = "Not connected"
                } else {
                    googleCalendarStatus = "Sync error (using cached)"
                }
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

// MARK: - Calendar Event Row
struct CalendarEventRow: View {
    let event: CalendarEvent

    var body: some View {
        HStack(spacing: 12) {
            // Time
            VStack(alignment: .center, spacing: 2) {
                Text(event.startTime.timeString)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)

                Text(durationText)
                    .font(.caption2)
                    .foregroundColor(Color.theme.secondaryText)
            }
            .frame(width: 60)

            Rectangle()
                .fill(sourceColor)
                .frame(width: 3)
                .cornerRadius(2)

            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)

                HStack(spacing: 8) {
                    // Source badge
                    HStack(spacing: 4) {
                        Image(systemName: sourceIcon)
                            .font(.caption2)
                        Text(sourceText)
                            .font(.caption2)
                    }
                    .foregroundColor(sourceColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(sourceColor.opacity(0.15))
                    .cornerRadius(4)

                    if let location = event.location, !location.isEmpty {
                        HStack(spacing: 2) {
                            Image(systemName: "location")
                                .font(.caption2)
                            Text(location)
                                .font(.caption)
                                .lineLimit(1)
                        }
                        .foregroundColor(Color.theme.secondaryText)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding()
        .background(Color.theme.surfaceSecondary)
        .cornerRadius(10)
    }

    private var durationText: String {
        let duration = Int(event.endTime.timeIntervalSince(event.startTime) / 60)
        return "\(duration) min"
    }

    private var sourceColor: Color {
        switch event.source {
        case .google:
            return .blue
        case .simplePractice:
            return .green
        case .therapyFlow:
            return Color.theme.primary
        }
    }

    private var sourceIcon: String {
        switch event.source {
        case .google:
            return "g.circle.fill"
        case .simplePractice:
            return "cross.case.fill"
        case .therapyFlow:
            return "brain.head.profile"
        }
    }

    private var sourceText: String {
        switch event.source {
        case .google:
            return "Google"
        case .simplePractice:
            return "SimplePractice"
        case .therapyFlow:
            return "TherapyFlow"
        }
    }
}

// MARK: - Calendar Day Cell
struct CalendarDayCell: View {
    let date: Date
    let isSelected: Bool
    let hasSession: Bool
    let sessionCount: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Text("\(date.day)")
                    .font(.system(size: 16))
                    .fontWeight(date.isToday ? .bold : .regular)
                    .foregroundColor(textColor)

                if hasSession {
                    HStack(spacing: 2) {
                        ForEach(0..<min(sessionCount, 3), id: \.self) { _ in
                            Circle()
                                .fill(isSelected ? .white : Color.theme.primary)
                                .frame(width: 4, height: 4)
                        }
                    }
                    .frame(height: 6)
                } else {
                    Color.clear.frame(height: 6)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(backgroundColor)
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }

    private var textColor: Color {
        if isSelected {
            return .white
        } else if date.isToday {
            return Color.theme.primary
        } else {
            return Color.theme.primaryText
        }
    }

    private var backgroundColor: Color {
        if isSelected {
            return Color.theme.primary
        } else if date.isToday {
            return Color.theme.primaryLight
        } else {
            return Color.clear
        }
    }
}

// MARK: - Session List Row
struct SessionListRow: View {
    let session: Session
    var showDate: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            // Time
            VStack(alignment: .center, spacing: 2) {
                Text(session.scheduledAt.timeString)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)

                if showDate {
                    Text(session.scheduledAt.monthDay)
                        .font(.caption2)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
            .frame(width: 60)

            Rectangle()
                .fill(session.status.themeColor)
                .frame(width: 3)
                .cornerRadius(2)

            VStack(alignment: .leading, spacing: 4) {
                Text(session.client?.name ?? "Client")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)

                HStack(spacing: 8) {
                    SessionTypeBadge(type: session.sessionType)
                    Text("\(session.duration) min")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding()
        .background(Color.theme.surfaceSecondary)
        .cornerRadius(10)
    }
}

#Preview {
    NavigationStack {
        CalendarView()
    }
}
