import SwiftUI

struct DocumentDetailView: View {
    let documentId: String

    @State private var document: Document?
    @State private var isLoading = true
    @State private var error: Error?
    @State private var analysis: AIDocumentProcessor.DocumentAnalysis?
    @State private var isAnalyzing = false
    @State private var analysisError: Error?
    @State private var selectedTab = 0

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        Group {
            if isLoading {
                LoadingView()
            } else if let error = error {
                ErrorView(error: error, onRetry: loadDocument)
            } else if let document = document {
                documentContent(document)
            }
        }
        .navigationTitle(document?.filename ?? "Document")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadDocumentAsync()
        }
    }

    @ViewBuilder
    private func documentContent(_ document: Document) -> some View {
        if horizontalSizeClass == .regular {
            // iPad: Side by side
            HStack(spacing: 0) {
                documentInfoPanel(document)
                    .frame(maxWidth: .infinity)

                Divider()

                aiAnalysisPanel(document)
                    .frame(width: 400)
            }
        } else {
            // iPhone: Tabbed
            VStack(spacing: 0) {
                Picker("View", selection: $selectedTab) {
                    Text("Details").tag(0)
                    Text("AI Analysis").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                if selectedTab == 0 {
                    documentInfoPanel(document)
                } else {
                    aiAnalysisPanel(document)
                }
            }
        }
    }

    // MARK: - Document Info Panel

    private func documentInfoPanel(_ document: Document) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header card
                VStack(spacing: 16) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.theme.primaryLight)
                            .frame(width: 80, height: 80)

                        Image(systemName: documentIcon(for: document))
                            .font(.system(size: 36))
                            .foregroundColor(Color.theme.primary)
                    }

                    Text(document.filename)
                        .font(.headline)
                        .foregroundColor(Color.theme.primaryText)
                        .multilineTextAlignment(.center)

                    DocumentStatusBadge(status: document.status)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(16)

                // Metadata
                VStack(alignment: .leading, spacing: 16) {
                    Text("Details")
                        .font(.headline)
                        .foregroundColor(Color.theme.primaryText)

                    DetailRow(label: "Uploaded", value: document.uploadedAt.dateTimeString)
                    DetailRow(label: "Type", value: document.mimeType ?? "Unknown")
                    DetailRow(label: "Size", value: document.formattedFileSize)

                    if let clientName = document.clientName {
                        DetailRow(label: "Client", value: clientName)
                    }

                    if !document.tags.isEmpty {
                        let tags = document.tags
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Tags")
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)

                            FlowLayout(spacing: 8) {
                                ForEach(tags, id: \.self) { tag in
                                    TagChip(tag: tag)
                                }
                            }
                        }
                    }
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(16)

                // Content preview
                if let content = document.extractedText, !content.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Content Preview")
                            .font(.headline)
                            .foregroundColor(Color.theme.primaryText)

                        Text(String(content.prefix(2000)))
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(Color.theme.secondaryText)
                            .lineLimit(nil)
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(16)
                }
            }
            .padding()
        }
        .background(Color.theme.background)
    }

    // MARK: - AI Analysis Panel

    private func aiAnalysisPanel(_ document: Document) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Analysis header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("AI Analysis")
                            .font(.headline)
                            .foregroundColor(Color.theme.primaryText)

                        if let analysis = analysis {
                            Text("Confidence: \(Int(analysis.confidenceScore * 100))%")
                                .font(.caption)
                                .foregroundColor(Color.theme.success)
                        }
                    }

                    Spacer()

                    Button(action: runAnalysis) {
                        HStack(spacing: 6) {
                            if isAnalyzing {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "sparkles")
                            }
                            Text(analysis == nil ? "Analyze" : "Re-analyze")
                        }
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.theme.primary)
                        .cornerRadius(8)
                    }
                    .disabled(isAnalyzing || document.extractedText == nil)
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(16)

                if let error = analysisError {
                    AnalysisErrorView(error: error)
                }

                if let analysis = analysis {
                    analysisContent(analysis)
                } else if !isAnalyzing {
                    emptyAnalysisView(document)
                }

                if isAnalyzing {
                    AnalyzingView()
                }
            }
            .padding()
        }
        .background(Color.theme.background)
    }

    @ViewBuilder
    private func analysisContent(_ analysis: AIDocumentProcessor.DocumentAnalysis) -> some View {
        // Summary
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "doc.text")
                    .foregroundColor(Color.theme.primary)
                Text("Summary")
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }

            Text(analysis.summary)
                .font(.body)
                .foregroundColor(Color.theme.secondaryText)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.surface)
        .cornerRadius(12)

        // Document Type & Tone
        HStack(spacing: 12) {
            AnalysisCard(
                icon: "doc.badge.gearshape",
                title: "Type",
                value: analysis.documentType.rawValue.replacingOccurrences(of: "_", with: " ").capitalized,
                color: Color.theme.primary
            )

            AnalysisCard(
                icon: "face.smiling",
                title: "Tone",
                value: analysis.emotionalTone.rawValue.capitalized,
                color: toneColor(for: analysis.emotionalTone)
            )
        }

        // Themes
        if !analysis.themes.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "tag")
                        .foregroundColor(Color.theme.accent)
                    Text("Themes")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }

                FlowLayout(spacing: 8) {
                    ForEach(analysis.themes, id: \.self) { theme in
                        ThemeChip(theme: theme)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.surface)
            .cornerRadius(12)
        }

        // Key Insights
        if !analysis.keyInsights.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "lightbulb")
                        .foregroundColor(Color.theme.warning)
                    Text("Key Insights")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }

                ForEach(analysis.keyInsights, id: \.self) { insight in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "arrow.right.circle.fill")
                            .foregroundColor(Color.theme.primary)
                            .font(.caption)

                        Text(insight)
                            .font(.subheadline)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.surface)
            .cornerRadius(12)
        }

        // Clinical Indicators
        if !analysis.clinicalIndicators.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundColor(Color.theme.error)
                    Text("Clinical Indicators")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }

                ForEach(Array(analysis.clinicalIndicators.enumerated()), id: \.offset) { _, indicator in
                    ClinicalIndicatorRow(indicator: indicator)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.surface)
            .cornerRadius(12)
        }

        // Action Items
        if !analysis.actionItems.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "checklist")
                        .foregroundColor(Color.theme.success)
                    Text("Action Items")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }

                ForEach(analysis.actionItems, id: \.self) { item in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "square")
                            .foregroundColor(Color.theme.secondaryText)
                            .font(.caption)

                        Text(item)
                            .font(.subheadline)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.surface)
            .cornerRadius(12)
        }

        // Suggested Tags
        if !analysis.suggestedTags.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "tag.fill")
                        .foregroundColor(Color.theme.accent)
                    Text("Suggested Tags")
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    Spacer()

                    Button("Apply All") {
                        applyTags(analysis.suggestedTags)
                    }
                    .font(.caption)
                    .foregroundColor(Color.theme.primary)
                }

                FlowLayout(spacing: 8) {
                    ForEach(analysis.suggestedTags, id: \.self) { tag in
                        SuggestedTagChip(tag: tag) {
                            applyTags([tag])
                        }
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.theme.surface)
            .cornerRadius(12)
        }
    }

    private func emptyAnalysisView(_ document: Document) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.primaryLight)

            Text("No Analysis Yet")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            Text(document.extractedText == nil
                 ? "Document content is not available for analysis"
                 : "Tap 'Analyze' to run AI-powered analysis on this document")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(maxWidth: .infinity)
        .background(Color.theme.surface)
        .cornerRadius(16)
    }

    // MARK: - Helper Views

    private func toneColor(for tone: AIDocumentProcessor.EmotionalTone) -> Color {
        switch tone {
        case .positive, .hopeful:
            return Color.theme.success
        case .negative, .depressed, .distressed:
            return Color.theme.error
        case .anxious:
            return Color.theme.warning
        case .neutral, .mixed:
            return Color.theme.secondaryText
        }
    }

    // MARK: - Actions

    private func runAnalysis() {
        guard let content = document?.extractedText else { return }

        isAnalyzing = true
        analysisError = nil

        Task {
            do {
                let result = try await AIDocumentProcessor.shared.analyzeDocument(
                    content: content,
                    fileName: document?.filename
                )
                await MainActor.run {
                    analysis = result
                    isAnalyzing = false
                }
            } catch {
                await MainActor.run {
                    analysisError = error
                    isAnalyzing = false
                }
            }
        }
    }

    private func applyTags(_ tags: [String]) {
        // Apply tags to document
        // In production, this would call the API
    }

    private func loadDocument() {
        Task {
            await loadDocumentAsync()
        }
    }

    private func loadDocumentAsync() async {
        isLoading = true
        error = nil

        do {
            let fetchedDocument = try await APIClient.shared.getDocument(id: documentId)
            await MainActor.run {
                document = fetchedDocument
                isLoading = false
            }
        } catch {
            await MainActor.run {
                self.error = error
                isLoading = false
            }
        }
    }

    private func documentIcon(for document: Document) -> String {
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

    private func formatFileSize(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

// MARK: - Supporting Views

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)

            Spacer()

            Text(value)
                .font(.subheadline)
                .foregroundColor(Color.theme.primaryText)
        }
    }
}

struct AnalysisCard: View {
    let icon: String
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Text(title)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.primaryText)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct ThemeChip: View {
    let theme: String

    var body: some View {
        Text(theme)
            .font(.caption)
            .fontWeight(.medium)
            .foregroundColor(Color.theme.primary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.theme.primaryLight)
            .cornerRadius(16)
    }
}

struct TagChip: View {
    let tag: String

    var body: some View {
        Text(tag)
            .font(.caption)
            .foregroundColor(Color.theme.secondaryText)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color.theme.surfaceSecondary)
            .cornerRadius(8)
    }
}

struct SuggestedTagChip: View {
    let tag: String
    let onApply: () -> Void

    var body: some View {
        Button(action: onApply) {
            HStack(spacing: 4) {
                Text(tag)
                Image(systemName: "plus.circle.fill")
                    .font(.caption2)
            }
            .font(.caption)
            .foregroundColor(Color.theme.accent)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.theme.accent.opacity(0.15))
            .cornerRadius(16)
        }
    }
}

struct ClinicalIndicatorRow: View {
    let indicator: AIDocumentProcessor.ClinicalIndicator

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(indicator.indicator)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                SeverityBadge(severity: indicator.severity)
            }

            Text(indicator.context)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
                .lineLimit(2)
        }
        .padding()
        .background(severityColor.opacity(0.1))
        .cornerRadius(8)
    }

    private var severityColor: Color {
        switch indicator.severity {
        case .low:
            return Color.theme.success
        case .moderate:
            return Color.theme.warning
        case .high:
            return Color.orange
        case .critical:
            return Color.theme.error
        }
    }
}

struct SeverityBadge: View {
    let severity: AIDocumentProcessor.ClinicalIndicator.Severity

    var body: some View {
        Text(severity.rawValue.uppercased())
            .font(.caption2)
            .fontWeight(.bold)
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .cornerRadius(4)
    }

    private var color: Color {
        switch severity {
        case .low:
            return Color.theme.success
        case .moderate:
            return Color.theme.warning
        case .high:
            return Color.orange
        case .critical:
            return Color.theme.error
        }
    }
}

struct AnalysisErrorView: View {
    let error: Error

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(Color.theme.error)

            VStack(alignment: .leading, spacing: 4) {
                Text("Analysis Failed")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)

                Text(error.localizedDescription)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Spacer()
        }
        .padding()
        .background(Color.theme.error.opacity(0.1))
        .cornerRadius(12)
    }
}

struct AnalyzingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)

            Text("Analyzing document...")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)

            Text("This may take a few moments")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding(40)
        .frame(maxWidth: .infinity)
        .background(Color.theme.surface)
        .cornerRadius(16)
    }
}

// MARK: - API Extension

extension APIClient {
    func getDocument(id: String) async throws -> Document {
        try await request(endpoint: "/api/documents/\(id)")
    }
}

#Preview {
    NavigationStack {
        DocumentDetailView(documentId: "test-id")
    }
}
