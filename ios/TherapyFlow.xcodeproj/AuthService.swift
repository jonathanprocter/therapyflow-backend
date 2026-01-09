import Foundation
import Combine
import LocalAuthentication

// MARK: - Auth Service
@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()
    
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?
    @Published var authToken: String?
    
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        loadAuthState()
    }
    
    // MARK: - Load Auth State
    func loadAuthState() {
        // Try to load existing auth token
        if let token = KeychainService.shared.getAuthToken() {
            authToken = token
            isAuthenticated = true
            
            // Load user data
            if let userData = KeychainService.shared.getUserData() {
                currentUser = try? JSONDecoder().decode(User.self, from: userData)
            }
        }
    }
    
    // MARK: - Login
    func login(email: String, password: String) async throws {
        struct LoginRequest: Codable {
            let email: String
            let password: String
        }
        
        struct LoginResponse: Codable {
            let token: String
            let refreshToken: String?
            let user: User
            
            enum CodingKeys: String, CodingKey {
                case token
                case refreshToken = "refresh_token"
                case user
            }
        }
        
        let request = LoginRequest(email: email, password: password)
        let response: LoginResponse = try await APIClient.shared.request(
            endpoint: "/api/auth/login",
            method: .post,
            body: request
        )
        
        // Save tokens
        try KeychainService.shared.setAuthToken(response.token)
        if let refreshToken = response.refreshToken {
            try KeychainService.shared.setRefreshToken(refreshToken)
        }
        
        // Save user data
        if let userData = try? JSONEncoder().encode(response.user) {
            try KeychainService.shared.setUserData(userData)
        }
        
        // Update state
        authToken = response.token
        currentUser = response.user
        isAuthenticated = true
    }
    
    // MARK: - Register
    func register(email: String, password: String, name: String, professionalTitle: String?) async throws {
        struct RegisterRequest: Codable {
            let email: String
            let password: String
            let name: String
            let professionalTitle: String?
            
            enum CodingKeys: String, CodingKey {
                case email
                case password
                case name
                case professionalTitle = "professional_title"
            }
        }
        
        struct RegisterResponse: Codable {
            let token: String
            let refreshToken: String?
            let user: User
            
            enum CodingKeys: String, CodingKey {
                case token
                case refreshToken = "refresh_token"
                case user
            }
        }
        
        let request = RegisterRequest(
            email: email,
            password: password,
            name: name,
            professionalTitle: professionalTitle
        )
        
        let response: RegisterResponse = try await APIClient.shared.request(
            endpoint: "/api/auth/register",
            method: .post,
            body: request
        )
        
        // Save tokens
        try KeychainService.shared.setAuthToken(response.token)
        if let refreshToken = response.refreshToken {
            try KeychainService.shared.setRefreshToken(refreshToken)
        }
        
        // Save user data
        if let userData = try? JSONEncoder().encode(response.user) {
            try KeychainService.shared.setUserData(userData)
        }
        
        // Update state
        authToken = response.token
        currentUser = response.user
        isAuthenticated = true
    }
    
    // MARK: - Logout
    func logout() {
        // Clear keychain
        KeychainService.shared.clearAll()
        
        // Clear state
        authToken = nil
        currentUser = nil
        isAuthenticated = false
        
        // Optional: Notify server
        Task {
            try? await APIClient.shared.request(
                endpoint: "/api/auth/logout",
                method: .post
            )
        }
    }
    
    // MARK: - Refresh Token
    func refreshToken() async throws {
        guard let refreshToken = KeychainService.shared.getRefreshToken() else {
            throw AuthError.refreshTokenNotFound
        }
        
        struct RefreshRequest: Codable {
            let refreshToken: String
            
            enum CodingKeys: String, CodingKey {
                case refreshToken = "refresh_token"
            }
        }
        
        struct RefreshResponse: Codable {
            let token: String
            let refreshToken: String?
            
            enum CodingKeys: String, CodingKey {
                case token
                case refreshToken = "refresh_token"
            }
        }
        
        let request = RefreshRequest(refreshToken: refreshToken)
        let response: RefreshResponse = try await APIClient.shared.request(
            endpoint: "/api/auth/refresh",
            method: .post,
            body: request
        )
        
        // Save new tokens
        try KeychainService.shared.setAuthToken(response.token)
        if let newRefreshToken = response.refreshToken {
            try KeychainService.shared.setRefreshToken(newRefreshToken)
        }
        
        authToken = response.token
    }
    
    // MARK: - Biometric Authentication
    func authenticateWithBiometrics() async throws {
        let context = LAContext()
        var error: NSError?
        
        // Check if biometric authentication is available
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw AuthError.biometricsNotAvailable
        }
        
        // Perform biometric authentication
        let reason = "Authenticate to access TherapyFlow"
        
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            
            if success {
                // Biometric authentication successful
                return
            } else {
                throw AuthError.biometricsFailed
            }
        } catch {
            throw AuthError.biometricsFailed
        }
    }
    
    // MARK: - Password Reset
    func requestPasswordReset(email: String) async throws {
        struct ResetRequest: Codable {
            let email: String
        }
        
        let request = ResetRequest(email: email)
        let _: EmptyResponse = try await APIClient.shared.request(
            endpoint: "/api/auth/reset-password",
            method: .post,
            body: request
        )
    }
}

// MARK: - Auth Error
enum AuthError: LocalizedError {
    case refreshTokenNotFound
    case biometricsNotAvailable
    case biometricsFailed
    case invalidCredentials
    case userNotFound
    
    var errorDescription: String? {
        switch self {
        case .refreshTokenNotFound:
            return "Refresh token not found. Please log in again."
        case .biometricsNotAvailable:
            return "Biometric authentication is not available on this device."
        case .biometricsFailed:
            return "Biometric authentication failed."
        case .invalidCredentials:
            return "Invalid email or password."
        case .userNotFound:
            return "User not found."
        }
    }
}

// MARK: - Empty Response Helper
struct EmptyResponse: Codable {}
