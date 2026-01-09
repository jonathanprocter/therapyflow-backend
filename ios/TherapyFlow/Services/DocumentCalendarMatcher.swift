import Foundation

/// Service for matching uploaded documents to calendar events and clients
/// Bridges the gap between AI document analysis and calendar-synced sessions
actor DocumentCalendarMatcher {
    static let shared = DocumentCalendarMatcher()

    private init() {}

    // MARK: - Match Result

    struct MatchResult {
        let documentId: String
        let fileName: String
        let analysis: AIDocumentProcessor.DocumentAnalysis
        let matchedClient: MatchedClient?
        let matchedCalendarEvent: MatchedCalendarEvent?
        let confidence: MatchConfidence
        let requiresManualReview: Bool
        let reviewReason: String?

        var bestSessionDate: Date? {
            // Prefer calendar event date, fall back to extracted date
            if let eventDate = matchedCalendarEvent?.event.startTime {
                return eventDate
            }
            // Parse first extracted date from AI analysis using global function
            return analysis.extractedDates.first.flatMap { TherapyFlow.parseFlexibleDate($0) }
        }
    }

    struct MatchedClient {
        let client: Client
        let matchType: ClientMatchType
        let confidence: Double
    }

    enum ClientMatchType {
        case exactName
        case partialName
        case calendarAttendee
        case inferred
    }

    struct MatchedCalendarEvent {
        let event: SyncedCalendarEvent
        let matchType: CalendarMatchType
        let dateProximityDays: Int
    }

    enum CalendarMatchType {
        case exactDate
        case sameDay
        case proximateDate  // Within 1-2 days
        case clientNameInTitle
    }

    enum MatchConfidence {
        case high      // >80% - auto-assign recommended
        case medium    // 50-80% - suggest but confirm
        case low       // <50% - manual review required

        var numericValue: Double {
            switch self {
            case .high: return 0.9
            case .medium: return 0.65
            case .low: return 0.3
            }
        }
    }

    // MARK: - Main Matching Function

    /// Match a document with AI analysis to available calendar events and clients
    func matchDocument(
        documentId: String,
        fileName: String,
        analysis: AIDocumentProcessor.DocumentAnalysis,
        calendarEvents: [SyncedCalendarEvent],
        clients: [Client]
    ) -> MatchResult {
        // Step 1: Try to match client
        let matchedClient = findMatchingClient(
            analysis: analysis,
            clients: clients,
            calendarEvents: calendarEvents
        )

        // Step 2: Try to match calendar event
        let matchedEvent = findMatchingCalendarEvent(
            analysis: analysis,
            calendarEvents: calendarEvents,
            matchedClient: matchedClient
        )

        // Step 3: Calculate overall confidence
        let confidence = calculateConfidence(
            clientMatch: matchedClient,
            eventMatch: matchedEvent,
            analysis: analysis
        )

        // Step 4: Determine if manual review is needed
        let (requiresReview, reviewReason) = determineReviewRequirement(
            clientMatch: matchedClient,
            eventMatch: matchedEvent,
            confidence: confidence,
            analysis: analysis
        )

        return MatchResult(
            documentId: documentId,
            fileName: fileName,
            analysis: analysis,
            matchedClient: matchedClient,
            matchedCalendarEvent: matchedEvent,
            confidence: confidence,
            requiresManualReview: requiresReview,
            reviewReason: reviewReason
        )
    }

    /// Batch match multiple documents
    func matchDocuments(
        documents: [(id: String, fileName: String, content: String)],
        calendarEvents: [SyncedCalendarEvent],
        clients: [Client]
    ) async throws -> [MatchResult] {
        var results: [MatchResult] = []

        for doc in documents {
            do {
                // Run AI analysis
                let analysis = try await AIDocumentProcessor.shared.analyzeDocument(
                    content: doc.content,
                    fileName: doc.fileName
                )

                // Match to calendar/clients
                let result = matchDocument(
                    documentId: doc.id,
                    fileName: doc.fileName,
                    analysis: analysis,
                    calendarEvents: calendarEvents,
                    clients: clients
                )

                results.append(result)
            } catch {
                print("Failed to analyze document \(doc.fileName): \(error)")
                // Create a failed result with empty analysis
                let emptyAnalysis = AIDocumentProcessor.DocumentAnalysis(
                    summary: "Analysis failed: \(error.localizedDescription)",
                    themes: [],
                    clientMentions: [],
                    primaryClientName: nil,
                    keyInsights: [],
                    suggestedTags: [],
                    documentType: .other,
                    confidenceScore: 0,
                    extractedDates: [],
                    actionItems: [],
                    emotionalTone: .neutral,
                    clinicalIndicators: []
                )

                results.append(MatchResult(
                    documentId: doc.id,
                    fileName: doc.fileName,
                    analysis: emptyAnalysis,
                    matchedClient: nil,
                    matchedCalendarEvent: nil,
                    confidence: .low,
                    requiresManualReview: true,
                    reviewReason: "AI analysis failed: \(error.localizedDescription)"
                ))
            }
        }

        return results
    }

    // MARK: - Client Matching

    private func findMatchingClient(
        analysis: AIDocumentProcessor.DocumentAnalysis,
        clients: [Client],
        calendarEvents: [SyncedCalendarEvent]
    ) -> MatchedClient? {
        // Priority 1: Match primaryClientName exactly
        if let primaryName = analysis.primaryClientName {
            if let exactMatch = clients.first(where: {
                $0.name.lowercased() == primaryName.lowercased()
            }) {
                return MatchedClient(client: exactMatch, matchType: .exactName, confidence: 0.95)
            }

            // Try partial match (first name or last name)
            if let partialMatch = findPartialNameMatch(primaryName, in: clients) {
                return MatchedClient(client: partialMatch.client, matchType: .partialName, confidence: partialMatch.score)
            }
        }

        // Priority 2: Check clientMentions
        for mention in analysis.clientMentions {
            if let exactMatch = clients.first(where: {
                $0.name.lowercased() == mention.lowercased()
            }) {
                return MatchedClient(client: exactMatch, matchType: .exactName, confidence: 0.85)
            }

            if let partialMatch = findPartialNameMatch(mention, in: clients) {
                return MatchedClient(client: partialMatch.client, matchType: .partialName, confidence: partialMatch.score * 0.9)
            }
        }

        // Priority 3: Check calendar event titles for client names
        for event in calendarEvents {
            for client in clients {
                if event.title.lowercased().contains(client.name.lowercased()) {
                    // Check if any extracted date matches this event
                    for dateString in analysis.extractedDates {
                        if let date = parseFlexibleDate(dateString),
                           Calendar.current.isDate(date, inSameDayAs: event.startTime) {
                            return MatchedClient(client: client, matchType: .calendarAttendee, confidence: 0.80)
                        }
                    }
                }
            }
        }

        return nil
    }

    private func findPartialNameMatch(_ name: String, in clients: [Client]) -> (client: Client, score: Double)? {
        let nameParts = name.lowercased().split(separator: " ").map(String.init)

        var bestMatch: (client: Client, score: Double)?

        for client in clients {
            let clientParts = client.name.lowercased().split(separator: " ").map(String.init)

            // Check for first name match
            if let firstName = nameParts.first,
               let clientFirstName = clientParts.first,
               firstName == clientFirstName {
                let score = nameParts.count == 1 ? 0.7 : 0.6
                if bestMatch == nil || score > bestMatch!.score {
                    bestMatch = (client, score)
                }
            }

            // Check for last name match
            if let lastName = nameParts.last,
               let clientLastName = clientParts.last,
               lastName == clientLastName,
               nameParts.count > 1 && clientParts.count > 1 {
                let score = 0.75
                if bestMatch == nil || score > bestMatch!.score {
                    bestMatch = (client, score)
                }
            }

            // Check for contains match
            if client.name.lowercased().contains(name.lowercased()) ||
               name.lowercased().contains(client.name.lowercased()) {
                let score = 0.65
                if bestMatch == nil || score > bestMatch!.score {
                    bestMatch = (client, score)
                }
            }
        }

        return bestMatch
    }

    // MARK: - Calendar Event Matching

    private func findMatchingCalendarEvent(
        analysis: AIDocumentProcessor.DocumentAnalysis,
        calendarEvents: [SyncedCalendarEvent],
        matchedClient: MatchedClient?
    ) -> MatchedCalendarEvent? {
        let extractedDates = analysis.extractedDates.compactMap { parseFlexibleDate($0) }

        // Priority 1: Exact date match
        for date in extractedDates {
            for event in calendarEvents {
                if Calendar.current.isDate(date, inSameDayAs: event.startTime) {
                    // If we also have a client match, check if client is in event
                    if let client = matchedClient?.client {
                        if event.title.lowercased().contains(client.name.lowercased()) ||
                           event.linkedClientId == client.id {
                            return MatchedCalendarEvent(event: event, matchType: .exactDate, dateProximityDays: 0)
                        }
                    }
                    return MatchedCalendarEvent(event: event, matchType: .sameDay, dateProximityDays: 0)
                }
            }
        }

        // Priority 2: Proximate date match (within 2 days)
        for date in extractedDates {
            for event in calendarEvents {
                let daysDifference = abs(Calendar.current.dateComponents([.day], from: date, to: event.startTime).day ?? 999)
                if daysDifference <= 2 {
                    // Prefer events with matching client
                    if let client = matchedClient?.client,
                       (event.title.lowercased().contains(client.name.lowercased()) ||
                        event.linkedClientId == client.id) {
                        return MatchedCalendarEvent(event: event, matchType: .proximateDate, dateProximityDays: daysDifference)
                    }
                }
            }
        }

        // Priority 3: Match by client name in calendar title (no date extracted)
        if let client = matchedClient?.client {
            // Find most recent past event for this client
            let clientEvents = calendarEvents.filter { event in
                event.title.lowercased().contains(client.name.lowercased()) ||
                event.linkedClientId == client.id
            }.sorted { $0.startTime > $1.startTime }

            if let mostRecent = clientEvents.first(where: { $0.startTime <= Date() }) {
                let daysDifference = abs(Calendar.current.dateComponents([.day], from: mostRecent.startTime, to: Date()).day ?? 999)
                if daysDifference <= 7 {
                    return MatchedCalendarEvent(event: mostRecent, matchType: .clientNameInTitle, dateProximityDays: daysDifference)
                }
            }
        }

        return nil
    }

    // MARK: - Confidence Calculation

    private func calculateConfidence(
        clientMatch: MatchedClient?,
        eventMatch: MatchedCalendarEvent?,
        analysis: AIDocumentProcessor.DocumentAnalysis
    ) -> MatchConfidence {
        var score: Double = 0

        // Client match contribution (up to 40%)
        if let client = clientMatch {
            score += client.confidence * 0.4
        }

        // Calendar event match contribution (up to 40%)
        if let event = eventMatch {
            switch event.matchType {
            case .exactDate:
                score += 0.4
            case .sameDay:
                score += 0.35
            case .proximateDate:
                score += 0.25 - (Double(event.dateProximityDays) * 0.05)
            case .clientNameInTitle:
                score += 0.2
            }
        }

        // AI analysis confidence contribution (up to 20%)
        score += analysis.confidenceScore * 0.2

        // Determine confidence level
        if score >= 0.7 {
            return .high
        } else if score >= 0.4 {
            return .medium
        } else {
            return .low
        }
    }

    private func determineReviewRequirement(
        clientMatch: MatchedClient?,
        eventMatch: MatchedCalendarEvent?,
        confidence: MatchConfidence,
        analysis: AIDocumentProcessor.DocumentAnalysis
    ) -> (requiresReview: Bool, reason: String?) {
        // Always review low confidence matches
        if confidence == .low {
            return (true, "Low confidence match - please verify client and date")
        }

        // Review if no client match
        if clientMatch == nil {
            return (true, "Could not identify client from document")
        }

        // Review if no calendar event match
        if eventMatch == nil {
            return (true, "Could not match to a calendar session - date may need manual entry")
        }

        // Review if client match is inferred or partial
        if let client = clientMatch, client.matchType == .inferred || client.matchType == .partialName {
            return (true, "Client match is uncertain - please confirm '\(client.client.name)' is correct")
        }

        // Review if date match is proximate (not exact)
        if let event = eventMatch, event.dateProximityDays > 0 {
            return (true, "Session date is approximate (\(event.dateProximityDays) days difference)")
        }

        // Review if high-risk clinical indicators found
        let hasHighRisk = analysis.clinicalIndicators.contains {
            $0.severity == .high || $0.severity == .critical
        }
        if hasHighRisk {
            return (true, "High-risk clinical indicators detected - review before finalizing")
        }

        // High confidence, good matches, no issues
        return (false, nil)
    }

    // MARK: - Date Parsing

    /// Parse dates in various formats that might appear in transcripts
    private func parseFlexibleDate(_ dateString: String) -> Date? {
        // Already in YYYY-MM-DD format
        let isoFormatter = DateFormatter()
        isoFormatter.dateFormat = "yyyy-MM-dd"
        if let date = isoFormatter.date(from: dateString) {
            return date
        }

        // Try ISO8601 full format
        let iso8601Formatter = ISO8601DateFormatter()
        if let date = iso8601Formatter.date(from: dateString) {
            return date
        }

        // Common US formats
        let formats = [
            "MMMM d, yyyy",       // January 5, 2026
            "MMMM dd, yyyy",      // January 05, 2026
            "MMM d, yyyy",        // Jan 5, 2026
            "MMM dd, yyyy",       // Jan 05, 2026
            "M/d/yyyy",           // 1/5/2026
            "MM/dd/yyyy",         // 01/05/2026
            "M-d-yyyy",           // 1-5-2026
            "MM-dd-yyyy",         // 01-05-2026
            "d MMMM yyyy",        // 5 January 2026
            "dd MMMM yyyy",       // 05 January 2026
            "yyyy/MM/dd",         // 2026/01/05
            "EEEE, MMMM d, yyyy", // Monday, January 5, 2026
            "EEEE, MMM d, yyyy",  // Mon, Jan 5, 2026
        ]

        for format in formats {
            let formatter = DateFormatter()
            formatter.dateFormat = format
            formatter.locale = Locale(identifier: "en_US")
            if let date = formatter.date(from: dateString) {
                return date
            }
        }

        // Try natural language parsing
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue)
        if let match = detector?.firstMatch(in: dateString, options: [], range: NSRange(dateString.startIndex..., in: dateString)),
           let date = match.date {
            return date
        }

        return nil
    }
}

// Make parseFlexibleDate available globally
func parseFlexibleDate(_ dateString: String) -> Date? {
    // Already in YYYY-MM-DD format
    let isoFormatter = DateFormatter()
    isoFormatter.dateFormat = "yyyy-MM-dd"
    if let date = isoFormatter.date(from: dateString) {
        return date
    }

    // Try ISO8601 full format
    let iso8601Formatter = ISO8601DateFormatter()
    if let date = iso8601Formatter.date(from: dateString) {
        return date
    }

    // Common US formats
    let formats = [
        "MMMM d, yyyy",
        "MMMM dd, yyyy",
        "MMM d, yyyy",
        "MMM dd, yyyy",
        "M/d/yyyy",
        "MM/dd/yyyy",
        "M-d-yyyy",
        "MM-dd-yyyy",
        "d MMMM yyyy",
        "dd MMMM yyyy",
        "yyyy/MM/dd",
        "EEEE, MMMM d, yyyy",
        "EEEE, MMM d, yyyy",
    ]

    for format in formats {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        formatter.locale = Locale(identifier: "en_US")
        if let date = formatter.date(from: dateString) {
            return date
        }
    }

    // Try natural language parsing
    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue)
    if let match = detector?.firstMatch(in: dateString, options: [], range: NSRange(dateString.startIndex..., in: dateString)),
       let date = match.date {
        return date
    }

    return nil
}
