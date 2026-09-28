import SwiftUI

// MARK: - 应用入口
@main
struct WeeClockApp: App {
    @StateObject private var vm = WorkClockViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(vm)
                .frame(width: 500, height: 480)
        }
        .windowResizability(.contentSize)
        .windowStyle(.automatic)
        .defaultSize(width: 500, height: 480)
        .commands {
            // ⌘ + , 唤起设置
        }

        Settings {
            SettingsView()
                .environmentObject(vm)
                .frame(width: 480, height: 520)
        }
    }
}