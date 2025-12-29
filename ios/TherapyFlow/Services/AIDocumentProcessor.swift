import Foundation

/// AI-powered document processing service for analyzing, tagging, and extracting insights from clinical documents
actor AIDocumentProcessor {
    static let shared = AIDocumentProcessor()

    // MARK: - Document Analysis

    struct DocumentAnalysis: Codable {
        let summary: String
        let themes: [String]
        let clientMentions: [String]
        let keyInsights: [String]
        let suggestedTags: [String]
        let documentType: DocumentType
        let confidenceScore: Double
        let extractedDates: [String]
        let actionItems: [String]
        let emotionalTone: EmotionalTone
        let clinicalIndicators: [ClinicalIndicator]
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

        enum Severity: String, Codable {
            case low, moderate, high, critical
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
        """
        You are a clinical document analyzer for a mental health practice management system. Analyze the following document and provide a structured analysis.

        \(fileName != nil ? "File name: \(fileName!)\n" : "")
        Document content:
        ---
        \(content.prefix(15000))
        ---

        Provide a JSON response with the following structure:
        {
            "summary": "Brief 2-3 sentence summary of the document",
            "themes": ["array of main themes discussed"],
            "clientMentions": ["names of clients mentioned if any"],
            "keyInsights": ["important clinical observations or insights"],
            "suggestedTags": ["suggested tags for organizing this document"],
            "documentType": "one of: session_transcript, progress_note, treatment_plan, intake_form, assessment, correspondence, insurance, consent, other",
            "confidenceScore": 0.95,
            "extractedDates": ["any dates mentioned in YYYY-MM-DD format"],
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

        Important:
        - Maintain strict HIPAA compliance in your analysis
        - Focus on clinically relevant information
        - Flag any safety concerns with high severity
        - Be conservative with severity ratings
        - If no clinical indicators are found, return an empty array

        Return ONLY the JSON object, no additional text.
        """
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
