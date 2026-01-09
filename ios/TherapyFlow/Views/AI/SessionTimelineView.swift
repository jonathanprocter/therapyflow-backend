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

        do {
            // Fetch real sessions from API
            let fetchedSessions = try await APIClient.shared.getSessions()

            // Fetch clients to hydrate session data
            let clients = try await APIClient.shared.getClients()
            let clientMap = Dictionary(uniqueKeysWithValues: clients.map { ($0.id, $0) })

            // Convert to TimelineSession format
            let now = Date()
            sessions = fetchedSessions.map { session in
                let clientName = clientMap[session.clientId]?.name ?? session.displayClientName
                let sessionType: TimelineSession.SessionType

                switch session.status {
                case .completed:
                    sessionType = .completed
                case .cancelled:
                    sessionType = .cancelled
                case .scheduled, .noShow, .unknown:
                    sessionType = session.scheduledAt > now ? .upcoming : .completed
                }

                return TimelineSession(
                    id: session.id,
                    clientName: clientName,
                    date: session.scheduledAt,
                    type: sessionType,
                    notes: session.notes ?? session.sessionType.displayName
                )
            }
            .sorted { $0.date > $1.date } // Most recent first

            // Apply filter
            if selectedClient == "recent" {
                sessions = Array(sessions.prefix(10))
            }

        } catch {
            print("Failed to load sessions: \(error)")
            // Show empty state on error instead of demo data
            sessions = []
        }

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

// FilterChip is defined in SemanticSearchView.swift

#Preview {
    NavigationStack {
        SessionTimelineView()
    }
}
