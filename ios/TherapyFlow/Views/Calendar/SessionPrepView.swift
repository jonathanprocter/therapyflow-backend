import SwiftUI

struct SessionPrepView: View {
    let sessionId: String

    @State private var session: Session?
    @State private var prepData: SessionPrep?
    @State private var isLoading = true
    @State private var error: Error?
    @State private var isRegenerating = false
    @State private var loadTask: Task<Void, Never>?

    var body: some View {
        ScrollView {
            if isLoading {
                LoadingView()
                    .padding(.top, 50)
            } else if let error = error {
                ErrorView(error: error, onRetry: { Task { await loadData() } })
            } else if let prep = prepData {
                VStack(spacing: 0) {
                    // Main Header
                    prepHeader(prep: prep)

                    VStack(spacing: 0) {
                        // Priority Focus Areas
                        if let priorities = prep.prep.priorityFocusAreas, !priorities.isEmpty {
                            prioritySection(priorities: priorities)
                        }

                        // Last Session Summary
                        if let lastSession = prep.prep.lastSessionSummary {
                            lastSessionSection(summary: lastSession)
                        }

                        // Theme Clusters
                        if let clusters = prep.prep.themeClusters, !clusters.isEmpty {
                            themeClustersSection(clusters: clusters)
                        }

                        // Clinical Considerations
                        if let considerations = prep.prep.clinicalConsiderations, !considerations.isEmpty {
                            clinicalConsiderationsSection(considerations: considerations)
                        }

                        // Risk Factors (if any)
                        if let risks = prep.prep.riskFactors, !risks.isEmpty {
                            riskFactorsSection(risks: risks)
                        }

                        // Legacy fallback for old format data
                        if prep.prep.priorityFocusAreas == nil && prep.prep.themeClusters == nil {
                            legacyContentSection(prep: prep)
                        }
                    }

                    // Regenerate Button
                    regenerateButton
                        .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Session Prep")
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

    // MARK: - Header Section
    private func prepHeader(prep: SessionPrep) -> some View {
        VStack(spacing: 0) {
            // Title bar
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(Color.theme.primary)
                Text("AI SESSION PREP")
                    .font(.caption)
                    .fontWeight(.bold)
                    .tracking(2)
                    .foregroundColor(Color.theme.primary)
                Spacer()
            }
            .padding()
            .background(Color.theme.primary.opacity(0.1))

            // Client info
            VStack(alignment: .leading, spacing: 8) {
                if let clientName = prep.prep.clientName {
                    HStack {
                        Text("CLIENT:")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(Color.theme.secondaryText)
                        Text(clientName)
                            .font(.headline)
                            .foregroundColor(Color.theme.primaryText)
                    }
                }

                if let info = prep.prep.sessionInfo {
                    HStack(spacing: 16) {
                        if let date = info.date {
                            Label(date, systemImage: "calendar")
                                .font(.caption)
                        }
                        if let type = info.sessionType {
                            Label(type, systemImage: "person")
                                .font(.caption)
                        }
                        if let duration = info.duration {
                            Label("\(duration) min", systemImage: "clock")
                                .font(.caption)
                        }
                    }
                    .foregroundColor(Color.theme.secondaryText)

                    if let sessionNum = info.sessionNumber, let status = info.clientStatus {
                        Text("STATUS: \(status) | Session #\(sessionNum)")
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.surface)
        }
    }

    // MARK: - Priority Focus Section
    private func prioritySection(priorities: [PriorityFocusArea]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(icon: "pin.fill", title: "PRIORITY FOCUS AREAS", subtitle: "This Session", color: Color.theme.warning)

            VStack(alignment: .leading, spacing: 16) {
                ForEach(Array(priorities.enumerated()), id: \.element.id) { index, priority in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .top, spacing: 8) {
                            Text("\(index + 1).")
                                .font(.subheadline)
                                .fontWeight(.bold)
                                .foregroundColor(Color.theme.warning)
                                .frame(width: 20)

                            Text(priority.title)
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundColor(Color.theme.primaryText)
                        }

                        if let question = priority.clinicalQuestion {
                            HStack(alignment: .top, spacing: 8) {
                                Text("→")
                                    .foregroundColor(Color.theme.primary)
                                    .frame(width: 20)
                                Text("Consider: \(question)")
                                    .font(.caption)
                                    .italic()
                                    .foregroundColor(Color.theme.secondaryText)
                            }
                        }
                    }
                }
            }
            .padding()
            .background(Color.theme.surface)
        }
    }

    // MARK: - Last Session Section
    private func lastSessionSection(summary: LastSessionSummary) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(icon: "doc.text", title: "LAST SESSION SUMMARY", color: Color.theme.info)

            VStack(alignment: .leading, spacing: 12) {
                if let text = summary.summary {
                    Text(text)
                        .font(.subheadline)
                        .foregroundColor(Color.theme.primaryText)
                        .lineSpacing(4)
                }

                if let leftOff = summary.whereWeLeftOff, !leftOff.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Where we left off:")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(Color.theme.secondaryText)
                        Text(leftOff)
                            .font(.caption)
                            .foregroundColor(Color.theme.primaryText)
                    }
                }

                if let homework = summary.homeworkAssigned, !homework.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Homework assigned:")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(Color.theme.secondaryText)
                        ForEach(homework, id: \.self) { item in
                            HStack(alignment: .top, spacing: 6) {
                                Image(systemName: "checkmark.square")
                                    .font(.caption2)
                                    .foregroundColor(Color.theme.primary)
                                Text(item)
                                    .font(.caption)
                            }
                        }
                    }
                }

                if let threads = summary.unfinishedThreads, !threads.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Unfinished threads:")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(Color.theme.secondaryText)
                        ForEach(threads, id: \.self) { thread in
                            HStack(alignment: .top, spacing: 6) {
                                Image(systemName: "arrow.turn.down.right")
                                    .font(.caption2)
                                    .foregroundColor(Color.theme.warning)
                                Text(thread)
                                    .font(.caption)
                            }
                        }
                    }
                }
            }
            .padding()
            .background(Color.theme.surface)
        }
    }

    // MARK: - Theme Clusters Section
    private func themeClustersSection(clusters: [ThemeCluster]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(icon: "folder", title: "THEME CLUSTERS", color: Color.theme.primary)

            VStack(alignment: .leading, spacing: 16) {
                ForEach(clusters) { cluster in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(cluster.category.uppercased())
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(Color.theme.primary)
                            .tracking(0.5)

                        ForEach(cluster.themes, id: \.self) { theme in
                            HStack(alignment: .top, spacing: 8) {
                                Text("•")
                                    .foregroundColor(Color.theme.secondaryText)
                                Text(theme)
                                    .font(.caption)
                                    .foregroundColor(Color.theme.primaryText)
                            }
                        }
                    }
                }
            }
            .padding()
            .background(Color.theme.surface)
        }
    }

    // MARK: - Clinical Considerations Section
    private func clinicalConsiderationsSection(considerations: [String]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(icon: "lightbulb", title: "CLINICAL CONSIDERATIONS", color: Color.theme.success)

            VStack(alignment: .leading, spacing: 10) {
                ForEach(considerations, id: \.self) { consideration in
                    HStack(alignment: .top, spacing: 8) {
                        Text("•")
                            .foregroundColor(Color.theme.success)
                        Text(consideration)
                            .font(.caption)
                            .foregroundColor(Color.theme.primaryText)
                    }
                }
            }
            .padding()
            .background(Color.theme.surface)
        }
    }

    // MARK: - Risk Factors Section
    private func riskFactorsSection(risks: [String]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(icon: "exclamationmark.triangle.fill", title: "RISK FACTORS", color: Color.theme.error)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(risks, id: \.self) { risk in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "exclamationmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(Color.theme.error)
                        Text(risk)
                            .font(.caption)
                            .foregroundColor(Color.theme.primaryText)
                    }
                }
            }
            .padding()
            .background(Color.theme.error.opacity(0.1))
        }
    }

    // MARK: - Section Header Helper
    private func sectionHeader(icon: String, title: String, subtitle: String? = nil, color: Color) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
            Text(title)
                .font(.caption)
                .fontWeight(.bold)
                .tracking(1)
                .foregroundColor(color)
            if let subtitle = subtitle {
                Text("(\(subtitle))")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
            Spacer()
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(color.opacity(0.1))
    }

    // MARK: - Legacy Content (fallback for old format)
    private func legacyContentSection(prep: SessionPrep) -> some View {
        VStack(spacing: 16) {
            if let summary = prep.prep.summary {
                PrepCard(title: "Summary", icon: "doc.text") {
                    Text(summary)
                }
            }

            if let themes = prep.prep.keyThemes, !themes.isEmpty {
                PrepCard(title: "Key Themes", icon: "tag") {
                    FlowLayout(spacing: 8) {
                        ForEach(themes, id: \.self) { theme in
                            TagBadge(tag: theme)
                        }
                    }
                }
            }

            if let topics = prep.prep.suggestedTopics, !topics.isEmpty {
                PrepCard(title: "Suggested Topics", icon: "list.bullet") {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(topics, id: \.self) { item in
                            HStack(alignment: .top) {
                                Image(systemName: "circle.fill")
                                    .font(.system(size: 6))
                                    .padding(.top, 6)
                                Text(item)
                            }
                        }
                    }
                }
            }
        }
        .padding()
    }

    // MARK: - Regenerate Button
    private var regenerateButton: some View {
        Button(action: regeneratePrep) {
            HStack {
                if isRegenerating {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "sparkles")
                    Text("Regenerate AI Prep")
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.theme.primary)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
        .disabled(isRegenerating)
    }

    // MARK: - Actions
    private func loadData() async {
        guard !Task.isCancelled else { return }

        isLoading = true
        do {
            prepData = try await APIClient.shared.getSessionPrep(sessionId: sessionId)

            guard !Task.isCancelled else { return }

            isLoading = false
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch {
            guard !Task.isCancelled else { return }
            self.error = error
            isLoading = false
        }
    }

    private func regeneratePrep() {
        isRegenerating = true
        Task {
            do {
                let sessionInfo = try? await APIClient.shared.getSession(id: sessionId)
                let clientId = sessionInfo?.clientId

                prepData = try await APIClient.shared.generateSessionPrep(
                    sessionId: sessionId,
                    clientId: clientId
                )
                isRegenerating = false
            } catch {
                self.error = error
                isRegenerating = false
            }
        }
    }
}

// MARK: - Prep Card (for legacy content)
struct PrepCard<Content: View>: View {
    let title: String
    let icon: String
    let content: Content

    init(title: String, icon: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(Color.theme.primary)
                Text(title)
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)
            }

            content
                .foregroundColor(Color.theme.primaryText)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

#Preview {
    NavigationStack {
        SessionPrepView(sessionId: "test-session")
    }
}
