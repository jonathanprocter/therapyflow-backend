import SwiftUI

// MARK: - Settings View
struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var authService: AuthService
    @Environment(\.dismiss) private var dismiss
    
    @State private var showingLogoutAlert = false
    @State private var showingClearCacheAlert = false
    
    var body: some View {
        List {
            // Profile Section
            Section {
                if let user = authService.currentUser {
                    HStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(Color.theme.primary.opacity(0.2))
                                .frame(width: 60, height: 60)
                            
                            Text(user.name.prefix(1))
                                .font(.title)
                                .foregroundColor(Color.theme.primary)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(user.name)
                                .font(.headline)
                            
                            Text(user.email)
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)
                            
                            if let title = user.professionalTitle {
                                Text(title)
                                    .font(.caption)
                                    .foregroundColor(Color.theme.secondaryText)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
            } header: {
                Text("Profile")
            }
            
            // Preferences
            Section {
                Toggle("Notifications", isOn: $appState.notificationsEnabled)
                Toggle("Dark Mode", isOn: $appState.darkModeEnabled)
                Toggle("Haptic Feedback", isOn: $appState.hapticFeedbackEnabled)
            } header: {
                Text("Preferences")
            }
            
            // Security
            Section {
                Toggle("Biometric Authentication", isOn: $appState.isBiometricEnabled)
                
                NavigationLink {
                    Text("Privacy Settings")
                } label: {
                    Label("Privacy", systemImage: "lock.shield")
                }
            } header: {
                Text("Security")
            } footer: {
                Text("Use Face ID or Touch ID to unlock TherapyFlow")
            }
            
            // Integrations
            Section {
                NavigationLink {
                    CalendarSyncView()
                } label: {
                    Label("Calendar Sync", systemImage: "calendar.badge.plus")
                }
                
                NavigationLink {
                    Text("Google Integration")
                } label: {
                    Label("Google Calendar", systemImage: "globe")
                }
                
                NavigationLink {
                    Text("SimplePractice Integration")
                } label: {
                    Label("SimplePractice", systemImage: "heart.text.square")
                }
            } header: {
                Text("Integrations")
            }
            
            // Data & Storage
            Section {
                NavigationLink {
                    DataExportView()
                } label: {
                    Label("Export Data", systemImage: "square.and.arrow.up")
                }
                
                Button {
                    showingClearCacheAlert = true
                } label: {
                    HStack {
                        Label("Clear Cache", systemImage: "trash")
                        Spacer()
                        Text(appState.cacheSize)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
            } header: {
                Text("Data & Storage")
            }
            
            // About
            Section {
                HStack {
                    Text("Version")
                    Spacer()
                    Text(appState.fullVersion)
                        .foregroundColor(Color.theme.secondaryText)
                }
                
                NavigationLink {
                    Text("Terms of Service")
                } label: {
                    Text("Terms of Service")
                }
                
                NavigationLink {
                    Text("Privacy Policy")
                } label: {
                    Text("Privacy Policy")
                }
                
                NavigationLink {
                    SupportView()
                } label: {
                    Label("Support", systemImage: "questionmark.circle")
                }
            } header: {
                Text("About")
            }
            
            // Account
            Section {
                Button(role: .destructive) {
                    showingLogoutAlert = true
                } label: {
                    HStack {
                        Spacer()
                        Text("Log Out")
                        Spacer()
                    }
                }
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
        .alert("Log Out", isPresented: $showingLogoutAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Log Out", role: .destructive) {
                authService.logout()
            }
        } message: {
            Text("Are you sure you want to log out?")
        }
        .alert("Clear Cache", isPresented: $showingClearCacheAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Clear", role: .destructive) {
                appState.clearCache()
            }
        } message: {
            Text("This will clear cached data and free up \(appState.cacheSize) of storage.")
        }
    }
}

// MARK: - Calendar Sync View
struct CalendarSyncView: View {
    @State private var isGoogleConnected = false
    @State private var isSimplePracticeConnected = false
    @State private var autoSync = true
    @State private var lastSyncDate: Date?
    @State private var isSyncing = false
    
    var body: some View {
        List {
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Google Calendar")
                            .font(.headline)
                        Text(isGoogleConnected ? "Connected" : "Not Connected")
                            .font(.caption)
                            .foregroundColor(isGoogleConnected ? Color.theme.success : Color.theme.secondaryText)
                    }
                    
                    Spacer()
                    
                    Button(isGoogleConnected ? "Disconnect" : "Connect") {
                        Task {
                            await toggleGoogleConnection()
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(isGoogleConnected ? .red : .blue)
                }
                .padding(.vertical, 4)
                
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("SimplePractice")
                            .font(.headline)
                        Text(isSimplePracticeConnected ? "Connected" : "Not Connected")
                            .font(.caption)
                            .foregroundColor(isSimplePracticeConnected ? Color.theme.success : Color.theme.secondaryText)
                    }
                    
                    Spacer()
                    
                    Button(isSimplePracticeConnected ? "Disconnect" : "Connect") {
                        Task {
                            await toggleSimplePracticeConnection()
                        }
                    }
                    .buttonStyle(.bordered)
                    .tint(isSimplePracticeConnected ? .red : .blue)
                }
                .padding(.vertical, 4)
            } header: {
                Text("Connected Services")
            }
            
            Section {
                Toggle("Automatic Sync", isOn: $autoSync)
                
                if let lastSync = lastSyncDate {
                    HStack {
                        Text("Last Synced")
                        Spacer()
                        Text(lastSync.smartDateTimeString)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                    .font(.caption)
                }
                
                Button {
                    Task {
                        await performManualSync()
                    }
                } label: {
                    HStack {
                        Spacer()
                        if isSyncing {
                            ProgressView()
                            Text("Syncing...")
                        } else {
                            Label("Sync Now", systemImage: "arrow.triangle.2.circlepath")
                        }
                        Spacer()
                    }
                }
                .disabled(isSyncing)
            } header: {
                Text("Sync Settings")
            } footer: {
                Text("Automatically sync calendar events with connected services")
            }
        }
        .navigationTitle("Calendar Sync")
    }
    
    private func toggleGoogleConnection() async {
        if isGoogleConnected {
            // Disconnect
            isGoogleConnected = false
        } else {
            // Connect
            do {
                try await IntegrationsService.shared.authorizeGoogle()
                isGoogleConnected = true
            } catch {
                print("Google connection error: \(error)")
            }
        }
    }
    
    private func toggleSimplePracticeConnection() async {
        if isSimplePracticeConnected {
            // Disconnect
            isSimplePracticeConnected = false
        } else {
            // Connect
            do {
                try await IntegrationsService.shared.authorizeSimplePractice()
                isSimplePracticeConnected = true
            } catch {
                print("SimplePractice connection error: \(error)")
            }
        }
    }
    
    private func performManualSync() async {
        isSyncing = true
        defer { isSyncing = false }
        
        do {
            try await SyncService.shared.performFullSync()
            lastSyncDate = Date()
        } catch {
            print("Sync error: \(error)")
        }
    }
}

// MARK: - Data Export View
struct DataExportView: View {
    @State private var selectedScope: ExportScope = .all
    @State private var isExporting = false
    @State private var exportError: Error?
    @State private var showShareSheet = false
    @State private var exportedFileURL: URL?
    
    enum ExportScope: String, CaseIterable {
        case all = "All Data"
        case clients = "Clients Only"
        case notes = "Progress Notes Only"
        case documents = "Documents Only"
    }
    
    var body: some View {
        List {
            Section {
                Picker("Export Scope", selection: $selectedScope) {
                    ForEach(ExportScope.allCases, id: \.self) { scope in
                        Text(scope.rawValue).tag(scope)
                    }
                }
                .pickerStyle(.inline)
            } header: {
                Text("Select Data to Export")
            } footer: {
                Text("Choose what data you'd like to export from TherapyFlow")
            }
            
            Section {
                Button {
                    Task {
                        await performExport()
                    }
                } label: {
                    HStack {
                        Spacer()
                        if isExporting {
                            ProgressView()
                            Text("Exporting...")
                        } else {
                            Label("Export Data", systemImage: "square.and.arrow.up")
                        }
                        Spacer()
                    }
                }
                .disabled(isExporting)
            }
            
            Section {
                Text("Your data will be exported in JSON format and can be shared or backed up.")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
        }
        .navigationTitle("Export Data")
        .alert("Export Error", isPresented: .constant(exportError != nil)) {
            Button("OK") { exportError = nil }
        } message: {
            Text(exportError?.localizedDescription ?? "")
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = exportedFileURL {
                ShareSheet(items: [url])
            }
        }
    }
    
    private func performExport() async {
        isExporting = true
        defer { isExporting = false }
        
        do {
            let data = try await APIClient.shared.exportData(scope: selectedScope.rawValue)
            
            // Save to temporary file
            let tempURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("therapyflow_export_\(Date().timeIntervalSince1970).json")
            
            try data.write(to: tempURL)
            
            exportedFileURL = tempURL
            showShareSheet = true
        } catch {
            exportError = error
        }
    }
}

// MARK: - Support View
struct SupportView: View {
    var body: some View {
        List {
            Section {
                Link(destination: URL(string: "mailto:support@therapyflow.app")!) {
                    Label("Email Support", systemImage: "envelope")
                }
                
                Link(destination: URL(string: "https://therapyflow.app/docs")!) {
                    Label("Documentation", systemImage: "book")
                }
                
                Link(destination: URL(string: "https://therapyflow.app/faq")!) {
                    Label("FAQ", systemImage: "questionmark.circle")
                }
            } header: {
                Text("Get Help")
            }
            
            Section {
                NavigationLink {
                    Text("Feature Requests")
                } label: {
                    Label("Request a Feature", systemImage: "lightbulb")
                }
                
                NavigationLink {
                    Text("Report a Bug")
                } label: {
                    Label("Report a Bug", systemImage: "ant")
                }
            } header: {
                Text("Feedback")
            }
        }
        .navigationTitle("Support")
    }
}

// MARK: - Share Sheet (UIKit Bridge)
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(
            activityItems: items,
            applicationActivities: nil
        )
        return controller
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Preview
#Preview {
    NavigationStack {
        SettingsView()
            .environmentObject(AppState.shared)
            .environmentObject(AuthService.shared)
    }
}
