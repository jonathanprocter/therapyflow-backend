import SwiftUI

// MARK: - Stats Grid View
// Note: This is extracted as a reusable component from DashboardView

struct StatsGridView: View {
    let stats: DashboardStats?
    let columns: Int

    init(stats: DashboardStats?, columns: Int = 2) {
        self.stats = stats
        self.columns = columns
    }

    var body: some View {
        LazyVGrid(
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
}

#Preview {
    StatsGridView(stats: DashboardStats(
        activeClients: 25,
        weeklySchedule: 12,
        totalNotes: 156,
        aiInsights: 8
    ), columns: 2)
    .padding()
}
