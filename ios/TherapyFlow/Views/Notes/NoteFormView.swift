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
    @State private var sessionDate = Date()
    @State private var content = ""
    @State private var riskLevel: RiskLevel = .low
    @State private var progressRating: Int = 5
    @State private var tags: [String] = []
    @State private var newTag = ""

    // Available clients
    @State private var clients: [Client] = []
    @State private var isLoadingClients = true

    // State
    @State private var isLoading = false
    @State private var error: Error?
    
    // AI State
    @State private var showingAIAssist = false
    @State private var isGeneratingDraft = false
    @State private var aiSuggestions: [String] = []

    init(mode: Mode, onSave: @escaping (ProgressNote) -> Void) {
        self.mode = mode
        self.onSave = onSave

        // Pre-fill for edit mode
        if case .edit(let note) = mode {
            _selectedClientId = State(initialValue: note.clientId)
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
            await loadClients()
        }
        .sheet(isPresented: $showingAIAssist) {
            NavigationStack {
                VStack(spacing: 20) {
                    Text("AI Assistant")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    if isGeneratingDraft {
                        VStack {
                            ProgressView()
                            Text("Generating draft...")
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        List {
                            Section("Quick Actions") {
                                Button(action: generateDraft) {
                                    Label("Generate Draft from Transcript", systemImage: "doc.text")
                                }
                                
                                Button(action: getSuggestions) {
                                    Label("Get Content Suggestions", systemImage: "lightbulb")
                                }
                            }
                            
                            if !aiSuggestions.isEmpty {
                                Section("Suggestions") {
                                    ForEach(aiSuggestions, id: \.self) { suggestion in
                                        Button(action: {
                                            content += (content.isEmpty ? "" : "\n\n") + suggestion
                                            showingAIAssist = false
                                        }) {
                                            Text(suggestion)
                                                .foregroundColor(.primary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close") { showingAIAssist = false }
                    }
                }
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

    // MARK: - Validation
    private var isValid: Bool {
        if case .create = mode {
            guard selectedClientId != nil else { return false }
        }
        return !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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
                        tags: tags.isEmpty ? nil : tags,
                        riskLevel: riskLevel,
                        progressRating: progressRating
                    )
                    result = try await APIClient.shared.updateProgressNote(id: note.id, input)
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
}

#Preview {
    NavigationStack {
        NoteFormView(mode: .create) { _ in }
    }
}
