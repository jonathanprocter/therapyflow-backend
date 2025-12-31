import SwiftUI

struct SessionDetailView: View {
    let session: Session

    @State private var sessionPrep: SessionPrep?
    @State private var isLoadingPrep = false
    @State private var showingEditSheet = false

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                headerSection

                // Content
                if horizontalSizeClass == .regular {
                    HStack(alignment: .top, spacing: 24) {
                        VStack(spacing: 24) {
                            detailsSection
                            prepSection
                        }
                        .frame(maxWidth: .infinity)

                        actionsSection
                            .frame(width: 300)
                    }
                } else {
                    detailsSection
                    prepSection
                    actionsSection
                }
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("Session")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button(action: { showingEditSheet = true }) {
                        Label("Edit", systemImage: "pencil")
                    }

                    Button(action: generatePrep) {
                        Label("Generate AI Prep", systemImage: "sparkles")
                    }

                    Divider()

                    Button(role: .destructive, action: {}) {
                        Label("Cancel Session", systemImage: "xmark.circle")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            NavigationStack {
                SessionFormView(editSession: session) { updatedSession in
                    showingEditSheet = false
                }
            }
        }
    }

    // MARK: - Header Section
    private var headerSection: some View {
        HStack(spacing: 16) {
            // Client info - tappable to view client details
            if let clientId = session.clientId as String? {
                NavigationLink(destination: ClientDetailView(clientId: clientId)) {
                    HStack(spacing: 12) {
                        AvatarView(name: session.client?.name ?? "C", size: 56)

                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 4) {
                                Text(session.client?.name ?? "Client")
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color.theme.primaryText)

                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.tertiaryText)
                            }

                            Text("Tap to view client profile")
                                .font(.caption)
                                .foregroundColor(Color.theme.primary)
                        }
                    }
                }
                .buttonStyle(.plain)
            } else {
                HStack(spacing: 12) {
                    AvatarView(name: session.client?.name ?? "C", size: 56)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(session.client?.name ?? "Client")
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundColor(Color.theme.primaryText)

                        Text(session.scheduledAt.smartDateTimeString)
                            .font(.subheadline)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                SessionStatusBadge(status: session.status)

                Text(session.scheduledAt.smartDateTimeString)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Details Section
    private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Session Details")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            VStack(spacing: 12) {
                MetadataRow(icon: "calendar", title: "Date", value: session.scheduledAt.longDate)
                MetadataRow(icon: "clock", title: "Time", value: session.formattedTimeRange)
                MetadataRow(icon: "hourglass", title: "Duration", value: "\(session.duration) minutes")

                HStack(spacing: 12) {
                    Image(systemName: session.sessionType.icon)
                        .font(.body)
                        .foregroundColor(Color.theme.primary)
                        .frame(width: 20)

                    Text("Type")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)

                    Spacer()

                    SessionTypeBadge(type: session.sessionType)
                }

                // Progress Note Status
                progressNoteStatusRow

                if let notes = session.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Notes")
                            .font(.subheadline)
                            .foregroundColor(Color.theme.secondaryText)

                        Text(notes)
                            .font(.body)
                            .foregroundColor(Color.theme.primaryText)
                    }
                    .padding(.top, 8)
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Progress Note Status Row
    private var progressNoteStatusRow: some View {
        HStack(spacing: 12) {
            Image(systemName: progressNoteIcon)
                .font(.body)
                .foregroundColor(progressNoteColor)
                .frame(width: 20)

            Text("Progress Note")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)

            Spacer()

            ProgressNoteStatusBadge(status: session.progressNoteStatus, hasPlaceholder: session.hasProgressNotePlaceholder)
        }
    }

    private var progressNoteIcon: String {
        switch session.progressNoteStatus {
        case .processed:
            return "checkmark.circle.fill"
        case .uploaded:
            return "arrow.up.circle.fill"
        case .needsReview:
            return "exclamationmark.circle.fill"
        case .pending:
            return session.hasProgressNotePlaceholder ? "doc.badge.clock" : "doc"
        }
    }

    private var progressNoteColor: Color {
        switch session.progressNoteStatus {
        case .processed:
            return Color.theme.success
        case .uploaded:
            return Color.theme.accent
        case .needsReview:
            return Color.theme.warning
        case .pending:
            return session.hasProgressNotePlaceholder ? Color.theme.primary : Color.theme.tertiaryText
        }
    }

    // MARK: - Prep Section
    private var prepSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundColor(Color.theme.primary)
                    Text("AI Session Prep")
                        .font(.headline)
                        .foregroundColor(Color.theme.primaryText)
                }

                Spacer()

                if isLoadingPrep {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }

            if let prep = sessionPrep {
                VStack(alignment: .leading, spacing: 16) {
                    if let summary = prep.prep.summary {
                        PrepSection(title: "Summary", content: summary)
                    }

                    if let themes = prep.prep.keyThemes, !themes.isEmpty {
                        PrepListSection(title: "Key Themes", items: themes)
                    }

                    if let topics = prep.prep.suggestedTopics, !topics.isEmpty {
                        PrepListSection(title: "Suggested Topics", items: topics)
                    }

                    if let risks = prep.prep.riskFactors, !risks.isEmpty {
                        PrepListSection(title: "Risk Factors", items: risks, icon: "exclamationmark.triangle", color: Color.theme.warning)
                    }
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "sparkles")
                        .font(.largeTitle)
                        .foregroundColor(Color.theme.primaryLight)

                    Text("Generate AI-powered session preparation")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                        .multilineTextAlignment(.center)

                    Button(action: generatePrep) {
                        Text("Generate Prep")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Color.theme.primary)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                    }
                    .disabled(isLoadingPrep)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Actions Section
    private var actionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Actions")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            VStack(spacing: 8) {
                ActionButton(icon: "doc.badge.plus", title: "Create Note", color: Color.theme.primary) {
                    // Navigate to create note
                }

                ActionButton(icon: "video", title: "Start Video Session", color: Color.theme.accent) {
                    // Start video
                }

                if session.status == .scheduled {
                    ActionButton(icon: "checkmark.circle", title: "Mark Complete", color: Color.theme.success) {
                        // Mark complete
                    }

                    ActionButton(icon: "person.fill.xmark", title: "Mark No Show", color: Color.theme.warning) {
                        // Mark no show
                    }
                }

                ActionButton(icon: "xmark.circle", title: "Cancel Session", color: Color.theme.error) {
                    // Cancel
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Actions
    private func generatePrep() {
        isLoadingPrep = true

        Task {
            do {
                let prep = try await APIClient.shared.generateSessionPrep(sessionId: session.id)
                await MainActor.run {
                    sessionPrep = prep
                    isLoadingPrep = false
                }
            } catch {
                await MainActor.run {
                    isLoadingPrep = false
                }
            }
        }
    }
}

// MARK: - Prep Section View
struct PrepSection: View {
    let title: String
    let content: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.secondaryText)

            Text(content)
                .font(.body)
                .foregroundColor(Color.theme.primaryText)
        }
    }
}

struct PrepListSection: View {
    let title: String
    let items: [String]
    var icon: String = "checkmark.circle"
    var color: Color = Color.theme.primary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.secondaryText)

            VStack(alignment: .leading, spacing: 6) {
                ForEach(items, id: \.self) { item in
                    HStack(spacing: 8) {
                        Image(systemName: icon)
                            .font(.caption)
                            .foregroundColor(color)

                        Text(item)
                            .font(.subheadline)
                            .foregroundColor(Color.theme.primaryText)
                    }
                }
            }
        }
    }
}

// MARK: - Action Button
struct ActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.body)
                    .foregroundColor(color)
                    .frame(width: 24)

                Text(title)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(Color.theme.tertiaryText)
            }
            .padding()
            .background(Color.theme.surfaceSecondary)
            .cornerRadius(10)
        }
    }
}

// MARK: - Metadata Row
struct MetadataRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(Color.theme.primary)
                .frame(width: 20)

            Text(title)
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)

            Spacer()

            Text(value)
                .font(.subheadline)
                .foregroundColor(Color.theme.primaryText)
                .multilineTextAlignment(.trailing)
        }
    }
}

#Preview {
    NavigationStack {
        SessionDetailView(session: Session(
            id: "1",
            clientId: "c1",
            therapistId: "t1",
            scheduledAt: Date().adding(hours: 2),
            duration: 50,
            sessionType: .individual,
            status: .scheduled,
            client: Client(id: "c1", therapistId: "t1", name: "John Doe")
        ))
    }
}
