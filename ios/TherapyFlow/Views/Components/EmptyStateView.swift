import SwiftUI

// MARK: - Empty State View
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: icon)
                .font(.system(size: 64))
                .foregroundColor(Color.theme.primaryLight)

            VStack(spacing: 8) {
                Text(title)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.theme.primaryText)

                Text(message)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            if let actionTitle = actionTitle, let action = action {
                Button(action: action) {
                    Text(actionTitle)
                        .primaryButtonStyle()
                }
                .frame(width: 200)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Specific Empty States

struct NoClientsView: View {
    var onAdd: () -> Void

    var body: some View {
        EmptyStateView(
            icon: "person.2",
            title: "No Clients Yet",
            message: "Add your first client to start tracking their therapeutic journey.",
            actionTitle: "Add Client",
            action: onAdd
        )
    }
}

struct NoSessionsView: View {
    var onSchedule: () -> Void

    var body: some View {
        EmptyStateView(
            icon: "calendar.badge.plus",
            title: "No Sessions Scheduled",
            message: "Schedule a session with a client to get started.",
            actionTitle: "Schedule Session",
            action: onSchedule
        )
    }
}

struct NoNotesView: View {
    var onCreate: () -> Void

    var body: some View {
        EmptyStateView(
            icon: "doc.text",
            title: "No Progress Notes",
            message: "Create your first progress note to document client sessions.",
            actionTitle: "Create Note",
            action: onCreate
        )
    }
}

struct NoSearchResultsView: View {
    let query: String

    var body: some View {
        EmptyStateView(
            icon: "magnifyingglass",
            title: "No Results Found",
            message: "No results match \"\(query)\". Try adjusting your search terms or filters."
        )
    }
}

struct OfflineView: View {
    var body: some View {
        EmptyStateView(
            icon: "wifi.slash",
            title: "You're Offline",
            message: "Some features require an internet connection. Your changes will sync when you're back online."
        )
    }
}

struct ErrorView: View {
    let error: Error
    var onRetry: (() -> Void)?

    var body: some View {
        EmptyStateView(
            icon: "exclamationmark.triangle",
            title: "Something Went Wrong",
            message: error.localizedDescription,
            actionTitle: onRetry != nil ? "Try Again" : nil,
            action: onRetry
        )
    }
}

#Preview {
    VStack {
        NoClientsView(onAdd: {})
    }
    .background(Color.theme.background)
}
