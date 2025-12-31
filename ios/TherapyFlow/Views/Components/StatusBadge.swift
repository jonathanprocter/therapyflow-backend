import SwiftUI

// MARK: - Generic Status Badge
struct StatusBadge<Status: RawRepresentable>: View where Status.RawValue == String {
    let status: Status
    let color: Color
    let displayName: String

    init(status: Status, color: Color, displayName: String) {
        self.status = status
        self.color = color
        self.displayName = displayName
    }

    var body: some View {
        Text(displayName)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .cornerRadius(6)
    }
}

// MARK: - Client Status Badge
struct ClientStatusBadge: View {
    let status: ClientStatus

    var body: some View {
        StatusBadge(
            status: status,
            color: status.themeColor,
            displayName: status.displayName
        )
    }
}

// MARK: - Session Status Badge
struct SessionStatusBadge: View {
    let status: SessionStatus

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(status.themeColor)
                .frame(width: 6, height: 6)

            Text(status.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(status.themeColor.opacity(0.15))
        .foregroundColor(status.themeColor)
        .cornerRadius(6)
    }
}

// MARK: - Note Status Badge
struct NoteStatusBadge: View {
    let status: NoteStatus

    var body: some View {
        StatusBadge(
            status: status,
            color: status.themeColor,
            displayName: status.displayName
        )
    }
}

// MARK: - Session Type Badge
struct SessionTypeBadge: View {
    let type: SessionType

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: type.icon)
                .font(.caption2)

            Text(type.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.theme.accent.opacity(0.15))
        .foregroundColor(Color.theme.accent)
        .cornerRadius(6)
    }
}

// MARK: - Progress Note Status Badge
struct ProgressNoteStatusBadge: View {
    let status: ProgressNoteStatusType
    var hasPlaceholder: Bool = false

    private var displayText: String {
        switch status {
        case .processed:
            return "Completed"
        case .uploaded:
            return "Processing"
        case .needsReview:
            return "Needs Review"
        case .pending:
            return hasPlaceholder ? "Awaiting Note" : "No Note"
        }
    }

    private var icon: String {
        switch status {
        case .processed:
            return "checkmark.circle.fill"
        case .uploaded:
            return "arrow.triangle.2.circlepath"
        case .needsReview:
            return "exclamationmark.circle.fill"
        case .pending:
            return hasPlaceholder ? "clock.fill" : "doc"
        }
    }

    private var color: Color {
        switch status {
        case .processed:
            return Color.theme.success
        case .uploaded:
            return Color.theme.accent
        case .needsReview:
            return Color.theme.warning
        case .pending:
            return hasPlaceholder ? Color.theme.primary : Color.theme.tertiaryText
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)

            Text(displayText)
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

// MARK: - Priority Badge
struct PriorityBadge: View {
    let priority: InsightPriority

    var body: some View {
        HStack(spacing: 4) {
            if priority == .urgent {
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.caption2)
            }

            Text(priority.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(priority.themeColor.opacity(0.15))
        .foregroundColor(priority.themeColor)
        .cornerRadius(6)
    }
}

// MARK: - Tag Badge
struct TagBadge: View {
    let tag: String
    var isAI: Bool = false

    var body: some View {
        HStack(spacing: 4) {
            if isAI {
                Image(systemName: "sparkles")
                    .font(.caption2)
            }

            Text(tag)
                .font(.caption)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(isAI ? Color.theme.accent.opacity(0.15) : Color.theme.primaryLight)
        .foregroundColor(isAI ? Color.theme.accent : Color.theme.primaryDark)
        .cornerRadius(6)
    }
}

// MARK: - Tag List
struct TagList: View {
    let tags: [String]
    var aiTags: [String] = []
    var maxVisible: Int = 3

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(tags.prefix(maxVisible)), id: \.self) { tag in
                TagBadge(tag: tag)
            }

            ForEach(Array(aiTags.prefix(max(0, maxVisible - tags.count))), id: \.self) { tag in
                TagBadge(tag: tag, isAI: true)
            }

            let totalRemaining = max(0, (tags.count + aiTags.count) - maxVisible)
            if totalRemaining > 0 {
                Text("+\(totalRemaining)")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        HStack(spacing: 12) {
            ClientStatusBadge(status: .active)
            ClientStatusBadge(status: .inactive)
            ClientStatusBadge(status: .discharged)
        }

        HStack(spacing: 12) {
            SessionStatusBadge(status: .scheduled)
            SessionStatusBadge(status: .completed)
            SessionStatusBadge(status: .cancelled)
        }

        HStack(spacing: 12) {
            NoteStatusBadge(status: .placeholder)
            NoteStatusBadge(status: .completed)
        }

        HStack(spacing: 12) {
            ProgressNoteStatusBadge(status: .pending, hasPlaceholder: false)
            ProgressNoteStatusBadge(status: .pending, hasPlaceholder: true)
            ProgressNoteStatusBadge(status: .processed)
        }

        HStack(spacing: 12) {
            SessionTypeBadge(type: .individual)
            SessionTypeBadge(type: .couples)
            SessionTypeBadge(type: .family)
        }

        HStack(spacing: 12) {
            PriorityBadge(priority: .low)
            PriorityBadge(priority: .medium)
            PriorityBadge(priority: .high)
            PriorityBadge(priority: .urgent)
        }

        TagList(
            tags: ["anxiety", "depression", "CBT"],
            aiTags: ["grief", "relationship"]
        )
    }
    .padding()
}
