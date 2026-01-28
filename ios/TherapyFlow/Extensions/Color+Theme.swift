import SwiftUI

// MARK: - Theme Colors
extension Color {
    static let theme = ThemeColors()
}

struct ThemeColors {
    // Brand Color Palette - Modern Minimalist
    // Based on logo: Deep Blue (#2B5A7C) + Warm Coral (#E86B4A)
    // Following 60-30-10 rule: 60% neutrals, 30% primary, 10% accent

    // Primary Brand Colors - Deep Blue
    let primary = Color(hex: "2B5A7C")       // Deep Blue - main brand color
    let primaryLight = Color(hex: "3D7A9E")  // Lighter blue for hover states
    let primaryDark = Color(hex: "1E4460")   // Darker blue for active states

    // Accent Colors - Warm Coral
    let accent = Color(hex: "E86B4A")        // Warm Coral - CTAs, highlights
    let accentLight = Color(hex: "F08B70")   // Lighter coral
    let accentDark = Color(hex: "D55A3A")    // Darker coral

    // Teal - Secondary Accent / Success
    let teal = Color(hex: "0D9488")          // Teal for success states
    let tealLight = Color(hex: "14B8A6")
    let tealDark = Color(hex: "0F766E")

    // Background Colors
    let background = Color(hex: "FAFBFC")    // Clean off-white
    let surface = Color(hex: "FFFFFF")       // Pure white for cards
    let surfaceSecondary = Color(hex: "F1F5F9") // Slate 100 for secondary surfaces

    // Text Colors
    let primaryText = Color(hex: "1E293B")   // Dark slate - primary text
    let secondaryText = Color(hex: "64748B") // Medium gray - secondary text
    let tertiaryText = Color(hex: "94A3B8")  // Light gray - muted text

    // Status Colors
    let success = Color(hex: "0D9488")       // Teal
    let warning = Color(hex: "F59E0B")       // Amber
    let error = Color(hex: "EF4444")         // Red
    let info = Color(hex: "3B82F6")          // Blue

    // Risk Level Colors
    let riskLow = Color(hex: "0D9488")       // Teal
    let riskModerate = Color(hex: "F59E0B")  // Amber
    let riskHigh = Color(hex: "F97316")      // Orange
    let riskCritical = Color(hex: "EF4444")  // Red

    // Card and Border Colors
    let border = Color(hex: "E2E8F0")        // Light gray borders
    let borderStrong = Color(hex: "CBD5E1")  // Stronger borders
    let divider = Color(hex: "E2E8F0")       // Same as border
    let shadow = Color(hex: "1E293B").opacity(0.08)

    // Gradient
    var primaryGradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: "2B5A7C"), Color(hex: "1E4460")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    var accentGradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: "E86B4A"), Color(hex: "D55A3A")],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    var backgroundGradient: LinearGradient {
        LinearGradient(
            colors: [Color(hex: "FAFBFC"), Color(hex: "F1F5F9")],
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
        case .unknown: return Color.theme.tertiaryText
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
        case .unknown: return Color.theme.tertiaryText
        }
    }
}

// MARK: - Session Status Color Extension
extension SessionStatus {
    var themeColor: Color {
        switch self {
        case .scheduled: return Color.theme.primary
        case .completed: return Color.theme.success
        case .cancelled: return Color.theme.warning  // Yellow/orange for cancelled
        case .noShow: return Color.theme.error       // Red for no-show
        case .unknown: return Color.theme.tertiaryText
        }
    }

    /// Whether this status indicates the session didn't happen as planned
    var isInactive: Bool {
        self == .cancelled || self == .noShow
    }
}

// MARK: - Note Status Color Extension
extension NoteStatus {
    var themeColor: Color {
        switch self {
        case .placeholder: return Color.theme.tertiaryText
        case .uploaded: return Color.theme.info
        case .processed: return Color.theme.primary
        case .manualReview, .needsReview: return Color.theme.warning
        case .completed: return Color.theme.success
        case .draft: return Color.theme.info
        case .pending: return Color.theme.warning
        case .unknown: return Color.theme.tertiaryText
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
        case .unknown: return Color.theme.tertiaryText
        }
    }
}
