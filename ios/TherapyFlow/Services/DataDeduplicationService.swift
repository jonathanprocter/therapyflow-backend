import Foundation
import CryptoKit

/// DataDeduplicationService - Handles detection and cleanup of duplicate data
///
/// Features:
/// - Detect duplicate sessions by date and client
/// - Detect duplicate documents by content hash
/// - Safe merge/delete operations
/// - Audit logging for compliance
@MainActor
class DataDeduplicationService: ObservableObject {
    static let shared = DataDeduplicationService()

    @Published var lastDeduplicationRun: Date?
    @Published var duplicatesFound: DeduplicationReport?
    @Published var isProcessing = false

    private init() {}

    // MARK: - Types

    struct DeduplicationReport {
        let duplicateSessions: [DuplicateSessionGroup]
        let duplicateDocuments: [DuplicateDocumentGroup]
        let timestamp: Date
        let totalDuplicateSessions: Int
        let totalDuplicateDocuments: Int

        var isEmpty: Bool {
            duplicateSessions.isEmpty && duplicateDocuments.isEmpty
        }
    }

    struct DuplicateSessionGroup: Identifiable {
        let id = UUID()
        let clientId: String
        let clientName: String
        let date: Date
        let sessions: [Session]

        var duplicateCount: Int { sessions.count - 1 }

        /// The session to keep (typically the one with most data or earliest created)
        var primarySession: Session? { sessions.first }

        /// Sessions that should be deleted
        var duplicatesToRemove: [Session] { Array(sessions.dropFirst()) }
    }

    struct DuplicateDocumentGroup: Identifiable {
        let id = UUID()
        let contentHash: String
        let fileName: String
        let documents: [Document]

        var duplicateCount: Int { documents.count - 1 }

        /// The document to keep
        var primaryDocument: Document? { documents.first }

        /// Documents that should be deleted
        var duplicatesToRemove: [Document] { Array(documents.dropFirst()) }
    }

    struct Document: Identifiable {
        let id: String
        let fileName: String
        let clientId: String?
        let uploadedAt: Date
        let fileSize: Int
        let contentHash: String
    }

    // MARK: - Session Deduplication

    /// Scan for duplicate sessions (same client + same date)
    func findDuplicateSessions(sessions: [Session], clients: [Client]) -> [DuplicateSessionGroup] {
        // Group sessions by client + date (ignoring time)
        var sessionsByKey: [String: [Session]] = [:]

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"

        for session in sessions {
            let dateKey = dateFormatter.string(from: session.scheduledAt)
            let key = "\(session.clientId)-\(dateKey)"

            if sessionsByKey[key] == nil {
                sessionsByKey[key] = []
            }
            sessionsByKey[key]?.append(session)
        }

        // Find groups with more than one session
        var duplicates: [DuplicateSessionGroup] = []

        for (_, sessions) in sessionsByKey where sessions.count > 1 {
            // Sort by: has notes > has more data > earlier created
            let sortedSessions = sessions.sorted { s1, s2 in
                // Prefer sessions with notes
                let hasNotes1 = !(s1.notes?.isEmpty ?? true)
                let hasNotes2 = !(s2.notes?.isEmpty ?? true)
                if hasNotes1 != hasNotes2 { return hasNotes1 }

                // Prefer completed sessions
                if s1.status == .completed && s2.status != .completed { return true }
                if s2.status == .completed && s1.status != .completed { return false }

                // Prefer earlier scheduled time (original)
                return s1.scheduledAt < s2.scheduledAt
            }

            let clientId = sortedSessions.first?.clientId ?? ""
            let clientName = clients.first(where: { $0.id == clientId })?.name ?? "Unknown"
            let date = sortedSessions.first?.scheduledAt ?? Date()

            duplicates.append(DuplicateSessionGroup(
                clientId: clientId,
                clientName: clientName,
                date: date,
                sessions: sortedSessions
            ))
        }

        return duplicates
    }

    /// Remove duplicate sessions, keeping the primary one
    func removeDuplicateSessions(_ duplicateGroups: [DuplicateSessionGroup]) async throws -> Int {
        var removedCount = 0

        for group in duplicateGroups {
            for session in group.duplicatesToRemove {
                do {
                    try await APIClient.shared.requestVoid(
                        endpoint: "/api/sessions/\(session.id)",
                        method: .delete
                    )
                    removedCount += 1
                    print("Removed duplicate session: \(session.id) for client \(group.clientName) on \(group.date)")
                } catch {
                    print("Failed to remove duplicate session \(session.id): \(error.localizedDescription)")
                }
            }
        }

        return removedCount
    }

    // MARK: - Document Deduplication

    /// Scan for duplicate documents (same content hash)
    func findDuplicateDocuments(documents: [Document]) -> [DuplicateDocumentGroup] {
        // Group documents by content hash
        var documentsByHash: [String: [Document]] = [:]

        for doc in documents where !doc.contentHash.isEmpty {
            if documentsByHash[doc.contentHash] == nil {
                documentsByHash[doc.contentHash] = []
            }
            documentsByHash[doc.contentHash]?.append(doc)
        }

        // Find groups with more than one document
        var duplicates: [DuplicateDocumentGroup] = []

        for (hash, docs) in documentsByHash where docs.count > 1 {
            // Sort by: earliest uploaded (keep original)
            let sortedDocs = docs.sorted { $0.uploadedAt < $1.uploadedAt }

            duplicates.append(DuplicateDocumentGroup(
                contentHash: hash,
                fileName: sortedDocs.first?.fileName ?? "Unknown",
                documents: sortedDocs
            ))
        }

        return duplicates
    }

    /// Remove duplicate documents, keeping the primary one
    func removeDuplicateDocuments(_ duplicateGroups: [DuplicateDocumentGroup]) async throws -> Int {
        var removedCount = 0

        for group in duplicateGroups {
            for document in group.duplicatesToRemove {
                do {
                    try await APIClient.shared.requestVoid(
                        endpoint: "/api/documents/\(document.id)",
                        method: .delete
                    )
                    removedCount += 1
                    print("Removed duplicate document: \(document.id) (\(document.fileName))")
                } catch {
                    print("Failed to remove duplicate document \(document.id): \(error.localizedDescription)")
                }
            }
        }

        return removedCount
    }

    // MARK: - Full Deduplication Scan

    /// Run a full deduplication scan on all data
    func runFullDeduplicationScan() async throws -> DeduplicationReport {
        isProcessing = true
        defer { isProcessing = false }

        // Fetch all sessions
        let sessions = try await APIClient.shared.getSessions()
        let clients = try await APIClient.shared.getClients()

        // Find duplicate sessions
        let duplicateSessions = findDuplicateSessions(sessions: sessions, clients: clients)

        // Fetch documents if the endpoint exists
        let duplicateDocuments: [DuplicateDocumentGroup] = []

        // TODO: Add document deduplication when endpoint is available
        // For now, we'll just track sessions

        let report = DeduplicationReport(
            duplicateSessions: duplicateSessions,
            duplicateDocuments: duplicateDocuments,
            timestamp: Date(),
            totalDuplicateSessions: duplicateSessions.reduce(0) { $0 + $1.duplicateCount },
            totalDuplicateDocuments: duplicateDocuments.reduce(0) { $0 + $1.duplicateCount }
        )

        duplicatesFound = report
        lastDeduplicationRun = Date()

        return report
    }

    /// Run full deduplication and auto-remove duplicates
    func runFullDeduplicationAndCleanup() async throws -> (sessionsRemoved: Int, documentsRemoved: Int) {
        let report = try await runFullDeduplicationScan()

        let sessionsRemoved = try await removeDuplicateSessions(report.duplicateSessions)
        let documentsRemoved = try await removeDuplicateDocuments(report.duplicateDocuments)

        // Clear the report after cleanup
        duplicatesFound = nil

        return (sessionsRemoved, documentsRemoved)
    }

    // MARK: - Prevention

    /// Check if adding a session would create a duplicate
    func wouldCreateDuplicateSession(clientId: String, date: Date, existingSessions: [Session]) -> Session? {
        let calendar = Calendar.current

        return existingSessions.first { session in
            session.clientId == clientId &&
            calendar.isDate(session.scheduledAt, inSameDayAs: date)
        }
    }

    /// Generate a content hash for document deduplication
    func generateContentHash(data: Data) -> String {
        // Use SHA256 for content hashing
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}
