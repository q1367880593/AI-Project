import SwiftUI

// MARK: - 应用入口
@main
struct WeeClockApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .frame(width: 500, height: 480)
        }
        .windowResizability(.contentSize)
        .windowStyle(.automatic)
        .defaultSize(width: 500, height: 480)
    }
}
