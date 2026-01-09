import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var authService: AuthService

    @State private var name: String = ""
    @State private var email: String = ""
    @State private var title: String = ""
    @State private var licenseNumber: String = ""
    @State private var phoneNumber: String = ""
    @State private var practiceName: String = ""

    @State private var isEditing = false
    @State private var isSaving = false
    @State private var error: Error?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            // Avatar Section
            Section {
                HStack {
                    Spacer()
                    VStack(spacing: 12) {
                        AvatarView(name: name, size: 80)

                        if isEditing {
                            Button("Change Photo") {
                                // Photo picker
                            }
                            .font(.subheadline)
                            .foregroundColor(Color.theme.primary)
                        }
                    }
                    Spacer()
                }
                .padding(.vertical, 16)
            }

            // Personal Info
            Section("Personal Information") {
                if isEditing {
                    TextField("Full Name", text: $name)
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    TextField("Phone", text: $phoneNumber)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                } else {
                    ProfileRow(label: "Name", value: name)
                    ProfileRow(label: "Email", value: email)
                    ProfileRow(label: "Phone", value: phoneNumber.isEmpty ? "Not set" : phoneNumber)
                }
            }

            // Professional Info
            Section("Professional Information") {
                if isEditing {
                    TextField("Title", text: $title)
                    TextField("License Number", text: $licenseNumber)
                    TextField("Practice Name", text: $practiceName)
                } else {
                    ProfileRow(label: "Title", value: title.isEmpty ? "Not set" : title)
                    ProfileRow(label: "License", value: licenseNumber.isEmpty ? "Not set" : licenseNumber)
                    ProfileRow(label: "Practice", value: practiceName.isEmpty ? "Not set" : practiceName)
                }
            }

            // Account Info
            Section("Account") {
                ProfileRow(label: "Role", value: authService.currentUser?.role.rawValue.capitalized ?? "Therapist")
                ProfileRow(label: "Member Since", value: authService.currentUser?.createdAt.longDate ?? "Unknown")
            }
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") {
                    dismiss()
                }
            }

            ToolbarItem(placement: .primaryAction) {
                if isEditing {
                    Button("Save") {
                        saveProfile()
                    }
                    .disabled(isSaving)
                } else {
                    Button("Edit") {
                        isEditing = true
                    }
                }
            }
        }
        .loadingOverlay(isSaving)
        .onAppear {
            loadProfile()
        }
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error?.localizedDescription ?? "")
        }
    }

    // MARK: - Actions
    private func loadProfile() {
        if let user = authService.currentUser {
            name = user.name
            email = user.email
            title = user.title ?? ""
            licenseNumber = user.licenseNumber ?? ""
            phoneNumber = user.phoneNumber ?? ""
            practiceName = user.practiceName ?? ""
        }
    }

    private func saveProfile() {
        isSaving = true

        Task {
            do {
                let input = UpdateUserInput(
                    name: name,
                    title: title.isEmpty ? nil : title,
                    licenseNumber: licenseNumber.isEmpty ? nil : licenseNumber,
                    phoneNumber: phoneNumber.isEmpty ? nil : phoneNumber,
                    practiceName: practiceName.isEmpty ? nil : practiceName
                )

                let updatedUser = try await APIClient.shared.updateProfile(input)

                await MainActor.run {
                    authService.updateCurrentUser(updatedUser)
                    isSaving = false
                    isEditing = false
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isSaving = false
                }
            }
        }
    }
}

// MARK: - Profile Row
struct ProfileRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(Color.theme.secondaryText)
            Spacer()
            Text(value)
                .foregroundColor(Color.theme.primaryText)
        }
    }
}

#Preview {
    NavigationStack {
        ProfileView()
            .environmentObject(AuthService.shared)
    }
}
