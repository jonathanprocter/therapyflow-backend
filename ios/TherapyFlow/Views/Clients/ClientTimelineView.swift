import SwiftUI

/// Longitudinal timeline view showing all appointments for a client
/// with progress note status and therapeutic insights
struct ClientTimelineView: View {
    let clientId: String
    let clientName: String

    @State private var sessions: [Session] = []
    @State private var progressNotes: [ProgressNote] = []
    @State private var isLoading = true
    @State private var error: Error?
    @State private var selectedFilter: TimelineFilter = .all
    @State private var showOnlyPendingNotes = false

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

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

    private var filteredSessions: [Session] {
        var filtered = sessions

        switch selectedFilter {
        case .all:
            break
        case .upcoming:
            filtered = sessions.filter { $0.scheduledAt >= Date() }
        case .past:
            filtered = sessions.filter { $0.scheduledAt < Date() }
        case .thisMonth:
            let now = Date()
            let startOfMonth = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: now))!
            let endOfMonth = Calendar.current.date(byAdding: .month, value: 1, to: startOfMonth)!
            filtered = sessions.filter { $0.scheduledAt >= startOfMonth && $0.scheduledAt < endOfMonth }
        }

        if showOnlyPendingNotes {
            filtered = filtered.filter { $0.progressNoteStatus == .pending }
        }

        return filtered.sorted { $0.scheduledAt > $1.scheduledAt }
    }

    private var sessionsByMonth: [(String, [Session])] {
        let grouped = Dictionary(grouping: filteredSessions) { session -> String in
            let formatter = DateFormatter()
            formatter.dateFormat = "MMMM yyyy"
            return formatter.string(from: session.scheduledAt)
        }

        return grouped.sorted { first, second in
            // Sort by date descending
            guard let firstSession = first.value.first,
                  let secondSession = second.value.first else { return false }
            return firstSession.scheduledAt > secondSession.scheduledAt
        }
    }

    // Statistics
    private var totalSessions: Int { sessions.count }
    private var completedSessions: Int { sessions.filter { $0.status == .completed }.count }
    private var pendingNotes: Int { sessions.filter { $0.progressNoteStatus == .pending && $0.status == .completed }.count }
    private var upcomingSessions: Int { sessions.filter { $0.scheduledAt >= Date() && $0.status == .scheduled }.count }

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
            } else if filteredSessions.isEmpty {
                emptyState
            } else {
                timelineList
            }
        }
        .background(Color.theme.background)
        .navigationTitle("\(clientName)'s Timeline")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadData()
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
                            icon: filter.icon,
                            isSelected: selectedFilter == filter
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
                        icon: "doc.badge.clock",
                        isSelected: showOnlyPendingNotes
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
                ForEach(sessionsByMonth, id: \.0) { month, sessionsInMonth in
                    Section {
                        ForEach(sessionsInMonth) { session in
                            NavigationLink(destination: SessionDetailView(session: session)) {
                                TimelineSessionRow(
                                    session: session,
                                    progressNote: progressNotes.first { $0.sessionId == session.id }
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    } header: {
                        HStack {
                            Text(month)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(Color.theme.primaryText)

                            Spacer()

                            Text("\(sessionsInMonth.count) session\(sessionsInMonth.count == 1 ? "" : "s")")
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
            return "No sessions have been scheduled for this client yet."
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
        isLoading = true
        error = nil

        do {
            // Load all sessions for client
            async let sessionsRequest = APIClient.shared.getSessions(clientId: clientId)
            async let notesRequest = APIClient.shared.getProgressNotes(clientId: clientId)

            let (loadedSessions, loadedNotes) = try await (sessionsRequest, notesRequest)

            await MainActor.run {
                sessions = loadedSessions
                progressNotes = loadedNotes
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

// MARK: - Timeline Stat Card
struct TimelineStatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                Text(value)
                    .font(.title3)
                    .fontWeight(.bold)
            }
            .foregroundColor(color)

            Text(title)
                .font(.caption2)
                .foregroundColor(Color.theme.secondaryText)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(color.opacity(0.1))
        .cornerRadius(10)
    }
}

// MARK: - Filter Chip
struct FilterChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? Color.theme.primary : Color.theme.surface)
            .foregroundColor(isSelected ? .white : Color.theme.primaryText)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? Color.clear : Color.theme.border, lineWidth: 1)
            )
        }
    }
}

// MARK: - Timeline Session Row
struct TimelineSessionRow: View {
    let session: Session
    let progressNote: ProgressNote?

    var body: some View {
        HStack(spacing: 16) {
            // Timeline indicator
            VStack(spacing: 0) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)

                Rectangle()
                    .fill(Color.theme.border)
                    .frame(width: 2)
            }
            .frame(width: 12)

            // Session info
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(session.scheduledAt.smartDateTimeString)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.primaryText)

                        Text(session.formattedTimeRange)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Spacer()

                    SessionStatusBadge(status: session.status)
                }

                HStack(spacing: 8) {
                    SessionTypeBadge(type: session.sessionType)
                    ProgressNoteStatusBadge(status: session.progressNoteStatus, hasPlaceholder: session.hasProgressNotePlaceholder)
                }

                // Show progress note preview if exists
                if let note = progressNote, !note.content.isEmpty {
                    Text(note.content.prefix(100) + (note.content.count > 100 ? "..." : ""))
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                        .lineLimit(2)
                        .padding(.top, 4)
                }
            }
            .padding(.vertical, 12)

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding(.horizontal, 16)
        .background(Color.theme.surface)
    }

    private var statusColor: Color {
        switch session.status {
        case .completed:
            return Color.theme.success
        case .scheduled:
            return session.scheduledAt >= Date() ? Color.theme.accent : Color.theme.warning
        case .cancelled:
            return Color.theme.tertiaryText
        case .noShow:
            return Color.theme.error
        }
    }
}

#Preview {
    NavigationStack {
        ClientTimelineView(clientId: "test-id", clientName: "John Doe")
    }
}
