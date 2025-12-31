import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var networkMonitor: NetworkMonitor

    @State private var selectedTab: Tab = .dashboard

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
                ForEach(Tab.padTabs, id: \.self) { tab in
                    Button {
                        selectedTab = tab
                    } label: {
                        Label(tab.title, systemImage: tab.icon)
                    }
                    .listRowBackground(selectedTab == tab ? Color.theme.primary.opacity(0.15) : Color.clear)
                    .foregroundColor(selectedTab == tab ? Color.theme.primary : Color.primary)
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

    // MARK: - iPhone Layout (Tab View)
    private var iPhoneLayout: some View {
        TabView(selection: $selectedTab) {
            ForEach(Tab.phoneTabs, id: \.self) { tab in
                NavigationStack {
                    selectedTabContent(for: tab)
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
        case .settings:
            SettingsView()
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
    case settings

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .clients: return "Clients"
        case .notes: return "Notes"
        case .calendar: return "Calendar"
        case .search: return "Search"
        case .documents: return "Documents"
        case .treatmentPlans: return "Treatment Plans"
        case .settings: return "Settings"
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
        case .settings: return "gear"
        }
    }

    // Tabs shown in iPhone TabView (limit to 5 for better UX)
    static var phoneTabs: [Tab] {
        [.dashboard, .clients, .notes, .calendar, .settings]
    }

    // All tabs shown in iPad sidebar
    static var padTabs: [Tab] {
        allCases.filter { $0 != .settings } // Settings accessed separately on iPad
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState.shared)
        .environmentObject(NetworkMonitor.shared)
}
