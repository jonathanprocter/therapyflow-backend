import Foundation
import AuthenticationServices

// MARK: - Integrations Service
/// Manages external integrations including AI providers and calendar services
@MainActor
class IntegrationsService: ObservableObject {
    static let shared = IntegrationsService()

    // MARK: - Published Properties
    @Published var aiProvider: AIProvider = .anthropic
    @Published var isAIConfigured: Bool = false
    @Published var googleCalendarConnected: Bool = false
    @Published var simplePracticeConnected: Bool = false
    @Published var calendarSyncEnabled: Bool = false

    // MARK: - Private Properties
    private let keychain = KeychainService.shared

    // Keychain keys
    private let anthropicAPIKeyKey = "com.therapyflow.anthropic.apikey"
    private let openAIAPIKeyKey = "com.therapyflow.openai.apikey"
    private let googleOAuthTokenKey = "com.therapyflow.google.oauth"
    private let googleRefreshTokenKey = "com.therapyflow.google.refresh"
    private let simplePracticeTokenKey = "com.therapyflow.simplepractice.token"

    init() {
        loadIntegrationStatus()
    }

    // MARK: - Load Status
    private func loadIntegrationStatus() {
        // Check if AI is configured
        if let _ = try? keychain.retrieve(key: anthropicAPIKeyKey) {
            aiProvider = .anthropic
            isAIConfigured = true
        } else if let _ = try? keychain.retrieve(key: openAIAPIKeyKey) {
            aiProvider = .openAI
            isAIConfigured = true
        }

        // Check calendar connections
        if let _ = try? keychain.retrieve(key: googleOAuthTokenKey) {
            googleCalendarConnected = true
        }

        if let _ = try? keychain.retrieve(key: simplePracticeTokenKey) {
            simplePracticeConnected = true
        }

        // Load sync preference
        calendarSyncEnabled = UserDefaults.standard.bool(forKey: "calendarSyncEnabled")
    }

    // MARK: - AI Configuration

    /// Save AI API key securely
    func configureAI(provider: AIProvider, apiKey: String) throws {
        let key = provider == .anthropic ? anthropicAPIKeyKey : openAIAPIKeyKey

        // Clear any existing keys
        try? keychain.delete(key: anthropicAPIKeyKey)
        try? keychain.delete(key: openAIAPIKeyKey)

        // Save new key
        try keychain.save(key: key, data: apiKey.data(using: .utf8)!)

        self.aiProvider = provider
        self.isAIConfigured = true

        // Notify the backend about the AI configuration
        Task {
            try? await notifyBackendAIConfigured(provider: provider)
        }
    }

    /// Get current AI API key
    func getAIAPIKey() -> String? {
        let key = aiProvider == .anthropic ? anthropicAPIKeyKey : openAIAPIKeyKey
        guard let data = try? keychain.retrieve(key: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Remove AI configuration
    func removeAIConfiguration() throws {
        try? keychain.delete(key: anthropicAPIKeyKey)
        try? keychain.delete(key: openAIAPIKeyKey)

        self.isAIConfigured = false
    }

    /// Get the currently selected AI provider (for use by AIDocumentProcessor)
    var selectedAIProvider: AIProvider {
        aiProvider
    }

    /// Get API key for specific provider (for use by AIDocumentProcessor)
    func getAPIKey(for provider: AIProvider) -> String {
        let key = provider == .anthropic ? anthropicAPIKeyKey : openAIAPIKeyKey
        guard let data = try? keychain.retrieve(key: key) else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }

    /// Validate AI API key by making a test request
    func validateAIAPIKey(provider: AIProvider, apiKey: String) async throws -> Bool {
        switch provider {
        case .anthropic:
            return try await validateAnthropicKey(apiKey)
        case .openAI:
            return try await validateOpenAIKey(apiKey)
        }
    }

    private func validateAnthropicKey(_ apiKey: String) async throws -> Bool {
        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Minimal test payload
        let payload: [String: Any] = [
            "model": "claude-3-haiku-20240307",
            "max_tokens": 1,
            "messages": [["role": "user", "content": "Hi"]]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { return false }

        return httpResponse.statusCode == 200
    }

    private func validateOpenAIKey(_ apiKey: String) async throws -> Bool {
        var request = URLRequest(url: URL(string: "https://api.openai.com/v1/models")!)
        request.httpMethod = "GET"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { return false }

        return httpResponse.statusCode == 200
    }

    private func notifyBackendAIConfigured(provider: AIProvider) async throws {
        // Optionally notify your backend that AI is configured
        // This allows server-side AI features to use the user's key
        try await APIClient.shared.requestVoid(
            endpoint: "/api/settings/ai-provider",
            method: .post,
            body: ["provider": provider.rawValue]
        )
    }

    // MARK: - Google Calendar Integration

    /// Google OAuth configuration
    /// IMPORTANT: You MUST create an iOS OAuth client in Google Cloud Console
    /// Web clients do NOT support custom URL schemes (you'll get "Custom scheme URIs are not allowed")
    ///
    /// Steps to create iOS OAuth client:
    /// 1. Go to https://console.cloud.google.com/apis/credentials
    /// 2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
    /// 3. Select "iOS" as Application type
    /// 4. Set Bundle ID: com.therapyflow.ios
    /// 5. Copy the new Client ID and replace below
    struct GoogleOAuthConfig {
        // iOS OAuth Client ID from Google Cloud Console (iOS type)
        static let clientID = "839967078225-rp9g5kqat6jteg9eoav1mkjrenktafen.apps.googleusercontent.com"

        // iOS OAuth clients do NOT use client secrets
        static let clientSecret = ""

        // Reversed client ID for URL scheme
        static let reversedClientID = "com.googleusercontent.apps.839967078225-rp9g5kqat6jteg9eoav1mkjrenktafen"

        static let apiKey = "AIzaSyAUXmnozR1UJuaV2TLwyLcJY9XDoYrcDhA"

        // OAuth redirect URI uses the reversed client ID
        static var redirectURI: String {
            return "\(reversedClientID):/oauth2redirect"
        }

        static let tokenURL = "https://oauth2.googleapis.com/token"

        static let scopes = [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events"
        ]
    }

    /// Initiate Google Calendar OAuth flow
    func connectGoogleCalendar() -> URL {
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: GoogleOAuthConfig.clientID),
            URLQueryItem(name: "redirect_uri", value: GoogleOAuthConfig.redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: GoogleOAuthConfig.scopes.joined(separator: " ")),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent")
        ]
        return components.url!
    }

    /// Handle Google OAuth callback
    func handleGoogleOAuthCallback(url: URL) async throws {
        guard let code = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "code" })?.value else {
            throw IntegrationError.invalidCallback
        }

        // Exchange authorization code for tokens directly with Google
        let response = try await exchangeCodeForTokens(code: code)

        // Store tokens securely in Keychain
        try keychain.save(key: googleOAuthTokenKey, data: response.accessToken.data(using: .utf8)!)
        if let refreshToken = response.refreshToken {
            try keychain.save(key: googleRefreshTokenKey, data: refreshToken.data(using: .utf8)!)
        }

        // Also notify the backend so it can store tokens for server-side operations
        let storeTokensRequest = GoogleStoreTokensRequest(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken ?? "",
            expiresIn: response.expiresIn
        )
        try? await APIClient.shared.requestVoid(
            endpoint: "/api/integrations/google/store-tokens",
            method: .post,
            body: storeTokensRequest
        )

        self.googleCalendarConnected = true
    }

    /// Exchange authorization code for access and refresh tokens
    private func exchangeCodeForTokens(code: String) async throws -> GoogleTokenResponse {
        var request = URLRequest(url: URL(string: GoogleOAuthConfig.tokenURL)!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        // For iOS native apps (public clients), client_secret is not required
        // Only include it if it's not empty (for backwards compatibility with web clients)
        var bodyParams = [
            "code": code,
            "client_id": GoogleOAuthConfig.clientID,
            "redirect_uri": GoogleOAuthConfig.redirectURI,
            "grant_type": "authorization_code"
        ]

        // Only add client_secret if it's configured (not needed for iOS OAuth clients)
        if !GoogleOAuthConfig.clientSecret.isEmpty {
            bodyParams["client_secret"] = GoogleOAuthConfig.clientSecret
        }

        let bodyString = bodyParams
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")

        request.httpBody = bodyString.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw IntegrationError.invalidCallback
        }

        guard httpResponse.statusCode == 200 else {
            if let errorResponse = try? JSONDecoder().decode(GoogleErrorResponse.self, from: data) {
                throw IntegrationError.apiError(errorResponse.errorDescription ?? errorResponse.error)
            }
            // Log the error for debugging
            if let errorBody = String(data: data, encoding: .utf8) {
                print("Google OAuth error: \(errorBody)")
            }
            throw IntegrationError.apiError("Token exchange failed with status \(httpResponse.statusCode)")
        }

        return try JSONDecoder().decode(GoogleTokenResponse.self, from: data)
    }

    /// Refresh the Google access token using the refresh token
    func refreshGoogleAccessToken() async throws -> String {
        guard let refreshTokenData = try? keychain.retrieve(key: googleRefreshTokenKey),
              let refreshToken = String(data: refreshTokenData, encoding: .utf8) else {
            throw IntegrationError.tokenExpired
        }

        var request = URLRequest(url: URL(string: GoogleOAuthConfig.tokenURL)!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        // For iOS native apps, client_secret is not required
        var bodyParams = [
            "client_id": GoogleOAuthConfig.clientID,
            "refresh_token": refreshToken,
            "grant_type": "refresh_token"
        ]

        // Only add client_secret if configured
        if !GoogleOAuthConfig.clientSecret.isEmpty {
            bodyParams["client_secret"] = GoogleOAuthConfig.clientSecret
        }

        let bodyString = bodyParams
            .map { "\($0.key)=\($0.value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0.value)" }
            .joined(separator: "&")

        request.httpBody = bodyString.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw IntegrationError.tokenExpired
        }

        let tokenResponse = try JSONDecoder().decode(GoogleTokenResponse.self, from: data)

        // Update stored access token
        try keychain.save(key: googleOAuthTokenKey, data: tokenResponse.accessToken.data(using: .utf8)!)

        return tokenResponse.accessToken
    }

    /// Get valid Google access token (refreshing if needed)
    func getValidGoogleAccessToken() async throws -> String {
        guard let tokenData = try? keychain.retrieve(key: googleOAuthTokenKey),
              let token = String(data: tokenData, encoding: .utf8) else {
            throw IntegrationError.notConnected
        }

        // For now, return the token - in production, check expiry and refresh if needed
        return token
    }

    /// Disconnect Google Calendar
    func disconnectGoogleCalendar() throws {
        try? keychain.delete(key: googleOAuthTokenKey)
        try? keychain.delete(key: googleRefreshTokenKey)

        // Notify backend to revoke access
        Task {
            try? await APIClient.shared.requestVoid(
                endpoint: "/api/integrations/google/disconnect",
                method: .post
            )
        }

        self.googleCalendarConnected = false
    }

    /// Get Google Calendar events directly from Google Calendar API
    func getGoogleCalendarEvents(startDate: Date, endDate: Date) async throws -> [CalendarEvent] {
        guard googleCalendarConnected else {
            throw IntegrationError.notConnected
        }

        let accessToken = try await getValidGoogleAccessToken()

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        var components = URLComponents(string: "https://www.googleapis.com/calendar/v3/calendars/primary/events")!
        components.queryItems = [
            URLQueryItem(name: "key", value: GoogleOAuthConfig.apiKey),
            URLQueryItem(name: "timeMin", value: formatter.string(from: startDate)),
            URLQueryItem(name: "timeMax", value: formatter.string(from: endDate)),
            URLQueryItem(name: "singleEvents", value: "true"),
            URLQueryItem(name: "orderBy", value: "startTime")
        ]

        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw IntegrationError.apiError("Invalid response")
        }

        // If unauthorized, try to refresh token and retry
        if httpResponse.statusCode == 401 {
            let newToken = try await refreshGoogleAccessToken()

            var retryRequest = URLRequest(url: components.url!)
            retryRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")

            let (retryData, retryResponse) = try await URLSession.shared.data(for: retryRequest)

            guard let retryHttpResponse = retryResponse as? HTTPURLResponse,
                  retryHttpResponse.statusCode == 200 else {
                throw IntegrationError.tokenExpired
            }

            return try parseGoogleCalendarEvents(from: retryData)
        }

        guard httpResponse.statusCode == 200 else {
            throw IntegrationError.apiError("Failed to fetch calendar events: \(httpResponse.statusCode)")
        }

        return try parseGoogleCalendarEvents(from: data)
    }

    /// Parse Google Calendar API response into CalendarEvent array
    private func parseGoogleCalendarEvents(from data: Data) throws -> [CalendarEvent] {
        let response = try JSONDecoder().decode(GoogleCalendarEventsResponse.self, from: data)

        return response.items.compactMap { item -> CalendarEvent? in
            guard let startTime = item.start.dateTime ?? item.start.date.flatMap({ parseDate($0) }),
                  let endTime = item.end.dateTime ?? item.end.date.flatMap({ parseDate($0) }) else {
                return nil
            }

            return CalendarEvent(
                id: item.id,
                title: item.summary ?? "Untitled",
                startTime: startTime,
                endTime: endTime,
                location: item.location,
                description: item.description,
                attendees: item.attendees?.map { $0.email },
                source: .google
            )
        }
    }

    private func parseDate(_ dateString: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: dateString)
    }

    /// Sync session to Google Calendar - creates event directly via Google Calendar API
    func syncSessionToGoogleCalendar(_ session: Session) async throws {
        guard googleCalendarConnected else {
            throw IntegrationError.notConnected
        }

        let accessToken = try await getValidGoogleAccessToken()

        let url = URL(string: "https://www.googleapis.com/calendar/v3/calendars/primary/events?key=\(GoogleOAuthConfig.apiKey)")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        let endTime = session.scheduledAt.addingTimeInterval(TimeInterval(session.duration * 60))
        let timeZone = TimeZone.current.identifier

        let eventRequest = GoogleCalendarEventRequest(
            summary: "Therapy Session - \(session.client?.name ?? "Client")",
            description: """
            Session Type: \(session.sessionType.displayName)
            Duration: \(session.duration) minutes
            \(session.notes ?? "")

            Created by TherapyFlow
            """,
            location: nil,
            start: GoogleCalendarEventTime(
                dateTime: formatter.string(from: session.scheduledAt),
                timeZone: timeZone
            ),
            end: GoogleCalendarEventTime(
                dateTime: formatter.string(from: endTime),
                timeZone: timeZone
            ),
            attendees: nil
        )

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(eventRequest)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw IntegrationError.apiError("Invalid response")
        }

        // Handle token refresh if needed
        if httpResponse.statusCode == 401 {
            let newToken = try await refreshGoogleAccessToken()

            var retryRequest = URLRequest(url: url)
            retryRequest.httpMethod = "POST"
            retryRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
            retryRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            retryRequest.httpBody = try encoder.encode(eventRequest)

            let (_, retryResponse) = try await URLSession.shared.data(for: retryRequest)

            guard let retryHttpResponse = retryResponse as? HTTPURLResponse,
                  (200...299).contains(retryHttpResponse.statusCode) else {
                throw IntegrationError.apiError("Failed to create calendar event")
            }
            return
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorData = String(data: data, encoding: .utf8) {
                print("Google Calendar Error: \(errorData)")
            }
            throw IntegrationError.apiError("Failed to create calendar event: \(httpResponse.statusCode)")
        }
    }

    /// Delete a session from Google Calendar
    func deleteSessionFromGoogleCalendar(eventId: String) async throws {
        guard googleCalendarConnected else {
            throw IntegrationError.notConnected
        }

        let accessToken = try await getValidGoogleAccessToken()

        let url = URL(string: "https://www.googleapis.com/calendar/v3/calendars/primary/events/\(eventId)?key=\(GoogleOAuthConfig.apiKey)")!

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) || httpResponse.statusCode == 404 else {
            throw IntegrationError.apiError("Failed to delete calendar event")
        }
    }

    // MARK: - SimplePractice Integration (via Google Calendar)
    //
    // SimplePractice doesn't have a public API, so appointments are synced through
    // Google Calendar integration. SimplePractice has built-in Google Calendar sync
    // that pushes appointments to the user's Google Calendar.
    //
    // To sync SimplePractice appointments:
    // 1. User connects their Google Calendar in SimplePractice settings
    // 2. User connects their Google Calendar here in TherapyFlow
    // 3. TherapyFlow reads appointments from Google Calendar (includes SimplePractice appointments)

    /// Check if SimplePractice appointments are available via Google Calendar
    var simplePracticeViaGoogleCalendar: Bool {
        googleCalendarConnected
    }

    /// Get SimplePractice appointments from Google Calendar
    /// SimplePractice creates events with specific formatting that we can identify
    func getSimplePracticeAppointments(startDate: Date, endDate: Date) async throws -> [CalendarEvent] {
        guard googleCalendarConnected else {
            throw IntegrationError.notConnected
        }

        // Get all events from Google Calendar
        let allEvents = try await getGoogleCalendarEvents(startDate: startDate, endDate: endDate)

        // Filter for SimplePractice appointments
        // SimplePractice typically adds specific markers or formatting to event titles/descriptions
        let simplePracticeEvents = allEvents.filter { event in
            // SimplePractice events typically contain "SimplePractice" in the description
            // or have specific formatting like "Client Name - Session Type"
            if let description = event.description?.lowercased() {
                return description.contains("simplepractice")
            }

            // Also check for common SimplePractice event patterns
            // Events often have format: "Therapy Session: Client Name" or similar
            let title = event.title.lowercased()
            return title.contains("session") ||
                   title.contains("therapy") ||
                   title.contains("appointment") ||
                   title.contains("consultation")
        }

        return simplePracticeEvents.map { event in
            CalendarEvent(
                id: event.id,
                title: event.title,
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location,
                description: event.description,
                attendees: event.attendees,
                source: .simplePractice // Mark source as SimplePractice
            )
        }
    }

    /// Convert Google Calendar events to TherapyFlow sessions
    func convertCalendarEventsToSessions(_ events: [CalendarEvent], existingClients: [Client]) -> [Session] {
        return events.compactMap { event -> Session? in
            // Try to match event to an existing client
            let matchedClient = existingClients.first { client in
                event.title.lowercased().contains(client.name.lowercased())
            }

            // Calculate duration from start/end time
            let duration = Int(event.endTime.timeIntervalSince(event.startTime) / 60)

            // Create a session from the calendar event
            // Include location in notes if available
            var sessionNotes = event.description ?? ""
            if let location = event.location, !location.isEmpty {
                sessionNotes = sessionNotes.isEmpty ? "Location: \(location)" : "\(sessionNotes)\n\nLocation: \(location)"
            }

            return Session(
                id: "gcal-\(event.id)",
                clientId: matchedClient?.id ?? "",
                therapistId: "", // Will be set by the caller
                scheduledAt: event.startTime,
                duration: duration,
                sessionType: .individual, // Default, could be parsed from title
                status: event.startTime > Date() ? .scheduled : .completed,
                notes: sessionNotes.isEmpty ? nil : sessionNotes,
                client: matchedClient
            )
        }
    }

    /// Sync all calendar appointments (including SimplePractice)
    func syncAllCalendarAppointments() async throws -> [Session] {
        guard googleCalendarConnected else {
            throw IntegrationError.notConnected
        }

        // Get appointments for the next 30 days and past 7 days
        let startDate = Date().adding(days: -7)
        let endDate = Date().adding(days: 30)

        let events = try await getGoogleCalendarEvents(startDate: startDate, endDate: endDate)

        // Get existing clients to match appointments
        let clients = try await APIClient.shared.getClients()

        // Convert to sessions
        let sessions = convertCalendarEventsToSessions(events, existingClients: clients)

        return sessions
    }

    /// Placeholder for future SimplePractice direct OAuth (if they release an API)
    func handleSimplePracticeCallback(url: URL) async throws {
        // SimplePractice doesn't have a public OAuth API
        // Appointments are synced via Google Calendar instead
        print("SimplePractice OAuth not available. Use Google Calendar sync instead.")
        throw IntegrationError.apiError("SimplePractice appointments sync via Google Calendar. Please connect your Google Calendar.")
    }

    // MARK: - Calendar Sync Settings

    func setCalendarSyncEnabled(_ enabled: Bool) {
        calendarSyncEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: "calendarSyncEnabled")

        if enabled {
            // Schedule background sync
            Task {
                await scheduleCalendarSync()
            }
        }
    }

    private func scheduleCalendarSync() async {
        // This would use BGTaskScheduler in production
    }
}

// MARK: - AI Provider Enum
enum AIProvider: String, CaseIterable, Codable {
    case anthropic = "anthropic"
    case openAI = "openai"

    var displayName: String {
        switch self {
        case .anthropic: return "Anthropic (Claude)"
        case .openAI: return "OpenAI (GPT)"
        }
    }

    var icon: String {
        switch self {
        case .anthropic: return "brain.head.profile"
        case .openAI: return "sparkles"
        }
    }

    var description: String {
        switch self {
        case .anthropic:
            return "Claude AI by Anthropic - recommended for clinical analysis"
        case .openAI:
            return "GPT-4 by OpenAI - general purpose AI"
        }
    }
}

// MARK: - Integration Error
enum IntegrationError: LocalizedError {
    case notConnected
    case invalidCallback
    case tokenExpired
    case apiError(String)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Integration is not connected"
        case .invalidCallback:
            return "Invalid OAuth callback"
        case .tokenExpired:
            return "Access token has expired. Please reconnect."
        case .apiError(let message):
            return message
        }
    }
}

// MARK: - Request Models
struct GoogleStoreTokensRequest: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
    }
}

// MARK: - Response Models
struct GoogleTokenResponse: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int
    let tokenType: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case tokenType = "token_type"
    }
}

struct GoogleErrorResponse: Codable {
    let error: String
    let errorDescription: String?

    enum CodingKeys: String, CodingKey {
        case error
        case errorDescription = "error_description"
    }
}

// MARK: - Google Calendar API Response Models
struct GoogleCalendarEventsResponse: Codable {
    let items: [GoogleCalendarEvent]
}

struct GoogleCalendarEvent: Codable {
    let id: String
    let summary: String?
    let description: String?
    let location: String?
    let start: GoogleCalendarDateTime
    let end: GoogleCalendarDateTime
    let attendees: [GoogleCalendarAttendee]?
}

struct GoogleCalendarDateTime: Codable {
    let dateTime: Date?
    let date: String? // For all-day events
    let timeZone: String?

    enum CodingKeys: String, CodingKey {
        case dateTime, date, timeZone
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Try to decode dateTime as ISO8601 string first
        if let dateTimeString = try container.decodeIfPresent(String.self, forKey: .dateTime) {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            self.dateTime = formatter.date(from: dateTimeString) ?? ISO8601DateFormatter().date(from: dateTimeString)
        } else {
            self.dateTime = nil
        }

        self.date = try container.decodeIfPresent(String.self, forKey: .date)
        self.timeZone = try container.decodeIfPresent(String.self, forKey: .timeZone)
    }
}

struct GoogleCalendarAttendee: Codable {
    let email: String
    let displayName: String?
    let responseStatus: String?
}

// MARK: - Create Google Calendar Event Request
struct GoogleCalendarEventRequest: Codable {
    let summary: String
    let description: String?
    let location: String?
    let start: GoogleCalendarEventTime
    let end: GoogleCalendarEventTime
    let attendees: [GoogleCalendarAttendeeRequest]?
}

struct GoogleCalendarEventTime: Codable {
    let dateTime: String
    let timeZone: String
}

struct GoogleCalendarAttendeeRequest: Codable {
    let email: String
}

struct SimplePracticeTokenResponse: Codable {
    let accessToken: String
    let expiresIn: Int
    let tokenType: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case expiresIn = "expires_in"
        case tokenType = "token_type"
    }
}

// MARK: - Calendar Event
struct CalendarEvent: Codable, Identifiable {
    let id: String
    let title: String
    let startTime: Date
    let endTime: Date
    let location: String?
    let description: String?
    let attendees: [String]?
    let source: CalendarSource

    enum CalendarSource: String, Codable {
        case google
        case simplePractice
        case therapyFlow
    }
}
