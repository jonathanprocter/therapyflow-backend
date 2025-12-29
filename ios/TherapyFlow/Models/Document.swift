import Foundation

// MARK: - Document Status
enum DocumentStatus: String, Codable, CaseIterable {
    case pending
    case processing
    case processed
    case failed

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .processing: return "Processing"
        case .processed: return "Processed"
        case .failed: return "Failed"
        }
    }
}

// MARK: - Document Model
struct Document: Identifiable, Codable, Equatable {
    let id: String
    let clientId: String
    let therapistId: String
    var fileName: String
    var fileType: String
    var filePath: String
    var extractedText: String?
    var tags: [String]
    var fileSize: Int?
    var metadata: DocumentMetadata?
    let uploadedAt: Date
    var status: DocumentStatus
    var documentType: String?
    var mimeType: String?
    var clientName: String?

    // Computed properties for view compatibility
    var filename: String { fileName }

    // Local-only properties
    var localFilePath: String?
    var isDownloaded: Bool {
        localFilePath != nil
    }

    // Computed properties
    var fileExtension: String {
        (fileName as NSString).pathExtension.lowercased()
    }

    var formattedFileSize: String {
        guard let size = fileSize else { return "Unknown" }
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(size))
    }

    var icon: String {
        switch fileExtension {
        case "pdf": return "doc.fill"
        case "doc", "docx": return "doc.text.fill"
        case "txt": return "doc.plaintext"
        case "jpg", "jpeg", "png", "heic": return "photo"
        default: return "doc"
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case clientId = "client_id"
        case therapistId = "therapist_id"
        case fileName = "file_name"
        case fileType = "file_type"
        case filePath = "file_path"
        case extractedText = "extracted_text"
        case tags
        case fileSize = "file_size"
        case metadata
        case uploadedAt = "uploaded_at"
        case status
        case documentType = "document_type"
        case mimeType = "mime_type"
        case clientName = "client_name"
    }

    init(id: String = UUID().uuidString,
         clientId: String,
         therapistId: String,
         fileName: String,
         fileType: String,
         filePath: String,
         extractedText: String? = nil,
         tags: [String] = [],
         fileSize: Int? = nil,
         metadata: DocumentMetadata? = nil,
         uploadedAt: Date = Date(),
         status: DocumentStatus = .pending,
         documentType: String? = nil,
         mimeType: String? = nil,
         clientName: String? = nil,
         localFilePath: String? = nil) {
        self.id = id
        self.clientId = clientId
        self.therapistId = therapistId
        self.fileName = fileName
        self.fileType = fileType
        self.filePath = filePath
        self.extractedText = extractedText
        self.tags = tags
        self.fileSize = fileSize
        self.metadata = metadata
        self.uploadedAt = uploadedAt
        self.status = status
        self.documentType = documentType
        self.mimeType = mimeType
        self.clientName = clientName
        self.localFilePath = localFilePath
    }
}

// MARK: - Document Metadata
struct DocumentMetadata: Codable, Equatable {
    var pageCount: Int?
    var author: String?
    var title: String?
    var creationDate: Date?
    var ocrConfidence: Double?
    var processingStatus: String?

    enum CodingKeys: String, CodingKey {
        case pageCount = "page_count"
        case author
        case title
        case creationDate = "creation_date"
        case ocrConfidence = "ocr_confidence"
        case processingStatus = "processing_status"
    }
}

// MARK: - Transcript Batch
struct TranscriptBatch: Identifiable, Codable, Equatable {
    let id: String
    let therapistId: String
    var name: String
    var totalFiles: Int
    var processedFiles: Int
    var successfulFiles: Int
    var failedFiles: Int
    var status: BatchStatus
    let uploadedAt: Date
    var processedAt: Date?
    var completedAt: Date?

    // Computed properties
    var progress: Double {
        guard totalFiles > 0 else { return 0 }
        return Double(processedFiles) / Double(totalFiles)
    }

    var isComplete: Bool {
        status == .completed || status == .failed
    }

    enum CodingKeys: String, CodingKey {
        case id
        case therapistId = "therapist_id"
        case name
        case totalFiles = "total_files"
        case processedFiles = "processed_files"
        case successfulFiles = "successful_files"
        case failedFiles = "failed_files"
        case status
        case uploadedAt = "uploaded_at"
        case processedAt = "processed_at"
        case completedAt = "completed_at"
    }
}

// MARK: - Batch Status
enum BatchStatus: String, Codable, CaseIterable {
    case uploading
    case processing
    case completed
    case failed

    var displayName: String {
        switch self {
        case .uploading: return "Uploading"
        case .processing: return "Processing"
        case .completed: return "Completed"
        case .failed: return "Failed"
        }
    }

    var color: String {
        switch self {
        case .uploading: return "blue"
        case .processing: return "orange"
        case .completed: return "green"
        case .failed: return "red"
        }
    }
}

// MARK: - Transcript File
struct TranscriptFile: Identifiable, Codable, Equatable {
    let id: String
    let batchId: String
    let therapistId: String
    var fileName: String
    var fileSize: Int?
    var filePath: String
    var extractedText: String?
    var status: TranscriptStatus
    var processingStatus: TranscriptProcessingStatus
    var clientMatchConfidence: Double?
    var suggestedClientId: String?
    var suggestedClientName: String?
    var extractedSessionDate: Date?
    var sessionDateConfidence: Double?
    var sessionType: SessionType?
    var themes: [String]
    var riskLevel: RiskLevel
    var progressRating: Int?
    var requiresManualReview: Bool
    var manualReviewReason: String?
    var assignedClientId: String?
    var assignedSessionDate: Date?
    var createdProgressNoteId: String?
    let uploadedAt: Date
    var processedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case batchId = "batch_id"
        case therapistId = "therapist_id"
        case fileName = "file_name"
        case fileSize = "file_size"
        case filePath = "file_path"
        case extractedText = "extracted_text"
        case status
        case processingStatus = "processing_status"
        case clientMatchConfidence = "client_match_confidence"
        case suggestedClientId = "suggested_client_id"
        case suggestedClientName = "suggested_client_name"
        case extractedSessionDate = "extracted_session_date"
        case sessionDateConfidence = "session_date_confidence"
        case sessionType = "session_type"
        case themes
        case riskLevel = "risk_level"
        case progressRating = "progress_rating"
        case requiresManualReview = "requires_manual_review"
        case manualReviewReason = "manual_review_reason"
        case assignedClientId = "assigned_client_id"
        case assignedSessionDate = "assigned_session_date"
        case createdProgressNoteId = "created_progress_note_id"
        case uploadedAt = "uploaded_at"
        case processedAt = "processed_at"
    }
}

// MARK: - Transcript Status
enum TranscriptStatus: String, Codable, CaseIterable {
    case uploaded
    case processing
    case processed
    case failed
    case assigned

    var displayName: String {
        switch self {
        case .uploaded: return "Uploaded"
        case .processing: return "Processing"
        case .processed: return "Processed"
        case .failed: return "Failed"
        case .assigned: return "Assigned"
        }
    }
}

// MARK: - Transcript Processing Status
enum TranscriptProcessingStatus: String, Codable, CaseIterable {
    case pending
    case extractingText = "extracting_text"
    case analyzing
    case matchingClient = "matching_client"
    case creatingNote = "creating_note"
    case completed
    case failed

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .extractingText: return "Extracting Text"
        case .analyzing: return "Analyzing"
        case .matchingClient: return "Matching Client"
        case .creatingNote: return "Creating Note"
        case .completed: return "Completed"
        case .failed: return "Failed"
        }
    }
}
