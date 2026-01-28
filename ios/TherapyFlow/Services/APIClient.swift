import Foundation

// MARK: - API Client
actor APIClient {
    static let shared = APIClient()

    // Configuration
    private var baseURL: URL
    private var authToken: String?

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    // Rate limiting
    private var lastRequestTime: Date?
    private let minRequestInterval: TimeInterval = 0.1 // 100ms between requests

    // Retry configuration
    private let maxRetries: Int = 3
    private let retryDelayBase: TimeInterval = 1.0 // Base delay for exponential backoff

    // Environment detection
    private static var isDevelopment: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    // MARK: - API Server Configuration
    //
    // IMPORTANT: Update this URL after deploying to Render!
    //
    // Steps:
    // 1. Deploy to Render (see render.yaml in project root)
    // 2. Copy your Render URL (e.g., https://therapyflow-api.onrender.com)
    // 3. Replace the productionURL below
    //
    // Free hosting options:
    // - Render: https://your-app.onrender.com (auto-sleeps after 15 min, wakes on request)
    // - Railway: https://your-app.up.railway.app
    // - Fly.io: https://your-app.fly.dev
    //
    private static let productionURL = "https://therapyflow-backend.onrender.com"  // Production Render backend

    // Base URL configuration
    private static var configuredBaseURL: URL {
        // Check for custom URL in UserDefaults (allows runtime override from Settings)
        if let customURLString = UserDefaults.standard.string(forKey: "api_base_url"),
           let customURL = URL(string: customURLString) {
            return sanitizeBaseURL(customURL)
        }

        // Always use production URL - local development requires manual override via Settings
        // To use local server, go to Settings > Developer > API URL and enter http://localhost:5001
        return sanitizeBaseURL(URL(string: productionURL)!)
    }

    init() {
        self.baseURL = Self.configuredBaseURL

        // Configure URLSession
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        config.waitsForConnectivity = true
        // PERFORMANCE FIX: Use protocol cache policy to respect server Cache-Control headers
        // This reduces network traffic for cacheable resources (client lists, treatment plans)
        config.requestCachePolicy = .useProtocolCachePolicy
        // Configure URL cache (10MB memory, 50MB disk)
        config.urlCache = URLCache(memoryCapacity: 10 * 1024 * 1024, diskCapacity: 50 * 1024 * 1024)

        self.session = URLSession(configuration: config)

        // Configure JSON decoder
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Try multiple date formats
            let formatters: [DateFormatter] = [
                Self.iso8601Formatter,
                Self.iso8601WithFractionalFormatter,
                Self.simpleDateFormatter
            ]

            for formatter in formatters {
                if let date = formatter.date(from: dateString) {
                    return date
                }
            }

            // Try ISO8601DateFormatter as fallback
            if let date = ISO8601DateFormatter().date(from: dateString) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(dateString)"
            )
        }

        // Configure JSON encoder
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }

    private static func sanitizeBaseURL(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: true) else {
            return url
        }

        let trimmedPath = components.path.hasSuffix("/api")
            ? String(components.path.dropLast(4))
            : components.path

        components.path = trimmedPath
        components.query = nil
        components.fragment = nil

        return components.url ?? url
    }

    // Date formatters
    private static let iso8601Formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    private static let iso8601WithFractionalFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    private static let simpleDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    // MARK: - Configuration

    func configure(baseURL: URL, authToken: String?) {
        self.baseURL = baseURL
        self.authToken = authToken
    }

    func setAuthToken(_ token: String?) {
        self.authToken = token
    }

    // MARK: - Request Building

    private func buildRequest(
        endpoint: String,
        method: HTTPMethod,
        queryParameters: [String: String]? = nil,
        body: Data? = nil
    ) throws -> URLRequest {
        let normalizedEndpoint = endpoint.hasPrefix("/") ? String(endpoint.dropFirst()) : endpoint
        guard let resolvedURL = URL(string: normalizedEndpoint, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.invalidURL
        }
        var urlComponents = URLComponents(url: resolvedURL, resolvingAgainstBaseURL: true)!

        // Only set queryItems if we have non-empty parameters to avoid trailing '?'
        if let queryParameters = queryParameters, !queryParameters.isEmpty {
            urlComponents.queryItems = queryParameters.map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        guard let url = urlComponents.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            request.httpBody = body
        }

        return request
    }

    // MARK: - Generic Request Methods

    private func applyRateLimit() async throws {
        if let lastTime = lastRequestTime {
            let elapsed = Date().timeIntervalSince(lastTime)
            if elapsed < minRequestInterval {
                try await Task.sleep(nanoseconds: UInt64((minRequestInterval - elapsed) * 1_000_000_000))
            }
        }
        lastRequestTime = Date()
    }

    /// Execute a request with automatic retry for transient errors
    private func withRetry<T>(
        operation: @escaping () async throws -> T
    ) async throws -> T {
        var lastError: Error?

        for attempt in 0..<maxRetries {
            do {
                return try await operation()
            } catch let error as APIError {
                lastError = error

                // Only retry for specific transient errors
                guard error.isRetryable else {
                    throw error
                }

                // Exponential backoff with jitter
                let delay = retryDelayBase * pow(2.0, Double(attempt))
                let jitter = Double.random(in: 0...0.5)
                let totalDelay = delay + jitter

                print("Request failed (attempt \(attempt + 1)/\(maxRetries)), retrying in \(String(format: "%.1f", totalDelay))s: \(error.localizedDescription)")

                try await Task.sleep(nanoseconds: UInt64(totalDelay * 1_000_000_000))
            } catch {
                // For non-APIError errors (like network errors), wrap and potentially retry
                lastError = error

                if attempt < maxRetries - 1 {
                    let delay = retryDelayBase * pow(2.0, Double(attempt))
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }

        throw lastError ?? APIError.networkError(NSError(domain: "APIClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "Max retries exceeded"]))
    }

    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        queryParameters: [String: String]? = nil,
        body: Encodable? = nil
    ) async throws -> T {
        // Rate limiting
        try await applyRateLimit()

        var bodyData: Data?
        if let body = body {
            bodyData = try encoder.encode(body)
        }

        let request = try buildRequest(
            endpoint: endpoint,
            method: method,
            queryParameters: queryParameters,
            body: bodyData
        )

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            // Check if the response is actually JSON before trying to decode
            if let contentType = httpResponse.value(forHTTPHeaderField: "Content-Type"),
               !contentType.contains("application/json") {
                // Server returned non-JSON response (e.g., HTML error page)
                let responsePreview = String(data: data.prefix(100), encoding: .utf8) ?? "unknown"
                let urlDescription = request.url?.absoluteString ?? "unknown"
                print("Unexpected content type: \(contentType) for \(urlDescription), response: \(responsePreview)")
                throw APIError.unexpectedContentType("\(contentType) (\(urlDescription))")
            }

            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                // Check if it looks like HTML (common error page indicator)
                if let responseString = String(data: data.prefix(50), encoding: .utf8),
                   responseString.trimmingCharacters(in: .whitespaces).hasPrefix("<") {
                    print("Server returned HTML instead of JSON")
                    throw APIError.htmlResponseReceived
                }
                print("Decoding error: \(error)")
                throw APIError.decodingError(error)
            }

        case 401:
            throw APIError.unauthorized

        case 403:
            throw APIError.forbidden

        case 404:
            throw APIError.notFound

        case 429:
            throw APIError.rateLimited

        case 500...599:
            // Try to extract error message from response
            if let errorMessage = String(data: data, encoding: .utf8) {
                print("Server error \(httpResponse.statusCode): \(errorMessage.prefix(200))")
            }
            throw APIError.serverError(httpResponse.statusCode)

        default:
            let errorBody = String(data: data, encoding: .utf8)
            let endpoint = request.url?.absoluteString ?? "unknown"
            print("⚠️ API ERROR: HTTP \(httpResponse.statusCode) for endpoint: \(endpoint)")
            if let errorBody = errorBody, !errorBody.isEmpty {
                print("⚠️ Error body: \(errorBody.prefix(500))")
            }
            throw APIError.httpError(httpResponse.statusCode, errorBody)
        }
    }

    func requestVoid(
        endpoint: String,
        method: HTTPMethod = .get,
        queryParameters: [String: String]? = nil,
        body: Encodable? = nil
    ) async throws {
        try await applyRateLimit()

        var bodyData: Data?
        if let body = body {
            bodyData = try encoder.encode(body)
        }

        let request = try buildRequest(
            endpoint: endpoint,
            method: method,
            queryParameters: queryParameters,
            body: bodyData
        )

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            }
            let errorBody = String(data: data, encoding: .utf8)
            if let errorBody = errorBody, !errorBody.isEmpty {
                print("HTTP \(httpResponse.statusCode) error body: \(errorBody.prefix(500))")
            }
            throw APIError.httpError(httpResponse.statusCode, errorBody)
        }
    }

    // MARK: - Multipart Upload

    func uploadFile(
        endpoint: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        additionalFields: [String: String] = [:]
    ) async throws -> Document {
        try await applyRateLimit()

        let boundary = UUID().uuidString

        var request = try buildRequest(endpoint: endpoint, method: .post)
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()

        // Add file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)

        // Add additional fields
        for (key, value) in additionalFields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.uploadFailed
        }

        return try decoder.decode(Document.self, from: data)
    }
}

// MARK: - HTTP Method
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

// MARK: - API Error
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case decodingError(Error)
    case encodingError(Error)
    case unauthorized
    case forbidden
    case notFound
    case rateLimited
    case serverError(Int)
    case httpError(Int, String?)
    case uploadFailed
    case networkError(Error)
    case noData
    case unexpectedContentType(String)
    case htmlResponseReceived
    case requestCancelled
    case clientIdRequired
    case validationError(String)
    case timeout

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .encodingError(let error):
            return "Failed to encode request: \(error.localizedDescription)"
        case .unauthorized:
            return "Unauthorized. Please log in again."
        case .forbidden:
            return "Access denied"
        case .notFound:
            return "Resource not found"
        case .rateLimited:
            return "Too many requests. Please wait and try again."
        case .serverError(let code):
            return "Server error (\(code))"
        case .httpError(let code, let body):
            // Parse specific error codes from backend
            if let body = body {
                if body.contains("CLIENT_ID_REQUIRED") {
                    return "Client ID is required for this operation"
                }
                if !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    // Try to extract just the error message from JSON
                    if let errorMessage = APIError.parseErrorMessage(from: body) {
                        return errorMessage
                    }
                    return "HTTP error (\(code)): \(body)"
                }
            }
            return "HTTP error (\(code))"
        case .uploadFailed:
            return "File upload failed"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .noData:
            return "No data received"
        case .unexpectedContentType(let contentType):
            return "Unexpected response type: \(contentType)"
        case .htmlResponseReceived:
            return "Server returned an error page. Please try again."
        case .requestCancelled:
            return "Request was cancelled"
        case .clientIdRequired:
            return "Client ID is required for this operation"
        case .validationError(let message):
            return "Validation error: \(message)"
        case .timeout:
            return "Request timed out. Please check your connection and try again."
        }
    }

    /// User-friendly error message for display in UI
    var userFriendlyMessage: String {
        switch self {
        case .unauthorized:
            return "Your session has expired. Please log in again."
        case .networkError, .timeout:
            return "Unable to connect to the server. Please check your internet connection."
        case .rateLimited:
            return "You're making too many requests. Please wait a moment and try again."
        case .serverError:
            return "Something went wrong on our end. Please try again later."
        case .clientIdRequired:
            return "Please select a client before continuing."
        default:
            return errorDescription ?? "An unexpected error occurred."
        }
    }

    /// Whether this error is recoverable by retrying
    var isRetryable: Bool {
        switch self {
        case .networkError, .timeout, .rateLimited, .serverError:
            return true
        default:
            return false
        }
    }

}

extension APIError {
    static func parseErrorMessage(from body: String) -> String? {
        guard let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let error = json["error"] as? String else {
            return nil
        }
        return error
    }
}

// MARK: - API Endpoints Extension
extension APIClient {
    // Authentication
    func login(email: String, password: String) async throws -> LoginResponse {
        try await request(
            endpoint: "/api/auth/login",
            method: .post,
            body: LoginRequest(email: email, password: password)
        )
    }

    func logout() async throws {
        try await requestVoid(endpoint: "/api/auth/logout", method: .post)
    }

    // Dashboard
    func getDashboardStats() async throws -> DashboardStats {
        try await request(endpoint: "/api/dashboard/stats")
    }

    // Clients
    func getClients() async throws -> [Client] {
        try await request(endpoint: "/api/clients")
    }

    func getClient(id: String) async throws -> Client {
        try await request(endpoint: "/api/clients/\(id)")
    }

    func createClient(_ input: CreateClientInput) async throws -> Client {
        try await request(endpoint: "/api/clients", method: .post, body: input)
    }

    func updateClient(id: String, _ input: UpdateClientInput) async throws -> Client {
        try await request(endpoint: "/api/clients/\(id)", method: .put, body: input)
    }

    func deleteClient(id: String) async throws {
        try await requestVoid(endpoint: "/api/clients/\(id)", method: .delete)
    }

    // Sessions
    func getSessions(upcoming: Bool = false, clientId: String? = nil, limit: Int? = nil, includePast: Bool? = nil) async throws -> [Session] {
        var params: [String: String] = [:]
        if upcoming { params["upcoming"] = "true" }
        if let clientId = clientId { params["client_id"] = clientId }
        if let limit = limit { params["limit"] = String(limit) }
        if let includePast = includePast { params["includePast"] = includePast ? "true" : "false" }

        return try await request(endpoint: "/api/sessions", queryParameters: params)
    }

    func getSession(id: String) async throws -> Session {
        try await request(endpoint: "/api/sessions/\(id)")
    }

    func createSession(_ input: CreateSessionInput) async throws -> Session {
        try await request(endpoint: "/api/sessions", method: .post, body: input)
    }

    func updateSession(id: String, _ input: UpdateSessionInput) async throws -> Session {
        try await request(endpoint: "/api/sessions/\(id)", method: .put, body: input)
    }

    // Progress Notes
    func getProgressNotes(clientId: String? = nil, recent: Bool = false, limit: Int? = nil) async throws -> [ProgressNote] {
        var params: [String: String] = [:]
        if let clientId = clientId { params["client_id"] = clientId }
        if recent { params["recent"] = "true" }
        if let limit = limit { params["limit"] = String(limit) }

        return try await request(endpoint: "/api/progress-notes", queryParameters: params)
    }

    func getProgressNote(id: String) async throws -> ProgressNote {
        do {
            return try await request(endpoint: "/api/progress-notes/\(id)")
        } catch let error as APIError {
            switch error {
            case .unexpectedContentType, .htmlResponseReceived:
                let recentNotes = try await getProgressNotes(recent: true, limit: 200)
                if let match = recentNotes.first(where: { $0.id == id }) {
                    return match
                }
            default:
                break
            }
            throw error
        }
    }

    func createProgressNote(_ input: CreateProgressNoteInput) async throws -> ProgressNote {
        try await request(endpoint: "/api/progress-notes", method: .post, body: input)
    }

    func updateProgressNote(id: String, _ input: UpdateProgressNoteInput) async throws -> ProgressNote {
        try await request(endpoint: "/api/progress-notes/\(id)", method: .patch, body: input)
    }

    // Search
    func semanticSearch(query: SearchQuery) async throws -> SearchResponse {
        try await request(endpoint: "/api/semantic/search", queryParameters: query.queryParameters)
    }

    // AI Insights
    func getAIInsights(unreadOnly: Bool = false) async throws -> [AIInsight] {
        var params: [String: String] = [:]
        if unreadOnly { params["unread"] = "true" }
        return try await request(endpoint: "/api/ai/insights", queryParameters: params)
    }

    func markInsightAsRead(id: String) async throws {
        try await requestVoid(endpoint: "/api/ai/insights/\(id)/read", method: .post)
    }

    // Session Prep
    func getSessionPrep(sessionId: String) async throws -> SessionPrep {
        do {
            return try await request(endpoint: "/api/sessions/\(sessionId)/prep-ai/latest")
        } catch APIError.notFound {
            let fallback: SessionPrepFallbackResponse = try await request(endpoint: "/api/sessions/\(sessionId)/prep")
            return buildFallbackPrep(from: fallback)
        }
    }

    /// Generate session prep with optional pending follow-ups
    /// - Parameters:
    ///   - sessionId: The session to generate prep for
    ///   - clientId: Optional client ID to fetch pending reminders
    /// - Returns: Generated SessionPrep
    func generateSessionPrep(sessionId: String, clientId: String? = nil) async throws -> SessionPrep {
        struct PrepGenerationRequest: Encodable {
            let pendingFollowUps: [[String: String]]?
        }

        struct PrepGenerationResponse: Decodable {
            let success: Bool
        }

        // Get pending follow-ups for this client from local quick notes
        // Note: Follow-ups integration will be added in a future update
        let followUps: [[String: String]]? = nil

        do {
            let response: PrepGenerationResponse = try await request(
                endpoint: "/api/sessions/\(sessionId)/prep-ai",
                method: .post,
                body: PrepGenerationRequest(pendingFollowUps: followUps)
            )

            guard response.success else {
                throw APIError.invalidResponse
            }

            return try await request(endpoint: "/api/sessions/\(sessionId)/prep-ai/latest")
        } catch {
            let fallback: SessionPrepFallbackResponse = try await request(endpoint: "/api/sessions/\(sessionId)/prep")
            return buildFallbackPrep(from: fallback)
        }
    }

    // Longitudinal Tracking
    func getLatestLongitudinalRecord(clientId: String) async throws -> LongitudinalRecord {
        try await request(endpoint: "/api/clients/\(clientId)/longitudinal/latest")
    }

    func generateLongitudinalRecord(clientId: String) async throws -> LongitudinalRecord {
        try await request(endpoint: "/api/clients/\(clientId)/longitudinal/generate", method: .post)
    }

    private struct SessionPrepFallbackResponse: Decodable {
        let session: Session
        let client: Client
        let recentNotes: [ProgressNote]?
        let treatmentPlan: TreatmentPlan?
        let prepSuggestions: PrepSuggestions?

        struct PrepSuggestions: Decodable {
            let focusAreas: [String]?
            let interventions: [String]?
            let riskFactors: [String]?

            enum CodingKeys: String, CodingKey {
                case focusAreas = "focusAreas"
                case interventions
                case riskFactors = "riskFactors"
            }
        }
    }

    private func buildFallbackPrep(from response: SessionPrepFallbackResponse) -> SessionPrep {
        // Build a comprehensive summary including client history
        var summaryParts: [String] = []
        summaryParts.append("Upcoming session with \(response.client.name) scheduled for \(response.session.formattedDate).")

        // Add session type context
        summaryParts.append("Session type: \(response.session.sessionType.displayName) (\(response.session.duration) minutes).")

        // Add client status context
        summaryParts.append("Client status: \(response.client.status.displayName).")

        // Build recent progress summary from all available notes
        var recentProgressParts: [String] = []
        var keyThemesFromNotes: [String] = []
        var riskFactorsFromNotes: [String] = []
        var suggestedTopics: [String] = []

        if let notes = response.recentNotes, !notes.isEmpty {
            summaryParts.append("This client has \(notes.count) documented session(s) on record.")

            // Analyze most recent note in detail
            if let latestNote = notes.first {
                let dateFormatter = DateFormatter()
                dateFormatter.dateStyle = .medium
                let noteDate = dateFormatter.string(from: latestNote.sessionDate)

                recentProgressParts.append("**Most Recent Session (\(noteDate)):**")
                if let content = latestNote.content, !content.isEmpty {
                    // Include the full content for context
                    recentProgressParts.append(content)
                } else {
                    recentProgressParts.append("No detailed notes recorded for the last session.")
                }

                // Add risk level context
                if latestNote.riskLevel != .low {
                    riskFactorsFromNotes.append("Previous session indicated \(latestNote.riskLevel.displayName.lowercased()) risk level - continue monitoring")
                }

                // Add progress rating context
                if let rating = latestNote.progressRating {
                    if rating >= 7 {
                        recentProgressParts.append("\n\n**Progress Rating:** \(rating)/10 - Client showing positive progress")
                    } else if rating >= 4 {
                        recentProgressParts.append("\n\n**Progress Rating:** \(rating)/10 - Moderate progress, continue current approach")
                    } else {
                        recentProgressParts.append("\n\n**Progress Rating:** \(rating)/10 - Limited progress noted, consider adjusting treatment approach")
                        suggestedTopics.append("Review treatment effectiveness and consider alternative approaches")
                    }
                }

                // Extract themes from note tags
                if !latestNote.tags.isEmpty {
                    keyThemesFromNotes.append(contentsOf: latestNote.tags)
                }
                if !latestNote.aiTags.isEmpty {
                    keyThemesFromNotes.append(contentsOf: latestNote.aiTags)
                }
            }

            // Summarize patterns from previous notes (if more than one)
            if notes.count > 1 {
                recentProgressParts.append("\n\n**Session History Summary:**")
                let notesSummary = notes.prefix(5).enumerated().map { index, note -> String in
                    let dateFormatter = DateFormatter()
                    dateFormatter.dateStyle = .short
                    let noteDate = dateFormatter.string(from: note.sessionDate)
                    let preview = note.contentPreview.isEmpty ? "No content" : String(note.contentPreview.prefix(100))
                    let riskIndicator = note.riskLevel != .low ? " [\(note.riskLevel.displayName)]" : ""
                    return "• \(noteDate)\(riskIndicator): \(preview)"
                }
                recentProgressParts.append(contentsOf: notesSummary)

                // Aggregate risk factors from all notes
                let highRiskNotes = notes.filter { $0.riskLevel == .high || $0.riskLevel == .critical }
                if !highRiskNotes.isEmpty {
                    riskFactorsFromNotes.append("Client has \(highRiskNotes.count) session(s) with elevated risk levels in history")
                }

                // Aggregate themes from all notes
                for note in notes.prefix(5) {
                    keyThemesFromNotes.append(contentsOf: note.tags)
                    keyThemesFromNotes.append(contentsOf: note.aiTags)
                }
            }
        } else {
            summaryParts.append("This is a new client or no previous session notes are available.")
            suggestedTopics.append("Establish rapport and therapeutic alliance")
            suggestedTopics.append("Review client history and presenting concerns")
            suggestedTopics.append("Set initial treatment goals")
        }

        // Add clinical considerations from client profile
        if !response.client.clinicalConsiderations.isEmpty {
            riskFactorsFromNotes.append(contentsOf: response.client.clinicalConsiderations)
        }

        // Add treatment plan context
        var goalUpdates: [String]? = nil
        var interventions = response.prepSuggestions?.interventions ?? []

        if let treatmentPlan = response.treatmentPlan {
            goalUpdates = treatmentPlan.goals.map { goal in
                let statusEmoji: String
                switch goal.status {
                case .achieved:
                    statusEmoji = "✓"
                case .inProgress:
                    statusEmoji = "→"
                case .notStarted:
                    statusEmoji = "○"
                case .discontinued:
                    statusEmoji = "✗"
                case .unknown:
                    statusEmoji = "?"
                }
                return "\(statusEmoji) \(goal.description)"
            }

            if interventions.isEmpty {
                interventions = treatmentPlan.interventions
            }
        }

        // Add preferred modalities as suggested interventions
        if !response.client.preferredModalities.isEmpty {
            suggestedTopics.append("Client's preferred modalities: \(response.client.preferredModalities.joined(separator: ", "))")
        }

        // Merge and deduplicate themes
        var finalThemes = response.prepSuggestions?.focusAreas ?? []
        finalThemes.append(contentsOf: Array(Set(keyThemesFromNotes)))
        finalThemes = Array(Set(finalThemes)).sorted()

        // Filter out "chart note" variations from themes (not clinically relevant)
        finalThemes = finalThemes.filter { !$0.lowercased().contains("chart note") }

        // Build final risk factors
        var finalRiskFactors = response.prepSuggestions?.riskFactors ?? []
        finalRiskFactors.append(contentsOf: riskFactorsFromNotes)
        finalRiskFactors = Array(Set(finalRiskFactors))

        let content = SessionPrepContent(
            summary: summaryParts.joined(separator: " "),
            keyThemes: finalThemes.isEmpty ? nil : finalThemes,
            suggestedTopics: suggestedTopics.isEmpty ? nil : Array(Set(suggestedTopics)),
            recentProgress: recentProgressParts.isEmpty ? nil : recentProgressParts.joined(separator: "\n"),
            riskFactors: finalRiskFactors.isEmpty ? nil : finalRiskFactors,
            treatmentGoalUpdates: goalUpdates,
            recommendedInterventions: interventions.isEmpty ? nil : interventions
        )

        return SessionPrep(
            id: UUID().uuidString,
            sessionId: response.session.id,
            clientId: response.client.id,
            therapistId: response.session.therapistId,
            prep: content,
            createdAt: Date()
        )
    }

    // Documents
    func getDocuments() async throws -> [Document] {
        try await request(endpoint: "/api/documents")
    }

    /// Get documents that need reprocessing (unlinked or pending)
    func getUnlinkedDocuments() async throws -> [Document] {
        let documents: [Document] = try await request(endpoint: "/api/documents")
        // Filter to documents without client links or with pending/failed status
        return documents.filter { doc in
            doc.clientId.isEmpty || doc.status == .pending || doc.status == .failed
        }
    }

    /// Reprocess a document with AI to extract client and date information
    func reprocessDocument(documentId: String) async throws -> Document {
        struct ReprocessRequest: Encodable {
            let force: Bool
        }
        return try await request(
            endpoint: "/api/documents/\(documentId)/smart-process",
            method: .post,
            body: ReprocessRequest(force: true)
        )
    }

    /// Batch reprocess multiple documents
    func batchReprocessDocuments(documentIds: [String]) async throws -> BatchReprocessResult {
        struct BatchRequest: Encodable {
            let documentIds: [String]
            let force: Bool
        }
        return try await request(
            endpoint: "/api/documents/smart-process-batch",
            method: .post,
            body: BatchRequest(documentIds: documentIds, force: true)
        )
    }

    /// Batch process all documents with AI, extract themes, link to sessions, and optionally delete
    func batchProcessDocuments(deleteAfterProcess: Bool = false, limit: Int = 50) async throws -> BatchProcessingResult {
        struct BatchAIRequest: Encodable {
            let deleteAfterProcess: Bool
            let limit: Int
        }
        return try await request(
            endpoint: "/api/documents/batch-ai-process",
            method: .post,
            body: BatchAIRequest(deleteAfterProcess: deleteAfterProcess, limit: limit)
        )
    }

    /// Link a document to a specific client and date
    func linkDocument(documentId: String, clientId: String, sessionDate: Date?) async throws -> Document {
        struct LinkRequest: Encodable {
            let clientId: String
            let sessionDate: String?
        }
        let dateString = sessionDate.map { ISO8601DateFormatter().string(from: $0) }
        return try await request(
            endpoint: "/api/documents/\(documentId)/link",
            method: .post,
            body: LinkRequest(clientId: clientId, sessionDate: dateString)
        )
    }

    func uploadDocument(fileData: Data, fileName: String, mimeType: String, clientId: String?) async throws -> Document {
        var fields: [String: String] = ["mobile": "true"]
        if let clientId = clientId {
            fields["client_id"] = clientId
        }
        return try await uploadFile(
            endpoint: "/api/documents/upload",
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            additionalFields: fields
        )
    }

    // Treatment Plans
    func getTreatmentPlans() async throws -> [TreatmentPlan] {
        try await request(endpoint: "/api/treatment-plans")
    }

    func getTreatmentPlan(id: String) async throws -> TreatmentPlan {
        try await request(endpoint: "/api/treatment-plans/\(id)")
    }

    func createTreatmentPlan(_ input: CreateTreatmentPlanInput) async throws -> TreatmentPlan {
        try await request(endpoint: "/api/treatment-plans", method: .post, body: input)
    }

    // User Profile
    func updateProfile(_ input: UpdateUserInput) async throws -> User {
        try await request(endpoint: "/api/user/profile", method: .put, body: input)
    }

    // Document Upload and Analysis
    func uploadAndAnalyzeDocument(fileData: Data, fileName: String, mimeType: String, clientId: String?) async throws -> Document {
        // This uses the same upload endpoint but triggers AI analysis
        var fields: [String: String] = ["analyze": "true", "mobile": "true"]
        if let clientId = clientId {
            fields["client_id"] = clientId
        }
        return try await uploadFile(
            endpoint: "/api/documents/upload",
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            additionalFields: fields
        )
    }

    // AI Note Assistance
    func getNoteDraft(notes: String) async throws -> String {
        struct DraftRequest: Encodable { let notes: String }
        struct DraftResponse: Decodable { let draft: String }
        let response: DraftResponse = try await request(
            endpoint: "/api/ai/note-draft",
            method: .post,
            body: DraftRequest(notes: notes)
        )
        return response.draft
    }

    func getNoteSuggestions(context: String) async throws -> [String] {
        struct SuggestRequest: Encodable { let context: String }
        struct SuggestResponse: Decodable { let suggestions: [String] }
        let response: SuggestResponse = try await request(
            endpoint: "/api/ai/note-suggestions",
            method: .post,
            body: SuggestRequest(context: context)
        )
        return response.suggestions
    }

    // Data Export
    func exportData(scope: String) async throws -> Data {
        let request = try buildRequest(
            endpoint: "/api/export",
            method: .get,
            queryParameters: ["scope": scope]
        )

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 500, nil)
        }

        return data
    }

    // MARK: - Calendar Events API

    /// Get calendar events with optional date filtering
    func getCalendarEvents(startDate: Date? = nil, endDate: Date? = nil, source: String? = nil) async throws -> [SyncedCalendarEvent] {
        var params: [String: String] = [:]
        if let startDate = startDate {
            params["startDate"] = ISO8601DateFormatter().string(from: startDate)
        }
        if let endDate = endDate {
            params["endDate"] = ISO8601DateFormatter().string(from: endDate)
        }
        if let source = source {
            params["source"] = source
        }
        return try await request(endpoint: "/api/calendar-events", method: .get, queryParameters: params)
    }

    /// Create a new calendar event
    func createCalendarEvent(_ event: CreateCalendarEventInput) async throws -> SyncedCalendarEvent {
        try await request(endpoint: "/api/calendar-events", method: .post, body: event)
    }

    /// Update a calendar event
    func updateCalendarEvent(id: String, _ event: UpdateCalendarEventInput) async throws -> SyncedCalendarEvent {
        try await request(endpoint: "/api/calendar-events/\(id)", method: .put, body: event)
    }

    /// Delete a calendar event
    func deleteCalendarEvent(id: String) async throws {
        try await requestVoid(endpoint: "/api/calendar-events/\(id)", method: .delete)
    }

    /// Sync calendar events from external source
    func syncCalendarEvents(_ sync: CalendarEventSyncRequest) async throws -> CalendarEventSyncResponse {
        try await request(endpoint: "/api/calendar-events/sync", method: .post, body: sync)
    }

    /// Sync calendar events from Google Calendar (server-side)
    func syncCalendar(startDate: String, endDate: String) async throws -> CalendarSyncResponse {
        struct CalendarSyncRequest: Encodable {
            let startDate: String
            let endDate: String
        }

        return try await request(
            endpoint: "/api/calendar/sync",
            method: .post,
            body: CalendarSyncRequest(startDate: startDate, endDate: endDate)
        )
    }

    /// Get pending sync events
    func getPendingCalendarEvents() async throws -> [SyncedCalendarEvent] {
        try await request(endpoint: "/api/calendar-events/pending/sync", method: .get)
    }

    /// Mark event as synced
    func markCalendarEventSynced(id: String, externalId: String?) async throws -> SyncedCalendarEvent {
        struct MarkSyncedRequest: Encodable {
            let externalId: String?
        }
        return try await request(
            endpoint: "/api/calendar-events/\(id)/mark-synced",
            method: .post,
            body: MarkSyncedRequest(externalId: externalId)
        )
    }
}

// MARK: - Calendar Event Models

struct SyncedCalendarEvent: Codable, Identifiable {
    let id: String
    let therapistId: String
    let externalId: String
    let source: String
    let title: String
    let description: String?
    let location: String?
    let startTime: Date
    let endTime: Date
    let isAllDay: Bool
    let attendees: [String]?
    let linkedClientId: String?
    let linkedSessionId: String?
    let syncStatus: String
    let lastSyncedAt: Date?
    let syncError: String?
    let recurringEventId: String?
    let isRecurring: Bool
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case therapistId = "therapist_id"
        case externalId = "external_id"
        case source
        case title
        case description
        case location
        case startTime = "start_time"
        case endTime = "end_time"
        case isAllDay = "is_all_day"
        case attendees
        case linkedClientId = "linked_client_id"
        case linkedSessionId = "linked_session_id"
        case syncStatus = "sync_status"
        case lastSyncedAt = "last_synced_at"
        case syncError = "sync_error"
        case recurringEventId = "recurring_event_id"
        case isRecurring = "is_recurring"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    /// Convert to CalendarEvent for UI display
    func toCalendarEvent() -> CalendarEvent {
        CalendarEvent(
            id: id,
            title: title,
            startTime: startTime,
            endTime: endTime,
            location: location,
            description: description,
            attendees: attendees,
            source: CalendarEvent.CalendarSource(rawValue: source) ?? .therapyFlow
        )
    }
}

struct CreateCalendarEventInput: Encodable {
    let externalId: String
    let source: String
    let title: String
    let description: String?
    let location: String?
    let startTime: Date
    let endTime: Date
    let isAllDay: Bool
    let attendees: [String]?
    let linkedClientId: String?
    let linkedSessionId: String?
    let rawData: [String: Any]?

    enum CodingKeys: String, CodingKey {
        case externalId, source, title, description, location
        case startTime, endTime, isAllDay, attendees
        case linkedClientId, linkedSessionId, rawData
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(externalId, forKey: .externalId)
        try container.encode(source, forKey: .source)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encodeIfPresent(location, forKey: .location)
        try container.encode(ISO8601DateFormatter().string(from: startTime), forKey: .startTime)
        try container.encode(ISO8601DateFormatter().string(from: endTime), forKey: .endTime)
        try container.encode(isAllDay, forKey: .isAllDay)
        try container.encodeIfPresent(attendees, forKey: .attendees)
        try container.encodeIfPresent(linkedClientId, forKey: .linkedClientId)
        try container.encodeIfPresent(linkedSessionId, forKey: .linkedSessionId)
        // rawData is not encoded as it's complex - handle separately if needed
    }
}

struct UpdateCalendarEventInput: Encodable {
    var title: String?
    var description: String?
    var location: String?
    var startTime: Date?
    var endTime: Date?
    var isAllDay: Bool?
    var linkedClientId: String?
    var linkedSessionId: String?
}

struct CalendarEventSyncRequest: Encodable {
    let events: [CreateCalendarEventInput]
    let source: String
}

struct CalendarEventSyncResponse: Decodable {
    let success: Bool
    let results: SyncResults
    let message: String

    struct SyncResults: Decodable {
        let created: Int
        let updated: Int
        let deleted: Int
        let errors: [String]
    }
}

struct LongitudinalRecord: Decodable {
    let id: String
    let clientId: String
    let therapistId: String
    let analysis: LongitudinalAnalysis
    let createdAt: Date
}

struct LongitudinalAnalysis: Decodable {
    let treatmentPhase: String?
    let engagementTrend: String?
    let riskTrend: String?
    let activeThemes: [String]?
    let resolvingThemes: [String]?
    let stuckThemes: [String]?
    let whatsWorking: [String]?
    let whatsNotLanding: [String]?
    let goalsNeedingAttention: [String]?
    let focusRecommendations: [String]?
    let patternsClientMayNotSee: [String]?
    let quantQualConnections: [String]?
    let predictedChallenges: [String]?
    let modalityAdjustments: [String]?
    let terminationConsiderations: String?

    enum CodingKeys: String, CodingKey {
        case treatmentPhase = "treatment_phase"
        case engagementTrend = "engagement_trend"
        case riskTrend = "risk_trend"
        case activeThemes = "active_themes"
        case resolvingThemes = "resolving_themes"
        case stuckThemes = "stuck_themes"
        case whatsWorking = "whats_working"
        case whatsNotLanding = "whats_not_landing"
        case goalsNeedingAttention = "goals_needing_attention"
        case focusRecommendations = "focus_recommendations"
        case patternsClientMayNotSee = "patterns_client_may_not_see"
        case quantQualConnections = "quant_qual_connections"
        case predictedChallenges = "predicted_challenges"
        case modalityAdjustments = "modality_adjustments"
        case terminationConsiderations = "termination_considerations"
    }
}

struct CalendarSyncResponse: Decodable {
    let success: Bool
    let syncedCount: Int?
    let savedCount: Int?
    let imported: Int?
    let orphanedNotesLinked: Int?
    let dateRange: DateRange?

    struct DateRange: Decodable {
        let startDate: String
        let endDate: String
    }
}

// MARK: - Document Reprocessing

struct BatchReprocessResult: Decodable {
    let success: Bool
    let processed: Int
    let failed: Int
    let results: [DocumentReprocessResult]
    let errors: [String]

    struct DocumentReprocessResult: Decodable {
        let documentId: String
        let success: Bool
        let linkedClientId: String?
        let linkedClientName: String?
        let sessionDate: String?
        let confidence: Double?
        let error: String?
    }
}
