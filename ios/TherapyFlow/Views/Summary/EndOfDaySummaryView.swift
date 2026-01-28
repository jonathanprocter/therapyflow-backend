import SwiftUI

/// View displaying the end-of-day summary of notes and reminders
struct EndOfDaySummaryView: View {
    @ObservedObject var summaryService = EndOfDaySummaryService.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                if let summary = summaryService.pendingSummary {
                    VStack(spacing: 24) {
                        // Header
                        headerSection(summary: summary)

                        if summary.hasContent {
                            // Client Summary Cards
                            if !summary.clientsSeen.isEmpty {
                                clientsSummarySection(clients: summary.clientsSeen)
                            }

                            // Pending Reminders
                            if !summary.reminders.isEmpty {
                                remindersSection(reminders: summary.reminders)
                            }

                            // Quick Notes
                            if !summary.quickNotes.isEmpty {
                                notesSection(notes: summary.quickNotes)
                            }
                        } else {
                            emptyStateView
                        }

                        // Actions
                        actionButtons
                    }
                    .padding()
                } else {
                    emptyStateView
                        .padding()
                }
            }
            .background(Color.theme.background)
            .navigationTitle("Daily Summary")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        summaryService.dismissSummary()
                        dismiss()
                    }
                }
            }
        }
    }

    // MARK: - Sections

    private func headerSection(summary: EndOfDaySummaryService.DailySummary) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "moon.stars.fill")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.primary)

            Text("End of Day Review")
                .font(.title2)
                .fontWeight(.bold)

            Text(summary.date, style: .date)
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)

            // Stats
            HStack(spacing: 24) {
                StatBadge(value: summary.totalNotes, label: "Notes", icon: "doc.text")
                StatBadge(value: summary.pendingReminders, label: "Reminders", icon: "bell")
                StatBadge(value: summary.clientsSeen.count, label: "Clients", icon: "person.2")
            }
            .padding(.top, 8)
        }
    }

    private func clientsSummarySection(clients: [EndOfDaySummaryService.ClientSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Clients Today", icon: "person.2.fill")

            ForEach(clients, id: \.clientId) { client in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(client.clientName)
                            .font(.headline)
                        HStack(spacing: 12) {
                            if client.notesCount > 0 {
                                Label("\(client.notesCount) notes", systemImage: "doc.text")
                                    .font(.caption)
                            }
                            if client.remindersCount > 0 {
                                Label("\(client.remindersCount) reminders", systemImage: "bell")
                                    .font(.caption)
                            }
                        }
                        .foregroundColor(Color.theme.secondaryText)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundColor(Color.theme.secondaryText)
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(12)
            }
        }
    }

    private func remindersSection(reminders: [EndOfDaySummaryService.ReminderSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Pending Reminders", icon: "bell.fill")

            ForEach(reminders, id: \.id) { reminder in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: reminder.isOverdue ? "exclamationmark.circle.fill" : "bell.fill")
                        .foregroundColor(reminder.isOverdue ? .orange : Color.theme.primary)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(reminder.content)
                            .font(.body)

                        HStack {
                            if let clientName = reminder.clientName {
                                Label(clientName, systemImage: "person")
                                    .font(.caption)
                            }
                            if let dueDate = reminder.dueDate {
                                Label(dueDate, format: .dateTime.month().day())
                                    .font(.caption)
                            }
                            if reminder.isOverdue {
                                Text("Overdue")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.orange)
                            }
                        }
                        .foregroundColor(Color.theme.secondaryText)
                    }
                    Spacer()
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(12)
            }
        }
    }

    private func notesSection(notes: [EndOfDaySummaryService.QuickNoteSummary]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Notes Recorded", icon: "doc.text.fill")

            ForEach(notes, id: \.id) { note in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        if let clientName = note.clientName {
                            Text(clientName)
                                .font(.headline)
                        } else {
                            Text("Unassigned Note")
                                .font(.headline)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                        Spacer()
                        Text(note.recordedAt, style: .time)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }

                    Text(note.content)
                        .font(.body)
                        .lineLimit(3)
                        .foregroundColor(Color.theme.primaryText)
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(12)
            }
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 64))
                .foregroundColor(.green)

            Text("All Clear!")
                .font(.title2)
                .fontWeight(.bold)

            Text("No notes or reminders recorded today.")
                .font(.body)
                .foregroundColor(Color.theme.secondaryText)
                .multilineTextAlignment(.center)
        }
        .padding(40)
    }

    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button(action: {
                summaryService.dismissSummary()
                dismiss()
            }) {
                Text("Dismiss Summary")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.theme.primary)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }

            Button(action: {
                // Navigate to quick notes view
                NotificationCenter.default.post(name: .navigateToQuickNotes, object: nil)
                dismiss()
            }) {
                Text("View All Notes")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.theme.surface)
                    .foregroundColor(Color.theme.primary)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.theme.primary, lineWidth: 1)
                    )
            }
        }
    }
}

// MARK: - Supporting Views

private struct StatBadge: View {
    let value: Int
    let label: String
    let icon: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(Color.theme.primary)
            Text("\(value)")
                .font(.title2)
                .fontWeight(.bold)
            Text(label)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
        }
    }
}

private struct SectionHeader: View {
    let title: String
    let icon: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(Color.theme.primary)
            Text(title)
                .font(.headline)
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let navigateToQuickNotes = Notification.Name("navigateToQuickNotes")
}

#Preview {
    EndOfDaySummaryView()
}
