import SwiftUI

struct TherapeuticJourneyView: View {
    let clientId: String
    
    enum Tab: String, CaseIterable {
        case overview = "Overview"
        case insights = "Insights"
        case themes = "Themes"
        case emotions = "Emotions"
        case coping = "Coping"
    }
    
    @State private var selectedTab: Tab = .overview
    @State private var isLoading = false
    @State private var error: Error?
    @State private var journeyData: JourneyData?
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab Bar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 20) {
                    ForEach(Tab.allCases, id: \.self) { tab in
                        Button(action: { selectedTab = tab }) {
                            VStack(spacing: 8) {
                                Text(tab.rawValue)
                                    .fontWeight(selectedTab == tab ? .bold : .regular)
                                    .foregroundColor(selectedTab == tab ? Color.theme.primary : Color.theme.secondaryText)
                                
                                Rectangle()
                                    .fill(selectedTab == tab ? Color.theme.primary : Color.clear)
                                    .frame(height: 2)
                            }
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.top)
            .background(Color.theme.surface)
            
            // Content
            ScrollView {
                if isLoading {
                    ProgressView()
                        .padding(.top, 50)
                } else if let error = error {
                    Text("Error loading journey: \(error.localizedDescription)")
                        .foregroundColor(.red)
                        .padding()
                } else {
                    switch selectedTab {
                    case .overview:
                        OverviewTab(data: journeyData)
                    case .insights:
                        InsightsTab(data: journeyData)
                    case .themes:
                        ThemesTab(data: journeyData)
                    case .emotions:
                        EmotionsTab(data: journeyData)
                    case .coping:
                        CopingTab(data: journeyData)
                    }
                }
            }
        }
        .navigationTitle("Therapeutic Journey")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.theme.background)
        .task {
            await loadJourneyData()
        }
    }
    
    private func loadJourneyData() async {
        isLoading = true
        error = nil

        do {
            let record = try await APIClient.shared.getLatestLongitudinalRecord(clientId: clientId)
            journeyData = buildJourneyData(from: record.analysis)
        } catch let apiError as APIError {
            if case .notFound = apiError {
                do {
                    let record = try await APIClient.shared.generateLongitudinalRecord(clientId: clientId)
                    journeyData = buildJourneyData(from: record.analysis)
                } catch {
                    self.error = error
                }
            } else {
                self.error = apiError
            }
        } catch {
            self.error = error
        }

        isLoading = false
    }

    private func buildJourneyData(from analysis: LongitudinalAnalysis) -> JourneyData {
        let summaryParts = [
            analysis.treatmentPhase.map { "Treatment phase: \($0)" },
            analysis.engagementTrend.map { "Engagement trend: \($0)" },
            analysis.riskTrend.map { "Risk trend: \($0)" },
            analysis.terminationConsiderations?.isEmpty == false ? analysis.terminationConsiderations : nil
        ].compactMap { $0 }

        let keyMoments = (analysis.quantQualConnections ?? []) + (analysis.patternsClientMayNotSee ?? [])
        let insights = (analysis.focusRecommendations ?? []).isEmpty
            ? (analysis.whatsWorking ?? [])
            : (analysis.focusRecommendations ?? [])

        var themes: [(String, Double)] = []
        themes.append(contentsOf: (analysis.activeThemes ?? []).map { ($0, 0.9) })
        themes.append(contentsOf: (analysis.stuckThemes ?? []).map { ($0, 0.8) })
        themes.append(contentsOf: (analysis.resolvingThemes ?? []).map { ($0, 0.6) })

        // SECURITY FIX: Use compactMapValues instead of force unwrap to safely handle empty groups
        let uniqueThemes = Array(Dictionary(grouping: themes, by: { $0.0 }).compactMapValues { $0.first }.values)

        return JourneyData(
            summary: summaryParts.isEmpty ? "No longitudinal summary available yet." : summaryParts.joined(separator: " • "),
            keyMoments: Array(keyMoments.prefix(6)),
            insights: Array(insights.prefix(6)),
            themes: Array(uniqueThemes.prefix(8)),
            emotions: [],
            copingStrategies: Array((analysis.modalityAdjustments ?? []).prefix(6))
        )
    }
}

// MARK: - Subviews
struct OverviewTab: View {
    let data: JourneyData?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            JourneyCard(title: "Progress Summary") {
                Text(data?.summary ?? "No data")
                    .foregroundColor(Color.theme.primaryText)
            }
            
            JourneyCard(title: "Key Moments") {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(data?.keyMoments ?? [], id: \.self) { moment in
                        HStack(alignment: .top) {
                            Image(systemName: "star.fill")
                                .foregroundColor(.yellow)
                                .font(.caption)
                                .padding(.top, 4)
                            Text(moment)
                        }
                    }
                }
            }
        }
        .padding()
    }
}

struct InsightsTab: View {
    let data: JourneyData?
    
    var body: some View {
        VStack(spacing: 16) {
            ForEach(data?.insights ?? [], id: \.self) { insight in
                JourneyCard(title: "Clinical Insight") {
                    Text(insight)
                }
            }
        }
        .padding()
    }
}

struct ThemesTab: View {
    let data: JourneyData?
    
    var body: some View {
        VStack(spacing: 16) {
            Text("Identified Themes")
                .font(.headline)
            
            // Simple visualization
            ForEach(data?.themes ?? [], id: \.0) { theme, intensity in
                VStack(alignment: .leading) {
                    Text(theme)
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(Color.gray.opacity(0.2))
                                .frame(height: 8)
                                .cornerRadius(4)
                            
                            Rectangle()
                                .fill(Color.theme.primary)
                                .frame(width: geometry.size.width * intensity, height: 8)
                                .cornerRadius(4)
                        }
                    }
                    .frame(height: 8)
                }
            }
        }
        .padding()
    }
}

struct EmotionsTab: View {
    let data: JourneyData?
    
    var body: some View {
        VStack(spacing: 16) {
            Text("Emotional Trajectory")
                .font(.headline)
            
            ForEach(data?.emotions ?? [], id: \.0) { emotion, level in
                HStack {
                    Text(emotion)
                        .frame(width: 80, alignment: .leading)
                    ForEach(1...10, id: \.self) { i in
                        Circle()
                            .fill(i <= level ? Color.theme.accent : Color.gray.opacity(0.2))
                            .frame(width: 8, height: 8)
                    }
                }
            }
        }
        .padding()
    }
}

struct CopingTab: View {
    let data: JourneyData?
    
    var body: some View {
        VStack(spacing: 16) {
            JourneyCard(title: "Coping Strategies") {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(data?.copingStrategies ?? [], id: \.self) { strategy in
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text(strategy)
                        }
                    }
                }
            }
        }
        .padding()
    }
}

struct JourneyCard<Content: View>: View {
    let title: String
    let content: Content
    
    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)
            
            content
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.surface)
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}

struct JourneyData {
    let summary: String
    let keyMoments: [String]
    let insights: [String]
    let themes: [(String, Double)]
    let emotions: [(String, Int)]
    let copingStrategies: [String]
}
