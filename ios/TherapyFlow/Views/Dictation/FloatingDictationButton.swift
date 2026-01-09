import SwiftUI

/// Floating microphone button for quick voice dictation - appears on every screen
struct FloatingDictationButton: View {
    @ObservedObject private var quickNoteService = QuickNoteService.shared
    @State private var showingRecordingSheet = false
    @State private var showingNotAuthorizedAlert = false

    // Position offset from bottom-right (above AI helper)
    private let bottomOffset: CGFloat = 140  // Above the AI helper button
    private let rightOffset: CGFloat = 16

    var body: some View {
        VStack {
            Spacer()
            HStack {
                Spacer()

                Button(action: handleTap) {
                    ZStack {
                        // Background circle
                        Circle()
                            .fill(quickNoteService.isRecording ? Color.red : Color.theme.primary)
                            .frame(width: 56, height: 56)
                            .shadow(color: Color.black.opacity(0.2), radius: 8, x: 0, y: 4)

                        // Recording pulse animation
                        if quickNoteService.isRecording {
                            Circle()
                                .stroke(Color.red.opacity(0.5), lineWidth: 2)
                                .frame(width: 56, height: 56)
                                .scaleEffect(pulseScale)
                                .opacity(pulseOpacity)
                        }

                        // Silence progress ring
                        if quickNoteService.isRecording && quickNoteService.silenceProgress > 0 {
                            Circle()
                                .trim(from: 0, to: quickNoteService.silenceProgress)
                                .stroke(Color.white.opacity(0.7), lineWidth: 3)
                                .frame(width: 50, height: 50)
                                .rotationEffect(.degrees(-90))
                        }

                        // Icon
                        Image(systemName: quickNoteService.isRecording ? "stop.fill" : "mic.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.white)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(quickNoteService.isRecording ? "Stop recording" : "Start voice note")

                // Recording duration badge
                if quickNoteService.isRecording {
                    Text(formatDuration(quickNoteService.recordingDuration))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red)
                        .cornerRadius(12)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.trailing, rightOffset)
            .padding(.bottom, bottomOffset)
        }
        .animation(.spring(response: 0.3), value: quickNoteService.isRecording)
        .sheet(isPresented: $showingRecordingSheet) {
            QuickNoteRecordingSheet()
        }
        .alert("Microphone Access Required", isPresented: $showingNotAuthorizedAlert) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Please enable microphone and speech recognition access in Settings to use voice dictation.")
        }
        .onChange(of: quickNoteService.processingState) { _, newState in
            // Show sheet when recording finishes
            if case .transcribing = newState {
                showingRecordingSheet = true
            } else if case .complete = newState {
                showingRecordingSheet = true
            }
        }
    }

    // MARK: - Actions

    private func handleTap() {
        if quickNoteService.isRecording {
            quickNoteService.stopRecording()
        } else {
            // Check authorization first
            if !quickNoteService.isAuthorized {
                Task {
                    let granted = await quickNoteService.requestPermissions()
                    if granted {
                        quickNoteService.startRecording()
                    } else {
                        showingNotAuthorizedAlert = true
                    }
                }
            } else {
                quickNoteService.startRecording()
            }
        }
    }

    // MARK: - Animation

    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 1.0

    private var pulseAnimation: Animation {
        Animation.easeInOut(duration: 1.0).repeatForever(autoreverses: true)
    }

    // MARK: - Helpers

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        Color.gray.opacity(0.2)
        FloatingDictationButton()
    }
}
