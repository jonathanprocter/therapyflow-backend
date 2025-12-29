import CoreData
import Foundation

// MARK: - Persistence Controller
final class PersistenceController: ObservableObject {
    static let shared = PersistenceController()

    let container: NSPersistentContainer

    // Preview instance for SwiftUI previews
    static var preview: PersistenceController = {
        let controller = PersistenceController(inMemory: true)
        // Add sample data for previews
        let viewContext = controller.container.viewContext

        // Create sample client
        let client = ClientEntity(context: viewContext)
        client.id = UUID().uuidString
        client.name = "Sample Client"
        client.email = "sample@example.com"
        client.status = "active"
        client.createdAt = Date()
        client.updatedAt = Date()

        try? viewContext.save()
        return controller
    }()

    init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "TherapyFlow")

        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        } else {
            // Try to use app group container if available (for extensions), otherwise use default
            // Note: App Group requires entitlement - falls back to default location if not entitled
            let storeURL: URL? = {
                // First try app group container (for sharing with extensions)
                if let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.therapyflow.ios") {
                    return groupURL.appendingPathComponent("TherapyFlow.sqlite")
                }
                // Fall back to default application support directory
                let appSupportURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
                return appSupportURL?.appendingPathComponent("TherapyFlow.sqlite")
            }()

            if let storeURL = storeURL {
                // Ensure the directory exists
                let storeDirectory = storeURL.deletingLastPathComponent()
                try? FileManager.default.createDirectory(at: storeDirectory, withIntermediateDirectories: true)

                let description = NSPersistentStoreDescription(url: storeURL)
                description.shouldMigrateStoreAutomatically = true
                description.shouldInferMappingModelAutomatically = true

                // Enable data protection
                description.setOption(
                    FileProtectionType.complete as NSObject,
                    forKey: NSPersistentStoreFileProtectionKey
                )

                container.persistentStoreDescriptions = [description]
            }
        }

        container.loadPersistentStores { description, error in
            if let error = error {
                fatalError("Unable to load persistent stores: \(error)")
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    // MARK: - Core Data Saving
    func save() {
        let context = container.viewContext
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                print("Error saving context: \(error)")
            }
        }
    }

    // MARK: - Background Context
    func newBackgroundContext() -> NSManagedObjectContext {
        let context = container.newBackgroundContext()
        context.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        return context
    }

    // MARK: - Batch Operations
    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        container.performBackgroundTask(block)
    }

    // MARK: - Delete All Data
    func deleteAllData() {
        let context = container.viewContext

        let entityNames = container.managedObjectModel.entities.compactMap { $0.name }

        for entityName in entityNames {
            let fetchRequest = NSFetchRequest<NSFetchRequestResult>(entityName: entityName)
            let deleteRequest = NSBatchDeleteRequest(fetchRequest: fetchRequest)

            do {
                try context.execute(deleteRequest)
            } catch {
                print("Error deleting \(entityName): \(error)")
            }
        }

        save()
    }
}

// MARK: - Core Data Entity Extensions

extension ClientEntity {
    func toModel() -> Client {
        Client(
            id: id ?? UUID().uuidString,
            therapistId: therapistId ?? "",
            name: name ?? "",
            email: email,
            phone: phone,
            dateOfBirth: dateOfBirth,
            emergencyContact: decodeEmergencyContact(),
            insurance: decodeInsurance(),
            tags: decodeTags(),
            clinicalConsiderations: decodeClinicalConsiderations(),
            preferredModalities: decodePreferredModalities(),
            status: ClientStatus(rawValue: status ?? "active") ?? .active,
            deletedAt: deletedAt,
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
        emergencyContactData = try? JSONEncoder().encode(model.emergencyContact)
        insuranceData = try? JSONEncoder().encode(model.insurance)
        tagsData = try? JSONEncoder().encode(model.tags)
        clinicalConsiderationsData = try? JSONEncoder().encode(model.clinicalConsiderations)
        preferredModalitiesData = try? JSONEncoder().encode(model.preferredModalities)
        status = model.status.rawValue
        deletedAt = model.deletedAt
        createdAt = model.createdAt
        updatedAt = model.updatedAt
        needsSync = true
    }

    private func decodeEmergencyContact() -> EmergencyContact? {
        guard let data = emergencyContactData else { return nil }
        return try? JSONDecoder().decode(EmergencyContact.self, from: data)
    }

    private func decodeInsurance() -> Insurance? {
        guard let data = insuranceData else { return nil }
        return try? JSONDecoder().decode(Insurance.self, from: data)
    }

    private func decodeTags() -> [String] {
        guard let data = tagsData else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }

    private func decodeClinicalConsiderations() -> [String] {
        guard let data = clinicalConsiderationsData else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }

    private func decodePreferredModalities() -> [String] {
        guard let data = preferredModalitiesData else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }
}

extension SessionEntity {
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
            hasProgressNotePlaceholder: hasProgressNotePlaceholder,
            progressNoteStatus: ProgressNoteStatusType(rawValue: progressNoteStatus ?? "pending") ?? .pending,
            isSimplePracticeEvent: isSimplePracticeEvent,
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
        hasProgressNotePlaceholder = model.hasProgressNotePlaceholder
        progressNoteStatus = model.progressNoteStatus.rawValue
        isSimplePracticeEvent = model.isSimplePracticeEvent
        createdAt = model.createdAt
        updatedAt = model.updatedAt
        needsSync = true
    }
}

extension ProgressNoteEntity {
    func toModel() -> ProgressNote {
        ProgressNote(
            id: id ?? UUID().uuidString,
            clientId: clientId ?? "",
            sessionId: sessionId,
            therapistId: therapistId ?? "",
            content: content,
            sessionDate: sessionDate ?? Date(),
            tags: decodeTags(),
            aiTags: decodeAITags(),
            riskLevel: RiskLevel(rawValue: riskLevel ?? "low") ?? .low,
            progressRating: progressRating > 0 ? Int(progressRating) : nil,
            qualityScore: qualityScore > 0 ? qualityScore : nil,
            qualityFlags: decodeQualityFlags(),
            status: NoteStatus(rawValue: status ?? "placeholder") ?? .placeholder,
            isPlaceholder: isPlaceholder,
            requiresManualReview: requiresManualReview,
            aiConfidenceScore: aiConfidenceScore > 0 ? aiConfidenceScore : nil,
            processingNotes: processingNotes,
            originalDocumentId: originalDocumentId,
            createdAt: createdAt ?? Date(),
            updatedAt: updatedAt ?? Date()
        )
    }

    func update(from model: ProgressNote) {
        id = model.id
        clientId = model.clientId
        sessionId = model.sessionId
        therapistId = model.therapistId
        content = model.content
        sessionDate = model.sessionDate
        tagsData = try? JSONEncoder().encode(model.tags)
        aiTagsData = try? JSONEncoder().encode(model.aiTags)
        riskLevel = model.riskLevel.rawValue
        progressRating = Int32(model.progressRating ?? 0)
        qualityScore = model.qualityScore ?? 0
        qualityFlagsData = try? JSONEncoder().encode(model.qualityFlags)
        status = model.status.rawValue
        isPlaceholder = model.isPlaceholder
        requiresManualReview = model.requiresManualReview
        aiConfidenceScore = model.aiConfidenceScore ?? 0
        processingNotes = model.processingNotes
        originalDocumentId = model.originalDocumentId
        createdAt = model.createdAt
        updatedAt = model.updatedAt
        needsSync = true
    }

    private func decodeTags() -> [String] {
        guard let data = tagsData else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }

    private func decodeAITags() -> [String] {
        guard let data = aiTagsData else { return [] }
        return (try? JSONDecoder().decode([String].self, from: data)) ?? []
    }

    private func decodeQualityFlags() -> QualityFlags? {
        guard let data = qualityFlagsData else { return nil }
        return try? JSONDecoder().decode(QualityFlags.self, from: data)
    }
}

// MARK: - Fetch Request Helpers
extension PersistenceController {
    func fetchClients(therapistId: String, status: ClientStatus? = nil) -> [Client] {
        let request: NSFetchRequest<ClientEntity> = ClientEntity.fetchRequest()
        var predicates = [NSPredicate(format: "therapistId == %@", therapistId)]
        predicates.append(NSPredicate(format: "deletedAt == nil"))

        if let status = status {
            predicates.append(NSPredicate(format: "status == %@", status.rawValue))
        }

        request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        request.sortDescriptors = [NSSortDescriptor(keyPath: \ClientEntity.name, ascending: true)]

        do {
            let entities = try container.viewContext.fetch(request)
            return entities.map { $0.toModel() }
        } catch {
            print("Error fetching clients: \(error)")
            return []
        }
    }

    func fetchSessions(therapistId: String, upcoming: Bool = false) -> [Session] {
        let request: NSFetchRequest<SessionEntity> = SessionEntity.fetchRequest()
        var predicates = [NSPredicate(format: "therapistId == %@", therapistId)]

        if upcoming {
            predicates.append(NSPredicate(format: "scheduledAt >= %@", Date() as NSDate))
            predicates.append(NSPredicate(format: "status == %@", SessionStatus.scheduled.rawValue))
        }

        request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        request.sortDescriptors = [NSSortDescriptor(keyPath: \SessionEntity.scheduledAt, ascending: true)]

        do {
            let entities = try container.viewContext.fetch(request)
            return entities.map { $0.toModel() }
        } catch {
            print("Error fetching sessions: \(error)")
            return []
        }
    }

    func fetchProgressNotes(therapistId: String, clientId: String? = nil) -> [ProgressNote] {
        let request: NSFetchRequest<ProgressNoteEntity> = ProgressNoteEntity.fetchRequest()
        var predicates = [NSPredicate(format: "therapistId == %@", therapistId)]

        if let clientId = clientId {
            predicates.append(NSPredicate(format: "clientId == %@", clientId))
        }

        request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        request.sortDescriptors = [NSSortDescriptor(keyPath: \ProgressNoteEntity.sessionDate, ascending: false)]

        do {
            let entities = try container.viewContext.fetch(request)
            return entities.map { $0.toModel() }
        } catch {
            print("Error fetching progress notes: \(error)")
            return []
        }
    }

    func fetchEntitiesNeedingSync<T: NSManagedObject>(_ type: T.Type) -> [T] {
        let request = T.fetchRequest() as! NSFetchRequest<T>
        request.predicate = NSPredicate(format: "needsSync == YES")

        do {
            return try container.viewContext.fetch(request)
        } catch {
            print("Error fetching entities needing sync: \(error)")
            return []
        }
    }
}
