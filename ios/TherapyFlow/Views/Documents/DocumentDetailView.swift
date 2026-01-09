import SwiftUI

struct DocumentDetailView: View {
    let documentId: String

    @State private var document: Document?
    @State private var isLoading = true
    @State private var error: Error?
    @State private var analysis: AIDocumentProcessor.DocumentAnalysis?
    @State private var isAnalyzing = false
    @State private var analysisError: Error?
    @State private var selectedTab = 0

    // Matching and linking state
    @State private var matchResult: DocumentCalendarMatcher.MatchResult?
    @State private var clients: [Client] = []
    @State private var calendarEvents: [SyncedCalendarEvent] = []
    @State private var showingLinkSheet = false
    @State private var showingCreateNoteSheet = false
    @State private var isSaving = false
    @State private var saveError: Error?
    @State private var showingSaveSuccess = false

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        Group {
            if isLoading {
                LoadingView()
            } else if let error = error {
                ErrorView(error: error, onRetry: loadDocument)
            } else if let document = document {
                DocumentContentView(
                    document: document,
                    isRegular: horizontalSizeClass == .regular,
                    selectedTab: $selectedTab,
                    analysis: analysis,
                    isAnalyzing: isAnalyzing,
                    analysisError: analysisError,
                    runAnalysis: runAnalysis,
                    applyTags: applyTags
                )
            }
        }
        .navigationTitle(document?.filename ?? "Document")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if analysis != nil {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button(action: { showingLinkSheet = true }) {
                            Label("Link to Appointment", systemImage: "link")
                        }

                        Button(action: { showingCreateNoteSheet = true }) {
                            Label("Create Progress Note", systemImage: "doc.badge.plus")
                        }

                        if document?.status == .pending {
                            Button(action: markAsComplete) {
                                Label("Mark as Complete", systemImage: "checkmark.circle")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .disabled(isSaving)
                }
            }
        }
        .sheet(isPresented: $showingLinkSheet) {
            NavigationStack {
                LinkDocumentSheet(
                    document: document,
                    analysis: analysis,
                    matchResult: matchResult,
                    clients: clients,
                    onLink: linkToAppointment
                )
            }
        }
        .sheet(isPresented: $showingCreateNoteSheet) {
            NavigationStack {
                CreateNoteFromDocumentSheet(
                    document: document,
                    analysis: analysis,
                    matchResult: matchResult,
                    clients: clients,
                    onCreate: createProgressNote
                )
            }
        }
        .alert("Saved", isPresented: $showingSaveSuccess) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Document has been processed and saved successfully.")
        }
        .task {
            await loadDocumentAsync()
            await loadMatchingDataAsync()
        }
    }

    // MARK: - Actions

    private func runAnalysis() {
        guard let content = document?.extractedText else { return }

        isAnalyzing = true
        analysisError = nil

        Task {
            do {
                let result = try await AIDocumentProcessor.shared.analyzeDocument(
                    content: content,
                    fileName: document?.filename
                )
                await MainActor.run {
                    analysis = result
                    isAnalyzing = false
                }

                // Run matching after analysis
                await runMatchingAsync(analysis: result)

                // Auto-save analysis to backend
                await saveAnalysisToBackend(result)
            } catch {
                await MainActor.run {
                    analysisError = error
                    isAnalyzing = false
                }
            }
        }
    }

    private func runMatchingAsync(analysis: AIDocumentProcessor.DocumentAnalysis) async {
        guard let doc = document else { return }

        let syncedEvents = calendarEvents.isEmpty ? [] : calendarEvents

        let result = await DocumentCalendarMatcher.shared.matchDocument(
            documentId: doc.id,
            fileName: doc.fileName,
            analysis: analysis,
            calendarEvents: syncedEvents,
            clients: clients
        )

        await MainActor.run {
            matchResult = result
        }
    }

    private func saveAnalysisToBackend(_ analysis: AIDocumentProcessor.DocumentAnalysis) async {
        guard let doc = document else { return }

        do {
            // Prepare analysis data for API
            let analysisData = DocumentAnalysisInput(
                summary: analysis.summary,
                themes: analysis.themes,
                clientMentions: analysis.clientMentions,
                primaryClientName: analysis.primaryClientName,
                keyInsights: analysis.keyInsights,
                documentType: analysis.documentType.rawValue,
                confidenceScore: analysis.confidenceScore,
                extractedDates: analysis.extractedDates,
                actionItems: analysis.actionItems,
                emotionalTone: analysis.emotionalTone.rawValue,
                clinicalIndicators: analysis.clinicalIndicators.map {
                    ClinicalIndicatorInput(
                        indicator: $0.indicator,
                        severity: $0.severity.rawValue,
                        context: $0.context
                    )
                }
            )

            let input = UpdateDocumentInput(
                tags: analysis.suggestedTags,
                documentType: analysis.documentType.rawValue,
                aiAnalysis: analysisData,
                linkedClientId: matchResult?.matchedClient?.client.id
            )

            _ = try await APIClient.shared.updateDocument(id: doc.id, input)

            // Reload document to reflect changes
            await loadDocumentAsync()
        } catch {
            print("Failed to save analysis to backend: \(error)")
        }
    }

    private func applyTags(_ tags: [String]) {
        guard let doc = document else { return }

        Task {
            do {
                let input = UpdateDocumentInput(tags: (doc.tags + tags).uniqued())
                _ = try await APIClient.shared.updateDocument(id: doc.id, input)
                await loadDocumentAsync()
            } catch {
                print("Failed to apply tags: \(error)")
            }
        }
    }

    private func markAsComplete() {
        guard let doc = document else { return }

        isSaving = true

        Task {
            do {
                let input = UpdateDocumentInput(status: "processed")
                _ = try await APIClient.shared.updateDocument(id: doc.id, input)
                await loadDocumentAsync()
                await MainActor.run {
                    isSaving = false
                    showingSaveSuccess = true
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    saveError = error
                }
            }
        }
    }

    private func linkToAppointment(clientId: String, sessionDate: Date?) {
        guard let doc = document else { return }

        isSaving = true
        showingLinkSheet = false

        Task {
            do {
                let input = UpdateDocumentInput(
                    status: "processed",
                    linkedClientId: clientId
                )
                _ = try await APIClient.shared.updateDocument(id: doc.id, input)
                await loadDocumentAsync()
                await MainActor.run {
                    isSaving = false
                    showingSaveSuccess = true
                    // Notify the list view to refresh
                    NotificationCenter.default.post(name: .documentLinked, object: nil)
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    saveError = error
                }
            }
        }
    }

    private func createProgressNote(clientId: String, sessionDate: Date) {
        guard document != nil else { return }

        isSaving = true
        showingCreateNoteSheet = false

        Task {
            do {
                let input = CreateNoteFromDocumentInput(
                    clientId: clientId,
                    sessionDate: sessionDate,
                    aiAnalysis: analysis
                )
                _ = try await APIClient.shared.createNoteFromDocument(documentId: documentId, input: input)
                await loadDocumentAsync()
                await MainActor.run {
                    isSaving = false
                    showingSaveSuccess = true
                    // Notify the list view to refresh
                    NotificationCenter.default.post(name: .documentLinked, object: nil)
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    saveError = error
                }
            }
        }
    }

    private func loadDocument() {
        Task {
            await loadDocumentAsync()
        }
    }

    private func loadDocumentAsync() async {
        isLoading = true
        error = nil

        do {
            let fetchedDocument = try await APIClient.shared.getDocument(id: documentId)
            await MainActor.run {
                document = fetchedDocument
                isLoading = false
            }
        } catch {
            await MainActor.run {
                self.error = error
                isLoading = false
            }
        }
    }

    private func loadMatchingDataAsync() async {
        // Load clients and calendar events for matching
        do {
            async let clientsTask = APIClient.shared.getClients()
            async let eventsTask = loadCalendarEvents()

            let (loadedClients, loadedEvents) = try await (clientsTask, eventsTask)

            await MainActor.run {
                clients = loadedClients
                calendarEvents = loadedEvents
            }
        } catch {
            print("Failed to load matching data: \(error)")
        }
    }

    private func loadCalendarEvents() async throws -> [SyncedCalendarEvent] {
        // Try to load synced calendar events from local storage
        // These would have been synced from Google Calendar
        return await SyncService.shared.getCachedCalendarEvents()
    }
}

// MARK: - Link Document Sheet

struct LinkDocumentSheet: View {
    let document: Document?
    let analysis: AIDocumentProcessor.DocumentAnalysis?
    let matchResult: DocumentCalendarMatcher.MatchResult?
    let clients: [Client]
    let onLink: (String, Date?) -> Void

    @State private var selectedClientId: String = ""
    @State private var sessionDate: Date = Date()

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            if let match = matchResult, let client = match.matchedClient {
                Section("Suggested Match") {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(client.client.name)
                                .font(.headline)
                            Text("Confidence: \(Int(client.confidence * 100))%")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedClientId = client.client.id
                    }
                }
            }

            Section("Select Client") {
                Picker("Client", selection: $selectedClientId) {
                    Text("Select a client").tag("")
                    ForEach(clients) { client in
                        Text(client.name).tag(client.id)
                    }
                }
            }

            if let dates = analysis?.extractedDates, !dates.isEmpty {
                Section("Extracted Dates") {
                    ForEach(dates, id: \.self) { dateStr in
                        Button(action: {
                            if let date = parseFlexibleDate(dateStr) {
                                sessionDate = date
                            }
                        }) {
                            HStack {
                                Text(dateStr)
                                Spacer()
                                if let date = parseFlexibleDate(dateStr),
                                   Calendar.current.isDate(date, inSameDayAs: sessionDate) {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.blue)
                                }
                            }
                        }
                    }
                }
            }

            Section("Session Date") {
                DatePicker("Date", selection: $sessionDate, displayedComponents: .date)
            }
        }
        .navigationTitle("Link to Appointment")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Link") {
                    onLink(selectedClientId, sessionDate)
                }
                .disabled(selectedClientId.isEmpty)
            }
        }
        .onAppear {
            if let client = matchResult?.matchedClient?.client {
                selectedClientId = client.id
            }
            if let date = matchResult?.bestSessionDate {
                sessionDate = date
            }
        }
    }
}

// MARK: - Create Note Sheet

struct CreateNoteFromDocumentSheet: View {
    let document: Document?
    let analysis: AIDocumentProcessor.DocumentAnalysis?
    let matchResult: DocumentCalendarMatcher.MatchResult?
    let clients: [Client]
    let onCreate: (String, Date) -> Void

    @State private var selectedClientId: String = ""
    @State private var sessionDate: Date = Date()

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            if let match = matchResult, let client = match.matchedClient {
                Section("Suggested Match") {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(client.client.name)
                                .font(.headline)
                            Text("Match type: \(matchTypeDescription(client.matchType))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Button("Use") {
                            selectedClientId = client.client.id
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }

            Section("Select Client") {
                Picker("Client", selection: $selectedClientId) {
                    Text("Select a client").tag("")
                    ForEach(clients) { client in
                        Text(client.name).tag(client.id)
                    }
                }
            }

            Section("Session Date") {
                DatePicker("Date", selection: $sessionDate, displayedComponents: .date)

                if let dates = analysis?.extractedDates, !dates.isEmpty {
                    Text("Extracted dates from document:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    ForEach(dates, id: \.self) { dateStr in
                        Button(dateStr) {
                            if let date = parseFlexibleDate(dateStr) {
                                sessionDate = date
                            }
                        }
                        .font(.caption)
                    }
                }
            }

            if let analysis = analysis {
                Section("Preview") {
                    Text(analysis.summary)
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if !analysis.themes.isEmpty {
                        Text("Themes: \(analysis.themes.joined(separator: ", "))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Create Progress Note")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Create") {
                    onCreate(selectedClientId, sessionDate)
                }
                .disabled(selectedClientId.isEmpty)
            }
        }
        .onAppear {
            if let client = matchResult?.matchedClient?.client {
                selectedClientId = client.id
            }
            if let date = matchResult?.bestSessionDate {
                sessionDate = date
            }
        }
    }

    private func matchTypeDescription(_ type: DocumentCalendarMatcher.ClientMatchType) -> String {
        switch type {
        case .exactName: return "Exact name match"
        case .partialName: return "Partial name match"
        case .calendarAttendee: return "Calendar attendee"
        case .inferred: return "Inferred"
        }
    }
}

// MARK: - API Extensions

struct UpdateDocumentInput: Encodable {
    var status: String?
    var tags: [String]?
    var documentType: String?
    var aiAnalysis: DocumentAnalysisInput?
    var linkedSessionId: String?
    var linkedClientId: String?
}

struct DocumentAnalysisInput: Encodable {
    let summary: String
    let themes: [String]
    let clientMentions: [String]
    let primaryClientName: String?
    let keyInsights: [String]
    let documentType: String
    let confidenceScore: Double
    let extractedDates: [String]
    let actionItems: [String]
    let emotionalTone: String
    let clinicalIndicators: [ClinicalIndicatorInput]
}

struct ClinicalIndicatorInput: Encodable {
    let indicator: String
    let severity: String
    let context: String
}

struct CreateNoteFromDocumentInput: Encodable {
    let clientId: String
    let sessionDate: Date
    let aiAnalysis: AIDocumentProcessor.DocumentAnalysis?

    enum CodingKeys: String, CodingKey {
        case clientId = "clientId"
        case sessionDate = "sessionDate"
        case aiAnalysis = "aiAnalysis"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(clientId, forKey: .clientId)

        let formatter = ISO8601DateFormatter()
        try container.encode(formatter.string(from: sessionDate), forKey: .sessionDate)

        if let analysis = aiAnalysis {
            let analysisDict: [String: Any] = [
                "summary": analysis.summary,
                "themes": analysis.themes,
                "keyInsights": analysis.keyInsights,
                "actionItems": analysis.actionItems,
                "clinicalIndicators": analysis.clinicalIndicators.map { [
                    "indicator": $0.indicator,
                    "severity": $0.severity.rawValue,
                    "context": $0.context
                ]}
            ]
            // Encode as nested structure
            let data = try JSONSerialization.data(withJSONObject: analysisDict)
            let json = try JSONDecoder().decode([String: AnyCodable].self, from: data)
            try container.encode(json, forKey: .aiAnalysis)
        }
    }
}

struct CreateNoteFromDocumentResponse: Decodable {
    let success: Bool
    let progressNote: ProgressNote?
    let message: String?
}

extension APIClient {
    func getDocument(id: String) async throws -> Document {
        try await request(endpoint: "/api/documents/\(id)")
    }

    func updateDocument(id: String, _ input: UpdateDocumentInput) async throws -> Document {
        try await request(endpoint: "/api/documents/\(id)", method: .patch, body: input)
    }

    func createNoteFromDocument(documentId: String, input: CreateNoteFromDocumentInput) async throws -> CreateNoteFromDocumentResponse {
        try await request(endpoint: "/api/documents/\(documentId)/create-note", method: .post, body: input)
    }
}

// Helper to remove duplicates from array
extension Array where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}

// AnyCodable helper for encoding dynamic JSON
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let string as String:
            try container.encode(string)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let bool as Bool:
            try container.encode(bool)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }
}

#Preview {
    NavigationStack {
        DocumentDetailView(documentId: "test-id")
    }
}
