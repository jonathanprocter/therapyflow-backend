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

    // Support both camelCase (from Drizzle ORM) and snake_case formats
    enum CodingKeys: String, CodingKey {
        case id
        case clientId, clientIdSnake = "client_id"
        case therapistId, therapistIdSnake = "therapist_id"
        case fileName, fileNameSnake = "file_name"
        case fileType, fileTypeSnake = "file_type"
        case filePath, filePathSnake = "file_path"
        case extractedText, extractedTextSnake = "extracted_text"
        case tags
        case fileSize, fileSizeSnake = "file_size"
        case metadata
        case uploadedAt, uploadedAtSnake = "uploaded_at"
        case status
        case documentType, documentTypeSnake = "document_type"
        case mimeType, mimeTypeSnake = "mime_type"
        case clientName, clientNameSnake = "client_name"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
            ?? container.decodeIfPresent(String.self, forKey: .clientIdSnake) ?? ""
        therapistId = try container.decodeIfPresent(String.self, forKey: .therapistId)
            ?? container.decodeIfPresent(String.self, forKey: .therapistIdSnake) ?? ""
        fileName = try container.decodeIfPresent(String.self, forKey: .fileName)
            ?? container.decodeIfPresent(String.self, forKey: .fileNameSnake) ?? ""
        fileType = try container.decodeIfPresent(String.self, forKey: .fileType)
            ?? container.decodeIfPresent(String.self, forKey: .fileTypeSnake) ?? ""
        filePath = try container.decodeIfPresent(String.self, forKey: .filePath)
            ?? container.decodeIfPresent(String.self, forKey: .filePathSnake) ?? ""
        extractedText = try container.decodeIfPresent(String.self, forKey: .extractedText)
            ?? container.decodeIfPresent(String.self, forKey: .extractedTextSnake)
        tags = try container.decodeIfPresent([String].self, forKey: .tags) ?? []
        fileSize = try container.decodeIfPresent(Int.self, forKey: .fileSize)
            ?? container.decodeIfPresent(Int.self, forKey: .fileSizeSnake)
        metadata = try container.decodeIfPresent(DocumentMetadata.self, forKey: .metadata)
        uploadedAt = try container.decodeIfPresent(Date.self, forKey: .uploadedAt)
            ?? container.decodeIfPresent(Date.self, forKey: .uploadedAtSnake) ?? Date()
        status = try container.decodeIfPresent(DocumentStatus.self, forKey: .status) ?? .pending
        documentType = try container.decodeIfPresent(String.self, forKey: .documentType)
            ?? container.decodeIfPresent(String.self, forKey: .documentTypeSnake)
        mimeType = try container.decodeIfPresent(String.self, forKey: .mimeType)
            ?? container.decodeIfPresent(String.self, forKey: .mimeTypeSnake)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
            ?? container.decodeIfPresent(String.self, forKey: .clientNameSnake)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(clientId, forKey: .clientId)
        try container.encode(therapistId, forKey: .therapistId)
        try container.encode(fileName, forKey: .fileName)
        try container.encode(fileType, forKey: .fileType)
        try container.encode(filePath, forKey: .filePath)
        try container.encodeIfPresent(extractedText, forKey: .extractedText)
        try container.encode(tags, forKey: .tags)
        try container.encodeIfPresent(fileSize, forKey: .fileSize)
        try container.encodeIfPresent(metadata, forKey: .metadata)
        try container.encode(uploadedAt, forKey: .uploadedAt)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(documentType, forKey: .documentType)
        try container.encodeIfPresent(mimeType, forKey: .mimeType)
        try container.encodeIfPresent(clientName, forKey: .clientName)
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

    // Support both camelCase and snake_case
    enum CodingKeys: String, CodingKey {
        case pageCount, pageCountSnake = "page_count"
        case author
        case title
        case creationDate, creationDateSnake = "creation_date"
        case ocrConfidence, ocrConfidenceSnake = "ocr_confidence"
        case processingStatus, processingStatusSnake = "processing_status"
    }

    init(pageCount: Int? = nil,
         author: String? = nil,
         title: String? = nil,
         creationDate: Date? = nil,
         ocrConfidence: Double? = nil,
         processingStatus: String? = nil) {
        self.pageCount = pageCount
        self.author = author
        self.title = title
        self.creationDate = creationDate
        self.ocrConfidence = ocrConfidence
        self.processingStatus = processingStatus
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        pageCount = try container.decodeIfPresent(Int.self, forKey: .pageCount)
            ?? container.decodeIfPresent(Int.self, forKey: .pageCountSnake)
        author = try container.decodeIfPresent(String.self, forKey: .author)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        creationDate = try container.decodeIfPresent(Date.self, forKey: .creationDate)
            ?? container.decodeIfPresent(Date.self, forKey: .creationDateSnake)
        ocrConfidence = try container.decodeIfPresent(Double.self, forKey: .ocrConfidence)
            ?? container.decodeIfPresent(Double.self, forKey: .ocrConfidenceSnake)
        processingStatus = try container.decodeIfPresent(String.self, forKey: .processingStatus)
            ?? container.decodeIfPresent(String.self, forKey: .processingStatusSnake)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(pageCount, forKey: .pageCount)
        try container.encodeIfPresent(author, forKey: .author)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(creationDate, forKey: .creationDate)
        try container.encodeIfPresent(ocrConfidence, forKey: .ocrConfidence)
        try container.encodeIfPresent(processingStatus, forKey: .processingStatus)
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

    // Support both camelCase and snake_case
    enum CodingKeys: String, CodingKey {
        case id
        case therapistId, therapistIdSnake = "therapist_id"
        case name
        case totalFiles, totalFilesSnake = "total_files"
        case processedFiles, processedFilesSnake = "processed_files"
        case successfulFiles, successfulFilesSnake = "successful_files"
        case failedFiles, failedFilesSnake = "failed_files"
        case status
        case uploadedAt, uploadedAtSnake = "uploaded_at"
        case processedAt, processedAtSnake = "processed_at"
        case completedAt, completedAtSnake = "completed_at"
    }

    init(id: String, therapistId: String, name: String, totalFiles: Int, processedFiles: Int,
         successfulFiles: Int, failedFiles: Int, status: BatchStatus, uploadedAt: Date,
         processedAt: Date? = nil, completedAt: Date? = nil) {
        self.id = id
        self.therapistId = therapistId
        self.name = name
        self.totalFiles = totalFiles
        self.processedFiles = processedFiles
        self.successfulFiles = successfulFiles
        self.failedFiles = failedFiles
        self.status = status
        self.uploadedAt = uploadedAt
        self.processedAt = processedAt
        self.completedAt = completedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        therapistId = try container.decodeIfPresent(String.self, forKey: .therapistId)
            ?? container.decodeIfPresent(String.self, forKey: .therapistIdSnake) ?? ""
        name = try container.decode(String.self, forKey: .name)
        totalFiles = try container.decodeIfPresent(Int.self, forKey: .totalFiles)
            ?? container.decodeIfPresent(Int.self, forKey: .totalFilesSnake) ?? 0
        processedFiles = try container.decodeIfPresent(Int.self, forKey: .processedFiles)
            ?? container.decodeIfPresent(Int.self, forKey: .processedFilesSnake) ?? 0
        successfulFiles = try container.decodeIfPresent(Int.self, forKey: .successfulFiles)
            ?? container.decodeIfPresent(Int.self, forKey: .successfulFilesSnake) ?? 0
        failedFiles = try container.decodeIfPresent(Int.self, forKey: .failedFiles)
            ?? container.decodeIfPresent(Int.self, forKey: .failedFilesSnake) ?? 0
        status = try container.decode(BatchStatus.self, forKey: .status)
        uploadedAt = try container.decodeIfPresent(Date.self, forKey: .uploadedAt)
            ?? container.decodeIfPresent(Date.self, forKey: .uploadedAtSnake) ?? Date()
        processedAt = try container.decodeIfPresent(Date.self, forKey: .processedAt)
            ?? container.decodeIfPresent(Date.self, forKey: .processedAtSnake)
        completedAt = try container.decodeIfPresent(Date.self, forKey: .completedAt)
            ?? container.decodeIfPresent(Date.self, forKey: .completedAtSnake)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(therapistId, forKey: .therapistId)
        try container.encode(name, forKey: .name)
        try container.encode(totalFiles, forKey: .totalFiles)
        try container.encode(processedFiles, forKey: .processedFiles)
        try container.encode(successfulFiles, forKey: .successfulFiles)
        try container.encode(failedFiles, forKey: .failedFiles)
        try container.encode(status, forKey: .status)
        try container.encode(uploadedAt, forKey: .uploadedAt)
        try container.encodeIfPresent(processedAt, forKey: .processedAt)
        try container.encodeIfPresent(completedAt, forKey: .completedAt)
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

    // Support both camelCase and snake_case
    enum CodingKeys: String, CodingKey {
        case id
        case batchId, batchIdSnake = "batch_id"
        case therapistId, therapistIdSnake = "therapist_id"
        case fileName, fileNameSnake = "file_name"
        case fileSize, fileSizeSnake = "file_size"
        case filePath, filePathSnake = "file_path"
        case extractedText, extractedTextSnake = "extracted_text"
        case status
        case processingStatus, processingStatusSnake = "processing_status"
        case clientMatchConfidence, clientMatchConfidenceSnake = "client_match_confidence"
        case suggestedClientId, suggestedClientIdSnake = "suggested_client_id"
        case suggestedClientName, suggestedClientNameSnake = "suggested_client_name"
        case extractedSessionDate, extractedSessionDateSnake = "extracted_session_date"
        case sessionDateConfidence, sessionDateConfidenceSnake = "session_date_confidence"
        case sessionType, sessionTypeSnake = "session_type"
        case themes
        case riskLevel, riskLevelSnake = "risk_level"
        case progressRating, progressRatingSnake = "progress_rating"
        case requiresManualReview, requiresManualReviewSnake = "requires_manual_review"
        case manualReviewReason, manualReviewReasonSnake = "manual_review_reason"
        case assignedClientId, assignedClientIdSnake = "assigned_client_id"
        case assignedSessionDate, assignedSessionDateSnake = "assigned_session_date"
        case createdProgressNoteId, createdProgressNoteIdSnake = "created_progress_note_id"
        case uploadedAt, uploadedAtSnake = "uploaded_at"
        case processedAt, processedAtSnake = "processed_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        batchId = try container.decodeIfPresent(String.self, forKey: .batchId)
            ?? container.decodeIfPresent(String.self, forKey: .batchIdSnake) ?? ""
        therapistId = try container.decodeIfPresent(String.self, forKey: .therapistId)
            ?? container.decodeIfPresent(String.self, forKey: .therapistIdSnake) ?? ""
        fileName = try container.decodeIfPresent(String.self, forKey: .fileName)
            ?? container.decodeIfPresent(String.self, forKey: .fileNameSnake) ?? ""
        fileSize = try container.decodeIfPresent(Int.self, forKey: .fileSize)
            ?? container.decodeIfPresent(Int.self, forKey: .fileSizeSnake)
        filePath = try container.decodeIfPresent(String.self, forKey: .filePath)
            ?? container.decodeIfPresent(String.self, forKey: .filePathSnake) ?? ""
        extractedText = try container.decodeIfPresent(String.self, forKey: .extractedText)
            ?? container.decodeIfPresent(String.self, forKey: .extractedTextSnake)
        status = try container.decode(TranscriptStatus.self, forKey: .status)
        processingStatus = try container.decodeIfPresent(TranscriptProcessingStatus.self, forKey: .processingStatus)
            ?? container.decodeIfPresent(TranscriptProcessingStatus.self, forKey: .processingStatusSnake) ?? .pending
        clientMatchConfidence = try container.decodeIfPresent(Double.self, forKey: .clientMatchConfidence)
            ?? container.decodeIfPresent(Double.self, forKey: .clientMatchConfidenceSnake)
        suggestedClientId = try container.decodeIfPresent(String.self, forKey: .suggestedClientId)
            ?? container.decodeIfPresent(String.self, forKey: .suggestedClientIdSnake)
        suggestedClientName = try container.decodeIfPresent(String.self, forKey: .suggestedClientName)
            ?? container.decodeIfPresent(String.self, forKey: .suggestedClientNameSnake)
        extractedSessionDate = try container.decodeIfPresent(Date.self, forKey: .extractedSessionDate)
            ?? container.decodeIfPresent(Date.self, forKey: .extractedSessionDateSnake)
        sessionDateConfidence = try container.decodeIfPresent(Double.self, forKey: .sessionDateConfidence)
            ?? container.decodeIfPresent(Double.self, forKey: .sessionDateConfidenceSnake)
        sessionType = try container.decodeIfPresent(SessionType.self, forKey: .sessionType)
            ?? container.decodeIfPresent(SessionType.self, forKey: .sessionTypeSnake)
        themes = try container.decodeIfPresent([String].self, forKey: .themes) ?? []
        let level1 = try container.decodeIfPresent(RiskLevel.self, forKey: .riskLevel)
        let level2 = try container.decodeIfPresent(RiskLevel.self, forKey: .riskLevelSnake)
        riskLevel = level1 ?? level2 ?? .unknown
        progressRating = try container.decodeIfPresent(Int.self, forKey: .progressRating)
            ?? container.decodeIfPresent(Int.self, forKey: .progressRatingSnake)
        let review1 = try container.decodeIfPresent(Bool.self, forKey: .requiresManualReview)
        let review2 = try container.decodeIfPresent(Bool.self, forKey: .requiresManualReviewSnake)
        requiresManualReview = review1 ?? review2 ?? false
        manualReviewReason = try container.decodeIfPresent(String.self, forKey: .manualReviewReason)
            ?? container.decodeIfPresent(String.self, forKey: .manualReviewReasonSnake)
        assignedClientId = try container.decodeIfPresent(String.self, forKey: .assignedClientId)
            ?? container.decodeIfPresent(String.self, forKey: .assignedClientIdSnake)
        assignedSessionDate = try container.decodeIfPresent(Date.self, forKey: .assignedSessionDate)
            ?? container.decodeIfPresent(Date.self, forKey: .assignedSessionDateSnake)
        createdProgressNoteId = try container.decodeIfPresent(String.self, forKey: .createdProgressNoteId)
            ?? container.decodeIfPresent(String.self, forKey: .createdProgressNoteIdSnake)
        let uploaded1 = try container.decodeIfPresent(Date.self, forKey: .uploadedAt)
        let uploaded2 = try container.decodeIfPresent(Date.self, forKey: .uploadedAtSnake)
        uploadedAt = uploaded1 ?? uploaded2 ?? Date()
        processedAt = try container.decodeIfPresent(Date.self, forKey: .processedAt)
            ?? container.decodeIfPresent(Date.self, forKey: .processedAtSnake)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(batchId, forKey: .batchId)
        try container.encode(therapistId, forKey: .therapistId)
        try container.encode(fileName, forKey: .fileName)
        try container.encodeIfPresent(fileSize, forKey: .fileSize)
        try container.encode(filePath, forKey: .filePath)
        try container.encodeIfPresent(extractedText, forKey: .extractedText)
        try container.encode(status, forKey: .status)
        try container.encode(processingStatus, forKey: .processingStatus)
        try container.encodeIfPresent(clientMatchConfidence, forKey: .clientMatchConfidence)
        try container.encodeIfPresent(suggestedClientId, forKey: .suggestedClientId)
        try container.encodeIfPresent(suggestedClientName, forKey: .suggestedClientName)
        try container.encodeIfPresent(extractedSessionDate, forKey: .extractedSessionDate)
        try container.encodeIfPresent(sessionDateConfidence, forKey: .sessionDateConfidence)
        try container.encodeIfPresent(sessionType, forKey: .sessionType)
        try container.encode(themes, forKey: .themes)
        try container.encode(riskLevel, forKey: .riskLevel)
        try container.encodeIfPresent(progressRating, forKey: .progressRating)
        try container.encode(requiresManualReview, forKey: .requiresManualReview)
        try container.encodeIfPresent(manualReviewReason, forKey: .manualReviewReason)
        try container.encodeIfPresent(assignedClientId, forKey: .assignedClientId)
        try container.encodeIfPresent(assignedSessionDate, forKey: .assignedSessionDate)
        try container.encodeIfPresent(createdProgressNoteId, forKey: .createdProgressNoteId)
        try container.encode(uploadedAt, forKey: .uploadedAt)
        try container.encodeIfPresent(processedAt, forKey: .processedAt)
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
