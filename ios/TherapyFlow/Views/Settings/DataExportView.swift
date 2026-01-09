import SwiftUI

struct DataExportView: View {
    @State private var selectedScope: ExportScope = .all
    @State private var isExporting = false
    @State private var exportURL: URL?
    @State private var error: Error?
    @State private var showingShareSheet = false
    
    enum ExportScope: String, CaseIterable, Identifiable {
        case all = "All Data"
        case clients = "Clients"
        case sessions = "Sessions"
        case notes = "Progress Notes"
        case treatmentPlans = "Treatment Plans"
        
        var id: String { rawValue }
    }
    
    var body: some View {
        Form {
            Section("Export Settings") {
                Picker("Data to Export", selection: $selectedScope) {
                    ForEach(ExportScope.allCases) { scope in
                        Text(scope.rawValue).tag(scope)
                    }
                }
            }
            
            Section {
                Button(action: startExport) {
                    if isExporting {
                        HStack {
                            Text("Generating Export...")
                            Spacer()
                            ProgressView()
                        }
                    } else {
                        Text("Export Data")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(isExporting)
                .listRowBackground(Color.theme.primary)
                .foregroundColor(.white)
            } footer: {
                Text("Exported data will be generated as a JSON file containing all requested information.")
            }
        }
        .navigationTitle("Data Export")
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error?.localizedDescription ?? "")
        }
        .sheet(isPresented: $showingShareSheet) {
            if let url = exportURL {
                ShareSheet(activityItems: [url])
            }
        }
    }
    
    private func startExport() {
        isExporting = true
        
        Task {
            do {
                let data = try await APIClient.shared.exportData(scope: selectedScope.rawValue.lowercased())
                
                // Save to temp file
                let fileName = "TherapyFlow_Export_\(selectedScope.rawValue)_\(Date().formatted(date: .numeric, time: .omitted)).json"
                let tempDir = FileManager.default.temporaryDirectory
                let fileURL = tempDir.appendingPathComponent(fileName)
                
                try data.write(to: fileURL)
                
                await MainActor.run {
                    self.exportURL = fileURL
                    self.isExporting = false
                    self.showingShareSheet = true
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    self.isExporting = false
                }
            }
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    var activityItems: [Any]
    var applicationActivities: [UIActivity]? = nil

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: applicationActivities)
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    NavigationStack {
        DataExportView()
    }
}
