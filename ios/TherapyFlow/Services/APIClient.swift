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
    private static let productionURL = "https://therapyflow-backend-1.onrender.com"  // Production Render backend

    // Base URL configuration
    private static var configuredBaseURL: URL {
        // Check for custom URL in UserDefaults (allows runtime override from Settings)
        if let customURLString = UserDefaults.standard.string(forKey: "api_base_url"),
           let customURL = URL(string: customURLString) {
            return customURL
        }

        #if DEBUG
        // Development builds use local server for simulator, production URL for device
        #if targetEnvironment(simulator)
        // Simulator can reach localhost
        return URL(string: "http://localhost:5001")!
        #else
        // Real device needs the production server (can't reach localhost)
        return URL(string: productionURL)!
        #endif
        #else
        // Release/Production builds always use production server
        return URL(string: productionURL)!
        #endif
    }

    init() {
        self.baseURL = Self.configuredBaseURL

        // Configure URLSession
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        config.waitsForConnectivity = true
        config.requestCachePolicy = .reloadIgnoringLocalCacheData

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
        var urlComponents = URLComponents(url: baseURL.appendingPathComponent(endpoint), resolvingAgainstBaseURL: true)!

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

    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        queryParameters: [String: String]? = nil,
        body: Encodable? = nil
    ) async throws -> T {
        // Rate limiting
        if let lastTime = lastRequestTime {
            let elapsed = Date().timeIntervalSince(lastTime)
            if elapsed < minRequestInterval {
                try await Task.sleep(nanoseconds: UInt64((minRequestInterval - elapsed) * 1_000_000_000))
            }
        }
        lastRequestTime = Date()

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
                print("Unexpected content type: \(contentType), response: \(responsePreview)")
                throw APIError.unexpectedContentType(contentType)
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
            throw APIError.httpError(httpResponse.statusCode)
        }
    }

    func requestVoid(
        endpoint: String,
        method: HTTPMethod = .get,
        queryParameters: [String: String]? = nil,
        body: Encodable? = nil
    ) async throws {
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

        let (_, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            }
            throw APIError.httpError(httpResponse.statusCode)
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
    case httpError(Int)
    case uploadFailed
    case networkError(Error)
    case noData
    case unexpectedContentType(String)
    case htmlResponseReceived
    case requestCancelled

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
        case .httpError(let code):
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
        }
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
    func getSessions(upcoming: Bool = false, clientId: String? = nil, limit: Int? = nil) async throws -> [Session] {
        var params: [String: String] = [:]
        if upcoming { params["upcoming"] = "true" }
        if let clientId = clientId { params["clientId"] = clientId }
        if let limit = limit { params["limit"] = String(limit) }

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
        if let clientId = clientId { params["clientId"] = clientId }
        if recent { params["recent"] = "true" }
        if let limit = limit { params["limit"] = String(limit) }

        return try await request(endpoint: "/api/progress-notes", queryParameters: params)
    }

    func getProgressNote(id: String) async throws -> ProgressNote {
        try await request(endpoint: "/api/progress-notes/\(id)")
    }

    func createProgressNote(_ input: CreateProgressNoteInput) async throws -> ProgressNote {
        try await request(endpoint: "/api/progress-notes", method: .post, body: input)
    }

    func updateProgressNote(id: String, _ input: UpdateProgressNoteInput) async throws -> ProgressNote {
        try await request(endpoint: "/api/progress-notes/\(id)", method: .put, body: input)
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
        try await request(endpoint: "/api/sessions/\(sessionId)/prep")
    }

    func generateSessionPrep(sessionId: String) async throws -> SessionPrep {
        try await request(endpoint: "/api/sessions/\(sessionId)/prep", method: .post)
    }

    // Documents
    func getDocuments() async throws -> [Document] {
        try await request(endpoint: "/api/documents")
    }

    func uploadDocument(fileData: Data, fileName: String, mimeType: String, clientId: String?) async throws -> Document {
        var fields: [String: String] = [:]
        if let clientId = clientId {
            fields["clientId"] = clientId
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
        var fields: [String: String] = ["analyze": "true"]
        if let clientId = clientId {
            fields["clientId"] = clientId
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
            throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 500)
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
