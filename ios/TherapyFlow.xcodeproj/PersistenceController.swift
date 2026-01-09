import CoreData
import Foundation

// MARK: - Persistence Controller
class PersistenceController {
    static let shared = PersistenceController()
    
    let container: NSPersistentContainer
    
    // Preview instance for SwiftUI previews
    static var preview: PersistenceController = {
        let controller = PersistenceController(inMemory: true)
        let viewContext = controller.container.viewContext
        
        // Add sample data for previews
        // Example: Create sample client
        // let client = ClientEntity(context: viewContext)
        // client.id = UUID().uuidString
        // client.name = "Sample Client"
        
        do {
            try viewContext.save()
        } catch {
            fatalError("Preview data error: \(error)")
        }
        
        return controller
    }()
    
    init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "TherapyFlow")
        
        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        }
        
        container.loadPersistentStores { description, error in
            if let error = error {
                // In production, handle this error appropriately
                fatalError("Core Data failed to load: \(error.localizedDescription)")
            }
        }
        
        // Enable automatic merging of changes
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        
        // Configure for better performance
        container.viewContext.undoManager = nil
        container.viewContext.shouldDeleteInaccessibleFaults = true
    }
    
    // MARK: - Save Context
    func save() {
        let context = container.viewContext
        
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                let nsError = error as NSError
                print("Core Data save error: \(nsError), \(nsError.userInfo)")
            }
        }
    }
    
    // MARK: - Background Context
    func newBackgroundContext() -> NSManagedObjectContext {
        let context = container.newBackgroundContext()
        context.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        return context
    }
    
    // MARK: - Perform Background Task
    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        container.performBackgroundTask(block)
    }
    
    // MARK: - Batch Delete
    func batchDelete(entityName: String, predicate: NSPredicate? = nil) throws {
        let fetchRequest: NSFetchRequest<NSFetchRequestResult> = NSFetchRequest(entityName: entityName)
        fetchRequest.predicate = predicate
        
        let batchDeleteRequest = NSBatchDeleteRequest(fetchRequest: fetchRequest)
        batchDeleteRequest.resultType = .resultTypeObjectIDs
        
        let result = try container.viewContext.execute(batchDeleteRequest) as? NSBatchDeleteResult
        
        // Merge changes into the view context
        if let objectIDs = result?.result as? [NSManagedObjectID] {
            let changes = [NSDeletedObjectsKey: objectIDs]
            NSManagedObjectContext.mergeChanges(fromRemoteContextSave: changes, into: [container.viewContext])
        }
    }
    
    // MARK: - Reset Store
    func resetStore() throws {
        guard let storeURL = container.persistentStoreDescriptions.first?.url else {
            return
        }
        
        let coordinator = container.persistentStoreCoordinator
        
        // Remove all stores
        for store in coordinator.persistentStores {
            try coordinator.remove(store)
        }
        
        // Delete the store file
        try FileManager.default.removeItem(at: storeURL)
        
        // Reload stores
        container.loadPersistentStores { _, error in
            if let error = error {
                fatalError("Failed to reload stores: \(error)")
            }
        }
    }
}

// MARK: - Core Data Extensions
extension NSManagedObjectContext {
    func saveIfNeeded() throws {
        if hasChanges {
            try save()
        }
    }
}
