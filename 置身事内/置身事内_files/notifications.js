/* 源自《置身事内》单文件版 - 通知与日志 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 通知与日志 ==============
function showNotification(text, type) {
  const container = document.getElementById('notif-container');
  const el = document.createElement('div');
  el.className = `notif ${type || 'info'}`;
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function logEvent(text, type) {
  // 持久化到事件日志（用于晚报系统）
  if (!gameState.eventLog) gameState.eventLog = [];
  gameState.eventLog.push({ text, type: type || 'info', turn: gameState.turn, month: gameState.month, year: gameState.year });
  while (gameState.eventLog.length > 200) gameState.eventLog.shift(); // 最多保留200条
  const bar = document.getElementById('event-bar');
  const entry = document.createElement('div');
  entry.className = 'log-pill';
  const logIcons = { info: ICON.chart, warn: ICON.alert, danger: ICON.flameStat, success: ICON.check, corruption: ICON.moneyBag };
  const icon = logIcons[type] || ICON.fileText;
  const monthStr = `${gameState.year}.${String(gameState.month).padStart(2, '0')}`;
  entry.innerHTML = `${icon}<span style="margin-left:4px;">${monthStr} ${text}</span>`;
  entry.style.display = 'flex';
  entry.style.alignItems = 'center';
  entry.style.gap = '4px';
  bar.insertBefore(entry, bar.firstChild);
  while (bar.children.length > 1) bar.removeChild(bar.lastChild);
  setTimeout(() => entry.remove(), 5000);
}

