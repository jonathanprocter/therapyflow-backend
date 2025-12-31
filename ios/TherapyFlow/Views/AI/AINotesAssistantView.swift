import SwiftUI

struct AINotesAssistantView: View {
    @State private var inputText = ""
    @State private var isProcessing = false
    @State private var generatedNote = ""
    @State private var selectedTemplate: NoteTemplate = .soap
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Template Selection
                templateSection
                
                // Input Section
                inputSection
                
                // Generate Button
                generateButton
                
                // Output Section
                if !generatedNote.isEmpty {
                    outputSection
                }
            }
            .padding()
        }
        .navigationTitle("AI Note Assistant")
    }
    
    private var templateSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Note Template")
                .font(.headline)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(NoteTemplate.allCases, id: \.self) { template in
                        TemplateButton(
                            template: template,
                            isSelected: selectedTemplate == template
                        ) {
                            selectedTemplate = template
                        }
                    }
                }
            }
        }
    }
    
    private var inputSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Session Notes")
                    .font(.headline)
                Spacer()
                Button(action: { startVoiceInput() }) {
                    Label("Voice", systemImage: "mic.fill")
                        .font(.subheadline)
                }
                .buttonStyle(.bordered)
            }
            
            TextEditor(text: $inputText)
                .frame(minHeight: 150)
                .padding(8)
                .background(Color(.systemGray6))
                .cornerRadius(10)
                .overlay(
                    Group {
                        if inputText.isEmpty {
                            Text("Enter your session notes, observations, or voice transcription here...")
                                .foregroundColor(.secondary)
                                .padding(12)
                        }
                    },
                    alignment: .topLeading
                )
        }
    }
    
    private var generateButton: some View {
        Button(action: { generateNote() }) {
            HStack {
                if isProcessing {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Image(systemName: "sparkles")
                }
                Text(isProcessing ? "Generating..." : "Generate Note")
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(inputText.isEmpty ? Color.gray : Color.theme.primary)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
        .disabled(inputText.isEmpty || isProcessing)
    }
    
    private var outputSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Generated Note")
                    .font(.headline)
                Spacer()
                Button(action: { copyToClipboard() }) {
                    Label("Copy", systemImage: "doc.on.doc")
                        .font(.subheadline)
                }
                .buttonStyle(.bordered)
            }
            
            Text(generatedNote)
                .padding()
                .background(Color(.systemBackground))
                .cornerRadius(10)
                .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
        }
    }
    
    private func startVoiceInput() {
        // Voice input implementation
    }
    
    private func generateNote() {
        isProcessing = true
        
        // Simulate AI processing
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            generatedNote = generateSOAPNote()
            isProcessing = false
        }
    }
    
    private func generateSOAPNote() -> String {
        switch selectedTemplate {
        case .soap:
            return """
            SUBJECTIVE:
            Client reports \(inputText.prefix(50))...
            
            OBJECTIVE:
            Client appeared engaged and maintained appropriate eye contact throughout the session.
            
            ASSESSMENT:
            Progress toward treatment goals is being made. Client demonstrates improved insight.
            
            PLAN:
            Continue weekly sessions. Assign homework on cognitive restructuring techniques.
            """
        case .dap:
            return """
            DATA:
            \(inputText.prefix(100))...
            
            ASSESSMENT:
            Client is making progress toward identified goals.
            
            PLAN:
            Continue current treatment approach with adjustments as needed.
            """
        case .birp:
            return """
            BEHAVIOR:
            Client presented with appropriate affect and was cooperative.
            
            INTERVENTION:
            Utilized CBT techniques to address presenting concerns.
            
            RESPONSE:
            Client responded positively to interventions.
            
            PLAN:
            Schedule follow-up session in one week.
            """
        case .narrative:
            return """
            Session Summary:
            
            Today's session focused on \(inputText.prefix(100))...
            
            The client demonstrated good engagement throughout the session and expressed willingness to continue working on identified goals.
            """
        }
    }
    
    private func copyToClipboard() {
        UIPasteboard.general.string = generatedNote
    }
}

enum NoteTemplate: String, CaseIterable {
    case soap = "SOAP"
    case dap = "DAP"
    case birp = "BIRP"
    case narrative = "Narrative"
    
    var description: String {
        switch self {
        case .soap: return "Subjective, Objective, Assessment, Plan"
        case .dap: return "Data, Assessment, Plan"
        case .birp: return "Behavior, Intervention, Response, Plan"
        case .narrative: return "Free-form narrative"
        }
    }
}

struct TemplateButton: View {
    let template: NoteTemplate
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(template.rawValue)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(template.description)
                    .font(.caption2)
                    .lineLimit(1)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(isSelected ? Color.theme.primary : Color(.systemGray5))
            .foregroundColor(isSelected ? .white : .primary)
            .cornerRadius(10)
        }
    }
}

#Preview {
    NavigationStack {
        AINotesAssistantView()
    }
}
