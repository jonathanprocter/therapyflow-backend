import SwiftUI

struct SessionHistoryView: View {
    let clientId: String
    
    @State private var sessions: [Session] = []
    @State private var isLoading = true
    @State private var error: Error?
    
    var body: some View {
        List {
            if isLoading {
                ProgressView()
            } else if let error = error {
                Text("Error: \(error.localizedDescription)")
            } else if sessions.isEmpty {
                Text("No past sessions found.")
            } else {
                ForEach(sessions) { session in
                    NavigationLink(destination: SessionDetailView(session: session)) {
                        VStack(alignment: .leading) {
                            Text(session.scheduledAt.formatted())
                                .font(.headline)
                            Text(session.sessionType.displayName)
                                .font(.subheadline)
                        }
                    }
                }
            }
        }
        .navigationTitle("Session History")
        .task {
            await loadSessions()
        }
    }
    
    private func loadSessions() async {
        isLoading = true
        do {
            // Fetch past sessions for client
            // Assuming getSessions supports filters. APIClient.getSessions has clientId param.
            // We want past sessions, so upcoming=false.
            sessions = try await APIClient.shared.getSessions(upcoming: false, clientId: clientId)
            isLoading = false
        } catch {
            self.error = error
            isLoading = false
        }
    }
}
