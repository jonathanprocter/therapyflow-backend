import SwiftUI

struct ClientDetailView: View {
    let clientId: String

    @State private var client: Client?
    @State private var sessions: [Session] = []
    @State private var notes: [ProgressNote] = []
    @State private var isLoading = true
    @State private var error: Error?
    @State private var showingEditSheet = false
    @State private var showingDeleteConfirmation = false
    @State private var showingStatusChangeSheet = false
    @State private var isDeleting = false
    @State private var isUpdatingStatus = false
    @State private var loadTask: Task<Void, Never>?

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            if isLoading {
                LoadingView()
                    .frame(height: 300)
            } else if let error = error {
                ErrorView(error: error, onRetry: loadData)
            } else if let client = client {
                VStack(spacing: 24) {
                    // Header
                    ClientHeaderSection(client: client)

                    // Content - adaptive layout
                    if horizontalSizeClass == .regular {
                        HStack(alignment: .top, spacing: 24) {
                            VStack(spacing: 24) {
                                ClientContactInfoSection(client: client)
                                ClientClinicalToolsSection(client: client)
                                ClientTagsSection(client: client)
                            }
                            .frame(maxWidth: .infinity)

                            VStack(spacing: 24) {
                                ClientSessionsSection(sessions: sessions)
                                ClientNotesSection(notes: notes)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    } else {
                        ClientContactInfoSection(client: client)
                        ClientClinicalToolsSection(client: client)
                        ClientTagsSection(client: client)
                        ClientSessionsSection(sessions: sessions)
                        ClientNotesSection(notes: notes)
                    }
                }
                .padding()
            }
        }
        .background(Color.theme.background)
        .navigationTitle(client?.name ?? "Client")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button(action: { showingEditSheet = true }) {
                        Label("Edit", systemImage: "pencil")
                    }

                    Button(action: {}) {
                        Label("Schedule Session", systemImage: "calendar.badge.plus")
                    }

                    Button(action: {}) {
                        Label("Create Note", systemImage: "doc.badge.plus")
                    }

                    Divider()

                    // Status change menu
                    Menu {
                        ForEach(ClientStatus.allCases.filter { $0 != .unknown }, id: \.self) { status in
                            Button(action: { updateClientStatus(to: status) }) {
                                HStack {
                                    Text(status.displayName)
                                    if client?.status == status {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                            .disabled(client?.status == status)
                        }
                    } label: {
                        Label("Change Status", systemImage: "person.crop.circle.badge.checkmark")
                    }

                    Divider()

                    Button(role: .destructive, action: { showingDeleteConfirmation = true }) {
                        Label("Delete Client", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .disabled(isDeleting || isUpdatingStatus)
            }
        }
        .alert("Delete Client", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                deleteClient()
            }
        } message: {
            Text("Are you sure you want to delete \(client?.name ?? "this client")? This action cannot be undone and will also delete all associated sessions and notes.")
        }
        .overlay {
            if isDeleting {
                ClientDeleteOverlay()
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            if let client = client {
                NavigationStack {
                    ClientFormView(mode: .edit(client)) { updatedClient in
                        self.client = updatedClient
                        showingEditSheet = false
                    }
                }
            }
        }
        .onAppear {
            loadTask?.cancel()
            loadTask = Task {
                await loadDataAsync()
            }
        }
        .onDisappear {
            loadTask?.cancel()
            loadTask = nil
        }
    }

    // MARK: - Data Loading
    private func loadData() {
        Task {
            await loadDataAsync()
        }
    }

    private func loadDataAsync() async {
        guard !Task.isCancelled else { return }

        isLoading = true
        error = nil

        // Try to get data from multiple sources with fallbacks
        do {
            // First try to get the client directly
            let fetchedClient: Client
            do {
                fetchedClient = try await APIClient.shared.getClient(id: clientId)
            } catch {
                // Fallback: Try to find client in the full clients list
                print("Direct client fetch failed: \(error.localizedDescription), trying clients list")
                let allClients = try await APIClient.shared.getClients()
                guard let foundClient = allClients.first(where: { $0.id == clientId }) else {
                    throw ClientDetailError.clientNotFound(clientId)
                }
                fetchedClient = foundClient
            }

            // Now fetch sessions and notes (these may fail independently)
            var fetchedSessions: [Session] = []
            var fetchedNotes: [ProgressNote] = []

            // Try to get sessions
            do {
                fetchedSessions = try await APIClient.shared.getSessions(clientId: clientId)
            } catch {
                print("Failed to fetch sessions for client \(clientId): \(error.localizedDescription)")
                // Continue without sessions - not critical
            }

            // Try to get notes
            do {
                fetchedNotes = try await APIClient.shared.getProgressNotes(clientId: clientId)
            } catch {
                print("Failed to fetch notes for client \(clientId): \(error.localizedDescription)")
                // Continue without notes - not critical
            }

            // Hydrate notes with client data to ensure name is always available
            let hydratedNotes = fetchedNotes.map { note -> ProgressNote in
                var updated = note
                if updated.client == nil {
                    updated.client = fetchedClient
                }
                if updated.clientName == nil {
                    updated.clientName = fetchedClient.name
                }
                return updated
            }

            // Hydrate sessions with client data
            let hydratedSessions = fetchedSessions.map { session -> Session in
                var updated = session
                if updated.client == nil {
                    updated.client = fetchedClient
                }
                return updated
            }

            // Check if cancelled before updating UI
            guard !Task.isCancelled else { return }

            await MainActor.run {
                client = fetchedClient
                sessions = hydratedSessions
                notes = hydratedNotes
                isLoading = false
            }

            // Update AI assistant context with the loaded client
            ContextualAIAssistant.shared.updateContext(.clientDetail, client: fetchedClient)

        } catch is CancellationError {
            // Silently handle task cancellation
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            // Silently handle URL cancelled errors
            return
        } catch {
            guard !Task.isCancelled else { return }
            print("Failed to load client detail: \(error.localizedDescription)")
            await MainActor.run {
                self.error = error
                isLoading = false
            }
        }
    }

    // Custom error for client detail
    enum ClientDetailError: LocalizedError {
        case clientNotFound(String)

        var errorDescription: String? {
            switch self {
            case .clientNotFound(let id):
                return "Client not found. The client may have been deleted or the ID (\(id.prefix(8))...) is invalid."
            }
        }
    }

    // MARK: - Update Client Status
    private func updateClientStatus(to newStatus: ClientStatus) {
        guard let currentClient = client else { return }
        guard currentClient.status != newStatus else { return }

        isUpdatingStatus = true

        Task {
            do {
                // Include client_id in the body as some backends require it
                let input = UpdateClientInput(clientId: currentClient.id, status: newStatus)
                let updatedClient = try await APIClient.shared.updateClient(id: currentClient.id, input)
                await MainActor.run {
                    self.client = updatedClient
                    isUpdatingStatus = false
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isUpdatingStatus = false
                }
            }
        }
    }

    // MARK: - Delete Client
    private func deleteClient() {
        Task {
            await deleteClientAsync()
        }
    }

    private func deleteClientAsync() async {
        isDeleting = true

        do {
            try await APIClient.shared.deleteClient(id: clientId)
            await MainActor.run {
                isDeleting = false
                dismiss()
            }
        } catch {
            await MainActor.run {
                isDeleting = false
                self.error = error
            }
        }
    }
}

#Preview {
    NavigationStack {
        ClientDetailView(clientId: "test-id")
    }
}
