import SwiftUI

// MARK: - Notes List View
struct NotesListView: View {
    @State private var notes: [ProgressNote] = []
    @State private var searchText = ""
    @State private var isLoading = true
    @State private var showingAddNote = false
    
    var filteredNotes: [ProgressNote] {
        if searchText.isEmpty {
            return notes
        }
        return notes.filter { $0.content.localizedCaseInsensitiveContains(searchText) }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            SearchBar(text: $searchText, placeholder: "Search notes...")
                .padding()
            
            if isLoading {
                LoadingView(message: "Loading notes...")
            } else if filteredNotes.isEmpty {
                EmptyStateView(
                    icon: "doc.text",
                    title: "No Notes Yet",
                    message: "Create your first progress note.",
                    actionTitle: "New Note",
                    action: { showingAddNote = true }
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(filteredNotes) { note in
                            NavigationLink(destination: NoteDetailView(noteId: note.id)) {
                                NoteCard(note: note)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding()
                }
            }
        }
        .navigationTitle("Progress Notes")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingAddNote = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddNote) {
            NavigationStack {
                AddNoteView()
            }
        }
        .task {
            await loadNotes()
        }
    }
    
    private func loadNotes() async {
        do {
            notes = try await APIClient.shared.getProgressNotes(limit: 50)
            isLoading = false
        } catch {
            print("Error loading notes: \(error)")
            isLoading = false
        }
    }
}

// MARK: - Note Detail View
struct NoteDetailView: View {
    let noteId: String
    @State private var note: ProgressNote?
    @State private var isLoading = true
    
    var body: some View {
        Group {
            if isLoading {
                LoadingView()
            } else if let note = note {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // Risk Level
                        if let riskLevel = note.riskLevel {
                            HStack {
                                Text("Risk Level:")
                                    .font(.subheadline)
                                    .foregroundColor(Color.theme.secondaryText)
                                
                                Text(riskLevel.displayName)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(riskLevel.color.opacity(0.15))
                                    .foregroundColor(riskLevel.color)
                                    .cornerRadius(8)
                            }
                        }
                        
                        // Tags
                        if !note.tags.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Tags")
                                    .font(.headline)
                                
                                FlowLayout(spacing: 8) {
                                    ForEach(note.tags, id: \.self) { tag in
                                        TagBadge(tag: tag)
                                    }
                                }
                            }
                        }
                        
                        Divider()
                        
                        // Content
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Note Content")
                                .font(.headline)
                            
                            Text(note.content)
                                .font(.body)
                                .foregroundColor(Color.theme.primaryText)
                        }
                        
                        Divider()
                        
                        // Metadata
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Created: \(note.createdAt.smartDateTimeString)")
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)
                            
                            if note.updatedAt != note.createdAt {
                                Text("Updated: \(note.updatedAt.smartDateTimeString)")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.secondaryText)
                            }
                        }
                    }
                    .padding()
                }
            } else {
                EmptyStateView(
                    icon: "doc.text.badge.exclamationmark",
                    title: "Note Not Found",
                    message: "Unable to load note details."
                )
            }
        }
        .navigationTitle("Progress Note")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadNote()
        }
    }
    
    private func loadNote() async {
        do {
            note = try await APIClient.shared.request(endpoint: "/api/progress-notes/\(noteId)")
            isLoading = false
        } catch {
            print("Error loading note: \(error)")
            isLoading = false
        }
    }
}

// MARK: - Add Note View
struct AddNoteView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedClientId: String?
    @State private var selectedSessionId: String?
    @State private var content = ""
    @State private var selectedTags: [String] = []
    @State private var selectedRiskLevel: RiskLevel = .none
    @State private var isSubmitting = false
    @State private var error: Error?
    
    var body: some View {
        Form {
            Section("Note Details") {
                // Client selector (simplified - would need actual picker)
                NavigationLink("Select Client") {
                    Text("Client Selection")
                }
                
                // Session selector (simplified)
                NavigationLink("Select Session (Optional)") {
                    Text("Session Selection")
                }
            }
            
            Section("Content") {
                TextEditor(text: $content)
                    .frame(minHeight: 200)
            }
            
            Section("Risk Assessment") {
                Picker("Risk Level", selection: $selectedRiskLevel) {
                    ForEach(RiskLevel.allCases, id: \.self) { level in
                        Text(level.displayName).tag(level)
                    }
                }
            }
            
            Section("Tags") {
                // Simplified tag input
                Text("Add tags...")
                    .foregroundColor(Color.theme.secondaryText)
            }
        }
        .navigationTitle("New Progress Note")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
            }
            
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task {
                        await saveNote()
                    }
                }
                .disabled(content.isEmpty || selectedClientId == nil || isSubmitting)
            }
        }
        .loadingOverlay(isSubmitting)
    }
    
    private func saveNote() async {
        guard let clientId = selectedClientId else { return }
        
        isSubmitting = true
        defer { isSubmitting = false }
        
        struct CreateNoteRequest: Codable {
            let clientId: String
            let sessionId: String?
            let content: String
            let tags: [String]
            let riskLevel: RiskLevel?
            
            enum CodingKeys: String, CodingKey {
                case clientId = "client_id"
                case sessionId = "session_id"
                case content
                case tags
                case riskLevel = "risk_level"
            }
        }
        
        do {
            let request = CreateNoteRequest(
                clientId: clientId,
                sessionId: selectedSessionId,
                content: content,
                tags: selectedTags,
                riskLevel: selectedRiskLevel
            )
            
            let _: ProgressNote = try await APIClient.shared.request(
                endpoint: "/api/progress-notes",
                method: .post,
                body: request
            )
            
            dismiss()
        } catch {
            self.error = error
        }
    }
}

// MARK: - Calendar View
struct CalendarView: View {
    @State private var selectedDate = Date()
    @State private var events: [CalendarEvent] = []
    @State private var isLoading = true
    
    var body: some View {
        VStack {
            // Calendar date picker
            DatePicker(
                "Select Date",
                selection: $selectedDate,
                displayedComponents: .date
            )
            .datePickerStyle(.graphical)
            .padding()
            
            Divider()
            
            // Events for selected date
            if isLoading {
                LoadingView()
            } else if events.isEmpty {
                EmptyStateView(
                    icon: "calendar.badge.exclamationmark",
                    title: "No Events",
                    message: "No events scheduled for this date."
                )
            } else {
                List(events) { event in
                    EventRow(event: event)
                }
            }
        }
        .navigationTitle("Calendar")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: {}) {
                    Image(systemName: "plus")
                }
            }
        }
        .task(id: selectedDate) {
            await loadEvents()
        }
    }
    
    private func loadEvents() async {
        isLoading = true
        do {
            // Load events for selected date
            let calendar = Calendar.current
            let startOfDay = calendar.startOfDay(for: selectedDate)
            let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!
            
            // This would use actual API call with date filtering
            events = []
            isLoading = false
        } catch {
            print("Error loading events: \(error)")
            isLoading = false
        }
    }
}

struct EventRow: View {
    let event: CalendarEvent
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.headline)
                
                Text(formatTimeRange(event.startTime, event.endTime))
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
                
                if let location = event.location {
                    Label(location, systemImage: "location")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
            
            Spacer()
            
            // Source badge
            Text(event.source.rawValue.capitalized)
                .font(.caption2)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(sourceColor(event.source).opacity(0.15))
                .foregroundColor(sourceColor(event.source))
                .cornerRadius(6)
        }
        .padding(.vertical, 4)
    }
    
    private func formatTimeRange(_ start: Date, _ end: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return "\(formatter.string(from: start)) - \(formatter.string(from: end))"
    }
    
    private func sourceColor(_ source: CalendarEvent.EventSource) -> Color {
        switch source {
        case .therapyFlow: return Color.theme.primary
        case .google: return .blue
        case .simplePractice: return .green
        }
    }
}

// MARK: - Documents List View
struct DocumentsListView: View {
    @State private var documents: [Document] = []
    @State private var searchText = ""
    @State private var isLoading = true
    
    var filteredDocuments: [Document] {
        if searchText.isEmpty {
            return documents
        }
        return documents.filter { 
            $0.filename.localizedCaseInsensitiveContains(searchText) ||
            $0.clientName?.localizedCaseInsensitiveContains(searchText) == true
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            SearchBar(text: $searchText, placeholder: "Search documents...")
                .padding()
            
            if isLoading {
                LoadingView(message: "Loading documents...")
            } else if filteredDocuments.isEmpty {
                EmptyStateView(
                    icon: "folder",
                    title: "No Documents",
                    message: "Upload documents to get started."
                )
            } else {
                List(filteredDocuments) { document in
                    NavigationLink(destination: DocumentDetailView(documentId: document.id)) {
                        DocumentRow(document: document)
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Documents")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: {}) {
                    Image(systemName: "plus")
                }
            }
        }
        .task {
            await loadDocuments()
        }
    }
    
    private func loadDocuments() async {
        do {
            documents = try await APIClient.shared.request(endpoint: "/api/documents")
            isLoading = false
        } catch {
            print("Error loading documents: \(error)")
            isLoading = false
        }
    }
}

struct DocumentDetailView: View {
    let documentId: String
    
    var body: some View {
        Text("Document Detail View")
            .navigationTitle("Document")
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        NotesListView()
    }
}
