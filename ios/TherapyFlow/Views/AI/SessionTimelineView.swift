import SwiftUI

struct SessionTimelineView: View {
    @State private var selectedClient: String? = nil
    @State private var sessions: [TimelineSession] = []
    @State private var isLoading = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Client Filter
                clientFilterSection
                
                // Timeline
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else if sessions.isEmpty {
                    emptyStateView
                } else {
                    timelineSection
                }
            }
            .padding()
        }
        .navigationTitle("Session Timeline")
        .task {
            await loadSessions()
        }
    }
    
    private var clientFilterSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FilterChip(title: "All Clients", isSelected: selectedClient == nil) {
                    selectedClient = nil
                }
                FilterChip(title: "Recent", isSelected: selectedClient == "recent") {
                    selectedClient = "recent"
                }
            }
            .padding(.horizontal, 4)
        }
    }
    
    private var timelineSection: some View {
        VStack(spacing: 0) {
            ForEach(Array(sessions.enumerated()), id: \.element.id) { index, session in
                TimelineItemView(session: session, isLast: index == sessions.count - 1)
            }
        }
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.clock")
                .font(.system(size: 50))
                .foregroundColor(.secondary)
            Text("No sessions yet")
                .font(.headline)
            Text("Sessions will appear here as they're scheduled and completed")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
    
    private func loadSessions() async {
        isLoading = true
        try? await Task.sleep(nanoseconds: 500_000_000)
        
        sessions = [
            TimelineSession(id: "1", clientName: "Client A", date: Date(), type: .completed, notes: "Discussed anxiety management techniques"),
            TimelineSession(id: "2", clientName: "Client B", date: Date().addingTimeInterval(-86400), type: .completed, notes: "CBT session - cognitive restructuring"),
            TimelineSession(id: "3", clientName: "Client A", date: Date().addingTimeInterval(-172800), type: .completed, notes: "Follow-up on medication adjustment"),
            TimelineSession(id: "4", clientName: "Client C", date: Date().addingTimeInterval(86400), type: .upcoming, notes: "Initial assessment scheduled"),
        ]
        isLoading = false
    }
}

struct TimelineSession: Identifiable {
    let id: String
    let clientName: String
    let date: Date
    let type: SessionType
    let notes: String
    
    enum SessionType {
        case upcoming, completed, cancelled
        
        var color: Color {
            switch self {
            case .upcoming: return .blue
            case .completed: return .green
            case .cancelled: return .red
            }
        }
        
        var icon: String {
            switch self {
            case .upcoming: return "clock"
            case .completed: return "checkmark.circle.fill"
            case .cancelled: return "xmark.circle.fill"
            }
        }
    }
}

struct TimelineItemView: View {
    let session: TimelineSession
    let isLast: Bool
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Timeline line and dot
            VStack(spacing: 0) {
                Circle()
                    .fill(session.type.color)
                    .frame(width: 12, height: 12)
                
                if !isLast {
                    Rectangle()
                        .fill(Color.secondary.opacity(0.3))
                        .frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(width: 12)
            
            // Content
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(session.clientName)
                        .font(.headline)
                    Spacer()
                    Image(systemName: session.type.icon)
                        .foregroundColor(session.type.color)
                }
                
                Text(session.date, style: .date)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Text(session.notes)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.03), radius: 3, y: 1)
        }
        .padding(.bottom, isLast ? 0 : 16)
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.theme.primary : Color(.systemGray5))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(20)
        }
    }
}

#Preview {
    NavigationStack {
        SessionTimelineView()
    }
}
