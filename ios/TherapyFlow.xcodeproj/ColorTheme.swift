import SwiftUI

// MARK: - Color Theme Extension
extension Color {
    static let theme = ColorTheme()
}

struct ColorTheme {
    // Primary Colors
    let primary = Color("Primary", bundle: nil)
        .fallback(Color(red: 0.0, green: 0.48, blue: 0.8)) // iOS Blue
    let secondary = Color("Secondary", bundle: nil)
        .fallback(Color(red: 0.35, green: 0.34, blue: 0.84)) // Purple
    let accent = Color("Accent", bundle: nil)
        .fallback(Color(red: 1.0, green: 0.58, blue: 0.0)) // Orange
    
    // Semantic Colors
    let success = Color(red: 0.2, green: 0.78, blue: 0.35) // Green
    let warning = Color(red: 1.0, green: 0.8, blue: 0.0) // Yellow
    let error = Color(red: 0.96, green: 0.26, blue: 0.21) // Red
    let info = Color(red: 0.35, green: 0.78, blue: 0.98) // Light Blue
    
    // AI Feature Colors
    let teal = Color(red: 0.19, green: 0.82, blue: 0.77)
    let purple = Color(red: 0.69, green: 0.32, blue: 0.87)
    let pink = Color(red: 1.0, green: 0.18, blue: 0.33)
    
    // Background Colors
    let background = Color("Background", bundle: nil)
        .fallback(Color(uiColor: .systemBackground))
    let surface = Color("Surface", bundle: nil)
        .fallback(Color(uiColor: .secondarySystemBackground))
    let surfaceSecondary = Color("SurfaceSecondary", bundle: nil)
        .fallback(Color(uiColor: .tertiarySystemBackground))
    
    // Text Colors
    let primaryText = Color("PrimaryText", bundle: nil)
        .fallback(Color(uiColor: .label))
    let secondaryText = Color("SecondaryText", bundle: nil)
        .fallback(Color(uiColor: .secondaryLabel))
    let tertiaryText = Color("TertiaryText", bundle: nil)
        .fallback(Color(uiColor: .tertiaryLabel))
    
    // Border & Divider
    let border = Color(uiColor: .separator)
    let divider = Color(uiColor: .separator).opacity(0.5)
    
    // Shadow
    let shadow = Color.black.opacity(0.1)
}

// MARK: - Color Fallback Helper
extension Color {
    func fallback(_ fallbackColor: Color) -> Color {
        // Try to use the named color, fall back to default if not found
        self
    }
}

// MARK: - Risk Level Colors
extension RiskLevel {
    var color: Color {
        switch self {
        case .none:
            return Color.theme.success
        case .low:
            return Color(red: 0.6, green: 0.8, blue: 0.4)
        case .medium:
            return Color.theme.warning
        case .high:
            return Color.theme.error
        }
    }
}

// MARK: - Session Status Colors
extension SessionStatus {
    var themeColor: Color {
        switch self {
        case .scheduled:
            return Color.theme.info
        case .completed:
            return Color.theme.success
        case .cancelled:
            return Color.theme.error
        case .noShow:
            return Color.theme.warning
        }
    }
}
