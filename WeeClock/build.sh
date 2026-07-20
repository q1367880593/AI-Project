#!/bin/bash
# WeeClock 构建脚本
# 将 Swift 源码编译为 macOS .app bundle
set -e

APP_NAME="WeeClock"
BUNDLE_ID="com.weeclock.app"
TARGET="arm64-apple-macosx26.0"
WORK_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${WORK_DIR}/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

cd "${WORK_DIR}"

echo "🛠  编译 Swift 源码..."
swiftc -O \
    -target "${TARGET}" \
    -sdk "$(xcrun --sdk macosx --show-sdk-path)" \
    -o "${APP_NAME}" \
    WeeClockApp.swift \
    ContentView.swift \
    WorkClockLogic.swift \
    -framework SwiftUI \
    -framework AppKit \
    -parse-as-library

echo "📦 组装 .app bundle..."
rm -rf "${APP_DIR}"
mkdir -p "${MACOS_DIR}" "${RESOURCES_DIR}"
mv "${APP_NAME}" "${MACOS_DIR}/${APP_NAME}"

# 写入 Info.plist
cat > "${CONTENTS_DIR}/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>WeeClock 工作周倒计时</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>26.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.productivity</string>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
</dict>
</plist>
PLIST

echo "✅ 构建完成：${APP_DIR}"

if [ "${1}" = "--run" ]; then
    echo "🚀 启动 ${APP_NAME}..."
    open "${APP_DIR}"
fi
