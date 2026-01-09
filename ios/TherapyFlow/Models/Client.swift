import Foundation

// MARK: - Date Parsing Helpers for Client
private enum ClientDateParsingHelper {
    static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let iso8601FormatterNoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let fallbackFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    static func parseDate(from string: String) -> Date? {
        if let date = iso8601Formatter.date(from: string) {
            return date
        }
        if let date = iso8601FormatterNoFractional.date(from: string) {
            return date
        }
        if let date = fallbackFormatter.date(from: string) {
            return date
        }
        if let date = dateOnlyFormatter.date(from: string) {
            return date
        }
        return nil
    }
}

// MARK: - Client Model
struct Client: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let therapistId: String
    var name: String
    var email: String?
    var phone: String?
    var dateOfBirth: Date?
    var emergencyContact: EmergencyContact?
    var insurance: Insurance?
    var tags: [String]
    var clinicalConsiderations: [String]
    var preferredModalities: [String]
    var status: ClientStatus
    var deletedAt: Date?
    let createdAt: Date
    var updatedAt: Date

    // Computed properties
    var isActive: Bool {
        status == .active && deletedAt == nil
    }

    var initials: String {
        let components = name.split(separator: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1) + components[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    var age: Int? {
        guard let dob = dateOfBirth else { return nil }
        return Calendar.current.dateComponents([.year], from: dob, to: Date()).year
    }

    // Support both snake_case (from backend) and camelCase (legacy) keys
    enum CodingKeys: String, CodingKey {
        case id
        case therapistId = "therapist_id"
        case therapistIdCamel = "therapistId"
        case name
        case email
        case phone
        case dateOfBirth = "date_of_birth"
        case dateOfBirthCamel = "dateOfBirth"
        case emergencyContact = "emergency_contact"
        case emergencyContactCamel = "emergencyContact"
        case insurance
        case tags
        case clinicalConsiderations = "clinical_considerations"
        case clinicalConsiderationsCamel = "clinicalConsiderations"
        case preferredModalities = "preferred_modalities"
        case preferredModalitiesCamel = "preferredModalities"
        case status
        case deletedAt = "deleted_at"
        case deletedAtCamel = "deletedAt"
        case createdAt = "created_at"
        case createdAtCamel = "createdAt"
        case updatedAt = "updated_at"
        case updatedAtCamel = "updatedAt"
    }

    // Custom encoder to encode to snake_case format
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(therapistId, forKey: .therapistId)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(email, forKey: .email)
        try container.encodeIfPresent(phone, forKey: .phone)
        try container.encodeIfPresent(dateOfBirth, forKey: .dateOfBirth)
        try container.encodeIfPresent(emergencyContact, forKey: .emergencyContact)
        try container.encodeIfPresent(insurance, forKey: .insurance)
        try container.encode(tags, forKey: .tags)
        try container.encode(clinicalConsiderations, forKey: .clinicalConsiderations)
        try container.encode(preferredModalities, forKey: .preferredModalities)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(deletedAt, forKey: .deletedAt)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
    }

    // Custom decoder to handle missing optional fields with defaults and both key formats
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)

        // Try snake_case first, then camelCase for backward compatibility
        if let value = try? container.decode(String.self, forKey: .therapistId) {
            therapistId = value
        } else {
            therapistId = try container.decode(String.self, forKey: .therapistIdCamel)
        }

        name = try container.decode(String.self, forKey: .name)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        phone = try container.decodeIfPresent(String.self, forKey: .phone)

        // Handle dateOfBirth - Date or String format
        if let value = try? container.decodeIfPresent(Date.self, forKey: .dateOfBirth) {
            dateOfBirth = value
        } else if let value = try? container.decodeIfPresent(Date.self, forKey: .dateOfBirthCamel) {
            dateOfBirth = value
        } else if let stringValue = try? container.decode(String.self, forKey: .dateOfBirth),
                  let parsedDate = ClientDateParsingHelper.parseDate(from: stringValue) {
            dateOfBirth = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .dateOfBirthCamel),
                  let parsedDate = ClientDateParsingHelper.parseDate(from: stringValue) {
            dateOfBirth = parsedDate
        } else {
            dateOfBirth = nil
        }

        if let value = try? container.decodeIfPresent(EmergencyContact.self, forKey: .emergencyContact) {
            emergencyContact = value
        } else {
            emergencyContact = try container.decodeIfPresent(EmergencyContact.self, forKey: .emergencyContactCamel)
        }

        insurance = try container.decodeIfPresent(Insurance.self, forKey: .insurance)
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []

        if let value = try? container.decode([String].self, forKey: .clinicalConsiderations) {
            clinicalConsiderations = value
        } else {
            clinicalConsiderations = try container.decodeIfPresent([String].self, forKey: .clinicalConsiderationsCamel) ?? []
        }

        if let value = try? container.decode([String].self, forKey: .preferredModalities) {
            preferredModalities = value
        } else {
            preferredModalities = try container.decodeIfPresent([String].self, forKey: .preferredModalitiesCamel) ?? []
        }

        status = try container.decodeIfPresent(ClientStatus.self, forKey: .status) ?? .active

        // Handle deletedAt - Date or String format
        if let value = try? container.decodeIfPresent(Date.self, forKey: .deletedAt) {
            deletedAt = value
        } else if let value = try? container.decodeIfPresent(Date.self, forKey: .deletedAtCamel) {
            deletedAt = value
        } else if let stringValue = try? container.decode(String.self, forKey: .deletedAt),
                  let parsedDate = ClientDateParsingHelper.parseDate(from: stringValue) {
            deletedAt = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .deletedAtCamel),
                  let parsedDate = ClientDateParsingHelper.parseDate(from: stringValue) {
            deletedAt = parsedDate
        } else {
            deletedAt = nil
        }

        // Handle createdAt - Date or String format
        if let value = try? container.decode(Date.self, forKey: .createdAt) {
            createdAt = value
        } else if let value = try? container.decode(Date.self, forKey: .createdAtCamel) {
            createdAt = value
        } else if let stringValue = try? container.decode(String.self, forKey: .createdAt),
                  let parsedDate = ClientDateParsingHelper.parseDate(from: stringValue) {
            createdAt = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .createdAtCamel),
                  let parsedDate = ClientDateParsingHelper.parseDate(from: stringValue) {
            createdAt = parsedDate
        } else {
            createdAt = Date()
        }

        // Handle updatedAt - Date or String format
        if let value = try? container.decode(Date.self, forKey: .updatedAt) {
            updatedAt = value
        } else if let value = try? container.decode(Date.self, forKey: .updatedAtCamel) {
            updatedAt = value
        } else if let stringValue = try? container.decode(String.self, forKey: .updatedAt),
                  let parsedDate = ClientDateParsingHelper.parseDate(from: stringValue) {
            updatedAt = parsedDate
        } else if let stringValue = try? container.decode(String.self, forKey: .updatedAtCamel),
                  let parsedDate = ClientDateParsingHelper.parseDate(from: stringValue) {
            updatedAt = parsedDate
        } else {
            updatedAt = Date()
        }
    }

    init(id: String = UUID().uuidString,
         therapistId: String,
         name: String,
         email: String? = nil,
         phone: String? = nil,
         dateOfBirth: Date? = nil,
         emergencyContact: EmergencyContact? = nil,
         insurance: Insurance? = nil,
         tags: [String] = [],
         clinicalConsiderations: [String] = [],
         preferredModalities: [String] = [],
         status: ClientStatus = .active,
         deletedAt: Date? = nil,
         createdAt: Date = Date(),
         updatedAt: Date = Date()) {
        self.id = id
        self.therapistId = therapistId
        self.name = name
        self.email = email
        self.phone = phone
        self.dateOfBirth = dateOfBirth
        self.emergencyContact = emergencyContact
        self.insurance = insurance
        self.tags = tags
        self.clinicalConsiderations = clinicalConsiderations
        self.preferredModalities = preferredModalities
        self.status = status
        self.deletedAt = deletedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Client, rhs: Client) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Client Status
enum ClientStatus: String, Codable, CaseIterable {
    case active
    case inactive
    case discharged
    case unknown  // Fallback for unexpected values

    var displayName: String {
        switch self {
        case .active: return "Active"
        case .inactive: return "Inactive"
        case .discharged: return "Discharged"
        case .unknown: return "Unknown"
        }
    }

    var color: String {
        switch self {
        case .active: return "green"
        case .inactive: return "orange"
        case .discharged: return "gray"
        case .unknown: return "gray"
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = ClientStatus(rawValue: rawValue) ?? .unknown
    }
}

// MARK: - Emergency Contact
struct EmergencyContact: Codable, Equatable {
    var name: String
    var phone: String
    var relationship: String?

    init(name: String, phone: String, relationship: String? = nil) {
        self.name = name
        self.phone = phone
        self.relationship = relationship
    }
}

// MARK: - Insurance
struct Insurance: Codable, Equatable {
    var provider: String
    var policyNumber: String
    var groupNumber: String?

    init(provider: String, policyNumber: String, groupNumber: String? = nil) {
        self.provider = provider
        self.policyNumber = policyNumber
        self.groupNumber = groupNumber
    }
}

// MARK: - Create/Update DTOs
struct CreateClientInput: Codable {
    var name: String
    var email: String?
    var phone: String?
    var dateOfBirth: Date?
    var tags: [String]?
    var emergencyContact: EmergencyContact?
    var insurance: Insurance?
    var clinicalConsiderations: [String]?
    var preferredModalities: [String]?

    enum CodingKeys: String, CodingKey {
        case name
        case email
        case phone
        case dateOfBirth = "date_of_birth"
        case tags
        case emergencyContact = "emergency_contact"
        case insurance
        case clinicalConsiderations = "clinical_considerations"
        case preferredModalities = "preferred_modalities"
    }
}

struct UpdateClientInput: Codable {
    var clientId: String?  // Some backends require this in the body
    var name: String?
    var email: String?
    var phone: String?
    var dateOfBirth: Date?
    var status: ClientStatus?
    var tags: [String]?
    var emergencyContact: EmergencyContact?
    var insurance: Insurance?
    var clinicalConsiderations: [String]?
    var preferredModalities: [String]?

    enum CodingKeys: String, CodingKey {
        case clientId = "client_id"
        case name
        case email
        case phone
        case dateOfBirth = "date_of_birth"
        case status
        case tags
        case emergencyContact = "emergency_contact"
        case insurance
        case clinicalConsiderations = "clinical_considerations"
        case preferredModalities = "preferred_modalities"
    }

    // Custom encoder to ensure client_id is always encoded when present
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        // Always encode clientId if present (don't skip nil optional)
        if let clientId = clientId {
            try container.encode(clientId, forKey: .clientId)
        }

        // Encode other optional fields
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(email, forKey: .email)
        try container.encodeIfPresent(phone, forKey: .phone)
        try container.encodeIfPresent(dateOfBirth, forKey: .dateOfBirth)
        try container.encodeIfPresent(status, forKey: .status)
        try container.encodeIfPresent(tags, forKey: .tags)
        try container.encodeIfPresent(emergencyContact, forKey: .emergencyContact)
        try container.encodeIfPresent(insurance, forKey: .insurance)
        try container.encodeIfPresent(clinicalConsiderations, forKey: .clinicalConsiderations)
        try container.encodeIfPresent(preferredModalities, forKey: .preferredModalities)
    }
}
