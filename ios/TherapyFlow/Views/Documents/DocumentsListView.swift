import SwiftUI

struct DocumentsListView: View {
    @State private var documents: [Document] = []
    @State private var isLoading = true
    @State private var error: Error?
    @State private var searchText = ""
    @State private var showingUpload = false
    @State private var selectedFilter: DocumentFilter = .all

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    enum DocumentFilter: String, CaseIterable {
        case all = "All"
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
                Button(action: { showingUpload = true }) {
                    Image(systemName: "plus")
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

// MARK: - Document Row
struct DocumentRow: View {
    let document: Document

    var body: some View {
        HStack(spacing: 16) {
            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(documentColor.opacity(0.15))
                    .frame(width: 48, height: 48)

                Image(systemName: documentIcon)
                    .font(.title3)
                    .foregroundColor(documentColor)
            }

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(document.filename)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    if let clientName = document.clientName {
                        Text(clientName)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Text("•")
                        .foregroundColor(Color.theme.tertiaryText)

                    Text(document.uploadedAt.relativeString)
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                }
            }

            Spacer()

            // Status
            DocumentStatusBadge(status: document.status)

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    private var documentIcon: String {
        switch document.mimeType {
        case "application/pdf":
            return "doc.fill"
        case "text/plain":
            return "doc.text.fill"
        case "audio/mpeg", "audio/wav", "audio/m4a":
            return "waveform"
        default:
            return "doc.fill"
        }
    }

    private var documentColor: Color {
        switch document.status {
        case .processed:
            return Color.theme.success
        case .processing:
            return Color.theme.warning
        case .pending:
            return Color.theme.secondaryText
        case .failed:
            return Color.theme.error
        }
    }
}

// MARK: - Document Status Badge
struct DocumentStatusBadge: View {
    let status: DocumentStatus

    var body: some View {
        HStack(spacing: 4) {
            if status == .processing {
                ProgressView()
                    .scaleEffect(0.6)
            } else {
                Circle()
                    .fill(statusColor)
                    .frame(width: 6, height: 6)
            }

            Text(status.rawValue.capitalized)
                .font(.caption2)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor.opacity(0.15))
        .foregroundColor(statusColor)
        .cornerRadius(6)
    }

    private var statusColor: Color {
        switch status {
        case .processed:
            return Color.theme.success
        case .processing:
            return Color.theme.warning
        case .pending:
            return Color.theme.secondaryText
        case .failed:
            return Color.theme.error
        }
    }
}

// MARK: - Document Upload View
struct DocumentUploadView: View {
    let onUpload: (Document) -> Void

    @State private var selectedClientId: String?
    @State private var shouldAnalyze = true
    @State private var fileData: Data?
    @State private var filename = ""
    @State private var mimeType = "text/plain"
    
    @State private var clients: [Client] = []
    @State private var isLoadingClients = true
    @State private var isUploading = false
    @State private var error: Error?
    @State private var isImporting = false

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Section("Client") {
                if isLoadingClients {
                    HStack {
                        ProgressView()
                        Text("Loading clients...")
                            .foregroundColor(Color.theme.secondaryText)
                    }
                } else {
                    Picker("Select Client", selection: $selectedClientId) {
                        Text("Select a client").tag(nil as String?)
                        ForEach(clients) { client in
                            Text(client.name).tag(client.id as String?)
                        }
                    }
                }
            }
            
            Section("Document Details") {
                TextField("Filename", text: $filename)
                
                Toggle("Analyze with AI", isOn: $shouldAnalyze)
                    .tint(Color.theme.primary)
            }

            Section("File") {
                Button(action: { isImporting = true }) {
                    HStack {
                        Image(systemName: "doc.text.fill")
                        Text(filename.isEmpty ? "Select File" : filename)
                            .foregroundColor(filename.isEmpty ? .primary : .secondary)
                    }
                }
            }

            if let data = fileData {
                Section("File Info") {
                    HStack {
                        Text("Size")
                        Spacer()
                        Text(ByteCountFormatter.string(fromByteCount: Int64(data.count), countStyle: .file))
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Text("Type")
                        Spacer()
                        Text(mimeType)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Section {
                Button(action: upload) {
                    Text(shouldAnalyze ? "Upload & Analyze" : "Upload")
                        .frame(maxWidth: .infinity)
                        .foregroundColor(.white)
                }
                .listRowBackground(Color.theme.primary)
                .disabled(fileData == nil || isUploading)
            }
        }
        .navigationTitle("Upload Document")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
            }
        }
        .loadingOverlay(isUploading)
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error?.localizedDescription ?? "")
        }
        .fileImporter(
            isPresented: $isImporting,
            allowedContentTypes: [.plainText, .pdf, .text],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                
                // Securely access the URL
                guard url.startAccessingSecurityScopedResource() else {
                    self.error = NSError(domain: "AccessDenied", code: 403, userInfo: [NSLocalizedDescriptionKey: "Permission denied"])
                    return
                }
                
                defer { url.stopAccessingSecurityScopedResource() }
                
                do {
                    let data = try Data(contentsOf: url)
                    let name = url.lastPathComponent
                    let type = url.pathExtension.lowercased() == "pdf" ? "application/pdf" : "text/plain"
                    
                    Task { @MainActor in
                        self.fileData = data
                        self.filename = name
                        self.mimeType = type
                    }
                } catch {
                     Task { @MainActor in
                        self.error = error
                    }
                }
                
            case .failure(let error):
                self.error = error
            }
        }
        .task {
            await loadClients()
        }
    }

    private func upload() {
        guard let data = fileData else { return }
        
        isUploading = true
        
        Task {
            do {
                let document: Document
                
                if shouldAnalyze {
                    document = try await APIClient.shared.uploadAndAnalyzeDocument(
                        fileData: data,
                        fileName: filename,
                        mimeType: mimeType,
                        clientId: selectedClientId
                    )
                } else {
                    document = try await APIClient.shared.uploadDocument(
                        fileData: data,
                        fileName: filename,
                        mimeType: mimeType,
                        clientId: selectedClientId
                    )
                }
                
                await MainActor.run {
                    isUploading = false
                    onUpload(document)
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isUploading = false
                }
            }
        }
    }

    private func loadClients() async {
        do {
            let fetchedClients = try await APIClient.shared.getClients()
            await MainActor.run {
                clients = fetchedClients.filter { $0.status == .active }
                isLoadingClients = false
            }
        } catch {
            await MainActor.run {
                isLoadingClients = false
            }
        }
    }
}

#Preview {
    NavigationStack {
        DocumentsListView()
    }
}
