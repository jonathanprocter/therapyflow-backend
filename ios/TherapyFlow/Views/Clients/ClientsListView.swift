import SwiftUI

struct ClientsListView: View {
    @State private var clients: [Client] = []
    @State private var searchText = ""
    @State private var selectedStatus: ClientStatus?
    @State private var isLoading = true
    @State private var error: Error?
    @State private var showingAddClient = false

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

        return result
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
        .task {
            await loadClientsAsync()
        }
    }

    // MARK: - Client List
    private var clientList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredClients) { client in
                    NavigationLink(destination: ClientDetailView(clientId: client.id)) {
                        ClientRowView(client: client)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
    }

    // MARK: - Data Loading
    private func loadClients() {
        Task {
            await loadClientsAsync()
        }
    }

    private func loadClientsAsync() async {
        isLoading = true
        error = nil

        do {
            let fetchedClients = try await APIClient.shared.getClients()
            await MainActor.run {
                clients = fetchedClients
                isLoading = false
            }
        } catch {
            await MainActor.run {
                self.error = error
                isLoading = false
            }
        }
    }
}



#Preview {
    NavigationStack {
        ClientsListView()
    }
}
