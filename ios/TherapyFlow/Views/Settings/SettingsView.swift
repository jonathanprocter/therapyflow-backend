import SwiftUI
import CoreData

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState

    @State private var showingClearDataAlert = false
    @State private var syncStatusMessage: String = ""
    @State private var showingSyncResult = false
    @State private var isSyncingNow = false

    var body: some View {
        List {
            SettingsIntegrationsSection()
            SettingsDataSyncSection(
                appState: appState,
                syncStatusText: syncStatusText,
                syncStatusColor: syncStatusColor,
                isSyncingNow: isSyncingNow,
                syncStatusMessage: $syncStatusMessage,
                showingSyncResult: $showingSyncResult,
                onSync: performSync
            )
            SettingsAppearanceSection(appState: appState)
            SettingsNotificationsSection(appState: appState)
            SettingsAboutSection()
            SettingsDangerSection(showingClearDataAlert: $showingClearDataAlert)
        }
        .navigationTitle("Settings")
        .alert("Clear Local Data", isPresented: $showingClearDataAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Clear Data", role: .destructive) {
                clearLocalData()
            }
        } message: {
            Text("This will remove all cached data from this device. Data synced to the server will not be affected.")
        }
    }

    // MARK: - Computed Properties
    private var syncStatusText: String {
        if appState.isSyncing {
            return "Syncing..."
        } else if let lastSync = appState.lastSyncTime {
            return "Last synced \(lastSync.relativeString)"
        } else {
            return "Never synced"
        }
    }

    private var syncStatusColor: Color {
        if appState.isSyncing {
            return Color.theme.primary
        } else if appState.pendingChangesCount > 0 {
            return Color.theme.warning
        } else {
            return Color.theme.success
        }
    }

    // MARK: - Actions
    private func performSync() {
        Task {
            isSyncingNow = true

            do {
                try await SyncService.shared.performFullSync()
                let status = await SyncService.shared.getSyncStatus()

                await MainActor.run {
                    isSyncingNow = false
                    if status.hasErrors {
                        syncStatusMessage = "Sync completed with errors:\n\(status.errors.map { $0.localizedDescription }.joined(separator: "\n"))"
                    } else {
                        syncStatusMessage = "Sync completed successfully!"
                        appState.updateSyncState(isSyncing: false, lastSync: Date(), pendingChanges: status.pendingChanges)
                    }
                    showingSyncResult = true
                }
            } catch {
                await MainActor.run {
                    isSyncingNow = false
                    syncStatusMessage = "Sync failed: \(error.localizedDescription)"
                    showingSyncResult = true
                }
            }
        }
    }

    private func clearLocalData() {
        let context = PersistenceController.shared.container.viewContext

        // Clear all entities
        let entityNames = ["ClientEntity", "SessionEntity", "ProgressNoteEntity", "DocumentEntity", "TreatmentPlanEntity"]

        for entityName in entityNames {
            let fetchRequest = NSFetchRequest<NSFetchRequestResult>(entityName: entityName)
            let batchDeleteRequest = NSBatchDeleteRequest(fetchRequest: fetchRequest)

            do {
                try context.execute(batchDeleteRequest)
            } catch {
                print("Failed to clear \(entityName): \(error)")
            }
        }

        try? context.save()
        
        // Reset sync state
        appState.updateSyncState(isSyncing: false, lastSync: nil, pendingChanges: 0)
        
        // Clear cache
        appState.clearCache()
    }
}

#Preview {
    NavigationStack {
        SettingsView()
            .environmentObject(AppState.shared)
    }
}
