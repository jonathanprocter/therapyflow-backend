import SwiftUI

/// Longitudinal timeline view showing all appointments for a client
/// with progress note status and therapeutic insights
struct ClientTimelineView: View {
    let clientId: String
    let clientName: String

    @State private var sessions: [Session] = []
    @State private var calendarEvents: [CalendarEvent] = []  // Google Calendar events
    @State private var progressNotes: [ProgressNote] = []
    @State private var documents: [Document] = []
    @State private var insights: [AIInsight] = []
    @State private var isLoading = true
    @State private var error: Error?
    @State private var selectedFilter: TimelineFilter = .all
    @State private var showOnlyPendingNotes = false
    @State private var showingCreateNoteForSession: Session?
    @State private var loadTask: Task<Void, Never>?

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @ObservedObject private var integrationsService = IntegrationsService.shared

    enum TimelineFilter: String, CaseIterable {
        case all = "All"
        case upcoming = "Upcoming"
        case past = "Past"
        case thisMonth = "This Month"

        var icon: String {
            switch self {
            case .all: return "list.bullet"
            case .upcoming: return "arrow.right.circle"
            case .past: return "clock.arrow.circlepath"
            case .thisMonth: return "calendar"
            }
        }
    }

    private var timelineItems: [TimelineItem] {
        let sessionItems = sessions.map { TimelineItem(kind: .session($0)) }
        let calendarItems = calendarEvents.map { TimelineItem(kind: .calendarEvent($0)) }
        let noteItems = progressNotes.map { TimelineItem(kind: .note($0)) }
        let documentItems = documents.map { TimelineItem(kind: .document($0)) }
        let insightItems = insights.map { TimelineItem(kind: .insight($0)) }
        return sessionItems + calendarItems + noteItems + documentItems + insightItems
    }

    private var filteredItems: [TimelineItem] {
        var filtered = timelineItems

        switch selectedFilter {
        case .all:
            break
        case .upcoming:
            filtered = filtered.filter { $0.date >= Date() }
        case .past:
            filtered = filtered.filter { $0.date < Date() }
        case .thisMonth:
            let now = Date()
            let startOfMonth = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: now))!
            let endOfMonth = Calendar.current.date(byAdding: .month, value: 1, to: startOfMonth)!
            filtered = filtered.filter { $0.date >= startOfMonth && $0.date < endOfMonth }
        }

        if showOnlyPendingNotes {
            filtered = filtered.filter { item in
                switch item.kind {
                case .session(let session):
                    return session.progressNoteStatus == .pending
                case .calendarEvent(let event):
                    // Show calendar events that are past and don't have notes
                    return event.startTime < Date() && !hasNoteForCalendarEvent(event)
                case .note(let note):
                    return note.status != .completed
                case .document, .insight:
                    return false
                }
            }
        }

        return filtered.sorted { $0.date > $1.date }
    }

    private var itemsByMonth: [(String, [TimelineItem])] {
        let grouped = Dictionary(grouping: filteredItems) { item -> String in
            let formatter = DateFormatter()
            formatter.dateFormat = "MMMM yyyy"
            return formatter.string(from: item.date)
        }

        return grouped.sorted { first, second in
            guard let firstItem = first.value.first,
                  let secondItem = second.value.first else { return false }
            return firstItem.date > secondItem.date
        }
    }

    // Statistics
    private var totalSessions: Int { sessions.count }
    private var completedSessions: Int { sessions.filter { $0.status == .completed }.count }
    private var pendingNotes: Int { sessions.filter { $0.progressNoteStatus == .pending && $0.status == .completed }.count }
    private var upcomingSessions: Int { sessions.filter { $0.scheduledAt >= Date() && $0.status == .scheduled }.count }
    private var relatedInsightSessionIDs: Set<String> {
        Set(insights.flatMap { $0.metadata?.relatedSessionIds ?? [] })
    }
    private var relatedDocumentSessionIDs: Set<String> {
        Set(progressNotes.compactMap { note in
            guard note.originalDocumentId != nil, let sessionId = note.sessionId else { return nil }
            return sessionId
        })
    }

    var body: some View {
        VStack(spacing: 0) {
            // Stats Header
            statsHeader

            // Filter Bar
            filterBar

            // Timeline Content
            if isLoading {
                LoadingView()
                    .frame(maxHeight: .infinity)
            } else if let error = error {
                ErrorView(error: error, onRetry: { Task { await loadData() } })
            } else if filteredItems.isEmpty {
                emptyState
            } else {
                timelineList
            }
        }
        .background(Color.theme.background)
        .navigationTitle("\(clientName)'s Timeline")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            loadTask?.cancel()
            loadTask = Task {
                await loadData()
            }
        }
        .onDisappear {
            loadTask?.cancel()
            loadTask = nil
        }
    }

    // MARK: - Stats Header
    private var statsHeader: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                TimelineStatCard(title: "Total", value: "\(totalSessions)", icon: "calendar", color: Color.theme.primary)
                TimelineStatCard(title: "Completed", value: "\(completedSessions)", icon: "checkmark.circle", color: Color.theme.success)
                TimelineStatCard(title: "Upcoming", value: "\(upcomingSessions)", icon: "arrow.right.circle", color: Color.theme.accent)
                TimelineStatCard(title: "Notes Pending", value: "\(pendingNotes)", icon: "doc.badge.clock", color: Color.theme.warning)
            }
            .padding(.horizontal)
            .padding(.vertical, 12)
        }
        .background(Color.theme.surface)
    }

    // MARK: - Filter Bar
    private var filterBar: some View {
        VStack(spacing: 12) {
            // Filter Chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(TimelineFilter.allCases, id: \.self) { filter in
                        FilterChip(
                            title: filter.rawValue,
                            isSelected: selectedFilter == filter,
                            icon: filter.icon
                        ) {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selectedFilter = filter
                            }
                        }
                    }

                    Divider()
                        .frame(height: 24)

                    // Pending Notes Toggle
                    FilterChip(
                        title: "Pending Notes Only",
                        isSelected: showOnlyPendingNotes,
                        icon: "doc.badge.clock"
                    ) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showOnlyPendingNotes.toggle()
                        }
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding(.vertical, 8)
        .background(Color.theme.surfaceSecondary)
    }

    // MARK: - Timeline List
    private var timelineList: some View {
        ScrollView {
            LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                ForEach(itemsByMonth, id: \.0) { month, items in
                    Section {
                        ForEach(items) { item in
                            TimelineRowView(
                                item: item,
                                progressNotes: progressNotes,
                                relatedDocumentSessionIDs: relatedDocumentSessionIDs,
                                relatedInsightSessionIDs: relatedInsightSessionIDs
                            )
                        }
                    } header: {
                        HStack {
                            Text(month)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(Color.theme.primaryText)

                            Spacer()

                            Text("\(items.count) item\(items.count == 1 ? "" : "s")")
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.theme.surfaceSecondary)
                    }
                }
            }
        }
    }

    // MARK: - Empty State
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.primaryLight)

            Text("No Sessions Found")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            Text(emptyStateMessage)
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxHeight: .infinity)
    }

    private var emptyStateMessage: String {
        if showOnlyPendingNotes {
            return "No sessions with pending progress notes."
        }
        switch selectedFilter {
        case .all:
            return "No sessions, notes, documents, or insights found for \(clientName)."
        case .upcoming:
            return "No upcoming sessions scheduled."
        case .past:
            return "No past sessions found."
        case .thisMonth:
            return "No sessions scheduled for this month."
        }
    }

    // MARK: - Data Loading
    private func loadData() async {
        guard !Task.isCancelled else { return }

        isLoading = true
        error = nil

        do {
            async let sessionsTask = APIClient.shared.getSessions(clientId: clientId)
            async let notesTask = APIClient.shared.getProgressNotes(clientId: clientId)
            async let docsTask: [Document] = APIClient.shared.getDocuments()
            async let insightsTask: [AIInsight] = APIClient.shared.getAIInsights()

            let (loadedSessions, loadedNotes, allDocs, allInsights) = try await (sessionsTask, notesTask, docsTask, insightsTask)
            let clientDocs = allDocs.filter { $0.clientId == clientId }
            let clientInsights = allInsights.filter { $0.clientId == clientId }

            // Also load Google Calendar events for this client
            var loadedCalendarEvents: [CalendarEvent] = []
            if integrationsService.googleCalendarConnected {
                do {
                    // Get events from the past year to 3 months in future
                    let startDate = Calendar.current.date(byAdding: .year, value: -1, to: Date()) ?? Date()
                    let endDate = Calendar.current.date(byAdding: .month, value: 3, to: Date()) ?? Date()
                    let allCalendarEvents = try await integrationsService.getGoogleCalendarEvents(startDate: startDate, endDate: endDate)

                    // Filter events that match this client's name
                    loadedCalendarEvents = allCalendarEvents.filter { event in
                        event.title.localizedCaseInsensitiveContains(clientName) ||
                        (event.description?.localizedCaseInsensitiveContains(clientName) ?? false)
                    }
                } catch {
                    print("Failed to load Google Calendar events: \(error.localizedDescription)")
                    // Continue without calendar events - not critical
                }
            }

            guard !Task.isCancelled else { return }

            await MainActor.run {
                sessions = loadedSessions
                calendarEvents = loadedCalendarEvents
                progressNotes = loadedNotes
                documents = clientDocs
                insights = clientInsights
                isLoading = false
            }
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch {
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self.error = error
                isLoading = false
            }
        }
    }

    /// Find a progress note for a specific date (within same day)
    private func findNoteForDate(_ date: Date) -> ProgressNote? {
        let calendar = Calendar.current
        return progressNotes.first { note in
            calendar.isDate(note.sessionDate, inSameDayAs: date)
        }
    }

    /// Check if a session has an associated progress note
    private func hasNoteForSession(_ session: Session) -> Bool {
        if let sessionId = session.id as String? {
            return progressNotes.contains { $0.sessionId == sessionId }
        }
        return findNoteForDate(session.scheduledAt) != nil
    }

    /// Check if a calendar event has an associated progress note
    private func hasNoteForCalendarEvent(_ event: CalendarEvent) -> Bool {
        let calendar = Calendar.current
        return progressNotes.contains { note in
            calendar.isDate(note.sessionDate, inSameDayAs: event.startTime)
        }
    }
}

#Preview {
    NavigationStack {
        ClientTimelineView(clientId: "test-id", clientName: "John Doe")
    }
}
