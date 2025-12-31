import SwiftUI

/// Reusable row component for displaying labeled metadata with an icon
struct MetadataRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(Color.theme.primary)
                .frame(width: 20)

            Text(title)
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)

            Spacer()

            Text(value)
                .font(.subheadline)
                .foregroundColor(Color.theme.primaryText)
        }
    }
}

// Note: ContactRow and ClinicalToolRow are defined in ClientDetailView.swift

#Preview {
    VStack(spacing: 16) {
        MetadataRow(icon: "calendar", title: "Date", value: "January 15, 2025")
        MetadataRow(icon: "clock", title: "Time", value: "2:00 PM - 2:50 PM")
        MetadataRow(icon: "hourglass", title: "Duration", value: "50 minutes")
    }
    .padding()
}
