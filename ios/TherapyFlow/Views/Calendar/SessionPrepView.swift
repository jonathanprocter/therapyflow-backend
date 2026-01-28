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
                VStack(spacing: 24) {
                    // Header
                    headerSection(prep: prep)

                    // Main Content
                    VStack(spacing: 20) {
                        if let summary = prep.prep.summary {
                            PrepCard(title: "Summary", icon: "doc.text") {
                                Text(summary)
                            }
                        }

                        if let recentProgress = prep.prep.recentProgress {
                            PrepCard(title: "Recent Progress", icon: "chart.line.uptrend.xyaxis") {
                                Text(recentProgress)
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

                        if let riskFactors = prep.prep.riskFactors, !riskFactors.isEmpty {
                            PrepCard(title: "Risk Factors", icon: "exclamationmark.triangle") {
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(riskFactors, id: \.self) { risk in
                                        HStack(alignment: .top) {
                                            Image(systemName: "exclamationmark.circle.fill")
                                                .foregroundColor(.orange)
                                                .font(.caption)
                                            Text(risk)
                                        }
                                    }
                                }
                            }
                        }

                        if let interventions = prep.prep.recommendedInterventions, !interventions.isEmpty {
                            PrepCard(title: "Recommended Interventions", icon: "brain.head.profile") {
                                VStack(alignment: .leading, spacing: 12) {
                                    ForEach(interventions, id: \.self) { intervention in
                                        HStack {
                                            Image(systemName: "checkmark.shield")
                                                .foregroundColor(.blue)
                                            Text(intervention)
                                        }
                                    }
                                }
                            }
                        }

                        if let goalUpdates = prep.prep.treatmentGoalUpdates, !goalUpdates.isEmpty {
                            PrepCard(title: "Treatment Goal Updates", icon: "target") {
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(goalUpdates, id: \.self) { update in
                                        HStack(alignment: .top) {
                                            Image(systemName: "arrow.right.circle.fill")
                                                .foregroundColor(.green)
                                                .font(.caption)
                                            Text(update)
                                        }
                                    }
                                }
                            }
                        }
                    }

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
                .padding()
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Session Prep")
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

    // MARK: - Sections
    private func headerSection(prep: SessionPrep) -> some View {
        VStack(spacing: 8) {
            Text("Session Preparation")
                .font(.title2)
                .fontWeight(.bold)

            Text("AI-generated insights for your upcoming session")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
        }
        .padding(.bottom)
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
                // Fetch session to get clientId for follow-up items
                let sessionInfo = try? await APIClient.shared.getSession(id: sessionId)
                let clientId = sessionInfo?.clientId

                // Generate prep with pending follow-ups for this client
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
