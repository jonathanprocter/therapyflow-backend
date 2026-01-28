import SwiftUI

// MARK: - Session Detail Sections
struct SessionDetailHeaderView: View {
    let session: Session

    var body: some View {
        HStack(spacing: 16) {
            if let clientId = session.clientId as String? {
                NavigationLink(destination: ClientDetailView(clientId: clientId)) {
                    HStack(spacing: 12) {
                        AvatarView(name: session.client?.name ?? "C", size: 56)

                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 4) {
                                Text(session.client?.name ?? "Client")
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color.theme.primaryText)

                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.tertiaryText)
                            }

                            Text("Tap to view client profile")
                                .font(.caption)
                                .foregroundColor(Color.theme.primary)
                        }
                    }
                }
                .buttonStyle(.plain)
            } else {
                HStack(spacing: 12) {
                    AvatarView(name: session.client?.name ?? "C", size: 56)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(session.client?.name ?? "Client")
                            .font(.title3)
                            .fontWeight(.bold)
                            .foregroundColor(Color.theme.primaryText)

                        Text(session.scheduledAt.smartDateTimeString)
                            .font(.subheadline)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                SessionStatusBadge(status: session.status)

                Text(session.scheduledAt.smartDateTimeString)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct SessionDetailDetailsView: View {
    let session: Session

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Session Details")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            VStack(spacing: 12) {
                MetadataRow(icon: "calendar", title: "Date", value: session.scheduledAt.longDate)
                MetadataRow(icon: "clock", title: "Time", value: session.formattedTimeRange)
                MetadataRow(icon: "hourglass", title: "Duration", value: "\(session.duration) minutes")

                HStack(spacing: 12) {
                    Image(systemName: session.sessionType.icon)
                        .font(.body)
                        .foregroundColor(Color.theme.primary)
                        .frame(width: 20)

                    Text("Type")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)

                    Spacer()

                    SessionTypeBadge(type: session.sessionType)
                }

                SessionDetailProgressNoteStatusRow(
                    status: session.progressNoteStatus,
                    hasPlaceholder: session.hasProgressNotePlaceholder
                )

                if let notes = session.notes, !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Notes")
                            .font(.subheadline)
                            .foregroundColor(Color.theme.secondaryText)

                        if notes.lowercased().contains("client deactivated") {
                            // Show auto-generated deactivation notes with warning style
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(Color.theme.warning)
                                Text(notes)
                                    .font(.body)
                                    .foregroundColor(Color.theme.warning)
                                    .italic()
                            }
                            Text("This note was auto-generated when the client status changed. Edit the session to update.")
                                .font(.caption)
                                .foregroundColor(Color.theme.tertiaryText)
                        } else {
                            Text(notes)
                                .font(.body)
                                .foregroundColor(Color.theme.primaryText)
                        }
                    }
                    .padding(.top, 8)
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct SessionDetailProgressNoteStatusRow: View {
    let status: ProgressNoteStatusType
    let hasPlaceholder: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: progressNoteIcon)
                .font(.body)
                .foregroundColor(progressNoteColor)
                .frame(width: 20)

            Text("Progress Note")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)

            Spacer()

            ProgressNoteStatusBadge(status: status, hasPlaceholder: hasPlaceholder)
        }
    }

    private var progressNoteIcon: String {
        switch status {
        case .processed:
            return "checkmark.circle.fill"
        case .uploaded:
            return "arrow.up.circle.fill"
        case .needsReview:
            return "exclamationmark.circle.fill"
        case .pending:
            return hasPlaceholder ? "doc.badge.clock" : "doc"
        case .unknown:
            return "questionmark.circle"
        }
    }

    private var progressNoteColor: Color {
        switch status {
        case .processed:
            return Color.theme.success
        case .uploaded:
            return Color.theme.accent
        case .needsReview:
            return Color.theme.warning
        case .pending:
            return hasPlaceholder ? Color.theme.primary : Color.theme.tertiaryText
        case .unknown:
            return Color.theme.tertiaryText
        }
    }
}

struct SessionDetailPrepView: View {
    let sessionPrep: SessionPrep?
    let isLoadingPrep: Bool
    let onGenerate: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundColor(Color.theme.primary)
                    Text("AI Session Prep")
                        .font(.headline)
                        .foregroundColor(Color.theme.primaryText)
                }

                Spacer()

                if isLoadingPrep {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }

            if let prep = sessionPrep {
                VStack(alignment: .leading, spacing: 16) {
                    if let summary = prep.prep.summary {
                        PrepSection(title: "Summary", content: summary)
                    }

                    if let themes = prep.prep.keyThemes, !themes.isEmpty {
                        PrepListSection(title: "Key Themes", items: themes)
                    }

                    if let topics = prep.prep.suggestedTopics, !topics.isEmpty {
                        PrepListSection(title: "Suggested Topics", items: topics)
                    }

                    if let risks = prep.prep.riskFactors, !risks.isEmpty {
                        PrepListSection(
                            title: "Risk Factors",
                            items: risks,
                            icon: "exclamationmark.triangle",
                            color: Color.theme.warning
                        )
                    }
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "sparkles")
                        .font(.largeTitle)
                        .foregroundColor(Color.theme.primaryLight)

                    Text("Generate AI-powered session preparation")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                        .multilineTextAlignment(.center)

                    Button(action: onGenerate) {
                        Text("Generate Prep")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(Color.theme.primary)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                    }
                    .disabled(isLoadingPrep)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct SessionDetailActionsView: View {
    let session: Session
    var onMarkComplete: (() -> Void)?
    var onMarkNoShow: (() -> Void)?
    var onCancelSession: (() -> Void)?
    var onReschedule: (() -> Void)?
    var onCreateNote: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Actions")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            VStack(spacing: 8) {
                ActionButton(icon: "doc.badge.plus", title: "Create Note", color: Color.theme.primary) {
                    onCreateNote?()
                }

                if session.status == .scheduled {
                    ActionButton(icon: "checkmark.circle", title: "Mark Complete", color: Color.theme.success) {
                        onMarkComplete?()
                    }

                    ActionButton(icon: "person.fill.xmark", title: "Mark No Show", color: .red) {
                        onMarkNoShow?()
                    }

                    ActionButton(icon: "xmark.circle", title: "Cancel Session", color: .orange) {
                        onCancelSession?()
                    }
                }

                if session.status == .cancelled || session.status == .noShow {
                    ActionButton(icon: "calendar.badge.plus", title: "Reschedule Session", color: Color.theme.success) {
                        onReschedule?()
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

// MARK: - Prep Section View
struct PrepSection: View {
    let title: String
    let content: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.secondaryText)

            Text(content)
                .font(.body)
                .foregroundColor(Color.theme.primaryText)
        }
    }
}

struct PrepListSection: View {
    let title: String
    let items: [String]
    var icon: String = "checkmark.circle"
    var color: Color = Color.theme.primary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(Color.theme.secondaryText)

            VStack(alignment: .leading, spacing: 6) {
                ForEach(items, id: \.self) { item in
                    HStack(spacing: 8) {
                        Image(systemName: icon)
                            .font(.caption)
                            .foregroundColor(color)

                        Text(item)
                            .font(.subheadline)
                            .foregroundColor(Color.theme.primaryText)
                    }
                }
            }
        }
    }
}

// MARK: - Action Button
struct ActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.body)
                    .foregroundColor(color)
                    .frame(width: 24)

                Text(title)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(Color.theme.tertiaryText)
            }
            .padding()
            .background(Color.theme.surfaceSecondary)
            .cornerRadius(10)
        }
    }
}
