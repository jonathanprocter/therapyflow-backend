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
    @State private var isDeleting = false

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
                    headerSection(client: client)

                    // Content - adaptive layout
                    if horizontalSizeClass == .regular {
                        HStack(alignment: .top, spacing: 24) {
                            VStack(spacing: 24) {
                                contactInfoSection(client: client)
                                clinicalToolsSection(client: client)
                                tagsSection(client: client)
                            }
                            .frame(maxWidth: .infinity)

                            VStack(spacing: 24) {
                                sessionsSection
                                notesSection
                            }
                            .frame(maxWidth: .infinity)
                        }
                    } else {
                        contactInfoSection(client: client)
                        clinicalToolsSection(client: client)
                        tagsSection(client: client)
                        sessionsSection
                        notesSection
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

                    Button(role: .destructive, action: { showingDeleteConfirmation = true }) {
                        Label("Delete Client", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .disabled(isDeleting)
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
                ZStack {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()

                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.5)
                        Text("Deleting...")
                            .font(.headline)
                            .foregroundColor(.white)
                    }
                    .padding(32)
                    .background(Color.theme.surface)
                    .cornerRadius(16)
                }
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
        .task {
            await loadDataAsync()
        }
    }

    // MARK: - Header Section
    private func headerSection(client: Client) -> some View {
        VStack(spacing: 16) {
            AvatarWithStatus(name: client.name, size: 80, status: client.status)

            VStack(spacing: 8) {
                Text(client.name)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(Color.theme.primaryText)

                ClientStatusBadge(status: client.status)

                if let age = client.age {
                    Text("\(age) years old")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(16)
    }

    // MARK: - Clinical Tools Section
    private func clinicalToolsSection(client: Client) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Clinical Tools")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)
            
            VStack(spacing: 12) {
                // Link to Treatment Plans List (filtered logic would be inside the view if it supported it, 
                // but for now we link to the main list. Ideally we'd pass clientId to filter).
                // Since TreatmentPlansListView doesn't expose a filter init param in its current state,
                // we'll leave it as the main list or if I modify it.
                // Actually, I should probably modify TreatmentPlansListView to accept an optional clientId.
                // For this step I'll just link to the main list but typically users want to see *this* client's plans.
                // Let's check TreatmentPlansListView again. It has `searchText`.
                // I will link to TreatmentPlansListView() and the user can search.
                NavigationLink(destination: TreatmentPlansListView(clientId: client.id)) {
                    ClinicalToolRow(
                        icon: "list.clipboard",
                        title: "Treatment Plan",
                        subtitle: "Manage goals and interventions",
                        color: .blue
                    )
                }
                
                NavigationLink(destination: TherapeuticJourneyView(clientId: client.id)) {
                    ClinicalToolRow(
                        icon: "map",
                        title: "Therapeutic Journey",
                        subtitle: "Insights, themes, and progress",
                        color: .purple
                    )
                }
                
                NavigationLink(destination: ClientTimelineView(clientId: client.id, clientName: client.name)) {
                    ClinicalToolRow(
                        icon: "timeline.selection",
                        title: "Appointment Timeline",
                        subtitle: "Longitudinal session history with notes",
                        color: .orange
                    )
                }

                NavigationLink(destination: SessionHistoryView(clientId: client.id)) {
                    ClinicalToolRow(
                        icon: "clock.arrow.circlepath",
                        title: "Session History",
                        subtitle: "View all past sessions",
                        color: .teal
                    )
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Contact Info Section
    private func contactInfoSection(client: Client) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Contact Information")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            VStack(spacing: 12) {
                if let email = client.email, !email.isEmpty {
                    ContactRow(icon: "envelope", title: "Email", value: email)
                }

                if let phone = client.phone, !phone.isEmpty {
                    ContactRow(icon: "phone", title: "Phone", value: phone)
                }

                if let dob = client.dateOfBirth {
                    ContactRow(icon: "calendar", title: "Date of Birth", value: dob.mediumDate)
                }

                if let emergency = client.emergencyContact {
                    ContactRow(
                        icon: "exclamationmark.triangle",
                        title: "Emergency Contact",
                        value: "\(emergency.name) - \(emergency.phone)"
                    )
                }

                if let insurance = client.insurance {
                    ContactRow(
                        icon: "creditcard",
                        title: "Insurance",
                        value: "\(insurance.provider) - \(insurance.policyNumber)"
                    )
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Tags Section
    private func tagsSection(client: Client) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Tags & Considerations")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            if !client.tags.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(client.tags, id: \.self) { tag in
                        TagBadge(tag: tag)
                    }
                }
            }

            if !client.clinicalConsiderations.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Clinical Considerations")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.secondaryText)

                    ForEach(client.clinicalConsiderations, id: \.self) { consideration in
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.circle")
                                .font(.caption)
                                .foregroundColor(Color.theme.warning)

                            Text(consideration)
                                .font(.subheadline)
                                .foregroundColor(Color.theme.primaryText)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Sessions Section
    private var sessionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Recent Sessions")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                Text("\(sessions.count) total")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            if sessions.isEmpty {
                Text("No sessions yet")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                VStack(spacing: 8) {
                    ForEach(sessions.prefix(5)) { session in
                        SessionMiniRow(session: session)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Notes Section
    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Progress Notes")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                Text("\(notes.count) total")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            if notes.isEmpty {
                Text("No notes yet")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                VStack(spacing: 8) {
                    ForEach(notes.prefix(5)) { note in
                        NoteMiniRow(note: note)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Data Loading
    private func loadData() {
        Task {
            await loadDataAsync()
        }
    }

    private func loadDataAsync() async {
        isLoading = true
        error = nil

        do {
            async let clientTask = APIClient.shared.getClient(id: clientId)
            async let sessionsTask = APIClient.shared.getSessions(clientId: clientId)
            async let notesTask = APIClient.shared.getProgressNotes(clientId: clientId)

            let (fetchedClient, fetchedSessions, fetchedNotes) = try await (clientTask, sessionsTask, notesTask)

            await MainActor.run {
                client = fetchedClient
                sessions = fetchedSessions
                notes = fetchedNotes
                isLoading = false
            }
        } catch {
            await MainActor.run {
                self.error = error
                isLoading = false
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

// MARK: - Helper Views
struct ContactRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(Color.theme.primary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)

                Text(value)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.primaryText)
            }

            Spacer()
        }
    }
}

struct SessionMiniRow: View {
    let session: Session

    var body: some View {
        HStack(spacing: 12) {
            Text(session.scheduledAt.monthDay)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
                .frame(width: 50, alignment: .leading)

            SessionTypeBadge(type: session.sessionType)

            Spacer()

            SessionStatusBadge(status: session.status)
        }
        .padding(.vertical, 4)
    }
}

struct NoteMiniRow: View {
    let note: ProgressNote

    var body: some View {
        HStack(spacing: 12) {
            Text(note.sessionDate.monthDay)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
                .frame(width: 50, alignment: .leading)

            Text(note.contentPreview)
                .font(.caption)
                .foregroundColor(Color.theme.primaryText)
                .lineLimit(1)

            Spacer()

            RiskIndicator(level: note.riskLevel)
        }
        .padding(.vertical, 4)
    }
}

struct ClinicalToolRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.1))
                    .frame(width: 40, height: 40)
                
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.system(size: 20))
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)
                
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding(8)
        .background(Color.theme.background)
        .cornerRadius(8)
    }
}

#Preview {
    NavigationStack {
        ClientDetailView(clientId: "test-id")
    }
}
