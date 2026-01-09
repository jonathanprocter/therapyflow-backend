import Foundation
import CoreData
import Combine

// MARK: - Sync Service
actor SyncService {
    static let shared = SyncService()

    private let apiClient = APIClient.shared
    private let persistence = PersistenceController.shared

    // Sync state
    private var isSyncing = false
    private var lastSyncTime: Date?
    private var syncErrors: [SyncError] = []

    // Conflict resolution strategy
    enum ConflictResolution {
        case serverWins
        case clientWins
        case mostRecent
    }

    private let conflictResolution: ConflictResolution = .mostRecent

    private init() {}

    // MARK: - Public Methods

    func performFullSync() async throws {
        guard !isSyncing else { return }

        // Check network connectivity before syncing
        let isConnected = await MainActor.run { NetworkMonitor.shared.isConnected }
        guard isConnected else {
            addSyncError(.networkUnavailable)
            throw SyncError.networkUnavailable
        }

        isSyncing = true
        syncErrors = []

        defer {
            isSyncing = false
            lastSyncTime = Date()
        }

        // Sync in order: push local changes, then pull remote changes
        try await pushLocalChanges()
        try await pullRemoteChanges()
    }

    func performQuickSync() async throws {
        guard !isSyncing else { return }

        // Check network connectivity before syncing
        let isConnected = await MainActor.run { NetworkMonitor.shared.isConnected }
        guard isConnected else {
            addSyncError(.networkUnavailable)
            throw SyncError.networkUnavailable
        }

        isSyncing = true
        defer { isSyncing = false }

        // Only push local changes for quick sync
        try await pushLocalChanges()
    }

    /// Check if sync should be attempted (network available and not on expensive connection if auto-sync)
    func shouldAttemptSync(autoSync: Bool = false) async -> Bool {
        let monitor = await MainActor.run { NetworkMonitor.shared }
        let isConnected = await MainActor.run { monitor.isConnected }

        if !isConnected {
            return false
        }

        // For auto-sync, also check if connection is suitable
        if autoSync {
            let shouldAutoSync = await MainActor.run { monitor.shouldAutoSync }
            return shouldAutoSync
        }

        return true
    }

    func getSyncStatus() -> SyncStatus {
        SyncStatus(
            isSyncing: isSyncing,
            lastSyncTime: lastSyncTime,
            pendingChanges: getPendingChangesCount(),
            errors: syncErrors
        )
    }

    // MARK: - Push Local Changes

    private func pushLocalChanges() async throws {
        // Push clients
        try await pushClients()

        // Push sessions
        try await pushSessions()

        // Push progress notes
        try await pushProgressNotes()
    }

    private func pushClients() async throws {
        let context = persistence.newBackgroundContext()

        // Collect data synchronously within context.perform
        let clientsToSync: [(objectID: NSManagedObjectID, client: Client, isNew: Bool)] = await context.perform {
            let request: NSFetchRequest<ClientEntity> = ClientEntity.fetchRequest()
            request.predicate = NSPredicate(format: "needsSync == YES")

            guard let entities = try? context.fetch(request) else { return [] }

            return entities.map { entity in
                (objectID: entity.objectID, client: entity.toModel(), isNew: entity.lastSyncedAt == nil)
            }
        }

        // Process each client asynchronously
        for (objectID, client, isNew) in clientsToSync {
            do {
                if isNew {
                    let input = CreateClientInput(
                        name: client.name,
                        email: client.email,
                        phone: client.phone,
                        dateOfBirth: client.dateOfBirth,
                        tags: client.tags,
                        emergencyContact: client.emergencyContact,
                        insurance: client.insurance,
                        clinicalConsiderations: client.clinicalConsiderations,
                        preferredModalities: client.preferredModalities
                    )
                    let created = try await self.apiClient.createClient(input)
                    await self.updateLocalClient(objectID: objectID, with: created, in: context)
                } else {
                    let input = UpdateClientInput(
                        clientId: client.id,
                        name: client.name,
                        email: client.email,
                        phone: client.phone,
                        dateOfBirth: client.dateOfBirth,
                        status: client.status,
                        tags: client.tags,
                        emergencyContact: client.emergencyContact,
                        insurance: client.insurance,
                        clinicalConsiderations: client.clinicalConsiderations,
                        preferredModalities: client.preferredModalities
                    )
                    let updated = try await self.apiClient.updateClient(id: client.id, input)
                    await self.updateLocalClient(objectID: objectID, with: updated, in: context)
                }
            } catch {
                await self.addSyncError(.pushFailed(entity: "Client", id: client.id, error: error))
            }
        }
    }

    private func pushSessions() async throws {
        let context = persistence.newBackgroundContext()

        // Collect data synchronously within context.perform
        let sessionsToSync: [(objectID: NSManagedObjectID, session: Session, isNew: Bool)] = await context.perform {
            let request: NSFetchRequest<SessionEntity> = SessionEntity.fetchRequest()
            request.predicate = NSPredicate(format: "needsSync == YES")

            guard let entities = try? context.fetch(request) else { return [] }

            return entities.map { entity in
                (objectID: entity.objectID, session: entity.toModel(), isNew: entity.lastSyncedAt == nil)
            }
        }

        // Process each session asynchronously
        for (objectID, session, isNew) in sessionsToSync {
            do {
                if isNew {
                    let input = CreateSessionInput(
                        clientId: session.clientId,
                        scheduledAt: session.scheduledAt,
                        duration: session.duration,
                        sessionType: session.sessionType,
                        notes: session.notes
                    )
                    let created = try await self.apiClient.createSession(input)
                    await self.updateLocalSession(objectID: objectID, with: created, in: context)
                } else {
                    let input = UpdateSessionInput(
                        scheduledAt: session.scheduledAt,
                        duration: session.duration,
                        sessionType: session.sessionType,
                        status: session.status,
                        notes: session.notes
                    )
                    let updated = try await self.apiClient.updateSession(id: session.id, input)
                    await self.updateLocalSession(objectID: objectID, with: updated, in: context)
                }
            } catch {
                await self.addSyncError(.pushFailed(entity: "Session", id: session.id, error: error))
            }
        }
    }

    private func pushProgressNotes() async throws {
        let context = persistence.newBackgroundContext()

        // Collect data synchronously within context.perform
        let notesToSync: [(objectID: NSManagedObjectID, note: ProgressNote, isNew: Bool)] = await context.perform {
            let request: NSFetchRequest<ProgressNoteEntity> = ProgressNoteEntity.fetchRequest()
            request.predicate = NSPredicate(format: "needsSync == YES")

            guard let entities = try? context.fetch(request) else { return [] }

            return entities.map { entity in
                (objectID: entity.objectID, note: entity.toModel(), isNew: entity.lastSyncedAt == nil)
            }
        }

        // Process each note asynchronously
        for (objectID, note, isNew) in notesToSync {
            do {
                if isNew {
                    let input = CreateProgressNoteInput(
                        clientId: note.clientId,
                        sessionId: note.sessionId,
                        sessionDate: note.sessionDate,
                        content: note.content ?? "",
                        tags: note.tags,
                        riskLevel: note.riskLevel,
                        progressRating: note.progressRating
                    )
                    let created = try await self.apiClient.createProgressNote(input)
                    await self.updateLocalProgressNote(objectID: objectID, with: created, in: context)
                } else {
                    let input = UpdateProgressNoteInput(
                        content: note.content,
                        sessionDate: note.sessionDate,
                        tags: note.tags,
                        riskLevel: note.riskLevel,
                        progressRating: note.progressRating,
                        status: note.status
                    )
                    let updated = try await self.apiClient.updateProgressNote(id: note.id, input)
                    await self.updateLocalProgressNote(objectID: objectID, with: updated, in: context)
                }
            } catch {
                await self.addSyncError(.pushFailed(entity: "ProgressNote", id: note.id, error: error))
            }
        }
    }

    // MARK: - Pull Remote Changes

    private func pullRemoteChanges() async throws {
        // Pull clients
        try await pullClients()

        // Pull sessions
        try await pullSessions()

        // Pull progress notes
        try await pullProgressNotes()

        // Pull calendar events (cached for offline access)
        try await pullCalendarEvents()

        // Pull documents list
        try await pullDocuments()
    }

    private func pullCalendarEvents() async throws {
        do {
            // Get events from the past 60 days and next 30 days for comprehensive coverage
            let startDate = Calendar.current.date(byAdding: .day, value: -60, to: Date()) ?? Date()
            let endDate = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()

            let remoteEvents = try await apiClient.getCalendarEvents(startDate: startDate, endDate: endDate)

            // Cache events locally using UserDefaults for quick access
            // In production, this could use Core Data for more robust storage
            await cacheCalendarEvents(remoteEvents)

            print("Calendar events synced successfully: \(remoteEvents.count) events")
        } catch {
            await addSyncError(.pullFailed(entity: "CalendarEvents", error: error))
        }
    }

    /// Cache calendar events locally for offline access and document matching
    private func cacheCalendarEvents(_ events: [SyncedCalendarEvent]) async {
        // Encode events to JSON and store in UserDefaults
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601

        if let encoded = try? encoder.encode(events) {
            UserDefaults.standard.set(encoded, forKey: "cachedCalendarEvents")
            UserDefaults.standard.set(Date(), forKey: "cachedCalendarEventsTimestamp")
        }
    }

    /// Get cached calendar events for document matching
    func getCachedCalendarEvents() -> [SyncedCalendarEvent] {
        guard let data = UserDefaults.standard.data(forKey: "cachedCalendarEvents") else {
            return []
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        return (try? decoder.decode([SyncedCalendarEvent].self, from: data)) ?? []
    }

    /// Check if cached calendar events are still fresh (within 1 hour)
    func isCachedCalendarEventsFresh() -> Bool {
        guard let timestamp = UserDefaults.standard.object(forKey: "cachedCalendarEventsTimestamp") as? Date else {
            return false
        }
        return Date().timeIntervalSince(timestamp) < 3600 // 1 hour
    }

    /// Force refresh calendar events cache
    func refreshCalendarEventsCache() async throws {
        try await pullCalendarEvents()
    }

    private func pullDocuments() async throws {
        do {
            let _ = try await apiClient.getDocuments()
            // Documents list is fetched for caching
            print("Documents list synced successfully")
        } catch {
            await addSyncError(.pullFailed(entity: "Documents", error: error))
        }
    }

    private func pullClients() async throws {
        let remoteClients = try await apiClient.getClients()
        let context = persistence.newBackgroundContext()

        await context.perform {
            for remoteClient in remoteClients {
                let request: NSFetchRequest<ClientEntity> = ClientEntity.fetchRequest()
                request.predicate = NSPredicate(format: "id == %@", remoteClient.id)

                let existingEntity = try? context.fetch(request).first

                if let entity = existingEntity {
                    // Check for conflicts
                    if entity.needsSync {
                        // Conflict - apply resolution strategy using most recent wins
                        if remoteClient.updatedAt > (entity.updatedAt ?? Date.distantPast) {
                            entity.update(from: remoteClient)
                            entity.needsSync = false
                        }
                    } else {
                        // No conflict - update local
                        entity.update(from: remoteClient)
                        entity.needsSync = false
                        entity.lastSyncedAt = Date()
                    }
                } else {
                    // New remote entity - create locally
                    let newEntity = ClientEntity(context: context)
                    newEntity.update(from: remoteClient)
                    newEntity.needsSync = false
                    newEntity.lastSyncedAt = Date()
                }
            }

            try? context.save()
        }
    }

    private func pullSessions() async throws {
        let remoteSessions = try await apiClient.getSessions()
        let context = persistence.newBackgroundContext()

        await context.perform {
            for remoteSession in remoteSessions {
                let request: NSFetchRequest<SessionEntity> = SessionEntity.fetchRequest()
                request.predicate = NSPredicate(format: "id == %@", remoteSession.id)

                let existingEntity = try? context.fetch(request).first

                if let entity = existingEntity {
                    if entity.needsSync {
                        if remoteSession.updatedAt > (entity.updatedAt ?? Date.distantPast) {
                            entity.update(from: remoteSession)
                            entity.needsSync = false
                            entity.lastSyncedAt = Date()
                        }
                    } else {
                        entity.update(from: remoteSession)
                        entity.needsSync = false
                        entity.lastSyncedAt = Date()
                    }
                } else {
                    let newEntity = SessionEntity(context: context)
                    newEntity.update(from: remoteSession)
                    newEntity.needsSync = false
                    newEntity.lastSyncedAt = Date()
                }
            }

            try? context.save()
        }
    }

    private func pullProgressNotes() async throws {
        let remoteNotes = try await apiClient.getProgressNotes(recent: true)
        let context = persistence.newBackgroundContext()

        await context.perform {
            for remoteNote in remoteNotes {
                let request: NSFetchRequest<ProgressNoteEntity> = ProgressNoteEntity.fetchRequest()
                request.predicate = NSPredicate(format: "id == %@", remoteNote.id)

                let existingEntity = try? context.fetch(request).first

                if let entity = existingEntity {
                    if entity.needsSync {
                        if remoteNote.updatedAt > (entity.updatedAt ?? Date.distantPast) {
                            entity.update(from: remoteNote)
                            entity.needsSync = false
                            entity.lastSyncedAt = Date()
                        }
                    } else {
                        entity.update(from: remoteNote)
                        entity.needsSync = false
                        entity.lastSyncedAt = Date()
                    }
                } else {
                    let newEntity = ProgressNoteEntity(context: context)
                    newEntity.update(from: remoteNote)
                    newEntity.needsSync = false
                    newEntity.lastSyncedAt = Date()
                }
            }

            try? context.save()
        }
    }

    // MARK: - Helper Methods

    private nonisolated func updateLocalClient(objectID: NSManagedObjectID, with model: Client, in context: NSManagedObjectContext) async {
        await context.perform {
            guard let entity = try? context.existingObject(with: objectID) as? ClientEntity else { return }
            entity.update(from: model)
            entity.needsSync = false
            entity.lastSyncedAt = Date()
            try? context.save()
        }
    }

    private nonisolated func updateLocalSession(objectID: NSManagedObjectID, with model: Session, in context: NSManagedObjectContext) async {
        await context.perform {
            guard let entity = try? context.existingObject(with: objectID) as? SessionEntity else { return }
            entity.update(from: model)
            entity.needsSync = false
            entity.lastSyncedAt = Date()
            try? context.save()
        }
    }

    private nonisolated func updateLocalProgressNote(objectID: NSManagedObjectID, with model: ProgressNote, in context: NSManagedObjectContext) async {
        await context.perform {
            guard let entity = try? context.existingObject(with: objectID) as? ProgressNoteEntity else { return }
            entity.update(from: model)
            entity.needsSync = false
            entity.lastSyncedAt = Date()
            try? context.save()
        }
    }

    private func getPendingChangesCount() -> Int {
        let context = persistence.container.viewContext
        var count = 0

        let clientRequest: NSFetchRequest<ClientEntity> = ClientEntity.fetchRequest()
        clientRequest.predicate = NSPredicate(format: "needsSync == YES")
        count += (try? context.count(for: clientRequest)) ?? 0

        let sessionRequest: NSFetchRequest<SessionEntity> = SessionEntity.fetchRequest()
        sessionRequest.predicate = NSPredicate(format: "needsSync == YES")
        count += (try? context.count(for: sessionRequest)) ?? 0

        let noteRequest: NSFetchRequest<ProgressNoteEntity> = ProgressNoteEntity.fetchRequest()
        noteRequest.predicate = NSPredicate(format: "needsSync == YES")
        count += (try? context.count(for: noteRequest)) ?? 0

        return count
    }

    private func addSyncError(_ error: SyncError) {
        syncErrors.append(error)
    }
}

// MARK: - Sync Status
struct SyncStatus {
    let isSyncing: Bool
    let lastSyncTime: Date?
    let pendingChanges: Int
    let errors: [SyncError]

    var hasPendingChanges: Bool {
        pendingChanges > 0
    }

    var hasErrors: Bool {
        !errors.isEmpty
    }
}

// MARK: - Sync Error
enum SyncError: LocalizedError {
    case pushFailed(entity: String, id: String, error: Error)
    case pullFailed(entity: String, error: Error)
    case conflictResolutionFailed(entity: String, id: String)
    case networkUnavailable

    var errorDescription: String? {
        switch self {
        case .pushFailed(let entity, let id, let error):
            return "Failed to sync \(entity) (\(id)): \(error.localizedDescription)"
        case .pullFailed(let entity, let error):
            return "Failed to fetch \(entity): \(error.localizedDescription)"
        case .conflictResolutionFailed(let entity, let id):
            return "Conflict resolution failed for \(entity) (\(id))"
        case .networkUnavailable:
            return "Network is unavailable"
        }
    }
}
