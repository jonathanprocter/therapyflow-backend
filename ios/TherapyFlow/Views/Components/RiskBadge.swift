import SwiftUI

// MARK: - Risk Badge
struct RiskBadge: View {
    let level: RiskLevel

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: level.icon)
                .font(.caption2)

            Text(level.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(level.themeColor.opacity(0.15))
        .foregroundColor(level.themeColor)
        .cornerRadius(6)
    }
}

// MARK: - Compact Risk Indicator
struct RiskIndicator: View {
    let level: RiskLevel

    var body: some View {
        Circle()
            .fill(level.themeColor)
            .frame(width: 8, height: 8)
    }
}

// MARK: - Risk Bar
struct RiskBar: View {
    let level: RiskLevel

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color.theme.border)
                    .cornerRadius(2)

                Rectangle()
                    .fill(level.themeColor)
                    .frame(width: geometry.size.width * progressValue)
                    .cornerRadius(2)
            }
        }
        .frame(height: 4)
    }

    private var progressValue: Double {
        switch level {
        case .low: return 0.25
        case .moderate: return 0.5
        case .high: return 0.75
        case .critical: return 1.0
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        HStack(spacing: 12) {
            RiskBadge(level: .low)
            RiskBadge(level: .moderate)
            RiskBadge(level: .high)
            RiskBadge(level: .critical)
        }

        HStack(spacing: 12) {
            ForEach(RiskLevel.allCases, id: \.self) { level in
                VStack {
                    RiskIndicator(level: level)
                    Text(level.displayName)
                        .font(.caption2)
                }
            }
        }

        VStack(spacing: 8) {
            ForEach(RiskLevel.allCases, id: \.self) { level in
                HStack {
                    Text(level.displayName)
                        .font(.caption)
                        .frame(width: 60, alignment: .leading)
                    RiskBar(level: level)
                }
            }
        }
        .padding()
    }
    .padding()
}
