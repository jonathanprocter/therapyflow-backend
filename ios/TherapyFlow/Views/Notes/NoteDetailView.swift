import SwiftUI

struct NoteDetailView: View {
    let noteId: String

    @State private var note: ProgressNote?
    @State private var isLoading = true
    @State private var error: Error?
    @State private var showingEditSheet = false

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ScrollView {
            if isLoading {
                LoadingView()
                    .frame(height: 300)
            } else if let error = error {
                ErrorView(error: error, onRetry: loadNote)
            } else if let note = note {
                VStack(spacing: 24) {
                    // Header
                    headerSection(note: note)

                    // Content - adaptive layout
                    if horizontalSizeClass == .regular {
                        HStack(alignment: .top, spacing: 24) {
                            VStack(spacing: 24) {
                                contentSection(note: note)
                            }
                            .frame(minWidth: 400, maxWidth: .infinity)

                            VStack(spacing: 24) {
                                metadataSection(note: note)
                                tagsSection(note: note)
                            }
                            .frame(width: 300)
                        }
                    } else {
                        contentSection(note: note)
                        metadataSection(note: note)
                        tagsSection(note: note)
                    }
                }
                .padding()
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Progress Note")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button(action: { showingEditSheet = true }) {
                        Label("Edit", systemImage: "pencil")
                    }

                    Button(action: {}) {
                        Label("Export PDF", systemImage: "square.and.arrow.up")
                    }

                    Divider()

                    Button(role: .destructive, action: {}) {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            if let note = note {
                NavigationStack {
                    NoteFormView(mode: .edit(note)) { updatedNote in
                        self.note = updatedNote
                        showingEditSheet = false
                    }
                }
            }
        }
        .task {
            await loadNoteAsync()
        }
    }

    // MARK: - Header Section
    private func headerSection(note: ProgressNote) -> some View {
        HStack(spacing: 16) {
            AvatarView(name: note.client?.name ?? "C", size: 56)

            VStack(alignment: .leading, spacing: 4) {
                Text(note.client?.name ?? "Client")
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(Color.theme.primaryText)

                Text(note.sessionDate.dateTimeString)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 8) {
                RiskBadge(level: note.riskLevel)
                NoteStatusBadge(status: note.status)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Content Section
    private func contentSection(note: ProgressNote) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Session Notes")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            if let content = note.content, !content.isEmpty {
                Text(content)
                    .font(.body)
                    .foregroundColor(Color.theme.primaryText)
                    .lineSpacing(6)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "doc.badge.ellipsis")
                        .font(.largeTitle)
                        .foregroundColor(Color.theme.primaryLight)

                    Text("No content available")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)

                    Text("This is a placeholder note. Upload or create content to complete it.")
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                        .multilineTextAlignment(.center)

                    Button(action: { showingEditSheet = true }) {
                        Text("Add Content")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Color.theme.primary)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Metadata Section
    private func metadataSection(note: ProgressNote) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Details")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            VStack(spacing: 12) {
                MetadataRow(icon: "calendar", title: "Session Date", value: note.sessionDate.longDate)

                if let rating = note.progressRating {
                    MetadataRow(icon: "chart.line.uptrend.xyaxis", title: "Progress Rating", value: "\(rating)/10")
                }

                MetadataRow(icon: "shield", title: "Risk Level", value: note.riskLevel.displayName)

                MetadataRow(icon: "doc.text", title: "Status", value: note.status.displayName)

                if let confidence = note.aiConfidenceScore {
                    MetadataRow(
                        icon: "sparkles",
                        title: "AI Confidence",
                        value: String(format: "%.0f%%", confidence * 100)
                    )
                }

                MetadataRow(icon: "clock", title: "Created", value: note.createdAt.relativeString)

                if note.updatedAt != note.createdAt {
                    MetadataRow(icon: "clock.arrow.circlepath", title: "Updated", value: note.updatedAt.relativeString)
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Tags Section
    private func tagsSection(note: ProgressNote) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Tags")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            if note.allTags.isEmpty {
                Text("No tags")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    if !note.tags.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Manual Tags")
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)

                            FlowLayout(spacing: 8) {
                                ForEach(note.tags, id: \.self) { tag in
                                    TagBadge(tag: tag)
                                }
                            }
                        }
                    }

                    if !note.aiTags.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 4) {
                                Image(systemName: "sparkles")
                                    .font(.caption)
                                Text("AI-Generated Tags")
                                    .font(.caption)
                            }
                            .foregroundColor(Color.theme.secondaryText)

                            FlowLayout(spacing: 8) {
                                ForEach(note.aiTags, id: \.self) { tag in
                                    TagBadge(tag: tag, isAI: true)
                                }
                            }
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    // MARK: - Data Loading
    private func loadNote() {
        Task {
            await loadNoteAsync()
        }
    }

    private func loadNoteAsync() async {
        isLoading = true
        error = nil

        do {
            let fetchedNote = try await APIClient.shared.getProgressNote(id: noteId)
            await MainActor.run {
                note = fetchedNote
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
        }
    }
}

#Preview {
    NavigationStack {
        NoteDetailView(noteId: "test-id")
    }
}
