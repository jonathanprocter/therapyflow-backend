import CoreData
import Foundation

@objc(SessionEntity)
public class SessionEntity: NSManagedObject {
    @NSManaged public var id: String?
    @NSManaged public var clientId: String?
    @NSManaged public var therapistId: String?
    @NSManaged public var scheduledAt: Date?
    @NSManaged public var duration: Int32
    @NSManaged public var sessionType: String?
    @NSManaged public var status: String?
    @NSManaged public var notes: String?
    @NSManaged public var googleEventId: String?
    @NSManaged public var createdAt: Date?
    @NSManaged public var updatedAt: Date?
    @NSManaged public var needsSync: Bool
    @NSManaged public var lastSyncedAt: Date?
}

extension SessionEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<SessionEntity> {
        return NSFetchRequest<SessionEntity>(entityName: "SessionEntity")
    }

    func toModel() -> Session {
        Session(
            id: id ?? UUID().uuidString,
            clientId: clientId ?? "",
            therapistId: therapistId ?? "",
            scheduledAt: scheduledAt ?? Date(),
            duration: Int(duration),
            sessionType: SessionType(rawValue: sessionType ?? "individual") ?? .individual,
            status: SessionStatus(rawValue: status ?? "scheduled") ?? .scheduled,
            googleEventId: googleEventId,
            notes: notes,
            hasProgressNotePlaceholder: false,
            progressNoteStatus: .pending,
            isSimplePracticeEvent: false,
            createdAt: createdAt ?? Date(),
            updatedAt: updatedAt ?? Date()
        )
    }

    func update(from model: Session) {
        id = model.id
        clientId = model.clientId
        therapistId = model.therapistId
        scheduledAt = model.scheduledAt
        duration = Int32(model.duration)
        sessionType = model.sessionType.rawValue
        status = model.status.rawValue
        googleEventId = model.googleEventId
        notes = model.notes
        createdAt = model.createdAt
        updatedAt = model.updatedAt
        needsSync = true
    }
}
