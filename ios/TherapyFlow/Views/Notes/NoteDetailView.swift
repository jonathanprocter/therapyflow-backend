import SwiftUI

struct NoteDetailView: View {
    let noteId: String

    @State private var note: ProgressNote?
    @State private var isLoading = true
    @State private var error: Error?
    @State private var showingEditSheet = false
    @State private var loadTask: Task<Void, Never>?

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
                    NoteDetailHeaderView(note: note)

                    // Content - adaptive layout
                    if horizontalSizeClass == .regular {
                        HStack(alignment: .top, spacing: 24) {
                            VStack(spacing: 24) {
                                NoteDetailContentView(note: note, onAddContent: { showingEditSheet = true })
                            }
                            .frame(minWidth: 400, maxWidth: .infinity)

                            VStack(spacing: 24) {
                                NoteDetailMetadataView(note: note)
                                NoteDetailTagsView(note: note)
                            }
                            .frame(width: 300)
                        }
                    } else {
                        NoteDetailContentView(note: note, onAddContent: { showingEditSheet = true })
                        NoteDetailMetadataView(note: note)
                        NoteDetailTagsView(note: note)
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
        .onAppear {
            // Update initial AI context
            ContextualAIAssistant.shared.updateContext(.progressNoteDetail)

            loadTask?.cancel()
            loadTask = Task {
                await loadNoteAsync()
            }
        }
        .onDisappear {
            loadTask?.cancel()
            loadTask = nil
        }
    }

    // MARK: - Data Loading
    private func loadNote() {
        Task {
            await loadNoteAsync()
        }
    }

    private func loadNoteAsync() async {
        guard !Task.isCancelled else { return }

        isLoading = true
        error = nil

        do {
            var fetchedNote = try await APIClient.shared.getProgressNote(id: noteId)

            // Hydrate client if not present but clientId exists
            if fetchedNote.client == nil {
                do {
                    let client = try await APIClient.shared.getClient(id: fetchedNote.clientId)
                    fetchedNote.client = client
                    // Also populate clientName for fallback
                    if fetchedNote.clientName == nil {
                        fetchedNote.clientName = client.name
                    }
                } catch {
                    // Client fetch failed - continue with note data
                    print("Failed to hydrate client for note: \(error.localizedDescription)")
                }
            }

            guard !Task.isCancelled else { return }

            await MainActor.run {
                note = fetchedNote
                isLoading = false
                // Update AI context with loaded note details
                ContextualAIAssistant.shared.updateContext(.progressNoteDetail, client: fetchedNote.client, note: fetchedNote)
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
}

#Preview {
    NavigationStack {
        NoteDetailView(noteId: "test-id")
    }
}
