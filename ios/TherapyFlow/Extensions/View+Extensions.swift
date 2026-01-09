import SwiftUI

// MARK: - View Extensions
extension View {
    // MARK: - Card Style
    func cardStyle(padding: CGFloat = 16) -> some View {
        self
            .padding(padding)
            .background(Color.theme.surface)
            .cornerRadius(12)
            .shadow(color: Color.theme.shadow, radius: 4, x: 0, y: 2)
    }

    // MARK: - Conditional Modifier
    @ViewBuilder
    func `if`<Transform: View>(_ condition: Bool, transform: (Self) -> Transform) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

    // MARK: - Hide Keyboard
    func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    // MARK: - On Tap to Hide Keyboard
    func onTapToDismissKeyboard() -> some View {
        self.onTapGesture {
            hideKeyboard()
        }
    }

    // MARK: - Loading Overlay
    func loadingOverlay(_ isLoading: Bool) -> some View {
        self.overlay {
            if isLoading {
                ZStack {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                    ProgressView()
                        .scaleEffect(1.5)
                        .tint(.white)
                }
            }
        }
    }

    // MARK: - Error Alert
    func errorAlert(_ error: Binding<Error?>) -> some View {
        self.alert("Error", isPresented: .constant(error.wrappedValue != nil)) {
            Button("OK") {
                error.wrappedValue = nil
            }
        } message: {
            Text(error.wrappedValue?.localizedDescription ?? "An unknown error occurred")
        }
    }

    // MARK: - Shimmer Effect
    func shimmer() -> some View {
        self.modifier(ShimmerModifier())
    }

    // MARK: - Read Size
    func readSize(onChange: @escaping (CGSize) -> Void) -> some View {
        background(
            GeometryReader { geo in
                Color.clear
                    .preference(key: SizePreferenceKey.self, value: geo.size)
            }
        )
        .onPreferenceChange(SizePreferenceKey.self, perform: onChange)
    }

    // MARK: - Scrollable Detection
    func isScrolled(_ isScrolled: Binding<Bool>) -> some View {
        self.modifier(ScrollDetector(isScrolled: isScrolled))
    }

    // MARK: - Primary Button Style
    func primaryButtonStyle() -> some View {
        self
            .font(.headline)
            .foregroundColor(.white)
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.theme.primary)
            .cornerRadius(12)
    }

    // MARK: - Secondary Button Style
    func secondaryButtonStyle() -> some View {
        self
            .font(.headline)
            .foregroundColor(Color.theme.primary)
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.theme.primaryLight)
            .cornerRadius(12)
    }

    // MARK: - Input Field Style
    func inputFieldStyle() -> some View {
        self
            .padding()
            .background(Color.theme.surfaceSecondary)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.theme.border, lineWidth: 1)
            )
    }
}

// MARK: - Size Preference Key
struct SizePreferenceKey: PreferenceKey {
    static var defaultValue: CGSize = .zero

    static func reduce(value: inout CGSize, nextValue: () -> CGSize) {
        value = nextValue()
    }
}

// MARK: - Shimmer Modifier
struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    LinearGradient(
                        colors: [
                            Color.clear,
                            Color.white.opacity(0.5),
                            Color.clear
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 2)
                    .offset(x: -geo.size.width + phase * geo.size.width * 2)
                }
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

// MARK: - Scroll Detector
struct ScrollDetector: ViewModifier {
    @Binding var isScrolled: Bool

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { geo in
                    Color.clear
                        .preference(
                            key: ScrollOffsetKey.self,
                            value: geo.frame(in: .named("scroll")).minY
                        )
                }
            )
            .onPreferenceChange(ScrollOffsetKey.self) { value in
                isScrolled = value < 0
            }
    }
}

struct ScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Placeholder View Modifier
extension View {
    func placeholder<Content: View>(
        when shouldShow: Bool,
        alignment: Alignment = .leading,
        @ViewBuilder placeholder: () -> Content
    ) -> some View {
        ZStack(alignment: alignment) {
            placeholder().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

// MARK: - Floating Action Button Modifier
extension View {
    func floatingActionButton<Content: View>(
        alignment: Alignment = .bottomTrailing,
        @ViewBuilder button: () -> Content
    ) -> some View {
        self.overlay(alignment: alignment) {
            button()
                .padding()
        }
    }
}

// MARK: - Pull to Refresh
extension View {
    func pullToRefresh(isRefreshing: Binding<Bool>, onRefresh: @escaping () async -> Void) -> some View {
        self.refreshable {
            isRefreshing.wrappedValue = true
            await onRefresh()
            isRefreshing.wrappedValue = false
        }
    }
}

// MARK: - Device Adaptivity
extension View {
    @ViewBuilder
    func phoneOnlyStackNavigationView() -> some View {
        if UIDevice.current.userInterfaceIdiom == .phone {
            self.navigationViewStyle(.stack)
        } else {
            self
        }
    }
}

// MARK: - Safe Area Insets Helper
// Note: The built-in safeAreaInset is used directly - no custom extension needed
// This section removed to avoid ambiguity with SwiftUI's built-in modifier
