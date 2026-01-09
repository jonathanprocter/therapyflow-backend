import Foundation

/// DocumentReprocessingService - AI-powered batch reprocessing of documents
///
/// Features:
/// - Identify unlinked/uncategorized documents
/// - Run AI analysis to extract client and date information
/// - Match documents to calendar events
/// - Batch process multiple documents
/// - Report on reprocessing results
@MainActor
class DocumentReprocessingService: ObservableObject {
    static let shared = DocumentReprocessingService()

    @Published var isProcessing = false
    @Published var currentProgress: ReprocessingProgress?
    @Published var lastResult: ReprocessingResult?

    private init() {}

    // MARK: - Types

    struct ReprocessingProgress {
        let total: Int
        let processed: Int
        let currentDocument: String?

        var percentComplete: Double {
            guard total > 0 else { return 0 }
            return Double(processed) / Double(total) * 100
        }
    }

    struct ReprocessingResult {
        let totalDocuments: Int
        let successfullyLinked: Int
        let needsManualReview: Int
        let failed: Int
        let linkedDocuments: [LinkedDocument]
        let reviewNeeded: [ReviewNeededDocument]
        let errors: [String]
        let timestamp: Date

        struct LinkedDocument {
            let documentId: String
            let fileName: String
            let clientName: String
            let sessionDate: Date?
            let confidence: Double
        }

        struct ReviewNeededDocument {
            let documentId: String
            let fileName: String
            let suggestedClientName: String?
            let suggestedDate: Date?
            let confidence: Double
            let reason: String
        }
    }

    // MARK: - Get Unlinked Documents

    /// Get all documents that need reprocessing (unlinked, pending, or failed)
    func getDocumentsNeedingReprocessing() async throws -> [Document] {
        let allDocuments = try await APIClient.shared.getDocuments()

        // Filter to documents that need attention
        return allDocuments.filter { document in
            // No client linked
            if document.clientId.isEmpty {
                return true
            }

            // Still pending or failed
            if document.status == .pending || document.status == .failed {
                return true
            }

            // No extracted text (needs OCR)
            if document.extractedText?.isEmpty ?? true {
                return true
            }

            return false
        }
    }

    // MARK: - Reprocess All Unlinked Documents

    /// Reprocess all unlinked/pending documents with AI
    func reprocessAllUnlinkedDocuments() async throws -> ReprocessingResult {
        isProcessing = true
        defer { isProcessing = false }

        let documentsToProcess = try await getDocumentsNeedingReprocessing()

        guard !documentsToProcess.isEmpty else {
            let result = ReprocessingResult(
                totalDocuments: 0,
                successfullyLinked: 0,
                needsManualReview: 0,
                failed: 0,
                linkedDocuments: [],
                reviewNeeded: [],
                errors: [],
                timestamp: Date()
            )
            lastResult = result
            return result
        }

        currentProgress = ReprocessingProgress(
            total: documentsToProcess.count,
            processed: 0,
            currentDocument: documentsToProcess.first?.fileName
        )

        var linkedDocs: [ReprocessingResult.LinkedDocument] = []
        var reviewDocs: [ReprocessingResult.ReviewNeededDocument] = []
        var errors: [String] = []

        // Get clients for matching
        let clients = try await APIClient.shared.getClients()
        let clientNameMap = Dictionary(uniqueKeysWithValues: clients.map { ($0.id, $0.name) })

        // Process each document
        for (index, document) in documentsToProcess.enumerated() {
            currentProgress = ReprocessingProgress(
                total: documentsToProcess.count,
                processed: index,
                currentDocument: document.fileName
            )

            do {
                let result = try await reprocessSingleDocument(document, clients: clients, clientNameMap: clientNameMap)

                switch result {
                case .linked(let linked):
                    linkedDocs.append(linked)
                case .needsReview(let review):
                    reviewDocs.append(review)
                case .failed(let error):
                    errors.append("[\(document.fileName)] \(error)")
                }
            } catch {
                errors.append("[\(document.fileName)] \(error.localizedDescription)")
            }
        }

        let result = ReprocessingResult(
            totalDocuments: documentsToProcess.count,
            successfullyLinked: linkedDocs.count,
            needsManualReview: reviewDocs.count,
            failed: errors.count,
            linkedDocuments: linkedDocs,
            reviewNeeded: reviewDocs,
            errors: errors,
            timestamp: Date()
        )

        lastResult = result
        currentProgress = nil

        return result
    }

    // MARK: - Reprocess Single Document

    enum SingleDocumentResult {
        case linked(ReprocessingResult.LinkedDocument)
        case needsReview(ReprocessingResult.ReviewNeededDocument)
        case failed(String)
    }

    private func reprocessSingleDocument(
        _ document: Document,
        clients: [Client],
        clientNameMap: [String: String]
    ) async throws -> SingleDocumentResult {
        // First, try to use the backend's smart-process endpoint
        do {
            let processed = try await APIClient.shared.reprocessDocument(documentId: document.id)

            // Check if it was successfully linked
            if !processed.clientId.isEmpty {
                let clientName = clientNameMap[processed.clientId] ?? processed.clientName ?? "Unknown"

                return .linked(ReprocessingResult.LinkedDocument(
                    documentId: document.id,
                    fileName: document.fileName,
                    clientName: clientName,
                    sessionDate: nil, // Would need to parse from response
                    confidence: 0.8 // Default if not provided
                ))
            }
        } catch {
            // Backend endpoint might not exist, fall back to client-side processing
            print("Backend smart-process failed, using client-side AI: \(error.localizedDescription)")
        }

        // Fall back to client-side AI processing
        guard let content = document.extractedText, !content.isEmpty else {
            return .failed("No text content available for analysis")
        }

        // Analyze with AI
        let analysis = try await AIDocumentProcessor.shared.analyzeDocument(
            content: content,
            fileName: document.fileName
        )

        // Try to match client
        var matchedClient: Client?
        var matchConfidence: Double = 0

        if let primaryClientName = analysis.primaryClientName {
            // Exact match
            if let client = clients.first(where: { $0.name.lowercased() == primaryClientName.lowercased() }) {
                matchedClient = client
                matchConfidence = 0.95
            }
            // Partial match (first or last name)
            else if let client = clients.first(where: {
                $0.name.lowercased().contains(primaryClientName.lowercased()) ||
                primaryClientName.lowercased().contains($0.name.lowercased())
            }) {
                matchedClient = client
                matchConfidence = 0.7
            }
        }

        // Try client mentions if no primary match
        if matchedClient == nil {
            for mention in analysis.clientMentions {
                if let client = clients.first(where: { $0.name.lowercased() == mention.lowercased() }) {
                    matchedClient = client
                    matchConfidence = 0.75
                    break
                }
            }
        }

        // Parse extracted date
        var sessionDate: Date?
        if let firstDate = analysis.extractedDates.first {
            sessionDate = parseExtractedDate(firstDate)
        }

        // Determine result based on confidence
        let combinedConfidence = (matchConfidence + analysis.confidenceScore) / 2

        if let client = matchedClient, combinedConfidence >= 0.7 {
            // High enough confidence - link it
            do {
                _ = try await APIClient.shared.linkDocument(
                    documentId: document.id,
                    clientId: client.id,
                    sessionDate: sessionDate
                )

                return .linked(ReprocessingResult.LinkedDocument(
                    documentId: document.id,
                    fileName: document.fileName,
                    clientName: client.name,
                    sessionDate: sessionDate,
                    confidence: combinedConfidence
                ))
            } catch {
                return .failed("Failed to link document: \(error.localizedDescription)")
            }
        } else {
            // Needs manual review
            return .needsReview(ReprocessingResult.ReviewNeededDocument(
                documentId: document.id,
                fileName: document.fileName,
                suggestedClientName: matchedClient?.name ?? analysis.primaryClientName,
                suggestedDate: sessionDate,
                confidence: combinedConfidence,
                reason: matchedClient == nil ? "No confident client match" : "Low confidence match"
            ))
        }
    }

    // MARK: - Batch Reprocess Specific Documents

    /// Reprocess specific documents by ID
    func reprocessDocuments(documentIds: [String]) async throws -> ReprocessingResult {
        isProcessing = true
        defer { isProcessing = false }

        let allDocuments = try await APIClient.shared.getDocuments()
        let documentsToProcess = allDocuments.filter { documentIds.contains($0.id) }

        guard !documentsToProcess.isEmpty else {
            return ReprocessingResult(
                totalDocuments: 0,
                successfullyLinked: 0,
                needsManualReview: 0,
                failed: documentIds.count,
                linkedDocuments: [],
                reviewNeeded: [],
                errors: ["No matching documents found for provided IDs"],
                timestamp: Date()
            )
        }

        // Use the same processing logic
        currentProgress = ReprocessingProgress(
            total: documentsToProcess.count,
            processed: 0,
            currentDocument: nil
        )

        var linkedDocs: [ReprocessingResult.LinkedDocument] = []
        var reviewDocs: [ReprocessingResult.ReviewNeededDocument] = []
        var errors: [String] = []

        let clients = try await APIClient.shared.getClients()
        let clientNameMap = Dictionary(uniqueKeysWithValues: clients.map { ($0.id, $0.name) })

        for (index, document) in documentsToProcess.enumerated() {
            currentProgress = ReprocessingProgress(
                total: documentsToProcess.count,
                processed: index,
                currentDocument: document.fileName
            )

            do {
                let result = try await reprocessSingleDocument(document, clients: clients, clientNameMap: clientNameMap)

                switch result {
                case .linked(let linked):
                    linkedDocs.append(linked)
                case .needsReview(let review):
                    reviewDocs.append(review)
                case .failed(let error):
                    errors.append("[\(document.fileName)] \(error)")
                }
            } catch {
                errors.append("[\(document.fileName)] \(error.localizedDescription)")
            }
        }

        let result = ReprocessingResult(
            totalDocuments: documentsToProcess.count,
            successfullyLinked: linkedDocs.count,
            needsManualReview: reviewDocs.count,
            failed: errors.count,
            linkedDocuments: linkedDocs,
            reviewNeeded: reviewDocs,
            errors: errors,
            timestamp: Date()
        )

        lastResult = result
        currentProgress = nil

        return result
    }

    // MARK: - Generate Reprocessing Summary

    /// Generate a human-readable summary of the last reprocessing result
    func generateSummary() -> String {
        guard let result = lastResult else {
            return "No reprocessing has been performed yet."
        }

        let dateFormatter = DateFormatter()
        dateFormatter.dateStyle = .medium
        dateFormatter.timeStyle = .short

        var summary = """
        Document Reprocessing Summary
        Run at: \(dateFormatter.string(from: result.timestamp))

        Total Documents Processed: \(result.totalDocuments)
        Successfully Linked: \(result.successfullyLinked)
        Needs Manual Review: \(result.needsManualReview)
        Failed: \(result.failed)

        """

        if !result.linkedDocuments.isEmpty {
            summary += "\n--- Successfully Linked Documents ---\n"
            for doc in result.linkedDocuments {
                var line = "• \(doc.fileName) → \(doc.clientName)"
                if let date = doc.sessionDate {
                    line += " (\(dateFormatter.string(from: date)))"
                }
                line += " [Confidence: \(Int(doc.confidence * 100))%]"
                summary += line + "\n"
            }
        }

        if !result.reviewNeeded.isEmpty {
            summary += "\n--- Documents Needing Review ---\n"
            for doc in result.reviewNeeded {
                var line = "• \(doc.fileName)"
                if let clientName = doc.suggestedClientName {
                    line += " → Suggested: \(clientName)"
                }
                line += " - \(doc.reason)"
                summary += line + "\n"
            }
        }

        if !result.errors.isEmpty {
            summary += "\n--- Errors ---\n"
            for error in result.errors {
                summary += "• \(error)\n"
            }
        }

        return summary
    }

    // MARK: - Helpers

    private func parseExtractedDate(_ dateString: String) -> Date? {
        let formatters: [DateFormatter] = [
            createFormatter("yyyy-MM-dd"),
            createFormatter("MM/dd/yyyy"),
            createFormatter("MM-dd-yyyy"),
            createFormatter("MMMM d, yyyy"),
            createFormatter("MMM d, yyyy"),
            createFormatter("d MMMM yyyy"),
            createFormatter("yyyy-MM-dd'T'HH:mm:ss")
        ]

        for formatter in formatters {
            if let date = formatter.date(from: dateString) {
                return date
            }
        }

        return nil
    }

    private func createFormatter(_ format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }
}
