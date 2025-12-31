import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var networkMonitor: NetworkMonitor

    @State private var selectedTab: Tab = .dashboard
    @State private var showMoreMenu = false

    // iPad detection for adaptive layout
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ZStack {
            mainContent

            // AI Contextual Helper - floating overlay
            AIContextualHelperView(context: currentAIContext)
        }
    }

    /// Get the current AI context based on selected tab
    private var currentAIContext: AIAssistantService.AppContext {
        switch selectedTab {
        case .dashboard: return .dashboard
        case .clients: return .clients
        case .calendar: return .calendar
        case .notes: return .notes
        default: return .dashboard
        }
    }

    @ViewBuilder
    private var mainContent: some View {
        if horizontalSizeClass == .regular {
            // iPad: Use NavigationSplitView for master-detail layout
            iPadLayout
        } else {
            // iPhone: Use TabView
            iPhoneLayout
        }
    }

    // MARK: - iPad Layout (Split View)
    private var iPadLayout: some View {
        NavigationSplitView {
            // Sidebar
            List {
                Section("Clinical") {
                    ForEach(Tab.clinicalTabs, id: \.self) { tab in
                        sidebarButton(for: tab)
                    }
                }
                
                Section("AI Features") {
                    ForEach(Tab.aiTabs, id: \.self) { tab in
                        sidebarButton(for: tab)
                    }
                }
                
                Section("Documents") {
                    ForEach(Tab.documentTabs, id: \.self) { tab in
                        sidebarButton(for: tab)
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
            // Detail view based on selected tab
            NavigationStack {
                selectedTabView
            }
        }
        .sheet(isPresented: $appState.showingSettings) {
            NavigationStack {
                SettingsView()
            }
        }
    }
    
    private func sidebarButton(for tab: Tab) -> some View {
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

    // MARK: - iPhone Layout (Tab View)
    private var iPhoneLayout: some View {
        TabView(selection: $selectedTab) {
            ForEach(Tab.phoneTabs, id: \.self) { tab in
                NavigationStack {
                    if tab == .more {
                        moreMenuView
                    } else {
                        selectedTabContent(for: tab)
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
                offlineBanner
            }
        }
    }
    
    // MARK: - More Menu View (for additional features on iPhone)
    private var moreMenuView: some View {
        List {
            Section("AI Features") {
                ForEach(Tab.aiTabs, id: \.self) { tab in
                    NavigationLink {
                        selectedTabContent(for: tab)
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
                        selectedTabContent(for: tab)
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

    @ViewBuilder
    private var selectedTabView: some View {
        selectedTabContent(for: selectedTab)
    }

    @ViewBuilder
    private func selectedTabContent(for tab: Tab) -> some View {
        switch tab {
        case .dashboard:
            DashboardView()
        case .clients:
            ClientsListView()
        case .notes:
            NotesListView()
        case .calendar:
            CalendarView()
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
            moreMenuView
        }
    }

    private var offlineBanner: some View {
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
        [.dashboard, .clients, .notes, .calendar, .treatmentPlans]
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
