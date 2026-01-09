import SwiftUI

/// View for managing recent quick notes and reminders
struct RecentQuickNotesView: View {
    @ObservedObject private var quickNoteService = QuickNoteService.shared
    @State private var selectedFilter: NoteFilter = .all
    @State private var showingDeleteConfirmation = false
    @State private var noteToDelete: QuickNote?

    enum NoteFilter: String, CaseIterable {
        case all = "All"
        case notes = "Notes"
        case reminders = "Reminders"
        case pending = "Pending"

        var icon: String {
            switch self {
            case .all: return "list.bullet"
            case .notes: return "doc.text"
            case .reminders: return "bell"
            case .pending: return "clock"
            }
        }
    }

    private var filteredNotes: [QuickNote] {
        let notes = quickNoteService.recentNotes

        switch selectedFilter {
        case .all:
            return notes
        case .notes:
            return notes.filter { $0.noteType == .progressNote }
        case .reminders:
            return notes.filter { $0.noteType == .reminder }
        case .pending:
            return notes.filter { $0.status == .ready }
        }
    }

    private var groupedNotes: [(String, [QuickNote])] {
        let grouped = Dictionary(grouping: filteredNotes) { note -> String in
            if Calendar.current.isDateInToday(note.recordedAt) {
                return "Today"
            } else if Calendar.current.isDateInYesterday(note.recordedAt) {
                return "Yesterday"
            } else {
                let formatter = DateFormatter()
                formatter.dateFormat = "EEEE, MMM d"
                return formatter.string(from: note.recordedAt)
            }
        }

        return grouped.sorted { first, second in
            guard let firstNote = first.value.first,
                  let secondNote = second.value.first else { return false }
            return firstNote.recordedAt > secondNote.recordedAt
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Filter bar
            filterBar

            // Content
            if filteredNotes.isEmpty {
                emptyState
            } else {
                notesList
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Quick Notes")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { quickNoteService.startRecording() }) {
                    Image(systemName: "mic.badge.plus")
                }
            }
        }
        .onAppear {
            quickNoteService.loadRecentNotes()
        }
        .alert("Delete Note", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) {
                noteToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let note = noteToDelete {
                    quickNoteService.deleteNote(id: note.id)
                    noteToDelete = nil
                }
            }
        } message: {
            Text("Are you sure you want to delete this note?")
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(NoteFilter.allCases, id: \.self) { filter in
                    FilterChip(
                        title: filter.rawValue,
                        isSelected: selectedFilter == filter,
                        icon: filter.icon
                    ) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedFilter = filter
                        }
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 12)
        .background(Color.theme.surfaceSecondary)
    }

    // MARK: - Notes List

    private var notesList: some View {
        ScrollView {
            LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                ForEach(groupedNotes, id: \.0) { date, notes in
                    Section {
                        ForEach(notes) { note in
                            QuickNoteRowView(note: note) {
                                if note.noteType == .reminder {
                                    quickNoteService.toggleReminderComplete(id: note.id)
                                }
                            } onDelete: {
                                noteToDelete = note
                                showingDeleteConfirmation = true
                            }
                        }
                    } header: {
                        HStack {
                            Text(date)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(Color.theme.primaryText)

                            Spacer()

                            Text("\(notes.count)")
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.theme.surfaceSecondary)
                    }
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "mic.slash")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.primaryLight)

            Text(emptyStateTitle)
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            Text(emptyStateMessage)
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button(action: { quickNoteService.startRecording() }) {
                Label("Record Note", systemImage: "mic.fill")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.theme.primary)
                    .cornerRadius(12)
            }
            .padding(.top, 8)
        }
        .frame(maxHeight: .infinity)
    }

    private var emptyStateTitle: String {
        switch selectedFilter {
        case .all: return "No Quick Notes Yet"
        case .notes: return "No Progress Notes"
        case .reminders: return "No Reminders"
        case .pending: return "No Pending Notes"
        }
    }

    private var emptyStateMessage: String {
        switch selectedFilter {
        case .all: return "Tap the mic button to record your first quick note or reminder."
        case .notes: return "Progress notes you dictate will appear here."
        case .reminders: return "Reminders you create will appear here."
        case .pending: return "Notes waiting to be saved will appear here."
        }
    }
}

// MARK: - Quick Note Row View

struct QuickNoteRowView: View {
    let note: QuickNote
    let onToggleComplete: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Type icon or checkbox
            Button(action: onToggleComplete) {
                if note.noteType == .reminder {
                    Image(systemName: note.isCompleted ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundColor(note.isCompleted ? Color.theme.success : Color.theme.secondaryText)
                } else {
                    Image(systemName: note.noteType.icon)
                        .font(.title2)
                        .foregroundColor(Color.theme.primary)
                }
            }
            .buttonStyle(.plain)
            .disabled(note.noteType != .reminder)

            VStack(alignment: .leading, spacing: 6) {
                // Content preview
                Text(note.displayContent)
                    .font(.body)
                    .foregroundColor(note.isCompleted ? Color.theme.tertiaryText : Color.theme.primaryText)
                    .lineLimit(3)
                    .strikethrough(note.isCompleted)

                // Metadata row
                HStack(spacing: 12) {
                    // Time
                    Label(note.recordedAt.shortTimeString, systemImage: "clock")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    // Client if set
                    if let clientName = note.clientName {
                        Label(clientName, systemImage: "person")
                            .font(.caption)
                            .foregroundColor(Color.theme.primary)
                    }

                    // Due date for reminders
                    if note.noteType == .reminder, let dueDate = note.targetDate {
                        Label(formatDueDate(dueDate), systemImage: "calendar")
                            .font(.caption)
                            .foregroundColor(note.isOverdue ? .red : Color.theme.secondaryText)
                    }

                    Spacer()

                    // Status badge
                    Text(note.status.displayName)
                        .font(.caption2)
                        .foregroundColor(statusColor(for: note.status))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(statusColor(for: note.status).opacity(0.1))
                        .cornerRadius(4)
                }
            }

            // Delete button
            Button(action: onDelete) {
                Image(systemName: "trash")
                    .font(.caption)
                    .foregroundColor(Color.theme.tertiaryText)
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
        .padding(.horizontal)
        .padding(.vertical, 4)
    }

    private func statusColor(for status: QuickNote.QuickNoteStatus) -> Color {
        switch status {
        case .recording, .transcribing, .processing: return .blue
        case .ready: return .green
        case .saved: return .gray
        case .discarded: return .red
        }
    }

    private func formatDueDate(_ date: Date) -> String {
        if Calendar.current.isDateInToday(date) {
            return "Today \(date.shortTimeString)"
        } else if Calendar.current.isDateInTomorrow(date) {
            return "Tomorrow"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        }
    }
}

// MARK: - Date Extension

extension Date {
    var shortTimeString: String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: self)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        RecentQuickNotesView()
    }
}
