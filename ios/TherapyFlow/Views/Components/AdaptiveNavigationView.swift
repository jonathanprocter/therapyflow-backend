import SwiftUI

// MARK: - Adaptive Navigation View
/// A view that provides different navigation layouts for iPhone vs iPad
struct AdaptiveNavigationView<Sidebar: View, Detail: View>: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let sidebar: Sidebar
    let detail: Detail

    init(
        @ViewBuilder sidebar: () -> Sidebar,
        @ViewBuilder detail: () -> Detail
    ) {
        self.sidebar = sidebar()
        self.detail = detail()
    }

    var body: some View {
        if horizontalSizeClass == .regular {
            // iPad: Split view
            NavigationSplitView {
                sidebar
            } detail: {
                detail
            }
        } else {
            // iPhone: Stack navigation
            NavigationStack {
                sidebar
            }
        }
    }
}

// MARK: - Adaptive Grid
/// A grid that adjusts columns based on available width
struct AdaptiveGrid<Item: Identifiable, Content: View>: View {
    let items: [Item]
    let minColumnWidth: CGFloat
    let spacing: CGFloat
    let content: (Item) -> Content

    init(
        items: [Item],
        minColumnWidth: CGFloat = 300,
        spacing: CGFloat = 16,
        @ViewBuilder content: @escaping (Item) -> Content
    ) {
        self.items = items
        self.minColumnWidth = minColumnWidth
        self.spacing = spacing
        self.content = content
    }

    var body: some View {
        GeometryReader { geometry in
            let columns = max(1, Int(geometry.size.width / minColumnWidth))

            ScrollView {
                LazyVGrid(
                    columns: Array(
                        repeating: GridItem(.flexible(), spacing: spacing),
                        count: columns
                    ),
                    spacing: spacing
                ) {
                    ForEach(items) { item in
                        content(item)
                    }
                }
                .padding(spacing)
            }
        }
    }
}

// MARK: - Responsive Stack
/// A stack that switches between horizontal and vertical based on size class
struct ResponsiveStack<Content: View>: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let spacing: CGFloat
    let content: Content

    init(spacing: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.spacing = spacing
        self.content = content()
    }

    var body: some View {
        if horizontalSizeClass == .regular {
            HStack(alignment: .top, spacing: spacing) {
                content
            }
        } else {
            VStack(spacing: spacing) {
                content
            }
        }
    }
}

// MARK: - Device-Aware Modifier
struct DeviceAwareModifier: ViewModifier {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.verticalSizeClass) private var verticalSizeClass

    var isPad: Bool {
        horizontalSizeClass == .regular
    }

    var isLandscape: Bool {
        verticalSizeClass == .compact
    }

    var isPortrait: Bool {
        !isLandscape
    }

    func body(content: Content) -> some View {
        content
            .environment(\.isPad, isPad)
            .environment(\.isLandscape, isLandscape)
    }
}

// MARK: - Environment Keys
private struct IsPadKey: EnvironmentKey {
    static let defaultValue = false
}

private struct IsLandscapeKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var isPad: Bool {
        get { self[IsPadKey.self] }
        set { self[IsPadKey.self] = newValue }
    }

    var isLandscape: Bool {
        get { self[IsLandscapeKey.self] }
        set { self[IsLandscapeKey.self] = newValue }
    }
}

extension View {
    func deviceAware() -> some View {
        modifier(DeviceAwareModifier())
    }
}

// MARK: - Sidebar Button (for iPad)
struct SidebarButton: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.body)
                    .frame(width: 24)

                Text(title)
                    .font(.body)

                Spacer()
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 12)
            .background(isSelected ? Color.theme.primary.opacity(0.15) : Color.clear)
            .foregroundColor(isSelected ? Color.theme.primary : Color.theme.primaryText)
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Split View Column Widths
struct SplitViewColumnWidth {
    static let sidebarMin: CGFloat = 250
    static let sidebarIdeal: CGFloat = 300
    static let sidebarMax: CGFloat = 350

    static let contentMin: CGFloat = 400
    static let detailMin: CGFloat = 300
}

#Preview {
    AdaptiveNavigationView {
        List {
            Text("Sidebar Item 1")
            Text("Sidebar Item 2")
            Text("Sidebar Item 3")
        }
        .navigationTitle("Sidebar")
    } detail: {
        Text("Detail View")
    }
}
