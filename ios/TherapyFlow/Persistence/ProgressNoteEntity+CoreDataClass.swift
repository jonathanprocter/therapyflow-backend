import CoreData
import Foundation

@objc(ProgressNoteEntity)
public class ProgressNoteEntity: NSManagedObject {
    @NSManaged public var id: String?
    @NSManaged public var sessionId: String?
    @NSManaged public var clientId: String?
    @NSManaged public var content: String?
    @NSManaged public var tagsData: Data?
    @NSManaged public var riskLevel: String?
    @NSManaged public var createdAt: Date?
    @NSManaged public var updatedAt: Date?
    @NSManaged public var needsSync: Bool
    @NSManaged public var lastSyncedAt: Date?
}

extension ProgressNoteEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<ProgressNoteEntity> {
        return NSFetchRequest<ProgressNoteEntity>(entityName: "ProgressNoteEntity")
    }

    func toModel() -> ProgressNote {
        ProgressNote(
            id: id ?? UUID().uuidString,
            clientId: clientId ?? "",
            sessionId: sessionId,
            therapistId: "",
            content: content,
            sessionDate: createdAt ?? Date(),
            tags: decodeTags(),
            aiTags: [],
            riskLevel: RiskLevel(rawValue: riskLevel ?? "low") ?? .low,
            progressRating: nil,
            qualityScore: nil,
            qualityFlags: nil,
            status: .completed,
            isPlaceholder: false,
            requiresManualReview: false,
            aiConfidenceScore: nil,
            processingNotes: nil,
            originalDocumentId: nil,
            createdAt: createdAt ?? Date(),
            updatedAt: updatedAt ?? Date()
        )
    }

    func update(from model: ProgressNote) {
        id = model.id
        sessionId = model.sessionId
        clientId = model.clientId
        content = model.content
        tagsData = try? JSONEncoder().encode(model.tags)
        riskLevel = model.riskLevel.rawValue
        createdAt = model.createdAt
        updatedAt = model.updatedAt
        needsSync = true
    }

    private func decodeTags() -> [String] {
        guard let data = tagsData else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }
}
