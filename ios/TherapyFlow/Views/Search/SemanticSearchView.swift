import SwiftUI

struct SemanticSearchView: View {
    @State private var searchQuery = ""
    @State private var searchResults: [SearchResult] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    @State private var error: Error?

    // Filters
    @State private var selectedTypes: Set<SearchResultType> = []
    @State private var dateRange: DateRange = .all
    @State private var selectedClientId: String?
    @State private var showingFilters = false

    // Available clients for filtering
    @State private var clients: [Client] = []

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        VStack(spacing: 0) {
            // Search Header
            searchHeader

            Divider()

            // Content
            if horizontalSizeClass == .regular {
                HStack(spacing: 0) {
                    // Results
                    resultsView
                        .frame(maxWidth: .infinity)

                    Divider()

                    // Filters sidebar
                    filtersPanel
                        .frame(width: 300)
                }
            } else {
                resultsView
            }
        }
        .background(Color.theme.background)
        .navigationTitle("Search")
        .toolbar {
            if horizontalSizeClass != .regular {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: { showingFilters = true }) {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .foregroundColor(hasActiveFilters ? Color.theme.primary : Color.theme.secondaryText)
                    }
                }
            }
        }
        .sheet(isPresented: $showingFilters) {
            NavigationStack {
                SearchFiltersView(
                    selectedTypes: $selectedTypes,
                    dateRange: $dateRange,
                    selectedClientId: $selectedClientId,
                    clients: clients
                )
            }
        }
        .task {
            await loadClients()
        }
    }

    // MARK: - Search Header
    private var searchHeader: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "sparkle.magnifyingglass")
                    .font(.title3)
                    .foregroundColor(Color.theme.primary)

                TextField("Search notes, clients, sessions...", text: $searchQuery)
                    .textFieldStyle(.plain)
                    .submitLabel(.search)
                    .onSubmit {
                        performSearch()
                    }

                if !searchQuery.isEmpty {
                    Button(action: { searchQuery = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(Color.theme.tertiaryText)
                    }
                }

                Button(action: performSearch) {
                    Text("Search")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.theme.primary)
                        .cornerRadius(8)
                }
                .disabled(searchQuery.trimmingCharacters(in: .whitespaces).isEmpty || isSearching)
            }
            .padding()
            .background(Color.theme.surface)
            .cornerRadius(12)

            // Quick filters (iPhone)
            if horizontalSizeClass != .regular {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(SearchResultType.allCases, id: \.self) { type in
                            FilterChip(
                                title: type.displayName,
                                isSelected: selectedTypes.contains(type)
                            ) {
                                toggleType(type)
                            }
                        }

                        FilterChip(
                            title: dateRange.displayName,
                            isSelected: dateRange != .all,
                            icon: "calendar"
                        ) {
                            showingFilters = true
                        }
                    }
                }
            }
        }
        .padding()
    }

    // MARK: - Results View
    private var resultsView: some View {
        Group {
            if isSearching {
                VStack(spacing: 16) {
                    Spacer()
                    ProgressView()
                    Text("Searching...")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                    Spacer()
                }
            } else if !hasSearched {
                searchPromptView
            } else if searchResults.isEmpty {
                emptyResultsView
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        // Results count
                        HStack {
                            Text("\(searchResults.count) results")
                                .font(.subheadline)
                                .foregroundColor(Color.theme.secondaryText)
                            Spacer()
                        }
                        .padding(.horizontal)

                        ForEach(searchResults) { result in
                            SearchResultRow(result: result)
                        }
                    }
                    .padding()
                }
            }
        }
    }

    // MARK: - Search Prompt
    private var searchPromptView: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "sparkle.magnifyingglass")
                .font(.system(size: 56))
                .foregroundColor(Color.theme.primaryLight)

            VStack(spacing: 8) {
                Text("AI-Powered Search")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundColor(Color.theme.primaryText)

                Text("Search across all your notes, clients, and sessions using natural language")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            // Example queries
            VStack(alignment: .leading, spacing: 12) {
                Text("Try searching for:")
                    .font(.caption)
                    .foregroundColor(Color.theme.tertiaryText)

                ForEach(exampleQueries, id: \.self) { query in
                    Button(action: { searchWithQuery(query) }) {
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .font(.caption)
                            Text(query)
                                .font(.subheadline)
                        }
                        .foregroundColor(Color.theme.primary)
                    }
                }
            }
            .padding()
            .background(Color.theme.surfaceSecondary)
            .cornerRadius(12)

            Spacer()
        }
        .padding()
    }

    // MARK: - Empty Results
    private var emptyResultsView: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(Color.theme.primaryLight)

            Text("No results found")
                .font(.headline)
                .foregroundColor(Color.theme.primaryText)

            Text("Try adjusting your search terms or filters")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)

            Spacer()
        }
    }

    // MARK: - Filters Panel (iPad)
    private var filtersPanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Filters")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                // Result Types
                VStack(alignment: .leading, spacing: 12) {
                    Text("Type")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.secondaryText)

                    ForEach(SearchResultType.allCases, id: \.self) { type in
                        Toggle(isOn: Binding(
                            get: { selectedTypes.contains(type) },
                            set: { isSelected in
                                if isSelected {
                                    selectedTypes.insert(type)
                                } else {
                                    selectedTypes.remove(type)
                                }
                            }
                        )) {
                            HStack(spacing: 8) {
                                Image(systemName: type.icon)
                                    .foregroundColor(Color.theme.primary)
                                Text(type.displayName)
                            }
                        }
                        .tint(Color.theme.primary)
                    }
                }

                Divider()

                // Date Range
                VStack(alignment: .leading, spacing: 12) {
                    Text("Date Range")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.secondaryText)

                    ForEach(DateRange.allCases, id: \.self) { range in
                        Button(action: { dateRange = range }) {
                            HStack {
                                Text(range.displayName)
                                    .foregroundColor(Color.theme.primaryText)
                                Spacer()
                                if dateRange == range {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(Color.theme.primary)
                                }
                            }
                        }
                    }
                }

                Divider()

                // Client Filter
                VStack(alignment: .leading, spacing: 12) {
                    Text("Client")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(Color.theme.secondaryText)

                    Picker("Client", selection: $selectedClientId) {
                        Text("All Clients").tag(nil as String?)
                        ForEach(clients) { client in
                            Text(client.name).tag(client.id as String?)
                        }
                    }
                    .pickerStyle(.menu)
                }

                Divider()

                // Clear Filters
                if hasActiveFilters {
                    Button(action: clearFilters) {
                        HStack {
                            Image(systemName: "xmark.circle")
                            Text("Clear Filters")
                        }
                        .font(.subheadline)
                        .foregroundColor(Color.theme.warning)
                    }
                }
            }
            .padding()
        }
        .background(Color.theme.surface)
    }

    // MARK: - Example Queries
    private var exampleQueries: [String] {
        [
            "clients struggling with anxiety",
            "progress notes from last week",
            "sessions about relationship issues",
            "high risk assessments",
            "treatment goals for depression"
        ]
    }

    // MARK: - Computed Properties
    private var hasActiveFilters: Bool {
        !selectedTypes.isEmpty || dateRange != .all || selectedClientId != nil
    }

    // MARK: - Actions
    private func performSearch() {
        let query = searchQuery.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return }

        isSearching = true
        hasSearched = true

        Task {
            do {
                let searchInput = SearchQuery(
                    query: query,
                    type: selectedTypes.isEmpty ? nil : selectedTypes.first,
                    clientId: selectedClientId,
                    dateRange: dateRange == .all ? nil : dateRange
                )

                let response = try await APIClient.shared.semanticSearch(query: searchInput)

                await MainActor.run {
                    searchResults = response.results
                    isSearching = false
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isSearching = false
                }
            }
        }
    }

    private func searchWithQuery(_ query: String) {
        searchQuery = query
        performSearch()
    }

    private func toggleType(_ type: SearchResultType) {
        if selectedTypes.contains(type) {
            selectedTypes.remove(type)
        } else {
            selectedTypes.insert(type)
        }
    }

    private func clearFilters() {
        selectedTypes.removeAll()
        dateRange = .all
        selectedClientId = nil
    }

    private func loadClients() async {
        do {
            let fetchedClients = try await APIClient.shared.getClients()
            await MainActor.run {
                clients = fetchedClients.filter { $0.status == .active }
            }
        } catch {
            // Silently fail - filters will just not show clients
        }
    }
}

// MARK: - Search Filters View (iPhone Sheet)
struct SearchFiltersView: View {
    @Binding var selectedTypes: Set<SearchResultType>
    @Binding var dateRange: DateRange
    @Binding var selectedClientId: String?
    let clients: [Client]

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Section("Type") {
                ForEach(SearchResultType.allCases, id: \.self) { type in
                    Toggle(isOn: Binding(
                        get: { selectedTypes.contains(type) },
                        set: { isSelected in
                            if isSelected {
                                selectedTypes.insert(type)
                            } else {
                                selectedTypes.remove(type)
                            }
                        }
                    )) {
                        HStack(spacing: 8) {
                            Image(systemName: type.icon)
                                .foregroundColor(Color.theme.primary)
                            Text(type.displayName)
                        }
                    }
                    .tint(Color.theme.primary)
                }
            }

            Section("Date Range") {
                Picker("Range", selection: $dateRange) {
                    ForEach(DateRange.allCases, id: \.self) { range in
                        Text(range.displayName).tag(range)
                    }
                }
                .pickerStyle(.inline)
            }

            Section("Client") {
                Picker("Client", selection: $selectedClientId) {
                    Text("All Clients").tag(nil as String?)
                    ForEach(clients) { client in
                        Text(client.name).tag(client.id as String?)
                    }
                }
            }

            Section {
                Button("Clear All Filters") {
                    selectedTypes.removeAll()
                    dateRange = .all
                    selectedClientId = nil
                }
                .foregroundColor(Color.theme.warning)
            }
        }
        .navigationTitle("Filters")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Done") {
                    dismiss()
                }
            }
        }
    }
}

// MARK: - Filter Chip
struct FilterChip: View {
    let title: String
    let isSelected: Bool
    var icon: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.caption)
                }
                Text(title)
                    .font(.caption)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? Color.theme.primary : Color.theme.surfaceSecondary)
            .foregroundColor(isSelected ? .white : Color.theme.primaryText)
            .cornerRadius(16)
        }
    }
}

#Preview {
    NavigationStack {
        SemanticSearchView()
    }
}
