import SwiftUI

struct AIDashboardView: View {
    @State private var isLoading = false
    @State private var aiInsights: [AIInsight] = []

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header Card
                headerCard

                // Quick Actions
                quickActionsSection

                // AI Insights
                insightsSection

                // Recent AI Activity
                recentActivitySection
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("AI Dashboard")
        .refreshable {
            await loadInsights()
        }
        .task {
            await loadInsights()
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "brain")
                    .font(.title)
                    .foregroundColor(Color.theme.accent)
                Text("AI Assistant")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(Color.theme.primaryText)
                Spacer()
                Circle()
                    .fill(Color.theme.success)
                    .frame(width: 10, height: 10)
                Text("Active")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Text("Your AI assistant is ready to help with clinical documentation, session analysis, and treatment planning.")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
        .shadow(color: Color.theme.shadow, radius: 5, y: 2)
    }

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                QuickActionCard(icon: "doc.text.magnifyingglass", title: "Analyze Note", color: Color.theme.primary)
                QuickActionCard(icon: "waveform", title: "Voice Note", color: Color.theme.teal)
                QuickActionCard(icon: "chart.line.uptrend.xyaxis", title: "Progress Report", color: Color.theme.accent)
                QuickActionCard(icon: "lightbulb", title: "Get Suggestions", color: Color.theme.info)
            }
        }
    }

    private var insightsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AI Insights")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 100)
            } else if aiInsights.isEmpty {
                EmptyInsightsView()
            } else {
                ForEach(aiInsights) { insight in
                    InsightCard(insight: insight)
                }
            }
        }
    }

    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent AI Activity")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            VStack(spacing: 8) {
                ActivityRow(icon: "doc.text", title: "Progress note analyzed", time: "2 hours ago", color: Color.theme.primary)
                ActivityRow(icon: "person.2", title: "Client patterns identified", time: "Yesterday", color: Color.theme.teal)
                ActivityRow(icon: "exclamationmark.triangle", title: "Risk assessment completed", time: "2 days ago", color: Color.theme.accent)
            }
        }
    }

    private func loadInsights() async {
        isLoading = true
        // Simulate API call
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        aiInsights = [
            AIInsight(id: "1", title: "Session Pattern Detected", description: "3 clients showing similar anxiety patterns this week", type: .pattern),
            AIInsight(id: "2", title: "Documentation Reminder", description: "5 sessions need progress notes", type: .reminder),
            AIInsight(id: "3", title: "Treatment Suggestion", description: "CBT techniques recommended for Client A", type: .suggestion)
        ]
        isLoading = false
    }
}

struct QuickActionCard: View {
    let icon: String
    let title: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.primaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(12)
    }
}

struct AIInsight: Identifiable {
    let id: String
    let title: String
    let description: String
    let type: InsightType

    enum InsightType {
        case pattern, reminder, suggestion, alert

        var color: Color {
            switch self {
            case .pattern: return Color.theme.primary
            case .reminder: return Color.theme.accent
            case .suggestion: return Color.theme.info
            case .alert: return Color.theme.error
            }
        }

        var icon: String {
            switch self {
            case .pattern: return "chart.bar"
            case .reminder: return "bell"
            case .suggestion: return "lightbulb"
            case .alert: return "exclamationmark.triangle"
            }
        }
    }
}

struct InsightCard: View {
    let insight: AIInsight

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: insight.type.icon)
                .foregroundColor(insight.type.color)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 4) {
                Text(insight.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)
                Text(insight.description)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .foregroundColor(Color.theme.tertiaryText)
                .font(.caption)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(10)
        .shadow(color: Color.theme.shadow, radius: 3, y: 1)
    }
}

struct EmptyInsightsView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "sparkles")
                .font(.largeTitle)
                .foregroundColor(Color.theme.tertiaryText)
            Text("No insights yet")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
            Text("AI insights will appear as you add more session data")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 30)
    }
}

struct ActivityRow: View {
    let icon: String
    let title: String
    let time: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 24)
            Text(title)
                .font(.subheadline)
                .foregroundColor(Color.theme.primaryText)
            Spacer()
            Text(time)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    NavigationStack {
        AIDashboardView()
    }
}
