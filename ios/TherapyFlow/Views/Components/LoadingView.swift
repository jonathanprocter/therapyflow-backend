import SwiftUI

// MARK: - Loading View
struct LoadingView: View {
    var message: String = "Loading..."

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)
                .tint(Color.theme.primary)

            Text(message)
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.theme.background)
    }
}

// MARK: - Inline Loading
struct InlineLoading: View {
    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
                .scaleEffect(0.8)
            Text("Loading...")
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
        }
    }
}

// MARK: - Skeleton Loader
struct SkeletonLoader: View {
    var height: CGFloat = 20
    var cornerRadius: CGFloat = 4

    @State private var isAnimating = false

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color.theme.border)
            .frame(height: height)
            .shimmer()
    }
}

// MARK: - Card Skeleton
struct CardSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Circle()
                    .fill(Color.theme.border)
                    .frame(width: 40, height: 40)
                    .shimmer()

                VStack(alignment: .leading, spacing: 6) {
                    SkeletonLoader(height: 14)
                        .frame(width: 120)

                    SkeletonLoader(height: 12)
                        .frame(width: 80)
                }
            }

            SkeletonLoader(height: 16)
            SkeletonLoader(height: 16)
                .frame(width: 200)

            HStack(spacing: 8) {
                SkeletonLoader(height: 24, cornerRadius: 6)
                    .frame(width: 60)
                SkeletonLoader(height: 24, cornerRadius: 6)
                    .frame(width: 80)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

// MARK: - List Skeleton
struct ListSkeleton: View {
    var itemCount: Int = 5

    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<itemCount, id: \.self) { _ in
                CardSkeleton()
            }
        }
    }
}

// MARK: - Pulse Animation
struct PulseAnimation: View {
    @State private var isPulsing = false

    var body: some View {
        Circle()
            .fill(Color.theme.primary.opacity(0.3))
            .frame(width: 60, height: 60)
            .overlay(
                Circle()
                    .fill(Color.theme.primary)
                    .frame(width: 40, height: 40)
            )
            .scaleEffect(isPulsing ? 1.2 : 1.0)
            .opacity(isPulsing ? 0.5 : 1.0)
            .animation(
                .easeInOut(duration: 1.0)
                .repeatForever(autoreverses: true),
                value: isPulsing
            )
            .onAppear {
                isPulsing = true
            }
    }
}

// MARK: - Syncing Indicator
struct SyncingIndicator: View {
    @State private var isRotating = false

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "arrow.triangle.2.circlepath")
                .font(.caption)
                .rotationEffect(.degrees(isRotating ? 360 : 0))
                .animation(
                    .linear(duration: 1.0)
                    .repeatForever(autoreverses: false),
                    value: isRotating
                )
                .onAppear {
                    isRotating = true
                }

            Text("Syncing...")
                .font(.caption)
        }
        .foregroundColor(Color.theme.secondaryText)
    }
}

#Preview {
    ScrollView {
        VStack(spacing: 24) {
            LoadingView()
                .frame(height: 200)

            InlineLoading()

            CardSkeleton()

            ListSkeleton(itemCount: 3)

            PulseAnimation()

            SyncingIndicator()
        }
        .padding()
    }
    .background(Color.theme.background)
}
