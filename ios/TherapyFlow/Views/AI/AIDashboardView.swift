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
                    .foregroundColor(.purple)
                Text("AI Assistant")
                    .font(.title2)
                    .fontWeight(.bold)
                Spacer()
                Circle()
                    .fill(Color.green)
                    .frame(width: 10, height: 10)
                Text("Active")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Text("Your AI assistant is ready to help with clinical documentation, session analysis, and treatment planning.")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
    }
    
    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                QuickActionCard(icon: "doc.text.magnifyingglass", title: "Analyze Note", color: .blue)
                QuickActionCard(icon: "waveform", title: "Voice Note", color: .green)
                QuickActionCard(icon: "chart.line.uptrend.xyaxis", title: "Progress Report", color: .orange)
                QuickActionCard(icon: "lightbulb", title: "Get Suggestions", color: .purple)
            }
        }
    }
    
    private var insightsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AI Insights")
                .font(.headline)
            
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
            
            VStack(spacing: 8) {
                ActivityRow(icon: "doc.text", title: "Progress note analyzed", time: "2 hours ago", color: .blue)
                ActivityRow(icon: "person.2", title: "Client patterns identified", time: "Yesterday", color: .green)
                ActivityRow(icon: "exclamationmark.triangle", title: "Risk assessment completed", time: "2 days ago", color: .orange)
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
            case .pattern: return .blue
            case .reminder: return .orange
            case .suggestion: return .purple
            case .alert: return .red
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
                Text(insight.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(.secondary)
                .font(.caption)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(10)
        .shadow(color: .black.opacity(0.03), radius: 3, y: 1)
    }
}

struct EmptyInsightsView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "sparkles")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text("No insights yet")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Text("AI insights will appear as you add more session data")
                .font(.caption)
                .foregroundColor(.secondary)
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
            Spacer()
            Text(time)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    NavigationStack {
        AIDashboardView()
    }
}
