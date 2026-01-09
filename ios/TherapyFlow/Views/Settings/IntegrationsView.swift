import SwiftUI
import AuthenticationServices

struct IntegrationsView: View {
    @ObservedObject private var integrationsService = IntegrationsService.shared

    @State private var showingAIConfiguration = false
    @State private var showingGoogleAuth = false
    @State private var isLoading = false
    @State private var error: Error?
    @State private var successMessage: String?

    var body: some View {
        List {
            // AI Configuration Section
            Section {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(Color.theme.accent.opacity(0.15))
                                .frame(width: 44, height: 44)

                            Image(systemName: "sparkles")
                                .font(.title3)
                                .foregroundColor(Color.theme.accent)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("AI Analysis & Insights")
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            Text(integrationsService.isAIConfigured ?
                                 "Connected to \(integrationsService.aiProvider.displayName)" :
                                    "Not configured")
                                .font(.caption)
                                .foregroundColor(integrationsService.isAIConfigured ?
                                                 Color.theme.success : Color.theme.secondaryText)
                        }

                        Spacer()

                        if integrationsService.isAIConfigured {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(Color.theme.success)
                        }
                    }

                    Text("Enable AI-powered session insights, progress note analysis, risk detection, and therapeutic theme extraction.")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    Button(action: { showingAIConfiguration = true }) {
                        Text(integrationsService.isAIConfigured ? "Manage AI Settings" : "Configure AI")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.theme.primary)
                            .cornerRadius(8)
                    }
                }
                .padding(.vertical, 8)
            } header: {
                Text("AI Provider")
            } footer: {
                Text("Your API key is stored securely in the device keychain and is never shared.")
            }

            // ElevenLabs Voice Section
            ElevenLabsIntegrationSection()

            // Google Calendar Section
            Section {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(Color.blue.opacity(0.15))
                                .frame(width: 44, height: 44)

                            Image(systemName: "calendar")
                                .font(.title3)
                                .foregroundColor(.blue)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Google Calendar")
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            Text(integrationsService.googleCalendarConnected ?
                                 "Connected" : "Not connected")
                                .font(.caption)
                                .foregroundColor(integrationsService.googleCalendarConnected ?
                                                 Color.theme.success : Color.theme.secondaryText)
                        }

                        Spacer()

                        if integrationsService.googleCalendarConnected {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(Color.theme.success)
                        }
                    }

                    Text("Sync your sessions with Google Calendar to see appointments across all your devices.")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    if integrationsService.googleCalendarConnected {
                        Toggle(isOn: $integrationsService.calendarSyncEnabled) {
                            Text("Auto-sync sessions")
                                .font(.subheadline)
                        }
                        .tint(Color.theme.primary)
                        .onChange(of: integrationsService.calendarSyncEnabled) { _, newValue in
                            integrationsService.setCalendarSyncEnabled(newValue)
                        }

                        Button(action: disconnectGoogle) {
                            Text("Disconnect")
                                .font(.subheadline)
                                .foregroundColor(Color.theme.error)
                        }
                    } else {
                        Button(action: connectGoogle) {
                            HStack {
                                Image(systemName: "link")
                                Text("Connect Google Calendar")
                            }
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.blue)
                            .cornerRadius(8)
                        }
                    }
                }
                .padding(.vertical, 8)
            } header: {
                Text("Calendar Integration")
            }

            // SimplePractice Section (via Google Calendar)
            Section {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(Color.green.opacity(0.15))
                                .frame(width: 44, height: 44)

                            Image(systemName: "cross.case")
                                .font(.title3)
                                .foregroundColor(.green)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("SimplePractice Appointments")
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            Text(integrationsService.googleCalendarConnected ?
                                 "Syncing via Google Calendar" : "Requires Google Calendar")
                                .font(.caption)
                                .foregroundColor(integrationsService.googleCalendarConnected ?
                                                 Color.theme.success : Color.theme.warning)
                        }

                        Spacer()

                        if integrationsService.googleCalendarConnected {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(Color.theme.success)
                        }
                    }

                    if integrationsService.googleCalendarConnected {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 8) {
                                Image(systemName: "info.circle")
                                    .foregroundColor(Color.theme.primary)
                                Text("SimplePractice appointments sync automatically through Google Calendar.")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.secondaryText)
                            }

                            Text("To enable sync:")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(Color.theme.primaryText)

                            VStack(alignment: .leading, spacing: 6) {
                                HStack(alignment: .top, spacing: 8) {
                                    Text("1.")
                                        .font(.caption)
                                    Text("In SimplePractice, go to Settings > Calendar")
                                        .font(.caption)
                                }
                                HStack(alignment: .top, spacing: 8) {
                                    Text("2.")
                                        .font(.caption)
                                    Text("Connect your Google Calendar")
                                        .font(.caption)
                                }
                                HStack(alignment: .top, spacing: 8) {
                                    Text("3.")
                                        .font(.caption)
                                    Text("Enable \"Sync appointments to Google Calendar\"")
                                        .font(.caption)
                                }
                            }
                            .foregroundColor(Color.theme.secondaryText)
                            .padding(.leading, 4)

                            Button(action: syncSimplePracticeAppointments) {
                                HStack {
                                    if isLoading {
                                        ProgressView()
                                            .scaleEffect(0.8)
                                    } else {
                                        Image(systemName: "arrow.triangle.2.circlepath")
                                    }
                                    Text("Sync Appointments Now")
                                }
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.green)
                                .cornerRadius(8)
                            }
                            .disabled(isLoading)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("SimplePractice appointments are synced through Google Calendar. Please connect your Google Calendar first.")
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)

                            Button(action: connectGoogle) {
                                HStack {
                                    Image(systemName: "calendar")
                                    Text("Connect Google Calendar")
                                }
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.blue)
                                .cornerRadius(8)
                            }
                        }
                    }
                }
                .padding(.vertical, 8)
            } header: {
                Text("SimplePractice Integration")
            } footer: {
                Text("SimplePractice syncs appointments to Google Calendar. TherapyFlow reads these appointments automatically.")
            }
        }
        .navigationTitle("Integrations")
        .navigationBarTitleDisplayMode(.inline)
        .loadingOverlay(isLoading)
        .sheet(isPresented: $showingAIConfiguration) {
            NavigationStack {
                AIConfigurationView()
            }
        }
        .sheet(isPresented: $showingGoogleAuth) {
            GoogleAuthWebView { url in
                handleGoogleCallback(url)
            }
        }
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error?.localizedDescription ?? "")
        }
        .alert("Success", isPresented: .constant(successMessage != nil)) {
            Button("OK") { successMessage = nil }
        } message: {
            Text(successMessage ?? "")
        }
    }

    // MARK: - Actions

    private func connectGoogle() {
        showingGoogleAuth = true
    }

    private func handleGoogleCallback(_ url: URL) {
        showingGoogleAuth = false
        isLoading = true

        Task {
            do {
                try await integrationsService.handleGoogleOAuthCallback(url: url)
                await MainActor.run {
                    isLoading = false
                    successMessage = "Google Calendar connected successfully!"
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    isLoading = false
                }
            }
        }
    }

    private func disconnectGoogle() {
        do {
            try integrationsService.disconnectGoogleCalendar()
        } catch {
            self.error = error
        }
    }

    private func syncSimplePracticeAppointments() {
        isLoading = true

        Task {
            do {
                // Sync appointments via Google Calendar (includes SimplePractice appointments)
                let sessions = try await integrationsService.syncAllCalendarAppointments()

                // Filter for likely SimplePractice appointments
                let simplePracticeCount = sessions.filter { session in
                    session.notes?.lowercased().contains("simplepractice") == true ||
                    session.notes?.lowercased().contains("session") == true
                }.count

                await MainActor.run {
                    isLoading = false
                    successMessage = "Found \(sessions.count) calendar appointments (\(simplePracticeCount) from SimplePractice)"
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

// MARK: - AI Configuration View
struct AIConfigurationView: View {
    @ObservedObject private var integrationsService = IntegrationsService.shared
    @Environment(\.dismiss) private var dismiss

    @State private var selectedProvider: AIProvider = .anthropic
    @State private var apiKey = ""
    @State private var isValidating = false
    @State private var validationError: String?
    @State private var showingAPIKey = false

    var body: some View {
        Form {
            Section {
                ForEach(AIProvider.allCases, id: \.self) { provider in
                    Button(action: { selectedProvider = provider }) {
                        HStack(spacing: 12) {
                            Image(systemName: provider.icon)
                                .font(.title3)
                                .foregroundColor(Color.theme.primary)
                                .frame(width: 28)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(provider.displayName)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .foregroundColor(Color.theme.primaryText)

                                Text(provider.description)
                                    .font(.caption)
                                    .foregroundColor(Color.theme.secondaryText)
                            }

                            Spacer()

                            if selectedProvider == provider {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Color.theme.primary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            } header: {
                Text("Select AI Provider")
            }

            Section {
                VStack(alignment: .leading, spacing: 12) {
                    Text("API Key")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    HStack {
                        if showingAPIKey {
                            TextField("Enter your API key", text: $apiKey)
                                .textContentType(.password)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                        } else {
                            SecureField("Enter your API key", text: $apiKey)
                                .textContentType(.password)
                        }

                        Button(action: { showingAPIKey.toggle() }) {
                            Image(systemName: showingAPIKey ? "eye.slash" : "eye")
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }

                    if let error = validationError {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(Color.theme.error)
                    }
                }
            } header: {
                Text("\(selectedProvider.displayName) API Key")
            } footer: {
                VStack(alignment: .leading, spacing: 8) {
                    if selectedProvider == .anthropic {
                        Text("Get your API key from console.anthropic.com")
                    } else {
                        Text("Get your API key from platform.openai.com")
                    }
                }
            }

            Section {
                Button(action: validateAndSave) {
                    HStack {
                        if isValidating {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                        Text(isValidating ? "Validating..." : "Save Configuration")
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(apiKey.isEmpty || isValidating)

                if integrationsService.hasAPIKey(for: selectedProvider) {
                    Button(action: removeConfiguration) {
                        Text("Remove Configuration")
                            .foregroundColor(Color.theme.error)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .navigationTitle("AI Configuration")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
            }
        }
        .onAppear {
            if integrationsService.isAIConfigured {
                selectedProvider = integrationsService.aiProvider
                // Don't show existing key for security
            }
        }
    }

    private func validateAndSave() {
        isValidating = true
        validationError = nil

        Task {
            do {
                let isValid = try await integrationsService.validateAIAPIKey(
                    provider: selectedProvider,
                    apiKey: apiKey
                )

                if isValid {
                    try integrationsService.configureAI(provider: selectedProvider, apiKey: apiKey)

                    await MainActor.run {
                        isValidating = false
                        dismiss()
                    }
                } else {
                    await MainActor.run {
                        validationError = "Invalid API key. Please check and try again."
                        isValidating = false
                    }
                }
            } catch {
                await MainActor.run {
                    validationError = "Validation failed: \(error.localizedDescription)"
                    isValidating = false
                }
            }
        }
    }

    private func removeConfiguration() {
        do {
            try integrationsService.removeAIConfiguration(for: selectedProvider)
            dismiss()
        } catch {
            validationError = error.localizedDescription
        }
    }
}

// MARK: - OAuth Web Views
struct GoogleAuthWebView: View {
    let onCallback: (URL) -> Void

    var body: some View {
        // In production, use ASWebAuthenticationSession or WKWebView
        VStack(spacing: 20) {
            Image(systemName: "globe")
                .font(.system(size: 60))
                .foregroundColor(Color.theme.primary)

            Text("Google Sign-In")
                .font(.title2)
                .fontWeight(.semibold)

            Text("You will be redirected to Google to authorize calendar access.")
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button("Continue to Google") {
                // In production, open the OAuth URL
                let url = IntegrationsService.shared.connectGoogleCalendar()
                UIApplication.shared.open(url)
            }
            .font(.headline)
            .foregroundColor(.white)
            .padding()
            .frame(maxWidth: 280)
            .background(Color.blue)
            .cornerRadius(12)
        }
        .padding()
    }
}


// MARK: - ElevenLabs Integration Section
struct ElevenLabsIntegrationSection: View {
    @ObservedObject private var elevenLabs = ElevenLabsConversationalService.shared
    @State private var showingConfiguration = false

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(Color.purple.opacity(0.15))
                            .frame(width: 44, height: 44)

                        Image(systemName: "waveform.and.mic")
                            .font(.title3)
                            .foregroundColor(.purple)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("ElevenLabs Voice AI")
                            .font(.headline)
                            .foregroundColor(Color.theme.primaryText)

                        Text(elevenLabs.hasAPIKey() ? "Connected" : "Not configured")
                            .font(.caption)
                            .foregroundColor(elevenLabs.hasAPIKey() ?
                                             Color.theme.success : Color.theme.secondaryText)
                    }

                    Spacer()

                    if elevenLabs.hasAPIKey() {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(Color.theme.success)
                    }
                }

                Text("Enable natural voice conversations with AI. Speak naturally and hear responses in realistic voice synthesis.")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)

                if elevenLabs.hasAPIKey() {
                    VStack(spacing: 12) {
                        Toggle(isOn: $elevenLabs.voiceEnabled) {
                            Text("Voice Responses")
                                .font(.subheadline)
                        }
                        .tint(Color.theme.primary)

                        Toggle(isOn: $elevenLabs.autoSendOnSilence) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Auto-send on Silence")
                                    .font(.subheadline)
                                Text("Automatically send when you stop speaking")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.secondaryText)
                            }
                        }
                        .tint(Color.theme.primary)

                        HStack {
                            Text("Silence threshold")
                                .font(.caption)
                            Spacer()
                            Slider(value: $elevenLabs.silenceThreshold, in: 0.5...3.0, step: 0.5)
                                .frame(width: 120)
                            Text("\(elevenLabs.silenceThreshold, specifier: "%.1f")s")
                                .font(.caption)
                                .frame(width: 30)
                        }
                    }
                }

                Button(action: { showingConfiguration = true }) {
                    Text(elevenLabs.hasAPIKey() ? "Manage Voice Settings" : "Configure ElevenLabs")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.purple)
                        .cornerRadius(8)
                }
            }
            .padding(.vertical, 8)
        } header: {
            Text("Voice AI")
        } footer: {
            Text("ElevenLabs provides natural-sounding voice synthesis for conversational AI.")
        }
        .sheet(isPresented: $showingConfiguration) {
            NavigationStack {
                ElevenLabsConfigurationView()
            }
        }
    }
}

// MARK: - ElevenLabs Configuration View
struct ElevenLabsConfigurationView: View {
    @ObservedObject private var elevenLabs = ElevenLabsConversationalService.shared
    @Environment(\.dismiss) private var dismiss

    @State private var apiKey = ""
    @State private var isValidating = false
    @State private var validationError: String?
    @State private var successMessage: String?
    @State private var showingAPIKey = false
    @State private var availableVoices: [ElevenLabsConversationalService.ElevenLabsVoice] = []
    @State private var isLoadingVoices = false

    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    Text("API Key")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    HStack {
                        if showingAPIKey {
                            TextField("Enter your ElevenLabs API key", text: $apiKey)
                                .textContentType(.password)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                        } else {
                            SecureField("Enter your ElevenLabs API key", text: $apiKey)
                                .textContentType(.password)
                        }

                        Button(action: { showingAPIKey.toggle() }) {
                            Image(systemName: showingAPIKey ? "eye.slash" : "eye")
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }

                    if let error = validationError {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(Color.theme.error)
                    }
                    if let success = successMessage {
                        Text(success)
                            .font(.caption)
                            .foregroundColor(Color.theme.success)
                    }
                }
            } header: {
                Text("ElevenLabs API Key")
            } footer: {
                Text("Get your API key from elevenlabs.io/app")
            }

            if elevenLabs.isAPIKeyConfigured {
                Section {
                    if isLoadingVoices {
                        HStack {
                            ProgressView()
                            Text("Loading voices...")
                                .font(.subheadline)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    } else if availableVoices.isEmpty {
                        Button("Load Available Voices") {
                            loadVoices()
                        }
                    } else {
                        ForEach(availableVoices) { voice in
                            Button(action: { elevenLabs.voiceId = voice.voice_id }) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(voice.name)
                                            .font(.subheadline)
                                            .foregroundColor(Color.theme.primaryText)
                                        if let description = voice.description {
                                            Text(description)
                                                .font(.caption)
                                                .foregroundColor(Color.theme.secondaryText)
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                    if elevenLabs.voiceId == voice.voice_id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(Color.theme.primary)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } header: {
                    Text("Voice Selection")
                }
            }

            Section {
                Button(action: saveConfiguration) {
                    HStack {
                        if isValidating {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                        Text(isValidating ? "Saving..." : "Save Configuration")
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(apiKey.isEmpty || isValidating)

                if elevenLabs.isAPIKeyConfigured {
                    Button(action: removeConfiguration) {
                        Text("Remove Configuration")
                            .foregroundColor(Color.theme.error)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .navigationTitle("ElevenLabs Setup")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") {
                    dismiss()
                }
            }
        }
        .onAppear {
            successMessage = nil
        }
    }

    private func saveConfiguration() {
        isValidating = true
        validationError = nil
        successMessage = nil

        Task {
            do {
                try elevenLabs.saveAPIKey(apiKey)
                await MainActor.run {
                    isValidating = false
                    successMessage = "Saved. You can load voices below."
                }
            } catch {
                await MainActor.run {
                    validationError = "Failed to save: \(error.localizedDescription)"
                    isValidating = false
                }
            }
        }
    }

    private func loadVoices() {
        isLoadingVoices = true
        validationError = nil
        successMessage = nil

        Task {
            do {
                let voices = try await elevenLabs.fetchAvailableVoices()
                await MainActor.run {
                    availableVoices = voices
                    isLoadingVoices = false
                }
            } catch {
                await MainActor.run {
                    validationError = "Failed to load voices: \(error.localizedDescription)"
                    isLoadingVoices = false
                }
            }
        }
    }

    private func removeConfiguration() {
        do {
            try elevenLabs.removeAPIKey()
            dismiss()
        } catch {
            validationError = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        IntegrationsView()
    }
}
