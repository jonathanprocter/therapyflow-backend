import SwiftUI

// MARK: - Empty State View
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(Color.theme.secondaryText.opacity(0.5))
            
            Text(title)
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(Color.theme.primaryText)
            
            Text(message)
                .font(.body)
                .foregroundColor(Color.theme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            
            if let actionTitle = actionTitle, let action = action {
                Button(action: action) {
                    Text(actionTitle)
                        .primaryButtonStyle()
                }
                .padding(.horizontal, 40)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Session Status Badge
struct SessionStatusBadge: View {
    let status: SessionStatus
    
    var body: some View {
        Text(status.displayName)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(status.themeColor.opacity(0.15))
            .foregroundColor(status.themeColor)
            .cornerRadius(6)
    }
}

// MARK: - Flow Layout (for wrapping tags)
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(
            in: proposal.replacingUnspecifiedDimensions().width,
            subviews: subviews,
            spacing: spacing
        )
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(
            in: bounds.width,
            subviews: subviews,
            spacing: spacing
        )
        for (index, subview) in subviews.enumerated() {
            subview.place(at: result.positions[index], proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []
        
        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var lineHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if x + size.width > maxWidth && x > 0 {
                    x = 0
                    y += lineHeight + spacing
                    lineHeight = 0
                }
                
                positions.append(CGPoint(x: x, y: y))
                lineHeight = max(lineHeight, size.height)
                x += size.width + spacing
            }
            
            self.size = CGSize(width: maxWidth, height: y + lineHeight)
        }
    }
}

// MARK: - Recent Insights Card
struct RecentInsightsCard: View {
    let insights: [AIInsight]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent AI Insights")
                .font(.headline)
            
            ForEach(insights.prefix(3)) { insight in
                NavigationLink(destination: Text("Insight Detail")) {
                    HStack {
                        Image(systemName: iconForInsightType(insight.type))
                            .foregroundColor(.purple)
                        
                        VStack(alignment: .leading) {
                            Text(insight.title)
                                .font(.subheadline)
                            Text(insight.content)
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)
                                .lineLimit(2)
                        }
                        
                        Spacer()
                        
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(8)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
    
    private func iconForInsightType(_ type: InsightType) -> String {
        switch type {
        case .pattern: return "chart.line.uptrend.xyaxis"
        case .risk: return "exclamationmark.triangle"
        case .progress: return "checkmark.circle"
        case .recommendation: return "lightbulb"
        }
    }
}

// MARK: - Search Bar
struct SearchBar: View {
    @Binding var text: String
    var placeholder: String = "Search..."
    
    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(Color.theme.secondaryText)
            
            TextField(placeholder, text: $text)
                .textFieldStyle(PlainTextFieldStyle())
            
            if !text.isEmpty {
                Button(action: { text = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
        }
        .padding(10)
        .background(Color.theme.surface)
        .cornerRadius(10)
    }
}

// MARK: - Client Row
struct ClientRow: View {
    let client: Client
    
    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color.theme.primary.opacity(0.2))
                    .frame(width: 50, height: 50)
                
                Text(client.initials)
                    .font(.headline)
                    .foregroundColor(Color.theme.primary)
            }
            
            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(client.name)
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)
                
                if let email = client.email {
                    Text(email)
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
            
            Spacer()
            
            // Status badge
            Text(client.status.displayName)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(statusColor(for: client.status).opacity(0.15))
                .foregroundColor(statusColor(for: client.status))
                .cornerRadius(6)
        }
        .padding(.vertical, 8)
    }
    
    private func statusColor(for status: ClientStatus) -> Color {
        switch status {
        case .active: return Color.theme.success
        case .inactive: return Color.theme.warning
        case .archived: return Color.theme.secondaryText
        }
    }
}

// MARK: - Document Row
struct DocumentRow: View {
    let document: Document
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconForFileType(document.fileExtension))
                .font(.title2)
                .foregroundColor(Color.theme.primary)
                .frame(width: 40)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(document.filename)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.primaryText)
                
                if let clientName = document.clientName {
                    Text(clientName)
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
            
            Spacer()
            
            Text(document.createdAt.relativeTimeString)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
        }
        .padding(.vertical, 8)
    }
    
    private func iconForFileType(_ ext: String) -> String {
        switch ext {
        case "pdf": return "doc.fill"
        case "txt", "text": return "doc.text"
        case "doc", "docx": return "doc.richtext"
        case "jpg", "jpeg", "png": return "photo"
        default: return "doc"
        }
    }
}

// MARK: - Note Card
struct NoteCard: View {
    let note: ProgressNote
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Progress Note")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
                
                Spacer()
                
                if let riskLevel = note.riskLevel {
                    Text(riskLevel.displayName)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(riskLevel.color.opacity(0.15))
                        .foregroundColor(riskLevel.color)
                        .cornerRadius(6)
                }
            }
            
            Text(note.content)
                .font(.body)
                .lineLimit(3)
                .foregroundColor(Color.theme.primaryText)
            
            if !note.tags.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(note.tags, id: \.self) { tag in
                        TagBadge(tag: tag)
                    }
                }
            }
            
            Text(note.createdAt.smartDateTimeString)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

// MARK: - Session Card
struct SessionCard: View {
    let session: Session
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    if let client = session.client {
                        Text(client.name)
                            .font(.headline)
                    }
                    
                    Text(session.sessionType.displayName)
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                }
                
                Spacer()
                
                SessionStatusBadge(status: session.status)
            }
            
            Divider()
            
            HStack {
                Label(session.formattedDate, systemImage: "calendar")
                Spacer()
                Label(session.formattedTimeRange, systemImage: "clock")
            }
            .font(.caption)
            .foregroundColor(Color.theme.secondaryText)
            
            if let notes = session.notes {
                Text(notes)
                    .font(.caption)
                    .foregroundColor(Color.theme.primaryText)
                    .lineLimit(2)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

// MARK: - Previews
#Preview {
    VStack(spacing: 20) {
        EmptyStateView(
            icon: "person.2",
            title: "No Clients",
            message: "Add your first client to get started",
            actionTitle: "Add Client",
            action: {}
        )
    }
}
