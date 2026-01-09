import SwiftUI

// MARK: - Avatar View
struct AvatarView: View {
    let name: String
    var size: CGFloat = 40
    var backgroundColor: Color?

    private var initials: String {
        let components = name.split(separator: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1) + components[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    private var avatarColor: Color {
        backgroundColor ?? colorFromName(name)
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(avatarColor)

            Text(initials)
                .font(.system(size: size * 0.4, weight: .semibold))
                .foregroundColor(.white)
        }
        .frame(width: size, height: size)
    }

    private func colorFromName(_ name: String) -> Color {
        let colors: [Color] = [
            Color.theme.primary,
            Color.theme.accent,
            Color(hex: "9B59B6"), // Purple
            Color(hex: "E67E22"), // Orange
            Color(hex: "1ABC9C"), // Teal
            Color(hex: "E74C3C"), // Red
            Color(hex: "3498DB"), // Blue
            Color(hex: "2ECC71"), // Green
        ]

        let hash = name.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return colors[hash % colors.count]
    }
}

// MARK: - Avatar with Status
struct AvatarWithStatus: View {
    let name: String
    var size: CGFloat = 40
    var status: ClientStatus?

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            AvatarView(name: name, size: size)

            if let status = status {
                Circle()
                    .fill(status.themeColor)
                    .frame(width: size * 0.3, height: size * 0.3)
                    .overlay(
                        Circle()
                            .stroke(Color.white, lineWidth: 2)
                    )
                    .offset(x: 2, y: 2)
            }
        }
    }
}

// MARK: - Avatar Stack (for group display)
struct AvatarStack: View {
    let names: [String]
    var size: CGFloat = 32
    var maxVisible: Int = 4
    var overlap: CGFloat = 0.3

    var body: some View {
        HStack(spacing: -size * overlap) {
            ForEach(Array(names.prefix(maxVisible).enumerated()), id: \.offset) { index, name in
                AvatarView(name: name, size: size)
                    .overlay(
                        Circle()
                            .stroke(Color.white, lineWidth: 2)
                    )
                    .zIndex(Double(maxVisible - index))
            }

            if names.count > maxVisible {
                ZStack {
                    Circle()
                        .fill(Color.theme.primaryLight)

                    Text("+\(names.count - maxVisible)")
                        .font(.system(size: size * 0.35, weight: .semibold))
                        .foregroundColor(Color.theme.primaryDark)
                }
                .frame(width: size, height: size)
                .overlay(
                    Circle()
                        .stroke(Color.white, lineWidth: 2)
                )
            }
        }
    }
}

// MARK: - Image Avatar
struct ImageAvatar: View {
    let image: Image?
    let name: String
    var size: CGFloat = 40

    var body: some View {
        if let image = image {
            image
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: size, height: size)
                .clipShape(Circle())
        } else {
            AvatarView(name: name, size: size)
        }
    }
}

#Preview {
    VStack(spacing: 24) {
        HStack(spacing: 16) {
            AvatarView(name: "John Doe", size: 40)
            AvatarView(name: "Jane Smith", size: 48)
            AvatarView(name: "Bob", size: 56)
        }

        HStack(spacing: 16) {
            AvatarWithStatus(name: "Active Client", status: .active)
            AvatarWithStatus(name: "Inactive Client", status: .inactive)
            AvatarWithStatus(name: "Discharged Client", status: .discharged)
        }

        AvatarStack(names: ["John", "Jane", "Bob", "Alice", "Charlie", "Diana"])
    }
    .padding()
}
