/* 源自《置身事内》单文件版 - 存档导出/导入 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 存档导出/导入 ==============
function exportSave(slot) {
  try {
    let raw;
    if (slot === 'current') {
      raw = JSON.stringify(getSaveData());
    } else {
      raw = localStorage.getItem('cityPlanner_save_' + slot);
      if (!raw) { showNotification('存档不存在，无法导出', 'warn'); return; }
    }
    const data = JSON.parse(raw);
    const fileName = `置身事内_${data.state?.playerName || '存档'}_${data.state?.cityName || ''}_${data.state?.year || ''}年${data.state?.month || ''}月.json`;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`存档已导出：${fileName}`, 'success');
  } catch(e) {
    showNotification('导出失败：' + e.message, 'danger');
  }
}

function importSave() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target.result;
        const data = JSON.parse(raw);
        if (!data.state || !data.map) { showNotification('存档文件格式不正确', 'danger'); return; }
        if (data.version) {
          const major = data.version.split('.').slice(0, 3).join('.');
          if (major < '1.1.0') { showNotification('存档版本过旧，可能不兼容', 'warn'); }
        }
        // 存入第一个空槽位
        let targetSlot = -1;
        for (let i = 1; i <= 3; i++) {
          if (!localStorage.getItem('cityPlanner_save_' + i)) { targetSlot = i; break; }
        }
        if (targetSlot === -1) {
          // 没有空槽，覆盖槽位1
          targetSlot = 1;
          showNotification('所有存档位已满，已覆盖存档位1', 'warn');
        }
        localStorage.setItem('cityPlanner_save_' + targetSlot, raw);
        showNotification(`存档已导入到存档位${targetSlot}`, 'success');
        showSaveScreen(saveMode);
      } catch(err) {
        showNotification('导入失败：文件解析错误 - ' + err.message, 'danger');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function saveGamePrompt() {
  toggleFab();
  setTimeout(() => showSaveScreen('save'), 200);
}

function confirmExit() {
  showModal('返回主菜单', '<p>未保存的进度将丢失，确定返回主菜单吗？</p>', [
    { text: '取消', color: 'gray', action: closeModal },
    { text: '确认返回', color: 'red', action: () => { toggleFab(); closeModal(); location.reload(); } },
  ], '确认', 'warn');
}

function showAchievementsFromHome() {
  // Load global achievements (cross-save shared)
  let globalAch = [];
  try { globalAch = JSON.parse(localStorage.getItem('cityPlanner_globalAchievements') || '[]'); } catch(e) {}
  let globalStats = {};
  try { globalStats = JSON.parse(localStorage.getItem('cityPlanner_globalStats') || '{}'); } catch(e) {}
  const allUnlocked = new Set(globalAch);
  let html = `<div style="text-align:center;margin-bottom:16px;">
    <div style="font-size:32px;font-weight:700;color:var(--accent);">${allUnlocked.size}<span style="font-size:16px;color:var(--text-3);">/${ACHIEVEMENTS.length}</span></div>
    <div style="font-size:13px;color:var(--text-3);">已解锁成就</div>
  </div>`;
  // Global stats
  html += `<div style="background:var(--separator-light);border-radius:10px;padding:12px;margin-bottom:12px;">
    <div style="font-size:12px;color:var(--text-3);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <span>累计游戏月数：${globalStats.totalMonthsPlayed || 0}</span>
      <span>累计修建：${globalStats.totalBuildingsBuilt || 0}栋</span>
      <span>累计晋升：${globalStats.promotions || 0}次</span>
    </div>
  </div>`;
  // Sort by rarity
  const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
  const sorted = [...ACHIEVEMENTS].sort((a, b) => (rarityOrder[a.rarity] || 9) - (rarityOrder[b.rarity] || 9));
  for (const ach of sorted) {
    const isUnlocked = allUnlocked.has(ach.id);
    const rarityColors = { common: 'var(--text-2)', uncommon: 'var(--green)', rare: 'var(--accent)', epic: 'var(--purple)', legendary: 'var(--orange)' };
    const color = rarityColors[ach.rarity] || 'var(--accent)';
    if (isUnlocked) {
      html += `<div style="background:var(--bg-card);border-radius:10px;padding:12px;margin-bottom:8px;border-left:3px solid ${color};box-shadow:var(--shadow-sm);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:28px;height:28px;color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ach.icon}</div>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:14px;font-weight:700;color:var(--text-1);">${ach.name}</span>
              <span style="font-size:10px;font-weight:600;color:${color};text-transform:uppercase;">${ach.rarity}</span>
            </div>
            <div style="font-size:12px;color:var(--text-3);">${ach.desc}</div>
          </div>
        </div>
      </div>`;
    } else {
      html += `<div style="background:var(--bg-card);border-radius:10px;padding:12px;margin-bottom:8px;border-left:3px solid var(--separator);opacity:0.5;box-shadow:var(--shadow-sm);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:28px;height:28px;color:var(--text-3);display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:0.3;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          </div>
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:14px;font-weight:700;color:var(--text-3);">??? (未解锁)</span>
              <span style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;">${ach.rarity}</span>
            </div>
            <div style="font-size:12px;color:var(--text-3);">${ach.desc}</div>
          </div>
        </div>
      </div>`;
    }
  }
  showModal('成就系统', html, [{ text: '返回', color: 'gray', action: closeModal }], '成就', 'info');
}

