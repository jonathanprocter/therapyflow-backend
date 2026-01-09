import Foundation

// MARK: - User Model
struct User: Identifiable, Codable, Equatable {
    let id: String
    var username: String
    var name: String
    var email: String
    var role: UserRole
    let createdAt: Date
    var title: String?
    var licenseNumber: String?
    var phoneNumber: String?
    var practiceName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case name
        case email
        case role
        case createdAt = "created_at"
        case title
        case licenseNumber = "license_number"
        case phoneNumber = "phone_number"
        case practiceName = "practice_name"
    }

    init(id: String = UUID().uuidString,
         username: String,
         name: String,
         email: String,
         role: UserRole = .therapist,
         createdAt: Date = Date(),
         title: String? = nil,
         licenseNumber: String? = nil,
         phoneNumber: String? = nil,
         practiceName: String? = nil) {
        self.id = id
        self.username = username
        self.name = name
        self.email = email
        self.role = role
        self.createdAt = createdAt
        self.title = title
        self.licenseNumber = licenseNumber
        self.phoneNumber = phoneNumber
        self.practiceName = practiceName
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        username = try container.decode(String.self, forKey: .username)
        name = try container.decode(String.self, forKey: .name)
        email = try container.decode(String.self, forKey: .email)
        role = try container.decodeIfPresent(UserRole.self, forKey: .role) ?? .therapist
        
        title = try container.decodeIfPresent(String.self, forKey: .title)
        licenseNumber = try container.decodeIfPresent(String.self, forKey: .licenseNumber)
        phoneNumber = try container.decodeIfPresent(String.self, forKey: .phoneNumber)
        practiceName = try container.decodeIfPresent(String.self, forKey: .practiceName)

        if let dateString = try? container.decode(String.self, forKey: .createdAt) {
            createdAt = ISO8601DateFormatter().date(from: dateString) ?? Date()
        } else if let date = try? container.decode(Date.self, forKey: .createdAt) {
            createdAt = date
        } else {
            createdAt = Date()
        }
    }
}

// MARK: - User Role
enum UserRole: String, Codable, CaseIterable {
    case therapist
    case admin
    case supervisor

    var displayName: String {
        switch self {
        case .therapist: return "Therapist"
        case .admin: return "Administrator"
        case .supervisor: return "Supervisor"
        }
    }
}

// MARK: - Login Request/Response
struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let token: String
    let user: User
}

// MARK: - Auth Token
struct AuthToken: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresAt: Date?

    var isExpired: Bool {
        guard let expiresAt = expiresAt else { return false }
        return Date() >= expiresAt
    }
}

// MARK: - Update User Input
struct UpdateUserInput: Codable {
    var name: String?
    var email: String?
    var username: String?
    var title: String?
    var licenseNumber: String?
    var phoneNumber: String?
    var practiceName: String?

    enum CodingKeys: String, CodingKey {
        case name
        case email
        case username
        case title
        case licenseNumber = "license_number"
        case phoneNumber = "phone_number"
        case practiceName = "practice_name"
    }

    init(name: String? = nil, 
         email: String? = nil, 
         username: String? = nil,
         title: String? = nil,
         licenseNumber: String? = nil,
         phoneNumber: String? = nil,
         practiceName: String? = nil) {
        self.name = name
        self.email = email
        self.username = username
        self.title = title
        self.licenseNumber = licenseNumber
        self.phoneNumber = phoneNumber
        self.practiceName = practiceName
    }
}
