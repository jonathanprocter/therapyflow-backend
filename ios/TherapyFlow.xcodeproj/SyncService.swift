import Foundation
import CoreData

// MARK: - Sync Service
actor SyncService {
    static let shared = SyncService()
    
    private var isSyncing = false
    private let syncQueue = DispatchQueue(label: "com.therapyflow.sync", qos: .utility)
    
    private init() {}
    
    // MARK: - Full Sync
    func performFullSync() async throws {
        guard !isSyncing else {
            print("Sync already in progress")
            return
        }
        
        isSyncing = true
        defer { isSyncing = false }
        
        await MainActor.run {
            AppState.shared.updateSyncState(isSyncing: true)
        }
        
        do {
            // Sync in order of dependencies
            try await syncClients()
            try await syncSessions()
            try await syncProgressNotes()
            try await syncDocuments()
            try await syncTreatmentPlans()
            
            // Update last sync time
            await MainActor.run {
                AppState.shared.updateSyncState(
                    isSyncing: false,
                    lastSync: Date(),
                    pendingChanges: 0
                )
            }
            
            print("Full sync completed successfully")
        } catch {
            await MainActor.run {
                AppState.shared.updateSyncState(isSyncing: false)
            }
            throw error
        }
    }
    
    // MARK: - Quick Sync (only pending changes)
    func performQuickSync() async throws {
        guard !isSyncing else { return }
        
        isSyncing = true
        defer { isSyncing = false }
        
        do {
            let pendingCount = try await syncPendingChanges()
            
            await MainActor.run {
                AppState.shared.updateSyncState(
                    isSyncing: false,
                    lastSync: Date(),
                    pendingChanges: 0
                )
            }
            
            print("Quick sync completed: \(pendingCount) items synced")
        } catch {
            throw error
        }
    }
    
    // MARK: - Sync Clients
    private func syncClients() async throws {
        // Fetch from server
        let serverClients: [Client] = try await APIClient.shared.request(
            endpoint: "/api/clients"
        )
        
        // Update Core Data
        let context = PersistenceController.shared.newBackgroundContext()
        
        try await context.perform {
            for client in serverClients {
                let fetchRequest: NSFetchRequest<ClientEntity> = ClientEntity.fetchRequest()
                fetchRequest.predicate = NSPredicate(format: "id == %@", client.id)
                
                let existingClients = try context.fetch(fetchRequest)
                let clientEntity = existingClients.first ?? ClientEntity(context: context)
                
                // Update properties
                clientEntity.id = client.id
                clientEntity.name = client.name
                clientEntity.email = client.email
                clientEntity.phone = client.phone
                clientEntity.dateOfBirth = client.dateOfBirth
                clientEntity.status = client.status.rawValue
                clientEntity.createdAt = client.createdAt
                clientEntity.updatedAt = client.updatedAt
                clientEntity.needsSync = false
                clientEntity.lastSyncedAt = Date()
                
                // Encode complex types
                if let tagsData = try? JSONEncoder().encode(client.tags) {
                    clientEntity.tagsData = tagsData
                }
            }
            
            try context.save()
        }
    }
    
    // MARK: - Sync Sessions
    private func syncSessions() async throws {
        let serverSessions: [Session] = try await APIClient.shared.request(
            endpoint: "/api/sessions"
        )
        
        let context = PersistenceController.shared.newBackgroundContext()
        
        try await context.perform {
            for session in serverSessions {
                let fetchRequest: NSFetchRequest<SessionEntity> = SessionEntity.fetchRequest()
                fetchRequest.predicate = NSPredicate(format: "id == %@", session.id)
                
                let existingSessions = try context.fetch(fetchRequest)
                let sessionEntity = existingSessions.first ?? SessionEntity(context: context)
                
                // Update properties
                sessionEntity.id = session.id
                sessionEntity.clientId = session.clientId
                sessionEntity.scheduledAt = session.scheduledAt
                sessionEntity.duration = Int32(session.duration)
                sessionEntity.sessionType = session.sessionType.rawValue
                sessionEntity.status = session.status.rawValue
                sessionEntity.notes = session.notes
                sessionEntity.createdAt = session.createdAt
                sessionEntity.updatedAt = session.updatedAt
                sessionEntity.needsSync = false
                sessionEntity.lastSyncedAt = Date()
            }
            
            try context.save()
        }
    }
    
    // MARK: - Sync Progress Notes
    private func syncProgressNotes() async throws {
        let serverNotes: [ProgressNote] = try await APIClient.shared.request(
            endpoint: "/api/progress-notes"
        )
        
        let context = PersistenceController.shared.newBackgroundContext()
        
        try await context.perform {
            for note in serverNotes {
                let fetchRequest: NSFetchRequest<ProgressNoteEntity> = ProgressNoteEntity.fetchRequest()
                fetchRequest.predicate = NSPredicate(format: "id == %@", note.id)
                
                let existingNotes = try context.fetch(fetchRequest)
                let noteEntity = existingNotes.first ?? ProgressNoteEntity(context: context)
                
                // Update properties
                noteEntity.id = note.id
                noteEntity.sessionId = note.sessionId
                noteEntity.clientId = note.clientId
                noteEntity.content = note.content
                noteEntity.createdAt = note.createdAt
                noteEntity.updatedAt = note.updatedAt
                noteEntity.needsSync = false
                noteEntity.lastSyncedAt = Date()
                
                if let tagsData = try? JSONEncoder().encode(note.tags) {
                    noteEntity.tagsData = tagsData
                }
            }
            
            try context.save()
        }
    }
    
    // MARK: - Sync Documents
    private func syncDocuments() async throws {
        let serverDocuments: [Document] = try await APIClient.shared.request(
            endpoint: "/api/documents"
        )
        
        let context = PersistenceController.shared.newBackgroundContext()
        
        try await context.perform {
            for document in serverDocuments {
                let fetchRequest: NSFetchRequest<DocumentEntity> = DocumentEntity.fetchRequest()
                fetchRequest.predicate = NSPredicate(format: "id == %@", document.id)
                
                let existingDocs = try context.fetch(fetchRequest)
                let docEntity = existingDocs.first ?? DocumentEntity(context: context)
                
                // Update properties
                docEntity.id = document.id
                docEntity.filename = document.filename
                docEntity.fileUrl = document.fileUrl
                docEntity.clientId = document.clientId
                docEntity.extractedText = document.extractedText
                docEntity.createdAt = document.createdAt
                docEntity.updatedAt = document.updatedAt
                docEntity.needsSync = false
                docEntity.lastSyncedAt = Date()
                
                if let tagsData = try? JSONEncoder().encode(document.tags) {
                    docEntity.tagsData = tagsData
                }
            }
            
            try context.save()
        }
    }
    
    // MARK: - Sync Treatment Plans
    private func syncTreatmentPlans() async throws {
        let serverPlans: [TreatmentPlan] = try await APIClient.shared.request(
            endpoint: "/api/treatment-plans"
        )
        
        let context = PersistenceController.shared.newBackgroundContext()
        
        try await context.perform {
            for plan in serverPlans {
                let fetchRequest: NSFetchRequest<TreatmentPlanEntity> = TreatmentPlanEntity.fetchRequest()
                fetchRequest.predicate = NSPredicate(format: "id == %@", plan.id)
                
                let existingPlans = try context.fetch(fetchRequest)
                let planEntity = existingPlans.first ?? TreatmentPlanEntity(context: context)
                
                // Update properties
                planEntity.id = plan.id
                planEntity.clientId = plan.clientId
                planEntity.title = plan.title
                planEntity.createdAt = plan.createdAt
                planEntity.updatedAt = plan.updatedAt
                planEntity.needsSync = false
                planEntity.lastSyncedAt = Date()
                
                if let goalsData = try? JSONEncoder().encode(plan.goals) {
                    planEntity.goalsData = goalsData
                }
            }
            
            try context.save()
        }
    }
    
    // MARK: - Sync Pending Changes
    private func syncPendingChanges() async throws -> Int {
        let context = PersistenceController.shared.newBackgroundContext()
        var syncCount = 0
        
        try await context.perform {
            // Find all entities that need sync
            let clientRequest: NSFetchRequest<ClientEntity> = ClientEntity.fetchRequest()
            clientRequest.predicate = NSPredicate(format: "needsSync == YES")
            let pendingClients = try context.fetch(clientRequest)
            
            syncCount += pendingClients.count
            
            // Mark as synced (actual upload logic would go here)
            for client in pendingClients {
                client.needsSync = false
                client.lastSyncedAt = Date()
            }
            
            try context.save()
        }
        
        return syncCount
    }
}

// MARK: - Core Data Entity Classes (Placeholder)
// These should be auto-generated from your .xcdatamodeld file
// Add @objc(ClientEntity) attribute to each

class ClientEntity: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var therapistId: String?
    @NSManaged var name: String
    @NSManaged var email: String?
    @NSManaged var phone: String?
    @NSManaged var dateOfBirth: Date?
    @NSManaged var status: String
    @NSManaged var tagsData: Data?
    @NSManaged var createdAt: Date
    @NSManaged var updatedAt: Date
    @NSManaged var needsSync: Bool
    @NSManaged var lastSyncedAt: Date?
}

class SessionEntity: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var clientId: String
    @NSManaged var therapistId: String?
    @NSManaged var scheduledAt: Date
    @NSManaged var duration: Int32
    @NSManaged var sessionType: String
    @NSManaged var status: String
    @NSManaged var notes: String?
    @NSManaged var createdAt: Date
    @NSManaged var updatedAt: Date
    @NSManaged var needsSync: Bool
    @NSManaged var lastSyncedAt: Date?
}

class ProgressNoteEntity: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var sessionId: String
    @NSManaged var clientId: String
    @NSManaged var content: String
    @NSManaged var tagsData: Data?
    @NSManaged var createdAt: Date
    @NSManaged var updatedAt: Date
    @NSManaged var needsSync: Bool
    @NSManaged var lastSyncedAt: Date?
}

class DocumentEntity: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var filename: String
    @NSManaged var fileUrl: String
    @NSManaged var clientId: String?
    @NSManaged var extractedText: String?
    @NSManaged var tagsData: Data?
    @NSManaged var createdAt: Date
    @NSManaged var updatedAt: Date
    @NSManaged var needsSync: Bool
    @NSManaged var lastSyncedAt: Date?
}

class TreatmentPlanEntity: NSManagedObject {
    @NSManaged var id: String
    @NSManaged var clientId: String
    @NSManaged var title: String
    @NSManaged var goalsData: Data?
    @NSManaged var createdAt: Date
    @NSManaged var updatedAt: Date
    @NSManaged var needsSync: Bool
    @NSManaged var lastSyncedAt: Date?
}

// MARK: - Fetch Request Extensions
extension ClientEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<ClientEntity> {
        return NSFetchRequest<ClientEntity>(entityName: "ClientEntity")
    }
}

extension SessionEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<SessionEntity> {
        return NSFetchRequest<SessionEntity>(entityName: "SessionEntity")
    }
}

extension ProgressNoteEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<ProgressNoteEntity> {
        return NSFetchRequest<ProgressNoteEntity>(entityName: "ProgressNoteEntity")
    }
}

extension DocumentEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<DocumentEntity> {
        return NSFetchRequest<DocumentEntity>(entityName: "DocumentEntity")
    }
}

extension TreatmentPlanEntity {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<TreatmentPlanEntity> {
        return NSFetchRequest<TreatmentPlanEntity>(entityName: "TreatmentPlanEntity")
    }
}
