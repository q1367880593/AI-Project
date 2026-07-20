import SwiftUI
import Combine

// MARK: - 视图模型
final class WorkClockViewModel: ObservableObject {
    @Published var now: Date = Date()
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

    var body: some View {
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

    // MARK: 进度条（10 段 × 4 小时）
    private var progressBlock: some View {
        VStack(spacing: 8) {
            HStack(spacing: 5) {
                ForEach(0..<WorkClockLogic.totalSegments, id: \.self) { i in
                    let isFilled = i < vm.filledSegments
                    let isCurrent = i == vm.filledSegments && vm.status == .counting
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(isFilled
                              ? Color.accentColor
                              : Color(nsColor: .separatorColor).opacity(0.6))
                        .frame(height: 22)
                        .overlay(
                            RoundedRectangle(cornerRadius: 3, style: .continuous)
                                .fill(Color.accentColor.opacity(isCurrent ? 0.5 : 0))
                                .blur(radius: 3)
                        )
                        .overlay(
                            Text("\(i + 1)")
                                .font(.system(size: 10, weight: .semibold, design: .rounded))
                                .foregroundStyle(isFilled ? .white : .secondary)
                        )
                }
            }
            HStack(spacing: 0) {
                Text("\(vm.filledSegments)/\(WorkClockLogic.totalSegments) 段")
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
}
