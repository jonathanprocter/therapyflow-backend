import SwiftUI

struct ContentView: View {
    @State private var selectedTab: Tab = .dashboard

    var body: some View {
        ContentRootView(selectedTab: $selectedTab)
    }
}

private struct ContentRootView: View {
    @Binding var selectedTab: Tab
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var networkMonitor: NetworkMonitor

    var body: some View {
        ZStack {
            MainContentView(selectedTab: $selectedTab)
            UnifiedFloatingAssistant(context: aiContext(for: selectedTab))
        }
        .environmentObject(appState)
        .environmentObject(networkMonitor)
    }

    private func aiContext(for tab: Tab) -> AIAssistantService.AppContext {
        switch tab {
        case .dashboard: return .dashboard
        case .clients: return .clients
        case .calendar: return .calendar
        case .notes: return .notes
        case .quickNotes: return .notes
        default: return .dashboard
        }
    }
}

private struct MainContentView: View {
    @Binding var selectedTab: Tab
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        if horizontalSizeClass == .regular {
            IPadLayoutView(selectedTab: $selectedTab)
        } else {
            IPhoneLayoutView(selectedTab: $selectedTab)
        }
    }
}

private struct IPadLayoutView: View {
    @Binding var selectedTab: Tab
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var networkMonitor: NetworkMonitor

    var body: some View {
        NavigationSplitView {
            List {
                Section("Clinical") {
                    ForEach(Tab.clinicalTabs, id: \.self) { tab in
                        SidebarButtonView(selectedTab: $selectedTab, tab: tab)
                    }
                }

                Section("AI Features") {
                    ForEach(Tab.aiTabs, id: \.self) { tab in
                        SidebarButtonView(selectedTab: $selectedTab, tab: tab)
                    }
                }

                Section("Documents") {
                    ForEach(Tab.documentTabs, id: \.self) { tab in
                        SidebarButtonView(selectedTab: $selectedTab, tab: tab)
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationTitle("TherapyFlow")
            .toolbar {
                ToolbarItem(placement: .bottomBar) {
                    HStack {
                        if !networkMonitor.isConnected {
                            Label("Offline", systemImage: "wifi.slash")
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                        Spacer()
                        Button(action: { appState.showingSettings = true }) {
                            Image(systemName: "gear")
                        }
                    }
                }
            }
        } detail: {
            NavigationStack {
                SelectedTabContentView(tab: selectedTab)
            }
        }
        .sheet(isPresented: $appState.showingSettings) {
            NavigationStack {
                SettingsView()
            }
        }
    }
}

private struct IPhoneLayoutView: View {
    @Binding var selectedTab: Tab
    @EnvironmentObject private var networkMonitor: NetworkMonitor

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(Tab.phoneTabs, id: \.self) { tab in
                NavigationStack {
                    if tab == .more {
                        MoreMenuView(selectedTab: $selectedTab)
                    } else {
                        SelectedTabContentView(tab: tab)
                    }
                }
                .tabItem {
                    Label(tab.title, systemImage: tab.icon)
                }
                .tag(tab)
            }
        }
        .tint(Color.theme.primary)
        .overlay(alignment: .top) {
            if !networkMonitor.isConnected {
                OfflineBannerView()
            }
        }
    }
}

private struct MoreMenuView: View {
    @Binding var selectedTab: Tab
    @ObservedObject private var integrationsService = IntegrationsService.shared
    @ObservedObject private var elevenLabs = ElevenLabsConversationalService.shared

    var body: some View {
        List {
            Section("Quick Notes") {
                NavigationLink {
                    RecentQuickNotesView()
                } label: {
                    Label {
                        HStack {
                            Text("Voice Notes & Reminders")
                            Spacer()
                            Text("NEW")
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.green.opacity(0.2))
                                .foregroundColor(.green)
                                .cornerRadius(4)
                        }
                    } icon: {
                        Image(systemName: "mic.badge.plus")
                            .foregroundColor(.green)
                    }
                }
            }

            // Integrations Section - AI, Voice, Calendar
            Section("Integrations") {
                // AI Analysis & Insights
                NavigationLink {
                    AIConfigurationView()
                } label: {
                    Label {
                        HStack {
                            Text("AI Analysis & Insights")
                            Spacer()
                            if integrationsService.isAIConfigured {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Color.theme.success)
                                    .font(.caption)
                            }
                        }
                    } icon: {
                        Image(systemName: "sparkles")
                            .foregroundColor(Color.theme.accent)
                    }
                }

                // ElevenLabs Voice AI
                NavigationLink {
                    ElevenLabsConfigurationView()
                } label: {
                    Label {
                        HStack {
                            Text("ElevenLabs Voice AI")
                            Spacer()
                            if elevenLabs.hasAPIKey() {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Color.theme.success)
                                    .font(.caption)
                            }
                        }
                    } icon: {
                        Image(systemName: "waveform.and.mic")
                            .foregroundColor(.purple)
                    }
                }

                // Google Calendar
                NavigationLink {
                    GoogleCalendarSettingsView()
                } label: {
                    Label {
                        HStack {
                            Text("Google Calendar")
                            Spacer()
                            if integrationsService.googleCalendarConnected {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Color.theme.success)
                                    .font(.caption)
                            }
                        }
                    } icon: {
                        Image(systemName: "calendar")
                            .foregroundColor(.blue)
                    }
                }

                // All Integrations
                NavigationLink {
                    IntegrationsView()
                } label: {
                    Label {
                        HStack {
                            Text("All Integrations")
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(Color.theme.tertiaryText)
                        }
                    } icon: {
                        Image(systemName: "link")
                            .foregroundColor(Color.theme.primary)
                    }
                }
            }

            Section("AI Features") {
                ForEach(Tab.aiTabs, id: \.self) { tab in
                    NavigationLink {
                        SelectedTabContentView(tab: tab)
                    } label: {
                        Label {
                            HStack {
                                Text(tab.title)
                                Spacer()
                                if let badge = tab.badge {
                                    Text(badge)
                                        .font(.caption2)
                                        .fontWeight(.semibold)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.purple.opacity(0.2))
                                        .foregroundColor(.purple)
                                        .cornerRadius(4)
                                }
                            }
                        } icon: {
                            Image(systemName: tab.icon)
                                .foregroundColor(.purple)
                        }
                    }
                }
            }

            Section("Documents & Search") {
                ForEach(Tab.documentTabs, id: \.self) { tab in
                    NavigationLink {
                        SelectedTabContentView(tab: tab)
                    } label: {
                        Label(tab.title, systemImage: tab.icon)
                    }
                }
            }

            Section("Settings") {
                NavigationLink {
                    SettingsView()
                } label: {
                    Label("Settings", systemImage: "gear")
                }

                NavigationLink {
                    CalendarSyncView()
                } label: {
                    Label("Calendar Sync", systemImage: "arrow.triangle.2.circlepath")
                }
            }
        }
        .navigationTitle("More")
    }
}

private struct SelectedTabContentView: View {
    let tab: Tab

    var body: some View {
        switch tab {
        case .dashboard:
            DashboardView()
        case .clients:
            ClientsListView()
        case .notes:
            NotesListView()
        case .calendar:
            CalendarView()
        case .quickNotes:
            RecentQuickNotesView()
        case .search:
            SemanticSearchView()
        case .documents:
            DocumentsListView()
        case .treatmentPlans:
            TreatmentPlansListView()
        case .aiDashboard:
            AIDashboardView()
        case .sessionTimeline:
            SessionTimelineView()
        case .aiNoteAssistant:
            AINotesAssistantView()
        case .settings:
            SettingsView()
        case .more:
            Text("More")
        }
    }
}

private struct SidebarButtonView: View {
    @Binding var selectedTab: Tab
    let tab: Tab

    var body: some View {
        Button {
            selectedTab = tab
        } label: {
            Label {
                HStack {
                    Text(tab.title)
                    Spacer()
                    if let badge = tab.badge {
                        Text(badge)
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.2))
                            .foregroundColor(.blue)
                            .cornerRadius(4)
                    }
                }
            } icon: {
                Image(systemName: tab.icon)
                    .foregroundColor(tab.isAI ? .purple : .primary)
            }
        }
        .listRowBackground(selectedTab == tab ? Color.theme.primary.opacity(0.15) : Color.clear)
        .foregroundColor(selectedTab == tab ? Color.theme.primary : Color.primary)
    }
}

private struct OfflineBannerView: View {
    var body: some View {
        HStack {
            Image(systemName: "wifi.slash")
            Text("You're offline. Changes will sync when connected.")
                .font(.caption)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.orange.opacity(0.9))
        .foregroundColor(.white)
        .cornerRadius(8)
        .padding(.top, 4)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}

// MARK: - Tab Enum
enum Tab: String, CaseIterable {
    case dashboard
    case clients
    case notes
    case calendar
    case quickNotes
    case search
    case documents
    case treatmentPlans
    case aiDashboard
    case sessionTimeline
    case aiNoteAssistant
    case settings
    case more

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .clients: return "Clients"
        case .notes: return "Notes"
        case .calendar: return "Calendar"
        case .quickNotes: return "Quick Notes"
        case .search: return "Search"
        case .documents: return "Documents"
        case .treatmentPlans: return "Treatment Plans"
        case .aiDashboard: return "AI Dashboard"
        case .sessionTimeline: return "Session Timeline"
        case .aiNoteAssistant: return "AI Note Assistant"
        case .settings: return "Settings"
        case .more: return "More"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .clients: return "person.2"
        case .notes: return "doc.text"
        case .calendar: return "calendar"
        case .quickNotes: return "mic.badge.plus"
        case .search: return "magnifyingglass"
        case .documents: return "folder"
        case .treatmentPlans: return "list.clipboard"
        case .aiDashboard: return "brain"
        case .sessionTimeline: return "chart.line.uptrend.xyaxis"
        case .aiNoteAssistant: return "sparkles"
        case .settings: return "gear"
        case .more: return "ellipsis.circle"
        }
    }
    
    var badge: String? {
        switch self {
        case .aiDashboard, .aiNoteAssistant: return "AI"
        case .sessionTimeline: return "NEW"
        default: return nil
        }
    }
    
    var isAI: Bool {
        switch self {
        case .aiDashboard, .aiNoteAssistant, .search: return true
        default: return false
        }
    }

    // Tabs shown in iPhone TabView (5 tabs max for good UX)
    static var phoneTabs: [Tab] {
        [.dashboard, .clients, .calendar, .notes, .more]
    }

    // Clinical tabs for iPad sidebar
    static var clinicalTabs: [Tab] {
        [.dashboard, .clients, .notes, .calendar, .quickNotes, .treatmentPlans]
    }
    
    // AI feature tabs
    static var aiTabs: [Tab] {
        [.aiDashboard, .aiNoteAssistant, .sessionTimeline, .search]
    }
    
    // Document tabs
    static var documentTabs: [Tab] {
        [.documents, .search]
    }

    // All tabs shown in iPad sidebar
    static var padTabs: [Tab] {
        allCases.filter { $0 != .settings && $0 != .more }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState.shared)
        .environmentObject(NetworkMonitor.shared)
}
