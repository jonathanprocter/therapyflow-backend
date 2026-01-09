import SwiftUI

struct AIAssistantView: View {
    @ObservedObject private var assistant = ContextualAIAssistant.shared
    @State private var userInput = ""
    @State private var showingError = false
    @State private var errorMessage = ""
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView

            // Conversation or suggestions
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: 16) {
                        if assistant.conversationHistory.isEmpty {
                            suggestionsView
                        } else {
                            conversationView
                        }
                    }
                    .padding()
                }
                .onChange(of: assistant.conversationHistory.count) {
                    withAnimation {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }
            }

            // Input area
            inputView
        }
        .background(Color.theme.background)
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }

    // MARK: - Header

    private var headerView: some View {
        HStack {
            Image(systemName: "brain.head.profile")
                .font(.title2)
                .foregroundColor(Color.theme.primary)

            VStack(alignment: .leading, spacing: 2) {
                Text("AI Assistant")
                    .font(.headline)
                    .foregroundColor(Color.theme.primaryText)

                Text("Context: \(assistant.currentContext.displayName)")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }

            Spacer()

            if !assistant.conversationHistory.isEmpty {
                Button(action: {
                    assistant.clearConversation()
                }) {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.body)
                        .foregroundColor(Color.theme.secondaryText)
                }
            }
        }
        .padding()
        .background(Color.theme.surface)
    }

    // MARK: - Suggestions

    private var suggestionsView: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Suggested Questions")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(Color.theme.secondaryText)

            ForEach(assistant.suggestions) { suggestion in
                SuggestionCard(suggestion: suggestion) {
                    Task {
                        await askQuestion(suggestion.question)
                    }
                }
            }

            Spacer()
        }
    }

    // MARK: - Conversation

    private var conversationView: some View {
        VStack(spacing: 16) {
            ForEach(Array(assistant.conversationHistory.enumerated()), id: \.offset) { index, exchange in
                VStack(alignment: .leading, spacing: 8) {
                    // User question
                    HStack {
                        Spacer()
                        Text(exchange.question)
                            .padding(12)
                            .background(Color.theme.primary.opacity(0.1))
                            .foregroundColor(Color.theme.primaryText)
                            .cornerRadius(12)
                    }

                    // AI response
                    HStack {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 6) {
                                Image(systemName: "brain.head.profile")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.primary)
                                Text("Assistant")
                                    .font(.caption)
                                    .foregroundColor(Color.theme.secondaryText)
                            }

                            Text(exchange.answer)
                                .foregroundColor(Color.theme.primaryText)
                        }
                        .padding(12)
                        .background(Color.theme.surface)
                        .cornerRadius(12)
                        Spacer()
                    }
                }
            }

            // Quick follow-up suggestions
            if let response = assistant.lastResponse,
               let suggestions = response.suggestions,
               !suggestions.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Follow-up questions:")
                        .font(.caption)
                        .foregroundColor(Color.theme.secondaryText)

                    ForEach(suggestions.prefix(3), id: \.self) { suggestion in
                        Button(action: {
                            Task {
                                await askQuestion(suggestion)
                            }
                        }) {
                            Text(suggestion)
                                .font(.caption)
                                .foregroundColor(Color.theme.primary)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.theme.primary.opacity(0.1))
                                .cornerRadius(16)
                        }
                    }
                }
            }

            Color.clear.frame(height: 1).id("bottom")
        }
    }

    // MARK: - Input

    private var inputView: some View {
        VStack(spacing: 0) {
            Divider()

            HStack(spacing: 12) {
                TextField("Ask anything...", text: $userInput)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.theme.surface)
                    .cornerRadius(20)
                    .focused($isInputFocused)
                    .onSubmit {
                        Task {
                            await askQuestion(userInput)
                        }
                    }

                Button(action: {
                    Task {
                        await askQuestion(userInput)
                    }
                }) {
                    if assistant.isLoading {
                        ProgressView()
                            .frame(width: 44, height: 44)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundColor(userInput.isEmpty ? Color.theme.secondaryText : Color.theme.primary)
                    }
                }
                .disabled(userInput.isEmpty || assistant.isLoading)
            }
            .padding()
            .background(Color.theme.background)
        }
    }

    // MARK: - Actions

    private func askQuestion(_ question: String) async {
        guard !question.isEmpty else { return }

        let questionToAsk = question
        userInput = ""
        isInputFocused = false

        do {
            _ = try await assistant.askQuestion(questionToAsk)
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
    }
}

// MARK: - Suggestion Card

struct SuggestionCard: View {
    let suggestion: ContextualSuggestion
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Image(systemName: iconForCategory(suggestion.category))
                    .font(.body)
                    .foregroundColor(colorForCategory(suggestion.category))
                    .frame(width: 32)

                Text(suggestion.question)
                    .font(.body)
                    .foregroundColor(Color.theme.primaryText)
                    .multilineTextAlignment(.leading)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(Color.theme.secondaryText)
            }
            .padding()
            .background(Color.theme.surface)
            .cornerRadius(12)
        }
    }

    private func iconForCategory(_ category: ContextualSuggestion.SuggestionCategory) -> String {
        switch category {
        case .clinical: return "heart.text.square"
        case .documentation: return "doc.text"
        case .scheduling: return "calendar"
        case .insights: return "lightbulb"
        case .help: return "questionmark.circle"
        }
    }

    private func colorForCategory(_ category: ContextualSuggestion.SuggestionCategory) -> Color {
        switch category {
        case .clinical: return .red
        case .documentation: return .blue
        case .scheduling: return .green
        case .insights: return .orange
        case .help: return .purple
        }
    }
}

// MARK: - Floating AI Button

struct FloatingAIButton: View {
    @Binding var isShowingAssistant: Bool

    var body: some View {
        Button(action: {
            isShowingAssistant = true
        }) {
            Image(systemName: "brain.head.profile")
                .font(.title2)
                .foregroundColor(.white)
                .frame(width: 56, height: 56)
                .background(
                    LinearGradient(
                        colors: [Color.theme.primary, Color.theme.primary.opacity(0.8)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .clipShape(Circle())
                .shadow(color: Color.theme.primary.opacity(0.3), radius: 8, x: 0, y: 4)
        }
    }
}

// MARK: - Preview

#Preview {
    AIAssistantView()
}
