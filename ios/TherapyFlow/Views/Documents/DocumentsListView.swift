import SwiftUI

struct DocumentsListView: View {
    @State private var documents: [Document] = []
    @State private var isLoading = true
    @State private var error: Error?
    @State private var searchText = ""
    @State private var showingUpload = false
    @State private var selectedFilter: DocumentFilter = .all
    @State private var needsRefresh = false
    @State private var isProcessingAll = false
    @State private var processingResult: BatchProcessingResult?
    @State private var showingProcessingAlert = false
    @State private var showingDeleteConfirmation = false

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.scenePhase) private var scenePhase

    enum DocumentFilter: String, CaseIterable {
        case all = "All"
        case unlinked = "Unlinked"
        case transcripts = "Transcripts"
        case uploads = "Uploads"
        case processed = "Processed"
        case pending = "Pending"
    }

    var filteredDocuments: [Document] {
        var result = documents

        // Apply filter
        switch selectedFilter {
        case .all:
            break
        case .unlinked:
            // Documents that don't have a linked client (empty clientId)
            result = result.filter { $0.clientId.isEmpty }
        case .transcripts:
            result = result.filter { $0.documentType == "transcript" }
        case .uploads:
            result = result.filter { $0.documentType == "upload" }
        case .processed:
            result = result.filter { $0.status == .processed }
        case .pending:
            result = result.filter { $0.status == .pending || $0.status == .processing }
        }

        // Apply search
        if !searchText.isEmpty {
            result = result.filter {
                $0.filename.localizedCaseInsensitiveContains(searchText) ||
                ($0.clientName?.localizedCaseInsensitiveContains(searchText) ?? false)
            }
        }

        return result.sorted { $0.uploadedAt > $1.uploadedAt }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Filter chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(DocumentFilter.allCases, id: \.self) { filter in
                        FilterChip(
                            title: filter.rawValue,
                            isSelected: selectedFilter == filter
                        ) {
                            selectedFilter = filter
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 12)
            }
            .background(Color.theme.surface)

            Divider()

            // Content
            if isLoading {
                LoadingView()
            } else if let error = error {
                ErrorView(error: error, onRetry: loadDocuments)
            } else if filteredDocuments.isEmpty {
                EmptyStateView(
                    icon: "doc.text",
                    title: searchText.isEmpty ? "No Documents" : "No Results",
                    message: searchText.isEmpty ? "Upload transcripts or documents to get started" : "Try adjusting your search",
                    actionTitle: searchText.isEmpty ? "Upload Document" : nil,
                    action: searchText.isEmpty ? { showingUpload = true } : nil
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(filteredDocuments) { document in
                            NavigationLink(destination: DocumentDetailView(documentId: document.id)) {
                                DocumentRow(document: document)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Documents")
        .searchable(text: $searchText, prompt: "Search documents...")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button(action: { showingUpload = true }) {
                        Label("Upload Document", systemImage: "plus")
                    }

                    Divider()

                    Button(action: { processAllDocuments(deleteAfter: false) }) {
                        Label("Process All with AI", systemImage: "sparkles")
                    }
                    .disabled(isProcessingAll)

                    Button(action: { showingDeleteConfirmation = true }) {
                        Label("Process & Delete", systemImage: "sparkles.rectangle.stack")
                    }
                    .disabled(isProcessingAll)
                } label: {
                    if isProcessingAll {
                        ProgressView()
                    } else {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .sheet(isPresented: $showingUpload) {
            NavigationStack {
                DocumentUploadView { newDocument in
                    documents.insert(newDocument, at: 0)
                    showingUpload = false
                }
            }
        }
        .refreshable {
            await loadDocumentsAsync()
        }
        .task {
            await loadDocumentsAsync()
        }
        .onAppear {
            // Refresh list when returning from detail view
            if needsRefresh {
                needsRefresh = false
                Task {
                    await loadDocumentsAsync()
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .documentLinked)) { _ in
            // Refresh when a document is linked
            Task {
                await loadDocumentsAsync()
            }
        }
        .onDisappear {
            // Mark for refresh when navigating away
            needsRefresh = true
        }
        .alert("Process & Delete Documents", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Process & Delete", role: .destructive) {
                processAllDocuments(deleteAfter: true)
            }
        } message: {
            Text("This will process all documents with AI, extract themes and link to sessions, then delete the original documents. This cannot be undone.")
        }
        .alert("Processing Complete", isPresented: $showingProcessingAlert) {
            Button("OK") { }
        } message: {
            if let result = processingResult {
                Text("Processed: \(result.processed)\nLinked to sessions: \(result.linked)\nNotes created: \(result.notesCreated)\nDeleted: \(result.deleted)")
            }
        }
    }

    // MARK: - Batch Processing
    private func processAllDocuments(deleteAfter: Bool) {
        isProcessingAll = true

        Task {
            do {
                let result = try await APIClient.shared.batchProcessDocuments(deleteAfterProcess: deleteAfter)
                await MainActor.run {
                    processingResult = result
                    showingProcessingAlert = true
                    isProcessingAll = false
                }
                // Refresh document list
                await loadDocumentsAsync()
            } catch {
                await MainActor.run {
                    self.error = error
                    isProcessingAll = false
                }
            }
        }
    }

    // MARK: - Data Loading
    private func loadDocuments() {
        Task {
            await loadDocumentsAsync()
        }
    }

    private func loadDocumentsAsync() async {
        isLoading = true
        error = nil

        do {
            let fetchedDocuments = try await APIClient.shared.getDocuments()
            await MainActor.run {
                documents = fetchedDocuments
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

// MARK: - Notification Extension
extension Notification.Name {
    static let documentLinked = Notification.Name("documentLinked")
}

// MARK: - Batch Processing Result
struct BatchProcessingResult: Codable {
    let success: Bool
    let processed: Int
    let successful: Int
    let linked: Int
    let notesCreated: Int
    let notesUpdated: Int
    let deleted: Int
    let errors: [String]
}

#Preview {
    NavigationStack {
        DocumentsListView()
    }
}
