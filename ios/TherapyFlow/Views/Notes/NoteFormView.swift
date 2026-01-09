import SwiftUI

struct NoteFormView: View {
    enum Mode {
        case create
        case edit(ProgressNote)

        var title: String {
            switch self {
            case .create: return "New Note"
            case .edit: return "Edit Note"
            }
        }
    }

    let mode: Mode
    let onSave: (ProgressNote) -> Void

    @Environment(\.dismiss) private var dismiss

    // Form fields
    @State private var selectedClientId: String?
    @State private var selectedSessionId: String?
    @State private var sessionDate = Date()
    @State private var content = ""
    @State private var riskLevel: RiskLevel = .low
    @State private var progressRating: Int = 5
    @State private var tags: [String] = []
    @State private var newTag = ""

    // Available clients and sessions
    @State private var clients: [Client] = []
    @State private var sessions: [Session] = []
    @State private var isLoadingClients = true
    @State private var isLoadingSessions = false

    // State
    @State private var isLoading = false
    @State private var error: Error?
    
    // AI State
    @State private var showingAIAssist = false
    @State private var isGeneratingDraft = false
    @State private var aiSuggestions: [String] = []
    @State private var aiCustomPrompt = ""
    @State private var aiProcessedContent = ""
    @State private var showingAIPreview = false
    @State private var aiError: String?

    init(mode: Mode, onSave: @escaping (ProgressNote) -> Void) {
        self.mode = mode
        self.onSave = onSave

        // Pre-fill for edit mode
        if case .edit(let note) = mode {
            _selectedClientId = State(initialValue: note.clientId)
            _selectedSessionId = State(initialValue: note.sessionId)
            _sessionDate = State(initialValue: note.sessionDate)
            _content = State(initialValue: note.content ?? "")
            _riskLevel = State(initialValue: note.riskLevel)
            _progressRating = State(initialValue: note.progressRating ?? 5)
            _tags = State(initialValue: note.tags)
        }
    }

    var body: some View {
        Form {
            // Client Selection (only for create)
            if case .create = mode {
                Section("Client") {
                    if isLoadingClients {
                        HStack {
                            ProgressView()
                            Text("Loading clients...")
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    } else {
                        Picker("Select Client", selection: $selectedClientId) {
                            Text("Select a client").tag(nil as String?)

                            ForEach(clients) { client in
                                Text(client.name).tag(client.id as String?)
                            }
                        }
                    }
                }
            }

            // Session Info
            Section("Session Information") {
                DatePicker("Session Date", selection: $sessionDate, displayedComponents: [.date, .hourAndMinute])

                // Link to Calendar Session
                if isLoadingSessions {
                    HStack {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Loading sessions...")
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                } else {
                    Picker("Link to Session", selection: $selectedSessionId) {
                        Text("No linked session").tag(nil as String?)

                        ForEach(filteredSessions) { session in
                            Text(sessionPickerLabel(for: session))
                                .tag(session.id as String?)
                        }
                    }

                    if selectedSessionId != nil {
                        HStack(spacing: 4) {
                            Image(systemName: "link")
                                .font(.caption)
                            Text("Linked to calendar session")
                                .font(.caption)
                        }
                        .foregroundColor(Color.theme.primary)
                    }
                }

                Picker("Risk Level", selection: $riskLevel) {
                    ForEach(RiskLevel.allCases, id: \.self) { level in
                        HStack {
                            RiskIndicator(level: level)
                            Text(level.displayName)
                        }
                        .tag(level)
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Progress Rating")
                        Spacer()
                        Text("\(progressRating)/10")
                            .foregroundColor(Color.theme.primary)
                            .fontWeight(.medium)
                    }

                    Slider(
                        value: Binding(
                            get: { Double(progressRating) },
                            set: { progressRating = Int($0) }
                        ),
                        in: 1...10,
                        step: 1
                    )
                    .tint(Color.theme.primary)
                }
            }

            // Content
            Section(header: HStack {
                Text("Session Notes")
                Spacer()
                Button(action: { showingAIAssist = true }) {
                    Label("AI Assist", systemImage: "wand.and.stars")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.theme.primary.opacity(0.1))
                        .foregroundColor(Color.theme.primary)
                        .cornerRadius(12)
                }
            }) {
                TextEditor(text: $content)
                    .frame(minHeight: 200)
                    .overlay(alignment: .topLeading) {
                        if content.isEmpty {
                            Text("Enter your session notes here...")
                                .foregroundColor(Color.theme.tertiaryText)
                                .padding(.top, 8)
                                .padding(.leading, 4)
                                .allowsHitTesting(false)
                        }
                    }
            }

            // Tags
            Section("Tags") {
                FlowLayout(spacing: 8) {
                    ForEach(tags, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text(tag)
                            Button(action: { removeTag(tag) }) {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.caption)
                            }
                        }
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.theme.primaryLight)
                        .foregroundColor(Color.theme.primaryDark)
                        .cornerRadius(6)
                    }
                }

                HStack {
                    TextField("Add tag", text: $newTag)
                        .textInputAutocapitalization(.never)

                    Button("Add") {
                        addTag()
                    }
                    .disabled(newTag.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .navigationTitle(mode.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
            }

            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    save()
                }
                .disabled(!isValid || isLoading)
            }
        }
        .loadingOverlay(isLoading)
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error?.localizedDescription ?? "")
        }
        .task {
            // Load clients and sessions in parallel for better performance
            async let clientsTask: () = loadClients()
            async let sessionsTask: () = loadSessions()
            _ = await (clientsTask, sessionsTask)
        }
        .onChange(of: selectedClientId) { _, newValue in
            // When client changes, filter sessions for that client
            if newValue != nil {
                // Clear session selection if it doesn't match the new client
                if let sessionId = selectedSessionId,
                   let session = sessions.first(where: { $0.id == sessionId }),
                   session.clientId != newValue {
                    selectedSessionId = nil
                }
            }
        }
        .sheet(isPresented: $showingAIAssist) {
            NavigationStack {
                AIAssistSheetView(
                    content: $content,
                    customPrompt: $aiCustomPrompt,
                    processedContent: $aiProcessedContent,
                    showingPreview: $showingAIPreview,
                    isProcessing: $isGeneratingDraft,
                    aiError: $aiError,
                    aiSuggestions: $aiSuggestions,
                    onClose: { showingAIAssist = false },
                    onGenerateDraft: generateDraft,
                    onGetSuggestions: getSuggestions,
                    onProcessCustomPrompt: processCustomAIPrompt,
                    onApplyChanges: {
                        content = aiProcessedContent
                        showingAIAssist = false
                    }
                )
            }
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - AI Actions
    private func generateDraft() {
        isGeneratingDraft = true
        Task {
            do {
                // In a real app, we might ask for transcript input or pick a file
                // For now, we simulate sending context
                let draft = try await APIClient.shared.getNoteDraft(notes: "Draft based on current session")
                
                await MainActor.run {
                    content = draft
                    isGeneratingDraft = false
                    showingAIAssist = false
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isGeneratingDraft = false
                }
            }
        }
    }

    private func getSuggestions() {
        isGeneratingDraft = true
        Task {
            do {
                let suggestions = try await APIClient.shared.getNoteSuggestions(context: content.isEmpty ? "Initial session" : content)

                await MainActor.run {
                    self.aiSuggestions = suggestions
                    isGeneratingDraft = false
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isGeneratingDraft = false
                }
            }
        }
    }

    /// Process a custom AI prompt to rewrite/transform the note content
    private func processCustomAIPrompt() {
        guard !aiCustomPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            aiError = "Please enter a prompt"
            return
        }
        guard !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            aiError = "Note content is empty"
            return
        }

        isGeneratingDraft = true
        aiError = nil

        Task {
            do {
                let processed = try await processNoteWithAI(content: content, prompt: aiCustomPrompt)

                await MainActor.run {
                    aiProcessedContent = processed
                    showingAIPreview = true
                    isGeneratingDraft = false
                }
            } catch {
                await MainActor.run {
                    aiError = error.localizedDescription
                    isGeneratingDraft = false
                }
            }
        }
    }

    /// Call AI to process/rewrite the note based on user prompt
    private func processNoteWithAI(content: String, prompt: String) async throws -> String {
        // Get API key from IntegrationsService
        let apiKey = IntegrationsService.shared.getAPIKey(for: .anthropic)

        guard !apiKey.isEmpty else {
            throw NSError(domain: "NoteFormView", code: -1, userInfo: [NSLocalizedDescriptionKey: "No AI API key configured. Please add your API key in Settings > Integrations."])
        }

        let systemPrompt = """
        You are an AI assistant helping a therapist edit their clinical progress notes.

        CRITICAL INSTRUCTIONS:
        - Follow the user's editing instructions EXACTLY
        - PRESERVE ALL CONTENT - do not truncate, summarize, or remove any information
        - The final output should be the COMPLETE note with the requested modifications
        - If asked to remove formatting (like markdown), keep ALL the text but remove only the formatting syntax
        - Maintain clinical accuracy and professionalism
        - Do not add commentary or explanations - just output the modified note

        The user will provide their progress note content and instructions for how to modify it.
        """

        let userMessage = """
        Here is my progress note:

        ---
        \(content)
        ---

        Please modify this note according to these instructions:
        \(prompt)

        Remember: Output ONLY the modified note. Do not truncate or summarize. Preserve every word of content while making the requested changes.
        """

        let url = URL(string: "https://api.anthropic.com/v1/messages")!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let body: [String: Any] = [
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 8192,  // Large token limit to preserve full content
            "system": systemPrompt,
            "messages": [
                ["role": "user", "content": userMessage]
            ]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw NSError(domain: "NoteFormView", code: -2, userInfo: [NSLocalizedDescriptionKey: "AI service temporarily unavailable"])
        }

        struct AnthropicResponse: Decodable {
            let content: [ContentBlock]
            struct ContentBlock: Decodable {
                let type: String
                let text: String?
            }
        }

        let anthropicResponse = try JSONDecoder().decode(AnthropicResponse.self, from: data)

        guard let textContent = anthropicResponse.content.first?.text else {
            throw NSError(domain: "NoteFormView", code: -3, userInfo: [NSLocalizedDescriptionKey: "Invalid response from AI"])
        }

        return textContent
    }

    // MARK: - Validation
    private var isValid: Bool {
        if case .create = mode {
            guard selectedClientId != nil else { return false }
        }
        return !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Helper Functions

    private func sessionPickerLabel(for session: Session) -> String {
        let clientName = session.client?.name ?? "Session"
        let dateStr = session.scheduledAt.dateTimeString
        return "\(clientName) • \(dateStr)"
    }

    // MARK: - Computed Properties

    /// Filter sessions based on selected client and date range
    private var filteredSessions: [Session] {
        var result = sessions

        // Filter by client if one is selected
        if let clientId = selectedClientId {
            result = result.filter { $0.clientId == clientId }
        } else if case .edit(let note) = mode {
            // In edit mode, filter by the note's client
            result = result.filter { $0.clientId == note.clientId }
        }

        // Sort by date descending (most recent first)
        return result.sorted { $0.scheduledAt > $1.scheduledAt }
    }

    // MARK: - Actions
    private func loadClients() async {
        do {
            let fetchedClients = try await APIClient.shared.getClients()
            await MainActor.run {
                clients = fetchedClients.filter { $0.status == .active }
                isLoadingClients = false
            }
        } catch {
            await MainActor.run {
                isLoadingClients = false
            }
        }
    }

    private func loadSessions() async {
        isLoadingSessions = true

        do {
            // Get sessions from the past 90 days to present + 30 days
            let fetchedSessions = try await APIClient.shared.getSessions()

            // Hydrate sessions with client data
            let clientMap = Dictionary(uniqueKeysWithValues: clients.map { ($0.id, $0) })
            let hydratedSessions = fetchedSessions.map { session -> Session in
                var updated = session
                if updated.client == nil, let client = clientMap[session.clientId] {
                    updated.client = client
                }
                return updated
            }

            await MainActor.run {
                sessions = hydratedSessions
                isLoadingSessions = false
            }
        } catch {
            await MainActor.run {
                isLoadingSessions = false
            }
        }
    }

    private func addTag() {
        let tag = newTag.trimmingCharacters(in: .whitespaces).lowercased()
        guard !tag.isEmpty, !tags.contains(tag) else { return }
        tags.append(tag)
        newTag = ""
    }

    private func removeTag(_ tag: String) {
        tags.removeAll { $0 == tag }
    }

    private func save() {
        guard isValid else { return }

        isLoading = true

        Task {
            do {
                let result: ProgressNote

                switch mode {
                case .create:
                    guard let clientId = selectedClientId else { return }

                    let input = CreateProgressNoteInput(
                        clientId: clientId,
                        sessionId: selectedSessionId,
                        sessionDate: sessionDate,
                        content: content,
                        tags: tags.isEmpty ? nil : tags,
                        riskLevel: riskLevel,
                        progressRating: progressRating
                    )
                    result = try await APIClient.shared.createProgressNote(input)

                case .edit(let note):
                    let input = UpdateProgressNoteInput(
                        content: content,
                        sessionDate: sessionDate,
                        sessionId: selectedSessionId,
                        tags: tags.isEmpty ? nil : tags,
                        riskLevel: riskLevel,
                        progressRating: progressRating
                    )

                    do {
                        // Try to update existing note
                        result = try await APIClient.shared.updateProgressNote(id: note.id, input)
                    } catch {
                        // If update fails with resource not found, this might be a placeholder note
                        // that doesn't exist in the backend yet - create it instead
                        if isResourceNotFoundError(error) {
                            print("Note not found in backend - creating new note instead")
                            let createInput = CreateProgressNoteInput(
                                clientId: note.clientId,
                                sessionId: selectedSessionId,
                                sessionDate: sessionDate,
                                content: content,
                                tags: tags.isEmpty ? nil : tags,
                                riskLevel: riskLevel,
                                progressRating: progressRating
                            )
                            result = try await APIClient.shared.createProgressNote(createInput)
                        } else {
                            // Re-throw other errors
                            throw error
                        }
                    }
                }

                await MainActor.run {
                    isLoading = false
                    onSave(result)
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isLoading = false
                }
            }
        }
    }

    /// Check if the error indicates the resource was not found
    private func isResourceNotFoundError(_ error: Error) -> Bool {
        let errorMessage = error.localizedDescription.lowercased()
        return errorMessage.contains("not found") ||
               errorMessage.contains("resource not found") ||
               errorMessage.contains("404")
    }
}

#Preview {
    NavigationStack {
        NoteFormView(mode: .create) { _ in }
    }
}

// MARK: - AI Assist Sheet View
struct AIAssistSheetView: View {
    @Binding var content: String
    @Binding var customPrompt: String
    @Binding var processedContent: String
    @Binding var showingPreview: Bool
    @Binding var isProcessing: Bool
    @Binding var aiError: String?
    @Binding var aiSuggestions: [String]

    let onClose: () -> Void
    let onGenerateDraft: () -> Void
    let onGetSuggestions: () -> Void
    let onProcessCustomPrompt: () -> Void
    let onApplyChanges: () -> Void

    // Quick prompt templates
    let quickPrompts = [
        ("Remove Markdown", "Remove all markdown syntax (headers, bold, italic, bullets, etc.) while preserving every word of the note content. Do not truncate or summarize."),
        ("Fix Grammar", "Fix any grammar, spelling, or punctuation errors while preserving the exact content and meaning."),
        ("Professional Tone", "Rewrite to ensure professional clinical language throughout while preserving all content."),
        ("Add SOAP Structure", "Reorganize this note into proper SOAP format (Subjective, Objective, Assessment, Plan) while preserving ALL content."),
        ("Simplify Language", "Simplify any overly complex language while maintaining clinical accuracy and all content.")
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("AI Note Assistant")
                    .font(.headline)
                Spacer()
                Button("Close") { onClose() }
            }
            .padding()
            .background(Color.theme.surface)

            if showingPreview {
                // Preview Mode
                previewView
            } else {
                // Edit Mode
                editView
            }
        }
        .background(Color.theme.background)
    }

    // MARK: - Edit View
    private var editView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Quick Actions Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("Quick Actions")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(Color.theme.secondaryText)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        Button(action: onGenerateDraft) {
                            AIQuickActionCard(icon: "doc.text", title: "Generate Draft", color: .blue)
                        }
                        .disabled(isProcessing)

                        Button(action: onGetSuggestions) {
                            AIQuickActionCard(icon: "lightbulb", title: "Suggestions", color: .orange)
                        }
                        .disabled(isProcessing)
                    }
                }
                .padding(.horizontal)

                Divider()
                    .padding(.horizontal)

                // Quick Prompts Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("Quick Prompts")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(Color.theme.secondaryText)
                        .padding(.horizontal)

                    ForEach(quickPrompts, id: \.0) { name, prompt in
                        Button(action: {
                            customPrompt = prompt
                            onProcessCustomPrompt()
                        }) {
                            HStack {
                                Text(name)
                                    .foregroundColor(Color.theme.primaryText)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.tertiaryText)
                            }
                            .padding()
                            .background(Color.theme.surface)
                            .cornerRadius(10)
                        }
                        .disabled(isProcessing || content.isEmpty)
                        .padding(.horizontal)
                    }
                }

                Divider()
                    .padding(.horizontal)

                // Custom Prompt Section
                VStack(alignment: .leading, spacing: 12) {
                    Text("Custom Instructions")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(Color.theme.secondaryText)

                    TextEditor(text: $customPrompt)
                        .frame(minHeight: 100)
                        .padding(8)
                        .background(Color.theme.surface)
                        .cornerRadius(10)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.theme.border, lineWidth: 1)
                        )
                        .overlay(alignment: .topLeading) {
                            if customPrompt.isEmpty {
                                Text("Enter your instructions... e.g., 'Remove all markdown syntax while preserving every word'")
                                    .foregroundColor(Color.theme.tertiaryText)
                                    .padding(.top, 16)
                                    .padding(.leading, 12)
                                    .allowsHitTesting(false)
                            }
                        }

                    Button(action: onProcessCustomPrompt) {
                        HStack {
                            if isProcessing {
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text("Processing...")
                            } else {
                                Image(systemName: "wand.and.stars")
                                Text("Process with AI")
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.theme.primary)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    }
                    .disabled(isProcessing || customPrompt.isEmpty || content.isEmpty)
                }
                .padding(.horizontal)

                // Error Display
                if let error = aiError {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(8)
                    .padding(.horizontal)
                }

                // Suggestions Display
                if !aiSuggestions.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("AI Suggestions")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(Color.theme.secondaryText)

                        ForEach(aiSuggestions, id: \.self) { suggestion in
                            Button(action: {
                                // Append suggestion to content
                                if content.isEmpty {
                                    processedContent = suggestion
                                } else {
                                    processedContent = content + "\n\n" + suggestion
                                }
                                showingPreview = true
                            }) {
                                Text(suggestion)
                                    .font(.caption)
                                    .foregroundColor(Color.theme.primaryText)
                                    .padding()
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color.theme.surface)
                                    .cornerRadius(8)
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
    }

    // MARK: - Preview View
    private var previewView: some View {
        VStack(spacing: 0) {
            // Preview Header
            HStack {
                Button(action: { showingPreview = false }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("Back")
                    }
                }

                Spacer()

                Text("Preview Changes")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Spacer()

                Button("Apply") {
                    onApplyChanges()
                }
                .fontWeight(.semibold)
                .foregroundColor(Color.theme.primary)
            }
            .padding()
            .background(Color.theme.surfaceSecondary)

            // Content Preview
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Original vs New indicator
                    HStack {
                        Label("Processed Note", systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(Color.theme.success)
                        Spacer()
                        Text("\(processedContent.count) characters")
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                    .padding(.horizontal)

                    // Processed content
                    Text(processedContent)
                        .font(.body)
                        .foregroundColor(Color.theme.primaryText)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.theme.surface)
                        .cornerRadius(10)
                        .padding(.horizontal)

                    // Action buttons
                    VStack(spacing: 12) {
                        Button(action: onApplyChanges) {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Apply Changes to Note")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.theme.primary)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                        }

                        Button(action: { showingPreview = false }) {
                            Text("Discard & Try Again")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.theme.surface)
                                .foregroundColor(Color.theme.secondaryText)
                                .cornerRadius(10)
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
        }
    }
}

// MARK: - AI Quick Action Card
struct AIQuickActionCard: View {
    let icon: String
    let title: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(title)
                .font(.caption)
                .foregroundColor(Color.theme.primaryText)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(10)
    }
}
