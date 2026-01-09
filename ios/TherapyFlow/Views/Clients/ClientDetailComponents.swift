import SwiftUI

// MARK: - Client Detail Sections
struct ClientHeaderSection: View {
    let client: Client

    var body: some View {
        VStack(spacing: 16) {
            AvatarWithStatus(name: client.name, size: 80, status: client.status)

            VStack(spacing: 8) {
                Text(client.name)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(Color.theme.primaryText)

                ClientStatusBadge(status: client.status)

                if let age = client.age {
                    Text("\(age) years old")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(16)
    }
}

struct ClientClinicalToolsSection: View {
    let client: Client

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Clinical Tools")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            VStack(spacing: 12) {
                NavigationLink(destination: TreatmentPlansListView(clientId: client.id)) {
                    ClinicalToolRow(
                        icon: "list.clipboard",
                        title: "Treatment Plan",
                        subtitle: "Manage goals and interventions",
                        color: .blue
                    )
                }

                NavigationLink(destination: TherapeuticJourneyView(clientId: client.id)) {
                    ClinicalToolRow(
                        icon: "map",
                        title: "Therapeutic Journey",
                        subtitle: "Insights, themes, and progress",
                        color: .purple
                    )
                }

                NavigationLink(destination: ClientTimelineView(clientId: client.id, clientName: client.name)) {
                    ClinicalToolRow(
                        icon: "timeline.selection",
                        title: "Appointment Timeline",
                        subtitle: "Longitudinal session history with notes",
                        color: .orange
                    )
                }

                NavigationLink(destination: SessionHistoryView(clientId: client.id)) {
                    ClinicalToolRow(
                        icon: "clock.arrow.circlepath",
                        title: "Session History",
                        subtitle: "View all past sessions",
                        color: .teal
                    )
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct ClientContactInfoSection: View {
    let client: Client

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Contact Information")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            VStack(spacing: 12) {
                if let email = client.email, !email.isEmpty {
                    ContactRow(icon: "envelope", title: "Email", value: email)
                }

                if let phone = client.phone, !phone.isEmpty {
                    ContactRow(icon: "phone", title: "Phone", value: phone)
                }

                if let dob = client.dateOfBirth {
                    ContactRow(icon: "calendar", title: "Date of Birth", value: dob.mediumDate)
                }

                if let emergency = client.emergencyContact {
                    ContactRow(
                        icon: "exclamationmark.triangle",
                        title: "Emergency Contact",
                        value: "\(emergency.name) - \(emergency.phone)"
                    )
                }

                if let insurance = client.insurance {
                    ContactRow(
                        icon: "creditcard",
                        title: "Insurance",
                        value: "\(insurance.provider) - \(insurance.policyNumber)"
                    )
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct ClientTagsSection: View {
    let client: Client

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Tags & Considerations")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            if !client.tags.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(client.tags, id: \.self) { tag in
                        TagBadge(tag: tag)
                    }
                }
            }

            if !client.clinicalConsiderations.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Clinical Considerations")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.secondaryText)

                    ForEach(client.clinicalConsiderations, id: \.self) { consideration in
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.circle")
                                .font(.caption)
                                .foregroundColor(Color.theme.warning)

                            Text(consideration)
                                .font(.subheadline)
                                .foregroundColor(Color.theme.primaryText)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct ClientSessionsSection: View {
    let sessions: [Session]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Recent Sessions")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                Text("\(sessions.count) total")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            if sessions.isEmpty {
                Text("No sessions yet")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                VStack(spacing: 8) {
                    ForEach(sessions.prefix(5)) { session in
                        SessionMiniRow(session: session)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct ClientNotesSection: View {
    let notes: [ProgressNote]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Progress Notes")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Spacer()

                Text("\(notes.count) total")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            if notes.isEmpty {
                Text("No notes yet")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                VStack(spacing: 8) {
                    ForEach(notes.prefix(5)) { note in
                        NoteMiniRow(note: note)
                    }
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }
}

struct ClientDeleteOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.5)
                Text("Deleting...")
                    .font(.headline)
                    .foregroundColor(.white)
            }
            .padding(32)
            .background(Color.theme.surface)
            .cornerRadius(16)
        }
    }
}

// MARK: - Helper Views
struct ContactRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body)
                .foregroundColor(Color.theme.primary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)

                Text(value)
                    .font(.subheadline)
                    .foregroundColor(Color.theme.primaryText)
            }

            Spacer()
        }
    }
}

struct SessionMiniRow: View {
    let session: Session

    var body: some View {
        HStack(spacing: 12) {
            Text(session.scheduledAt.monthDay)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
                .frame(width: 50, alignment: .leading)

            SessionTypeBadge(type: session.sessionType)

            Spacer()

            SessionStatusBadge(status: session.status)
        }
        .padding(.vertical, 4)
    }
}

struct NoteMiniRow: View {
    let note: ProgressNote

    var body: some View {
        HStack(spacing: 12) {
            Text(note.sessionDate.monthDay)
                .font(.caption)
                .foregroundColor(Color.theme.secondaryText)
                .frame(width: 50, alignment: .leading)

            Text(note.contentPreview)
                .font(.caption)
                .foregroundColor(Color.theme.primaryText)
                .lineLimit(1)

            Spacer()

            RiskIndicator(level: note.riskLevel)
        }
        .padding(.vertical, 4)
    }
}

struct ClinicalToolRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color

    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.1))
                    .frame(width: 40, height: 40)

                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.system(size: 20))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(Color.theme.primaryText)

                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(Color.theme.tertiaryText)
        }
        .padding(8)
        .background(Color.theme.background)
        .cornerRadius(8)
    }
}
