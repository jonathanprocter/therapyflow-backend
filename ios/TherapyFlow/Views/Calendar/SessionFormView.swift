import SwiftUI

struct SessionFormView: View {
    var initialDate: Date?
    var editSession: Session?
    let onSave: (Session) -> Void

    @Environment(\.dismiss) private var dismiss

    // Form fields
    @State private var selectedClientId: String?
    @State private var scheduledAt: Date
    @State private var duration: Int = 50
    @State private var sessionType: SessionType = .individual
    @State private var notes = ""

    // Available clients
    @State private var clients: [Client] = []
    @State private var isLoadingClients = true

    // State
    @State private var isLoading = false
    @State private var error: Error?

    private var isEditMode: Bool { editSession != nil }
    private var title: String { isEditMode ? "Edit Session" : "New Session" }

    init(initialDate: Date? = nil, editSession: Session? = nil, onSave: @escaping (Session) -> Void) {
        self.initialDate = initialDate
        self.editSession = editSession
        self.onSave = onSave

        if let session = editSession {
            _selectedClientId = State(initialValue: session.clientId)
            _scheduledAt = State(initialValue: session.scheduledAt)
            _duration = State(initialValue: session.duration)
            _sessionType = State(initialValue: session.sessionType)
            _notes = State(initialValue: session.notes ?? "")
        } else {
            _scheduledAt = State(initialValue: initialDate ?? Date())
        }
    }

    var body: some View {
        Form {
            // Client Selection
            if !isEditMode {
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
                                HStack {
                                    AvatarView(name: client.name, size: 24)
                                    Text(client.name)
                                }
                                .tag(client.id as String?)
                            }
                        }
                    }
                }
            }

            // Date & Time
            Section("Schedule") {
                DatePicker(
                    "Date & Time",
                    selection: $scheduledAt,
                    displayedComponents: [.date, .hourAndMinute]
                )

                Picker("Duration", selection: $duration) {
                    Text("30 minutes").tag(30)
                    Text("45 minutes").tag(45)
                    Text("50 minutes").tag(50)
                    Text("60 minutes").tag(60)
                    Text("90 minutes").tag(90)
                    Text("120 minutes").tag(120)
                }
            }

            // Session Type
            Section("Session Type") {
                Picker("Type", selection: $sessionType) {
                    ForEach(SessionType.allCases, id: \.self) { type in
                        HStack {
                            Image(systemName: type.icon)
                            Text(type.displayName)
                        }
                        .tag(type)
                    }
                }
                .pickerStyle(.menu)
            }

            // Notes
            Section("Notes (Optional)") {
                TextEditor(text: $notes)
                    .frame(minHeight: 100)
                    .overlay(alignment: .topLeading) {
                        if notes.isEmpty {
                            Text("Add session notes...")
                                .foregroundColor(Color.theme.tertiaryText)
                                .padding(.top, 8)
                                .padding(.leading, 4)
                                .allowsHitTesting(false)
                        }
                    }
            }
        }
        .navigationTitle(title)
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
    }

    // MARK: - Validation
    private var isValid: Bool {
        if isEditMode {
            return true
        }
        return selectedClientId != nil
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

    private func save() {
        guard isValid else { return }

        isLoading = true

        Task {
            do {
                let result: Session

                if let editSession = editSession {
                    let input = UpdateSessionInput(
                        scheduledAt: scheduledAt,
                        duration: duration,
                        sessionType: sessionType,
                        notes: notes.isEmpty ? nil : notes
                    )
                    result = try await APIClient.shared.updateSession(id: editSession.id, input)
                } else {
                    guard let clientId = selectedClientId else { return }

                    let input = CreateSessionInput(
                        clientId: clientId,
                        scheduledAt: scheduledAt,
                        duration: duration,
                        sessionType: sessionType,
                        notes: notes.isEmpty ? nil : notes
                    )
                    result = try await APIClient.shared.createSession(input)
                }

                await MainActor.run {
                    isLoading = false
                    onSave(result)
                    dismiss()
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
        SessionFormView { _ in }
    }
}
