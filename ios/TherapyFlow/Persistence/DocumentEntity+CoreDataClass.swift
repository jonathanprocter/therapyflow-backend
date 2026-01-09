import CoreData
import Foundation

@objc(DocumentEntity)
public class DocumentEntity: NSManagedObject {
    @NSManaged public var id: String?
    @NSManaged public var filename: String?
    @NSManaged public var fileUrl: String?
    @NSManaged public var clientId: String?
    @NSManaged public var extractedText: String?
    @NSManaged public var tagsData: Data?
    @NSManaged public var fileSize: Int64
    @NSManaged public var createdAt: Date?
    @NSManaged public var updatedAt: Date?
    @NSManaged public var needsSync: Bool
    @NSManaged public var lastSyncedAt: Date?
}

extension DocumentEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<DocumentEntity> {
        return NSFetchRequest<DocumentEntity>(entityName: "DocumentEntity")
    }

    func toModel() -> Document {
        Document(
            id: id ?? UUID().uuidString,
            clientId: clientId ?? "",
            therapistId: "",
            fileName: filename ?? "",
            fileType: (filename as NSString?)?.pathExtension ?? "",
            filePath: fileUrl ?? "",
            extractedText: extractedText,
            tags: decodeTags(),
            fileSize: fileSize > 0 ? Int(fileSize) : nil,
            metadata: nil,
            uploadedAt: createdAt ?? Date(),
            status: .processed
        )
    }

    func update(from model: Document) {
        id = model.id
        filename = model.fileName
        fileUrl = model.filePath
        clientId = model.clientId
        extractedText = model.extractedText
        tagsData = try? JSONEncoder().encode(model.tags)
        fileSize = Int64(model.fileSize ?? 0)
        createdAt = model.uploadedAt
        updatedAt = Date()
        needsSync = true
    }

    private func decodeTags() -> [String] {
        guard let data = tagsData else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }
}
