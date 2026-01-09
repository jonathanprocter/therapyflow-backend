import SwiftUI

// MARK: - Dashboard Sections
struct DashboardHeaderSection: View {
    let greeting: String
    let isConnected: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(greeting)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(Color.theme.primaryText)

                Text(Date().longDate)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Spacer()

            if !isConnected {
                Label("Offline", systemImage: "wifi.slash")
                    .font(.caption)
                    .foregroundColor(Color.theme.warning)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.theme.warning.opacity(0.15))
                    .cornerRadius(8)
            }
        }
    }
}

struct DashboardStatsSection: View {
    let stats: DashboardStats?
    let columns: Int

    var body: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: columns),
            spacing: 16
        ) {
            NavigationLink(destination: ClientsListView()) {
                StatCard(
                    title: "Active Clients",
                    value: "\(stats?.activeClients ?? 0)",
                    icon: "person.2",
                    color: Color.theme.primary
                )
            }
            .buttonStyle(.plain)

            NavigationLink(destination: CalendarView()) {
                StatCard(
                    title: "This Week",
                    value: "\(stats?.weeklySchedule ?? 0)",
                    icon: "calendar",
                    color: Color.theme.accent
                )
            }
            .buttonStyle(.plain)

            NavigationLink(destination: NotesListView()) {
                StatCard(
                    title: "Total Notes",
                    value: "\(stats?.totalNotes ?? 0)",
                    icon: "doc.text",
                    color: Color.theme.success
                )
            }
            .buttonStyle(.plain)

            NavigationLink(destination: AIDashboardView()) {
                StatCard(
                    title: "AI Insights",
                    value: "\(stats?.aiInsights ?? 0)",
                    icon: "sparkles",
                    color: Color.theme.warning
                )
            }
            .buttonStyle(.plain)
        }
    }
}

struct DashboardUpcomingSessionsSection: View {
    let sessions: [Session]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Upcoming Sessions")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                NavigationLink(destination: CalendarView()) {
                    Text("See All")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.primary)
                }
            }

            if sessions.isEmpty {
                DashboardEmptySessionsCard()
            } else {
                VStack(spacing: 12) {
                    ForEach(sessions.prefix(3)) { session in
                        NavigationLink(destination: SessionDetailView(session: session)) {
                            SessionRowCard(session: session)
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

struct DashboardRecentNotesSection: View {
    let notes: [ProgressNote]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Recent Notes")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                NavigationLink(destination: NotesListView()) {
                    Text("See All")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.primary)
                }
            }

            if notes.isEmpty {
                DashboardEmptyNotesCard()
            } else {
                VStack(spacing: 12) {
                    ForEach(notes.prefix(3)) { note in
                        NotePreviewCard(note: note)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct DashboardAIFeaturesSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("AI Features")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            HStack(spacing: 16) {
                NavigationLink(destination: DocumentsListView()) {
                    AIActionCard(
                        icon: "doc.text.viewfinder",
                        title: "Upload & Analyze",
                        subtitle: "Extract insights from documents",
                        color: Color.theme.primary
                    )
                }

                NavigationLink(destination: SemanticSearchView()) {
                    AIActionCard(
                        icon: "magnifyingglass.circle.fill",
                        title: "Semantic Search",
                        subtitle: "Search by meaning, not just keywords",
                        color: Color.theme.accent
                    )
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct DashboardQuickActionsSection: View {
    let columns: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Actions")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: columns),
                spacing: 16
            ) {
                NavigationLink(destination: NoteFormView(mode: .create, onSave: { _ in })) {
                    QuickActionButton(
                        icon: "plus.circle",
                        title: "New Note",
                        color: Color.theme.primary
                    )
                }

                NavigationLink(destination: DocumentsListView()) {
                    QuickActionButton(
                        icon: "doc.badge.arrow.up",
                        title: "Upload",
                        color: Color.theme.accent
                    )
                }

                NavigationLink(destination: SemanticSearchView()) {
                    QuickActionButton(
                        icon: "magnifyingglass",
                        title: "AI Search",
                        color: Color.theme.success
                    )
                }

                NavigationLink(destination: BulkImportView()) {
                    QuickActionButton(
                        icon: "folder.badge.plus",
                        title: "Bulk Import",
                        color: Color.theme.warning
                    )
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct DashboardEmptySessionsCard: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "calendar.badge.plus")
                .font(.largeTitle)
                .foregroundColor(Color.theme.primaryLight)

            Text("No upcoming sessions")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}

struct DashboardEmptyNotesCard: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.largeTitle)
                .foregroundColor(Color.theme.primaryLight)

            Text("No recent notes")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}

// MARK: - Dashboard Components
struct SessionRowCard: View {
    let session: Session
    private let reminders: [QuickNote]

    init(session: Session) {
        self.session = session
        self.reminders = QuickNoteService.shared.remindersForSession(session)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(spacing: 2) {
                    Text(session.scheduledAt.timeString)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(Color.theme.primaryText)

                    Text(session.scheduledAt.smartDateString)
                        .font(.caption2)
                        .foregroundColor(Color.theme.secondaryText)
                }
                .frame(width: 60)

                Rectangle()
                    .fill(Color.theme.primary)
                    .frame(width: 3)
                    .cornerRadius(2)

                VStack(alignment: .leading, spacing: 4) {
                    Text(session.displayClientName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.primaryText)

                    HStack(spacing: 8) {
                        SessionTypeBadge(type: session.sessionType)
                        Text("\(session.duration) min")
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)

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
                        SessionReminderRow(reminder: reminder)
                    }
                    if reminders.count > 2 {
                        Text("+\(reminders.count - 2) more reminders")
                            .font(.caption2)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            }
        }
        .background(Color.theme.surfaceSecondary)
        .cornerRadius(10)
    }
}

// MARK: - Session Reminder Row
struct SessionReminderRow: View {
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

struct NotePreviewCard: View {
    let note: ProgressNote

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(name: note.displayClientName, size: 40)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(note.displayClientName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.primaryText)

                    Spacer()

                    Text(note.sessionDate.relativeString)
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                }

                Text(note.contentPreview)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
                    .lineLimit(2)

                HStack(spacing: 8) {
                    RiskBadge(level: note.riskLevel)

                    if let rating = note.progressRating {
                        Text("Progress: \(rating)/10")
                            .font(.caption2)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surfaceSecondary)
        .cornerRadius(10)
    }
}

struct QuickActionButton: View {
    let icon: String
    let title: String
    let color: Color

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.primaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Color.theme.surfaceSecondary)
        .cornerRadius(10)
    }
}

struct AIActionCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.theme.primaryText)

                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }

            Spacer()
        }
        .padding()
        .background(Color.theme.surfaceSecondary)
        .cornerRadius(10)
    }
}
