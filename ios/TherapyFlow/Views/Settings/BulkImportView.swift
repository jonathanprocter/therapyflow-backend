import SwiftUI

struct BulkImportView: View {
    @State private var importedFiles: [ImportedFile] = []
    @State private var isImporting = false
    @State private var isUploading = false
    @State private var isProcessing = false
    @State private var uploadProgress: Double = 0
    @State private var processingProgress: Double = 0
    @State private var error: Error?
    @State private var successMessage: String?
    @State private var matchResults: [DocumentCalendarMatcher.MatchResult] = []
    @State private var showMatchReview = false
    @State private var currentPhase: ImportPhase = .selecting

    enum ImportPhase {
        case selecting
        case uploading
        case analyzing
        case reviewing
        case complete
    }

    struct ImportedFile: Identifiable {
        let id = UUID()
        let url: URL
        let name: String
        var status: ImportStatus = .pending
        var content: String?
        var uploadedDocumentId: String?
    }

    enum ImportStatus {
        case pending
        case uploading
        case uploaded
        case analyzing
        case matched
        case success
        case failed
    }

    var body: some View {
        mainContent
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
            Button("OK") {
                successMessage = nil
                if currentPhase == .complete {
                    importedFiles.removeAll()
                    matchResults.removeAll()
                    currentPhase = .selecting
                }
            }
        } message: {
            Text(successMessage ?? "")
        }
        .sheet(isPresented: $showMatchReview) {
            BulkMatchReviewView(
                matchResults: $matchResults,
                onConfirm: confirmAndCreateNotes,
                onCancel: { showMatchReview = false }
            )
        }
        .toolbar {
            if !importedFiles.isEmpty && currentPhase == .selecting {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Add More") {
                        isImporting = true
                    }
                }
            }
        }
    }

    // MARK: - Main Content

    @ViewBuilder
    private var mainContent: some View {
        if importedFiles.isEmpty {
            emptyState
        } else {
            filesListContent
        }
    }

    private var emptyState: some View {
        EmptyStateView(
            icon: "folder.badge.plus",
            title: "Bulk Import",
            message: "Select multiple transcripts or documents to import them all at once. Files will be analyzed by AI and matched to your calendar sessions.",
            actionTitle: "Select Files",
            action: { isImporting = true }
        )
    }

    private var filesListContent: some View {
        VStack(spacing: 0) {
            progressHeader
            filesList
        }
    }

    private var filesList: some View {
        List {
            filesSection
            if !matchResults.isEmpty {
                matchResultsSection
            }
            actionSection
        }
    }

    private var filesSection: some View {
        Section {
            ForEach(importedFiles) { file in
                fileRow(file)
            }
            .onDelete(perform: deleteFile)
        } header: {
            Text("Selected Files (\(importedFiles.count))")
        }
    }

    private var matchResultsSection: some View {
        Section {
            ForEach(matchResults, id: \.documentId) { result in
                matchResultRow(result)
            }
        } header: {
            Text("AI Analysis Results")
        } footer: {
            Text("Review matches before finalizing. Tap to edit client or date assignments.")
        }
    }

    private var actionSection: some View {
        Section {
            actionButton
        }
    }

    // MARK: - Progress Header

    private var progressHeader: some View {
        VStack(spacing: 8) {
            HStack(spacing: 16) {
                phaseIndicator("Select", phase: .selecting, icon: "doc.badge.plus")
                phaseConnector(after: .selecting)
                phaseIndicator("Upload", phase: .uploading, icon: "arrow.up.circle")
                phaseConnector(after: .uploading)
                phaseIndicator("Analyze", phase: .analyzing, icon: "brain")
                phaseConnector(after: .analyzing)
                phaseIndicator("Review", phase: .reviewing, icon: "checkmark.circle")
            }
            .padding(.horizontal)

            if currentPhase == .uploading {
                ProgressView(value: uploadProgress)
                    .progressViewStyle(.linear)
                    .padding(.horizontal)
                Text("Uploading... \(Int(uploadProgress * 100))%")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else if currentPhase == .analyzing {
                ProgressView(value: processingProgress)
                    .progressViewStyle(.linear)
                    .padding(.horizontal)
                Text("Analyzing with AI... \(Int(processingProgress * 100))%")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 12)
        .background(Color(.systemGroupedBackground))
    }

    private func phaseIndicator(_ title: String, phase: ImportPhase, icon: String) -> some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(phaseColor(for: phase))
                    .frame(width: 32, height: 32)

                if currentPhase == phase && (phase == .uploading || phase == .analyzing) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.7)
                } else {
                    Image(systemName: phaseCompleted(phase) ? "checkmark" : icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            Text(title)
                .font(.caption2)
                .foregroundColor(phaseColor(for: phase))
        }
    }

    private func phaseConnector(after phase: ImportPhase) -> some View {
        Rectangle()
            .fill(phaseCompleted(phase) ? Color.green : Color.gray.opacity(0.3))
            .frame(width: 24, height: 2)
    }

    private func phaseColor(for phase: ImportPhase) -> Color {
        if phaseCompleted(phase) {
            return .green
        } else if currentPhase == phase {
            return .blue
        } else {
            return .gray.opacity(0.5)
        }
    }

    private func phaseCompleted(_ phase: ImportPhase) -> Bool {
        let phases: [ImportPhase] = [.selecting, .uploading, .analyzing, .reviewing, .complete]
        guard let currentIndex = phases.firstIndex(of: currentPhase),
              let phaseIndex = phases.firstIndex(of: phase) else {
            return false
        }
        return phaseIndex < currentIndex
    }

    // MARK: - File Row

    private func fileRow(_ file: ImportedFile) -> some View {
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
                } else if file.status == .analyzing {
                    Text("Analyzing...")
                        .font(.caption)
                        .foregroundColor(.orange)
                } else if file.status == .matched {
                    Text("Matched")
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }

            Spacer()

            statusIcon(for: file.status)
        }
    }

    @ViewBuilder
    private func statusIcon(for status: ImportStatus) -> some View {
        switch status {
        case .pending:
            EmptyView()
        case .uploading, .analyzing:
            ProgressView()
        case .uploaded:
            Image(systemName: "arrow.up.circle.fill")
                .foregroundColor(.blue)
        case .matched:
            Image(systemName: "link.circle.fill")
                .foregroundColor(.purple)
        case .success:
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
        case .failed:
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(.red)
        }
    }

    // MARK: - Match Result Row

    private func matchResultRow(_ result: DocumentCalendarMatcher.MatchResult) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(result.fileName)
                    .font(.subheadline.weight(.medium))
                Spacer()
                confidenceBadge(result.confidence)
            }

            if let client = result.matchedClient {
                HStack {
                    Image(systemName: "person.fill")
                        .foregroundColor(.blue)
                    Text(client.client.name)
                        .font(.caption)
                    Text("(\(matchTypeLabel(client.matchType)))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else {
                HStack {
                    Image(systemName: "person.fill.questionmark")
                        .foregroundColor(.orange)
                    Text("No client matched")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }

            if let event = result.matchedCalendarEvent {
                HStack {
                    Image(systemName: "calendar")
                        .foregroundColor(.green)
                    Text(event.event.startTime.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                    if event.dateProximityDays > 0 {
                        Text("(±\(event.dateProximityDays) days)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            } else if let date = result.bestSessionDate {
                HStack {
                    Image(systemName: "calendar.badge.clock")
                        .foregroundColor(.orange)
                    Text(date.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption)
                    Text("(from document)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else {
                HStack {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .foregroundColor(.orange)
                    Text("No date found")
                        .font(.caption)
                        .foregroundColor(.orange)
                }
            }

            if result.requiresManualReview, let reason = result.reviewReason {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.yellow)
                    Text(reason)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func confidenceBadge(_ confidence: DocumentCalendarMatcher.MatchConfidence) -> some View {
        Text(confidenceLabel(confidence))
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(confidenceColor(confidence).opacity(0.2))
            .foregroundColor(confidenceColor(confidence))
            .cornerRadius(8)
    }

    private func confidenceLabel(_ confidence: DocumentCalendarMatcher.MatchConfidence) -> String {
        switch confidence {
        case .high: return "High"
        case .medium: return "Medium"
        case .low: return "Low"
        }
    }

    private func confidenceColor(_ confidence: DocumentCalendarMatcher.MatchConfidence) -> Color {
        switch confidence {
        case .high: return .green
        case .medium: return .orange
        case .low: return .red
        }
    }

    private func matchTypeLabel(_ type: DocumentCalendarMatcher.ClientMatchType) -> String {
        switch type {
        case .exactName: return "exact"
        case .partialName: return "partial"
        case .calendarAttendee: return "calendar"
        case .inferred: return "inferred"
        }
    }

    // MARK: - Action Button

    @ViewBuilder
    private var actionButton: some View {
        switch currentPhase {
        case .selecting:
            Button(action: startBulkImport) {
                Text("Start Import & Analysis")
                    .frame(maxWidth: .infinity)
            }
            .disabled(importedFiles.isEmpty)
            .listRowBackground(importedFiles.isEmpty ? Color.gray : Color.theme.primary)
            .foregroundColor(.white)

        case .uploading, .analyzing:
            Button(action: {}) {
                HStack {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    Text(currentPhase == .uploading ? "Uploading..." : "Analyzing...")
                }
                .frame(maxWidth: .infinity)
            }
            .disabled(true)
            .listRowBackground(Color.gray)
            .foregroundColor(.white)

        case .reviewing:
            VStack(spacing: 12) {
                let reviewCount = matchResults.filter { $0.requiresManualReview }.count
                if reviewCount > 0 {
                    Button(action: { showMatchReview = true }) {
                        HStack {
                            Image(systemName: "eye.fill")
                            Text("Review \(reviewCount) Items")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .listRowBackground(Color.orange)
                    .foregroundColor(.white)
                }

                Button(action: confirmAndCreateNotes) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Create \(matchResults.count) Progress Notes")
                    }
                    .frame(maxWidth: .infinity)
                }
                .listRowBackground(Color.green)
                .foregroundColor(.white)
            }

        case .complete:
            Button(action: resetImport) {
                Text("Import More Files")
                    .frame(maxWidth: .infinity)
            }
            .listRowBackground(Color.theme.primary)
            .foregroundColor(.white)
        }
    }

    // MARK: - Actions

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

    private func startBulkImport() {
        Task {
            await performBulkImport()
        }
    }

    private func performBulkImport() async {
        currentPhase = .uploading
        isUploading = true
        uploadProgress = 0

        var uploadedDocs: [(id: String, fileName: String, content: String)] = []
        let total = Double(importedFiles.count)

        // Phase 1: Upload all files
        for index in importedFiles.indices {
            await MainActor.run {
                importedFiles[index].status = .uploading
            }

            do {
                let file = importedFiles[index]
                guard let content = file.content, let data = content.data(using: .utf8) else {
                    throw NSError(domain: "FileError", code: 0, userInfo: [NSLocalizedDescriptionKey: "Could not read file"])
                }

                let uploadedDoc = try await APIClient.shared.uploadDocument(
                    fileData: data,
                    fileName: file.name,
                    mimeType: "text/plain",
                    clientId: nil
                )

                uploadedDocs.append((id: uploadedDoc.id, fileName: file.name, content: content))

                await MainActor.run {
                    importedFiles[index].status = .uploaded
                    importedFiles[index].uploadedDocumentId = uploadedDoc.id
                    uploadProgress = Double(index + 1) / total
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
            currentPhase = .analyzing
            isProcessing = true
            processingProgress = 0
        }

        // Phase 2: AI Analysis & Calendar Matching
        do {
            // Fetch calendar events and clients for matching
            let calendarEvents = try await fetchCalendarEvents()
            let clients = try await APIClient.shared.getClients()

            // Update file statuses to analyzing
            for index in importedFiles.indices where importedFiles[index].status == .uploaded {
                await MainActor.run {
                    importedFiles[index].status = .analyzing
                }
            }

            // Run AI analysis and matching
            let results = try await DocumentCalendarMatcher.shared.matchDocuments(
                documents: uploadedDocs,
                calendarEvents: calendarEvents,
                clients: clients
            )

            await MainActor.run {
                matchResults = results
                processingProgress = 1.0

                // Update file statuses
                for result in results {
                    if let index = importedFiles.firstIndex(where: { $0.uploadedDocumentId == result.documentId }) {
                        importedFiles[index].status = .matched
                    }
                }

                isProcessing = false
                currentPhase = .reviewing
            }
        } catch {
            await MainActor.run {
                self.error = error
                isProcessing = false
                // Stay in analyzing phase so user can retry
            }
        }
    }

    private func fetchCalendarEvents() async throws -> [SyncedCalendarEvent] {
        // Try to use cached events first if they're fresh
        let cachedEvents = await SyncService.shared.getCachedCalendarEvents()
        let isFresh = await SyncService.shared.isCachedCalendarEventsFresh()

        if !cachedEvents.isEmpty && isFresh {
            print("Using \(cachedEvents.count) cached calendar events")
            return cachedEvents
        }

        // Fetch fresh events from API
        let startDate = Calendar.current.date(byAdding: .day, value: -60, to: Date()) ?? Date()
        let endDate = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()

        do {
            let events = try await APIClient.shared.getCalendarEvents(startDate: startDate, endDate: endDate)
            print("Fetched \(events.count) calendar events from API")

            // Cache for future use
            try? await SyncService.shared.refreshCalendarEventsCache()

            return events
        } catch {
            // If API fails but we have stale cache, use it
            if !cachedEvents.isEmpty {
                print("API failed, using \(cachedEvents.count) stale cached events")
                return cachedEvents
            }
            throw error
        }
    }

    private func confirmAndCreateNotes() {
        Task {
            await createProgressNotes()
        }
    }

    private func createProgressNotes() async {
        var successCount = 0

        for result in matchResults {
            do {
                // Determine session date
                let sessionDate = result.bestSessionDate ?? Date()

                // Create progress note input
                let input = CreateProgressNoteInput(
                    clientId: result.matchedClient?.client.id ?? "",
                    sessionId: result.matchedCalendarEvent?.event.linkedSessionId,
                    sessionDate: sessionDate,
                    content: buildNoteContent(from: result),
                    tags: result.analysis.suggestedTags,
                    riskLevel: determineRiskLevel(from: result.analysis),
                    progressRating: nil
                )

                // Only create if we have a client
                if !input.clientId.isEmpty {
                    _ = try await APIClient.shared.createProgressNote(input)
                    successCount += 1

                    // Update file status
                    if let index = importedFiles.firstIndex(where: { $0.uploadedDocumentId == result.documentId }) {
                        await MainActor.run {
                            importedFiles[index].status = .success
                        }
                    }
                }
            } catch {
                print("Failed to create progress note for \(result.fileName): \(error)")
                if let index = importedFiles.firstIndex(where: { $0.uploadedDocumentId == result.documentId }) {
                    await MainActor.run {
                        importedFiles[index].status = .failed
                    }
                }
            }
        }

        await MainActor.run {
            currentPhase = .complete
            successMessage = "Successfully created \(successCount) of \(matchResults.count) progress notes."
        }
    }

    private func buildNoteContent(from result: DocumentCalendarMatcher.MatchResult) -> String {
        var content = """
        ## Session Summary
        \(result.analysis.summary)

        ## Key Themes
        \(result.analysis.themes.map { "- \($0)" }.joined(separator: "\n"))

        ## Key Insights
        \(result.analysis.keyInsights.map { "- \($0)" }.joined(separator: "\n"))
        """

        if !result.analysis.actionItems.isEmpty {
            content += """

            ## Action Items
            \(result.analysis.actionItems.map { "- [ ] \($0)" }.joined(separator: "\n"))
            """
        }

        if !result.analysis.clinicalIndicators.isEmpty {
            content += """

            ## Clinical Indicators
            \(result.analysis.clinicalIndicators.map { "- [\($0.severity.rawValue.uppercased())] \($0.indicator): \($0.context)" }.joined(separator: "\n"))
            """
        }

        content += """

        ---
        *Automatically generated from: \(result.fileName)*
        *Emotional Tone: \(result.analysis.emotionalTone.rawValue)*
        *AI Confidence: \(Int(result.analysis.confidenceScore * 100))%*
        """

        return content
    }

    private func determineRiskLevel(from analysis: AIDocumentProcessor.DocumentAnalysis) -> RiskLevel {
        let maxSeverity = analysis.clinicalIndicators.map { $0.severity }.max()

        switch maxSeverity {
        case .critical:
            return .critical
        case .high:
            return .high
        case .moderate:
            return .moderate
        default:
            return .low
        }
    }

    private func resetImport() {
        importedFiles.removeAll()
        matchResults.removeAll()
        currentPhase = .selecting
        uploadProgress = 0
        processingProgress = 0
    }
}

// MARK: - Bulk Match Review View

struct BulkMatchReviewView: View {
    @Binding var matchResults: [DocumentCalendarMatcher.MatchResult]
    let onConfirm: () -> Void
    let onCancel: () -> Void

    @State private var selectedResultIndex: Int = 0
    @Environment(\.dismiss) private var dismiss

    var itemsNeedingReview: [DocumentCalendarMatcher.MatchResult] {
        matchResults.filter { $0.requiresManualReview }
    }

    var body: some View {
        NavigationStack {
            VStack {
                if itemsNeedingReview.isEmpty {
                    ContentUnavailableView(
                        "All Items Reviewed",
                        systemImage: "checkmark.circle.fill",
                        description: Text("All documents have been successfully matched.")
                    )
                } else {
                    TabView(selection: $selectedResultIndex) {
                        ForEach(Array(itemsNeedingReview.enumerated()), id: \.element.documentId) { index, result in
                            MatchReviewCard(result: result)
                                .tag(index)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .always))

                    Text("\(selectedResultIndex + 1) of \(itemsNeedingReview.count) items needing review")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.bottom)
                }
            }
            .navigationTitle("Review Matches")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Confirm All") {
                        dismiss()
                        onConfirm()
                    }
                }
            }
        }
    }
}

struct MatchReviewCard: View {
    let result: DocumentCalendarMatcher.MatchResult

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // File info
                GroupBox {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(result.fileName, systemImage: "doc.text")
                            .font(.headline)

                        if let reason = result.reviewReason {
                            Label(reason, systemImage: "exclamationmark.triangle.fill")
                                .font(.subheadline)
                                .foregroundColor(.orange)
                        }
                    }
                } label: {
                    Text("Document")
                }

                // Client match
                GroupBox {
                    VStack(alignment: .leading, spacing: 8) {
                        if let client = result.matchedClient {
                            HStack {
                                Text(client.client.name)
                                    .font(.headline)
                                Spacer()
                                Text("\(Int(client.confidence * 100))% match")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } else {
                            Text("No client matched")
                                .foregroundColor(.orange)
                            Text("Client mentions: \(result.analysis.clientMentions.joined(separator: ", "))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                } label: {
                    Label("Client", systemImage: "person.fill")
                }

                // Date match
                GroupBox {
                    VStack(alignment: .leading, spacing: 8) {
                        if let event = result.matchedCalendarEvent {
                            Text(event.event.startTime.formatted(date: .long, time: .shortened))
                                .font(.headline)
                            Text("From calendar: \(event.event.title)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else if let date = result.bestSessionDate {
                            Text(date.formatted(date: .long, time: .omitted))
                                .font(.headline)
                            Text("Extracted from document")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else {
                            Text("No date found")
                                .foregroundColor(.orange)
                            Text("Dates in document: \(result.analysis.extractedDates.joined(separator: ", "))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                } label: {
                    Label("Session Date", systemImage: "calendar")
                }

                // AI Analysis summary
                GroupBox {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(result.analysis.summary)
                            .font(.body)

                        Divider()

                        Text("Themes: \(result.analysis.themes.joined(separator: ", "))")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text("Tone: \(result.analysis.emotionalTone.rawValue)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                } label: {
                    Label("AI Analysis", systemImage: "brain")
                }
            }
            .padding()
        }
    }
}

#Preview {
    NavigationStack {
        BulkImportView()
    }
}
