import SwiftUI
import CoreData

// MARK: - Settings Sections
struct SettingsIntegrationsSection: View {
    var body: some View {
        Section("Integrations") {
            NavigationLink {
                IntegrationsView()
            } label: {
                SettingsRow(
                    icon: "link.circle",
                    title: "Integrations",
                    subtitle: "Google Calendar, AI & SimplePractice"
                )
            }
        }
    }
}

struct SettingsDataSyncSection: View {
    @ObservedObject var appState: AppState
    let syncStatusText: String
    let syncStatusColor: Color
    let isSyncingNow: Bool
    @Binding var syncStatusMessage: String
    @Binding var showingSyncResult: Bool
    let onSync: () -> Void

    var body: some View {
        Section("Data & Sync") {
            HStack(spacing: 12) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.title3)
                    .foregroundColor(Color.theme.primary)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Sync Status")
                        .font(.body)
                        .foregroundColor(Color.theme.primaryText)

                    Text(syncStatusText)
                        .font(.caption)
                        .foregroundColor(syncStatusColor)
                }

                Spacer()

                if appState.isSyncing || isSyncingNow {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Button("Sync Now", action: onSync)
                        .font(.caption)
                        .foregroundColor(Color.theme.primary)
                }
            }
            .alert("Sync Result", isPresented: $showingSyncResult) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(syncStatusMessage)
            }

            Toggle(isOn: Binding(
                get: { UserDefaults.standard.bool(forKey: "autoSyncEnabled") },
                set: { UserDefaults.standard.set($0, forKey: "autoSyncEnabled") }
            )) {
                SettingsRow(
                    icon: "clock.arrow.circlepath",
                    title: "Auto Sync",
                    subtitle: "Sync data automatically in background"
                )
            }
            .tint(Color.theme.primary)

            NavigationLink {
                DataManagementView()
            } label: {
                SettingsRow(
                    icon: "externaldrive",
                    title: "Data Management",
                    subtitle: "Manage local storage and cache"
                )
            }
        }
    }
}

struct SettingsAppearanceSection: View {
    @ObservedObject var appState: AppState

    var body: some View {
        Section("Appearance") {
            Toggle(isOn: Binding(
                get: { appState.darkModeEnabled },
                set: { appState.darkModeEnabled = $0 }
            )) {
                SettingsRow(
                    icon: "moon.fill",
                    title: "Dark Mode",
                    subtitle: "Use dark appearance"
                )
            }
            .tint(Color.theme.primary)

            Toggle(isOn: Binding(
                get: { appState.hapticFeedbackEnabled },
                set: { appState.hapticFeedbackEnabled = $0 }
            )) {
                SettingsRow(
                    icon: "waveform",
                    title: "Haptic Feedback",
                    subtitle: "Vibrate on interactions"
                )
            }
            .tint(Color.theme.primary)
        }
    }
}

struct SettingsNotificationsSection: View {
    @ObservedObject var appState: AppState

    var body: some View {
        Section("Notifications") {
            Toggle(isOn: Binding(
                get: { appState.notificationsEnabled },
                set: { appState.notificationsEnabled = $0 }
            )) {
                SettingsRow(
                    icon: "bell",
                    title: "Push Notifications",
                    subtitle: "Session reminders and updates"
                )
            }
            .tint(Color.theme.primary)

            if appState.notificationsEnabled {
                NavigationLink {
                    NotificationSettingsView()
                } label: {
                    SettingsRow(
                        icon: "bell.badge",
                        title: "Notification Preferences",
                        subtitle: nil
                    )
                }
            }
        }
    }
}

struct SettingsAboutSection: View {
    var body: some View {
        Section("About") {
            NavigationLink {
                AboutView()
            } label: {
                SettingsRow(
                    icon: "info.circle",
                    title: "About TherapyFlow",
                    subtitle: nil
                )
            }

            NavigationLink {
                PrivacyPolicyView()
            } label: {
                SettingsRow(
                    icon: "hand.raised",
                    title: "Privacy Policy",
                    subtitle: nil
                )
            }

            NavigationLink {
                TermsOfServiceView()
            } label: {
                SettingsRow(
                    icon: "doc.text",
                    title: "Terms of Service",
                    subtitle: nil
                )
            }

            HStack {
                SettingsRow(
                    icon: "number",
                    title: "Version",
                    subtitle: nil
                )

                Spacer()

                Text(Bundle.main.appVersion)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
            }
        }
    }
}

struct SettingsDangerSection: View {
    @Binding var showingClearDataAlert: Bool

    var body: some View {
        Section {
            Button(action: { showingClearDataAlert = true }) {
                HStack(spacing: 12) {
                    Image(systemName: "trash")
                        .font(.title3)
                        .foregroundColor(Color.theme.warning)
                        .frame(width: 28)

                    Text("Clear Local Data")
                        .foregroundColor(Color.theme.warning)
                }
            }
        }
    }
}

// MARK: - Settings Row
struct SettingsRow: View {
    let icon: String
    let title: String
    let subtitle: String?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(Color.theme.primary)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                    .foregroundColor(Color.theme.primaryText)

                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
        }
    }
}

// MARK: - Placeholder Views
struct ChangePasswordView: View {
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""

    var body: some View {
        Form {
            Section {
                SecureField("Current Password", text: $currentPassword)
                SecureField("New Password", text: $newPassword)
                SecureField("Confirm Password", text: $confirmPassword)
            }

            Section {
                Button("Update Password") {
                    // Update password
                }
                .disabled(newPassword.isEmpty || newPassword != confirmPassword)
            }
        }
        .navigationTitle("Change Password")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct DataManagementView: View {
    var body: some View {
        List {
            Section("Storage") {
                HStack {
                    Text("Local Database")
                    Spacer()
                    Text("12.4 MB")
                        .foregroundColor(Color.theme.secondaryText)
                }

                HStack {
                    Text("Cached Files")
                    Spacer()
                    Text("3.2 MB")
                        .foregroundColor(Color.theme.secondaryText)
                }
            }

            Section {
                Button("Clear Cache") {
                    // Clear cache
                }
                .foregroundColor(Color.theme.warning)
            }
        }
        .navigationTitle("Data Management")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct NotificationSettingsView: View {
    @State private var sessionReminders = true
    @State private var reminderTime = 30

    var body: some View {
        Form {
            Section {
                Toggle("Session Reminders", isOn: $sessionReminders)

                if sessionReminders {
                    Picker("Reminder Time", selection: $reminderTime) {
                        Text("15 minutes before").tag(15)
                        Text("30 minutes before").tag(30)
                        Text("1 hour before").tag(60)
                        Text("1 day before").tag(1440)
                    }
                }
            }
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AboutView: View {
    var body: some View {
        List {
            Section {
                VStack(spacing: 16) {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 60))
                        .foregroundColor(Color.theme.primary)

                    Text("TherapyFlow")
                        .font(.title)
                        .fontWeight(.bold)

                    Text("Version \(Bundle.main.appVersion)")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            }

            Section {
                Text("TherapyFlow is a comprehensive practice management solution designed specifically for mental health professionals.")
                    .font(.body)
                    .foregroundColor(Color.theme.secondaryText)
            }
        }
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct PrivacyPolicyView: View {
    var body: some View {
        ScrollView {
            Text("Privacy Policy content goes here...")
                .padding()
        }
        .navigationTitle("Privacy Policy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct TermsOfServiceView: View {
    var body: some View {
        ScrollView {
            Text("Terms of Service content goes here...")
                .padding()
        }
        .navigationTitle("Terms of Service")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Bundle Extension
extension Bundle {
    var appVersion: String {
        let version = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
