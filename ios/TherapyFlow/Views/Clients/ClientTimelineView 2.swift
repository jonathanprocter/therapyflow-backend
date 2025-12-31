import SwiftUI

struct ClientTimelineView: View {
    let clientId: String
    let clientName: String

    var body: some View {
        List {
            Section(header: Text("Timeline for \(clientName)").font(.headline)) {
                Text("This is a placeholder for the client's appointment timeline.")
                    .foregroundColor(.secondary)
                Text("Implement fetching and displaying sessions + notes here.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
            }
        }
        .navigationTitle("Timeline")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.theme.background)
    }
}

#Preview {
    NavigationStack {
        ClientTimelineView(clientId: "test-id", clientName: "Alex Johnson")
    }
}
