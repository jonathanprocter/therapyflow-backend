import SwiftUI

struct ClientFormView: View {
    enum Mode {
        case create
        case edit(Client)

        var title: String {
            switch self {
            case .create: return "New Client"
            case .edit: return "Edit Client"
            }
        }
    }

    let mode: Mode
    let onSave: (Client) -> Void

    @Environment(\.dismiss) private var dismiss

    // Form fields
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var dateOfBirth: Date?
    @State private var showDatePicker = false
    @State private var status: ClientStatus = .active
    @State private var tags: [String] = []
    @State private var newTag = ""

    // Emergency contact
    @State private var emergencyName = ""
    @State private var emergencyPhone = ""
    @State private var emergencyRelationship = ""

    // Insurance
    @State private var insuranceProvider = ""
    @State private var policyNumber = ""
    @State private var groupNumber = ""

    // State
    @State private var isLoading = false
    @State private var error: Error?

    init(mode: Mode, onSave: @escaping (Client) -> Void) {
        self.mode = mode
        self.onSave = onSave

        // Pre-fill for edit mode
        if case .edit(let client) = mode {
            _name = State(initialValue: client.name)
            _email = State(initialValue: client.email ?? "")
            _phone = State(initialValue: client.phone ?? "")
            _dateOfBirth = State(initialValue: client.dateOfBirth)
            _status = State(initialValue: client.status)
            _tags = State(initialValue: client.tags)

            if let emergency = client.emergencyContact {
                _emergencyName = State(initialValue: emergency.name)
                _emergencyPhone = State(initialValue: emergency.phone)
                _emergencyRelationship = State(initialValue: emergency.relationship ?? "")
            }

            if let insurance = client.insurance {
                _insuranceProvider = State(initialValue: insurance.provider)
                _policyNumber = State(initialValue: insurance.policyNumber)
                _groupNumber = State(initialValue: insurance.groupNumber ?? "")
            }
        }
    }

    var body: some View {
        Form {
            // Basic Info
            Section("Basic Information") {
                TextField("Full Name", text: $name)
                    .textContentType(.name)

                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)

                TextField("Phone", text: $phone)
                    .textContentType(.telephoneNumber)
                    .keyboardType(.phonePad)

                Button(action: { showDatePicker.toggle() }) {
                    HStack {
                        Text("Date of Birth")
                        Spacer()
                        Text(dateOfBirth?.mediumDate ?? "Not set")
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }

                if showDatePicker {
                    DatePicker(
                        "Select date",
                        selection: Binding(
                            get: { dateOfBirth ?? Date() },
                            set: { dateOfBirth = $0 }
                        ),
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                }

                if case .edit = mode {
                    Picker("Status", selection: $status) {
                        ForEach(ClientStatus.allCases, id: \.self) { status in
                            Text(status.displayName).tag(status)
                        }
                    }
                }
            }

            // Tags
            Section("Tags") {
                FlowLayout(spacing: 8) {
                    ForEach(tags, id: \.self) { tag in
                        HStack(spacing: 4) {
                            Text(tag)
                            Button(action: { removeTag(tag) }) {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.caption)
                            }
                        }
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.theme.primaryLight)
                        .foregroundColor(Color.theme.primaryDark)
                        .cornerRadius(6)
                    }
                }

                HStack {
                    TextField("Add tag", text: $newTag)
                        .textInputAutocapitalization(.never)

                    Button("Add") {
                        addTag()
                    }
                    .disabled(newTag.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }

            // Emergency Contact
            Section("Emergency Contact") {
                TextField("Name", text: $emergencyName)
                    .textContentType(.name)

                TextField("Phone", text: $emergencyPhone)
                    .textContentType(.telephoneNumber)
                    .keyboardType(.phonePad)

                TextField("Relationship", text: $emergencyRelationship)
            }

            // Insurance
            Section("Insurance") {
                TextField("Provider", text: $insuranceProvider)

                TextField("Policy Number", text: $policyNumber)

                TextField("Group Number", text: $groupNumber)
            }
        }
        .navigationTitle(mode.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
            }

            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    save()
                }
                .disabled(!isValid || isLoading)
            }
        }
        .loadingOverlay(isLoading)
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error?.localizedDescription ?? "")
        }
    }

    // MARK: - Validation
    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Actions
    private func addTag() {
        let tag = newTag.trimmingCharacters(in: .whitespaces).lowercased()
        guard !tag.isEmpty, !tags.contains(tag) else { return }
        tags.append(tag)
        newTag = ""
    }

    private func removeTag(_ tag: String) {
        tags.removeAll { $0 == tag }
    }

    private func save() {
        guard isValid else { return }

        isLoading = true

        let emergencyContact: EmergencyContact? = emergencyName.isEmpty ? nil : EmergencyContact(
            name: emergencyName,
            phone: emergencyPhone,
            relationship: emergencyRelationship.isEmpty ? nil : emergencyRelationship
        )

        let insurance: Insurance? = insuranceProvider.isEmpty ? nil : Insurance(
            provider: insuranceProvider,
            policyNumber: policyNumber,
            groupNumber: groupNumber.isEmpty ? nil : groupNumber
        )

        Task {
            do {
                let result: Client

                switch mode {
                case .create:
                    let input = CreateClientInput(
                        name: name,
                        email: email.isEmpty ? nil : email,
                        phone: phone.isEmpty ? nil : phone,
                        dateOfBirth: dateOfBirth,
                        tags: tags.isEmpty ? nil : tags,
                        emergencyContact: emergencyContact,
                        insurance: insurance
                    )
                    result = try await APIClient.shared.createClient(input)

                case .edit(let client):
                    let input = UpdateClientInput(
                        clientId: client.id,
                        name: name,
                        email: email.isEmpty ? nil : email,
                        phone: phone.isEmpty ? nil : phone,
                        dateOfBirth: dateOfBirth,
                        status: status,
                        tags: tags.isEmpty ? nil : tags,
                        emergencyContact: emergencyContact,
                        insurance: insurance
                    )
                    result = try await APIClient.shared.updateClient(id: client.id, input)
                }

                await MainActor.run {
                    isLoading = false
                    onSave(result)
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isLoading = false
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        ClientFormView(mode: .create) { _ in }
    }
}
