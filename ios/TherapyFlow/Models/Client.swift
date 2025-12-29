import Foundation

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

    enum CodingKeys: String, CodingKey {
        case id
        case therapistId = "therapist_id"
        case name
        case email
        case phone
        case dateOfBirth = "date_of_birth"
        case emergencyContact = "emergency_contact"
        case insurance
        case tags
        case clinicalConsiderations = "clinical_considerations"
        case preferredModalities = "preferred_modalities"
        case status
        case deletedAt = "deleted_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
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

    var displayName: String {
        switch self {
        case .active: return "Active"
        case .inactive: return "Inactive"
        case .discharged: return "Discharged"
        }
    }

    var color: String {
        switch self {
        case .active: return "green"
        case .inactive: return "orange"
        case .discharged: return "gray"
        }
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
}
