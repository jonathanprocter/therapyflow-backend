import SwiftUI

struct CalendarSyncView: View {
    @State private var isSyncing = false
    @State private var lastSyncDate: Date? = nil
    @State private var syncStatus: SyncStatus = .idle
    @State private var eventsCount = 0
    
    var body: some View {
        List {
            Section {
                statusCard
            }
            
            Section("Sync Options") {
                Button(action: { syncCalendar(fullSync: false) }) {
                    Label("Quick Sync (Last 30 Days)", systemImage: "arrow.triangle.2.circlepath")
                }
                .disabled(isSyncing)
                
                Button(action: { syncCalendar(fullSync: true) }) {
                    Label("Full Sync (All History)", systemImage: "arrow.clockwise.circle")
                }
                .disabled(isSyncing)
            }
            
            Section("Connected Calendars") {
                HStack {
                    Image(systemName: "calendar")
                        .foregroundColor(.blue)
                    Text("Google Calendar")
                    Spacer()
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
                
                HStack {
                    Image(systemName: "calendar.badge.clock")
                        .foregroundColor(.green)
                    Text("SimplePractice")
                    Spacer()
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }
            
            Section("Info") {
                if let lastSync = lastSyncDate {
                    HStack {
                        Text("Last Sync")
                        Spacer()
                        Text(lastSync, style: .relative)
                            .foregroundColor(.secondary)
                    }
                }
                
                HStack {
                    Text("Synced Events")
                    Spacer()
                    Text("\(eventsCount)")
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle("Calendar Sync")
        .refreshable {
            await performSync(fullSync: false)
        }
    }
    
    private var statusCard: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(syncStatus.color.opacity(0.2))
                    .frame(width: 50, height: 50)
                
                if isSyncing {
                    ProgressView()
                } else {
                    Image(systemName: syncStatus.icon)
                        .foregroundColor(syncStatus.color)
                        .font(.title2)
                }
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(syncStatus.title)
                    .font(.headline)
                Text(syncStatus.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 8)
    }
    
    private func syncCalendar(fullSync: Bool) {
        Task {
            await performSync(fullSync: fullSync)
        }
    }
    
    private func performSync(fullSync: Bool) async {
        isSyncing = true
        syncStatus = .syncing
        
        let startDate = fullSync ? "2015-01-01" : Calendar.current.date(byAdding: .day, value: -30, to: Date())!.ISO8601Format()
        let endDate = "2030-12-31"
        
        do {
            // Call the backend sync endpoint
            guard let url = URL(string: "https://therapyflow-backend.onrender.com/api/calendar/sync") else {
                throw URLError(.badURL)
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = ["startDate": startDate, "endDate": endDate]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            let (data, _) = try await URLSession.shared.data(for: request)
            
            if let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let count = response["count"] as? Int {
                eventsCount = count
            }
            
            lastSyncDate = Date()
            syncStatus = .success
        } catch {
            syncStatus = .error
        }
        
        isSyncing = false
    }
}

enum SyncStatus {
    case idle, syncing, success, error
    
    var title: String {
        switch self {
        case .idle: return "Ready to Sync"
        case .syncing: return "Syncing..."
        case .success: return "Sync Complete"
        case .error: return "Sync Failed"
        }
    }
    
    var description: String {
        switch self {
        case .idle: return "Pull down or tap a sync option"
        case .syncing: return "Fetching calendar events..."
        case .success: return "All events are up to date"
        case .error: return "Check your connection and try again"
        }
    }
    
    var icon: String {
        switch self {
        case .idle: return "arrow.triangle.2.circlepath"
        case .syncing: return "arrow.triangle.2.circlepath"
        case .success: return "checkmark.circle.fill"
        case .error: return "exclamationmark.triangle.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .idle: return .blue
        case .syncing: return .blue
        case .success: return .green
        case .error: return .red
        }
    }
}

#Preview {
    NavigationStack {
        CalendarSyncView()
    }
}
