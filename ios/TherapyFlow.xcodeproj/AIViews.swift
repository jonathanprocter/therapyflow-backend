import SwiftUI

// MARK: - AI Dashboard View
struct AIDashboardView: View {
    @State private var insights: [AIInsight] = []
    @State private var isLoading = true
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "brain")
                            .font(.title)
                            .foregroundColor(.purple)
                        
                        Text("AI Insights")
                            .font(.title)
                            .fontWeight(.bold)
                    }
                    
                    Text("Powered by AI to help you provide better care")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                }
                .padding()
                
                if isLoading {
                    LoadingView()
                } else if insights.isEmpty {
                    EmptyStateView(
                        icon: "sparkles",
                        title: "No Insights Yet",
                        message: "AI insights will appear here as you add more data to TherapyFlow."
                    )
                } else {
                    LazyVStack(spacing: 16) {
                        ForEach(insights) { insight in
                            AIInsightCard(insight: insight)
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationTitle("AI Dashboard")
        .task {
            await loadInsights()
        }
    }
    
    private func loadInsights() async {
        do {
            // Mock data for now
            insights = []
            isLoading = false
        } catch {
            print("Error loading insights: \(error)")
            isLoading = false
        }
    }
}

struct AIInsightCard: View {
    let insight: AIInsight
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: iconForType(insight.type))
                    .foregroundColor(colorForPriority(insight.priority))
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(insight.title)
                        .font(.headline)
                    
                    Text(insight.type.rawValue.capitalized)
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
                
                Spacer()
                
                PriorityBadge(priority: insight.priority)
            }
            
            Text(insight.content)
                .font(.body)
                .foregroundColor(Color.theme.primaryText)
            
            HStack {
                Text(insight.createdAt.smartDateTimeString)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
                
                Spacer()
                
                if !insight.isRead {
                    Circle()
                        .fill(Color.theme.primary)
                        .frame(width: 8, height: 8)
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(colorForPriority(insight.priority).opacity(0.3), lineWidth: 1)
        )
    }
    
    private func iconForType(_ type: InsightType) -> String {
        switch type {
        case .pattern: return "chart.line.uptrend.xyaxis"
        case .risk: return "exclamationmark.triangle"
        case .progress: return "checkmark.circle"
        case .recommendation: return "lightbulb"
        }
    }
    
    private func colorForPriority(_ priority: InsightPriority) -> Color {
        switch priority {
        case .low: return Color.theme.info
        case .medium: return Color.theme.warning
        case .high: return Color.theme.error
        case .critical: return Color.theme.error
        }
    }
}

struct PriorityBadge: View {
    let priority: InsightPriority
    
    var body: some View {
        Text(priority.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .cornerRadius(6)
    }
    
    private var color: Color {
        switch priority {
        case .low: return Color.theme.info
        case .medium: return Color.theme.warning
        case .high: return Color.theme.error
        case .critical: return Color.theme.error
        }
    }
}

// MARK: - Session Timeline View
struct SessionTimelineView: View {
    @State private var selectedClient: Client?
    @State private var sessions: [Session] = []
    @State private var isLoading = false
    
    var body: some View {
        VStack {
            // Client selector
            Button(action: {}) {
                HStack {
                    Text(selectedClient?.name ?? "Select Client")
                        .foregroundColor(selectedClient == nil ? Color.theme.secondaryText : Color.theme.primaryText)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .foregroundColor(Color.theme.secondaryText)
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(10)
            }
            .padding()
            
            if let client = selectedClient {
                if isLoading {
                    LoadingView()
                } else if sessions.isEmpty {
                    EmptyStateView(
                        icon: "chart.line.uptrend.xyaxis",
                        title: "No Session History",
                        message: "No sessions found for \(client.name)."
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            ForEach(sessions) { session in
                                TimelineSessionCard(session: session)
                            }
                        }
                        .padding()
                    }
                }
            } else {
                EmptyStateView(
                    icon: "person.crop.circle",
                    title: "Select a Client",
                    message: "Choose a client to view their session timeline."
                )
            }
        }
        .navigationTitle("Session Timeline")
    }
}

struct TimelineSessionCard: View {
    let session: Session
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Timeline indicator
            VStack {
                Circle()
                    .fill(session.status.themeColor)
                    .frame(width: 12, height: 12)
                
                Rectangle()
                    .fill(Color.theme.border)
                    .frame(width: 2)
            }
            
            // Session info
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(session.formattedDate)
                        .font(.headline)
                    
                    Spacer()
                    
                    SessionStatusBadge(status: session.status)
                }
                
                Text(session.sessionType.displayName)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                
                Text(session.formattedTimeRange)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
                
                if let notes = session.notes {
                    Text(notes)
                        .font(.body)
                        .foregroundColor(Color.theme.primaryText)
                        .lineLimit(3)
                        .padding(.top, 4)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.surface)
            .cornerRadius(12)
        }
    }
}

// MARK: - AI Notes Assistant View
struct AINotesAssistantView: View {
    @State private var noteContent = ""
    @State private var isGenerating = false
    @State private var selectedClient: Client?
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "sparkles")
                        .foregroundColor(.purple)
                    Text("AI Note Assistant")
                        .font(.headline)
                }
                
                Text("Let AI help you draft professional progress notes")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.surface)
            
            // Client selector
            Button(action: {}) {
                HStack {
                    Text(selectedClient?.name ?? "Select Client")
                        .foregroundColor(selectedClient == nil ? Color.theme.secondaryText : Color.theme.primaryText)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .foregroundColor(Color.theme.secondaryText)
                }
                .padding()
                .background(Color.theme.surface)
            }
            .padding()
            
            // Note editor
            TextEditor(text: $noteContent)
                .padding(8)
                .background(Color.theme.surface)
                .cornerRadius(8)
                .padding()
            
            // Actions
            VStack(spacing: 12) {
                Button(action: { Task { await generateDraft() } }) {
                    HStack {
                        if isGenerating {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Image(systemName: "sparkles")
                        }
                        Text(isGenerating ? "Generating..." : "Generate Draft")
                    }
                    .primaryButtonStyle()
                }
                .disabled(selectedClient == nil || isGenerating)
                
                HStack(spacing: 12) {
                    Button("Clear") {
                        noteContent = ""
                    }
                    .secondaryButtonStyle()
                    
                    Button("Save Note") {
                        // Save logic
                    }
                    .primaryButtonStyle()
                    .disabled(noteContent.isEmpty)
                }
            }
            .padding()
        }
        .navigationTitle("AI Assistant")
    }
    
    private func generateDraft() async {
        guard let client = selectedClient else { return }
        
        isGenerating = true
        defer { isGenerating = false }
        
        do {
            let request = AINoteDraftRequest(
                clientId: client.id,
                sessionDate: Date(),
                existingNotes: noteContent.isEmpty ? nil : noteContent
            )
            
            let response = try await APIClient.shared.generateNoteDraft(request: request)
            noteContent = response.draftContent
        } catch {
            print("Error generating draft: \(error)")
        }
    }
}

// MARK: - Semantic Search View
struct SemanticSearchView: View {
    @State private var searchQuery = ""
    @State private var searchResults: [SearchResult] = []
    @State private var isSearching = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Search header
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "magnifyingglass.circle.fill")
                        .foregroundColor(.purple)
                        .font(.title2)
                    Text("Semantic Search")
                        .font(.headline)
                }
                
                Text("Search across all your notes and documents using natural language")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.surface)
            
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(Color.theme.secondaryText)
                
                TextField("e.g., 'clients showing signs of anxiety'", text: $searchQuery)
                    .textFieldStyle(PlainTextFieldStyle())
                    .submitLabel(.search)
                    .onSubmit {
                        Task { await performSearch() }
                    }
                
                if isSearching {
                    ProgressView()
                } else if !searchQuery.isEmpty {
                    Button(action: { searchQuery = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
            }
            .padding()
            .background(Color.theme.surface)
            .cornerRadius(10)
            .padding()
            
            // Results
            if searchResults.isEmpty && !searchQuery.isEmpty && !isSearching {
                EmptyStateView(
                    icon: "doc.text.magnifyingglass",
                    title: "No Results",
                    message: "Try a different search query."
                )
            } else if !searchResults.isEmpty {
                List(searchResults) { result in
                    SearchResultRow(result: result)
                }
                .listStyle(.plain)
            } else {
                EmptyStateView(
                    icon: "text.magnifyingglass",
                    title: "AI-Powered Search",
                    message: "Search your notes and documents using natural language queries."
                )
            }
        }
        .navigationTitle("Search")
    }
    
    private func performSearch() async {
        guard !searchQuery.isEmpty else { return }
        
        isSearching = true
        defer { isSearching = false }
        
        do {
            // Mock search - replace with actual API call
            searchResults = []
        } catch {
            print("Search error: \(error)")
        }
    }
}

struct SearchResult: Identifiable {
    let id = UUID()
    let title: String
    let snippet: String
    let type: String
    let relevance: Double
}

struct SearchResultRow: View {
    let result: SearchResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(result.type.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.theme.primary.opacity(0.15))
                    .foregroundColor(Color.theme.primary)
                    .cornerRadius(6)
                
                Spacer()
                
                Text("\(Int(result.relevance * 100))% match")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
            
            Text(result.title)
                .font(.headline)
            
            Text(result.snippet)
                .font(.body)
                .foregroundColor(Color.theme.secondaryText)
                .lineLimit(2)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Treatment Plans List View
struct TreatmentPlansListView: View {
    @State private var plans: [TreatmentPlan] = []
    @State private var isLoading = true
    
    var body: some View {
        Group {
            if isLoading {
                LoadingView(message: "Loading treatment plans...")
            } else if plans.isEmpty {
                EmptyStateView(
                    icon: "list.clipboard",
                    title: "No Treatment Plans",
                    message: "Create treatment plans to track client progress."
                )
            } else {
                List(plans) { plan in
                    NavigationLink(destination: TreatmentPlanDetailView(planId: plan.id)) {
                        TreatmentPlanRow(plan: plan)
                    }
                }
            }
        }
        .navigationTitle("Treatment Plans")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: {}) {
                    Image(systemName: "plus")
                }
            }
        }
        .task {
            await loadPlans()
        }
    }
    
    private func loadPlans() async {
        do {
            plans = try await APIClient.shared.request(endpoint: "/api/treatment-plans")
            isLoading = false
        } catch {
            print("Error loading plans: \(error)")
            isLoading = false
        }
    }
}

struct TreatmentPlanRow: View {
    let plan: TreatmentPlan
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(plan.title)
                .font(.headline)
            
            Text("\(plan.goals.count) goals")
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
        }
        .padding(.vertical, 4)
    }
}

struct TreatmentPlanDetailView: View {
    let planId: String
    
    var body: some View {
        Text("Treatment Plan Detail")
            .navigationTitle("Treatment Plan")
    }
}

// MARK: - AI Contextual Helper View
struct AIContextualHelperView: View {
    let context: AIAssistantService.AppContext
    @State private var isVisible = false
    
    var body: some View {
        // Floating AI helper button
        VStack {
            Spacer()
            HStack {
                Spacer()
                Button(action: { isVisible.toggle() }) {
                    Image(systemName: "sparkles")
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.purple)
                        .clipShape(Circle())
                        .shadow(radius: 4)
                }
                .padding()
            }
        }
    }
}

// MARK: - AI Assistant Service (Stub)
actor AIAssistantService {
    enum AppContext {
        case dashboard
        case clients
        case calendar
        case notes
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        AIDashboardView()
    }
}
