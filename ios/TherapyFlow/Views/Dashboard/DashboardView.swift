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
                DashboardHeaderSection(greeting: greeting, isConnected: networkMonitor.isConnected)

                if isLoading {
                    LoadingView()
                        .frame(height: 300)
                } else if let error = error {
                    ErrorView(error: error, onRetry: loadData)
                } else {
                    // Stats Grid
                    DashboardStatsSection(stats: stats, columns: statsColumns)

                    // Main content - adaptive layout
                    if horizontalSizeClass == .regular {
                        // iPad: Side by side
                        HStack(alignment: .top, spacing: 24) {
                            DashboardUpcomingSessionsSection(sessions: upcomingSessions)
                                .frame(maxWidth: .infinity)

                            DashboardRecentNotesSection(notes: recentNotes)
                                .frame(maxWidth: .infinity)
                        }
                    } else {
                        // iPhone: Stacked
                        DashboardUpcomingSessionsSection(sessions: upcomingSessions)
                        DashboardRecentNotesSection(notes: recentNotes)
                    }
                
                // AI Features
                DashboardAIFeaturesSection()

                    // Quick Actions
                    DashboardQuickActionsSection(columns: quickActionColumns)
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
            // Update AI context for dashboard
            ContextualAIAssistant.shared.updateContext(.dashboard)

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

    private var statsColumns: Int {
        horizontalSizeClass == .regular ? 4 : 2
    }

    private var quickActionColumns: Int {
        horizontalSizeClass == .regular ? 4 : 2
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

            // Start loading AI context in background (non-blocking)
            // This prepares context for voice assistant without blocking the UI
            FullContextProvider.shared.startBackgroundLoad()
        }
    }
}
#Preview {
    NavigationStack {
        DashboardView()
            .environmentObject(AuthService.shared)
            .environmentObject(NetworkMonitor.shared)
    }
}
