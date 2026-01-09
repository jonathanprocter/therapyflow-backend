import SwiftUI

// MARK: - Clients List View
struct ClientsListView: View {
    @State private var clients: [Client] = []
    @State private var searchText = ""
    @State private var isLoading = true
    @State private var showingAddClient = false
    
    var filteredClients: [Client] {
        if searchText.isEmpty {
            return clients
        }
        return clients.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            SearchBar(text: $searchText, placeholder: "Search clients...")
                .padding()
            
            if isLoading {
                LoadingView(message: "Loading clients...")
            } else if filteredClients.isEmpty {
                if searchText.isEmpty {
                    EmptyStateView(
                        icon: "person.2",
                        title: "No Clients Yet",
                        message: "Add your first client to get started with TherapyFlow.",
                        actionTitle: "Add Client",
                        action: { showingAddClient = true }
                    )
                } else {
                    EmptyStateView(
                        icon: "magnifyingglass",
                        title: "No Results",
                        message: "No clients found matching '\(searchText)'"
                    )
                }
            } else {
                List(filteredClients) { client in
                    NavigationLink(destination: ClientDetailView(clientId: client.id)) {
                        ClientRow(client: client)
                    }
                }
                .listStyle(.plain)
            }
        }
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
                AddClientView()
            }
        }
        .task {
            await loadClients()
        }
    }
    
    private func loadClients() async {
        do {
            clients = try await APIClient.shared.request(endpoint: "/api/clients")
            isLoading = false
        } catch {
            print("Error loading clients: \(error)")
            isLoading = false
        }
    }
}

// MARK: - Client Detail View
struct ClientDetailView: View {
    let clientId: String
    @State private var client: Client?
    @State private var sessions: [Session] = []
    @State private var isLoading = true
    
    var body: some View {
        Group {
            if isLoading {
                LoadingView()
            } else if let client = client {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // Client Header
                        ClientHeaderCard(client: client)
                        
                        // Quick Actions
                        QuickActionsSection(clientId: clientId)
                        
                        // Recent Sessions
                        if !sessions.isEmpty {
                            RecentSessionsSection(sessions: sessions)
                        }
                    }
                    .padding()
                }
            } else {
                EmptyStateView(
                    icon: "person.crop.circle.badge.exclamationmark",
                    title: "Client Not Found",
                    message: "Unable to load client details."
                )
            }
        }
        .navigationTitle(client?.name ?? "Client")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadClientDetails()
        }
    }
    
    private func loadClientDetails() async {
        do {
            client = try await APIClient.shared.request(endpoint: "/api/clients/\(clientId)")
            sessions = try await APIClient.shared.getSessions(clientId: clientId, limit: 5)
            isLoading = false
        } catch {
            print("Error loading client: \(error)")
            isLoading = false
        }
    }
}

struct ClientHeaderCard: View {
    let client: Client
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                ZStack {
                    Circle()
                        .fill(Color.theme.primary.opacity(0.2))
                        .frame(width: 70, height: 70)
                    
                    Text(client.initials)
                        .font(.title)
                        .foregroundColor(Color.theme.primary)
                }
                
                Spacer()
                
                Text(client.status.displayName)
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.theme.success.opacity(0.15))
                    .foregroundColor(Color.theme.success)
                    .cornerRadius(8)
            }
            
            Text(client.name)
                .font(.title2)
                .fontWeight(.bold)
            
            if let email = client.email {
                Label(email, systemImage: "envelope")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
            }
            
            if let phone = client.phone {
                Label(phone, systemImage: "phone")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
            }
            
            if !client.tags.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(client.tags, id: \.self) { tag in
                        TagBadge(tag: tag)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct QuickActionsSection: View {
    let clientId: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                QuickActionButton(icon: "calendar.badge.plus", title: "Schedule", color: .blue)
                QuickActionButton(icon: "doc.text.fill", title: "New Note", color: .green)
                QuickActionButton(icon: "list.clipboard", title: "Treatment Plan", color: .orange)
                QuickActionButton(icon: "brain", title: "AI Insights", color: .purple)
            }
        }
    }
}

struct QuickActionButton: View {
    let icon: String
    let title: String
    let color: Color
    
    var body: some View {
        Button(action: {}) {
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
            .cornerRadius(12)
        }
    }
}

struct RecentSessionsSection: View {
    let sessions: [Session]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Sessions")
                .font(.headline)
            
            ForEach(sessions.prefix(3)) { session in
                NavigationLink(destination: SessionDetailView(session: session)) {
                    SessionCard(session: session)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
    }
}

// MARK: - Add Client View
struct AddClientView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var dateOfBirth: Date?
    @State private var showDatePicker = false
    @State private var isSubmitting = false
    @State private var error: Error?
    
    var body: some View {
        Form {
            Section("Basic Information") {
                TextField("Name *", text: $name)
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                TextField("Phone", text: $phone)
                    .keyboardType(.phonePad)
            }
            
            Section("Additional Information") {
                Toggle("Add Date of Birth", isOn: $showDatePicker)
                
                if showDatePicker {
                    DatePicker(
                        "Date of Birth",
                        selection: Binding(
                            get: { dateOfBirth ?? Date() },
                            set: { dateOfBirth = $0 }
                        ),
                        displayedComponents: .date
                    )
                }
            }
        }
        .navigationTitle("Add Client")
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
                        await saveClient()
                    }
                }
                .disabled(name.isEmpty || isSubmitting)
            }
        }
        .loadingOverlay(isSubmitting)
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error?.localizedDescription ?? "")
        }
    }
    
    private func saveClient() async {
        isSubmitting = true
        defer { isSubmitting = false }
        
        struct CreateClientRequest: Codable {
            let name: String
            let email: String?
            let phone: String?
            let dateOfBirth: Date?
            
            enum CodingKeys: String, CodingKey {
                case name
                case email
                case phone
                case dateOfBirth = "date_of_birth"
            }
        }
        
        do {
            let request = CreateClientRequest(
                name: name,
                email: email.isEmpty ? nil : email,
                phone: phone.isEmpty ? nil : phone,
                dateOfBirth: dateOfBirth
            )
            
            let _: Client = try await APIClient.shared.request(
                endpoint: "/api/clients",
                method: .post,
                body: request
            )
            
            dismiss()
        } catch {
            self.error = error
        }
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        ClientsListView()
    }
}
