import Foundation
import Network
import Combine

// MARK: - Network Monitor
@MainActor
final class NetworkMonitor: ObservableObject {
    static let shared = NetworkMonitor()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")

    @Published private(set) var isConnected = true
    @Published private(set) var connectionType: ConnectionType = .unknown
    @Published private(set) var isExpensive = false
    @Published private(set) var isConstrained = false

    enum ConnectionType {
        case wifi
        case cellular
        case ethernet
        case unknown

        var icon: String {
            switch self {
            case .wifi: return "wifi"
            case .cellular: return "antenna.radiowaves.left.and.right"
            case .ethernet: return "cable.connector"
            case .unknown: return "network"
            }
        }

        var displayName: String {
            switch self {
            case .wifi: return "Wi-Fi"
            case .cellular: return "Cellular"
            case .ethernet: return "Ethernet"
            case .unknown: return "Unknown"
            }
        }
    }

    private init() {
        startMonitoring()
    }

    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor [weak self] in
                self?.updateNetworkStatus(path)
            }
        }
        monitor.start(queue: queue)
    }

    func stopMonitoring() {
        monitor.cancel()
    }

    private func updateNetworkStatus(_ path: NWPath) {
        isConnected = path.status == .satisfied
        isExpensive = path.isExpensive
        isConstrained = path.isConstrained

        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .ethernet
        } else {
            connectionType = .unknown
        }
    }

    // Check if we should sync (avoid syncing on expensive/constrained connections)
    var shouldAutoSync: Bool {
        isConnected && !isConstrained && (!isExpensive || connectionType == .wifi)
    }

    // Status description for UI
    var statusDescription: String {
        if !isConnected {
            return "Offline"
        }

        var status = connectionType.displayName

        if isExpensive && connectionType != .wifi {
            status += " (metered)"
        }

        if isConstrained {
            status += " (Low Data Mode)"
        }

        return status
    }
}

// MARK: - Connectivity Observer
class ConnectivityObserver: ObservableObject {
    @Published var isConnected = true

    private var cancellables = Set<AnyCancellable>()

    init() {
        Task { @MainActor in
            NetworkMonitor.shared.$isConnected
                .receive(on: DispatchQueue.main)
                .assign(to: &$isConnected)
        }
    }
}
