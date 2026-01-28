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

                            Text(aiStatusText)
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

                    // Show configured providers
                    if !integrationsService.configuredProviders.isEmpty {
                        HStack(spacing: 8) {
                            ForEach(Array(integrationsService.configuredProviders), id: \.self) { provider in
                                HStack(spacing: 4) {
                                    Image(systemName: provider.icon)
                                        .font(.caption)
                                    Text(provider == .anthropic ? "Claude" : "GPT-4")
                                        .font(.caption)
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.theme.primary.opacity(0.1))
                                .cornerRadius(8)
                            }

                            if integrationsService.configuredProviders.count == 2 {
                                Text("Dual Mode")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .foregroundColor(Color.theme.success)
                            }
                        }
                    }

                    Text("Enable AI-powered session insights, progress note analysis, risk detection, and therapeutic theme extraction.")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    // Show error if keychain had issues
                    if let error = integrationsService.lastKeyLoadError {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(Color.theme.warning)
                            Text(error)
                                .font(.caption)
                                .foregroundColor(Color.theme.warning)
                        }
                    }

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
                Text("Configure both Claude and OpenAI for optimal dual-LLM routing. Your API keys are stored securely in the device keychain.")
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

    // MARK: - Computed Properties

    private var aiStatusText: String {
        let providers = integrationsService.configuredProviders
        if providers.count == 2 {
            return "Dual LLM mode active"
        } else if providers.contains(.anthropic) {
            return "Connected to Claude (Anthropic)"
        } else if providers.contains(.openAI) {
            return "Connected to OpenAI"
        } else {
            return "Not configured"
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

    @State private var anthropicKey = ""
    @State private var openAIKey = ""
    @State private var isValidating = false
    @State private var validationError: String?
    @State private var showingAnthropicKey = false
    @State private var showingOpenAIKey = false

    var body: some View {
        Form {
            // Status section
            if !integrationsService.configuredProviders.isEmpty {
                Section {
                    ForEach(Array(integrationsService.configuredProviders), id: \.self) { provider in
                        HStack {
                            Image(systemName: provider.icon)
                                .foregroundColor(Color.theme.success)
                            Text(provider.displayName)
                                .font(.subheadline)
                            Spacer()
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(Color.theme.success)
                        }
                    }

                    if integrationsService.configuredProviders.count == 2 {
                        HStack {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .foregroundColor(Color.theme.primary)
                            Text("Dual LLM routing active")
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }
                } header: {
                    Text("Configured Providers")
                }
            }

            // Claude (Anthropic) section
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "brain.head.profile")
                            .foregroundColor(Color.theme.primary)
                        Text("Claude (Anthropic)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Spacer()
                        if integrationsService.hasAPIKey(for: .anthropic) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(Color.theme.success)
                                .font(.caption)
                        }
                    }

                    Text("Best for clinical analysis, progress notes, and therapeutic insights")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    HStack {
                        if showingAnthropicKey {
                            TextField("Enter Claude API key", text: $anthropicKey)
                                .textContentType(.password)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                        } else {
                            SecureField("Enter Claude API key", text: $anthropicKey)
                                .textContentType(.password)
                        }

                        Button(action: { showingAnthropicKey.toggle() }) {
                            Image(systemName: showingAnthropicKey ? "eye.slash" : "eye")
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }
                }
            } header: {
                Text("Claude API Key")
            } footer: {
                Text("Get your API key from console.anthropic.com")
            }

            // OpenAI section
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "sparkles")
                            .foregroundColor(Color.theme.primary)
                        Text("OpenAI (GPT-4)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Spacer()
                        if integrationsService.hasAPIKey(for: .openAI) {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(Color.theme.success)
                                .font(.caption)
                        }
                    }

                    Text("Best for quick queries, scheduling, and general assistance")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    HStack {
                        if showingOpenAIKey {
                            TextField("Enter OpenAI API key", text: $openAIKey)
                                .textContentType(.password)
                                .autocapitalization(.none)
                                .disableAutocorrection(true)
                        } else {
                            SecureField("Enter OpenAI API key", text: $openAIKey)
                                .textContentType(.password)
                        }

                        Button(action: { showingOpenAIKey.toggle() }) {
                            Image(systemName: showingOpenAIKey ? "eye.slash" : "eye")
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }
                }
            } header: {
                Text("OpenAI API Key")
            } footer: {
                Text("Get your API key from platform.openai.com")
            }

            if let error = validationError {
                Section {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(Color.theme.error)
                }
            }

            Section {
                Button(action: validateAndSave) {
                    HStack {
                        if isValidating {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                        Text(isValidating ? "Saving..." : "Save Configuration")
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled((anthropicKey.isEmpty && openAIKey.isEmpty) || isValidating)

                if integrationsService.isAIConfigured {
                    Button(action: removeAllConfigurations) {
                        Text("Remove All Configurations")
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
    }

    private func validateAndSave() {
        isValidating = true
        validationError = nil

        Task {
            do {
                // Validate and save Anthropic key if provided
                if !anthropicKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    let isValid = try await integrationsService.validateAIAPIKey(
                        provider: .anthropic,
                        apiKey: anthropicKey
                    )
                    if !isValid {
                        await MainActor.run {
                            validationError = "Invalid Claude API key"
                            isValidating = false
                        }
                        return
                    }
                }

                // Validate and save OpenAI key if provided
                if !openAIKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    let isValid = try await integrationsService.validateAIAPIKey(
                        provider: .openAI,
                        apiKey: openAIKey
                    )
                    if !isValid {
                        await MainActor.run {
                            validationError = "Invalid OpenAI API key"
                            isValidating = false
                        }
                        return
                    }
                }

                // Save both keys
                try integrationsService.configureBothAIProviders(
                    anthropicKey: anthropicKey.isEmpty ? nil : anthropicKey,
                    openAIKey: openAIKey.isEmpty ? nil : openAIKey
                )

                await MainActor.run {
                    isValidating = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    validationError = "Failed to save: \(error.localizedDescription)"
                    isValidating = false
                }
            }
        }
    }

    private func removeAllConfigurations() {
        do {
            try integrationsService.removeAllAIConfigurations()
            dismiss()
        } catch {
            validationError = error.localizedDescription
        }
    }
}

// MARK: - OAuth Web Views
struct GoogleAuthWebView: View {
    let onCallback: (URL) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var hasOpenedGoogle = false

    var body: some View {
        VStack(spacing: 20) {
            if hasOpenedGoogle {
                // After opening Google, show waiting state with dismiss option
                Image(systemName: "checkmark.circle")
                    .font(.system(size: 60))
                    .foregroundColor(Color.theme.success)

                Text("Opened in Browser")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Complete sign-in in your browser. If calendar sync doesn't appear after signing in, tap Done and try again.")
                    .font(.subheadline)
                    .foregroundColor(Color.theme.secondaryText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Button("Done") {
                    dismiss()
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding()
                .frame(maxWidth: 280)
                .background(Color.theme.primary)
                .cornerRadius(12)
            } else {
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
                    let url = IntegrationsService.shared.connectGoogleCalendar()
                    UIApplication.shared.open(url)
                    hasOpenedGoogle = true
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding()
                .frame(maxWidth: 280)
                .background(Color.blue)
                .cornerRadius(12)

                Button("Cancel") {
                    dismiss()
                }
                .font(.subheadline)
                .foregroundColor(Color.theme.secondaryText)
                .padding(.top, 8)
            }
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
                    // Successfully saved - dismiss the sheet
                    dismiss()
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

// MARK: - Google Calendar Settings View (Standalone)
struct GoogleCalendarSettingsView: View {
    @ObservedObject private var integrationsService = IntegrationsService.shared
    @State private var showingGoogleAuth = false
    @State private var isLoading = false
    @State private var error: Error?
    @State private var successMessage: String?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(Color.blue.opacity(0.15))
                                .frame(width: 56, height: 56)

                            Image(systemName: "calendar")
                                .font(.title2)
                                .foregroundColor(.blue)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Google Calendar")
                                .font(.headline)
                                .foregroundColor(Color.theme.primaryText)

                            Text(integrationsService.googleCalendarConnected ?
                                 "Connected and syncing" : "Not connected")
                                .font(.subheadline)
                                .foregroundColor(integrationsService.googleCalendarConnected ?
                                                 Color.theme.success : Color.theme.secondaryText)
                        }

                        Spacer()

                        if integrationsService.googleCalendarConnected {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title2)
                                .foregroundColor(Color.theme.success)
                        }
                    }

                    Text("Sync your therapy sessions with Google Calendar to see appointments across all your devices and integrate with SimplePractice.")
                        .font(.subheadline)
                        .foregroundColor(Color.theme.secondaryText)
                }
                .padding(.vertical, 8)
            }

            if integrationsService.googleCalendarConnected {
                Section {
                    Toggle(isOn: $integrationsService.calendarSyncEnabled) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Auto-sync Sessions")
                                .font(.subheadline)
                            Text("Automatically sync sessions to Google Calendar")
                                .font(.caption)
                                .foregroundColor(Color.theme.secondaryText)
                        }
                    }
                    .tint(Color.theme.primary)
                    .onChange(of: integrationsService.calendarSyncEnabled) { _, newValue in
                        integrationsService.setCalendarSyncEnabled(newValue)
                    }

                    NavigationLink {
                        CalendarSyncView()
                    } label: {
                        HStack {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .foregroundColor(Color.theme.primary)
                            Text("Sync Settings")
                        }
                    }
                } header: {
                    Text("Sync Options")
                }

                Section {
                    Button(action: syncNow) {
                        HStack {
                            if isLoading {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "arrow.clockwise")
                            }
                            Text("Sync Now")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .disabled(isLoading)

                    Button(role: .destructive, action: disconnectGoogle) {
                        HStack {
                            Image(systemName: "xmark.circle")
                            Text("Disconnect Google Calendar")
                        }
                        .foregroundColor(Color.theme.error)
                        .frame(maxWidth: .infinity)
                    }
                }
            } else {
                Section {
                    Button(action: connectGoogle) {
                        HStack {
                            Image(systemName: "link")
                            Text("Connect Google Calendar")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.blue)
                        .cornerRadius(8)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .padding(.vertical, 8)
                }
            }

            Section {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        Image(systemName: "info.circle")
                            .foregroundColor(Color.theme.primary)
                        Text("SimplePractice Integration")
                            .font(.subheadline)
                            .fontWeight(.medium)
                    }

                    Text("If you use SimplePractice, your appointments will automatically sync through Google Calendar. Make sure SimplePractice is connected to Google Calendar in your SimplePractice settings.")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)
                }
                .padding(.vertical, 8)
            } header: {
                Text("About")
            }
        }
        .navigationTitle("Google Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .loadingOverlay(isLoading)
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

    private func syncNow() {
        isLoading = true

        Task {
            do {
                let sessions = try await integrationsService.syncAllCalendarAppointments()
                await MainActor.run {
                    isLoading = false
                    successMessage = "Synced \(sessions.count) appointments"
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
        IntegrationsView()
    }
}
