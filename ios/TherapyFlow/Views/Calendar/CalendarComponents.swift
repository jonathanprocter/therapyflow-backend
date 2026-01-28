import SwiftUI

// MARK: - Calendar Sections
struct CalendarSectionView: View {
    @Binding var selectedDate: Date
    let currentMonth: Date
    let isSyncing: Bool
    let googleCalendarConnected: Bool
    let googleCalendarStatus: String
    let eventCountForDate: (Date) -> Int
    let onPreviousMonth: () -> Void
    let onNextMonth: () -> Void
    let onSync: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Button(action: onPreviousMonth) {
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

                Button(action: onNextMonth) {
                    Image(systemName: "chevron.right")
                        .font(.title3)
                        .foregroundColor(Color.theme.primary)
                }
            }
            .padding(.horizontal)

            HStack(spacing: 0) {
                ForEach(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], id: \.self) { day in
                    Text(day)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.secondaryText)
                        .frame(maxWidth: .infinity)
                }
            }

            let weeks = Date.weeksInMonth(for: currentMonth)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 8) {
                ForEach(0..<weeks.count, id: \.self) { weekIndex in
                    ForEach(0..<7, id: \.self) { dayIndex in
                        if let date = weeks[weekIndex][dayIndex] {
                            CalendarDayCell(
                                date: date,
                                isSelected: date.isSameDay(as: selectedDate),
                                hasSession: eventCountForDate(date) > 0,
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

            if googleCalendarConnected {
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

                    Button(action: onSync) {
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
}

struct SelectedDateSectionView: View {
    let selectedDate: Date
    let sessions: [Session]
    let calendarEvents: [SyncedCalendarEvent]
    let onCreateSession: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text(selectedDate.smartDateString)
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                let totalCount = sessions.count + calendarEvents.count
                Text("\(totalCount) \(totalCount == 1 ? "event" : "events")")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            if sessions.isEmpty && calendarEvents.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.largeTitle)
                        .foregroundColor(Color.theme.primaryLight)

                    Text("No events scheduled")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)

                    Button(action: onCreateSession) {
                        Text("Schedule Session")
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else {
                VStack(spacing: 8) {
                    ForEach(sessions) { session in
                        NavigationLink(destination: SessionDetailView(session: session)) {
                            SessionListRow(session: session)
                        }
                        .buttonStyle(.plain)
                    }

                    ForEach(calendarEvents) { event in
                        SyncedCalendarEventRow(event: event)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct UpcomingSectionView: View {
    let sessions: [Session]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Upcoming Sessions")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            if sessions.isEmpty {
                Text("No upcoming sessions")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .padding()
            } else {
                VStack(spacing: 8) {
                    ForEach(sessions.prefix(5)) { session in
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
}

struct SessionsPanelView: View {
    let selectedDate: Date
    let sessions: [Session]
    let calendarEvents: [SyncedCalendarEvent]
    let onCreateSession: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(selectedDate.smartDateString)
                        .font(.headline)
                        .foregroundColor(Color.theme.primaryText)

                    Text("\(sessions.count) sessions")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }

                Spacer()

                Button(action: onCreateSession) {
                    Image(systemName: "plus.circle.fill")
                        .font(.title2)
                        .foregroundColor(Color.theme.primary)
                }
            }
            .padding()
            .background(Color.theme.surfaceSecondary)

            Divider()

            if sessions.isEmpty && calendarEvents.isEmpty {
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
                        ForEach(sessions) { session in
                            NavigationLink(destination: SessionDetailView(session: session)) {
                                SessionListRow(session: session)
                            }
                            .buttonStyle(.plain)
                        }

                        ForEach(calendarEvents) { event in
                            SyncedCalendarEventRow(event: event)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.surface)
    }
}

// MARK: - Week Day Section View
struct WeekDaySectionView: View {
    let date: Date
    let sessions: [Session]
    let events: [SyncedCalendarEvent]
    let isSelected: Bool
    let onTap: () -> Void
    let onCreateSession: () -> Void

    private var totalEvents: Int {
        sessions.count + events.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Day Header
            Button(action: onTap) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(date.dayOfWeek)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(date.isToday ? Color.theme.primary : Color.theme.primaryText)

                        Text(date.monthDay)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Spacer()

                    if totalEvents > 0 {
                        Text("\(totalEvents) \(totalEvents == 1 ? "event" : "events")")
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Image(systemName: isSelected ? "chevron.down" : "chevron.right")
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(date.isToday ? Color.theme.primaryLight.opacity(0.1) : Color.theme.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(date.isToday ? Color.theme.primary.opacity(0.3) : Color.clear, lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)

            // Sessions (show if selected or always show if has events)
            if isSelected || totalEvents > 0 {
                if sessions.isEmpty && events.isEmpty {
                    Text("No events")
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                        .padding(.leading, 16)
                } else {
                    VStack(spacing: 6) {
                        ForEach(sessions) { session in
                            NavigationLink(destination: SessionDetailView(session: session)) {
                                SessionListRow(session: session)
                            }
                            .buttonStyle(.plain)
                        }

                        ForEach(events) { event in
                            SyncedCalendarEventRow(event: event)
                        }
                    }
                    .padding(.leading, 8)
                }
            }
        }
    }
}

// MARK: - Calendar Event Row
struct CalendarEventRow: View {
    let event: CalendarEvent

    var body: some View {
        HStack(spacing: 12) {
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

// MARK: - Synced Calendar Event Row (linked to session/client when possible)
struct SyncedCalendarEventRow: View {
    let event: SyncedCalendarEvent

    var body: some View {
        if let linkedSessionId = event.linkedSessionId {
            NavigationLink(destination: SessionDetailLoaderView(sessionId: linkedSessionId)) {
                CalendarEventRow(event: event.toCalendarEvent())
            }
            .buttonStyle(.plain)
        } else if let linkedClientId = event.linkedClientId {
            NavigationLink(destination: ClientDetailView(clientId: linkedClientId)) {
                CalendarEventRow(event: event.toCalendarEvent())
            }
            .buttonStyle(.plain)
        } else {
            CalendarEventRow(event: event.toCalendarEvent())
        }
    }
}

struct SessionDetailLoaderView: View {
    let sessionId: String

    @State private var session: Session?
    @State private var error: Error?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                LoadingView(message: "Loading session...")
            } else if let error = error {
                ErrorView(error: error, onRetry: loadSession)
            } else if let session = session {
                SessionDetailView(session: session)
            } else {
                EmptyStateView(
                    icon: "calendar.badge.exclamationmark",
                    title: "Session Not Found",
                    message: "This appointment does not have a linked session yet."
                )
            }
        }
        .onAppear {
            loadSession()
        }
    }

    private func loadSession() {
        isLoading = true
        error = nil

        Task {
            do {
                let loaded = try await APIClient.shared.getSession(id: sessionId)
                await MainActor.run {
                    session = loaded
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isLoading = false
                }
            }
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
    private let reminders: [QuickNote]

    init(session: Session, showDate: Bool = false) {
        self.session = session
        self.showDate = showDate
        self.reminders = QuickNoteService.shared.remindersForSession(session)
    }

    /// Whether this session is cancelled
    private var isCancelled: Bool {
        session.status == .cancelled
    }

    /// Whether this session is a no-show
    private var isNoShow: Bool {
        session.status == .noShow
    }

    /// Background color based on session status
    private var rowBackgroundColor: Color {
        if isNoShow {
            return Color.theme.error.opacity(0.1)  // Red background for no-show
        } else if isCancelled {
            return Color.theme.warning.opacity(0.1)  // Yellow background for cancelled
        }
        return Color.theme.surfaceSecondary
    }

    /// Border color based on session status
    private var rowBorderColor: Color {
        if isNoShow {
            return Color.theme.error.opacity(0.3)
        } else if isCancelled {
            return Color.theme.warning.opacity(0.3)
        }
        return Color.clear
    }

    /// Text color based on session status
    private var primaryTextColor: Color {
        if isNoShow {
            return Color.theme.error
        } else if isCancelled {
            return Color.theme.warning
        }
        return Color.theme.primaryText
    }

    /// Secondary text color based on session status
    private var secondaryTextColor: Color {
        if isNoShow || isCancelled {
            return primaryTextColor.opacity(0.8)
        }
        return Color.theme.secondaryText
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .center, spacing: 2) {
                    Text(session.scheduledAt.timeString)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(primaryTextColor)
                        .strikethrough(isCancelled, color: Color.theme.warning)

                    if showDate {
                        Text(session.scheduledAt.monthDay)
                            .font(.caption2)
                            .foregroundColor(secondaryTextColor)
                            .strikethrough(isCancelled, color: Color.theme.warning)
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
                        .foregroundColor(primaryTextColor)
                        .strikethrough(isCancelled, color: Color.theme.warning)

                    HStack(spacing: 8) {
                        SessionTypeBadge(type: session.sessionType)
                        Text("\(session.duration) min")
                            .font(.caption)
                            .foregroundColor(secondaryTextColor)
                            .strikethrough(isCancelled, color: Color.theme.warning)

                        if !reminders.isEmpty {
                            HStack(spacing: 2) {
                                Image(systemName: "bell.fill")
                                    .font(.caption2)
                                Text("\(reminders.count)")
                                    .font(.caption2)
                            }
                            .foregroundColor(.orange)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.orange.opacity(0.15))
                            .cornerRadius(4)
                        }

                        // Status indicator for inactive sessions
                        if session.status.isInactive {
                            SessionStatusBadge(status: session.status)
                        }
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(Color.theme.tertiaryText)
            }
            .padding()

            // Show reminders if any
            if !reminders.isEmpty {
                VStack(spacing: 4) {
                    ForEach(reminders.prefix(2)) { reminder in
                        CalendarSessionReminderRow(reminder: reminder)
                    }
                    if reminders.count > 2 {
                        Text("+\(reminders.count - 2) more")
                            .font(.caption2)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            }
        }
        .background(rowBackgroundColor)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(rowBorderColor, lineWidth: session.status.isInactive ? 2 : 0)
        )
        .cornerRadius(10)
    }
}

// MARK: - Calendar Session Reminder Row
struct CalendarSessionReminderRow: View {
    let reminder: QuickNote
    @ObservedObject private var quickNoteService = QuickNoteService.shared

    var body: some View {
        HStack(spacing: 8) {
            Button(action: toggleComplete) {
                Image(systemName: reminder.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.caption)
                    .foregroundColor(reminder.isCompleted ? Color.theme.success : .orange)
            }
            .buttonStyle(.plain)

            Text(reminder.displayContent)
                .font(.caption)
                .foregroundColor(reminder.isCompleted ? Color.theme.tertiaryText : Color.theme.secondaryText)
                .lineLimit(1)
                .strikethrough(reminder.isCompleted)

            Spacer()

            if reminder.isOverdue {
                Text("Overdue")
                    .font(.caption2)
                    .foregroundColor(.red)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.orange.opacity(0.08))
        .cornerRadius(6)
    }

    private func toggleComplete() {
        quickNoteService.toggleReminderComplete(id: reminder.id)
    }
}
