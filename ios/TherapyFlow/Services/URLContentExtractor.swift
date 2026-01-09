import Foundation

/// URLContentExtractor - Extracts and parses content from URLs
///
/// Supports:
/// - ChatGPT transcript URLs (shared conversations)
/// - Otter.ai transcripts
/// - Google Docs
/// - Plain text/HTML pages
/// - PDF content extraction (basic)
@MainActor
class URLContentExtractor: ObservableObject {
    static let shared = URLContentExtractor()

    @Published var isExtracting = false
    @Published var lastError: String?

    private init() {}

    // MARK: - Types

    enum ContentSource {
        case chatGPT
        case otter
        case googleDocs
        case genericHTML
        case pdf
        case unknown

        static func detect(from url: URL) -> ContentSource {
            let host = url.host?.lowercased() ?? ""
            let path = url.path.lowercased()

            if host.contains("chat.openai.com") || host.contains("chatgpt.com") {
                return .chatGPT
            } else if host.contains("otter.ai") {
                return .otter
            } else if host.contains("docs.google.com") {
                return .googleDocs
            } else if path.hasSuffix(".pdf") {
                return .pdf
            } else {
                return .genericHTML
            }
        }
    }

    struct ExtractedContent {
        let source: ContentSource
        let title: String?
        let content: String
        let messages: [ConversationMessage]?
        let extractedDate: Date?
        let metadata: [String: String]

        struct ConversationMessage {
            let role: String // "user", "assistant", "therapist", "client"
            let content: String
            let timestamp: Date?
        }
    }

    struct ParsedSessionData {
        let clientName: String?
        let sessionDate: Date?
        let transcript: String
        let speakerLabels: [SpeakerLabel]
        let suggestedTags: [String]

        struct SpeakerLabel {
            let speaker: String
            let content: String
            let timestamp: String?
        }
    }

    // MARK: - Public Methods

    /// Extract content from a URL
    func extractContent(from urlString: String) async throws -> ExtractedContent {
        guard let url = URL(string: urlString) else {
            throw ExtractionError.invalidURL
        }

        isExtracting = true
        defer { isExtracting = false }

        let source = ContentSource.detect(from: url)

        switch source {
        case .chatGPT:
            return try await extractChatGPTContent(from: url)
        case .otter:
            return try await extractOtterContent(from: url)
        case .googleDocs:
            return try await extractGoogleDocsContent(from: url)
        case .pdf:
            return try await extractPDFContent(from: url)
        case .genericHTML, .unknown:
            return try await extractGenericHTMLContent(from: url)
        }
    }

    /// Extract and parse as a therapy session
    func extractAsSession(from urlString: String, clientName: String? = nil, sessionDate: Date? = nil) async throws -> ParsedSessionData {
        let content = try await extractContent(from: urlString)

        // Parse the content into session format
        return parseAsSession(content: content, clientName: clientName, sessionDate: sessionDate)
    }

    // MARK: - ChatGPT Extraction

    private func extractChatGPTContent(from url: URL) async throws -> ExtractedContent {
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw ExtractionError.fetchFailed
        }

        guard let html = String(data: data, encoding: .utf8) else {
            throw ExtractionError.decodingFailed
        }

        // Parse HTML using regex patterns (no external dependencies)
        let title = extractHTMLTitle(from: html)
        var messages: [ExtractedContent.ConversationMessage] = []

        // Try to find ChatGPT conversation structure
        // Pattern: data-message-author-role="user/assistant" followed by content
        let rolePattern = #"data-message-author-role="(user|assistant)"[^>]*>([^<]+)"#
        if let regex = try? NSRegularExpression(pattern: rolePattern, options: [.dotMatchesLineSeparators]) {
            let range = NSRange(html.startIndex..., in: html)
            let matches = regex.matches(in: html, options: [], range: range)

            for match in matches {
                if match.numberOfRanges >= 3 {
                    let role = String(html[Range(match.range(at: 1), in: html)!])
                    let content = String(html[Range(match.range(at: 2), in: html)!])
                        .trimmingCharacters(in: .whitespacesAndNewlines)

                    if !content.isEmpty {
                        messages.append(ExtractedContent.ConversationMessage(
                            role: role,
                            content: cleanHTMLContent(content),
                            timestamp: nil
                        ))
                    }
                }
            }
        }

        // If no structured messages found, extract all visible text
        let fullText = messages.isEmpty ? extractTextContent(from: html) : messages.map { "\($0.role): \($0.content)" }.joined(separator: "\n\n")

        return ExtractedContent(
            source: .chatGPT,
            title: title,
            content: fullText,
            messages: messages.isEmpty ? nil : messages,
            extractedDate: Date(),
            metadata: ["url": url.absoluteString]
        )
    }

    // MARK: - Otter.ai Extraction

    private func extractOtterContent(from url: URL) async throws -> ExtractedContent {
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw ExtractionError.fetchFailed
        }

        guard let html = String(data: data, encoding: .utf8) else {
            throw ExtractionError.decodingFailed
        }

        let title = extractHTMLTitle(from: html)
        var messages: [ExtractedContent.ConversationMessage] = []

        // Otter transcripts often have speaker-labeled segments
        // Try to find patterns like "Speaker Name:" or timestamp patterns
        // Reserved for future HTML-based parsing:
        // let speakerPattern = #"(?:data-speaker[^>]*>|class="speaker[^>]*>)([^<]+)<"#
        // let textPattern = #"(?:class="(?:segment-text|transcript-text)[^>]*>)([^<]+)<"#

        // Look for timestamp-based speaker patterns
        let timestampSpeakerPattern = #"\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*([A-Za-z\s]+):\s*([^\n]+)"#

        if let regex = try? NSRegularExpression(pattern: timestampSpeakerPattern, options: [.anchorsMatchLines]) {
            let range = NSRange(html.startIndex..., in: html)
            let matches = regex.matches(in: html, options: [], range: range)

            for match in matches {
                if match.numberOfRanges >= 4 {
                    let timestamp = String(html[Range(match.range(at: 1), in: html)!])
                    let speaker = String(html[Range(match.range(at: 2), in: html)!])
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    let content = String(html[Range(match.range(at: 3), in: html)!])
                        .trimmingCharacters(in: .whitespacesAndNewlines)

                    if !content.isEmpty {
                        messages.append(ExtractedContent.ConversationMessage(
                            role: speaker,
                            content: cleanHTMLContent(content),
                            timestamp: parseTimestamp(timestamp)
                        ))
                    }
                }
            }
        }

        let fullText = messages.isEmpty ? extractTextContent(from: html) : messages.map { "\($0.role): \($0.content)" }.joined(separator: "\n\n")

        return ExtractedContent(
            source: .otter,
            title: title,
            content: fullText,
            messages: messages.isEmpty ? nil : messages,
            extractedDate: Date(),
            metadata: ["url": url.absoluteString]
        )
    }

    // MARK: - Google Docs Extraction

    private func extractGoogleDocsContent(from url: URL) async throws -> ExtractedContent {
        // Convert to export URL for plain text
        var exportURL = url
        if url.path.contains("/edit") {
            let docId = extractGoogleDocId(from: url)
            if let docId = docId {
                exportURL = URL(string: "https://docs.google.com/document/d/\(docId)/export?format=txt")!
            }
        }

        let (data, response) = try await URLSession.shared.data(from: exportURL)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            // Fall back to HTML extraction if export fails
            return try await extractGenericHTMLContent(from: url)
        }

        guard let text = String(data: data, encoding: .utf8) else {
            throw ExtractionError.decodingFailed
        }

        return ExtractedContent(
            source: .googleDocs,
            title: nil,
            content: text,
            messages: nil,
            extractedDate: Date(),
            metadata: ["url": url.absoluteString]
        )
    }

    private func extractGoogleDocId(from url: URL) -> String? {
        // URL format: https://docs.google.com/document/d/DOC_ID/...
        let path = url.path
        if let range = path.range(of: "/d/") {
            let startIndex = range.upperBound
            let remaining = String(path[startIndex...])
            if let endIndex = remaining.firstIndex(of: "/") {
                return String(remaining[..<endIndex])
            }
            return remaining
        }
        return nil
    }

    // MARK: - PDF Extraction

    private func extractPDFContent(from url: URL) async throws -> ExtractedContent {
        let (data, _) = try await URLSession.shared.data(from: url)

        // Basic PDF text extraction using PDFKit would require UIKit import
        // For now, return metadata indicating PDF was found
        return ExtractedContent(
            source: .pdf,
            title: url.lastPathComponent,
            content: "[PDF content - manual extraction required]",
            messages: nil,
            extractedDate: Date(),
            metadata: [
                "url": url.absoluteString,
                "fileSize": "\(data.count) bytes",
                "note": "PDF extraction requires manual review"
            ]
        )
    }

    // MARK: - Generic HTML Extraction

    private func extractGenericHTMLContent(from url: URL) async throws -> ExtractedContent {
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw ExtractionError.fetchFailed
        }

        guard let html = String(data: data, encoding: .utf8) else {
            throw ExtractionError.decodingFailed
        }

        let title = extractHTMLTitle(from: html)
        let text = extractTextContent(from: html)

        return ExtractedContent(
            source: .genericHTML,
            title: title,
            content: text,
            messages: nil,
            extractedDate: Date(),
            metadata: ["url": url.absoluteString]
        )
    }

    // MARK: - HTML Parsing Helpers

    private func extractHTMLTitle(from html: String) -> String? {
        let titlePattern = #"<title[^>]*>([^<]+)</title>"#
        if let regex = try? NSRegularExpression(pattern: titlePattern, options: .caseInsensitive) {
            let range = NSRange(html.startIndex..., in: html)
            if let match = regex.firstMatch(in: html, options: [], range: range),
               match.numberOfRanges > 1 {
                return String(html[Range(match.range(at: 1), in: html)!])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return nil
    }

    private func extractTextContent(from html: String) -> String {
        var text = html

        // Remove script and style content
        let removePatterns = [
            #"<script[^>]*>[\s\S]*?</script>"#,
            #"<style[^>]*>[\s\S]*?</style>"#,
            #"<nav[^>]*>[\s\S]*?</nav>"#,
            #"<header[^>]*>[\s\S]*?</header>"#,
            #"<footer[^>]*>[\s\S]*?</footer>"#,
            #"<!--[\s\S]*?-->"#
        ]

        for pattern in removePatterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) {
                text = regex.stringByReplacingMatches(
                    in: text,
                    options: [],
                    range: NSRange(text.startIndex..., in: text),
                    withTemplate: ""
                )
            }
        }

        // Remove all HTML tags
        let tagPattern = #"<[^>]+>"#
        if let regex = try? NSRegularExpression(pattern: tagPattern, options: []) {
            text = regex.stringByReplacingMatches(
                in: text,
                options: [],
                range: NSRange(text.startIndex..., in: text),
                withTemplate: " "
            )
        }

        // Decode HTML entities
        text = cleanHTMLContent(text)

        // Clean up whitespace
        text = text.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")

        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func cleanHTMLContent(_ text: String) -> String {
        var cleaned = text

        // Common HTML entities
        let entities: [String: String] = [
            "&nbsp;": " ",
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": "\"",
            "&#39;": "'",
            "&apos;": "'",
            "&ndash;": "-",
            "&mdash;": "-",
            "&ldquo;": "\"",
            "&rdquo;": "\"",
            "&lsquo;": "'",
            "&rsquo;": "'",
            "&hellip;": "...",
            "&#x27;": "'",
            "&#x2F;": "/"
        ]

        for (entity, replacement) in entities {
            cleaned = cleaned.replacingOccurrences(of: entity, with: replacement)
        }

        // Numeric entities (&#123; format)
        let numericPattern = #"&#(\d+);"#
        if let regex = try? NSRegularExpression(pattern: numericPattern, options: []) {
            let range = NSRange(cleaned.startIndex..., in: cleaned)
            let matches = regex.matches(in: cleaned, options: [], range: range).reversed()

            for match in matches {
                if match.numberOfRanges > 1,
                   let codeRange = Range(match.range(at: 1), in: cleaned),
                   let code = Int(cleaned[codeRange]),
                   let scalar = Unicode.Scalar(code) {
                    let fullRange = Range(match.range, in: cleaned)!
                    cleaned.replaceSubrange(fullRange, with: String(Character(scalar)))
                }
            }
        }

        return cleaned
    }

    // MARK: - Session Parsing

    private func parseAsSession(content: ExtractedContent, clientName: String?, sessionDate: Date?) -> ParsedSessionData {
        var speakerLabels: [ParsedSessionData.SpeakerLabel] = []
        var suggestedTags: [String] = []

        // Try to identify speakers and parse content
        if let messages = content.messages {
            for message in messages {
                speakerLabels.append(ParsedSessionData.SpeakerLabel(
                    speaker: normalizeSpeaker(message.role),
                    content: message.content,
                    timestamp: message.timestamp.map { formatTimestamp($0) }
                ))
            }
        } else {
            // Parse raw text for speaker labels
            speakerLabels = parseTextForSpeakers(content.content)
        }

        // Extract potential session date from content
        let extractedDate = sessionDate ?? extractDateFromContent(content.content)

        // Extract potential client name from content
        let extractedClientName = clientName ?? extractClientNameFromContent(content.content)

        // Generate suggested tags based on content
        suggestedTags = generateSuggestedTags(from: content.content)

        // Build full transcript
        let transcript = speakerLabels.map { label in
            let timestamp = label.timestamp.map { "[\($0)] " } ?? ""
            return "\(timestamp)\(label.speaker): \(label.content)"
        }.joined(separator: "\n\n")

        return ParsedSessionData(
            clientName: extractedClientName,
            sessionDate: extractedDate,
            transcript: transcript.isEmpty ? content.content : transcript,
            speakerLabels: speakerLabels,
            suggestedTags: suggestedTags
        )
    }

    private func normalizeSpeaker(_ role: String) -> String {
        let lowercased = role.lowercased()

        // Map common roles to standard labels
        if lowercased.contains("therapist") || lowercased == "assistant" || lowercased.contains("counselor") {
            return "Therapist"
        } else if lowercased.contains("client") || lowercased == "user" || lowercased.contains("patient") {
            return "Client"
        }

        return role.capitalized
    }

    private func parseTextForSpeakers(_ text: String) -> [ParsedSessionData.SpeakerLabel] {
        var labels: [ParsedSessionData.SpeakerLabel] = []

        // Common patterns for speaker labels
        let patterns = [
            #"(?:^|\n)([A-Za-z]+):\s*(.+?)(?=\n[A-Za-z]+:|$)"#,  // "Speaker: text"
            #"\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([A-Za-z]+):\s*(.+?)(?=\[|$)"#,  // "[00:00] Speaker: text"
        ]

        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]) {
                let range = NSRange(text.startIndex..., in: text)
                let matches = regex.matches(in: text, options: [], range: range)

                for match in matches {
                    if match.numberOfRanges >= 3 {
                        let speaker = String(text[Range(match.range(at: 1), in: text)!])
                        let content = String(text[Range(match.range(at: 2), in: text)!])

                        labels.append(ParsedSessionData.SpeakerLabel(
                            speaker: normalizeSpeaker(speaker),
                            content: content.trimmingCharacters(in: .whitespacesAndNewlines),
                            timestamp: nil
                        ))
                    }
                }

                if !labels.isEmpty { break }
            }
        }

        return labels
    }

    private func extractDateFromContent(_ content: String) -> Date? {
        // Common date patterns
        let patterns = [
            #"(\d{1,2})/(\d{1,2})/(\d{2,4})"#,           // MM/DD/YYYY
            #"(\d{4})-(\d{2})-(\d{2})"#,                 // YYYY-MM-DD
            #"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})"#  // Month DD, YYYY
        ]

        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                let range = NSRange(content.startIndex..., in: content)
                if let match = regex.firstMatch(in: content, options: [], range: range) {
                    let dateString = String(content[Range(match.range, in: content)!])
                    let formatters = [
                        "MM/dd/yyyy", "M/d/yyyy", "MM/dd/yy", "M/d/yy",
                        "yyyy-MM-dd",
                        "MMMM d, yyyy", "MMMM d yyyy"
                    ]
                    for format in formatters {
                        let formatter = DateFormatter()
                        formatter.dateFormat = format
                        if let date = formatter.date(from: dateString) {
                            return date
                        }
                    }
                }
            }
        }

        return nil
    }

    private func extractClientNameFromContent(_ content: String) -> String? {
        // Look for common patterns indicating client name
        let patterns = [
            #"(?:client|patient):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)"#,
            #"session\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)"#,
            #"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:session|therapy)"#
        ]

        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                let range = NSRange(content.startIndex..., in: content)
                if let match = regex.firstMatch(in: content, options: [], range: range),
                   match.numberOfRanges > 1 {
                    return String(content[Range(match.range(at: 1), in: content)!])
                }
            }
        }

        return nil
    }

    private func generateSuggestedTags(from content: String) -> [String] {
        var tags: [String] = []
        let lowercased = content.lowercased()

        // Clinical themes
        let themeKeywords: [String: [String]] = [
            "anxiety": ["anxiety", "anxious", "worry", "panic", "nervous"],
            "depression": ["depression", "depressed", "sad", "hopeless", "worthless"],
            "trauma": ["trauma", "ptsd", "flashback", "nightmare", "abuse"],
            "relationship": ["relationship", "partner", "marriage", "divorce", "family"],
            "grief": ["grief", "loss", "death", "mourning", "bereavement"],
            "anger": ["anger", "angry", "rage", "frustration", "irritable"],
            "self-esteem": ["self-esteem", "confidence", "self-worth", "self-image"],
            "substance-use": ["alcohol", "drugs", "substance", "addiction", "recovery"],
            "sleep": ["sleep", "insomnia", "nightmares", "tired", "fatigue"],
            "work-stress": ["work", "job", "career", "boss", "workplace"]
        ]

        for (tag, keywords) in themeKeywords {
            if keywords.contains(where: { lowercased.contains($0) }) {
                tags.append(tag)
            }
        }

        // Risk indicators
        let riskKeywords = ["suicide", "self-harm", "hurt myself", "end my life", "kill myself"]
        if riskKeywords.contains(where: { lowercased.contains($0) }) {
            tags.append("risk-flag")
        }

        return tags
    }

    private func parseTimestamp(_ timestamp: String?) -> Date? {
        guard let timestamp = timestamp else { return nil }

        let formats = ["HH:mm:ss", "H:mm:ss", "mm:ss", "m:ss"]
        for format in formats {
            let formatter = DateFormatter()
            formatter.dateFormat = format
            if let date = formatter.date(from: timestamp) {
                return date
            }
        }
        return nil
    }

    private func formatTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "mm:ss"
        return formatter.string(from: date)
    }
}

// MARK: - Errors

enum ExtractionError: LocalizedError {
    case invalidURL
    case fetchFailed
    case decodingFailed
    case parsingFailed(String)
    case unsupportedFormat

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL format"
        case .fetchFailed:
            return "Failed to fetch content from URL"
        case .decodingFailed:
            return "Failed to decode content"
        case .parsingFailed(let message):
            return "Failed to parse content: \(message)"
        case .unsupportedFormat:
            return "Unsupported content format"
        }
    }
}
