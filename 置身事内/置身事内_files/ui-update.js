/* 源自《置身事内》单文件版 - UI更新 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== UI更新 ==============
function updateUI() {
  const bar = document.getElementById('status-bar');
  const s = gameState;
  const lv = getCityLevel();
  const termProgress = Math.round(s.termTurn / s.termEnd * 100);
  const chips = [
    chip(lv.name + (
      s.resourceDepleted ? '·资源枯竭型城市'
      : s.povertyStatus === 'extreme' ? '·特困地区'
      : s.povertyStatus === 'poverty' ? '·贫困地区' : ''
    ), getOfficialTitle().replace('书记',''), '', ICON.gov, true),
    chip('日期', `${s.year}.${String(s.month).padStart(2,'0')}`, '', ICON.calendar),
    chip('财政', `¥${formatMoney(s.treasury * 10000)}`, s.treasury > 1000 ? 'good' : s.treasury > 0 ? 'warn' : 'bad', ICON.wallet, true),
    chip('人口', formatPop(s.population), '', ICON.users, true),
    chip('GDP', `¥${formatMoney(s.gdp * 10000)}`, 'good', ICON.trendingUp),
    chip('宜居', Math.round(s.livabilityScore), s.livabilityScore >= 75 ? 'good' : s.livabilityScore >= 50 ? 'warn' : 'bad', ICON.heart),
    chip('任期', `${termProgress}%`, termProgress >= 90 ? 'warn' : '', ICON.clock),
  ];
  // v2.3.0d: 显示主导风向（城市生成时确定）
  if (s.windDirection) chips.push(chip('风向', s.windDirection, '', ICON.wind));
  bar.innerHTML = chips.join('');
  const fabMenu = document.getElementById('fab-menu');
  if (fabMenu && fabMenu.classList.contains('active')) renderSheet(currentTab);
  // 刷新建筑窗口内容
  const bw = document.getElementById('build-window');
  if (bw && bw.classList.contains('active')) {
    document.getElementById('bw-body').innerHTML = renderBuildTab();
  }
  // 刷新拆除窗口内容
  const dw = document.getElementById('demolish-window');
  if (dw && dw.classList.contains('active')) {
    document.getElementById('dw-body').innerHTML = renderDemolishTab();
  }
  // 刷新菜单面板
  const mp = document.getElementById('menu-panel');
  if (mp && mp.classList.contains('active') && typeof renderMenuPanel === 'function') {
    renderMenuPanel();
  }
  updateEventBadge();
}

function chip(label, val, cls, icon, highlight) {
  return `<div class="stat-chip ${highlight ? 'highlight' : ''}">${icon ? `<span class="chip-icon">${icon}</span>` : ''}<span class="chip-label">${label}</span><span class="chip-val ${cls}">${val}</span></div>`;
}

