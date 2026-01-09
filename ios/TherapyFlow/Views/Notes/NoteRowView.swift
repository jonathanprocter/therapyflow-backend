import SwiftUI

struct NoteRowView: View {
    let note: ProgressNote

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack(spacing: 12) {
                AvatarView(name: note.displayClientName, size: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text(note.displayClientName)
                        .font(.headline)
                        .foregroundColor(Color.theme.primaryText)

                    Text(note.sessionDate.smartDateString)
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }

                Spacer()

                RiskBadge(level: note.riskLevel)
            }

            // Content preview
            if note.hasContent {
                Text(note.contentPreview)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .lineLimit(2)
            } else {
                HStack(spacing: 4) {
                    Image(systemName: "doc.badge.ellipsis")
                        .font(.caption)
                    Text("No content - placeholder note")
                        .font(.caption)
                }
                .foregroundColor(Color.theme.tertiaryText)
                .italic()
            }

            // Footer
            HStack(spacing: 12) {
                // Tags
                if !note.allTags.isEmpty {
                    TagList(tags: note.tags, aiTags: note.aiTags, maxVisible: 2)
                }

                Spacer()

                // Progress rating
                if let rating = note.progressRating {
                    ProgressRatingBadge(rating: rating)
                }

                // Status
                NoteStatusBadge(status: note.status)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
        .shadow(color: Color.theme.shadow, radius: 2, x: 0, y: 1)
    }
}

// MARK: - Progress Rating Badge
struct ProgressRatingBadge: View {
    let rating: Int

    var color: Color {
        switch rating {
        case 1...3: return Color.theme.error
        case 4...6: return Color.theme.warning
        case 7...8: return Color.theme.success
        case 9...10: return Color.theme.primary
        default: return Color.theme.tertiaryText
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.caption2)
            Text("\(rating)/10")
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.15))
        .foregroundColor(color)
        .cornerRadius(6)
    }
}

// MARK: - Compact Note Row
struct CompactNoteRow: View {
    let note: ProgressNote

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(note.displayClientName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.primaryText)

                    Spacer()

                    Text(note.sessionDate.relativeString)
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                }

                Text(note.contentPreview)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
                    .lineLimit(1)
            }

            RiskIndicator(level: note.riskLevel)
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    VStack(spacing: 16) {
        NoteRowView(note: ProgressNote(
            id: "1",
            clientId: "c1",
            therapistId: "t1",
            content: "Client reported feeling more anxious this week due to work stress. We practiced deep breathing exercises and discussed cognitive restructuring techniques.",
            sessionDate: Date(),
            tags: ["anxiety", "work-stress"],
            aiTags: ["coping-strategies"],
            riskLevel: .moderate,
            progressRating: 6,
            status: .completed,
            isPlaceholder: false,
            client: Client(id: "c1", therapistId: "t1", name: "John Doe")
        ))

        NoteRowView(note: ProgressNote(
            id: "2",
            clientId: "c2",
            therapistId: "t1",
            content: nil,
            sessionDate: Date().adding(days: -2),
            tags: [],
            aiTags: [],
            riskLevel: .low,
            status: .placeholder,
            isPlaceholder: true,
            client: Client(id: "c2", therapistId: "t1", name: "Jane Smith")
        ))
    }
    .padding()
    .background(Color.theme.background)
}
