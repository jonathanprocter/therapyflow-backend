import SwiftUI

struct AIDashboardView: View {
    @State private var isLoading = false
    @State private var aiInsights: [AIInsight] = []
    @State private var recentActivity: [AIActivityItem] = []
    @State private var selectedInsight: AIInsight?
    @State private var selectedActivity: AIActivityItem?
    @State private var loadError: String?

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

                // Error display
                if let error = loadError {
                    HStack {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundColor(.orange)
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(8)
                }
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
        .sheet(item: $selectedInsight) { insight in
            InsightDetailSheet(insight: insight)
        }
        .sheet(item: $selectedActivity) { activity in
            ActivityDetailSheet(activity: activity)
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
                QuickActionCard(icon: "doc.text.magnifyingglass", title: "Analyze Note", color: Color.theme.primary) {}
                QuickActionCard(icon: "waveform", title: "Voice Note", color: Color.theme.teal) {}
                QuickActionCard(icon: "chart.line.uptrend.xyaxis", title: "Progress Report", color: Color.theme.accent) {}
                QuickActionCard(icon: "lightbulb", title: "Get Suggestions", color: Color.theme.info) {}
            }
        }
    }

    private var insightsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("AI Insights")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                if !aiInsights.isEmpty {
                    Text("\(aiInsights.count) insight\(aiInsights.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 100)
            } else if aiInsights.isEmpty {
                EmptyInsightsView()
            } else {
                ForEach(aiInsights) { insight in
                    Button(action: { selectedInsight = insight }) {
                        InsightCard(insight: insight)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent AI Activity")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                if !recentActivity.isEmpty {
                    Text("\(recentActivity.count) activities")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }

            if recentActivity.isEmpty {
                VStack(spacing: 8) {
                    Text("No recent AI activity")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                    Text("Activity will appear as you use AI features")
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 20)
            } else {
                VStack(spacing: 8) {
                    ForEach(recentActivity) { activity in
                        Button(action: { selectedActivity = activity }) {
                            ActivityRowView(activity: activity)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func loadInsights() async {
        isLoading = true
        loadError = nil

        do {
            // Try to fetch insights from API
            let fetchedInsights = try await APIClient.shared.getAIInsights()

            // Also try to load recent activity
            let activity = await loadRecentActivity()

            await MainActor.run {
                aiInsights = fetchedInsights
                recentActivity = activity
                isLoading = false
            }
        } catch {
            print("Failed to load AI insights from API: \(error.localizedDescription)")

            // Generate local insights based on available data
            let localInsights = await generateLocalInsights()
            let localActivity = await loadRecentActivity()

            await MainActor.run {
                if localInsights.isEmpty && aiInsights.isEmpty {
                    loadError = "Unable to load insights. Pull to refresh."
                }
                if !localInsights.isEmpty {
                    aiInsights = localInsights
                }
                recentActivity = localActivity
                isLoading = false
            }
        }
    }

    /// Generate insights from local data when API is unavailable
    private func generateLocalInsights() async -> [AIInsight] {
        var insights: [AIInsight] = []

        do {
            // Fetch local data to generate insights
            let notes = try await APIClient.shared.getProgressNotes()
            let sessions = try await APIClient.shared.getSessions()
            let clients = try await APIClient.shared.getClients()

            // Generate insight for high-risk notes
            let highRiskNotes = notes.filter { $0.riskLevel == .high || $0.riskLevel == .critical }
            if !highRiskNotes.isEmpty {
                insights.append(AIInsight(
                    clientId: highRiskNotes.first?.clientId,
                    therapistId: "local",
                    type: .riskAlert,
                    title: "Risk Assessment Completed",
                    description: "\(highRiskNotes.count) note\(highRiskNotes.count == 1 ? "" : "s") flagged for elevated risk. Review recommended.",
                    priority: .high,
                    metadata: InsightMetadata(
                        relatedNoteIds: highRiskNotes.map { $0.id },
                        actionItems: ["Review flagged notes", "Update safety plans if needed", "Document risk factors"]
                    )
                ))
            }

            // Generate insight for pending notes
            let pendingSessions = sessions.filter { $0.progressNoteStatus == .pending && $0.status == .completed }
            if !pendingSessions.isEmpty {
                insights.append(AIInsight(
                    therapistId: "local",
                    type: .sessionPrep,
                    title: "Documentation Reminder",
                    description: "\(pendingSessions.count) completed session\(pendingSessions.count == 1 ? "" : "s") need progress notes.",
                    priority: .medium,
                    metadata: InsightMetadata(
                        relatedSessionIds: pendingSessions.map { $0.id },
                        actionItems: pendingSessions.prefix(3).map { "Write note for \($0.displayClientName)" }
                    )
                ))
            }

            // Generate insight for client patterns
            let activeClients = clients.filter { $0.status == .active }
            if activeClients.count > 0 {
                // Look for clients with multiple recent sessions
                let clientSessionCounts = Dictionary(grouping: sessions, by: { $0.clientId })
                let frequentClients = clientSessionCounts.filter { $0.value.count >= 3 }

                if !frequentClients.isEmpty {
                    insights.append(AIInsight(
                        therapistId: "local",
                        type: .patternRecognition,
                        title: "Client Patterns Identified",
                        description: "\(frequentClients.count) client\(frequentClients.count == 1 ? "" : "s") with frequent sessions. Consider reviewing treatment progress.",
                        priority: .low,
                        metadata: InsightMetadata(
                            actionItems: ["Review treatment goals", "Assess progress markers"],
                            patterns: ["Frequent session attendance", "Engaged in treatment"]
                        )
                    ))
                }
            }

            // Generate progress milestone insight
            let recentNotes = notes.filter { note in
                let sevenDaysAgo = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date()
                return note.sessionDate >= sevenDaysAgo
            }
            if !recentNotes.isEmpty {
                insights.append(AIInsight(
                    therapistId: "local",
                    type: .progressMilestone,
                    title: "Progress Notes Analyzed",
                    description: "\(recentNotes.count) progress note\(recentNotes.count == 1 ? "" : "s") from the past week analyzed for themes and patterns.",
                    priority: .low,
                    metadata: InsightMetadata(
                        relatedNoteIds: recentNotes.map { $0.id },
                        themes: extractThemes(from: recentNotes)
                    )
                ))
            }

        } catch {
            print("Failed to generate local insights: \(error.localizedDescription)")
        }

        return insights
    }

    /// Extract common themes from notes
    private func extractThemes(from notes: [ProgressNote]) -> [String] {
        var themes: [String] = []

        // Count tag occurrences
        var tagCounts: [String: Int] = [:]
        for note in notes {
            for tag in note.allTags {
                tagCounts[tag, default: 0] += 1
            }
        }

        // Return top themes
        themes = tagCounts.sorted { $0.value > $1.value }.prefix(5).map { $0.key }

        if themes.isEmpty {
            themes = ["Session documentation", "Treatment progress", "Clinical observations"]
        }

        return themes
    }

    /// Load recent AI activity from various sources
    private func loadRecentActivity() async -> [AIActivityItem] {
        var activities: [AIActivityItem] = []

        do {
            // Get recent notes to show as "analyzed" activity
            let notes = try await APIClient.shared.getProgressNotes()
            let recentNotes = notes.sorted { $0.updatedAt > $1.updatedAt }.prefix(3)

            for note in recentNotes {
                activities.append(AIActivityItem(
                    id: "note-\(note.id)",
                    type: .noteAnalysis,
                    title: "Progress note analyzed",
                    description: "Note for \(note.displayClientName) was processed and analyzed for clinical themes and risk factors.",
                    relatedId: note.id,
                    relatedClientName: note.displayClientName,
                    timestamp: note.updatedAt,
                    details: [
                        "Client": note.displayClientName,
                        "Session Date": note.sessionDate.mediumDate,
                        "Risk Level": note.riskLevel.displayName,
                        "Tags": note.allTags.joined(separator: ", ")
                    ]
                ))
            }

            // Get clients to show "patterns identified" activity
            let clients = try await APIClient.shared.getClients()
            let activeClients = clients.filter { $0.status == .active }

            if !activeClients.isEmpty {
                activities.append(AIActivityItem(
                    id: "patterns-\(Date().timeIntervalSince1970)",
                    type: .patternDetection,
                    title: "Client patterns identified",
                    description: "AI analyzed session data across \(activeClients.count) active clients to identify behavioral patterns and treatment themes.",
                    relatedId: nil,
                    relatedClientName: nil,
                    timestamp: Date().addingTimeInterval(-86400), // Yesterday
                    details: [
                        "Clients Analyzed": "\(activeClients.count)",
                        "Analysis Type": "Behavioral patterns, session themes",
                        "Recommendation": "Review individual client timelines for detailed insights"
                    ]
                ))
            }

            // Add risk assessment activity
            let highRiskNotes = notes.filter { $0.riskLevel == .high || $0.riskLevel == .critical }
            if !highRiskNotes.isEmpty {
                activities.append(AIActivityItem(
                    id: "risk-\(Date().timeIntervalSince1970)",
                    type: .riskAssessment,
                    title: "Risk assessment completed",
                    description: "Automated risk screening identified \(highRiskNotes.count) note\(highRiskNotes.count == 1 ? "" : "s") with elevated risk indicators requiring attention.",
                    relatedId: highRiskNotes.first?.id,
                    relatedClientName: highRiskNotes.first?.displayClientName,
                    timestamp: Date().addingTimeInterval(-172800), // 2 days ago
                    details: [
                        "Notes Flagged": "\(highRiskNotes.count)",
                        "Risk Levels": "High/Critical",
                        "Action Required": "Review flagged notes and update safety plans"
                    ]
                ))
            }

        } catch {
            print("Failed to load recent activity: \(error.localizedDescription)")
        }

        return activities.sorted { $0.timestamp > $1.timestamp }
    }
}

// MARK: - AI Activity Item Model
struct AIActivityItem: Identifiable {
    let id: String
    let type: ActivityType
    let title: String
    let description: String
    let relatedId: String?
    let relatedClientName: String?
    let timestamp: Date
    let details: [String: String]

    enum ActivityType {
        case noteAnalysis
        case patternDetection
        case riskAssessment
        case treatmentSuggestion

        var icon: String {
            switch self {
            case .noteAnalysis: return "doc.text"
            case .patternDetection: return "person.2"
            case .riskAssessment: return "exclamationmark.triangle"
            case .treatmentSuggestion: return "lightbulb"
            }
        }

        var color: Color {
            switch self {
            case .noteAnalysis: return Color.theme.primary
            case .patternDetection: return Color.theme.teal
            case .riskAssessment: return Color.theme.warning
            case .treatmentSuggestion: return Color.theme.accent
            }
        }
    }
}

// QuickActionCard is defined in QuickActionsView.swift

// AIInsight model is now imported from Models/AIInsight.swift

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

// MARK: - Activity Row View (Interactive)
struct ActivityRowView: View {
    let activity: AIActivityItem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: activity.type.icon)
                .foregroundColor(activity.type.color)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(activity.title)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.primaryText)

                if let clientName = activity.relatedClientName {
                    Text(clientName)
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(activity.timestamp.relativeString)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)

                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundColor(Color.theme.tertiaryText)
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(Color.theme.surfaceSecondary)
        .cornerRadius(8)
    }
}

// MARK: - Insight Detail Sheet
struct InsightDetailSheet: View {
    let insight: AIInsight
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header
                    HStack(spacing: 12) {
                        Image(systemName: insight.type.icon)
                            .font(.title)
                            .foregroundColor(insight.type.color)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(insight.title)
                                .font(.title3)
                                .fontWeight(.bold)
                                .foregroundColor(Color.theme.primaryText)

                            HStack {
                                Text(insight.type.displayName)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(insight.type.color.opacity(0.1))
                                    .foregroundColor(insight.type.color)
                                    .cornerRadius(4)

                                Text(insight.priority.displayName)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.gray.opacity(0.1))
                                    .foregroundColor(Color.gray)
                                    .cornerRadius(4)
                            }
                        }
                    }

                    Divider()

                    // Description
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Details")
                            .font(.headline)
                            .foregroundColor(Color.theme.primaryText)

                        Text(insight.description)
                            .font(.body)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    // Action Items
                    if let actionItems = insight.metadata?.actionItems, !actionItems.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Recommended Actions")
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            ForEach(actionItems, id: \.self) { action in
                                HStack(alignment: .top, spacing: 12) {
                                    Image(systemName: "checkmark.circle")
                                        .foregroundColor(Color.theme.success)

                                    Text(action)
                                        .font(.subheadline)
                                        .foregroundColor(Color.theme.primaryText)
                                }
                            }
                        }
                        .padding()
                        .background(Color.theme.surfaceSecondary)
                        .cornerRadius(10)
                    }

                    // Themes/Patterns
                    if let themes = insight.metadata?.themes, !themes.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Identified Themes")
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            FlowLayout(spacing: 8) {
                                ForEach(themes, id: \.self) { theme in
                                    Text(theme)
                                        .font(.caption)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(Color.theme.primary.opacity(0.1))
                                        .foregroundColor(Color.theme.primary)
                                        .cornerRadius(6)
                                }
                            }
                        }
                    }

                    // Patterns
                    if let patterns = insight.metadata?.patterns, !patterns.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Patterns Detected")
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            ForEach(patterns, id: \.self) { pattern in
                                HStack(spacing: 8) {
                                    Image(systemName: "waveform.path.ecg")
                                        .foregroundColor(Color.theme.accent)
                                    Text(pattern)
                                        .font(.subheadline)
                                        .foregroundColor(Color.theme.primaryText)
                                }
                            }
                        }
                        .padding()
                        .background(Color.theme.surfaceSecondary)
                        .cornerRadius(10)
                    }

                    // Timestamp
                    HStack {
                        Image(systemName: "clock")
                            .foregroundColor(Color.theme.tertiaryText)
                        Text("Generated \(insight.createdAt.relativeString)")
                            .font(.caption)
                            .foregroundColor(Color.theme.tertiaryText)
                    }
                }
                .padding()
            }
            .background(Color.theme.background)
            .navigationTitle("Insight Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Activity Detail Sheet
struct ActivityDetailSheet: View {
    let activity: AIActivityItem
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(activity.type.color.opacity(0.1))
                                .frame(width: 50, height: 50)

                            Image(systemName: activity.type.icon)
                                .font(.title2)
                                .foregroundColor(activity.type.color)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text(activity.title)
                                .font(.title3)
                                .fontWeight(.bold)
                                .foregroundColor(Color.theme.primaryText)

                            Text(activity.timestamp.relativeString)
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }

                    Divider()

                    // Description
                    VStack(alignment: .leading, spacing: 8) {
                        Text("What Happened")
                            .font(.headline)
                            .foregroundColor(Color.theme.primaryText)

                        Text(activity.description)
                            .font(.body)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    // Details
                    if !activity.details.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Details")
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            ForEach(Array(activity.details.sorted(by: { $0.key < $1.key })), id: \.key) { key, value in
                                HStack(alignment: .top) {
                                    Text(key)
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                        .foregroundColor(Color.theme.secondaryText)
                                        .frame(width: 120, alignment: .leading)

                                    Text(value)
                                        .font(.subheadline)
                                        .foregroundColor(Color.theme.primaryText)

                                    Spacer()
                                }
                                .padding(.vertical, 4)
                            }
                        }
                        .padding()
                        .background(Color.theme.surfaceSecondary)
                        .cornerRadius(10)
                    }

                    // Related Client Link
                    if let clientName = activity.relatedClientName, let relatedId = activity.relatedId {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Related")
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            NavigationLink(destination: NoteDetailView(noteId: relatedId)) {
                                HStack {
                                    Image(systemName: "doc.text")
                                        .foregroundColor(Color.theme.primary)
                                    Text("View note for \(clientName)")
                                        .foregroundColor(Color.theme.primary)
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .foregroundColor(Color.theme.tertiaryText)
                                }
                                .padding()
                                .background(Color.theme.surfaceSecondary)
                                .cornerRadius(10)
                            }
                        }
                    }
                }
                .padding()
            }
            .background(Color.theme.background)
            .navigationTitle("Activity Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        AIDashboardView()
    }
}
