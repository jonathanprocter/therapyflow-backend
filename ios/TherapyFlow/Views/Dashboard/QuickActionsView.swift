import SwiftUI

// MARK: - Quick Actions View
// Note: This is extracted as a reusable component from DashboardView

struct QuickActionsView: View {
    let columns: Int
    var onNewNote: (() -> Void)?
    var onUpload: (() -> Void)?
    var onSearch: (() -> Void)?
    var onBulkImport: (() -> Void)?

    init(
        columns: Int = 2,
        onNewNote: (() -> Void)? = nil,
        onUpload: (() -> Void)? = nil,
        onSearch: (() -> Void)? = nil,
        onBulkImport: (() -> Void)? = nil
    ) {
        self.columns = columns
        self.onNewNote = onNewNote
        self.onUpload = onUpload
        self.onSearch = onSearch
        self.onBulkImport = onBulkImport
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Actions")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: columns),
                spacing: 16
            ) {
                QuickActionCard(
                    icon: "plus.circle",
                    title: "New Note",
                    color: Color.theme.primary,
                    action: onNewNote ?? {}
                )

                QuickActionCard(
                    icon: "doc.badge.arrow.up",
                    title: "Upload",
                    color: Color.theme.accent,
                    action: onUpload ?? {}
                )

                QuickActionCard(
                    icon: "magnifyingglass",
                    title: "AI Search",
                    color: Color.theme.success,
                    action: onSearch ?? {}
                )

                QuickActionCard(
                    icon: "folder.badge.plus",
                    title: "Bulk Import",
                    color: Color.theme.warning,
                    action: onBulkImport ?? {}
                )
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

// MARK: - Quick Action Card
struct QuickActionCard: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)

                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.theme.surfaceSecondary)
            .cornerRadius(10)
        }
    }
}

#Preview {
    QuickActionsView(columns: 2)
        .padding()
}
