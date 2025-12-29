import SwiftUI

struct NotesListView: View {
    @State private var notes: [ProgressNote] = []
    @State private var searchText = ""
    @State private var selectedFilter: NoteFilter = .all
    @State private var isLoading = true
    @State private var error: Error?
    @State private var showingCreateNote = false

    enum NoteFilter: String, CaseIterable {
        case all = "All Notes"
        case thisWeek = "This Week"
        case highRisk = "High Risk"
        case needsReview = "Needs Review"
    }

    var filteredNotes: [ProgressNote] {
        var result = notes

        if !searchText.isEmpty {
            result = result.filter { note in
                (note.content?.localizedCaseInsensitiveContains(searchText) ?? false) ||
                (note.client?.name.localizedCaseInsensitiveContains(searchText) ?? false) ||
                note.tags.contains { $0.localizedCaseInsensitiveContains(searchText) }
            }
        }

        switch selectedFilter {
        case .all:
            break
        case .thisWeek:
            result = result.filter { $0.sessionDate.isThisWeek }
        case .highRisk:
            result = result.filter { $0.riskLevel >= .high }
        case .needsReview:
            result = result.filter { $0.requiresManualReview }
        }

        return result.sorted { $0.sessionDate > $1.sessionDate }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Search and filters
            VStack(spacing: 12) {
                // Search bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(Color.theme.secondaryText)

                    TextField("Search notes...", text: $searchText)
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
                        ForEach(NoteFilter.allCases, id: \.self) { filter in
                            FilterChip(
                                title: filter.rawValue,
                                isSelected: selectedFilter == filter,
                                action: { selectedFilter = filter }
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
                ErrorView(error: error, onRetry: loadNotes)
            } else if filteredNotes.isEmpty {
                if notes.isEmpty {
                    NoNotesView(onCreate: { showingCreateNote = true })
                } else {
                    NoSearchResultsView(query: searchText)
                }
            } else {
                notesList
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Progress Notes")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingCreateNote = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingCreateNote) {
            NavigationStack {
                NoteFormView(mode: .create) { newNote in
                    notes.insert(newNote, at: 0)
                    showingCreateNote = false
                }
            }
        }
        .refreshable {
            await loadNotesAsync()
        }
        .task {
            await loadNotesAsync()
        }
    }

    // MARK: - Notes List
    private var notesList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredNotes) { note in
                    NavigationLink(destination: NoteDetailView(noteId: note.id)) {
                        NoteRowView(note: note)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
    }

    // MARK: - Data Loading
    private func loadNotes() {
        Task {
            await loadNotesAsync()
        }
    }

    private func loadNotesAsync() async {
        isLoading = true
        error = nil

        do {
            let fetchedNotes = try await APIClient.shared.getProgressNotes()
            await MainActor.run {
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
}

#Preview {
    NavigationStack {
        NotesListView()
    }
}
