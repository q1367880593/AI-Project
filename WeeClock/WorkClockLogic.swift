import Foundation

// MARK: - 工作时钟逻辑
/// 计算活动窗口、累计活动秒数、周期起始时间等
struct WorkClockLogic {
    /// 一周期的总秒数：40 小时
    static let totalCycleSeconds: TimeInterval = 40 * 3600
    /// 单段秒数：4 小时
    static let segmentSeconds: TimeInterval = 4 * 3600
    /// 总段数：10 段
    static let totalSegments: Int = 10

    /// 使用周一作为一周起点的日历
    private static var workCalendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2  // Monday
        c.timeZone = TimeZone.current
        return c
    }()

    // MARK: 活动窗口判断
    /// 给定时间是否处于活动窗口内（每天 9:00-12:00 或 13:00-18:00）
    static func isActive(at date: Date) -> Bool {
        let cal = workCalendar
        let comps = cal.dateComponents([.hour, .minute, .second], from: date)
        let h = comps.hour ?? 0
        let m = comps.minute ?? 0
        let s = comps.second ?? 0
        let secs = h * 3600 + m * 60 + s
        // 9:00:00 <= secs < 12:00:00  OR  13:00:00 <= secs < 18:00:00
        return (secs >= 9 * 3600 && secs < 12 * 3600)
            || (secs >= 13 * 3600 && secs < 18 * 3600)
    }

    // MARK: 累计活动秒数
    /// 计算 [start, end] 内处于活动窗口的总秒数
    /// 活动窗口：每天 9:00-12:00、13:00-18:00
    static func activeSecondsBetween(start: Date, end: Date) -> TimeInterval {
        guard end > start else { return 0 }
        let cal = workCalendar
        var total: TimeInterval = 0
        var currentDay = cal.startOfDay(for: start)

        while currentDay < end {
            let dayStart = currentDay
            let dayEnd = dayStart.addingTimeInterval(24 * 3600)

            // 窗口 1: 9:00 - 12:00
            let w1Start = dayStart.addingTimeInterval(9 * 3600)
            let w1End   = dayStart.addingTimeInterval(12 * 3600)
            // 窗口 2: 13:00 - 18:00
            let w2Start = dayStart.addingTimeInterval(13 * 3600)
            let w2End   = dayStart.addingTimeInterval(18 * 3600)

            // 与 [start, end] 求交集
            let w1 = max(0, min(w1End, end).timeIntervalSince(max(w1Start, start)))
            let w2 = max(0, min(w2End, end).timeIntervalSince(max(w2Start, start)))
            total += w1 + w2

            currentDay = dayEnd
        }
        return total
    }

    // MARK: 周期起始
    /// 返回 date 所在或最近的「上一个周一 9:00」
    /// - 若当前时间 >= 本周一 9:00，返回本周一 9:00
    /// - 若当前时间 < 本周一 9:00，返回上周一 9:00
    static func cycleStart(for date: Date) -> Date {
        let cal = workCalendar
        guard let weekInterval = cal.dateInterval(of: .weekOfYear, for: date) else {
            return date
        }
        let mondayStart = weekInterval.start  // firstWeekday=2 → 周一 0:00

        var comps = cal.dateComponents([.year, .month, .day], from: mondayStart)
        comps.hour = 9
        comps.minute = 0
        comps.second = 0
        guard let monday9am = cal.date(from: comps) else { return date }

        if monday9am > date {
            // 在本周一 9:00 之前 → 用上周一 9:00
            return cal.date(byAdding: .weekOfYear, value: -1, to: monday9am) ?? monday9am
        }
        return monday9am
    }

    /// 返回 date 之后的下一个「周一 9:00」
    static func nextCycleStart(after date: Date) -> Date {
        let cal = workCalendar
        var comps = DateComponents()
        comps.weekday = 2  // Monday
        comps.hour = 9
        comps.minute = 0
        comps.second = 0
        return cal.nextDate(after: date,
                            matching: comps,
                            matchingPolicy: .nextTime) ?? date
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
