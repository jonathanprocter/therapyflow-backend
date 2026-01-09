import Foundation

// MARK: - API Client
class APIClient {
    static let shared = APIClient()
    
    private let baseURL = "https://api.therapyflow.app" // Replace with your actual API URL
    private let session: URLSession
    
    enum HTTPMethod: String {
        case get = "GET"
        case post = "POST"
        case put = "PUT"
        case patch = "PATCH"
        case delete = "DELETE"
    }
    
    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 300
        session = URLSession(configuration: configuration)
    }
    
    // MARK: - Generic Request
    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        queryParameters: [String: String]? = nil,
        body: (any Encodable)? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        // Build URL
        var urlComponents = URLComponents(string: baseURL + endpoint)!
        
        if let queryParameters = queryParameters {
            urlComponents.queryItems = queryParameters.map { 
                URLQueryItem(name: $0.key, value: $0.value)
            }
        }
        
        guard let url = urlComponents.url else {
            throw APIError.invalidURL
        }
        
        // Build request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        
        // Add headers
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        // Add auth token
        if let token = KeychainService.shared.getAuthToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Add custom headers
        headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }
        
        // Add body
        if let body = body {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            request.httpBody = try encoder.encode(body)
        }
        
        // Perform request
        let (data, response) = try await session.data(for: request)
        
        // Check response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            // Try to decode error
            if let errorResponse = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw APIError.serverError(errorResponse.message)
            }
            throw APIError.httpError(httpResponse.statusCode)
        }
        
        // Decode response
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        // Handle empty responses
        if T.self == EmptyResponse.self {
            return EmptyResponse() as! T
        }
        
        // Handle raw Data responses
        if T.self == Data.self {
            return data as! T
        }
        
        return try decoder.decode(T.self, from: data)
    }
    
    // MARK: - Convenience Methods
    
    func getSessions(clientId: String? = nil, upcoming: Bool = false, limit: Int? = nil) async throws -> [Session] {
        var params: [String: String] = [:]
        if let clientId = clientId { params["client_id"] = clientId }
        if upcoming { params["upcoming"] = "true" }
        if let limit = limit { params["limit"] = String(limit) }
        
        return try await request(endpoint: "/api/sessions", queryParameters: params)
    }
    
    func createSession(_ session: CreateSessionRequest) async throws -> Session {
        return try await request(
            endpoint: "/api/sessions",
            method: .post,
            body: session
        )
    }
    
    func updateSession(id: String, _ update: UpdateSessionRequest) async throws -> Session {
        return try await request(
            endpoint: "/api/sessions/\(id)",
            method: .patch,
            body: update
        )
    }
    
    func deleteSession(id: String) async throws {
        let _: EmptyResponse = try await request(
            endpoint: "/api/sessions/\(id)",
            method: .delete
        )
    }
}

// MARK: - API Error
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int)
    case serverError(String)
    case decodingError
    case networkError(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .serverError(let message):
            return message
        case .decodingError:
            return "Failed to decode response"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

// MARK: - API Error Response
struct APIErrorResponse: Codable {
    let message: String
    let code: String?
}

// MARK: - Request Models
struct CreateSessionRequest: Codable {
    let clientId: String
    let scheduledAt: Date
    let duration: Int
    let sessionType: SessionType
    var notes: String?
    
    enum CodingKeys: String, CodingKey {
        case clientId = "client_id"
        case scheduledAt = "scheduled_at"
        case duration
        case sessionType = "session_type"
        case notes
    }
}

struct UpdateSessionRequest: Codable {
    var scheduledAt: Date?
    var duration: Int?
    var sessionType: SessionType?
    var status: SessionStatus?
    var notes: String?
    
    enum CodingKeys: String, CodingKey {
        case scheduledAt = "scheduled_at"
        case duration
        case sessionType = "session_type"
        case status
        case notes
    }
}
