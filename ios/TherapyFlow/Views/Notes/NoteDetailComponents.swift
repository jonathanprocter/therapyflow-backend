import SwiftUI

// MARK: - Note Detail Sections
struct NoteDetailHeaderView: View {
    let note: ProgressNote

    var body: some View {
        HStack(spacing: 16) {
            AvatarView(name: note.displayClientName, size: 56)

            VStack(alignment: .leading, spacing: 4) {
                Text(note.displayClientName)
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
}

struct NoteDetailContentView: View {
    let note: ProgressNote
    let onAddContent: () -> Void

    var body: some View {
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

                    Button(action: onAddContent) {
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
}

struct NoteDetailMetadataView: View {
    let note: ProgressNote

    var body: some View {
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
}

struct NoteDetailTagsView: View {
    let note: ProgressNote

    var body: some View {
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
}
