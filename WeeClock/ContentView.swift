import SwiftUI
import AppKit
import Combine

// MARK: - 视图模型
final class WorkClockViewModel: ObservableObject {
    @Published var now: Date = Date()
    @Published var isGhostMode: Bool = false
    private var timer: Timer?
    private var cancellables = Set<AnyCancellable>()

    init() {
        // 每秒更新
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            DispatchQueue.main.async { self?.now = Date() }
        }
    }

    deinit { timer?.invalidate() }

    // MARK: 派生数据
    var cycleStart: Date { WorkClockLogic.cycleStart(for: now) }
    var nextCycleStart: Date { WorkClockLogic.nextCycleStart(after: now) }

    /// 本周期已累计的活动秒数（封顶于 totalCycleSeconds）
    var elapsed: TimeInterval {
        min(WorkClockLogic.totalCycleSeconds,
            WorkClockLogic.activeSecondsBetween(start: cycleStart, end: now))
    }

    var remaining: TimeInterval {
        max(0, WorkClockLogic.totalCycleSeconds - elapsed)
    }

    var progress: Double {
        elapsed / WorkClockLogic.totalCycleSeconds
    }

    var filledSegments: Int {
        min(WorkClockLogic.totalSegments,
            Int(progress * Double(WorkClockLogic.totalSegments)))
    }

    var isActive: Bool { WorkClockLogic.isActive(at: now) }
    var isCycleComplete: Bool { elapsed >= WorkClockLogic.totalCycleSeconds }

    // MARK: 文案
    enum ClockStatus {
        case counting     // 倒计时中
        case paused       // 非工作时间
        case completed    // 本周已完成，等待重置
    }

    var status: ClockStatus {
        if isCycleComplete { return .completed }
        if !isActive { return .paused }
        return .counting
    }

    var statusText: String {
        switch status {
        case .counting:  return "倒计时中"
        case .paused:    return "已暂停 · 非工作时间"
        case .completed: return "本周已完成 · 等待下周一 9:00"
        }
    }

    var statusColor: Color {
        switch status {
        case .counting:  return .green
        case .paused:   return .orange
        case .completed: return .blue
        }
    }
}

// MARK: - 主视图
struct ContentView: View {
    @StateObject private var vm = WorkClockViewModel()
    @State private var savedFrame: NSRect = .zero

    var body: some View {
        ZStack {
            if vm.isGhostMode {
                ghostModeView
            } else {
                normalView
            }
        }
        .onAppear {
            if vm.isGhostMode { applyWindowMode(isGhost: true) }
        }
        .onChange(of: vm.isGhostMode) { newValue in
            applyWindowMode(isGhost: newValue)
        }
    }

    private var normalView: some View {
        VStack(spacing: 22) {
            header
            countdownBlock
            progressBlock
            Divider().background(Color.secondary.opacity(0.3))
            infoBlock
        }
        .padding(28)
        .frame(width: 500)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    // MARK: 标题
    private var header: some View {
        HStack(alignment: .top) {
            VStack(spacing: 6) {
                HStack(spacing: 8) {
                    Image(systemName: "clock.fill")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.tint)
                    Text("WeeClock")
                        .font(.system(size: 22, weight: .semibold, design: .rounded))
                }
                HStack(spacing: 6) {
                    Circle()
                        .fill(vm.statusColor)
                        .frame(width: 7, height: 7)
                        .overlay(
                            Circle().fill(vm.statusColor)
                                .frame(width: 7, height: 7)
                                .blur(radius: 2)
                                .opacity(vm.status == .counting ? 0.8 : 0)
                        )
                    Text(vm.statusText)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Button {
                vm.isGhostMode = true
            } label: {
                Image(systemName: "eye.slash.fill")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
                    .padding(8)
                    .background(Circle().fill(Color(nsColor: .separatorColor).opacity(0.5)))
            }
            .buttonStyle(.plain)
            .help("进入隐身模式")
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: 倒计时
    private var countdownBlock: some View {
        VStack(spacing: 6) {
            Text("剩余时间")
                .font(.system(size: 11, weight: .medium))
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
            Text(vm.remaining.hhmmss)
                .font(.system(size: 64, weight: .bold, design: .monospaced))
                .monospacedDigit()
                .foregroundStyle(vm.isCycleComplete ? .secondary : .primary)
                .contentTransition(.numericText())
            Text("总时长 \(Int(WorkClockLogic.totalCycleSeconds / 3600)) 小时 · 已用 \(vm.elapsed.hhmmss)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: 进度条（连贯填充 + 4 小时刻度）
    private var progressBlock: some View {
        VStack(spacing: 8) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // 轨道
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(Color(nsColor: .separatorColor).opacity(0.35))
                    // 填充：随时间连续增长
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.accentColor.opacity(0.75),
                                    Color.accentColor
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(0, geo.size.width * vm.progress))
                        .animation(.linear(duration: 0.5), value: vm.progress)
                    // 刻度线：每 4 小时一道（共 9 道，第 10 段为末端）
                    HStack(spacing: 0) {
                        ForEach(0..<WorkClockLogic.totalSegments, id: \.self) { i in
                            if i > 0 {
                                Rectangle()
                                    .fill(Color.white.opacity(0.35))
                                    .frame(width: 1)
                            }
                            Spacer()
                        }
                    }
                    .padding(.horizontal, 0)
                    // 段数标签（覆盖在填充末端附近）
                    HStack {
                        Spacer()
                        Text("\(vm.filledSegments)/\(WorkClockLogic.totalSegments)")
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundStyle(.white)
                            .padding(.trailing, 12)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(height: 22)

            HStack(spacing: 0) {
                Text("每段 4 小时 · 共 40 小时")
                    .foregroundStyle(.secondary)
                Spacer()
                Text(String(format: "%.1f%%", vm.progress * 100))
                    .foregroundStyle(.secondary)
            }
            .font(.system(size: 11, design: .monospaced))
        }
    }

    // MARK: 信息块
    private var infoBlock: some View {
        HStack(alignment: .top, spacing: 12) {
            infoCard(title: "本周开始",
                     value: formatDate(vm.cycleStart),
                     icon: "play.circle")
            Spacer()
            infoCard(title: "下次重置",
                     value: formatDate(vm.nextCycleStart),
                     icon: "arrow.clockwise.circle")
            Spacer()
            infoCard(title: "当前时间",
                     value: formatTime(vm.now),
                     icon: "timer")
        }
    }

    private func infoCard(title: String, value: String, icon: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(.tint)
            Text(title)
                .font(.system(size: 10, weight: .medium))
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(.primary)
        }
        .frame(width: 140)
    }

    // MARK: 格式化
    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "MM-dd HH:mm"
        f.locale = Locale(identifier: "zh_CN")
        return f.string(from: date)
    }

    private func formatTime(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f.string(from: date)
    }

    // MARK: 隐身模式视图
    private var ghostModeView: some View {
        HStack(spacing: 12) {
            // 左侧：圆形进度环
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.18), lineWidth: 3.5)
                Circle()
                    .trim(from: 0, to: vm.progress)
                    .stroke(
                        AngularGradient(
                            colors: [.accentColor.opacity(0.7), .accentColor],
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.5), value: vm.progress)
                Text("\(Int(vm.progress * 100))")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)
            }
            .frame(width: 36, height: 36)

            // 中间：倒计时
            VStack(alignment: .leading, spacing: 1) {
                Text("剩余时间")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.white.opacity(0.55))
                Text(vm.remaining.hhmmss)
                    .font(.system(size: 17, weight: .bold, design: .monospaced))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
            }

            // 右侧：状态点 + 退出按钮
            Capsule()
                .fill(vm.statusColor)
                .frame(width: 8, height: 8)
                .opacity(vm.status == .counting ? 1 : 0.5)

            Button {
                vm.isGhostMode = false
            } label: {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.6))
                    .padding(6)
                    .background(Circle().fill(Color.white.opacity(0.1)))
            }
            .buttonStyle(.plain)
            .help("退出隐身模式")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(width: 260, height: 64)
        .background(
            Capsule()
                .fill(.ultraThinMaterial)
                .overlay(
                    Capsule()
                        .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
                )
                .shadow(color: .black.opacity(0.35), radius: 14, y: 5)
        )
    }

    // MARK: 窗口模式切换
    private func applyWindowMode(isGhost: Bool) {
        // 找到主窗口（优先 keyWindow，其次带标题栏的窗口）
        guard let window = NSApp.keyWindow
                            ?? NSApp.windows.first(where: { $0.styleMask.contains(.titled) })
                            ?? NSApp.windows.first(where: { $0.contentView != nil })
        else { return }

        if isGhost {
            // 保存当前 frame，便于退出时恢复
            if savedFrame == .zero {
                savedFrame = window.frame
            }
            let ghostSize = CGSize(width: 260, height: 64)
            let center = CGPoint(
                x: window.frame.midX - ghostSize.width / 2,
                y: window.frame.midY - ghostSize.height / 2
            )
            window.styleMask = .borderless
            window.isOpaque = false
            window.backgroundColor = .clear
            window.hasShadow = false
            window.level = .floating
            window.isMovable = true
            window.isMovableByWindowBackground = true
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.3
                ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                window.animator().setFrame(
                    NSRect(origin: center, size: ghostSize),
                    display: true
                )
            }
        } else {
            let target = savedFrame == .zero
                ? NSRect(x: 0, y: 0, width: 500, height: 480)
                : savedFrame
            // 居中
            let screenFrame = NSScreen.main?.visibleFrame ?? .zero
            let centered = NSRect(
                x: screenFrame.midX - target.width / 2,
                y: screenFrame.midY - target.height / 2,
                width: target.width,
                height: target.height
            )
            window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
            window.isOpaque = true
            window.backgroundColor = .windowBackgroundColor
            window.hasShadow = true
            window.level = .normal
            window.isMovable = true
            window.isMovableByWindowBackground = false
            window.collectionBehavior = [.managed, .participatesInCycle]
            window.title = "WeeClock"
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.3
                ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                window.animator().setFrame(centered, display: true)
            }
            savedFrame = .zero
        }
    }
}
