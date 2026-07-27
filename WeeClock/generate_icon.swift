#!/usr/bin/env swift

import AppKit

// 生成圆角方形时钟图标，配色与 app 的靛蓝紫进度条一致
func renderIcon(size: CGFloat) -> NSImage {
    let rect = CGRect(x: 0, y: 0, width: size, height: size)
    let scale = size / 1024
    let image = NSImage(size: CGSize(width: size, height: size))

    image.lockFocus()

    // 圆角矩形背景（macOS 风格圆角 ≈ 22.5%）
    let cornerRadius = size * 0.225
    let bgPath = NSBezierPath(roundedRect: rect, xRadius: cornerRadius, yRadius: cornerRadius)

    // 深靛蓝紫渐变背景
    let gradient = NSGradient(
        colors: [
            NSColor(red: 0.22, green: 0.24, blue: 0.48, alpha: 1.0),
            NSColor(red: 0.14, green: 0.16, blue: 0.38, alpha: 1.0)
        ]
    )
    gradient?.draw(in: bgPath, angle: 135)

    let centerX = size / 2
    let centerY = size / 2

    // ---- 进度环（外圈） ----
    let ringRadius = size * 0.36
    let ringLineWidth = size * 0.055
    let ringRect = CGRect(
        x: centerX - ringRadius,
        y: centerY - ringRadius,
        width: ringRadius * 2,
        height: ringRadius * 2
    )

    // 底轨：半透明白色
    let trackPath = NSBezierPath(ovalIn: ringRect)
    trackPath.lineWidth = ringLineWidth * 0.7
    NSColor.white.withAlphaComponent(0.18).setStroke()
    trackPath.stroke()

    // 进度弧：亮靛蓝紫（约 60% 进度，展示效果）
    let progressPath = NSBezierPath()
    let startAngle: CGFloat = -90 // 12点钟方向
    let endAngle: CGFloat = -90 + 360 * 0.6 // 60% 进度
    progressPath.appendArc(
        withCenter: CGPoint(x: centerX, y: centerY),
        radius: ringRadius,
        startAngle: startAngle,
        endAngle: endAngle,
        clockwise: true
    )
    progressPath.lineWidth = ringLineWidth
    progressPath.lineCapStyle = .round
    NSColor(red: 0.45, green: 0.50, blue: 0.92, alpha: 1.0).setStroke()
    progressPath.stroke()

    // ---- 时钟指针 ----
    let clockRadius = size * 0.22
    let clockCenter = CGPoint(x: centerX, y: centerY)

    // 时针（指向 9 点方向 = 工作开始）
    let hourHand = NSBezierPath()
    hourHand.move(to: clockCenter)
    hourHand.line(
        to: CGPoint(
            x: clockCenter.x - clockRadius * 0.55,
            y: clockCenter.y + clockRadius * 0.05
        )
    )
    hourHand.lineWidth = ringLineWidth * 0.85
    hourHand.lineCapStyle = .round
    NSColor.white.setStroke()
    hourHand.stroke()

    // 分针（指向 12 点方向）
    let minuteHand = NSBezierPath()
    minuteHand.move(to: clockCenter)
    minuteHand.line(
        to: CGPoint(
            x: clockCenter.x + clockRadius * 0.08,
            y: clockCenter.y + clockRadius * 0.75
        )
    )
    minuteHand.lineWidth = ringLineWidth * 0.55
    minuteHand.lineCapStyle = .round
    NSColor.white.withAlphaComponent(0.85).setStroke()
    minuteHand.stroke()

    // 中心圆点
    let dotRadius = ringLineWidth * 0.6
    let dotPath = NSBezierPath(
        ovalIn: CGRect(
            x: centerX - dotRadius,
            y: centerY - dotRadius,
            width: dotRadius * 2,
            height: dotRadius * 2
        )
    )
    NSColor.white.setFill()
    dotPath.fill()

    image.unlockFocus()
    return image
}

// 主流程
let outputDir = "icon.iconset"
let fm = FileManager.default
try? fm.createDirectory(atPath: outputDir, withIntermediateDirectories: true)

let sizes: [(CGFloat, String)] = [
    (16,   "icon_16x16.png"),
    (32,   "icon_16x16@2x.png"),
    (32,   "icon_32x32.png"),
    (64,   "icon_32x32@2x.png"),
    (128,  "icon_128x128.png"),
    (256,  "icon_128x128@2x.png"),
    (256,  "icon_256x256.png"),
    (512,  "icon_256x256@2x.png"),
    (512,  "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]

for (size, name) in sizes {
    let image = renderIcon(size: size)
    guard let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let png = bitmap.representation(using: .png, properties: [:]) else {
        print("❌ 渲染失败: \(name)")
        continue
    }
    try png.write(to: URL(fileURLWithPath: "\(outputDir)/\(name)"))
    print("✅ \(name) (\(Int(size))x\(Int(size)))")
}

// 用 iconutil 打包
let task = Process()
task.launchPath = "/usr/bin/iconutil"
task.arguments = ["-c", "icns", outputDir, "-o", "WeeClock.icns"]
task.launch()
task.waitUntilExit()

if task.terminationStatus == 0 {
    print("✅ 图标已生成：WeeClock.icns")
} else {
    print("❌ iconutil 打包失败")
}