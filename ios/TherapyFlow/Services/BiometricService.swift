import Foundation
import LocalAuthentication

// MARK: - Biometric Service
final class BiometricService {
    static let shared = BiometricService()

    private init() {}

    // MARK: - Biometric Type
    enum BiometricType {
        case none
        case touchID
        case faceID
        case opticID

        var displayName: String {
            switch self {
            case .none: return "None"
            case .touchID: return "Touch ID"
            case .faceID: return "Face ID"
            case .opticID: return "Optic ID"
            }
        }

        var icon: String {
            switch self {
            case .none: return "lock"
            case .touchID: return "touchid"
            case .faceID: return "faceid"
            case .opticID: return "opticid"
            }
        }
    }

    // MARK: - Properties

    var biometricType: BiometricType {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }

        switch context.biometryType {
        case .touchID:
            return .touchID
        case .faceID:
            return .faceID
        case .opticID:
            return .opticID
        case .none:
            return .none
        @unknown default:
            return .none
        }
    }

    var isBiometricAvailable: Bool {
        biometricType != .none
    }

    var canUseBiometric: Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    // MARK: - Authentication

    func authenticate(reason: String) async throws -> Bool {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            if let error = error {
                throw BiometricError.from(laError: error)
            }
            throw BiometricError.notAvailable
        }

        // Configure context
        context.localizedFallbackTitle = "Use Passcode"
        context.localizedCancelTitle = "Cancel"

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            return success
        } catch let error as LAError {
            throw BiometricError.from(laError: error)
        } catch {
            throw BiometricError.unknown(error)
        }
    }

    func authenticateWithPasscodeFallback(reason: String) async throws -> Bool {
        let context = LAContext()

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication, // Includes passcode fallback
                localizedReason: reason
            )
            return success
        } catch let error as LAError {
            throw BiometricError.from(laError: error)
        } catch {
            throw BiometricError.unknown(error)
        }
    }
}

// MARK: - Biometric Error
enum BiometricError: LocalizedError {
    case notAvailable
    case notEnrolled
    case lockout
    case canceled
    case passcodeNotSet
    case systemCancel
    case invalidContext
    case unknown(Error)

    static func from(laError: Error) -> BiometricError {
        guard let laError = laError as? LAError else {
            return .unknown(laError)
        }

        switch laError.code {
        case .biometryNotAvailable:
            return .notAvailable
        case .biometryNotEnrolled:
            return .notEnrolled
        case .biometryLockout:
            return .lockout
        case .userCancel, .appCancel:
            return .canceled
        case .passcodeNotSet:
            return .passcodeNotSet
        case .systemCancel:
            return .systemCancel
        case .invalidContext:
            return .invalidContext
        default:
            return .unknown(laError)
        }
    }

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "Biometric authentication is not available on this device"
        case .notEnrolled:
            return "No biometric data is enrolled. Please set up Face ID or Touch ID in Settings."
        case .lockout:
            return "Biometric authentication is locked due to too many failed attempts. Please use your passcode."
        case .canceled:
            return "Authentication was canceled"
        case .passcodeNotSet:
            return "A passcode is not set on the device"
        case .systemCancel:
            return "Authentication was canceled by the system"
        case .invalidContext:
            return "The authentication context is invalid"
        case .unknown(let error):
            return "Authentication failed: \(error.localizedDescription)"
        }
    }

    var isRetryable: Bool {
        switch self {
        case .canceled, .systemCancel:
            return true
        default:
            return false
        }
    }
}
