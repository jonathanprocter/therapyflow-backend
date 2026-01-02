import AVFoundation
import Speech
import SwiftUI

final class SpeechRecognizer: NSObject, ObservableObject, SFSpeechRecognizerDelegate {
    @Published var transcript: String = ""
    @Published var isListening: Bool = false
    @Published var isAuthorized: Bool = false
    @Published var lastError: Error?

    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    override init() {
        super.init()
        speechRecognizer?.delegate = self
        requestAuthorization()
    }

    func requestAuthorization() {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                self.isAuthorized = (status == .authorized)
            }
        }
    }

    func start() {
        guard !isListening else { return }
        guard isAuthorized else {
            requestAuthorization()
            return
        }

        lastError = nil
        transcript = ""

        task?.cancel()
        task = nil

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            lastError = error
            return
        }

        request = SFSpeechAudioBufferRecognitionRequest()
        request?.shouldReportPartialResults = true

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }

        audioEngine.prepare()

        do {
            try audioEngine.start()
        } catch {
            lastError = error
            return
        }

        isListening = true

        task = speechRecognizer?.recognitionTask(with: request ?? SFSpeechAudioBufferRecognitionRequest()) { [weak self] result, error in
            guard let self else { return }
            if let result = result {
                DispatchQueue.main.async {
                    self.transcript = result.bestTranscription.formattedString
                }
                if result.isFinal {
                    self.stop()
                }
            }

            if let error = error {
                DispatchQueue.main.async {
                    self.lastError = error
                }
                self.stop()
            }
        }
    }

    func stop() {
        guard isListening else { return }

        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()

        request = nil
        task = nil

        DispatchQueue.main.async {
            self.isListening = false
        }
    }
}
