import Foundation
import Combine

// MARK: - Auth Service
@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    // Published properties
    @Published private(set) var isAuthenticated = false
    @Published private(set) var currentUser: User?
    @Published private(set) var isLoading = false
    @Published var error: AuthError?

    private let keychain = KeychainService.shared
    private let apiClient = APIClient.shared

    private init() {
        // Check for existing token on init
        Task {
            await checkAuthStatus()
        }
    }

    // MARK: - Public Methods

    func checkAuthStatus() async {
        isLoading = true
        defer { isLoading = false }

        // Check for stored token
        if let token = keychain.getAuthToken() {
            await apiClient.setAuthToken(token)

            // Validate token by fetching user info
            do {
                // Try to get dashboard stats as a simple validation
                _ = try await apiClient.getDashboardStats()
                isAuthenticated = true

                // Load user from stored data
                if let userData = keychain.getUserData(),
                   let user = try? JSONDecoder().decode(User.self, from: userData) {
                    currentUser = user
                }
            } catch {
                // Token is invalid, clear it
                await logout()
            }
        }
    }

    func login(email: String, password: String) async throws {
        guard !email.isEmpty, !password.isEmpty else {
            throw AuthError.invalidCredentials
        }

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let response = try await apiClient.login(email: email, password: password)

            // Store token
            try keychain.setAuthToken(response.token)

            // Store user data
            if let userData = try? JSONEncoder().encode(response.user) {
                try keychain.setUserData(userData)
            }

            // Update API client
            await apiClient.setAuthToken(response.token)

            // Update state
            currentUser = response.user
            isAuthenticated = true

        } catch let apiError as APIError {
            switch apiError {
            case .unauthorized:
                throw AuthError.invalidCredentials
            case .networkError:
                throw AuthError.networkError
            default:
                throw AuthError.serverError(apiError.localizedDescription)
            }
        } catch {
            throw AuthError.serverError(error.localizedDescription)
        }
    }

    func logout() async {
        isLoading = true
        defer { isLoading = false }

        // Try to logout on server (don't fail if it errors)
        try? await apiClient.logout()

        // Clear local state
        keychain.clearAll()
        await apiClient.setAuthToken(nil)

        currentUser = nil
        isAuthenticated = false
    }

    func refreshToken() async throws {
        guard keychain.getRefreshToken() != nil else {
            throw AuthError.noRefreshToken
        }

        // TODO: Implement token refresh endpoint
        // For now, just require re-login
        throw AuthError.sessionExpired
    }

    func updateCurrentUser(_ user: User) {
        currentUser = user
        
        // Also update the stored user data in keychain
        if let userData = try? JSONEncoder().encode(user) {
            try? keychain.setUserData(userData)
        }
    }

    // MARK: - Biometric Authentication

    func enableBiometric() async throws {
        guard isAuthenticated else {
            throw AuthError.notAuthenticated
        }

        // Store flag indicating biometric is enabled
        UserDefaults.standard.set(true, forKey: "biometricEnabled")
    }

    func disableBiometric() {
        UserDefaults.standard.set(false, forKey: "biometricEnabled")
    }

    var isBiometricEnabled: Bool {
        UserDefaults.standard.bool(forKey: "biometricEnabled")
    }
}

// MARK: - Auth Error
enum AuthError: LocalizedError {
    case invalidCredentials
    case networkError
    case serverError(String)
    case notAuthenticated
    case sessionExpired
    case noRefreshToken
    case biometricFailed
    case biometricNotAvailable

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "Invalid email or password"
        case .networkError:
            return "Network error. Please check your connection."
        case .serverError(let message):
            return "Server error: \(message)"
        case .notAuthenticated:
            return "You must be logged in to perform this action"
        case .sessionExpired:
            return "Your session has expired. Please log in again."
        case .noRefreshToken:
            return "Unable to refresh session. Please log in again."
        case .biometricFailed:
            return "Biometric authentication failed"
        case .biometricNotAvailable:
            return "Biometric authentication is not available on this device"
        }
    }
}
