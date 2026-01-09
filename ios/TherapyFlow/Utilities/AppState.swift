import Foundation
import Combine
import SwiftUI

// MARK: - App State
@MainActor
final class AppState: ObservableObject {
    static let shared = AppState()

    // MARK: - Published Properties

    // Authentication & Security
    @Published var isLocked = false
    @Published var isBiometricEnabled: Bool {
        didSet {
            UserDefaults.standard.set(isBiometricEnabled, forKey: "biometricEnabled")
        }
    }

    // UI State
    @Published var showingSettings = false
    @Published var selectedClientId: String?
    @Published var selectedNoteId: String?
    @Published var selectedSessionId: String?

    // Sync State
    @Published var isSyncing = false
    @Published var lastSyncTime: Date?
    @Published var pendingChangesCount = 0

    // Offline State
    @Published var isOfflineMode = false

    // Notifications
    @Published var unreadInsightsCount = 0
    @Published var pendingNotificationsCount = 0

    // MARK: - Initialization

    private init() {
        isBiometricEnabled = UserDefaults.standard.bool(forKey: "biometricEnabled")
        lastSyncTime = UserDefaults.standard.object(forKey: "lastSyncTime") as? Date
    }

    // MARK: - Lock/Unlock

    func lock() {
        isLocked = true
    }

    func unlock() {
        isLocked = false
    }

    func requireBiometricUnlock() {
        if isBiometricEnabled {
            isLocked = true
        }
    }

    // MARK: - Sync

    func updateSyncState(isSyncing: Bool, lastSync: Date? = nil, pendingChanges: Int = 0) {
        self.isSyncing = isSyncing
        if let lastSync = lastSync {
            self.lastSyncTime = lastSync
            UserDefaults.standard.set(lastSync, forKey: "lastSyncTime")
        }
        self.pendingChangesCount = pendingChanges
    }

    // MARK: - Settings

    var notificationsEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "notificationsEnabled") }
        set { UserDefaults.standard.set(newValue, forKey: "notificationsEnabled") }
    }

    @Published var darkModeEnabled: Bool = UserDefaults.standard.bool(forKey: "darkModeEnabled") {
        didSet {
            UserDefaults.standard.set(darkModeEnabled, forKey: "darkModeEnabled")
        }
    }

    @Published var hapticFeedbackEnabled: Bool = UserDefaults.standard.bool(forKey: "hapticFeedbackEnabled") {
        didSet {
            UserDefaults.standard.set(hapticFeedbackEnabled, forKey: "hapticFeedbackEnabled")
            if hapticFeedbackEnabled {
                // Provide feedback when enabling
                HapticManager.shared.impact(.light)
            }
        }
    }

    // MARK: - Cache Management

    func clearCache() {
        // Clear URLCache
        URLCache.shared.removeAllCachedResponses()

        // Clear UserDefaults cache items
        UserDefaults.standard.removeObject(forKey: "cachedDashboardStats")
        UserDefaults.standard.removeObject(forKey: "cachedUpcomingSessions")

        // Clear temporary files
        let tempDir = FileManager.default.temporaryDirectory
        if let files = try? FileManager.default.contentsOfDirectory(atPath: tempDir.path) {
            for file in files {
                try? FileManager.default.removeItem(at: tempDir.appendingPathComponent(file))
            }
        }
    }

    var cacheSize: String {
        let urlCacheSize = URLCache.shared.currentDiskUsage
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(urlCacheSize))
    }

    // MARK: - App Info

    var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    }

    var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    }

    var fullVersion: String {
        "\(appVersion) (\(buildNumber))"
    }
}
