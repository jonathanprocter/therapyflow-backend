import SwiftUI

// MARK: - Theme Colors
extension Color {
    static let theme = ThemeColors()
}

struct ThemeColors {
    // Brand Color Palette (from design spec)
    // #f9f9f9 - Very light gray (background)
    // #e7e3da - Warm beige/cream (surface)
    // #d4d5d8 - Light gray (secondary/borders)
    // #979c9f - Medium gray (secondary text)
    // #54585b - Dark charcoal (primary text/accents)

    // Primary Brand Colors
    let primary = Color(hex: "54585B")       // Dark charcoal - main accent
    let primaryDark = Color(hex: "3D4043")   // Darker charcoal
    let primaryMedium = Color(hex: "979C9F") // Medium gray
    let primaryLight = Color(hex: "D4D5D8")  // Light gray

    // Accent Colors
    let accent = Color(hex: "979C9F")        // Medium gray as accent
    let accentLight = Color(hex: "E7E3DA")   // Warm beige/cream

    // Background Colors
    let background = Color(hex: "F9F9F9")    // Very light gray
    let surface = Color(hex: "FFFFFF")       // Pure white for cards
    let surfaceSecondary = Color(hex: "E7E3DA") // Warm beige/cream

    // Text Colors
    let primaryText = Color(hex: "54585B")   // Dark charcoal for primary text
    let secondaryText = Color(hex: "979C9F") // Medium gray for secondary text
    let tertiaryText = Color(hex: "D4D5D8")  // Light gray for tertiary text

    // Status Colors (keeping distinct for UX clarity, but muted)
    let success = Color(hex: "6B8E6B")       // Muted sage green
    let warning = Color(hex: "C4A35A")       // Muted amber/gold
    let error = Color(hex: "B85450")         // Muted red
    let info = Color(hex: "6B8E9F")          // Muted blue-gray

    // Risk Level Colors (muted versions for clinical appropriateness)
    let riskLow = Color(hex: "6B8E6B")       // Muted green
    let riskModerate = Color(hex: "C4A35A")  // Muted amber
    let riskHigh = Color(hex: "C47A50")      // Muted orange
    let riskCritical = Color(hex: "B85450")  // Muted red

    // Card and Border Colors
    let border = Color(hex: "D4D5D8")        // Light gray borders
    let divider = Color(hex: "E7E3DA")       // Warm beige dividers
    let shadow = Color(hex: "54585B").opacity(0.08)

    // Gradient
    var primaryGradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: "54585B"), Color(hex: "979C9F")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    var backgroundGradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: "F9F9F9"), Color(hex: "E7E3DA")],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Hex Color Initializer
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Risk Level Color Extension
extension RiskLevel {
    var themeColor: Color {
        switch self {
        case .low: return Color.theme.riskLow
        case .moderate: return Color.theme.riskModerate
        case .high: return Color.theme.riskHigh
        case .critical: return Color.theme.riskCritical
        }
    }
}

// MARK: - Client Status Color Extension
extension ClientStatus {
    var themeColor: Color {
        switch self {
        case .active: return Color.theme.success
        case .inactive: return Color.theme.warning
        case .discharged: return Color.theme.tertiaryText
        }
    }
}

// MARK: - Session Status Color Extension
extension SessionStatus {
    var themeColor: Color {
        switch self {
        case .scheduled: return Color.theme.info
        case .completed: return Color.theme.success
        case .cancelled: return Color.theme.tertiaryText
        case .noShow: return Color.theme.error
        }
    }
}

// MARK: - Note Status Color Extension
extension NoteStatus {
    var themeColor: Color {
        switch self {
        case .placeholder: return Color.theme.tertiaryText
        case .uploaded: return Color.theme.info
        case .processed: return Color.theme.accent
        case .manualReview: return Color.theme.warning
        case .completed: return Color.theme.success
        }
    }
}

// MARK: - Insight Priority Color Extension
extension InsightPriority {
    var themeColor: Color {
        switch self {
        case .low: return Color.theme.tertiaryText
        case .medium: return Color.theme.info
        case .high: return Color.theme.warning
        case .urgent: return Color.theme.error
        }
    }
}
