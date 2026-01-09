import SwiftUI

struct ClientRowView: View {
    let client: Client

    var body: some View {
        HStack(spacing: 12) {
            AvatarWithStatus(name: client.name, size: 48, status: client.status)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(client.name)
                        .font(.headline)
                        .foregroundColor(Color.theme.primaryText)

                    Spacer()

                    ClientStatusBadge(status: client.status)
                }

                if let email = client.email, !email.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "envelope")
                            .font(.caption2)
                        Text(email)
                            .font(.caption)
                    }
                    .foregroundColor(Color.theme.secondaryText)
                }

                if !client.tags.isEmpty {
                    TagList(tags: client.tags, maxVisible: 3)
                }
            }

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
        .shadow(color: Color.theme.shadow, radius: 2, x: 0, y: 1)
    }
}

// MARK: - Compact Client Row
struct CompactClientRow: View {
    let client: Client

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(name: client.name, size: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(client.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)

                Text(client.status.displayName)
                    .font(.caption)
                    .foregroundColor(client.status.themeColor)
            }

            Spacer()
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Client Card (for grids)
struct ClientCard: View {
    let client: Client
    var onTap: (() -> Void)?

    var body: some View {
        Button(action: { onTap?() }) {
            VStack(spacing: 12) {
                AvatarWithStatus(name: client.name, size: 60, status: client.status)

                VStack(spacing: 4) {
                    Text(client.name)
                        .font(.headline)
                        .foregroundColor(Color.theme.primaryText)
                        .lineLimit(1)

                    if let email = client.email {
                        Text(email)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                            .lineLimit(1)
                    }
                }

                if !client.tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(client.tags.prefix(2), id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.theme.primaryLight)
                                .foregroundColor(Color.theme.primaryDark)
                                .cornerRadius(4)
                        }

                        if client.tags.count > 2 {
                            Text("+\(client.tags.count - 2)")
                                .font(.caption2)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color.theme.surface)
            .cornerRadius(12)
            .shadow(color: Color.theme.shadow, radius: 2, x: 0, y: 1)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    VStack(spacing: 16) {
        ClientRowView(client: Client(
            id: "1",
            therapistId: "t1",
            name: "John Doe",
            email: "john@example.com",
            tags: ["anxiety", "depression", "CBT"],
            status: .active
        ))

        ClientRowView(client: Client(
            id: "2",
            therapistId: "t1",
            name: "Jane Smith",
            email: "jane@example.com",
            tags: ["grief"],
            status: .inactive
        ))

        ClientCard(client: Client(
            id: "3",
            therapistId: "t1",
            name: "Bob Johnson",
            email: "bob@example.com",
            tags: ["trauma", "PTSD"],
            status: .active
        ))
    }
    .padding()
    .background(Color.theme.background)
}
