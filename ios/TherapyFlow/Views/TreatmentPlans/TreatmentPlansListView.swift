import SwiftUI

struct TreatmentPlansListView: View {
    var clientId: String? = nil
    
    @State private var treatmentPlans: [TreatmentPlan] = []
    @State private var isLoading = true
    @State private var error: Error?
    @State private var searchText = ""
    @State private var showingCreate = false

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var filteredPlans: [TreatmentPlan] {
        var plans = treatmentPlans
        
        if let clientId = clientId {
            plans = plans.filter { $0.clientId == clientId }
        }
        
        if searchText.isEmpty {
            return plans.sorted { $0.updatedAt > $1.updatedAt }
        }

        return plans.filter {
            $0.clientName?.localizedCaseInsensitiveContains(searchText) ?? false ||
            $0.diagnosis?.localizedCaseInsensitiveContains(searchText) ?? false
        }.sorted { $0.updatedAt > $1.updatedAt }
    }

    var body: some View {
        Group {
            if isLoading {
                LoadingView()
            } else if let error = error {
                ErrorView(error: error, onRetry: loadPlans)
            } else if filteredPlans.isEmpty {
                EmptyStateView(
                    icon: "list.clipboard",
                    title: searchText.isEmpty ? "No Treatment Plans" : "No Results",
                    message: searchText.isEmpty ? "Create treatment plans to track client goals and progress" : "Try adjusting your search",
                    actionTitle: searchText.isEmpty ? "Create Plan" : nil,
                    action: searchText.isEmpty ? { showingCreate = true } : nil
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(filteredPlans) { plan in
                            NavigationLink(destination: TreatmentPlanDetailViewWrapper(plan: plan)) {
                                TreatmentPlanRow(plan: plan)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Treatment Plans")
        .searchable(text: $searchText, prompt: "Search plans...")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingCreate = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingCreate) {
            NavigationStack {
                TreatmentPlanFormView(initialClientId: clientId) { newPlan in
                    treatmentPlans.insert(newPlan, at: 0)
                    showingCreate = false
                }
            }
        }
        .refreshable {
            await loadPlansAsync()
        }
        .task {
            await loadPlansAsync()
        }
    }

    // MARK: - Data Loading
    private func loadPlans() {
        Task {
            await loadPlansAsync()
        }
    }

    private func loadPlansAsync() async {
        isLoading = true
        error = nil

        do {
            let fetchedPlans = try await APIClient.shared.getTreatmentPlans()
            await MainActor.run {
                treatmentPlans = fetchedPlans
                isLoading = false
            }
        } catch {
            await MainActor.run {
                self.error = error
                isLoading = false
            }
        }
    }
}

// MARK: - Treatment Plan Row
struct TreatmentPlanRow: View {
    let plan: TreatmentPlan

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack(spacing: 12) {
                AvatarView(name: plan.clientName ?? "C", size: 44)

                VStack(alignment: .leading, spacing: 4) {
                    Text(plan.clientName ?? "Client")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.primaryText)

                    if let diagnosis = plan.diagnosis {
                        Text(diagnosis)
                            .font(.caption)
                            .foregroundColor(Color.theme.secondaryText)
                            .lineLimit(1)
                    }
                }

                Spacer()

                TreatmentPlanStatusBadge(status: plan.status)
            }

            // Goals progress
            if !plan.goals.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Goals")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(Color.theme.secondaryText)

                        Spacer()

                        Text("\(completedGoals)/\(plan.goals.count) completed")
                            .font(.caption)
                            .foregroundColor(Color.theme.tertiaryText)
                    }

                    // Progress bar
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.theme.surfaceSecondary)
                                .frame(height: 6)

                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.theme.primary)
                                .frame(width: geometry.size.width * progressPercentage, height: 6)
                        }
                    }
                    .frame(height: 6)
                }
            }

            // Footer
            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .font(.caption2)
                    Text(plan.startDate.shortDate)
                        .font(.caption)
                }
                .foregroundColor(Color.theme.tertiaryText)

                if let endDate = plan.targetEndDate {
                    Text("→")
                        .foregroundColor(Color.theme.tertiaryText)

                    Text(endDate.shortDate)
                        .font(.caption)
                        .foregroundColor(Color.theme.tertiaryText)
                }

                Spacer()

                Text("Updated \(plan.updatedAt.relativeString)")
                    .font(.caption)
                    .foregroundColor(Color.theme.tertiaryText)
            }
        }
        .padding()
        .background(Color.theme.surface)
        .cornerRadius(12)
    }

    private var completedGoals: Int {
        plan.goals.filter { $0.status == .achieved }.count
    }

    private var progressPercentage: CGFloat {
        guard !plan.goals.isEmpty else { return 0 }
        return CGFloat(completedGoals) / CGFloat(plan.goals.count)
    }
}

// MARK: - Treatment Plan Status Badge
struct TreatmentPlanStatusBadge: View {
    let status: TreatmentPlanStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.15))
            .foregroundColor(statusColor)
            .cornerRadius(6)
    }

    private var statusColor: Color {
        switch status {
        case .active:
            return Color.theme.success
        case .completed:
            return Color.theme.primary
        case .onHold:
            return Color.theme.warning
        case .discontinued:
            return Color.theme.error
        }
    }
}

// MARK: - Treatment Plan Form View
struct TreatmentPlanFormView: View {
    var initialClientId: String? = nil
    let onSave: (TreatmentPlan) -> Void

    @State private var selectedClientId: String?
    @State private var diagnosis = ""
    @State private var startDate = Date()
    @State private var targetEndDate: Date?
    @State private var goals: [String] = [""]

    @State private var clients: [Client] = []
    @State private var isLoadingClients = true
    @State private var isSaving = false
    @State private var error: Error?

    @Environment(\.dismiss) private var dismiss
    
    init(initialClientId: String? = nil, onSave: @escaping (TreatmentPlan) -> Void) {
        self.initialClientId = initialClientId
        self.onSave = onSave
        _selectedClientId = State(initialValue: initialClientId)
    }

    var body: some View {
        Form {
            Section("Client") {
                if isLoadingClients {
                    HStack {
                        ProgressView()
                        Text("Loading clients...")
                            .foregroundColor(Color.theme.secondaryText)
                    }
                } else {
                    Picker("Select Client", selection: $selectedClientId) {
                        Text("Select a client").tag(nil as String?)
                        ForEach(clients) { client in
                            Text(client.name).tag(client.id as String?)
                        }
                    }
                }
            }

            Section("Diagnosis") {
                TextField("Primary diagnosis", text: $diagnosis)
            }

            Section("Timeline") {
                DatePicker("Start Date", selection: $startDate, displayedComponents: .date)

                Toggle("Set Target End Date", isOn: Binding(
                    get: { targetEndDate != nil },
                    set: { targetEndDate = $0 ? Date().addingTimeInterval(90 * 24 * 60 * 60) : nil }
                ))

                if let _ = targetEndDate {
                    DatePicker(
                        "Target End Date",
                        selection: Binding(
                            get: { targetEndDate ?? Date() },
                            set: { targetEndDate = $0 }
                        ),
                        displayedComponents: .date
                    )
                }
            }

            Section("Goals") {
                ForEach(goals.indices, id: \.self) { index in
                    HStack {
                        TextField("Goal \(index + 1)", text: $goals[index])

                        if goals.count > 1 {
                            Button(action: { goals.remove(at: index) }) {
                                Image(systemName: "minus.circle.fill")
                                    .foregroundColor(Color.theme.error)
                            }
                        }
                    }
                }

                Button(action: { goals.append("") }) {
                    HStack {
                        Image(systemName: "plus.circle.fill")
                        Text("Add Goal")
                    }
                    .foregroundColor(Color.theme.primary)
                }
            }
        }
        .navigationTitle("New Treatment Plan")
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
                .disabled(selectedClientId == nil || isSaving)
            }
        }
        .loadingOverlay(isSaving)
        .task {
            await loadClients()
        }
    }

    private func loadClients() async {
        do {
            let fetchedClients = try await APIClient.shared.getClients()
            await MainActor.run {
                clients = fetchedClients.filter { $0.status == .active }
                isLoadingClients = false
            }
        } catch {
            await MainActor.run {
                isLoadingClients = false
            }
        }
    }

    private func save() {
        guard let clientId = selectedClientId else { return }

        isSaving = true

        Task {
            do {
                let goalInputs = goals
                    .filter { !$0.isEmpty }
                    .map { TreatmentGoalInput(description: $0) }

                let input = CreateTreatmentPlanInput(
                    clientId: clientId,
                    diagnosis: diagnosis.isEmpty ? nil : diagnosis,
                    startDate: startDate,
                    targetEndDate: targetEndDate,
                    goals: goalInputs.isEmpty ? nil : goalInputs
                )

                let plan = try await APIClient.shared.createTreatmentPlan(input)

                await MainActor.run {
                    isSaving = false
                    onSave(plan)
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

// Note: CreateTreatmentPlanInput is defined in Models/TreatmentPlan.swift

// MARK: - Treatment Plan Detail View Wrapper
struct TreatmentPlanDetailViewWrapper: View {
    let plan: TreatmentPlan

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(plan.clientName ?? "Client")
                            .font(.title2)
                            .fontWeight(.bold)
                        Spacer()
                        TreatmentPlanStatusBadge(status: plan.status)
                    }

                    if let diagnosis = plan.diagnosis {
                        Text(diagnosis)
                            .font(.subheadline)
                            .foregroundColor(Color.theme.secondaryText)
                    }
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(12)

                // Timeline
                VStack(alignment: .leading, spacing: 12) {
                    Text("Timeline")
                        .font(.headline)

                    HStack {
                        VStack(alignment: .leading) {
                            Text("Start Date")
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)
                            Text(plan.startDate.shortDate)
                                .font(.subheadline)
                        }

                        Spacer()

                        if let endDate = plan.targetEndDate {
                            VStack(alignment: .trailing) {
                                Text("Target End")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.secondaryText)
                                Text(endDate.shortDate)
                                    .font(.subheadline)
                            }
                        }
                    }
                }
                .padding()
                .background(Color.theme.surface)
                .cornerRadius(12)

                // Goals
                if !plan.goals.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Goals")
                            .font(.headline)

                        ForEach(plan.goals) { goal in
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: goal.status.icon)
                                    .foregroundColor(goalStatusColor(goal.status))

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(goal.description)
                                        .font(.subheadline)

                                    Text(goal.status.displayName)
                                        .font(.caption)
                                        .foregroundColor(Color.theme.secondaryText)
                                }

                                Spacer()

                                if let progress = goal.progress {
                                    Text("\(Int(progress))%")
                                        .font(.caption)
                                        .foregroundColor(Color.theme.tertiaryText)
                                }
                            }
                            .padding()
                            .background(Color.theme.surfaceSecondary)
                            .cornerRadius(8)
                        }
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(12)
                }

                // Interventions
                if !plan.interventions.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Interventions")
                            .font(.headline)

                        ForEach(plan.interventions, id: \.self) { intervention in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "checkmark.circle")
                                    .foregroundColor(Color.theme.primary)
                                Text(intervention)
                                    .font(.subheadline)
                            }
                        }
                    }
                    .padding()
                    .background(Color.theme.surface)
                    .cornerRadius(12)
                }
            }
            .padding()
        }
        .background(Color.theme.background)
        .navigationTitle("Treatment Plan")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func goalStatusColor(_ status: GoalStatus) -> Color {
        switch status {
        case .notStarted: return Color.gray
        case .inProgress: return Color.blue
        case .achieved: return Color.green
        case .discontinued: return Color.orange
        }
    }
}

#Preview {
    NavigationStack {
        TreatmentPlansListView()
    }
}
