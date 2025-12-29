import SwiftUI

struct SearchResultRow: View {
    let result: SearchResult

    var body: some View {
        NavigationLink(destination: destinationView) {
            VStack(alignment: .leading, spacing: 12) {
                // Header
                HStack(spacing: 12) {
                    // Type icon
                    ZStack {
                        Circle()
                            .fill(result.type.color.opacity(0.15))
                            .frame(width: 40, height: 40)

                        Image(systemName: result.type.icon)
                            .font(.body)
                            .foregroundColor(result.type.color)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(result.title)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.primaryText)
                            .lineLimit(1)

                        HStack(spacing: 8) {
                            Text(result.type.displayName)
                                .font(.caption)
                                .foregroundColor(result.type.color)

                            if let clientName = result.clientName {
                                Text("•")
                                    .foregroundColor(Color.theme.tertiaryText)
                                Text(clientName)
                                    .font(.caption)
                                    .foregroundColor(Color.theme.secondaryText)
                            }

                            if let sessionDate = result.sessionDate {
                                Text("•")
                                    .foregroundColor(Color.theme.tertiaryText)

                                Text(sessionDate.relativeString)
                                    .font(.caption)
                                    .foregroundColor(Color.theme.tertiaryText)
                            }
                        }
                    }

                    Spacer()

                    // Relevance score
                    VStack(spacing: 2) {
                        Text("\(Int(result.relevanceScore * 100))%")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.primary)

                        Text("match")
                            .font(.caption2)
                            .foregroundColor(Color.theme.tertiaryText)
                    }
                }

                // Snippet with highlighted matches
                if let matchedText = result.matchedText {
                    Text(matchedText)
                        .font(.subheadline)
                        .foregroundColor(Color.theme.primary)
                        .fontWeight(.medium)
                        .lineLimit(2)
                }
                
                Text(result.content)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .lineLimit(3)

                // Tags/Themes
                if let themes = result.themes, !themes.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(themes.prefix(5), id: \.self) { theme in
                                Text(theme)
                                    .font(.caption2)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Color.theme.primaryLight)
                                    .foregroundColor(Color.theme.primaryDark)
                                    .cornerRadius(4)
                            }

                            if themes.count > 5 {
                                Text("+\(themes.count - 5)")
                                    .font(.caption2)
                                    .foregroundColor(Color.theme.tertiaryText)
                            }
                        }
                    }
                }
            }
            .padding()
            .background(Color.theme.surface)
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Destination View
    @ViewBuilder
    private var destinationView: some View {
        switch result.type {
        case .client:
            ClientDetailView(clientId: result.id)
        case .note:
            NoteDetailView(noteId: result.id)
        case .session:
            // TODO: Need to fetch Session object from result.id
            EmptyView() // Placeholder until Session object can be fetched
        case .document:
            DocumentDetailView(documentId: result.id)
        }
    }
}

// MARK: - Search Result Type Extension
extension SearchResultType {
    var color: Color {
        switch self {
        case .client:
            return Color.theme.primary
        case .note:
            return Color.theme.accent
        case .session:
            return Color.theme.success
        case .document:
            return Color.theme.warning
        }
    }
}


#Preview {
    NavigationStack {
        VStack {
            SearchResultRow(result: SearchResult(
                id: "1",
                type: .note,
                title: "Session with John Doe - Anxiety Management",
                content: "Client discussed ongoing anxiety symptoms and reported improvement with breathing exercises. We explored cognitive distortions related to work stress.",
                matchedText: "anxiety symptoms and breathing exercises",
                relevanceScore: 0.92,
                clientName: "John Doe",
                sessionDate: Date().addingTimeInterval(-86400),
                themes: ["anxiety", "cbt", "progress"],
                riskLevel: nil
            ))

            SearchResultRow(result: SearchResult(
                id: "2",
                type: .client,
                title: "Jane Smith",
                content: "Active client since January 2024. Primary concerns: depression, relationship issues.",
                matchedText: "depression",
                relevanceScore: 0.85,
                clientName: nil,
                sessionDate: Date(),
                themes: nil,
                riskLevel: nil
            ))
        }
        .padding()
        .background(Color.theme.background)
    }
}
