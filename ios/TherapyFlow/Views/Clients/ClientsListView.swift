import SwiftUI

struct ClientsListView: View {
    @State private var clients: [Client] = []
    @State private var searchText = ""
    @State private var selectedStatus: ClientStatus?
    @State private var isLoading = true
    @State private var error: Error?
    @State private var showingAddClient = false
    @State private var clientToDelete: Client?
    @State private var showingDeleteConfirmation = false
    @State private var loadTask: Task<Void, Never>?

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var filteredClients: [Client] {
        var result = clients

        if !searchText.isEmpty {
            result = result.filter { client in
                client.name.localizedCaseInsensitiveContains(searchText) ||
                (client.email?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                client.tags.contains { $0.localizedCaseInsensitiveContains(searchText) }
            }
        }

        if let status = selectedStatus {
            result = result.filter { $0.status == status }
        }

        // Sort alphabetically by name
        return result.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Search and filters
            VStack(spacing: 12) {
                // Search bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(Color.theme.secondaryText)

                    TextField("Search clients...", text: $searchText)
                        .autocorrectionDisabled()

                    if !searchText.isEmpty {
                        Button(action: { searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(Color.theme.tertiaryText)
                        }
                    }
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(10)

                // Filter chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(
                            title: "All",
                            isSelected: selectedStatus == nil,
                            action: { selectedStatus = nil }
                        )

                        ForEach(ClientStatus.allCases, id: \.self) { status in
                            FilterChip(
                                title: status.displayName,
                                isSelected: selectedStatus == status,
                                action: { selectedStatus = status }
                            )
                        }
                    }
                }
            }
            .padding()
            .background(Color.theme.background)

            // Content
            if isLoading {
                LoadingView()
            } else if let error = error {
                ErrorView(error: error, onRetry: loadClients)
            } else if filteredClients.isEmpty {
                if clients.isEmpty {
                    NoClientsView(onAdd: { showingAddClient = true })
                } else {
                    NoSearchResultsView(query: searchText)
                }
            } else {
                clientList
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Clients")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingAddClient = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddClient) {
            NavigationStack {
                ClientFormView(mode: .create) { newClient in
                    clients.insert(newClient, at: 0)
                    showingAddClient = false
                }
            }
        }
        .refreshable {
            await loadClientsAsync()
        }
        .onAppear {
            loadTask?.cancel()
            loadTask = Task {
                await loadClientsAsync()
            }
        }
        .onDisappear {
            loadTask?.cancel()
            loadTask = nil
        }
        .alert("Delete Client", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) {
                clientToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let client = clientToDelete {
                    deleteClient(client)
                }
            }
        } message: {
            Text("Are you sure you want to delete \(clientToDelete?.name ?? "this client")? This action cannot be undone.")
        }
    }

    // MARK: - Client List
    private var clientList: some View {
        List {
            ForEach(filteredClients) { client in
                NavigationLink(destination: ClientDetailView(clientId: client.id)) {
                    ClientRowView(client: client)
                }
                .listRowBackground(Color.theme.background)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        clientToDelete = client
                        showingDeleteConfirmation = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.theme.background)
    }

    // MARK: - Data Loading
    private func loadClients() {
        Task {
            await loadClientsAsync()
        }
    }

    private func loadClientsAsync() async {
        guard !Task.isCancelled else { return }

        isLoading = true
        error = nil

        do {
            let fetchedClients = try await APIClient.shared.getClients()

            guard !Task.isCancelled else { return }

            await MainActor.run {
                clients = fetchedClients
                isLoading = false
            }
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch {
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self.error = error
                isLoading = false
            }
        }
    }

    // MARK: - Delete Client
    private func deleteClient(_ client: Client) {
        Task {
            do {
                try await APIClient.shared.deleteClient(id: client.id)
                await MainActor.run {
                    // Remove client from local list with animation
                    withAnimation {
                        clients.removeAll { $0.id == client.id }
                    }
                    clientToDelete = nil
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    clientToDelete = nil
                }
            }
        }
    }
}



#Preview {
    NavigationStack {
        ClientsListView()
    }
}
