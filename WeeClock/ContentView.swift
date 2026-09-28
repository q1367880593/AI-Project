import SwiftUI
import AppKit
import Combine

// MARK: - 视图模型
final class WorkClockViewModel: ObservableObject {
    @Published var now: Date = Date()
    @Published var isGhostMode: Bool = false
    private var timer: Timer?

    init() {
        // 每秒更新
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            DispatchQueue.main.async { self?.now = Date() }
        }
        // 跨窗口同步请假列表
        NotificationCenter.default.addObserver(
            forName: .init("WeeClock.leaveDidChange"),
            object: nil, queue: .main
        ) { [weak self] _ in
            self?.objectWillChange.send()
        }
    }

    deinit { timer?.invalidate() }

    // MARK: 请假管理
    func addLeave(_ day: Date) {
        var keys = WorkSchedule.leaveKeys
        keys.insert(WorkClockLogic.dayKey(day))
        WorkSchedule.leaveKeys = keys
    }

    func removeLeave(_ day: Date) {
        var keys = WorkSchedule.leaveKeys
        keys.remove(WorkClockLogic.dayKey(day))
        WorkSchedule.leaveKeys = keys
    }

    var leaveDates: [Date] {
        WorkSchedule.leaveKeys
            .compactMap { WorkClockLogic.date(fromKey: $0) }
            .sorted()
    }

    // MARK: 派生数据
    var cycleStart: Date { WorkClockLogic.cycleStart(for: now) }
    var cycleDays: [Date] { WorkClockLogic.cycleWorkdays(containing: now) }
    var nextCycleDays: [Date] { WorkClockLogic.nextCycleWorkdays(after: now) }

    /// 本周期目标时长 =（周期内连续工作天数 − 请假天数）× 8 小时
    var cycleTarget: TimeInterval { WorkClockLogic.cycleTargetSeconds(containing: now) }

    /// 本周期已累计的活动秒数（封顶于本周期目标）
    var elapsed: TimeInterval {
        min(cycleTarget,
            WorkClockLogic.activeSecondsBetween(start: cycleStart, end: now))
    }

    var remaining: TimeInterval {
        max(0, cycleTarget - elapsed)
    }

    var progress: Double {
        cycleTarget > 0 ? elapsed / cycleTarget : 1.0
    }

    /// 本周期段数 = 目标时长 ÷ 4 小时（请假后段数随之减少）
    var segmentCount: Int {
        max(1, Int(cycleTarget / WorkClockLogic.segmentSeconds))
    }

    var filledSegments: Int {
        min(segmentCount, Int(progress * Double(segmentCount)))
    }

    var isActive: Bool { WorkClockLogic.isActive(at: now) }
    var isCycleComplete: Bool { elapsed >= cycleTarget }

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
        case .paused:
            if WorkClockLogic.isLeaveDay(now) { return "已暂停 · 请假中" }
            if !WorkClockLogic.isWorkday(now) { return "已暂停 · 休息日" }
            return "已暂停 · 非工作时间"
        case .completed: return "本周期已完成 · 等待下个周期"
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
    @EnvironmentObject private var vm: WorkClockViewModel
    @State private var savedFrame: NSRect = .zero
    @State private var ghostWindow: NSWindow? = nil
    @State private var dragStartOrigin: NSPoint? = nil
    @State private var dragStartMouse: NSPoint? = nil

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
            Divider().background(Color.secondary.opacity(0.3))
            summaryFooter
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
            HStack(spacing: 6) {
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

                // ⌘, 打开设置
                SettingsLink {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                        .padding(8)
                        .background(Circle().fill(Color(nsColor: .separatorColor).opacity(0.5)))
                }
                .buttonStyle(.plain)
                .help("设置（⌘,）")
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
            Text("总时长 \(Int(vm.cycleTarget / 3600)) 小时 · 已用 \(vm.elapsed.hhmmss)")
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
                    // 刻度线：每 4 小时一道（段数随本周期目标时长变化）
                    HStack(spacing: 0) {
                        ForEach(0..<vm.segmentCount, id: \.self) { i in
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
                        Text("\(vm.filledSegments)/\(vm.segmentCount)")
                            .font(.system(size: 11, weight: .semibold, design: .monospaced))
                            .foregroundStyle(.white)
                            .padding(.trailing, 12)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(height: 22)

            HStack(spacing: 0) {
                Text("每段 4 小时 · 共 \(Int(vm.cycleTarget / 3600)) 小时")
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
            infoCard(title: "本周期",
                     value: rangeText(vm.cycleDays),
                     icon: "play.circle")
            Spacer()
            infoCard(title: "下个周期",
                     value: rangeText(vm.nextCycleDays),
                     icon: "arrow.clockwise.circle")
            Spacer()
            infoCard(title: "当前时间",
                     value: formatTime(vm.now),
                     icon: "timer")
        }
    }

    // MARK: 摘要 footer（请假入口移到了设置）
    private var summaryFooter: some View {
        HStack(spacing: 6) {
            Image(systemName: vm.leaveDates.isEmpty ? "checkmark.seal.fill" : "calendar.badge.exclamationmark")
                .font(.system(size: 11))
                .foregroundStyle(vm.leaveDates.isEmpty ? Color.secondary : Color.orange)
            if vm.leaveDates.isEmpty {
                Text("本周无请假")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            } else {
                Text("已请假 \(vm.leaveDates.count) 天")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("在 设置 (⌘,) 中管理")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
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
    /// 日期列表 → 日期段文本，如 "9.20-9.24"（跨年时带年份，如 "2026.12.31-2027.1.4"）
    private func rangeText(_ days: [Date]) -> String {
        guard let first = days.first, let last = days.last else { return "-" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        let cal = Calendar.current
        if cal.component(.year, from: first) != cal.component(.year, from: last) {
            f.dateFormat = "yyyy.M.d"
            return "\(f.string(from: first))-\(f.string(from: last))"
        }
        f.dateFormat = "M.d"
        return "\(f.string(from: first))-\(f.string(from: last))"
    }

    private func formatTime(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f.string(from: date)
    }

    // MARK: 隐身模式视图
    private var ghostModeView: some View {
        // 进度条 tint 色：靛蓝紫
        let accentStart   = Color(red: 0.30, green: 0.36, blue: 0.72)
        let accentEnd      = Color(red: 0.45, green: 0.32, blue: 0.82)
        let primaryText   = accentStart
        let secondaryText = accentEnd.opacity(0.70)
        let trackColor      = Color.black.opacity(0.10)

        return HStack(spacing: 12) {
            // 左侧：圆形进度环（显示剩余比例：满 = 刚开始，空 = 已完成）
            ZStack {
                Circle()
                    .stroke(trackColor, lineWidth: 3.5)
                Circle()
                    .trim(from: 0, to: 1 - vm.progress)
                    .stroke(
                        AngularGradient(
                            colors: [accentStart, accentEnd],
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: 3.5, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 0.5), value: vm.progress)
                Text("\(Int((1 - vm.progress) * 100))")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(primaryText)
            }
            .frame(width: 36, height: 36)

            // 中间：倒计时
            Text(vm.remaining.hhmmss)
                .font(.system(size: 20, weight: .semibold, design: .monospaced))
                .monospacedDigit()
                .foregroundStyle(primaryText)
                .contentTransition(.numericText())

            // 退出按钮
            Button {
                vm.isGhostMode = false
            } label: {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(secondaryText)
                    .padding(6)
                    .background(Circle().fill(Color.black.opacity(0.06)))
            }
            .buttonStyle(.plain)
            .help("退出隐身模式")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(width: 210, height: 52)
        .background(.clear)
        .glassEffect(.clear, in: Capsule())
        .gesture(ghostDragGesture)
    }

    // MARK: 窗口拖拽手势
    // 用屏幕坐标 NSEvent.mouseLocation 计算窗口位置，避免 SwiftUI 局部坐标系随窗口移动产生抖动
    private var ghostDragGesture: some Gesture {
        DragGesture(minimumDistance: 2)
            .onChanged { _ in
                guard let window = ghostWindow else { return }
                if dragStartOrigin == nil {
                    dragStartOrigin = window.frame.origin
                    dragStartMouse = NSEvent.mouseLocation
                }
                guard let startOrigin = dragStartOrigin,
                      let startMouse = dragStartMouse else { return }
                let current = NSEvent.mouseLocation
                var origin = NSPoint(
                    x: startOrigin.x + (current.x - startMouse.x),
                    y: startOrigin.y + (current.y - startMouse.y)
                )
                // 限制窗口整体不超出所在屏幕范围（含菜单栏和 Dock 区域，可拖到最底部）
                let mouseScreen = NSScreen.screens.first {
                    NSMouseInRect(current, $0.frame, false)
                } ?? window.screen ?? NSScreen.main
                if let screen = mouseScreen {
                    let bounds = screen.frame
                    let size = window.frame.size
                    origin.x = min(max(origin.x, bounds.minX), bounds.maxX - size.width)
                    origin.y = min(max(origin.y, bounds.minY), bounds.maxY - size.height)
                }
                window.setFrameOrigin(origin)
            }
            .onEnded { _ in
                dragStartOrigin = nil
                dragStartMouse = nil
            }
    }

    // MARK: 窗口模式切换
    private func applyWindowMode(isGhost: Bool) {
        // 找到主窗口（优先 keyWindow，其次带标题栏的窗口）
        guard let window = NSApp.keyWindow
                            ?? NSApp.windows.first(where: { $0.styleMask.contains(.titled) })
                            ?? NSApp.windows.first(where: { $0.contentView != nil })
        else { return }

        if isGhost {
            ghostWindow = window
            // 保存当前 frame，便于退出时恢复
            if savedFrame == .zero {
                savedFrame = window.frame
            }
            let ghostSize = CGSize(width: 210, height: 52)
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
            // 用 layer 圆角裁剪掉透明窗口矩形的四角底色
            let cornerRadius: CGFloat = 26
            if let cv = window.contentView {
                cv.wantsLayer = true
                cv.layer?.cornerRadius = cornerRadius
                cv.layer?.masksToBounds = true
                cv.layer?.shadowOpacity = 0
            }
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.3
                ctx.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
                window.animator().setFrame(
                    NSRect(origin: center, size: ghostSize),
                    display: true
                )
            }
        } else {
            ghostWindow = nil
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

// MARK: - 设置视图（请假管理 + 未来周期预览）
struct SettingsView: View {
    @EnvironmentObject private var vm: WorkClockViewModel
    @State private var pickerDate: Date = Date()
    @State private var pageSize: Int = 10
    @State private var visibleCount: Int = 10

    var body: some View {
        TabView {
            leavePane
                .tabItem { Label("请假", systemImage: "calendar.badge.minus") }
            previewPane
                .tabItem { Label("周期预览", systemImage: "calendar") }
        }
        .padding(16)
        .frame(width: 480, height: 520)
    }

    // MARK: 请假面板
    private var leavePane: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "calendar.badge.minus")
                    .foregroundStyle(.tint)
                Text("请假管理")
                    .font(.system(size: 14, weight: .semibold))
                Spacer()
                Text("当天不计时，已在周期目标中扣除")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 8) {
                DatePicker("", selection: $pickerDate, displayedComponents: .date)
                    .labelsHidden()
                Button("添加") {
                    vm.addLeave(pickerDate)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(WorkSchedule.leaveKeys.contains(WorkClockLogic.dayKey(pickerDate)))
                Spacer()
            }

            Divider()

            if vm.leaveDates.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(.green)
                    Text("当前没有请假")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Text("已请假 \(vm.leaveDates.count) 天")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                ScrollView {
                    VStack(spacing: 6) {
                        ForEach(vm.leaveDates, id: \.self) { day in
                            HStack(spacing: 8) {
                                Image(systemName: "circle.fill")
                                    .font(.system(size: 5))
                                    .foregroundStyle(.orange)
                                Text(formatLeaveDate(day))
                                    .font(.system(size: 12, design: .monospaced))
                                Spacer()
                                Text(weekdayText(day))
                                    .font(.system(size: 11))
                                    .foregroundStyle(.secondary)
                                Button {
                                    vm.removeLeave(day)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(.secondary)
                                }
                                .buttonStyle(.plain)
                                .help("取消该日请假")
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(Color(nsColor: .separatorColor).opacity(0.35))
                            )
                        }
                    }
                }
            }
        }
    }

    // MARK: 周期预览面板
    private var previewPane: some View {
        let runs = WorkClockLogic.upcomingRuns(after: vm.now, count: visibleCount)
        let canLoadMore = visibleCount < WorkClockLogic.maxPreviewRuns
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "calendar")
                    .foregroundStyle(.tint)
                Text("未来周期预览")
                    .font(.system(size: 14, weight: .semibold))
                Spacer()
            }

            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 10) {
                    ForEach(Array(runs.enumerated()), id: \.offset) { idx, run in
                        previewRow(index: idx, run: run, isCurrent: idx == 0)
                            .onAppear {
                                // 触底自动加载下一页
                                if idx == runs.count - 1 && canLoadMore {
                                    visibleCount += pageSize
                                }
                            }
                    }
                    if canLoadMore {
                        ProgressView()
                            .controlSize(.small)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    } else {
                        Text("已加载全部周期")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    }
                }
                .padding(.vertical, 4)
                .padding(.horizontal, 4)
            }
        }
    }

    private func previewRow(index: Int, run: WorkClockLogic.Run, isCurrent: Bool) -> some View {
        // 配色：靛蓝紫主色
        let accentStart = Color(red: 0.30, green: 0.36, blue: 0.72)
        let accentEnd   = Color(red: 0.45, green: 0.32, blue: 0.82)
        let barColor: Color = isCurrent ? accentEnd : Color.secondary.opacity(0.35)
        let bgFill: Color = isCurrent
            ? Color(nsColor: .separatorColor).opacity(0.55)
            : Color(nsColor: .separatorColor).opacity(0.22)

        return HStack(alignment: .center, spacing: 14) {
            // 序号徽章
            VStack(spacing: 1) {
                Text("\(index + 1)")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundStyle(isCurrent ? AnyShapeStyle(accentEnd) : AnyShapeStyle(Color.secondary))
                Text("周期")
                    .font(.system(size: 9, weight: .medium))
                    .tracking(1)
                    .foregroundStyle(.secondary)
            }
            .frame(width: 48)

            // 日期段 + 辅助行
            VStack(alignment: .leading, spacing: 5) {
                Text(fullRangeText(run.days))
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text("\(run.days.count) 个工作日")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(.secondary)
                    if run.leaveCount > 0 {
                        Text("·")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                        Text("请假 \(run.leaveCount) 天")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Color.orange)
                    }
                }
                // 周次小点：直观看出有几天
                HStack(spacing: 4) {
                    ForEach(Array(run.days.enumerated()), id: \.offset) { _, d in
                        Circle()
                                .fill(WorkClockLogic.isLeaveDay(d) ? Color.orange : accentStart)
                                .frame(width: 6, height: 6)
                    }
                }
                .padding(.top, 1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // 右侧元信息（远离边缘的内边距）
            VStack(alignment: .trailing, spacing: 5) {
                Text("\(run.targetHours)h")
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(isCurrent ? AnyShapeStyle(accentEnd) : AnyShapeStyle(Color.primary))
                Text("\(run.workdayCount) 天")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(.secondary)
                if run.leaveCount > 0 {
                    Text("请假")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color.orange))
                } else if isCurrent {
                    Text("进行中")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            LinearGradient(
                                colors: [accentStart, accentEnd],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .clipShape(Capsule())
                }
            }
            .frame(width: 78, alignment: .trailing)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(bgFill)
                RoundedRectangle(cornerRadius: 2)
                    .fill(barColor)
                    .frame(width: 3)
                    .padding(.vertical, 6)
                    .padding(.leading, 0)
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(
                    isCurrent ? accentEnd.opacity(0.45) : Color.clear,
                    lineWidth: 0.5
                )
        )
    }

    // MARK: 格式化
    private func formatLeaveDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd M月d日"
        f.locale = Locale(identifier: "zh_CN")
        return f.string(from: date)
    }

    private func formatLeaveShort(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "M.d"
        return f.string(from: date)
    }

    private func weekdayText(_ date: Date) -> String {
        let names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
        let w = WorkClockLogic.weekday(of: date)
        return names[safe: w] ?? ""
    }

    /// 日期列表 → 日期段文本，如 "2026.10.8 - 2026.10.10"（始终带年份，便于跨年/未来预览辨认）
    private func fullRangeText(_ days: [Date]) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "yyyy.M.d"
        guard let first = days.first, let last = days.last else { return "-" }
        let firstText = f.string(from: first)
        let lastText = f.string(from: last)
        if firstText == lastText {
            return firstText
        }
        return "\(firstText) - \(lastText)"
    }

    /// 日期列表 → 日期段文本（如 "9.20-9.24"，仅用于主视图的紧凑显示）
    private func rangeText(_ days: [Date]) -> String {
        guard let first = days.first, let last = days.last else { return "-" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_CN")
        let cal = Calendar.current
        if cal.component(.year, from: first) != cal.component(.year, from: last) {
            f.dateFormat = "yyyy.M.d"
            return "\(f.string(from: first))-\(f.string(from: last))"
        }
        f.dateFormat = "M.d"
        return "\(f.string(from: first))-\(f.string(from: last))"
    }
}

// 安全数组下标
private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
