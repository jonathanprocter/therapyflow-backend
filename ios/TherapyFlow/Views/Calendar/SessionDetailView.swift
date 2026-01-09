import SwiftUI

struct SessionDetailView: View {
    let session: Session

    @State private var sessionPrep: SessionPrep?
    @State private var isLoadingPrep = false
    @State private var showingEditSheet = false
    @State private var prepError: Error?

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                SessionDetailHeaderView(session: session)

                // Content
                if horizontalSizeClass == .regular {
                    HStack(alignment: .top, spacing: 24) {
                        VStack(spacing: 24) {
                            SessionDetailDetailsView(session: session)
                            SessionDetailPrepView(
                                sessionPrep: sessionPrep,
                                isLoadingPrep: isLoadingPrep,
                                onGenerate: generatePrep
                            )
                        }
                        .frame(maxWidth: .infinity)

                        SessionDetailActionsView(session: session)
                            .frame(width: 300)
                    }
                } else {
                    SessionDetailDetailsView(session: session)
                    SessionDetailPrepView(
                        sessionPrep: sessionPrep,
                        isLoadingPrep: isLoadingPrep,
                        onGenerate: generatePrep
                    )
                    SessionDetailActionsView(session: session)
                }
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("Session")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button(action: { showingEditSheet = true }) {
                        Label("Edit", systemImage: "pencil")
                    }

                    Button(action: generatePrep) {
                        Label("Generate AI Prep", systemImage: "sparkles")
                    }

                    Divider()

                    Button(role: .destructive, action: {}) {
                        Label("Cancel Session", systemImage: "xmark.circle")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            NavigationStack {
                SessionFormView(editSession: session) { updatedSession in
                    showingEditSheet = false
                }
            }
        }
        .alert("Error Generating Prep", isPresented: .constant(prepError != nil)) {
            Button("OK") { prepError = nil }
        } message: {
            Text(prepError?.localizedDescription ?? "Failed to generate session prep")
        }
        .onAppear {
            // Update AI context with session and client info
            ContextualAIAssistant.shared.updateContext(.sessionDetail, client: session.client, session: session)
        }
    }

    // MARK: - Actions
    private func generatePrep() {
        isLoadingPrep = true

        Task {
            do {
                let prep = try await APIClient.shared.generateSessionPrep(sessionId: session.id)
                await MainActor.run {
                    sessionPrep = prep
                    isLoadingPrep = false
                }
            } catch {
                await MainActor.run {
                    prepError = error
                    isLoadingPrep = false
                }
            }
        }
    }
}
#Preview {
    NavigationStack {
        SessionDetailView(session: Session(
            id: "1",
            clientId: "c1",
            therapistId: "t1",
            scheduledAt: Date().adding(hours: 2),
            duration: 50,
            sessionType: .individual,
            status: .scheduled,
            client: Client(id: "c1", therapistId: "t1", name: "John Doe")
        ))
    }
}
