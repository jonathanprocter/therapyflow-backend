import Foundation

/// AI-powered document processing service for analyzing, tagging, and extracting insights from clinical documents
actor AIDocumentProcessor {
    static let shared = AIDocumentProcessor()

    // MARK: - Document Analysis

    struct DocumentAnalysis: Codable {
        let summary: String
        let themes: [String]
        let clientMentions: [String]
        let primaryClientName: String?  // The main client this document is about
        let keyInsights: [String]
        let suggestedTags: [String]
        let documentType: DocumentType
        let confidenceScore: Double
        let extractedDates: [String]
        let actionItems: [String]
        let emotionalTone: EmotionalTone
        let clinicalIndicators: [ClinicalIndicator]

        /// Returns the best client name: primaryClientName if available, otherwise first clientMention
        var bestClientName: String? {
            if let primary = primaryClientName, !primary.isEmpty {
                return primary
            }
            return clientMentions.first
        }
    }

    enum DocumentType: String, Codable {
        case sessionTranscript = "session_transcript"
        case progressNote = "progress_note"
        case treatmentPlan = "treatment_plan"
        case intakeForm = "intake_form"
        case assessment = "assessment"
        case correspondence = "correspondence"
        case insurance = "insurance"
        case consent = "consent"
        case other = "other"
    }

    enum EmotionalTone: String, Codable {
        case positive
        case negative
        case neutral
        case mixed
        case anxious
        case depressed
        case hopeful
        case distressed
    }

    struct ClinicalIndicator: Codable {
        let indicator: String
        let severity: Severity
        let context: String

        enum Severity: String, Codable, Comparable {
            case low, moderate, high, critical

            static func < (lhs: Severity, rhs: Severity) -> Bool {
                let order: [Severity] = [.low, .moderate, .high, .critical]
                guard let lhsIndex = order.firstIndex(of: lhs),
                      let rhsIndex = order.firstIndex(of: rhs) else {
                    return false
                }
                return lhsIndex < rhsIndex
            }
        }
    }

    // MARK: - Analyze Document

    func analyzeDocument(content: String, fileName: String? = nil) async throws -> DocumentAnalysis {
        let provider = await IntegrationsService.shared.selectedAIProvider
        let apiKey = await IntegrationsService.shared.getAPIKey(for: provider)

        guard !apiKey.isEmpty else {
            throw AIProcessingError.noAPIKeyConfigured
        }

        let prompt = buildAnalysisPrompt(content: content, fileName: fileName)

        switch provider {
        case .anthropic:
            return try await analyzeWithAnthropic(prompt: prompt, apiKey: apiKey)
        case .openAI:
            return try await analyzeWithOpenAI(prompt: prompt, apiKey: apiKey)
        }
    }

    private func buildAnalysisPrompt(content: String, fileName: String?) -> String {
        // Extract date hint from filename if possible (e.g., "Session_2026-01-05.txt" or "John_Doe_01-05-2026.txt")
        let fileNameDateHint = fileName.flatMap { extractDateFromFileName($0) }

        return """
        You are a clinical document analyzer for a mental health practice management system. Analyze the following document and provide a structured analysis.

        \(fileName != nil ? "File name: \(fileName!)\n" : "")\(fileNameDateHint != nil ? "Detected date from filename: \(fileNameDateHint!)\n" : "")
        Document content:
        ---
        \(content.prefix(15000))
        ---

        Provide a JSON response with the following structure:
        {
            "summary": "Brief 2-3 sentence summary of the document",
            "themes": ["array of main themes discussed"],
            "clientMentions": ["names of clients mentioned - look for: patient names, client names, names at the top of forms, names in headers like 'Client: John Doe', pronouns that refer to named individuals. ALWAYS extract full names when available."],
            "primaryClientName": "The main client's full name this document is about, or null if not identifiable. Look for patterns like 'Session with [Name]', 'Client: [Name]', 'Patient Name: [Name]', or names mentioned repeatedly.",
            "keyInsights": ["important clinical observations or insights"],
            "suggestedTags": ["suggested tags for organizing this document"],
            "documentType": "one of: session_transcript, progress_note, treatment_plan, intake_form, assessment, correspondence, insurance, consent, other",
            "confidenceScore": 0.95,
            "extractedDates": ["session/appointment dates in YYYY-MM-DD format"],
            "actionItems": ["any follow-up items or action items mentioned"],
            "emotionalTone": "one of: positive, negative, neutral, mixed, anxious, depressed, hopeful, distressed",
            "clinicalIndicators": [
                {
                    "indicator": "description of clinical indicator",
                    "severity": "one of: low, moderate, high, critical",
                    "context": "relevant context from the document"
                }
            ]
        }

        CRITICAL DATE EXTRACTION INSTRUCTIONS:
        - Look for session/appointment dates in ANY format: "January 5, 2026", "1/5/26", "01-05-2026", "2026-01-05", "Monday, Jan 5th", etc.
        - Check the document header, title, first few lines, and any "Date:" or "Session Date:" labels
        - Check the filename for dates (common formats: YYYY-MM-DD, MM-DD-YYYY, MonthName_Day)
        - If multiple dates are found, include all but put the most likely SESSION DATE first
        - Convert ALL dates to YYYY-MM-DD format in the output
        - If you see "Session on January 5, 2026", extract "2026-01-05"
        - If you see "01/05/26", interpret as January 5, 2026 and extract "2026-01-05"
        - If the document appears to be a transcript from Otter.ai, look for the recording date at the top

        CRITICAL CLIENT NAME EXTRACTION:
        - Extract the client/patient name if present anywhere in the document
        - Check headers, salutations, "Re:" lines, "Client:" labels, form fields, and narrative text
        - Look for patterns like "Session with [Name]", "Client: [Name]", "Patient Name: [Name]"
        - For transcripts, the client is usually the person NOT identified as the therapist/counselor
        - The primaryClientName field should contain the full name of the main person this document is about

        Important:
        - Maintain strict HIPAA compliance in your analysis
        - Focus on clinically relevant information
        - Flag any safety concerns with high severity
        - Be conservative with severity ratings
        - If no clinical indicators are found, return an empty array

        Return ONLY the JSON object, no additional text.
        """
    }

    /// Extract date from filename using common patterns
    private func extractDateFromFileName(_ fileName: String) -> String? {
        // Remove file extension
        let name = (fileName as NSString).deletingPathExtension

        // Pattern 1: YYYY-MM-DD
        let isoPattern = #"(\d{4})-(\d{2})-(\d{2})"#
        if let match = name.range(of: isoPattern, options: .regularExpression) {
            return String(name[match])
        }

        // Pattern 2: MM-DD-YYYY or MM_DD_YYYY
        let usPattern = #"(\d{1,2})[-_](\d{1,2})[-_](\d{4})"#
        if let match = name.range(of: usPattern, options: .regularExpression) {
            let dateStr = String(name[match])
            let parts = dateStr.components(separatedBy: CharacterSet(charactersIn: "-_"))
            if parts.count == 3, let month = Int(parts[0]), let day = Int(parts[1]), let year = Int(parts[2]) {
                return String(format: "%04d-%02d-%02d", year, month, day)
            }
        }

        // Pattern 3: MonthName_Day_Year or MonthName-Day-Year (e.g., January_5_2026)
        let monthNames = ["january", "february", "march", "april", "may", "june",
                          "july", "august", "september", "october", "november", "december"]
        let shortMonths = ["jan", "feb", "mar", "apr", "may", "jun",
                           "jul", "aug", "sep", "oct", "nov", "dec"]

        let lowercaseName = name.lowercased()
        for (index, monthName) in monthNames.enumerated() {
            if lowercaseName.contains(monthName) {
                let monthPattern = "\(monthName)[-_ ]?(\\d{1,2})[-_ ]?(\\d{4})"
                if let regex = try? NSRegularExpression(pattern: monthPattern, options: .caseInsensitive),
                   let match = regex.firstMatch(in: lowercaseName, options: [], range: NSRange(lowercaseName.startIndex..., in: lowercaseName)) {
                    if let dayRange = Range(match.range(at: 1), in: lowercaseName),
                       let yearRange = Range(match.range(at: 2), in: lowercaseName),
                       let day = Int(lowercaseName[dayRange]),
                       let year = Int(lowercaseName[yearRange]) {
                        return String(format: "%04d-%02d-%02d", year, index + 1, day)
                    }
                }
            }
        }

        for (index, shortMonth) in shortMonths.enumerated() {
            if lowercaseName.contains(shortMonth) && !lowercaseName.contains(monthNames[index]) {
                let monthPattern = "\(shortMonth)[-_ ]?(\\d{1,2})[-_ ]?(\\d{4})"
                if let regex = try? NSRegularExpression(pattern: monthPattern, options: .caseInsensitive),
                   let match = regex.firstMatch(in: lowercaseName, options: [], range: NSRange(lowercaseName.startIndex..., in: lowercaseName)) {
                    if let dayRange = Range(match.range(at: 1), in: lowercaseName),
                       let yearRange = Range(match.range(at: 2), in: lowercaseName),
                       let day = Int(lowercaseName[dayRange]),
                       let year = Int(lowercaseName[yearRange]) {
                        return String(format: "%04d-%02d-%02d", year, index + 1, day)
                    }
                }
            }
        }

        return nil
    }

    // MARK: - Anthropic Integration

    private func analyzeWithAnthropic(prompt: String, apiKey: String) async throws -> DocumentAnalysis {
        let url = URL(string: "https://api.anthropic.com/v1/messages")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let body: [String: Any] = [
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 4096,
            "messages": [
                ["role": "user", "content": prompt]
            ]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw AIProcessingError.apiError("Anthropic API error")
        }

        // Parse Anthropic response
        let anthropicResponse = try JSONDecoder().decode(AnthropicResponse.self, from: data)

        guard let textContent = anthropicResponse.content.first?.text else {
            throw AIProcessingError.invalidResponse
        }

        return try parseAnalysisResponse(textContent)
    }

    // MARK: - OpenAI Integration

    private func analyzeWithOpenAI(prompt: String, apiKey: String) async throws -> DocumentAnalysis {
        let url = URL(string: "https://api.openai.com/v1/chat/completions")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "model": "gpt-4-turbo-preview",
            "messages": [
                ["role": "system", "content": "You are a clinical document analyzer. Respond only with valid JSON."],
                ["role": "user", "content": prompt]
            ],
            "temperature": 0.3,
            "max_tokens": 4096,
            "response_format": ["type": "json_object"]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw AIProcessingError.apiError("OpenAI API error")
        }

        // Parse OpenAI response
        let openAIResponse = try JSONDecoder().decode(OpenAIResponse.self, from: data)

        guard let content = openAIResponse.choices.first?.message.content else {
            throw AIProcessingError.invalidResponse
        }

        return try parseAnalysisResponse(content)
    }

    private func parseAnalysisResponse(_ jsonString: String) throws -> DocumentAnalysis {
        // Clean up the JSON string (remove markdown code blocks if present)
        let cleanedJson = jsonString
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = cleanedJson.data(using: .utf8) else {
            throw AIProcessingError.invalidResponse
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        return try decoder.decode(DocumentAnalysis.self, from: data)
    }

    // MARK: - Batch Processing

    func analyzeDocuments(_ documents: [Document]) async throws -> [String: DocumentAnalysis] {
        var results: [String: DocumentAnalysis] = [:]

        for document in documents {
            if let content = document.extractedText {
                do {
                    let analysis = try await analyzeDocument(content: content, fileName: document.fileName)
                    results[document.id] = analysis
                } catch {
                    print("Failed to analyze document \(document.id): \(error)")
                }
            }
        }

        return results
    }

    // MARK: - Smart Sorting

    struct SortedDocumentGroup {
        let category: DocumentType
        let documents: [Document]
        let clientGroups: [String: [Document]]
    }

    func sortDocuments(_ documents: [Document], analyses: [String: DocumentAnalysis]) -> [SortedDocumentGroup] {
        var groupsByType: [DocumentType: [Document]] = [:]
        var clientGroupsByType: [DocumentType: [String: [Document]]] = [:]

        for document in documents {
            guard let analysis = analyses[document.id] else { continue }

            let type = analysis.documentType

            // Group by type
            if groupsByType[type] == nil {
                groupsByType[type] = []
            }
            groupsByType[type]?.append(document)

            // Group by client within type
            if clientGroupsByType[type] == nil {
                clientGroupsByType[type] = [:]
            }

            for clientName in analysis.clientMentions {
                if clientGroupsByType[type]?[clientName] == nil {
                    clientGroupsByType[type]?[clientName] = []
                }
                clientGroupsByType[type]?[clientName]?.append(document)
            }
        }

        return groupsByType.map { type, docs in
            SortedDocumentGroup(
                category: type,
                documents: docs.sorted { $0.uploadedAt > $1.uploadedAt },
                clientGroups: clientGroupsByType[type] ?? [:]
            )
        }.sorted { $0.documents.count > $1.documents.count }
    }

    // MARK: - Theme Extraction

    func extractThemes(from analyses: [DocumentAnalysis]) -> [String: Int] {
        var themeCounts: [String: Int] = [:]

        for analysis in analyses {
            for theme in analysis.themes {
                themeCounts[theme, default: 0] += 1
            }
        }

        return themeCounts.sorted { $0.value > $1.value }
            .reduce(into: [:]) { $0[$1.key] = $1.value }
    }

    // MARK: - Clinical Alert Detection

    struct ClinicalAlert {
        let documentId: String
        let indicator: ClinicalIndicator
        let documentTitle: String
    }

    func detectClinicalAlerts(documents: [Document], analyses: [String: DocumentAnalysis]) -> [ClinicalAlert] {
        var alerts: [ClinicalAlert] = []

        for document in documents {
            guard let analysis = analyses[document.id] else { continue }

            for indicator in analysis.clinicalIndicators {
                if indicator.severity == .high || indicator.severity == .critical {
                    alerts.append(ClinicalAlert(
                        documentId: document.id,
                        indicator: indicator,
                        documentTitle: document.fileName
                    ))
                }
            }
        }

        return alerts.sorted {
            ($0.indicator.severity == .critical ? 0 : 1) < ($1.indicator.severity == .critical ? 0 : 1)
        }
    }
}

// MARK: - Response Models

struct AnthropicResponse: Decodable {
    let content: [ContentBlock]

    struct ContentBlock: Decodable {
        let type: String
        let text: String?
    }
}

struct OpenAIResponse: Decodable {
    let choices: [Choice]

    struct Choice: Decodable {
        let message: Message
    }

    struct Message: Decodable {
        let content: String
    }
}

// MARK: - Errors

enum AIProcessingError: LocalizedError {
    case noAPIKeyConfigured
    case apiError(String)
    case invalidResponse
    case processingFailed(String)

    var errorDescription: String? {
        switch self {
        case .noAPIKeyConfigured:
            return "No AI API key configured. Please add your API key in Settings > Integrations."
        case .apiError(let message):
            return "AI API error: \(message)"
        case .invalidResponse:
            return "Invalid response from AI service"
        case .processingFailed(let message):
            return "Document processing failed: \(message)"
        }
    }
}
