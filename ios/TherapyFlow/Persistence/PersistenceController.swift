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
        client.needsSync = false

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

// MARK: - Fetch Request Helpers
extension PersistenceController {
    func fetchClients(therapistId: String, status: ClientStatus? = nil) -> [Client] {
        let request: NSFetchRequest<ClientEntity> = ClientEntity.fetchRequest()
        var predicates = [NSPredicate]()

        if !therapistId.isEmpty {
            predicates.append(NSPredicate(format: "therapistId == %@", therapistId))
        }

        if let status = status {
            predicates.append(NSPredicate(format: "status == %@", status.rawValue))
        }

        if !predicates.isEmpty {
            request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        }
        request.sortDescriptors = [NSSortDescriptor(keyPath: \ClientEntity.name, ascending: true)]
        request.fetchBatchSize = 20 // Performance: load in batches

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
        var predicates = [NSPredicate]()

        if !therapistId.isEmpty {
            predicates.append(NSPredicate(format: "therapistId == %@", therapistId))
        }

        if upcoming {
            predicates.append(NSPredicate(format: "scheduledAt >= %@", Date() as NSDate))
            predicates.append(NSPredicate(format: "status == %@", SessionStatus.scheduled.rawValue))
        }

        if !predicates.isEmpty {
            request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        }
        request.sortDescriptors = [NSSortDescriptor(keyPath: \SessionEntity.scheduledAt, ascending: true)]
        request.fetchBatchSize = 20 // Performance: load in batches

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
        var predicates = [NSPredicate]()

        if let clientId = clientId {
            predicates.append(NSPredicate(format: "clientId == %@", clientId))
        }

        if !predicates.isEmpty {
            request.predicate = NSCompoundPredicate(andPredicateWithSubpredicates: predicates)
        }
        request.sortDescriptors = [NSSortDescriptor(keyPath: \ProgressNoteEntity.createdAt, ascending: false)]
        request.fetchBatchSize = 20 // Performance: load in batches

        do {
            let entities = try container.viewContext.fetch(request)
            return entities.map { $0.toModel() }
        } catch {
            print("Error fetching progress notes: \(error)")
            return []
        }
    }

    func fetchTreatmentPlans(clientId: String? = nil) -> [TreatmentPlan] {
        let request: NSFetchRequest<TreatmentPlanEntity> = TreatmentPlanEntity.fetchRequest()

        if let clientId = clientId {
            request.predicate = NSPredicate(format: "clientId == %@", clientId)
        }
        request.sortDescriptors = [NSSortDescriptor(keyPath: \TreatmentPlanEntity.createdAt, ascending: false)]
        request.fetchBatchSize = 10 // Performance: load in batches

        do {
            let entities = try container.viewContext.fetch(request)
            return entities.map { $0.toModel() }
        } catch {
            print("Error fetching treatment plans: \(error)")
            return []
        }
    }

    func fetchDocuments(clientId: String? = nil) -> [Document] {
        let request: NSFetchRequest<DocumentEntity> = DocumentEntity.fetchRequest()

        if let clientId = clientId {
            request.predicate = NSPredicate(format: "clientId == %@", clientId)
        }
        request.sortDescriptors = [NSSortDescriptor(keyPath: \DocumentEntity.createdAt, ascending: false)]
        request.fetchBatchSize = 15 // Performance: load in batches

        do {
            let entities = try container.viewContext.fetch(request)
            return entities.map { $0.toModel() }
        } catch {
            print("Error fetching documents: \(error)")
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
