import CoreData
import Foundation

@objc(ClientEntity)
public class ClientEntity: NSManagedObject {
    @NSManaged public var id: String?
    @NSManaged public var therapistId: String?
    @NSManaged public var name: String?
    @NSManaged public var email: String?
    @NSManaged public var phone: String?
    @NSManaged public var dateOfBirth: Date?
    @NSManaged public var status: String?
    @NSManaged public var tagsData: Data?
    @NSManaged public var createdAt: Date?
    @NSManaged public var updatedAt: Date?
    @NSManaged public var needsSync: Bool
    @NSManaged public var lastSyncedAt: Date?
}

extension ClientEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<ClientEntity> {
        return NSFetchRequest<ClientEntity>(entityName: "ClientEntity")
    }

    func toModel() -> Client {
        Client(
            id: id ?? UUID().uuidString,
            therapistId: therapistId ?? "",
            name: name ?? "",
            email: email,
            phone: phone,
            dateOfBirth: dateOfBirth,
            emergencyContact: nil,
            insurance: nil,
            tags: decodeTags(),
            clinicalConsiderations: [],
            preferredModalities: [],
            status: ClientStatus(rawValue: status ?? "active") ?? .active,
            deletedAt: nil,
            createdAt: createdAt ?? Date(),
            updatedAt: updatedAt ?? Date()
        )
    }

    func update(from model: Client) {
        id = model.id
        therapistId = model.therapistId
        name = model.name
        email = model.email
        phone = model.phone
        dateOfBirth = model.dateOfBirth
        tagsData = try? JSONEncoder().encode(model.tags)
        status = model.status.rawValue
        createdAt = model.createdAt
        updatedAt = model.updatedAt
        needsSync = true
    }

    private func decodeTags() -> [String] {
        guard let data = tagsData else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }
}
