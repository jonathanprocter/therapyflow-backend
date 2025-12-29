import SwiftUI

struct BulkImportView: View {
    @State private var importedFiles: [ImportedFile] = []
    @State private var isImporting = false
    @State private var isUploading = false
    @State private var uploadProgress: Double = 0
    @State private var error: Error?
    @State private var successMessage: String?
    
    struct ImportedFile: Identifiable {
        let id = UUID()
        let url: URL
        let name: String
        var status: ImportStatus = .pending
        var content: String?
    }
    
    enum ImportStatus {
        case pending
        case uploading
        case success
        case failed
    }
    
    var body: some View {
        VStack {
            if importedFiles.isEmpty {
                EmptyStateView(
                    icon: "folder.badge.plus",
                    title: "Bulk Import",
                    message: "Select multiple transcripts or documents to import them all at once.",
                    actionTitle: "Select Files",
                    action: { isImporting = true }
                )
            } else {
                List {
                    Section {
                        ForEach(importedFiles) { file in
                            HStack {
                                Image(systemName: "doc.text")
                                    .foregroundColor(.gray)
                                
                                VStack(alignment: .leading) {
                                    Text(file.name)
                                        .font(.subheadline)
                                    if file.status == .failed {
                                        Text("Failed")
                                            .font(.caption)
                                            .foregroundColor(.red)
                                    }
                                }
                                
                                Spacer()
                                
                                switch file.status {
                                case .pending:
                                    EmptyView()
                                case .uploading:
                                    ProgressView()
                                case .success:
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.green)
                                case .failed:
                                    Image(systemName: "exclamationmark.circle.fill")
                                        .foregroundColor(.red)
                                }
                            }
                        }
                        .onDelete(perform: deleteFile)
                    } header: {
                        Text("Selected Files (\(importedFiles.count))")
                    }
                    
                    Section {
                        Button(action: startBulkUpload) {
                            if isUploading {
                                HStack {
                                    Text("Uploading...")
                                    Spacer()
                                    Text("\(Int(uploadProgress * 100))%")
                                }
                            } else {
                                Text("Start Import")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .disabled(isUploading || importedFiles.isEmpty)
                        .listRowBackground(Color.theme.primary)
                        .foregroundColor(.white)
                    }
                }
            }
        }
        .navigationTitle("Bulk Import")
        .fileImporter(
            isPresented: $isImporting,
            allowedContentTypes: [.plainText, .pdf, .text],
            allowsMultipleSelection: true
        ) { result in
            handleFileSelection(result)
        }
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error?.localizedDescription ?? "")
        }
        .alert("Success", isPresented: .constant(successMessage != nil)) {
            Button("OK") { successMessage = nil }
        } message: {
            Text(successMessage ?? "")
        }
    }
    
    private func deleteFile(at offsets: IndexSet) {
        importedFiles.remove(atOffsets: offsets)
    }
    
    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            for url in urls {
                guard url.startAccessingSecurityScopedResource() else { continue }
                defer { url.stopAccessingSecurityScopedResource() }
                
                // Read content immediately to avoid access issues later
                if let content = try? String(contentsOf: url, encoding: .utf8) {
                    let file = ImportedFile(url: url, name: url.lastPathComponent, content: content)
                    importedFiles.append(file)
                }
            }
        case .failure(let error):
            self.error = error
        }
    }
    
    private func startBulkUpload() {
        isUploading = true
        uploadProgress = 0
        
        Task {
            var successCount = 0
            let total = Double(importedFiles.count)
            
            for index in importedFiles.indices {
                // Update status to uploading
                await MainActor.run {
                    importedFiles[index].status = .uploading
                }
                
                do {
                    // Upload logic
                    let file = importedFiles[index]
                    guard let content = file.content, let data = content.data(using: .utf8) else {
                        throw NSError(domain: "FileError", code: 0, userInfo: [NSLocalizedDescriptionKey: "Could not read file"])
                    }
                    
                    // Upload using existing API
                    _ = try await APIClient.shared.uploadDocument(
                        fileData: data,
                        fileName: file.name,
                        mimeType: "text/plain",
                        clientId: nil // Global upload
                    )
                    
                    await MainActor.run {
                        importedFiles[index].status = .success
                        successCount += 1
                        uploadProgress = Double(successCount) / total
                    }
                } catch {
                    await MainActor.run {
                        importedFiles[index].status = .failed
                        print("Upload failed for \(importedFiles[index].name): \(error)")
                    }
                }
            }
            
            await MainActor.run {
                isUploading = false
                successMessage = "Successfully imported \(successCount) of \(Int(total)) files."
                if successCount == Int(total) {
                    importedFiles.removeAll()
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        BulkImportView()
    }
}
