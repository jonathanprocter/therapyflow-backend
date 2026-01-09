import SwiftUI

// MARK: - Timeline Stat Card
struct TimelineStatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                Text(value)
                    .font(.title3)
                    .fontWeight(.bold)
            }
            .foregroundColor(color)

            Text(title)
                .font(.caption2)
                .foregroundColor(Color.theme.secondaryText)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(color.opacity(0.1))
        .cornerRadius(10)
    }
}

// MARK: - Timeline Row
struct TimelineRowView: View {
    let item: TimelineItem
    let progressNotes: [ProgressNote]
    let relatedDocumentSessionIDs: Set<String>
    let relatedInsightSessionIDs: Set<String>
    var onCreateNoteForEvent: ((CalendarEvent) -> Void)?

    var body: some View {
        switch item.kind {
        case .session(let session):
            NavigationLink(destination: SessionDetailView(session: session)) {
                TimelineSessionRow(
                    session: session,
                    progressNote: progressNotes.first { $0.sessionId == session.id },
                    hasRelatedDocument: relatedDocumentSessionIDs.contains(session.id),
                    hasRelatedInsight: relatedInsightSessionIDs.contains(session.id)
                )
            }
            .buttonStyle(.plain)
        case .calendarEvent(let event):
            TimelineCalendarEventRow(
                event: event,
                hasNote: hasNoteForCalendarEvent(event),
                onCreateNote: { onCreateNoteForEvent?(event) }
            )
        case .note(let note):
            NavigationLink(destination: NoteDetailView(noteId: note.id)) {
                TimelineNoteRow(note: note)
            }
            .buttonStyle(.plain)
        case .document(let document):
            NavigationLink(destination: DocumentDetailView(documentId: document.id)) {
                DocumentTimelineRow(document: document)
            }
            .buttonStyle(.plain)
        case .insight(let insight):
            InsightTimelineRow(insight: insight)
        }
    }

    /// Check if a calendar event has an associated progress note (by date)
    private func hasNoteForCalendarEvent(_ event: CalendarEvent) -> Bool {
        let calendar = Calendar.current
        return progressNotes.contains { note in
            calendar.isDate(note.sessionDate, inSameDayAs: event.startTime)
        }
    }
}

// MARK: - Timeline Calendar Event Row
struct TimelineCalendarEventRow: View {
    let event: CalendarEvent
    let hasNote: Bool
    let onCreateNote: () -> Void

    var body: some View {
        HStack(spacing: 16) {
            // Timeline indicator
            VStack(spacing: 0) {
                Circle()
                    .fill(sourceColor)
                    .frame(width: 12, height: 12)

                Rectangle()
                    .fill(Color.theme.border)
                    .frame(width: 2)
            }
            .frame(width: 12)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(event.startTime.smartDateTimeString)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.primaryText)

                        Text(event.formattedTimeRange)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Spacer()

                    // Source badge
                    Text(event.source == .simplePractice ? "SimplePractice" : "Google Calendar")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(sourceColor.opacity(0.1))
                        .foregroundColor(sourceColor)
                        .cornerRadius(4)
                }

                // Event title
                Text(event.title)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
                    .lineLimit(2)

                // Note status and action
                HStack(spacing: 8) {
                    if hasNote {
                        Label("Note exists", systemImage: "checkmark.circle.fill")
                            .font(.caption2)
                            .foregroundColor(Color.theme.success)
                    } else if event.startTime < Date() {
                        // Past event without note - show create button
                        Button(action: onCreateNote) {
                            Label("Create Note", systemImage: "doc.badge.plus")
                                .font(.caption2)
                        }
                        .buttonStyle(.bordered)
                        .tint(Color.theme.primary)
                    }

                    if let location = event.location, !location.isEmpty {
                        Spacer()
                        Label(location, systemImage: "location")
                            .font(.caption2)
                            .foregroundColor(Color.theme.tertiaryText)
                            .lineLimit(1)
                    }
                }
            }
            .padding(.vertical, 12)
            .padding(.trailing, 16)
        }
        .padding(.leading, 16)
        .background(Color.theme.surface)
    }

    private var sourceColor: Color {
        switch event.source {
        case .simplePractice:
            return .purple
        case .google:
            return .blue
        case .therapyFlow:
            return Color.theme.primary
        }
    }
}

// MARK: - Timeline Session Row
struct TimelineSessionRow: View {
    let session: Session
    let progressNote: ProgressNote?
    let hasRelatedDocument: Bool
    let hasRelatedInsight: Bool

    var body: some View {
        HStack(spacing: 16) {
            VStack(spacing: 0) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)

                Rectangle()
                    .fill(Color.theme.border)
                    .frame(width: 2)
            }
            .frame(width: 12)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(session.scheduledAt.smartDateTimeString)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.primaryText)

                        Text(session.formattedTimeRange)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Spacer()

                    SessionStatusBadge(status: session.status)
                }

                HStack(spacing: 8) {
                    SessionTypeBadge(type: session.sessionType)
                    ProgressNoteStatusBadge(status: session.progressNoteStatus, hasPlaceholder: session.hasProgressNotePlaceholder)

                    if hasRelatedDocument {
                        TimelineIndicatorBadge(title: "DOC", icon: "doc.text")
                    }
                    if hasRelatedInsight {
                        TimelineIndicatorBadge(title: "AI", icon: "sparkles")
                    }
                }

                if let note = progressNote, let content = note.content, !content.isEmpty {
                    Text(content.prefix(100) + (content.count > 100 ? "..." : ""))
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                        .lineLimit(2)
                        .padding(.top, 4)
                }
            }
            .padding(.vertical, 12)

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding(.horizontal, 16)
        .background(Color.theme.surface)
    }

    private var statusColor: Color {
        switch session.status {
        case .completed:
            return Color.theme.success
        case .scheduled:
            return session.scheduledAt >= Date() ? Color.theme.accent : Color.theme.warning
        case .cancelled:
            return Color.theme.tertiaryText
        case .noShow:
            return Color.theme.error
        case .unknown:
            return Color.theme.tertiaryText
        }
    }
}

// MARK: - Timeline Note Row
struct TimelineNoteRow: View {
    let note: ProgressNote

    var body: some View {
        HStack(spacing: 16) {
            VStack(spacing: 0) {
                Circle()
                    .fill(Color.theme.info)
                    .frame(width: 12, height: 12)

                Rectangle()
                    .fill(Color.theme.border)
                    .frame(width: 2)
            }
            .frame(width: 12)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(note.sessionDate.smartDateTimeString)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.primaryText)

                        Text("Progress Note")
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Spacer()

                    RiskBadge(level: note.riskLevel)
                }

                HStack(spacing: 8) {
                    NoteStatusBadge(status: note.status)
                    if note.requiresManualReview {
                        TimelineIndicatorBadge(title: "REVIEW", icon: "exclamationmark.triangle")
                    }
                }

                if note.hasContent {
                    Text(note.contentPreview)
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                        .lineLimit(2)
                        .padding(.top, 4)
                }
            }
            .padding(.vertical, 12)

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding(.horizontal, 16)
        .background(Color.theme.surface)
    }
}

// MARK: - Timeline Document Row
struct DocumentTimelineRow: View {
    let document: Document

    var body: some View {
        HStack(spacing: 16) {
            VStack(spacing: 0) {
                Circle()
                    .fill(documentStatusColor)
                    .frame(width: 12, height: 12)

                Rectangle()
                    .fill(Color.theme.border)
                    .frame(width: 2)
            }
            .frame(width: 12)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(document.uploadedAt.smartDateTimeString)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.primaryText)

                        Text("Document")
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Spacer()

                    DocumentStatusBadge(status: document.status)
                }

                HStack(spacing: 8) {
                    TimelineIndicatorBadge(title: document.fileExtension.uppercased(), icon: document.icon)
                    if let docType = document.documentType, !docType.isEmpty {
                        Text(docType.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }

                Text(document.fileName)
                    .font(.caption)
                    .foregroundColor(Color.theme.tertiaryText)
                    .lineLimit(1)
            }
            .padding(.vertical, 12)

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding(.horizontal, 16)
        .background(Color.theme.surface)
    }

    private var documentStatusColor: Color {
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

// MARK: - Timeline Insight Row
struct InsightTimelineRow: View {
    let insight: AIInsight

    var body: some View {
        HStack(spacing: 16) {
            VStack(spacing: 0) {
                Circle()
                    .fill(insight.type.color)
                    .frame(width: 12, height: 12)

                Rectangle()
                    .fill(Color.theme.border)
                    .frame(width: 2)
            }
            .frame(width: 12)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(insight.createdAt.smartDateTimeString)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.primaryText)

                        Text("AI Insight")
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Spacer()

                    TimelineIndicatorBadge(title: insight.priority.displayName.uppercased(), icon: insight.type.icon)
                }

                Text(insight.title)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.primaryText)

                Text(insight.description)
                    .font(.caption)
                    .foregroundColor(Color.theme.tertiaryText)
                    .lineLimit(2)
            }
            .padding(.vertical, 12)

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding(.horizontal, 16)
        .background(Color.theme.surface)
    }
}

// MARK: - Timeline Indicator Badge
struct TimelineIndicatorBadge: View {
    let title: String
    let icon: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(title)
                .font(.caption2)
                .fontWeight(.semibold)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(Color.theme.surfaceSecondary)
        .foregroundColor(Color.theme.secondaryText)
        .cornerRadius(6)
    }
}

// MARK: - Timeline Item
struct TimelineItem: Identifiable {
    enum Kind {
        case session(Session)
        case calendarEvent(CalendarEvent)  // Google Calendar events
        case note(ProgressNote)
        case document(Document)
        case insight(AIInsight)
    }

    let kind: Kind

    var id: String {
        switch kind {
        case .session(let session):
            return "session-\(session.id)"
        case .calendarEvent(let event):
            return "calendar-\(event.id)"
        case .note(let note):
            return "note-\(note.id)"
        case .document(let document):
            return "document-\(document.id)"
        case .insight(let insight):
            return "insight-\(insight.id)"
        }
    }

    var date: Date {
        switch kind {
        case .session(let session):
            return session.scheduledAt
        case .calendarEvent(let event):
            return event.startTime
        case .note(let note):
            return note.sessionDate
        case .document(let document):
            return document.uploadedAt
        case .insight(let insight):
            return insight.createdAt
        }
    }

    /// Check if this is a calendar event (from Google Calendar)
    var isCalendarEvent: Bool {
        if case .calendarEvent = kind {
            return true
        }
        return false
    }

    /// Get the source label for display
    var sourceLabel: String {
        switch kind {
        case .session(let session):
            return session.isSimplePracticeEvent ? "SimplePractice" : "TherapyFlow"
        case .calendarEvent(let event):
            return event.source == .simplePractice ? "SimplePractice" : "Google Calendar"
        case .note:
            return "Progress Note"
        case .document:
            return "Document"
        case .insight:
            return "AI Insight"
        }
    }
}
