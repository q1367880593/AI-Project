import Foundation

// MARK: - 调休与请假安排
/// 工作日判定：默认周一至周五上班，法定节假日休息，调休补班的周末上班，自定义请假视为休息。
enum WorkSchedule {
    static let leaveDefaultsKey = "WeeClock.leaveDays"
    static let leaveDidChange = Notification.Name("WeeClock.leaveDidChange")

    struct Config {
        var holidays: Set<String> = []       // 法定放假日期（yyyy-MM-dd）
        var makeupWorkdays: Set<String> = [] // 调休补班日期（yyyy-MM-dd）
    }

    /// 从 bundle 中加载调休数据；加载失败时退化为"周一至周五为工作日"
    static let config: Config = loadConfig()

    static var leaveKeys: Set<String> {
        get { Set(UserDefaults.standard.stringArray(forKey: leaveDefaultsKey) ?? []) }
        set {
            UserDefaults.standard.set(Array(newValue).sorted(), forKey: leaveDefaultsKey)
            NotificationCenter.default.post(name: leaveDidChange, object: nil)
        }
    }

    /// 当天是否为国家调度工作日（不含请假：周一至周五 + 调休补班，剔除法定节假日）
    static func isScheduledWorkday(_ date: Date) -> Bool {
        let key = WorkClockLogic.dayKey(date)
        if config.holidays.contains(key) { return false }
        if config.makeupWorkdays.contains(key) { return true }
        let weekday = WorkClockLogic.weekday(of: date)
        return weekday >= 2 && weekday <= 6  // 周一至周五
    }

    /// 当天是否为工作日（计时的日子，请假不算）
    static func isWorkday(_ date: Date) -> Bool {
        let key = WorkClockLogic.dayKey(date)
        if leaveKeys.contains(key) { return false }
        return isScheduledWorkday(date)
    }

    private static func loadConfig() -> Config {
        guard let url = Bundle.main.url(forResource: "Holidays", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return Config()
        }
        return Config(
            holidays: Set((obj["holidays"] as? [String]) ?? []),
            makeupWorkdays: Set((obj["makeupWorkdays"] as? [String]) ?? [])
        )
    }
}

// MARK: - 工作时钟逻辑
/// 周期 = 一段连续的工作日（中间任何休息日都会把周期截断）× 8 小时；
/// 休息日（周末/节假日/请假）不计时、不重置；下一个工作日 9:00 开始新的周期。
/// 例如 9.20-9.24（5 天 40h）→ 中秋断段 → 9.28-9.30（3 天 24h）→ 国庆断段 →
/// 10.8-10.10（3 天 24h，含 10.10 补班）→ 10.12-10.16（5 天 40h）。
struct WorkClockLogic {
    /// 单段秒数：4 小时（进度条刻度）
    static let segmentSeconds: TimeInterval = 4 * 3600

    // 每日活动窗口（秒）
    private static let morningStart = 9 * 3600
    private static let morningEnd = 12 * 3600
    private static let afternoonStart = 13 * 3600
    private static let afternoonEnd = 18 * 3600

    /// 使用周一作为一周起点的日历
    private static var workCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2  // Monday
        c.timeZone = TimeZone.current
        return c
    }()

    // MARK: 日期工具
    private static let dayKeyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone.current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func dayKey(_ date: Date) -> String { dayKeyFormatter.string(from: date) }

    static func startOfDay(_ date: Date) -> Date { workCalendar.startOfDay(for: date) }

    static func date(fromKey key: String) -> Date? {
        dayKeyFormatter.date(from: key).map { startOfDay($0) }
    }

    /// 1=周日 … 7=周六
    static func weekday(of date: Date) -> Int {
        workCalendar.component(.weekday, from: date)
    }

    // MARK: 工作日判定
    static func isWorkday(_ date: Date) -> Bool { WorkSchedule.isWorkday(date) }
    static func isLeaveDay(_ date: Date) -> Bool {
        WorkSchedule.leaveKeys.contains(dayKey(date))
    }

    // MARK: 活动窗口判断
    /// 给定时间是否处于活动窗口内（工作日 9:00-12:00 或 13:00-18:00）
    static func isActive(at date: Date) -> Bool {
        guard isWorkday(date) else { return false }
        let comps = workCalendar.dateComponents([.hour, .minute, .second], from: date)
        let secs = (comps.hour ?? 0) * 3600 + (comps.minute ?? 0) * 60 + (comps.second ?? 0)
        return (secs >= morningStart && secs < morningEnd)
            || (secs >= afternoonStart && secs < afternoonEnd)
    }

    // MARK: 累计活动秒数
    /// 计算 [start, end] 内处于活动窗口的总秒数（只统计工作日）
    static func activeSecondsBetween(start: Date, end: Date) -> TimeInterval {
        guard end > start else { return 0 }
        var total: TimeInterval = 0
        var day = startOfDay(start)

        while day < end {
            let nextDay = day.addingTimeInterval(24 * 3600)
            if isWorkday(day) {
                let w1Start = day.addingTimeInterval(TimeInterval(morningStart))
                let w1End = day.addingTimeInterval(TimeInterval(morningEnd))
                let w2Start = day.addingTimeInterval(TimeInterval(afternoonStart))
                let w2End = day.addingTimeInterval(TimeInterval(afternoonEnd))
                // 与 [start, end] 求交集
                total += max(0, min(w1End, end).timeIntervalSince(max(w1Start, start)))
                total += max(0, min(w2End, end).timeIntervalSince(max(w2Start, start)))
            }
            day = nextDay
        }
        return total
    }

    // MARK: 连续工作日段
    /// 不晚于 date 的最近一个调度工作日（0:00）；找不到时返回 nil
    static func lastScheduledWorkday(onOrBefore date: Date) -> Date? {
        var target = startOfDay(date)
        for _ in 0..<31 {
            if WorkSchedule.isScheduledWorkday(target) { return target }
            guard let prev = workCalendar.date(byAdding: .day, value: -1, to: target) else { return nil }
            target = prev
        }
        return nil
    }

    /// 严格晚于 day 的下一个调度工作日（0:00）
    static func firstScheduledWorkday(after day: Date) -> Date? {
        var target = day
        for _ in 0..<31 {
            guard let next = workCalendar.date(byAdding: .day, value: 1, to: target) else { return nil }
            target = next
            if WorkSchedule.isScheduledWorkday(target) { return target }
        }
        return nil
    }

    /// 包含该调度工作日的连续工作日段（段被任何休息日截断），按日期升序返回
    static func runDays(containingWorkday day: Date) -> [Date] {
        var start = day
        while true {
            guard let prev = workCalendar.date(byAdding: .day, value: -1, to: start),
                  WorkSchedule.isScheduledWorkday(prev) else { break }
            start = prev
        }
        var days: [Date] = []
        var cursor: Date? = start
        while let day = cursor, WorkSchedule.isScheduledWorkday(day) {
            days.append(day)
            cursor = workCalendar.date(byAdding: .day, value: 1, to: day)
        }
        return days
    }

    // MARK: 周期起止
    /// 当前周期开始：包含 date 的连续工作日段（date 为休息日时取最近已结束的段）的首个工作日 9:00
    static func cycleStart(for date: Date) -> Date {
        guard let first = cycleWorkdays(containing: date).first else { return date }
        return first.addingTimeInterval(9 * 3600)
    }

    /// 下一个周期开始：当前段结束后的首个工作日 9:00
    static func nextCycleStart(after date: Date) -> Date {
        guard let first = nextCycleWorkdays(after: date).first else { return date }
        return first.addingTimeInterval(9 * 3600)
    }

    // MARK: 周期日期段与目标时长
    /// 包含 date 的周期（连续工作日段）的日期列表
    static func cycleWorkdays(containing date: Date) -> [Date] {
        guard let last = lastScheduledWorkday(onOrBefore: date) else { return [] }
        return runDays(containingWorkday: last)
    }

    /// date 之后下一个周期（下一段连续工作日）的日期列表
    static func nextCycleWorkdays(after date: Date) -> [Date] {
        guard let runEnd = cycleWorkdays(containing: date).last,
              let nextStart = firstScheduledWorkday(after: runEnd) else { return [] }
        return runDays(containingWorkday: nextStart)
    }

    /// 本周期目标时长 =（周期内连续工作天数 − 请假天数）× 8 小时
    static func cycleTargetSeconds(containing date: Date) -> TimeInterval {
        let days = cycleWorkdays(containing: date)
        let leaveCount = days.filter { isLeaveDay($0) }.count
        return Double(max(0, days.count - leaveCount)) * 8 * 3600
    }

    // MARK: 未来周期预览
    /// 单个连续工作日段（周期）摘要
    struct Run {
        let days: [Date]                  // 日期列表（升序）
        let workdayCount: Int             // 实际工作日（剔除请假）
        let leaveCount: Int               // 段内请假天数
        var targetHours: Int { max(0, workdayCount) * 8 }
    }

    /// 从 date 起返回连续的 count 个周期摘要；包含 date 所在的当段。
    /// 对于 Holidays.json 未涵盖的日期，按 WorkSchedule 默认规则（周一至周五）判定。
    static func upcomingRuns(after date: Date, count: Int) -> [Run] {
        var result: [Run] = []
        guard let firstStart = lastScheduledWorkday(onOrBefore: date) else { return [] }
        let firstRun = makeRun(containingWorkday: firstStart)
        result.append(firstRun)
        var lastDay = firstRun.days.last ?? firstStart
        while result.count < count {
            guard let nextStart = firstScheduledWorkday(after: lastDay) else { break }
            let run = makeRun(containingWorkday: nextStart)
            result.append(run)
            lastDay = run.days.last ?? nextStart
        }
        return result
    }

    /// 预览上限（约 5 年，按周一至周五每周 5 个工作日段估算：~250 段）
    static let maxPreviewRuns: Int = 250

    private static func makeRun(containingWorkday day: Date) -> Run {
        let days = runDays(containingWorkday: day)
        let leaveCount = days.filter { isLeaveDay($0) }.count
        let workday = max(0, days.count - leaveCount)
        return Run(days: days, workdayCount: workday, leaveCount: leaveCount)
    }
}

// MARK: - 时间格式化扩展
extension TimeInterval {
    /// 格式化为 HH:MM:SS
    var hhmmss: String {
        let total = Int(max(0, self))
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    /// 格式化为 H小时M分
    var humanReadable: String {
        let total = Int(max(0, self))
        let h = total / 3600
        let m = (total % 3600) / 60
        if h > 0 {
            return "\(h)小时\(m)分"
        }
        return "\(m)分钟"
    }
}