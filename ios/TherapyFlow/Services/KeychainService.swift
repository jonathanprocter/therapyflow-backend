import Foundation
import Security

// MARK: - Keychain Service
final class KeychainService {
    static let shared = KeychainService()

    private let serviceName = "com.therapyflow.ios"

    private enum Keys {
        static let authToken = "auth_token"
        static let refreshToken = "refresh_token"
        static let userData = "user_data"
    }

    private init() {}

    // MARK: - Auth Token

    func getAuthToken() -> String? {
        getData(forKey: Keys.authToken).flatMap { String(data: $0, encoding: .utf8) }
    }

    func setAuthToken(_ token: String) throws {
        guard let data = token.data(using: .utf8) else {
            throw KeychainError.encodingError
        }
        try setData(data, forKey: Keys.authToken)
    }

    func removeAuthToken() {
        deleteData(forKey: Keys.authToken)
    }

    // MARK: - Refresh Token

    func getRefreshToken() -> String? {
        getData(forKey: Keys.refreshToken).flatMap { String(data: $0, encoding: .utf8) }
    }

    func setRefreshToken(_ token: String) throws {
        guard let data = token.data(using: .utf8) else {
            throw KeychainError.encodingError
        }
        try setData(data, forKey: Keys.refreshToken)
    }

    func removeRefreshToken() {
        deleteData(forKey: Keys.refreshToken)
    }

    // MARK: - User Data

    func getUserData() -> Data? {
        getData(forKey: Keys.userData)
    }

    func setUserData(_ data: Data) throws {
        try setData(data, forKey: Keys.userData)
    }

    func removeUserData() {
        deleteData(forKey: Keys.userData)
    }

    // MARK: - Clear All

    func clearAll() {
        removeAuthToken()
        removeRefreshToken()
        removeUserData()
    }

    // MARK: - Generic Key-Value Storage

    /// Retrieve data for a custom key
    func retrieve(key: String) throws -> Data? {
        getData(forKey: key)
    }

    /// Save data for a custom key
    func save(key: String, data: Data) throws {
        try setData(data, forKey: key)
    }

    /// Delete data for a custom key
    func delete(key: String) throws {
        deleteData(forKey: key)
    }

    // MARK: - Private Methods

    private func getData(forKey key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            return nil
        }

        return result as? Data
    }

    private func setData(_ data: Data, forKey key: String) throws {
        // First try to update existing item
        let updateQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]

        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]

        var status = SecItemUpdate(updateQuery as CFDictionary, attributes as CFDictionary)

        if status == errSecItemNotFound {
            // Item doesn't exist, create it
            var addQuery = updateQuery
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

            status = SecItemAdd(addQuery as CFDictionary, nil)
        }

        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    private func deleteData(forKey key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Keychain Error
enum KeychainError: LocalizedError {
    case encodingError
    case saveFailed(OSStatus)
    case readFailed(OSStatus)
    case deleteFailed(OSStatus)
    case unknown

    var errorDescription: String? {
        switch self {
        case .encodingError:
            return "Failed to encode data for keychain"
        case .saveFailed(let status):
            return "Failed to save to keychain: \(status)"
        case .readFailed(let status):
            return "Failed to read from keychain: \(status)"
        case .deleteFailed(let status):
            return "Failed to delete from keychain: \(status)"
        case .unknown:
            return "Unknown keychain error"
        }
    }
}
