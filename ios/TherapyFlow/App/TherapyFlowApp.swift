import SwiftUI
import BackgroundTasks
import UserNotifications

@main
struct TherapyFlowApp: App {
    // MARK: - State Objects
    @StateObject private var appState: AppState = .shared
    @StateObject private var networkMonitor: NetworkMonitor = .shared
    @StateObject private var authService: AuthService = .shared
    @StateObject private var endOfDaySummary: EndOfDaySummaryService = .shared

    // MARK: - Environment
    @Environment(\.scenePhase) private var scenePhase

    // MARK: - State
    @State private var showEndOfDaySummary = false

    // MARK: - Core Data
    let persistenceController = PersistenceController.shared

    init() {
        // Register background tasks
        registerBackgroundTasks()

        // Configure appearance
        configureAppearance()

        // Initialize Cipher wake word detector
        initializeCipher()

        // Initialize end-of-day notifications
        initializeEndOfDayNotifications()
    }

    private func initializeEndOfDayNotifications() {
        // Set up notification delegate
        UNUserNotificationCenter.current().delegate = EndOfDaySummaryService.shared

        // Schedule end-of-day notification if authorized
        Task {
            let granted = await EndOfDaySummaryService.shared.requestNotificationPermission()
            if granted {
                EndOfDaySummaryService.shared.scheduleEndOfDayNotification()
            }
        }
    }

    private func initializeCipher() {
        // Load wake word settings
        WakeWordDetector.shared.loadSettings()

        // Check if already authorized, start immediately
        // Otherwise, authorization flow will auto-start listening when granted
        if WakeWordDetector.shared.checkExistingAuthorization() {
            if WakeWordDetector.shared.wakeWordEnabled {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    WakeWordDetector.shared.startListening()
                }
            }
        } else {
            // Request authorization - will auto-start listening when granted
            Task {
                await WakeWordDetector.shared.requestAuthorizationAsync()
            }
        }

        // Pre-load context for Cipher in background
        Task {
            await FullContextProvider.shared.ensureLoaded()
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
                .environmentObject(appState)
                .environmentObject(networkMonitor)
                .environmentObject(authService)
                .environmentObject(endOfDaySummary)
                .preferredColorScheme(appState.darkModeEnabled ? .dark : .light)
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
                .sheet(isPresented: $showEndOfDaySummary) {
                    EndOfDaySummaryView()
                        .environmentObject(endOfDaySummary)
                }
                .onReceive(NotificationCenter.default.publisher(for: .showEndOfDaySummary)) { _ in
                    showEndOfDaySummary = true
                }
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            handleScenePhaseChange(from: oldPhase, to: newPhase)
        }
    }

    // MARK: - URL Handling for OAuth Callbacks
    private func handleIncomingURL(_ url: URL) {
        // Handle Google OAuth callback
        if url.scheme?.contains("googleusercontent") == true ||
           url.absoluteString.contains("oauth2callback") {
            Task {
                do {
                    try await IntegrationsService.shared.handleGoogleOAuthCallback(url: url)
                    print("Google Calendar connected successfully")
                } catch {
                    print("Google OAuth error: \(error.localizedDescription)")
                }
            }
            return
        }

        // Handle SimplePractice OAuth callback
        if url.absoluteString.contains("simplepractice-callback") {
            Task {
                do {
                    try await IntegrationsService.shared.handleSimplePracticeCallback(url: url)
                    print("SimplePractice connected successfully")
                } catch {
                    print("SimplePractice OAuth error: \(error.localizedDescription)")
                }
            }
            return
        }

        // Handle other deep links here
        print("Received URL: \(url)")
    }

    // MARK: - Private Methods

    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.therapyflow.ios.sync",
            using: nil
        ) { task in
            handleBackgroundSync(task: task as! BGProcessingTask)
        }

        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.therapyflow.ios.refresh",
            using: nil
        ) { task in
            handleBackgroundRefresh(task: task as! BGAppRefreshTask)
        }
    }

    private func handleBackgroundSync(task: BGProcessingTask) {
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }

        Task {
            do {
                try await SyncService.shared.performFullSync()
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
            scheduleBackgroundSync()
        }
    }

    private func handleBackgroundRefresh(task: BGAppRefreshTask) {
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }

        Task {
            do {
                try await SyncService.shared.performQuickSync()
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
            scheduleBackgroundRefresh()
        }
    }

    private func scheduleBackgroundSync() {
        let request = BGProcessingTaskRequest(identifier: "com.therapyflow.ios.sync")
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: 4 * 60 * 60) // 4 hours

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Failed to schedule background sync: \(error)")
        }
    }

    private func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: "com.therapyflow.ios.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60) // 30 minutes

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("Failed to schedule background refresh: \(error)")
        }
    }

    private func handleScenePhaseChange(from oldPhase: ScenePhase, to newPhase: ScenePhase) {
        switch newPhase {
        case .active:
            // App became active - trigger quick sync
            Task {
                try? await SyncService.shared.performQuickSync()
            }

            // Resume Cipher wake word listening if enabled
            if WakeWordDetector.shared.wakeWordEnabled && !WakeWordDetector.shared.isActivated {
                WakeWordDetector.shared.startListening()
            }

            // Check if we should show end-of-day summary
            Task { @MainActor in
                EndOfDaySummaryService.shared.checkAndShowSummaryIfNeeded()
                if EndOfDaySummaryService.shared.pendingSummary != nil {
                    showEndOfDaySummary = true
                }
            }

        case .inactive:
            // App became inactive
            break

        case .background:
            // App went to background
            // Save any pending changes
            persistenceController.save()
            // Schedule background tasks
            scheduleBackgroundSync()
            scheduleBackgroundRefresh()

            // Stop Cipher wake word listening (battery optimization)
            WakeWordDetector.shared.stopListening()

        @unknown default:
            break
        }
    }

    private func configureAppearance() {
        // Configure navigation bar appearance
        let navigationBarAppearance = UINavigationBarAppearance()
        navigationBarAppearance.configureWithOpaqueBackground()
        navigationBarAppearance.backgroundColor = UIColor(Color.theme.background)
        navigationBarAppearance.titleTextAttributes = [
            .foregroundColor: UIColor(Color.theme.primaryText)
        ]
        navigationBarAppearance.largeTitleTextAttributes = [
            .foregroundColor: UIColor(Color.theme.primaryText)
        ]

        UINavigationBar.appearance().standardAppearance = navigationBarAppearance
        UINavigationBar.appearance().compactAppearance = navigationBarAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navigationBarAppearance

        // Configure tab bar appearance
        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.configureWithOpaqueBackground()
        tabBarAppearance.backgroundColor = UIColor(Color.theme.surface)

        UITabBar.appearance().standardAppearance = tabBarAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabBarAppearance
    }
}
