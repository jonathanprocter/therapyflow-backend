import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var networkMonitor: NetworkMonitor

    @State private var stats: DashboardStats?
    @State private var upcomingSessions: [Session] = []
    @State private var recentNotes: [ProgressNote] = []
    @State private var isLoading = true
    @State private var error: Error?
    @State private var loadTask: Task<Void, Never>?

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                headerSection

                if isLoading {
                    LoadingView()
                        .frame(height: 300)
                } else if let error = error {
                    ErrorView(error: error, onRetry: loadData)
                } else {
                    // Stats Grid
                    statsSection

                    // Main content - adaptive layout
                    if horizontalSizeClass == .regular {
                        // iPad: Side by side
                        HStack(alignment: .top, spacing: 24) {
                            upcomingSessionsSection
                                .frame(maxWidth: .infinity)

                            recentNotesSection
                                .frame(maxWidth: .infinity)
                        }
                    } else {
                        // iPhone: Stacked
                        upcomingSessionsSection
                        recentNotesSection
                    }
                
                // AI Features
                aiFeaturesSection

                    // Quick Actions
                    quickActionsSection
                }
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("Dashboard")
        .refreshable {
            await loadDataAsync()
        }
        .onAppear {
            // Cancel any existing task to prevent duplicates
            loadTask?.cancel()
            loadTask = Task {
                await loadDataAsync()
            }
        }
        .onDisappear {
            // Cancel the task when view disappears to prevent -999 errors
            loadTask?.cancel()
            loadTask = nil
        }
    }

    // MARK: - Header Section
    private var headerSection: some View {
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

            if !networkMonitor.isConnected {
                Label("Offline", systemImage: "wifi.slash")
                    .font(.caption)
                    .foregroundColor(.orange)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.orange.opacity(0.15))
                    .cornerRadius(8)
            }
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        // Get first name from user, fallback to "Jonathan" as the app owner's name
        let name = authService.currentUser?.name.split(separator: " ").first.map(String.init) ?? "Jonathan"

        switch hour {
        case 0..<12:
            return "Good morning, \(name)"
        case 12..<17:
            return "Good afternoon, \(name)"
        default:
            return "Good evening, \(name)"
        }
    }

    // MARK: - Stats Section
    private var statsSection: some View {
        let columns = horizontalSizeClass == .regular ? 4 : 2

        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: columns),
            spacing: 16
        ) {
            StatCard(
                title: "Active Clients",
                value: "\(stats?.activeClients ?? 0)",
                icon: "person.2",
                color: Color.theme.primary
            )

            StatCard(
                title: "This Week",
                value: "\(stats?.weeklySchedule ?? 0)",
                icon: "calendar",
                color: Color.theme.accent
            )

            StatCard(
                title: "Total Notes",
                value: "\(stats?.totalNotes ?? 0)",
                icon: "doc.text",
                color: Color.theme.success
            )

            StatCard(
                title: "AI Insights",
                value: "\(stats?.aiInsights ?? 0)",
                icon: "sparkles",
                color: Color.theme.warning
            )
        }
    }

    // MARK: - Upcoming Sessions Section
    private var upcomingSessionsSection: some View {
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

            if upcomingSessions.isEmpty {
                emptySessionsCard
            } else {
                VStack(spacing: 12) {
                    ForEach(upcomingSessions.prefix(3)) { session in
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

    private var emptySessionsCard: some View {
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

    // MARK: - Recent Notes Section
    private var recentNotesSection: some View {
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

            if recentNotes.isEmpty {
                emptyNotesCard
            } else {
                VStack(spacing: 12) {
                    ForEach(recentNotes.prefix(3)) { note in
                        NotePreviewCard(note: note)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    private var emptyNotesCard: some View {
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

    // MARK: - AI Features Section
    private var aiFeaturesSection: some View {
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
                        color: .blue
                    )
                }
                
                NavigationLink(destination: SemanticSearchView()) {
                    AIActionCard(
                        icon: "magnifyingglass.circle.fill",
                        title: "Semantic Search",
                        subtitle: "Search by meaning, not just keywords",
                        color: .purple
                    )
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Quick Actions Section
    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Actions")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            let columns = horizontalSizeClass == .regular ? 4 : 2

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

    // MARK: - Data Loading
    private func loadData() {
        Task {
            await loadDataAsync()
        }
    }

    private func loadDataAsync() async {
        // Check if cancelled before starting
        guard !Task.isCancelled else { return }

        isLoading = true
        error = nil

        // Load each data source independently so one failure doesn't block others
        async let statsResult: DashboardStats? = {
            do {
                return try await APIClient.shared.getDashboardStats()
            } catch is CancellationError {
                return nil
            } catch let urlError as URLError where urlError.code == .cancelled {
                // Silently handle cancelled requests
                return nil
            } catch {
                print("Failed to load stats: \(error)")
                return nil
            }
        }()

        async let sessionsResult: [Session] = {
            do {
                return try await APIClient.shared.getSessions(upcoming: true, limit: 5)
            } catch is CancellationError {
                return []
            } catch let urlError as URLError where urlError.code == .cancelled {
                // Silently handle cancelled requests
                return []
            } catch {
                print("Failed to load sessions: \(error)")
                return []
            }
        }()

        async let notesResult: [ProgressNote] = {
            do {
                return try await APIClient.shared.getProgressNotes(recent: true, limit: 5)
            } catch is CancellationError {
                return []
            } catch let urlError as URLError where urlError.code == .cancelled {
                // Silently handle cancelled requests
                return []
            } catch {
                print("Failed to load notes: \(error)")
                return []
            }
        }()

        let (fetchedStats, fetchedSessions, fetchedNotes) = await (statsResult, sessionsResult, notesResult)

        // Check if cancelled before updating UI
        guard !Task.isCancelled else { return }

        await MainActor.run {
            stats = fetchedStats ?? DashboardStats(activeClients: 0, weeklySchedule: 0, totalNotes: 0, aiInsights: 0)
            upcomingSessions = fetchedSessions
            recentNotes = fetchedNotes
            isLoading = false
        }
    }
}

// MARK: - Session Row Card
struct SessionRowCard: View {
    let session: Session

    var body: some View {
        HStack(spacing: 12) {
            // Time indicator
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

// MARK: - Note Preview Card
struct NotePreviewCard: View {
    let note: ProgressNote

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(name: note.client?.name ?? "C", size: 40)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(note.client?.name ?? "Client")
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

// MARK: - Quick Action Button
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

#Preview {
    NavigationStack {
        DashboardView()
            .environmentObject(AuthService.shared)
            .environmentObject(NetworkMonitor.shared)
    }
}
