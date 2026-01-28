import SwiftUI

struct SessionDetailView: View {
    @State private var session: Session

    @State private var sessionPrep: SessionPrep?
    @State private var isLoadingPrep = false
    @State private var showingEditSheet = false
    @State private var prepError: Error?
    @State private var isUpdatingStatus = false
    @State private var statusUpdateError: Error?
    @State private var showingCancelConfirmation = false
    @State private var showingNoShowConfirmation = false

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dismiss) private var dismiss

    init(session: Session) {
        _session = State(initialValue: session)
    }

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

                        SessionDetailActionsView(
                            session: session,
                            onMarkComplete: markComplete,
                            onMarkNoShow: { showingNoShowConfirmation = true },
                            onCancelSession: { showingCancelConfirmation = true },
                            onCreateNote: createNote
                        )
                        .frame(width: 300)
                    }
                } else {
                    SessionDetailDetailsView(session: session)
                    SessionDetailPrepView(
                        sessionPrep: sessionPrep,
                        isLoadingPrep: isLoadingPrep,
                        onGenerate: generatePrep
                    )
                    SessionDetailActionsView(
                        session: session,
                        onMarkComplete: markComplete,
                        onMarkNoShow: { showingNoShowConfirmation = true },
                        onCancelSession: { showingCancelConfirmation = true },
                        onCreateNote: createNote
                    )
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

                    if session.status == .scheduled {
                        Divider()

                        Button(action: markComplete) {
                            Label("Mark Complete", systemImage: "checkmark.circle")
                        }

                        Button(action: { showingNoShowConfirmation = true }) {
                            Label("Mark No Show", systemImage: "person.fill.xmark")
                        }

                        Button(role: .destructive, action: { showingCancelConfirmation = true }) {
                            Label("Cancel Session", systemImage: "xmark.circle")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showingEditSheet) {
            NavigationStack {
                SessionFormView(editSession: session) { updatedSession in
                    session = updatedSession
                    showingEditSheet = false
                }
            }
        }
        .alert("Error Generating Prep", isPresented: .constant(prepError != nil)) {
            Button("OK") { prepError = nil }
        } message: {
            Text(prepError?.localizedDescription ?? "Failed to generate session prep")
        }
        .alert("Error Updating Session", isPresented: .constant(statusUpdateError != nil)) {
            Button("OK") { statusUpdateError = nil }
        } message: {
            Text(statusUpdateError?.localizedDescription ?? "Failed to update session status")
        }
        .alert("Cancel Session", isPresented: $showingCancelConfirmation) {
            Button("Keep Session", role: .cancel) { }
            Button("Cancel Session", role: .destructive) {
                cancelSession()
            }
        } message: {
            Text("Are you sure you want to cancel this session with \(session.client?.name ?? "this client")? This will mark the session as cancelled.")
        }
        .alert("Mark as No Show", isPresented: $showingNoShowConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Mark No Show", role: .destructive) {
                markNoShow()
            }
        } message: {
            Text("Are you sure you want to mark this session as a no-show? This indicates the client did not attend.")
        }
        .loadingOverlay(isUpdatingStatus)
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

    private func markComplete() {
        updateSessionStatus(.completed)
    }

    private func markNoShow() {
        updateSessionStatus(.noShow)
    }

    private func cancelSession() {
        updateSessionStatus(.cancelled)
    }

    private func updateSessionStatus(_ status: SessionStatus) {
        isUpdatingStatus = true

        Task {
            do {
                let input = UpdateSessionInput(status: status)
                let updatedSession = try await APIClient.shared.updateSession(id: session.id, input)
                await MainActor.run {
                    session = updatedSession
                    isUpdatingStatus = false

                    // Provide haptic feedback
                    HapticManager.shared.notification( .success)
                }
            } catch {
                await MainActor.run {
                    statusUpdateError = error
                    isUpdatingStatus = false

                    // Provide error haptic feedback
                    HapticManager.shared.notification( .error)
                }
            }
        }
    }

    private func createNote() {
        // Navigate to create note for this session
        // This will be handled by navigation in a future update
        // For now, we can show a placeholder or use the Notes tab
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
