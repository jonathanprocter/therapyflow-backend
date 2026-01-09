import UIKit

/// Centralized haptic feedback manager that respects user preferences
@MainActor
final class HapticManager {
    static let shared = HapticManager()

    private let impactLight = UIImpactFeedbackGenerator(style: .light)
    private let impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private let impactHeavy = UIImpactFeedbackGenerator(style: .heavy)
    private let selectionGenerator = UISelectionFeedbackGenerator()
    private let notificationGenerator = UINotificationFeedbackGenerator()

    private init() {
        // Prepare generators for faster response
        impactLight.prepare()
        impactMedium.prepare()
        impactHeavy.prepare()
        selectionGenerator.prepare()
        notificationGenerator.prepare()
    }

    /// Trigger impact feedback if haptics are enabled
    func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        guard AppState.shared.hapticFeedbackEnabled else { return }

        switch style {
        case .light:
            impactLight.impactOccurred()
        case .medium:
            impactMedium.impactOccurred()
        case .heavy:
            impactHeavy.impactOccurred()
        case .soft:
            impactLight.impactOccurred(intensity: 0.5)
        case .rigid:
            impactHeavy.impactOccurred(intensity: 0.8)
        @unknown default:
            impactMedium.impactOccurred()
        }
    }

    /// Trigger selection feedback (for UI selection changes)
    func selection() {
        guard AppState.shared.hapticFeedbackEnabled else { return }
        selectionGenerator.selectionChanged()
    }

    /// Trigger notification feedback
    func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        guard AppState.shared.hapticFeedbackEnabled else { return }
        notificationGenerator.notificationOccurred(type)
    }

    /// Success feedback
    func success() {
        notification(.success)
    }

    /// Warning feedback
    func warning() {
        notification(.warning)
    }

    /// Error feedback
    func error() {
        notification(.error)
    }

    /// Button tap feedback
    func buttonTap() {
        impact(.light)
    }

    /// Toggle switch feedback
    func toggle() {
        impact(.medium)
    }

    /// Prepare all generators (call before expected interaction)
    func prepare() {
        impactLight.prepare()
        impactMedium.prepare()
        impactHeavy.prepare()
        selectionGenerator.prepare()
        notificationGenerator.prepare()
    }
}
