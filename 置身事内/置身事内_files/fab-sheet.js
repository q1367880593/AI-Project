/* 置身事内 - FAB & Sheet（重构版：6核心模块） */

// ============== FAB & Sheet ==============
function toggleFab() {
  const fab = document.getElementById('fab');
  const menu = document.getElementById('fab-menu');
  const isActive = menu.classList.toggle('active');
  fab.classList.toggle('active', isActive);
  if (isActive) {
    if (!currentTab || currentTab === 'build') currentTab = 'demand';
    renderSheet(currentTab);
  }
}

function switchTab(tab) {
  // v2.4.0: 提级巡视期间锁定个人事务和整个政务页面
  if ((tab === 'personal' || tab === 'gov') && (gameState.inspectionLockdown || 0) > 0) {
    showNotification(`提级巡视期间，${tab === 'gov' ? '政务管理' : '个人事务'}页面已被锁定（剩余${gameState.inspectionLockdown}个月）`, 'warn');
    return;
  }
  currentTab = tab;
  document.querySelectorAll('.sheet-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  const titles = {
    demand: '市民需求', stats: '城市数据', policy: '政策调控',
    events: '事件中心', gov: '政务管理', personal: '个人事务'
  };
  document.getElementById('sheet-title').textContent = titles[tab] || tab;
  const container = document.getElementById('sheet-content');
  container.scrollTop = 0;
  renderSheet(tab);
}

function renderSheet(tab) {
  // v2.4.0: 提级巡视期间给政务和个人事务标签按钮添加锁定样式
  document.querySelectorAll('.sheet-tab').forEach(el => {
    const isLocked = (gameState.inspectionLockdown || 0) > 0 && (el.dataset.tab === 'gov' || el.dataset.tab === 'personal');
    if (isLocked) {
      el.style.opacity = '0.4';
      el.style.pointerEvents = 'none';
    } else {
      el.style.opacity = '';
      el.style.pointerEvents = '';
    }
  });
  const container = document.getElementById('sheet-content');
  switch(tab) {
    case 'demand': container.innerHTML = renderDemandTab(); break;
    case 'stats': container.innerHTML = renderStatsTab(); break;
    case 'policy': container.innerHTML = renderPolicyTab(); break;
    case 'events': container.innerHTML = renderEventsTab(); break;
    case 'gov': container.innerHTML = renderGovTab(); break;
    case 'personal': container.innerHTML = renderPersonalTab(); break;
    case 'demolish': container.innerHTML = renderDemolishTab(); break;
    default: container.innerHTML = renderDemandTab(); break;
  }
}

// ============== 建造（原 renderBuildTab，用于建筑窗口） ==============
function renderBuildTab() {
  let html = '';
  const ZONE_ICONS = { residential: ICON.home, industrial: ICON.factory, commercial: ICON.store, park: ICON.tree };
  html += `<div class="build-category"><div class="build-category-title">${ICON.building2}区域绘制（画笔）</div><div class="build-grid">`;
  for (const [zoneKey, zoneDef] of Object.entries(ZONE_TYPES)) {
    const subs = zoneDef.subTypes || {};
    const zoneIcon = ZONE_ICONS[zoneKey] || ICON.building2;
    for (const [subKey, sub] of Object.entries(subs)) {
      const sel = (gameState.selectedZone === zoneKey && gameState.selectedZoneSub === subKey) ? 'selected' : '';
      const cost = sub.costPerCell || zoneDef.costPerCell;
      html += `<div class="build-item ${sel}" onclick="selectZoneType('${zoneKey}','${subKey}')">
        <div class="bi-color" style="background:${sub.color || zoneDef.color};">${zoneIcon}</div>
        <span class="bi-name">${sub.name}</span>
        <span class="bi-cost">¥${cost}/格</span>
      </div>`;
    }
  }
  html += '</div></div>';
  // v2.2.6b: 修复分类标题SVG颜色不统一 — 将stroke="white"替换为stroke="currentColor"
  const _fixIconColor = (svg) => (svg || '').replace(/stroke="white"/g, 'stroke="currentColor"').replace(/fill="white"/g, 'fill="currentColor"');
  html += `<div class="build-category"><div class="build-category-title">${_fixIconColor(ICON.road)}道路绘制（画笔）</div><div class="build-grid">`;
  for (const [roadKey, roadDef] of Object.entries(ROAD_TYPES)) {
    const sel = gameState.selectedRoadType === roadKey ? 'selected' : '';
    html += `<div class="build-item ${sel}" onclick="selectRoadType('${roadKey}')">
      <div class="bi-color" style="background:${roadDef.color};">${ICON.road}</div>
      <span class="bi-name">${roadDef.name}</span>
      <span class="bi-cost">¥${roadDef.costPerCell}/格</span>
    </div>`;
  }
  html += '</div></div>';
  // v2.2.7: 公共交通整合板块（线路画笔 + 站点建筑）
  html += `<div class="build-category"><div class="build-category-title">${_fixIconColor(ICON.bridge)}公共交通</div><div class="build-grid">`;
  // 线路类型（画笔绘制）
  for (const [transitKey, transitDef] of Object.entries(TRANSIT_TYPES)) {
    // v2.2.7c: 未审批的线路也显示（灰色），点击时提示审批
    // v2.2.7d: 去除emoji锁图标，改为CSS opacity表示锁定状态
    const approved = !transitDef.requireApproval || gameState[transitDef.requireApproval];
    const sel = gameState.selectedTransitType === transitKey ? 'selected' : '';
    html += `<div class="build-item ${sel}" onclick="${approved ? `selectTransitType('${transitKey}')` : `showNotification('需先在申报页面获批${transitDef.name}建设', 'warn')`}" style="${approved ? '' : 'opacity:0.4;'}">
      <div class="bi-color" style="background:${transitDef.color};">${ICON.bridge}</div>
      <span class="bi-name">${transitDef.name}</span>
      <span class="bi-cost">¥${transitDef.costPerCell}/格</span>
    </div>`;
  }
  // 站点建筑
  const transitCat = INFRA_CATEGORIES.find(c => c.name === '公共交通');
  if (transitCat) {
    for (const id of transitCat.items) {
      const b = BUILDING_TYPES[id]; if (!b) continue;
      // v2.4.8: 机场和跑道仅在审批通过后显示
      if ((id === 'airport' || id === 'runway') && !gameState.airportApproved) continue;
      const sel = gameState.selectedBuilding === id ? 'selected' : '';
      const icon = BUILDING_ICONS[id] || ICON.building2;
      html += `<div class="build-item ${sel}" onclick="selectBuilding('${id}')">
        <div class="bi-color" style="background:${b.color};">${icon}</div>
        <span class="bi-name">${b.name}</span>
        <span class="bi-cost">¥${b.cost}</span>
        ${b.desc ? `<span class="bi-info" onclick="event.stopPropagation();showBuildingDetail('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg></span>` : ''}
      </div>`;
    }
  }
  // v2.4.8: 机场审批通过后额外显示机场（PALETTE_CATEGORIES中的airport也需条件显示）
  if (gameState.airportApproved && BUILDING_TYPES['airport']) {
    const b = BUILDING_TYPES['airport'];
    const sel = gameState.selectedBuilding === 'airport' ? 'selected' : '';
    const icon = BUILDING_ICONS['airport'] || ICON.building2;
    html += `<div class="build-item ${sel}" onclick="selectBuilding('airport')">
      <div class="bi-color" style="background:${b.color};">${icon}</div>
      <span class="bi-name">${b.name}</span>
      <span class="bi-cost">¥${b.cost}</span>
      ${b.desc ? `<span class="bi-info" onclick="event.stopPropagation();showBuildingDetail('airport')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg></span>` : ''}
    </div>`;
  }
  html += '</div></div>';
  for (const cat of INFRA_CATEGORIES) {
    if (cat.name === '公共交通') continue; // v2.2.7: 已在上方公共交通整合板块中渲染
    const catIcon = CATEGORY_ICONS[cat.name] || ICON.building2;
    html += `<div class="build-category"><div class="build-category-title">${_fixIconColor(catIcon)}${cat.name}</div><div class="build-grid">`;
    for (const id of cat.items) {
      const b = BUILDING_TYPES[id]; if (!b) continue;
      const sel = gameState.selectedBuilding === id ? 'selected' : '';
      const icon = BUILDING_ICONS[id] || ICON.building2;
      html += `<div class="build-item ${sel}" onclick="selectBuilding('${id}')">
        <div class="bi-color" style="background:${b.color};">${icon}</div>
        <span class="bi-name">${b.name}</span>
        <span class="bi-cost">¥${b.cost}</span>
        ${b.desc ? `<span class="bi-info" onclick="event.stopPropagation();showBuildingDetail('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg></span>` : ''}
      </div>`;
    }
    html += '</div></div>';
  }

  // ========== 模组建筑区域（v2.2.3：按模组分组，只显示已启用的模组） ==========
  const enabledModSet = new Set(gameState.enabledMods || []);
  for (const mod of ModLoader.loaded) {
    if (!enabledModSet.has(mod.id)) continue;
    const ids = ModLoader.modBuildings[mod.id] || [];
    if (ids.length === 0) continue;
    html += `<div class="build-category mod-buildings"><div class="build-category-title" style="background:var(--accent-light);color:var(--accent-dark);padding:8px 12px;border-radius:8px;border-left:3px solid var(--accent);"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M20 12a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-4 0v-2H9v-2a2 2 0 1 1 2-2V7h2v3a2 2 0 0 1 4 0v2h3a2 2 0 0 1 0 4Z"/></svg>${mod.info.name}（模组）</div><div class="build-grid">`;
    for (const id of ids) {
      const b = BUILDING_TYPES[id]; if (!b) continue;
      const sel = gameState.selectedBuilding === id ? 'selected' : '';
      const icon = BUILDING_ICONS[id] || ICON.building2;
      html += `<div class="build-item ${sel}" onclick="selectBuilding('${id}')">
        <div class="bi-color" style="background:${b.color};">${icon}</div>
        <span class="bi-name">${b.name}</span>
        <span class="bi-cost">¥${b.cost}</span>
        ${b.desc ? `<span class="bi-info" onclick="event.stopPropagation();showBuildingDetail('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg></span>` : ''}
      </div>`;
    }
    html += '</div></div>';
  }

  return html;
}

// ============== 可拖拽建筑窗口 ==============
let _buildDrag = null;
function toggleBuildWindow() {
  const win = document.getElementById('build-window');
  const isActive = win.classList.toggle('active');
  if (isActive) {
    document.getElementById('bw-body').innerHTML = renderBuildTab();
    // 设置拖拽
    const header = document.getElementById('bw-header');
    header.onmousedown = function(e) {
      _buildDrag = { startX: e.clientX, startY: e.clientY, origLeft: win.offsetLeft, origTop: win.offsetTop };
      e.preventDefault();
    };
  }
  // 关闭图层面板
  const lp = document.getElementById('layers-popup');
  if (lp) lp.classList.remove('active');
}
function closeBuildWindow() {
  document.getElementById('build-window').classList.remove('active');
}
function refreshBuildWindow() {
  const bw = document.getElementById('build-window');
  if (bw && bw.classList.contains('active')) {
    document.getElementById('bw-body').innerHTML = renderBuildTab();
  }
}

// ============== 可拖拽拆除窗口 ==============
let _demolishDrag = null;
function toggleDemolishWindow() {
  const win = document.getElementById('demolish-window');
  const isActive = win.classList.toggle('active');
  if (isActive) {
    gameState.selectedTool = 'demolish';
    if (gameState.demolishMode !== 'whole' && gameState.demolishMode !== 'partial' && gameState.demolishMode !== 'rect') {
      gameState.demolishMode = 'whole';
    }
    document.getElementById('dw-body').innerHTML = renderDemolishTab();
    updateToolUI();
    const header = document.getElementById('dw-header');
    header.onmousedown = function(e) {
      _demolishDrag = { startX: e.clientX, startY: e.clientY, origLeft: win.offsetLeft, origTop: win.offsetTop };
      e.preventDefault();
    };
  }
  // 关闭其他浮层
  const bw = document.getElementById('build-window');
  if (bw) bw.classList.remove('active');
  const lp = document.getElementById('layers-popup');
  if (lp) lp.classList.remove('active');
}
function closeDemolishWindow() {
  document.getElementById('demolish-window').classList.remove('active');
}
function refreshDemolishWindow() {
  const dw = document.getElementById('demolish-window');
  if (dw && dw.classList.contains('active')) {
    document.getElementById('dw-body').innerHTML = renderDemolishTab();
  }
}
document.addEventListener('mousemove', function(e) {
  if (!_demolishDrag) return;
  const win = document.getElementById('demolish-window');
  if (!win.classList.contains('active')) { _demolishDrag = null; return; }
  const dx = e.clientX - _demolishDrag.startX;
  const dy = e.clientY - _demolishDrag.startY;
  win.style.left = (_demolishDrag.origLeft + dx) + 'px';
  win.style.top = (_demolishDrag.origTop + dy) + 'px';
  win.style.right = 'auto';
});
document.addEventListener('mouseup', function() { _demolishDrag = null; });
// 全局 mousemove/mouseup 处理拖拽
document.addEventListener('mousemove', function(e) {
  if (!_buildDrag) return;
  const win = document.getElementById('build-window');
  if (!win.classList.contains('active')) { _buildDrag = null; return; }
  const dx = e.clientX - _buildDrag.startX;
  const dy = e.clientY - _buildDrag.startY;
  win.style.left = (_buildDrag.origLeft + dx) + 'px';
  win.style.top = (_buildDrag.origTop + dy) + 'px';
  win.style.right = 'auto';
});
document.addEventListener('mouseup', function() { _buildDrag = null; });

// ============== 图层面板弹出 ==============
function toggleLayersPopup() {
  const popup = document.getElementById('layers-popup');
  const isActive = popup.classList.toggle('active');
  if (isActive) {
    popup.innerHTML = _renderLayersPopupContent();
  }
  // 关闭建筑窗口
  const bw = document.getElementById('build-window');
  if (bw) bw.classList.remove('active');
}

// v2.2.4c: 图层弹窗内容（独立函数，便于 toggleLayer 刷新时复用）
function _renderLayersPopupContent() {
  // v2.2.6: 统一图层图标颜色为 currentColor（修复 train/bridge 使用 stroke="white" 导致颜色不统一）
  const layerIcon = (icon) => (icon || ICON.layers).replace(/stroke="white"/g, 'stroke="currentColor"');
  const layerIcons = { ground: layerIcon(ICON.mountain), underground: layerIcon(ICON.layers), subway: layerIcon(ICON.train), elevated: layerIcon(ICON.bridge), traffic: layerIcon(ICON.carStat) };
  let html = '';
  for (const [key, layer] of Object.entries(LAYERS)) {
    const active = gameState.activeLayers[key] ? 'active' : '';
    html += `<div class="layer-row ${active}" onclick="toggleLayer('${key}')">
      <div class="lr-dot"></div><div class="lr-icon">${layerIcons[key] || ICON.layers}</div><span class="lr-name">${layer.name}</span><span class="lr-z">Z${layer.z}</span>
    </div>`;
    // v2.2.4c: 车流层激活时显示子模式切换
    if (key === 'traffic' && gameState.activeLayers.traffic) {
      const mode = gameState.trafficLayerMode || 'congestion';
      const isCong = mode === 'congestion';
      const isHeat = mode === 'heatmap';
      html += `<div style="margin:2px 0 6px 24px;display:flex;gap:4px;">`;
      html += `<button class="gov-subnav-btn ${isCong ? 'active' : ''}" style="font-size:10px;padding:3px 8px;" onclick="setTrafficLayerMode('congestion')">拥堵色带</button>`;
      html += `<button class="gov-subnav-btn ${isHeat ? 'active' : ''}" style="font-size:10px;padding:3px 8px;" onclick="setTrafficLayerMode('heatmap')">需求热力图</button>`;
      html += `</div>`;
      // 图例
      if (isCong) {
        html += `<div style="margin:2px 0 6px 24px;font-size:10px;color:var(--text-3);line-height:1.5;">
          <span style="display:inline-block;width:8px;height:8px;background:#2ECC71;border-radius:2px;margin-right:2px;"></span>畅通
          <span style="display:inline-block;width:8px;height:8px;background:#F1C40F;border-radius:2px;margin:0 2px 0 6px;"></span>缓慢
          <span style="display:inline-block;width:8px;height:8px;background:#E67E22;border-radius:2px;margin:0 2px 0 6px;"></span>拥堵
          <span style="display:inline-block;width:8px;height:8px;background:#E74C3C;border-radius:2px;margin:0 2px 0 6px;"></span>严重拥堵
        </div>`;
      } else {
        html += `<div style="margin:2px 0 6px 24px;font-size:10px;color:var(--text-3);line-height:1.5;">
          <span style="display:inline-block;width:8px;height:8px;background:#F1C40F;border-radius:2px;margin-right:2px;"></span>低需求
          <span style="display:inline-block;width:8px;height:8px;background:#E67E22;border-radius:2px;margin:0 2px 0 6px;"></span>中需求
          <span style="display:inline-block;width:8px;height:8px;background:#E74C3C;border-radius:2px;margin:0 2px 0 6px;"></span>高需求
          <span style="display:inline-block;width:8px;height:8px;background:#9B59B6;border-radius:2px;margin:0 2px 0 6px;"></span>需连通
        </div>`;
      }
    }
  }
  // [v2.3.0] 同类地块合并显示开关
  const mergeActive = gameState.mergeZones ? 'active' : '';
  html += `<div class="layer-row ${mergeActive}" onclick="toggleMergeZones()">
    <div class="lr-dot"></div><div class="lr-icon">${layerIcon(ICON.building2)}</div><span class="lr-name">合并同类地块</span><span class="lr-z">显示</span>
  </div>`;
  return html;
}

// v2.2.4c: 切换车流层显示模式
function setTrafficLayerMode(mode) {
  gameState.trafficLayerMode = mode;
  // 刷新图层面板内容
  const popup = document.getElementById('layers-popup');
  if (popup && popup.classList.contains('active')) {
    popup.innerHTML = _renderLayersPopupContent();
  }
  renderMap();
}

// ============== 数据（移除成就概览） ==============
function renderStatsTab() {
  const s = gameState;
  const lv = getCityLevel();
  let html = `<div class="score-card">
    <div style="display:flex;justify-content:center;margin-bottom:4px;color:${s.livabilityScore >= 75 ? 'var(--green)' : s.livabilityScore >= 50 ? 'var(--orange)' : 'var(--red)'};">${ICON.award}</div>
    <div class="score-num" style="color:${s.livabilityScore >= 75 ? 'var(--green)' : s.livabilityScore >= 50 ? 'var(--orange)' : 'var(--red)'};">${Math.round(s.livabilityScore * 0.4 + s.prosperityScore * 0.3 + s.reputation * 0.2 + (100 - s.corruption) * 0.1)}</div>
    <div class="score-label">综合评分</div><div class="score-grade" id="score-grade"></div>
  </div>`;
  const termScore = Math.round(s.livabilityScore * 0.3 + s.prosperityScore * 0.2 + s.happiness * 0.2 + (100 - s.corruption) * 0.15 + s.reputation * 0.15);
  const popProgress = lv.id < 4 ? Math.min(100, Math.round(s.population / lv.promoPop * 100)) : 100;
  const scoreProgress = Math.min(100, Math.round(termScore / lv.promoScore * 100));
  const termProgress = Math.round(s.termTurn / s.termEnd * 100);
  html += `<div class="stats-section">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div><span style="font-size:16px;font-weight:700;">${lv.name}</span><span style="font-size:12px;color:var(--text-3);margin-left:8px;">${getOfficialTitle()}</span></div>
      <span style="font-size:11px;color:var(--text-3);">任期进度 ${termProgress}%</span>
    </div>
    <div class="stat-bar" style="margin-bottom:6px;"><div class="fill" style="width:${termProgress}%;background:var(--accent);"></div></div>`;
  if (lv.id < 4) {
    const nextLv = CITY_LEVELS[lv.id + 1];
    html += `<div style="margin-top:10px;padding:10px;background:var(--separator-light);border-radius:10px;">
      <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px;">晋升${nextLv.name}条件</div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:2px;">人口 ${formatPop(s.population)} / ${formatPop(lv.promoPop)}</div>
      <div class="stat-bar" style="margin-bottom:8px;"><div class="fill" style="width:${popProgress}%;background:${popProgress >= 100 ? 'var(--green)' : 'var(--orange)'};"></div></div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:2px;">评分 ${termScore} / ${lv.promoScore}</div>
      <div class="stat-bar"><div class="fill" style="width:${scoreProgress}%;background:${scoreProgress >= 100 ? 'var(--green)' : 'var(--orange)'};"></div></div>
    </div>`;
  } else {
    html += `<div style="margin-top:10px;padding:10px;background:var(--green-light);border-radius:10px;text-align:center;font-size:13px;color:var(--green);font-weight:600;">已达到最高城市等级</div>`;
  }
  html += '</div>';
  html += statSection('经济指标', ICON.chart, [
    statRowWithIcon('月GDP', `¥${formatMoney(s.gdp * 10000)}`, 'good', ICON.chart),
    statRowWithIcon('月财政收入', `¥${formatMoney(s.monthlyRevenue * 10000)}`, 'good', ICON.wallet),
  ]);
  // v2.2.7d: 财政支出折叠页（可展开查看各项支出明细）
  const expTotal = s.monthlyExpenditure || 0;
  let expDetailHtml = '';
  if (s.expenditureBreakdown) {
    const eb = s.expenditureBreakdown;
    const expRows = [
      ['建筑维护费', eb.buildingMaint || 0, ICON.building2],
      ['教育支出', eb.eduExp || 0, ICON.bookStat],
      ['社会保障支出', eb.socialExp || 0, ICON.users],
      ['医疗卫生支出', eb.healthExp || 0, ICON.heartStat],
      ['基础设施支出', eb.infraExp || 0, ICON.hammerStat],
      ['行政管理支出', eb.adminExp || 0, ICON.govStat],
      ['贷款还本付息', eb.loanPayment || 0, ICON.wallet],
      ['债务付息', eb.debtService || 0, ICON.wallet],
      ['打手维护费', eb.thugMaintCost || 0, ICON.fist],
      ['摩天大楼维护', eb.skyMaintCost || 0, ICON.building2],
      ['变电站购电费', eb.substationCost || 0, ICON.boltStat],
      ['水泵站抽水费', eb.waterPumpCost || 0, ICON.dropStat],
      ['公共交通运营', eb.transitOpCost || 0, ICON.trainStat],
    ];
    for (const [label, val, icon] of expRows) {
      if (val > 0) {
        expDetailHtml += statRowWithIcon(label, `¥${formatMoney(val * 10000)}`, 'bad', icon);
      }
    }
    if (eb.transitSubsidy && eb.transitSubsidy > 0) {
      expDetailHtml += statRowWithIcon('公交补贴抵扣', `-¥${formatMoney(eb.transitSubsidy * 10000)}`, 'good', ICON.trainStat);
    }
  }
  if (!expDetailHtml) expDetailHtml = statRowWithIcon('暂无支出明细', '—', '', ICON.wallet);
  html += `<div class="stats-section">
    <h3 style="cursor:pointer;user-select:none;" onclick="toggleExpenseDetail()">
      ${ICON.wallet}月财政支出 ¥${formatMoney(expTotal * 10000)}
      <span id="expense-chevron" style="margin-left:auto;transition:transform 0.2s;display:inline-flex;">${ICON.chevronDown}</span>
    </h3>
    <div id="expense-detail" style="display:none;">${expDetailHtml}</div>
  </div>`;
  html += statRowWithIcon('年度转移支付', `¥${formatMoney(Math.round(TRANSFER_PAYMENT_BASE * Math.max(0.05, 3000 / Math.max(s.gdp, 300)) * Math.max(0.2, 0.8 - getCityLevel().id * 0.12) * (1 + (s.livabilityScore - 50) / 300)) * 10000)}`, 'good', ICON.govStat);
  html += statRowWithIcon('失业率', (s.unemployment * 100).toFixed(1) + '%', s.unemployment < 0.05 ? 'good' : s.unemployment < 0.1 ? 'warn' : 'bad', ICON.users);
  html += statRowWithIcon('企业数量', s.businesses, '', ICON.briefcase);
  html += '</div>';
  if (s.revenueBreakdown) {
    const rb = s.revenueBreakdown;
    // v2.3.6: 企业所得税和公有企业利润直接联动企业系统计算
    const entStats = typeof getEnterpriseStats === 'function' ? getEnterpriseStats() : { totalTax: 0, totalFiscal: 0, totalProfit: 0 };
    html += statSection('财政收入明细（分税制）', ICON.fileText, [
      statRowWithIcon('增值税（地方50%）', `¥${formatMoney(rb.vat * 10000)}`, 'good', ICON.chart),
      statRowWithIcon('企业所得税（地方40%+企业系统）', `¥${formatMoney(Math.round((rb.cit + entStats.totalTax / 12) * 10000))}`, 'good', ICON.briefcase),
      statRowWithIcon('个人所得税（地方40%）', `¥${formatMoney(rb.pit * 10000)}`, 'good', ICON.users),
      statRowWithIcon('房产税（100%地方）', `¥${formatMoney(rb.property * 10000)}`, 'good', ICON.homeStat),
      statRowWithIcon('城建税（100%地方）', `¥${formatMoney(rb.urban * 10000)}`, 'good', ICON.building2),
      statRowWithIcon('土地相关税', `¥${formatMoney(rb.landRelated * 10000)}`, 'good', ICON.treeStat),
      statRowWithIcon('印花税', `¥${formatMoney(rb.stamp * 10000)}`, 'good', ICON.fileText),
      statRowWithIcon('非税收入', `¥${formatMoney(rb.nonTax * 10000)}`, 'good', ICON.wallet),
      statRowWithIcon('土地出让金', `¥${formatMoney(rb.landSale * 10000)}`, rb.landSale > 0 ? 'good' : '', ICON.storeStat),
      statRowWithIcon('月均转移支付', `¥${formatMoney(rb.transfer * 10000)}`, 'good', ICON.govStat),
      statRowWithIcon('公有企业利润上缴', `¥${formatMoney(Math.round(entStats.totalFiscal * 10000 / 12))}`, entStats.totalFiscal > 0 ? 'good' : '', ICON.briefcase),
    ]);
  }
  const airLevel = s.airQuality <= 50 ? '优' : s.airQuality <= 100 ? '良' : s.airQuality <= 150 ? '轻度污染' : s.airQuality <= 200 ? '中度污染' : '重度污染';
  const waterLevel = s.waterQuality >= 80 ? 'I类' : s.waterQuality >= 60 ? 'II类' : s.waterQuality >= 40 ? 'III类' : s.waterQuality >= 20 ? 'IV类' : 'V类';
  // v2.2.0 农业与城镇化板块
  if (s.agriStats) {
    const as = s.agriStats;
    const uLevel = URBANIZATION_LEVELS[as.urbanizationLevelId] || URBANIZATION_LEVELS[0];
    const farmlandPct = as.farmlandRedline > 0 ? clamp(Math.round(as.farmlandArea / as.farmlandRedline * 100), 0, 999) : 100;
    const redlineOk = as.farmlandArea >= as.farmlandRedline;
    html += statSection('农业与城镇化', ICON.treeStat, [
      statRowWithBar('第一产业占比', (as.primaryRatio * 100).toFixed(1) + '%', as.primaryRatio < 0.3 ? 'good' : 'warn', as.primaryRatio * 100, 'var(--green)', ICON.leafStat),
      statRowWithBar('第二产业占比', (as.secondaryRatio * 100).toFixed(1) + '%', '', as.secondaryRatio * 100, 'var(--accent)', ICON.building2),
    ]);
    // v2.4.3c: 第二产业明细折叠面板（放在第二产业占比和第三产业占比之间）
    if (s.isResourceCity) {
      let secDetailHtml = '';
      const miningPct = ((as.miningRatio || 0) * 100).toFixed(1);
      const manuPct = ((as.manufacturingRatio || 0) * 100).toFixed(1);
      secDetailHtml += statRowWithBar('工矿业占比', miningPct + '%', (as.miningRatio || 0) > 0.5 ? 'warn' : '', (as.miningRatio || 0) * 100, 'var(--orange)', ICON.building2);
      secDetailHtml += statRowWithBar('制造业占比', manuPct + '%', '', (as.manufacturingRatio || 0) * 100, 'var(--accent)', ICON.building2);
      html += `<div class="stats-section" style="margin-left:12px;">
        <h3 style="cursor:pointer;user-select:none;font-size:12px;" onclick="toggleSecondaryDetail()">
          ${ICON.building2}第二产业明细
          <span id="secondary-chevron" style="margin-left:auto;transition:transform 0.2s;display:inline-flex;">${ICON.chevronDown}</span>
        </h3>
        <div id="secondary-detail" style="display:none;">${secDetailHtml}</div>
      </div>`;
    }
    html += `<div class="stats-section">`;
    html += statRowWithBar('第三产业占比', (as.tertiaryRatio * 100).toFixed(1) + '%', as.tertiaryRatio >= 0.5 ? 'good' : '', as.tertiaryRatio * 100, 'var(--purple)', ICON.briefcase);
    html += statRowWithBar('城镇化率', (as.urbanizationRatio * 100).toFixed(1) + '%', as.urbanizationRatio >= 0.6 ? 'good' : as.urbanizationRatio >= 0.3 ? 'warn' : '', as.urbanizationRatio * 100, 'var(--accent)', ICON.users);
    html += statRowWithIcon('城市化等级', uLevel.name + '（' + uLevel.desc + '）', '', ICON.medal);
    html += statRowWithBar('耕地面积', as.farmlandArea + ' 格 / 红线 ' + as.farmlandRedline + ' 格', redlineOk ? 'good' : 'bad', farmlandPct, redlineOk ? 'var(--green)' : 'var(--red)', ICON.treeStat);
    html += statRowWithIcon('耕地红线比例', (as.farmlandRedlineRatio * 100).toFixed(0) + '%', '', ICON.shieldStat);
    html += statRowWithIcon('违规月数', as.belowRedlineMonths + ' 月', as.belowRedlineMonths === 0 ? 'good' : 'bad', ICON.alert);
    html += `</div>`;
  }
  // v2.4.3: 资源型城市面板
  if (s.isResourceCity) {
    const depLevel = s.resourceDependency || 0;
    const depCls = depLevel > 30 ? 'bad' : depLevel > 15 ? 'warn' : 'good';
    const depColor = depLevel > 30 ? 'var(--red)' : depLevel > 15 ? 'var(--orange)' : 'var(--green)';
    // 矿区产量明细
    let mineRows = [];
    if (s.mineralZones && s.mineralZones.length > 0) {
      for (const mz of s.mineralZones) {
        const prodPct = Math.round(mz.production / mz.maxProduction * 100);
        const prodCls = prodPct < 30 ? 'bad' : prodPct < 60 ? 'warn' : 'good';
        const prodColor = prodPct < 30 ? 'var(--red)' : prodPct < 60 ? 'var(--orange)' : 'var(--green)';
        const statusText = mz.depleted ? '（已枯竭）' : '';
        mineRows.push(statRowWithBar(mz.name + statusText, prodPct + '%', prodCls, prodPct, prodColor, ICON.building2));
      }
    }
    html += statSection('矿产资源', ICON.chart, [
      statRowWithBar('资源依赖度', depLevel + '%', depCls, depLevel, depColor, ICON.chart),
      ...mineRows,
    ]);
  }
  // v2.4.3b: 移除数据面板中的资源枯竭型城市提示和提级巡视提示（改为通过事件和报纸联动）
  html += statSection('环境质量', ICON.leafStat, [
    statRowWithBar('空气质量 (GB3095)', `${s.airQuality.toFixed(0)} (${airLevel})`, s.airQuality <= 100 ? 'good' : s.airQuality <= 150 ? 'warn' : 'bad', clamp(100 - s.airQuality / 5, 0, 100), s.airQuality <= 50 ? 'var(--green)' : s.airQuality <= 100 ? 'var(--orange)' : 'var(--red)', ICON.windStat),
    statRowWithBar('水质 (GB3838)', `${s.waterQuality.toFixed(0)} (${waterLevel})`, s.waterQuality >= 60 ? 'good' : s.waterQuality >= 30 ? 'warn' : 'bad', s.waterQuality, 'var(--accent)', ICON.dropStat),
    statRowWithBar('绿化覆盖率', s.greenCoverage.toFixed(1) + '%', s.greenCoverage >= 30 ? 'good' : s.greenCoverage >= 15 ? 'warn' : 'bad', Math.min(s.greenCoverage * 2, 100), 'var(--green)', ICON.treeStat),
    statRowWithIcon('噪声水平', `${s.noiseLevel.toFixed(0)}dB`, s.noiseLevel <= 55 ? 'good' : s.noiseLevel <= 65 ? 'warn' : 'bad', ICON.noise),
  ]);
  // v2.2.4: 车流统计
  if (typeof getTrafficStatusText === 'function') {
    const tStatus = getTrafficStatusText();
    if (typeof tStatus === 'object') {
      const tCls = tStatus.level === 0 ? 'good' : tStatus.level === 1 ? 'warn' : 'bad';
      html += statSection('交通状况', ICON.carStat, [
        statRowWithIcon('拥堵程度', tStatus.text, tCls, ICON.carStat),
        statRowWithIcon('平均车速', (tStatus.speed * 100).toFixed(0) + '%', tStatus.speed > 0.6 ? 'good' : tStatus.speed > 0.3 ? 'warn' : 'bad', ICON.trendingUp),
      ]);
      // v2.2.5c: 公共交通统计
      const tShare = (gameState.trafficStats && gameState.trafficStats.transitShare) || 0;
      const tOpCost = gameState.transitOpCost || 0;
      const tRevenue = gameState.transitRevenue || 0;
      html += statSection('公共交通', ICON.trainStat, [
        statRowWithIcon('客流分流', (tShare * 100).toFixed(0) + '%', tShare > 0.2 ? 'good' : tShare > 0 ? 'warn' : 'bad', ICON.trendingUp),
        statRowWithIcon('月运营成本', '¥' + tOpCost.toFixed(0) + '万', tOpCost > 0 ? 'bad' : 'good', ICON.coins),
        statRowWithIcon('月票务收入', '¥' + tRevenue.toFixed(0) + '万', 'good', ICON.coins),
      ]);
    }
  }
  html += statSection('社会福利', ICON.heart, [
    statRowWithBar('教育指数', s.educationIndex.toFixed(0) + '/100', s.educationIndex >= 60 ? 'good' : s.educationIndex >= 30 ? 'warn' : 'bad', s.educationIndex, 'var(--purple)', ICON.book),
    statRowWithBar('医疗指数', s.healthcareIndex.toFixed(0) + '/100', s.healthcareIndex >= 60 ? 'good' : s.healthcareIndex >= 30 ? 'warn' : 'bad', s.healthcareIndex, 'var(--red)', ICON.crossStat),
    statRowWithBar('治安指数', s.publicSafety.toFixed(0) + '/100', s.publicSafety >= 60 ? 'good' : s.publicSafety >= 30 ? 'warn' : 'bad', s.publicSafety, 'var(--orange)', ICON.shieldStat),
    statRowWithBar('市民满意度', s.happiness.toFixed(0) + '/100', s.happiness >= 60 ? 'good' : s.happiness >= 30 ? 'warn' : 'bad', s.happiness, 'var(--green)', ICON.heart),
  ]);
  html += statSection('政治指标', ICON.medal, [
    statRowWithBar('政治声誉', s.reputation.toFixed(0) + '/100', s.reputation >= 60 ? 'good' : s.reputation >= 30 ? 'warn' : 'bad', s.reputation, 'var(--accent)', ICON.star),
    statRowWithBar('腐败程度', s.corruption.toFixed(0) + '/100', s.corruption < 20 ? 'good' : s.corruption < 50 ? 'warn' : 'bad', s.corruption, 'var(--red)', ICON.alert),
    statRowWithBar('纪委关注度', s.inspectionRisk.toFixed(0) + '/100', s.inspectionRisk < 30 ? 'good' : s.inspectionRisk < 60 ? 'warn' : 'bad', s.inspectionRisk, 'var(--orange)', ICON.eye),
    statRowWithIcon('任内政绩', s.merit.toFixed(0), '', ICON.award),
  ]);
  // v2.3.6c: 处分期提示
  if ((s.noPromotionUntil || 0) > s.turn) {
    const banRemain = s.noPromotionUntil - s.turn;
    html += `<div style="margin-top:8px;padding:8px;background:rgba(196,69,54,0.1);border:1px solid var(--red);border-radius:var(--radius-xs);font-size:13px;color:var(--red);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;opacity:0.8;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> 处分期未满：剩余 ${banRemain} 个月，处分期内不得提拔任用。</div>`;
  }
  // v2.3.7: 提级巡视提示
  if ((s.inspectionLockdown || 0) > 0) {
    html += `<div style="margin-top:8px;padding:8px;background:rgba(196,69,54,0.15);border:1px solid var(--red);border-radius:var(--radius-xs);font-size:13px;color:var(--red);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:4px;opacity:0.8;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>提级巡视进行中：剩余 ${s.inspectionLockdown} 个月，政务和个人事务页面已锁定，纪委风险持续增加。</div>`;
  }
  return html;
}

function statSection(title, icon, rows) { return `<div class="stats-section"><h3>${icon || ''}${title}</h3>${rows.join('')}</div>`; }
// v2.2.7d: 财政支出折叠展开/收起
function toggleExpenseDetail() {
  const detail = document.getElementById('expense-detail');
  const chevron = document.getElementById('expense-chevron');
  if (!detail) return;
  const isHidden = detail.style.display === 'none';
  detail.style.display = isHidden ? 'block' : 'none';
  if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
}
// v2.4.3: 第二产业明细折叠展开/收起
function toggleSecondaryDetail() {
  const detail = document.getElementById('secondary-detail');
  const chevron = document.getElementById('secondary-chevron');
  if (!detail) return;
  const isHidden = detail.style.display === 'none';
  detail.style.display = isHidden ? 'block' : 'none';
  if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
}
function statRow(label, val, cls) { return `<div class="stat-row"><span class="sr-label">${label}</span><span class="sr-val ${cls}">${val}</span></div>`; }
function statRowWithIcon(label, val, cls, icon) { return `<div class="stat-row"><span class="sr-label">${icon || ''}${label}</span><span class="sr-val ${cls}">${val}</span></div>`; }
function statRowWithBar(label, val, cls, pct, color, icon) {
  return `<div class="stat-row" style="flex-direction:column;align-items:stretch;">
    <div style="display:flex;justify-content:space-between;"><span class="sr-label">${icon || ''}${label}</span><span class="sr-val ${cls}">${val}</span></div>
    <div class="stat-bar"><div class="fill" style="width:${pct}%;background:${color};"></div></div>
  </div>`;
}

// ============== 需求（不变） ==============
function renderDemandTab() {
  const s = gameState;
  let agg = { pop: 0, jobs: 0, powerProd: 0, powerCons: 0, waterProd: 0, waterCons: 0, airPol: 0, waterPol: 0, sewageCap: 0, wasteCap: 0, housing: 0, commerce: 0, industry: 0 };
  for (const b of s.buildings) {
    const def = BUILDING_TYPES[b.type]; if (!def) continue;
    const e = def.eff;
    agg.pop += e.pop || 0; agg.jobs += e.jobs || 0;
    if ((e.power || 0) > 0) agg.powerProd += e.power; else agg.powerCons += Math.abs(e.power || 0);
    if ((e.water || 0) > 0) agg.waterProd += e.water; else agg.waterCons += Math.abs(e.water || 0);
    if (b.type === 'sewagePlant' || b.type === 'ecoWetland') agg.sewageCap += Math.abs(e.waterPol || 0) * 10;
    if (b.type === 'wastePlant') agg.wasteCap += Math.abs(e.airPol || 0) * 5;
    if (b.type === 'wasteIncinerator') agg.wasteCap += (e.wasteCap || 0);
    if (def.cat === 'residential') agg.housing += e.pop || 0;
    if (def.cat === 'commercial') agg.commerce += e.jobs || 0;
    if (def.cat === 'industrial' || def.cat === 'hazardous') agg.industry += e.jobs || 0;
  }
  const netPower = agg.powerProd - agg.powerCons;
  const netWater = agg.waterProd - agg.waterCons;
  const popDemand = Math.max(0, s.population - agg.housing);
  const jobDemand = Math.max(0, s.population * 0.55 - agg.jobs);
  const commerceDemand = Math.max(0, s.population * 0.2 - agg.commerce);
  const industryDemand = Math.max(0, s.population * 0.15 - agg.industry);
  const powerDemand = Math.max(0, agg.pop * 0.05 + agg.jobs * 0.03 + s.buildings.length * 2 - netPower);
  const waterDemand = Math.max(0, agg.pop * 0.03 + agg.jobs * 0.02 + s.buildings.length * 1.5 - netWater);
  const sewageDemand = Math.max(0, s.population * 0.01 - agg.sewageCap);
  const wasteDemand = Math.max(0, s.population * 0.005 - agg.wasteCap);

  function demandBar(label, current, demand, icon, color, detail) {
    const total = current + demand;
    const ratio = total > 0 ? Math.min(100, (current / total) * 100) : 100;
    const status = demand > current * 0.5 ? 'bad' : demand > 0 ? 'warn' : 'good';
    const statusText = demand > current * 0.5 ? '严重不足' : demand > 0 ? '不足' : '充足';
    return `<div class="stat-row" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="sr-label" style="display:flex;align-items:center;gap:6px;">
          <span style="width:22px;height:22px;border-radius:6px;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:white;">${icon}</span>${label}
        </span>
        <span class="sr-val ${status}">${statusText}</span>
      </div>
      <div class="stat-bar"><div class="fill" style="width:${ratio}%;background:${color};"></div></div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${detail || `总需求: ${Math.round(total).toLocaleString()} / 当前供给: ${Math.round(current).toLocaleString()}`}</div>
    </div>`;
  }

  let html = '';
  html += statSection('住房与就业需求', ICON.users, [
    demandBar('住宅容量', agg.housing, popDemand, ICON.homeStat, 'var(--green)'),
    demandBar('就业岗位', agg.jobs, jobDemand, ICON.briefcase, 'var(--accent)'),
  ]);
  html += statSection('产业需求', ICON.factoryStat, [
    demandBar('商业岗位', agg.commerce, commerceDemand, ICON.storeStat, 'var(--yellow)'),
    demandBar('工业岗位', agg.industry, industryDemand, ICON.industry, 'var(--orange)'),
  ]);
  html += statSection('基础设施需求', ICON.wrench, [
    demandBar('电力供给', Math.max(0, netPower), powerDemand, ICON.bolt, 'var(--yellow)', `发电: ${agg.powerProd} / 用电: ${agg.powerCons} / 净供给: ${Math.max(0, netPower)} / 需求: ${Math.round(powerDemand + Math.max(0, netPower)).toLocaleString()}`),
    demandBar('供水能力', Math.max(0, netWater), waterDemand, ICON.dropStat, 'var(--accent)', `产水: ${agg.waterProd} / 用水: ${agg.waterCons} / 净供给: ${Math.max(0, netWater)} / 需求: ${Math.round(waterDemand + Math.max(0, netWater)).toLocaleString()}`),
    demandBar('污水处理能力', agg.sewageCap, sewageDemand, ICON.filter, 'var(--green)'),
    demandBar('垃圾处理能力', agg.wasteCap, wasteDemand, ICON.recycle, 'var(--orange)'),
  ]);
  const totalDemand = popDemand + jobDemand + powerDemand + waterDemand + sewageDemand + wasteDemand;
  if (totalDemand > 0) {
    html += `<div class="stats-section" style="background:var(--orange-light);border-radius:12px;padding:12px;margin-top:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="inline-icon" style="color:var(--orange);">${ICON.alert}</div>
        <div><div style="font-weight:600;color:var(--orange);font-size:14px;">城市需求未满足</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:2px;">请增加对应类型的建筑以提升市民满意度</div></div>
      </div></div>`;
  } else {
    html += `<div class="stats-section" style="background:var(--green-light);border-radius:12px;padding:12px;margin-top:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="color:var(--green);">${ICON.check}</div>
        <div><div style="font-weight:600;color:var(--green);font-size:14px;">城市需求基本满足</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:2px;">各项指标运行良好，市民满意度持续提升</div></div>
      </div></div>`;
  }
  return html;
}

// ============== 政策（子菜单折叠分组） ==============
function renderPolicyTab() {
  const fiscalIcons = { propertyTax: ICON.homeStat, businessTax: ICON.storeStat, incomeTax: ICON.user, eduBudget: ICON.book, healthBudget: ICON.crossStat, infraBudget: ICON.wrench, envRegulation: ICON.leafStat, landPrice: ICON.map };
  const macroIcons = { housingSubsidy: ICON.homeStat, bizSubsidy: ICON.gift, interestRate: ICON.percent, bankReserve: ICON.bank, greenBond: ICON.leafStat, consumerVoucher: ICON.megaphone, talentIncentive: ICON.handshake, mortgageRate: ICON.homeStat };
  // v2.2.5c: 公共交通政策图标
  const transitIcons = { transitFare: ICON.coins, transitInterval: ICON.clock, transitSubsidy: ICON.gift };
  // v2.4.3: 资源政策图标
  const resourceIcons = { miningIntensity: ICON.chart, transformationFunding: ICON.building2, envRestoration: ICON.leafStat };

  // 分组定义
  const groups = [
    { id: 'fiscal', name: '财政政策', icon: ICON.coins, items: POLICY_OPTIONS.filter(o => ['propertyTax','businessTax','incomeTax'].includes(o.id)) },
    { id: 'budget', name: '公共预算', icon: ICON.chart, items: POLICY_OPTIONS.filter(o => ['eduBudget','healthBudget','infraBudget'].includes(o.id)) },
    { id: 'land', name: '土地与环境', icon: ICON.treeStat, items: POLICY_OPTIONS.filter(o => ['landPrice','envRegulation'].includes(o.id)) },
    { id: 'monetary', name: '货币与金融', icon: ICON.bank, items: MACRO_POLICY_OPTIONS.filter(o => ['interestRate','bankReserve','greenBond','mortgageRate'].includes(o.id)) },
    { id: 'welfare', name: '社会福利', icon: ICON.heart, items: MACRO_POLICY_OPTIONS.filter(o => ['housingSubsidy','bizSubsidy','consumerVoucher','talentIncentive'].includes(o.id)) },
    // v2.2.5c: 公共交通政策组
    { id: 'transit', name: '公共交通', icon: ICON.carStat, items: MACRO_POLICY_OPTIONS.filter(o => ['transitFare','transitInterval','transitSubsidy'].includes(o.id)) },
    // v2.4.3: 资源政策组（仅资源型城市显示）
    ...(gameState.isResourceCity ? [{ id: 'resource', name: '资源管理', icon: ICON.chart, items: MACRO_POLICY_OPTIONS.filter(o => ['miningIntensity','transformationFunding','envRestoration'].includes(o.id)) }] : []),
  ];

  let html = '<p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">调整税率与预算分配，影响财政收入和公共服务质量。点击分组展开。</p>';

  for (const grp of groups) {
    html += `<div class="policy-group">
      <div class="policy-group-header" onclick="togglePolicyGroup('${grp.id}', this)">
        ${grp.icon}<span>${grp.name}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div class="policy-group-body" id="pg-body-${grp.id}">`;
    for (const opt of grp.items) {
      const v = gameState.policies[opt.id] !== undefined ? gameState.policies[opt.id] : opt.default;
      const pIcon = (fiscalIcons[opt.id] || macroIcons[opt.id] || transitIcons[opt.id] || resourceIcons[opt.id] || ICON.percent);
      html += `<div class="policy-card">
        <div class="pc-title">${pIcon}${opt.name}</div>
        <div class="pc-desc">${opt.desc}</div>
        <div class="pc-control">
          <input type="range" id="policy-${opt.id}" min="${opt.min}" max="${opt.max}" step="${opt.step}" value="${v}" oninput="document.getElementById('pv-${opt.id}').textContent=this.value+'${opt.unit}'">
          <span class="pc-value" id="pv-${opt.id}">${v}${opt.unit}</span>
        </div>
      </div>`;
    }
    html += '</div></div>';
  }

  html += `<button class="start-btn primary" style="width:100%;margin-top:8px;" onclick="applyAllPolicies()">${ICON.check}<span>确认全部调整</span></button>`;
  return html;
}

function togglePolicyGroup(groupId, headerEl) {
  const body = document.getElementById('pg-body-' + groupId);
  if (!body) return;
  const isOpen = body.classList.toggle('open');
  headerEl.classList.toggle('open', isOpen);
}

// ============== 政务（合并人事/工程/工商/申报/权力） ==============
let _govSubTab = 'personnel';
function renderGovTab() {
  // v2.4.0: 提级巡视期间锁定整个政务页面，显示锁定提示
  if ((gameState.inspectionLockdown || 0) > 0) {
    let html = `<div class="stats-section"><h3>政务管理</h3>`;
    html += `<div style="text-align:center;padding:40px 20px;">`;
    html += `<div style="width:48px;height:48px;margin:0 auto 16px;border-radius:50%;background:rgba(196,69,54,0.15);display:flex;align-items:center;justify-content:center;">`;
    html += `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    html += `</div>`;
    html += `<p style="font-size:15px;color:var(--red);font-weight:600;margin-bottom:8px;">提级巡视进行中</p>`;
    html += `<p style="font-size:13px;color:var(--text-3);line-height:1.8;">上级纪委巡视组已进驻，政务管理工作暂停。</p>`;
    html += `<p style="font-size:13px;color:var(--text-3);line-height:1.8;">剩余锁定时间：${gameState.inspectionLockdown}个月</p>`;
    html += `<p style="font-size:12px;color:var(--text-3);margin-top:12px;">巡视结束后自动恢复。</p>`;
    html += `</div></div>`;
    return html;
  }
  const subs = [
    { id: 'personnel', name: '人事' },
    { id: 'construction', name: '工程' },
    { id: 'invest', name: '工商' },
    { id: 'apply', name: '申报' },
    { id: 'power', name: '权力' },
  ];
  let html = '<div class="gov-subnav">';
  for (const sub of subs) {
    html += `<button class="gov-subnav-btn ${_govSubTab === sub.id ? 'active' : ''}" onclick="_govSubTab='${sub.id}';renderSheet('gov');">${sub.name}</button>`;
  }
  html += '</div>';
  switch (_govSubTab) {
    case 'personnel': html += renderPersonnelTab(); break;
    case 'construction': html += renderConstructionTab(); break;
    case 'invest': html += renderInvestTab(); break;
    case 'apply': html += renderApplyTab(); break;
    case 'power': html += renderPowerTab(); break;
  }
  return html;
}

// ============== 个人事务（合并资产+学历+角色状态） ==============
let _personalSubTab = 'status';
function renderPersonalTab() {
  const s = gameState;
  const lv = getCityLevel();

  // 角色状态
  const stockValue = s.privateAssets.stocks.reduce((sum, st) => sum + st.shares * st.currentPrice, 0);
  const landValue = s.privateAssets.land.reduce((sum, l) => sum + l.currentValue, 0);
  const projectValue = s.privateAssets.projects.reduce((sum, p) => sum + p.investment, 0);
  const villaValue = s.privateAssets.villas.reduce((sum, v) => sum + v.value, 0);
  const totalAssets = s.privateAccount + stockValue + landValue + projectValue + villaValue;
  const degreeDisplay = s.playerDegree ? (s.degreeFake ? `${s.playerDegree}（伪造）` : s.playerDegree) : '无学历';

  let html = `<div class="personal-status">
    <div class="ps-item"><div class="ps-val">${s.playerName}</div><div class="ps-label">角色</div></div>
    <div class="ps-item"><div class="ps-val" style="color:var(--accent);">${getOfficialTitle()}</div><div class="ps-label">职务</div></div>
    <div class="ps-item"><div class="ps-val" style="color:${s.playerDegree ? 'var(--accent)' : 'var(--text-3)'};">${degreeDisplay}</div><div class="ps-label">学历</div></div>
    <div class="ps-item"><div class="ps-val" style="color:var(--green);">¥${formatMoney(s.privateAccount * 10000)}</div><div class="ps-label">私人账户</div></div>
    <div class="ps-item"><div class="ps-val" style="color:var(--accent);">¥${formatMoney(totalAssets * 10000)}</div><div class="ps-label">总资产</div></div>
    <div class="ps-item"><div class="ps-val" style="color:${s.inspectionRisk > 40 ? 'var(--red)' : 'var(--green)'};">${s.inspectionRisk.toFixed(0)}</div><div class="ps-label">纪委风险</div></div>
  </div>`;

  // 子导航
  html += '<div class="gov-subnav">';
  html += `<button class="gov-subnav-btn ${_personalSubTab === 'status' ? 'active' : ''}" onclick="_personalSubTab='status';renderSheet('personal');">资产管理</button>`;
  html += `<button class="gov-subnav-btn ${_personalSubTab === 'degree' ? 'active' : ''}" onclick="_personalSubTab='degree';renderSheet('personal');">学历管理</button>`;
  // v2.2.4c: 秘书管理移至个人事务
  if (gameState.cityLevelId >= 1 && gameState.personnel) {
    html += `<button class="gov-subnav-btn ${_personalSubTab === 'secretary' ? 'active' : ''}" onclick="_personalSubTab='secretary';renderSheet('personal');">秘书管理</button>`;
  }
  html += '</div>';

  if (_personalSubTab === 'status') {
    html += renderPrivateTab();
  } else if (_personalSubTab === 'secretary') {
    html += renderSecretaryTab();
  } else {
    html += renderDegreeTab();
  }
  return html;
}

// v2.2.4c: 秘书管理面板（移至个人事务，不显示具体加成数值）
function renderSecretaryTab() {
  const ps = gameState.personnel;
  if (!ps) return '<div style="padding:12px;color:var(--text-3);font-size:13px;">人事系统尚未解锁</div>';
  let html = '<div class="stats-section"><h3>秘书管理</h3>';
  html += '<p style="font-size:12px;color:var(--text-3);margin-bottom:10px;">秘书可协助处理日常事务，根据其能力与任职时间提供政绩和GDP加成。新招录的干部担任秘书可同步培养。</p>';

  if (ps.secretary) {
    const sec = ps.officials.find(o => o.id === ps.secretary);
    if (sec) {
      const fdef = sec.faction ? FACTIONS[sec.faction] : null;
      const factionTag = fdef
        ? `<span class="prs-faction-tag" style="background:${fdef.color};">${fdef.name}</span>`
        : `<span class="prs-faction-tag" style="background:var(--separator);color:var(--text-3);">无派系</span>`;
      const recruitedTag = sec.recruited ? '<span style="font-size:10px;color:var(--green);">★嫡系</span>' : '';
      html += `<div class="prs-pool-item" style="flex-wrap:wrap;">`;
      html += `${factionTag}${recruitedTag}`;
      html += `<span class="prs-official-name">${sec.name}</span>`;
      html += `<span class="prs-official-stats">${sec.age}岁 ${getOfficialEvaluation(sec)} 在职${sec.tenureMonths || 0}月</span>`;
      html += `</div>`;
      html += `<div style="font-size:11px;color:var(--text-3);padding:6px 8px;margin-bottom:8px;">当前秘书提供政绩与GDP加成，加成效果随其能力与任职时间提升。</div>`;
      html += `<button class="prs-btn prs-btn-dismiss" onclick="dismissSecretary()">免去秘书</button>`;
    } else {
      ps.secretary = null;
      html += '<div class="prs-empty" style="padding:8px;">秘书已离任</div>';
      html += `<button class="prs-btn prs-btn-appoint" onclick="showSecretaryDialog()">任命秘书</button>`;
    }
  } else {
    html += '<div class="prs-empty" style="padding:8px;">尚未任命秘书</div>';
    html += `<button class="prs-btn prs-btn-appoint" onclick="showSecretaryDialog()">任命秘书</button>`;
  }
  html += '</div>';

  // v2.3.6: 个人企业代持管理
  const personalCompanies = gameState.personalCompanies || [];
  if (personalCompanies.length > 0) {
    html += '<div class="stats-section" style="margin-top:12px;">';
    html += '<h3>个人企业管理</h3>';
    html += '<p style="font-size:12px;color:var(--text-3);margin-bottom:10px;">可将个人企业交由嫡系干部代持。代持人能力影响企业利润。</p>';
    for (const pc of personalCompanies) {
      const holder = pc.heldBy ? ps.officials.find(o => o.id === pc.heldBy) : null;
      const holderTag = holder
        ? `<span style="font-size:11px;color:var(--accent);">代持：${holder.name}${holder.recruited ? ' ★嫡系' : ''}</span>`
        : '<span style="font-size:11px;color:var(--text-3);">未设代持</span>';
      const profitNote = holder
        ? `<span style="font-size:11px;color:var(--text-3);">月利润${Math.round(pc.monthlyProfit * (0.7 + (holder.competence - 3) * 0.1))}万</span>`
        : `<span style="font-size:11px;color:var(--text-3);">月利润${pc.monthlyProfit}万</span>`;
      html += `<div class="prs-pool-item" style="flex-wrap:wrap;justify-content:space-between;">`;
      html += `<div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">`;
      html += `<span class="prs-official-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pc.shortName || pc.name}</span>`;
      html += `${holderTag}`;
      html += `</div>`;
      html += `<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">`;
      html += `${profitNote}`;
      if (holder) {
        html += `<button class="prs-btn prs-btn-dismiss" style="font-size:11px;padding:4px 8px;" onclick="unassignCompanyHolder('${pc.id}')">收回</button>`;
      } else {
        html += `<button class="prs-btn prs-btn-appoint" style="font-size:11px;padding:4px 8px;" onclick="showAssignHolderDialog('${pc.id}')">指定代持</button>`;
      }
      html += `</div></div>`;
    }
    html += '</div>';
  }
  return html;
}

// v2.2.4c: 秘书任命对话框（统一CSS模板，不显示具体数值）
function showSecretaryDialog() {
  const ps = gameState.personnel;
  if (!ps) return;
  const available = ps.officials.filter(o => !Object.values(ps.appointments).includes(o.id) && o.id !== ps.secretary);
  let html = '<div style="font-size:12px;color:var(--text-3);margin-bottom:10px;">从待任用干部中选择一人为秘书。秘书将提供政绩与GDP加成，随能力与任职时间提升。</div>';
  if (available.length === 0) {
    html += '<div class="prs-empty" style="padding:8px;">暂无可用干部</div>';
  } else {
    for (const off of available) {
      const fdef = off.faction ? FACTIONS[off.faction] : null;
      const factionTag = fdef
        ? `<span class="prs-faction-tag" style="background:${fdef.color};">${fdef.name}</span>`
        : `<span class="prs-faction-tag" style="background:var(--separator);color:var(--text-3);">无派系</span>`;
      const recruitedTag = off.recruited ? '<span style="font-size:10px;color:var(--green);">★嫡系</span>' : '';
      // v2.3.7b: 固定按钮位置，防止文字挤压按钮换行
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--separator-light);">`;
      html += `<div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">`;
      html += `${factionTag}${recruitedTag}`;
      html += `<span style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;">${off.name}</span>`;
      html += `<span style="font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${off.age}岁 ${getOfficialEvaluation(off)}</span>`;
      html += `</div>`;
      html += `<div style="flex-shrink:0;"><button class="prs-btn prs-btn-appoint" onclick="appointSecretary('${off.id}')">任命</button></div>`;
      html += `</div>`;
    }
  }
  showModal('任命秘书', html, [{ text: '关闭', color: 'gray', action: closeModal }], '人事', 'info');
}

// v2.2.4c: 任命秘书（移至个人事务）
function appointSecretary(officialId) {
  const ps = gameState.personnel;
  if (!ps) return;
  const off = ps.officials.find(o => o.id === officialId);
  if (!off) { closeModal(); return; }
  ps.secretary = officialId;
  closeModal();
  showNotification(`已任命${off.name}为秘书`, 'success');
  logEvent(`人事任命：${off.name}任秘书`, 'info');
  renderSheet('personal');
}

// v2.2.4c: 免去秘书（移至个人事务）
function dismissSecretary() {
  const ps = gameState.personnel;
  if (!ps || !ps.secretary) return;
  const sec = ps.officials.find(o => o.id === ps.secretary);
  ps.secretary = null;
  if (sec) {
    showNotification(`已免去${sec.name}的秘书职务`, 'info');
    logEvent(`人事变动：免去${sec.name}的秘书职务`, 'info');
  }
  renderSheet('personal');
}

// v2.3.6: 指定代持人对话框
function showAssignHolderDialog(pcId) {
  const ps = gameState.personnel;
  if (!ps) return;
  const pc = (gameState.personalCompanies || []).find(c => c.id === pcId);
  if (!pc) { closeModal(); return; }
  // 优先显示嫡系干部，也可以选择其他干部
  const available = ps.officials.filter(o =>
    !Object.values(ps.appointments).includes(o.id) && o.id !== ps.secretary
  );
  let html = `<div style="font-size:12px;color:var(--text-3);margin-bottom:10px;">为「${pc.shortName || pc.name}」指定代持人。嫡系干部忠诚度更高。代持人能力影响企业利润。</div>`;
  if (available.length === 0) {
    html += '<div class="prs-empty" style="padding:8px;">暂无可用干部</div>';
  } else {
    // 按嫡系优先排序
    const sorted = [...available].sort((a, b) => (b.recruited ? 1 : 0) - (a.recruited ? 1 : 0));
    for (const off of sorted) {
      const fdef = off.faction ? FACTIONS[off.faction] : null;
      const factionTag = fdef
        ? `<span class="prs-faction-tag" style="background:${fdef.color};">${fdef.name}</span>`
        : `<span class="prs-faction-tag" style="background:var(--separator);color:var(--text-3);">无派系</span>`;
      const recruitedTag = off.recruited ? '<span style="font-size:10px;color:var(--green);">★嫡系</span>' : '';
      // v2.3.7b: 固定按钮位置
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--separator-light);">`;
      html += `<div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">`;
      html += `${factionTag}${recruitedTag}`;
      html += `<span style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;">${off.name}</span>`;
      html += `<span style="font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${off.age}岁 ${getOfficialEvaluation(off)}</span>`;
      html += `</div>`;
      html += `<div style="flex-shrink:0;"><button class="prs-btn prs-btn-appoint" onclick="assignCompanyHolder('${pc.id}','${off.id}')">代持</button></div>`;
      html += `</div>`;
    }
  }
  showModal('指定代持人', html, [{ text: '关闭', color: 'gray', action: closeModal }], '企业代持', 'info');
}

// v2.3.6: 指定代持
function assignCompanyHolder(pcId, officialId) {
  const ps = gameState.personnel;
  if (!ps) return;
  const pc = (gameState.personalCompanies || []).find(c => c.id === pcId);
  if (!pc) { closeModal(); return; }
  const off = ps.officials.find(o => o.id === officialId);
  if (!off) { closeModal(); return; }
  pc.heldBy = officialId;
  closeModal();
  showNotification(`已指定${off.name}代持「${pc.shortName || pc.name}」`, 'success');
  logEvent(`企业代持：${off.name}代持「${pc.shortName || pc.name}」`, 'info');
  renderSheet('personal');
}

// v2.3.6: 收回代持
function unassignCompanyHolder(pcId) {
  const pc = (gameState.personalCompanies || []).find(c => c.id === pcId);
  if (!pc) return;
  const ps = gameState.personnel;
  const holder = pc.heldBy && ps ? ps.officials.find(o => o.id === pc.heldBy) : null;
  pc.heldBy = null;
  if (holder) {
    showNotification(`已收回${holder.name}对「${pc.shortName || pc.name}」的代持`, 'info');
    logEvent(`收回代持：${holder.name}不再代持「${pc.shortName || pc.name}」`, 'info');
  }
  renderSheet('personal');
}

// ============== 保留所有原有渲染函数 ==============
// renderBuildTab 已在上面定义（用于建筑窗口）
// 以下函数从原文件完整保留，逻辑不变

function showBuildingDetail(id) {
  const b = BUILDING_TYPES[id]; if (!b) return;
  const e = b.eff;
  let effRows = '';
  const effList = [
    { key: 'pop', label: '容纳人口', val: e.pop, unit: '人', isGood: (v) => v >= 0 },
    { key: 'jobs', label: '就业岗位', val: e.jobs, unit: '个', isGood: (v) => v >= 0 },
    { key: 'gdp', label: 'GDP贡献', val: e.gdp, unit: '万/月', isGood: (v) => v >= 0 },
    { key: 'power', label: '电力', val: e.power, unit: '', isGood: (v) => v >= 0 },
    { key: 'water', label: '供水', val: e.water, unit: '', isGood: (v) => v >= 0 },
    { key: 'edu', label: '教育指数', val: e.edu, unit: '', isGood: (v) => v >= 0 },
    { key: 'health', label: '医疗指数', val: e.health, unit: '', isGood: (v) => v >= 0 },
    { key: 'safety', label: '治安指数', val: e.safety, unit: '', isGood: (v) => v >= 0 },
    { key: 'green', label: '绿化', val: e.green, unit: '', isGood: (v) => v >= 0 },
    { key: 'airPol', label: '空气污染', val: e.airPol, unit: '', isGood: (v) => v <= 0 },
    { key: 'waterPol', label: '水污染', val: e.waterPol, unit: '', isGood: (v) => v <= 0 },
    { key: 'happiness', label: '满意度', val: e.happiness, unit: '', isGood: (v) => v >= 0 },
    { key: 'noise', label: '噪音', val: e.noise, unit: '', isGood: (v) => v <= 0 },
  ];
  for (const eff of effList) {
    if (eff.val && eff.val !== 0) {
      const sign = eff.val > 0 ? '+' : '';
      const color = eff.isGood(eff.val) ? 'var(--green)' : 'var(--red)';
      effRows += `<div class="effect-item"><span class="eff-label">${eff.label}</span><span class="eff-val" style="color:${color};">${sign}${eff.val}${eff.unit}</span></div>`;
    }
  }
  if (!effRows) effRows = '<div class="effect-item"><span class="eff-label">无特殊效果</span></div>';
  const icon = BUILDING_ICONS[id] || ICON.building2;
  const body = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
    <div style="width:36px;height:36px;border-radius:8px;background:${b.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icon}</div>
    <div><div style="font-size:16px;font-weight:600;color:var(--text);">${b.name}</div><div style="font-size:12px;color:var(--text-3);">造价 ¥${b.cost}万</div></div>
  </div>
  <div style="font-size:13px;color:var(--text-2);margin-bottom:10px;line-height:1.5;">${b.desc || ''}</div>
  <div class="effect-list">${effRows}</div>`;
  showModal(`${b.name}`, body, [{ text: '关闭', color: 'blue', action: () => closeModal() }], '建筑详情', 'info');
}

function showPlacedBuildingDetail(buildingIdx) {
  const b = gameState.buildings[buildingIdx]; if (!b) return;
  const def = BUILDING_TYPES[b.type]; if (!def) return;
  const isPublic = PUBLIC_BUILDING_TYPES.includes(b.type);
  const level = b.level || 1;
  const levelCfg = BUILDING_LEVELS[level] || BUILDING_LEVELS[1];
  const effMult = levelCfg.effMult;
  const bName = b.customName || def.name;
  let body = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
    <div style="width:36px;height:36px;border-radius:8px;background:${def.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${BUILDING_ICONS[b.type] || ICON.building2}</div>
    <div><div style="font-size:16px;font-weight:600;color:var(--text);">${bName}</div>
    <div style="font-size:12px;color:var(--text-3);">${def.name}${isPublic ? ' · ' + levelCfg.name : ''} · 建成${b.age}个月</div></div>
  </div>`;
  if (isPublic) {
    body += `<div class="effect-list"><div class="effect-item"><span class="eff-label">建筑等级</span><span class="eff-val" style="color:var(--accent);">${levelCfg.name}（效果×${effMult}）</span></div>`;
    if (b.facilities && b.facilities.length > 0) {
      // v2.4.8b: 合并显示同名配套（如航站楼×3）
      const facCounts = {};
      for (const fId of b.facilities) facCounts[fId] = (facCounts[fId] || 0) + 1;
      body += `<div class="effect-item"><span class="eff-label">配套建筑</span><span class="eff-val" style="color:var(--green);">${Object.entries(facCounts).map(([fId, cnt]) => { const name = BUILDING_FACILITIES[b.type]?.find(x => x.id === fId)?.name || fId; return cnt > 1 ? `${name}×${cnt}` : name; }).join('、')}</span></div>`;
    }
    body += '</div>';
  }
  // v2.4.7c: 交通建筑专属信息展示
  if (b.type === 'airport') {
    // v2.4.7c: 使用新等级系统
    const apCls = getAirportClass(b.runways || b.runwayLength || 6);
    const runwayCount = apCls.runwayCount || 1;
    // 检查是否满足国际机场门槛
    const letterOrder = ['C', 'D', 'E', 'F'];
    const letterIdx = letterOrder.indexOf(apCls.letter || 'C');
    const reqLetterIdx = letterOrder.indexOf(INTERNATIONAL_AIRPORT_REQ.minLetter);
    const canApplyIntl = !b.isInternational && runwayCount >= INTERNATIONAL_AIRPORT_REQ.runwayCount && letterIdx >= reqLetterIdx;
    const intlBadge = b.isInternational
      ? '<span style="color:var(--green);font-weight:600;">国际机场</span>'
      : '<span style="color:var(--text-3);">国内机场</span>';
    body += `<div class="effect-list">`;
    body += `<div class="effect-item"><span class="eff-label">机场等级</span><span class="eff-val" style="color:var(--accent);">${apCls.code}级（${runwayCount}条跑道）</span></div>`;
    // v2.4.7c: 显示每条跑道信息
    if (b.runways && b.runways.length > 0) {
      for (let i = 0; i < b.runways.length; i++) {
        const r = b.runways[i];
        const rCls = getRunwayClass(r.length);
        body += `<div class="effect-item"><span class="eff-label">跑道${i+1}</span><span class="eff-val">${r.length}格 · ${rCls.letter}级 · ${r.direction === 'vertical' ? '纵向' : '横向'}</span></div>`;
      }
    } else {
      // 向后兼容旧存档
      body += `<div class="effect-item"><span class="eff-label">跑道长度</span><span class="eff-val">${b.runwayLength || 6}格</span></div>`;
    }
    body += `<div class="effect-item"><span class="eff-label">机场类型</span><span class="eff-val">${intlBadge}</span></div>`;
    if (typeof b.passengerFlow === 'number' && !isNaN(b.passengerFlow)) body += `<div class="effect-item"><span class="eff-label">旅客吞吐量</span><span class="eff-val">${Math.round(b.passengerFlow).toLocaleString()}人次/月</span></div>`;
    if (typeof b.tradeIncome === 'number' && !isNaN(b.tradeIncome)) body += `<div class="effect-item"><span class="eff-label">贸易收入</span><span class="eff-val" style="color:var(--green);">+¥${Math.round(b.tradeIncome)}万/月</span></div>`;
    body += `</div>`;
    // v2.4.8: 跑道需单独建设，提示玩家
    if (!b.runways || b.runways.length === 0) {
      body += `<div style="margin-top:8px;padding:8px;background:var(--bg-2);border-radius:6px;color:var(--text-3);font-size:0.85rem;">提示：请在公共交通面板选择"机场跑道"单独建设，跑道需建在航站楼附近5格内。</div>`;
    } else if (b.runways.length < 4) {
      body += `<div style="margin-top:8px;padding:8px;background:var(--bg-2);border-radius:6px;color:var(--text-3);font-size:0.85rem;">当前${b.runways.length}条跑道，可在公共交通面板继续建设跑道（最多4条）。</div>`;
    }
    // v2.4.8: 国际机场申报按钮
    // v2.5.0b: 驳回冷却期内显示等待提示
    if (canApplyIntl && gameState.intlAirportCooldown && gameState.intlAirportCooldown > gameState.turn) {
      const intlRemaining = gameState.intlAirportCooldown - gameState.turn;
      body += `<div style="margin-top:8px;padding:10px;background:var(--separator-light);border-radius:8px;text-align:center;color:var(--text-3);font-size:0.85rem;">国际机场申请被驳回，还需等待${intlRemaining}个月</div>`;
    } else if (canApplyIntl) {
      body += `<button class="start-btn primary" style="width:100%;margin-top:8px;" onclick="applyInternationalAirport(${buildingIdx})">${ICON.building2}<span>申报国际机场（¥2000万）</span></button>`;
    }
  } else if (b.type === 'railwayStation' || b.type === 'hsrStation') {
    const stGrade = b.stationGrade || getStationGrade(gameState.population).code;
    body += `<div class="effect-list">`;
    body += `<div class="effect-item"><span class="eff-label">车站等级</span><span class="eff-val" style="color:var(--accent);">${stGrade}</span></div>`;
    if (typeof b.passengerFlow === 'number' && !isNaN(b.passengerFlow)) body += `<div class="effect-item"><span class="eff-label">客流量</span><span class="eff-val">${Math.round(b.passengerFlow).toLocaleString()}人次/月</span></div>`;
    body += `</div>`;
  } else if (b.type === 'port') {
    body += `<div class="effect-list">`;
    if (typeof b.passengerFlow === 'number' && !isNaN(b.passengerFlow)) body += `<div class="effect-item"><span class="eff-label">客流量</span><span class="eff-val">${Math.round(b.passengerFlow).toLocaleString()}人次/月</span></div>`;
    body += `</div>`;
  }
  const e = def.eff;
  let effRows = '';
  const effList = [
    { label: '就业岗位', val: Math.round((e.jobs||0) * effMult), isGood: v => v >= 0 },
    { label: 'GDP贡献', val: Math.round((e.gdp||0) * effMult), isGood: v => v >= 0, unit: '万/月' },
    { label: '教育指数', val: Math.round((e.edu||0) * effMult), isGood: v => v >= 0 },
    { label: '医疗指数', val: Math.round((e.health||0) * effMult), isGood: v => v >= 0 },
    { label: '治安指数', val: Math.round((e.safety||0) * effMult), isGood: v => v >= 0 },
    { label: '满意度', val: Math.round((e.happiness||0) * effMult), isGood: v => v >= 0 },
  ];
  for (const eff of effList) {
    if (eff.val && eff.val !== 0) {
      const sign = eff.val > 0 ? '+' : '';
      const color = eff.isGood(eff.val) ? 'var(--green)' : 'var(--red)';
      effRows += `<div class="effect-item"><span class="eff-label">${eff.label}</span><span class="eff-val" style="color:${color};">${sign}${eff.val}${eff.unit||''}</span></div>`;
    }
  }
  if (effRows) body += `<div class="effect-list">${effRows}</div>`;
  const buttons = [{ text: '关闭', color: 'gray', action: closeModal }];
  if (isPublic) {
    if (level < 4) {
      const nextLevel = BUILDING_LEVELS[level + 1];
      const upgradeCost = Math.round(def.cost * nextLevel.upgradeCost);
      let upgradeHint = '';
      if (level === 3) {
        const allFacs = BUILDING_FACILITIES[b.type] || [];
        const builtFacs = b.facilities || [];
        // v2.4.8b: 考虑 maxCount — 配套需建满 maxCount 次才算完成
        const missing = allFacs.filter(f => builtFacs.filter(id => id === f.id).length < (f.maxCount || 1));
        if (missing.length > 0) upgradeHint = `（需先建齐配套：${missing.map(f => f.name).join('、')}）`;
      }
      buttons.unshift({ text: `升级到${nextLevel.name}(¥${upgradeCost}万)${upgradeHint}`, color: 'blue', action: () => upgradeBuilding(buildingIdx) });
    }
    // v2.4.8b: 考虑 maxCount — 航站楼可扩建多次
    const availableFacilities = (BUILDING_FACILITIES[b.type] || []).filter(f => (b.facilities || []).filter(id => id === f.id).length < (f.maxCount || 1));
    if (availableFacilities.length > 0) buttons.unshift({ text: '扩建配套', color: 'green', action: () => showFacilityModal(buildingIdx) });
    // v2.5.0: 高铁站/火车站/机场不允许建设分校
    const _noBranchTypes = ['railwayStation', 'hsrStation', 'airport'];
    if (level >= 2 && !b.branchOf && !_noBranchTypes.includes(b.type)) buttons.unshift({ text: '建设分校/分院', color: 'yellow', action: () => createBranch(buildingIdx) });
  }
  showModal(bName, body, buttons, isPublic ? '公共建筑' : '建筑详情', 'info');
}

function upgradeBuilding(buildingIdx) {
  const b = gameState.buildings[buildingIdx]; if (!b) return;
  const def = BUILDING_TYPES[b.type];
  const currentLevel = b.level || 1;
  if (currentLevel >= 4) { showNotification('已达最高等级', 'info'); return; }
  const nextLevel = BUILDING_LEVELS[currentLevel + 1];
  const cost = Math.round(def.cost * nextLevel.upgradeCost);
  if (gameState.treasury < cost) { showNotification(`财政不足，升级需要¥${cost}万`, 'danger'); return; }
  const reqBuildings = nextLevel.upgradeReqBuildings;
  const hasReqs = reqBuildings.every(rt => gameState.buildings.some(bd => bd.type === rt));
  if (!hasReqs) { showNotification(`升级需要以下配套建筑：${reqBuildings.map(rt => BUILDING_TYPES[rt]?.name || rt).join('、')}`, 'warn'); return; }
  if (currentLevel === 3) {
    const allFacs = BUILDING_FACILITIES[b.type] || [];
    const builtFacs = b.facilities || [];
    // v2.4.8b: 考虑 maxCount — 配套需建满 maxCount 次才算完成
    const missingFacs = allFacs.filter(f => builtFacs.filter(id => id === f.id).length < (f.maxCount || 1));
    if (missingFacs.length > 0) { showNotification(`升级四级需要先建齐所有配套：${missingFacs.map(f => f.name).join('、')}`, 'warn'); return; }
  }
  gameState.treasury -= cost;
  b.level = currentLevel + 1;
  // v2.4.3c: 修复分校升级显示"第0学校"bug — 分校保持原有名称不变
  if (!b.branchOf) {
    const sameTypeMain = gameState.buildings.filter(bd => bd.type === b.type && !bd.branchOf);
    const sameTypeCount = sameTypeMain.indexOf(b);
    b.customName = generatePublicBuildingName(b.type, b.level, sameTypeCount, gameState.cityName, gameState.cityLevelId);
  }
  closeModal();
  showNotification(`${b.customName}升级为${BUILDING_LEVELS[b.level].name}`, 'success');
  logEvent(`${b.customName}升级为${BUILDING_LEVELS[b.level].name}（-¥${cost}万）`, 'success');
  updateUI(); renderMap();
  showPlacedBuildingDetail(buildingIdx);
}

function showFacilityModal(buildingIdx) {
  const b = gameState.buildings[buildingIdx]; if (!b) return;
  const facilities = BUILDING_FACILITIES[b.type] || [];
  // v2.4.8b: 考虑 maxCount — 航站楼可扩建多次
  const available = facilities.filter(f => (b.facilities || []).filter(id => id === f.id).length < (f.maxCount || 1));
  if (available.length === 0) { showNotification('已建满所有配套', 'info'); return; }
  let body = '<div class="effect-list">';
  for (const f of available) {
    // v2.4.8b: 显示已建数量/最大数量
    const builtCount = (b.facilities || []).filter(id => id === f.id).length;
    const maxCount = f.maxCount || 1;
    const countInfo = maxCount > 1 ? ` (已建${builtCount}/${maxCount})` : '';
    body += `<div class="effect-item" style="cursor:pointer;padding:8px;border:1px solid var(--separator);border-radius:6px;margin-bottom:6px;" onclick="addFacility(${buildingIdx}, '${f.id}')"><span class="eff-label" style="font-weight:600;">${f.name}${countInfo}（¥${f.cost}万）</span></div>`;
    body += `<div style="font-size:12px;color:var(--text-3);margin-bottom:6px;padding-left:4px;">${f.desc}</div>`;
  }
  body += '</div>';
  showModal('选择扩建项目', body, [{ text: '关闭', color: 'gray', action: closeModal }], '扩建', 'info');
}

function addFacility(buildingIdx, facilityId) {
  const b = gameState.buildings[buildingIdx]; if (!b) return;
  const f = (BUILDING_FACILITIES[b.type] || []).find(x => x.id === facilityId);
  if (!f) return;
  if (gameState.treasury < f.cost) { showNotification(`财政不足，需要¥${f.cost}万`, 'danger'); return; }
  closeModal();
  showNotification(`请在地图上选择${b.customName||'该建筑'}2格内的地块扩建${f.name}`, 'info');
  gameState._facilityBuildingIdx = buildingIdx;
  gameState._facilityId = facilityId;
  gameState.selectedTool = 'placeFacility';
}

function commitFacility(targetIdx) {
  const buildingIdx = gameState._facilityBuildingIdx; const facilityId = gameState._facilityId;
  if (buildingIdx === undefined || buildingIdx === null) return;
  const b = gameState.buildings[buildingIdx]; if (!b) return;
  const f = (BUILDING_FACILITIES[b.type] || []).find(x => x.id === facilityId); if (!f) return;
  // v2.4.8b: 安全检查 — 不超过 maxCount
  const builtCount = (b.facilities || []).filter(id => id === facilityId).length;
  if (builtCount >= (f.maxCount || 1)) { showNotification(`${f.name}已达最大扩建次数`, 'info'); return; }
  const cell = mapCells[targetIdx];
  const dist = Math.abs(cell.x - b.x) + Math.abs(cell.y - b.y);
  if (dist < 1 || dist > 2) { showNotification('扩建地块必须在主建筑2格内', 'warn'); return; }
  if (cell.isWater) { showNotification('不能在水域上扩建', 'warn'); return; }
  if (cell.elevation > 500) { showNotification('海拔过高', 'warn'); return; }
  for (const bd of gameState.buildings) { if (bd.x === cell.x && bd.y === cell.y && bd.layer === 'ground') { showNotification('该位置已有建筑', 'warn'); return; } }
  if (!hasRoadNearby(cell.x, cell.y, 2)) { showNotification('附近2格内无道路', 'warn'); return; }
  if (gameState.treasury < f.cost) { showNotification(`财政不足，需要¥${f.cost}万`, 'danger'); return; }
  gameState.treasury -= f.cost;
  if (!b.facilities) b.facilities = [];
  b.facilities.push(facilityId);
  const facBuilding = { x: cell.x, y: cell.y, type: b.type + '_fac', layer: 'ground', age: 0, parentBuilding: buildingIdx, facilityId: facilityId };
  gameState.buildings.push(facBuilding); gameState.buildingCount = gameState.buildings.length;
  gameState._facilityBuildingIdx = null; gameState._facilityId = null; gameState.selectedTool = null;
  showNotification(`${b.customName}新增${f.name}（-¥${f.cost}万）`, 'success');
  logEvent(`${b.customName}扩建${f.name}（-¥${f.cost}万）`, 'success');
  updateUI(); renderMap(); showPlacedBuildingDetail(buildingIdx);
}

function createBranch(buildingIdx) {
  const b = gameState.buildings[buildingIdx]; if (!b) return;
  closeModal();
  showNotification('请在地图上选择分校/分院位置', 'info');
  gameState._branchParentIdx = buildingIdx;
  gameState.selectedTool = 'placeBranch';
}

function commitBranch(targetIdx) {
  const parentIdx = gameState._branchParentIdx; if (parentIdx === undefined || parentIdx === null) return;
  const parent = gameState.buildings[parentIdx]; if (!parent) return;
  const cell = mapCells[targetIdx]; const def = BUILDING_TYPES[parent.type];
  if (cell.isWater) { showNotification('不能在水域上建造', 'warn'); return; }
  if (cell.elevation > 500) { showNotification('海拔过高', 'warn'); return; }
  if (!hasRoadNearby(cell.x, cell.y, 2)) { showNotification('附近2格内无道路', 'warn'); return; }
  for (const b of gameState.buildings) { if (b.x === cell.x && b.y === cell.y && b.layer === def.layer) { showNotification('该位置已有建筑', 'warn'); return; } }
  const branchCost = Math.round(def.cost * 0.7);
  if (gameState.treasury < branchCost) { showNotification(`财政不足，需要¥${branchCost}万`, 'danger'); return; }
  gameState.treasury -= branchCost;
  // v2.4.3c: 分所/分校方位按实际相对位置计算，而非顺序分配
  const dx = cell.x - parent.x;
  const dy = cell.y - parent.y;
  let direction;
  if (Math.abs(dx) >= Math.abs(dy)) {
    direction = dx > 0 ? '东' : '西';
  } else {
    direction = dy > 0 ? '南' : '北';
  }
  // 若同方位已有分所，追加序号
  const existingSameDir = gameState.buildings.filter(b => b.branchOf === parentIdx && (b.customName || '').includes(direction)).length;
  const dirSuffix = existingSameDir > 0 ? (existingSameDir + 1).toString() : '';
  const branchNameMap = {
    elementarySchool: direction + '校区' + dirSuffix,
    middleSchool: direction + '校区' + dirSuffix,
    highSchool: direction + '校区' + dirSuffix,
    university: direction + '校区' + dirSuffix,
    hospital: direction + '院区' + dirSuffix,
    police: direction + '分所' + dirSuffix,
    fireStation: direction + '消防站' + dirSuffix,
  };
  const branchName = branchNameMap[parent.type] || (direction + '分部' + dirSuffix);
  const newBranch = { x: cell.x, y: cell.y, type: parent.type, layer: def.layer, age: 0, level: 1, facilities: [], branchOf: parentIdx, customName: (parent.customName || def.name) + branchName };
  gameState.buildings.push(newBranch); gameState.buildingCount = gameState.buildings.length;
  gameState._branchParentIdx = null; gameState.selectedTool = null;
  showNotification(`建成${newBranch.customName}（-¥${branchCost}万）`, 'success');
  logEvent(`${parent.customName}建设${branchName}（-¥${branchCost}万）`, 'success');
  updateUI(); renderMap();
}

// applyAllPolicies 保留不变
function applyAllPolicies() {
  for (const opt of POLICY_OPTIONS) {
    const el = document.getElementById(`policy-${opt.id}`);
    if (el) { const v = parseFloat(el.value); gameState.policies[opt.id] = v; if (opt.apply) opt.apply(v, gameState); }
  }
  for (const opt of MACRO_POLICY_OPTIONS) {
    const el = document.getElementById(`policy-${opt.id}`);
    if (el) { const v = parseFloat(el.value); gameState.policies[opt.id] = v; if (opt.apply) opt.apply(v, gameState); }
  }
  showNotification('政策已全面调整', 'success');
  logEvent('财政与金融政策已调整', 'info');
  // v2.2.5c: 政策变化可能影响车流分流比例，使缓存失效
  if (typeof invalidateTrafficCache === 'function') invalidateTrafficCache();
  updateUI();
}

// 所有原有渲染函数：renderApplyTab, renderInvestTab, renderPowerTab 保持不变
// 直接从原文件末尾复制，因篇幅限制在此省略注释行，函数体完全保留
// 这些函数与原始版本完全一致


function renderApplyTab() {
  const s = gameState;
  let html = '';
  const popM = s.population / 10000;
  // v2.2.1: 农田转建设用地审批（最多 50 格，成功率与 GDP 成正比）
  {
    const as = s.agriStats || {};
    const farmlandCount = s.buildings.filter(b => b.type === 'farmland' && !b.underConstruction).length;
    const redlineCells = as.farmlandRedline || 0;
    const redlineRatio = as.farmlandRedlineRatio || 0.30;
    // 成功率：与月 GDP 成正比，基准 30%（GDP=0），上限 90%（GDP≥¥14000万）
    const successRate = clamp(0.30 + (s.gdp / 14000) * 0.60, 0.30, 0.90);
    const adminFeePerCell = 30; // 每格审批手续费 ¥30万
    html += `<div class="stats-section"><h3>${ICON.treeStat}农田转建设用地审批</h3>`;
    html += `<p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">将农田转为建设用地指标。一次最多 50 格，成功率与月 GDP 成正比。<br>获批后可拆除对应数量农田且不触发耕地红线违规处分；被驳回将增加纪委关注度。<br>当前农田 ${farmlandCount} 格 / 红线 ${redlineCells} 格（比例 ${(redlineRatio * 100).toFixed(0)}%）</p>`;
    html += `<div class="policy-card">
      <div class="pc-title">${ICON.scale}转换格数</div>
      <div class="pc-desc">输入拟转换农田格数（1-50），当前可转换农田：${farmlandCount} 格</div>
      <div class="pc-control">
        <input type="range" id="farmland-convert-cells" min="1" max="50" step="1" value="10" oninput="document.getElementById('farmland-convert-val').textContent=this.value+'格';document.getElementById('farmland-convert-fee').textContent='¥'+(this.value*${adminFeePerCell})+'万';document.getElementById('farmland-convert-rate').textContent=Math.round(${successRate.toFixed(2)}*100)+'%'">
        <span class="pc-value" id="farmland-convert-val">10格</span>
      </div>
    </div>`;
    html += `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:var(--text-3);">
      <span>审批手续费：<span id="farmland-convert-fee" style="color:var(--orange);font-weight:600;">¥${10 * adminFeePerCell}万</span></span>
      <span>预估成功率：<span id="farmland-convert-rate" style="color:var(--green);font-weight:600;">${Math.round(successRate * 100)}%</span></span>
    </div>`;
    html += `<button class="start-btn primary" style="width:100%;margin-top:8px;" onclick="applyFarmlandConversion()">${ICON.stamp}<span>提交农田转换审批</span></button>`;
    html += '</div>';
  }
  html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.train2}地铁建设申报</h3>`;
  const subwayEligible = s.population >= 3000000;
  if (s.subwayApproved) {
    html += `<div style="background:var(--green-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;">
      <div style="color:var(--green);">${ICON.check}</div>
      <div style="font-size:13px;color:var(--green);font-weight:600;">地铁建设已获批，可建造地铁线路和地铁站</div></div>`;
  } else if (!subwayEligible) {
    html += `<div style="background:var(--separator-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;">
      <div style="color:var(--text-3);">${ICON.minusCircle}</div>
      <div><div style="font-size:13px;font-weight:600;">人口不足，暂不符合申报条件</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">当前人口: ${(popM).toFixed(1)}万 / 需要: 300万</div></div></div>`;
  } else {
    html += `<div style="background:var(--accent-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="color:var(--accent);">${ICON.check}</div>
      <div><div style="font-size:13px;font-weight:600;color:var(--accent);">符合申报条件</div>
      <div style="font-size:11px;color:var(--text-2);margin-top:2px;">当前人口: ${(popM).toFixed(1)}万</div></div></div>`;
    html += `<button class="start-btn primary" style="width:100%;" onclick="applySubway()">${ICON.train2}<span>申报地铁建设</span></button>`;
  }
  html += '</div>';

  // v2.2.6: 轻轨建设申报（人口达150万可申报）
  html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.bridge}轻轨建设申报</h3>`;
  const lightRailEligible = s.population >= 1500000;
  if (s.lightRailApproved) {
    html += `<div style="background:var(--green-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;">
      <div style="color:var(--green);">${ICON.check}</div>
      <div style="font-size:13px;color:var(--green);font-weight:600;">轻轨建设已获批，可建造轻轨线路和轻轨站</div></div>`;
  } else if (!lightRailEligible) {
    html += `<div style="background:var(--separator-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;">
      <div style="color:var(--text-3);">${ICON.minusCircle}</div>
      <div><div style="font-size:13px;font-weight:600;">人口不足，暂不符合申报条件</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">当前人口: ${(popM).toFixed(1)}万 / 需要: 150万</div></div></div>`;
  } else {
    html += `<div style="background:var(--accent-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="color:var(--accent);">${ICON.check}</div>
      <div><div style="font-size:13px;font-weight:600;color:var(--accent);">符合申报条件</div>
      <div style="font-size:11px;color:var(--text-2);margin-top:2px;">当前人口: ${(popM).toFixed(1)}万</div></div></div>`;
    html += `<button class="start-btn primary" style="width:100%;" onclick="applyLightRail()">${ICON.bridge}<span>申报轻轨建设</span></button>`;
  }
  html += '</div>';

  // v2.4.7: 机场建设申报（地级市以上，人口达20万可申报）
  html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.building2}机场建设申报</h3>`;
  const airportEligible = s.population >= 200000 && s.cityLevelId >= 2;
  if (s.airportApproved) {
    html += `<div style="background:var(--green-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;">
      <div style="color:var(--green);">${ICON.check}</div>
      <div style="font-size:13px;color:var(--green);font-weight:600;">机场建设已获批，可建造机场（需跑道>5格）</div></div>`;
  } else if (!airportEligible) {
    html += `<div style="background:var(--separator-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;">
      <div style="color:var(--text-3);">${ICON.minusCircle}</div>
      <div><div style="font-size:13px;font-weight:600;">暂不符合申报条件</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">需地级市以上且人口达20万</div></div></div>`;
  } else if (s.airportCooldown && s.airportCooldown > s.turn) {
    // v2.5.0b: 驳回冷却期显示
    const remaining = s.airportCooldown - s.turn;
    html += `<div style="background:var(--separator-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;">
      <div style="color:var(--text-3);">${ICON.minusCircle}</div>
      <div><div style="font-size:13px;font-weight:600;">申请被驳回，冷却中</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">还需等待${remaining}个月后方可重新申报</div></div></div>`;
  } else {
    html += `<div style="background:var(--accent-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="color:var(--accent);">${ICON.check}</div>
      <div><div style="font-size:13px;font-weight:600;color:var(--accent);">符合申报条件</div>
      <div style="font-size:11px;color:var(--text-2);margin-top:2px;">当前人口: ${(popM).toFixed(1)}万</div></div></div>`;
    html += `<button class="start-btn primary" style="width:100%;" onclick="applyAirport()">${ICON.building2}<span>申报机场建设</span></button>`;
  }
  html += '</div>';

  html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.schoolStat}大学建设申报</h3>`;
  const univEligible = s.population >= 100000;
  const univCount = s.buildings.filter(b => b.type === 'university' && !b.underConstruction).length;
  if (s.universityApproved) {
    html += `<div style="background:var(--green-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;">
      <div style="color:var(--green);">${ICON.check}</div>
      <div style="font-size:13px;color:var(--green);font-weight:600;">大学建设已获批，可建造高等学府</div></div>`;
    if (univCount > 0) {
      html += '<div style="margin-top:8px;">';
      for (const b of s.buildings.filter(bd => bd.type === 'university' && !bd.underConstruction)) {
        const upgraded = b.universityUpgraded ? '<span style="color:var(--green);font-size:11px;">（已升本）</span>' : '';
        const upgradeMonths = b.universityBuiltMonth !== undefined ? s.turn - b.universityBuiltMonth : 0;
        const canUpgrade = !b.universityUpgraded && upgradeMonths >= 48;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--separator-light);border-radius:8px;margin-bottom:4px;">
          <span style="font-size:12px;">${b.customName || '大学'}${upgraded}</span>
          ${canUpgrade ? `<button class="start-btn" style="padding:4px 12px;font-size:11px;" onclick="upgradeUniversity(${s.buildings.indexOf(b)})">升本</button>` : ''}
        </div>`;
      }
      html += '</div>';
    }
  } else if (!univEligible) {
    html += `<div style="background:var(--separator-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;">
      <div style="color:var(--text-3);">${ICON.minusCircle}</div>
      <div><div style="font-size:13px;font-weight:600;">人口不足，暂不符合申报条件</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">当前人口: ${(popM).toFixed(1)}万 / 需要: 10万</div></div></div>`;
  } else {
    html += `<div style="background:var(--accent-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="color:var(--accent);">${ICON.check}</div>
      <div><div style="font-size:13px;font-weight:600;color:var(--accent);">符合申报条件</div>
      <div style="font-size:11px;color:var(--text-2);margin-top:2px;">当前人口: ${(popM).toFixed(1)}万</div></div></div>`;
    html += `<div style="font-size:11px;color:var(--text-2);margin-bottom:8px;">获批后首推${s.cityName.replace(/[镇县城]+$/, '')}师范高等专科学校和${s.cityName.replace(/[镇县城]+$/, '')}医学高等专科学校，4年后可升本。</div>`;
    html += `<button class="start-btn primary" style="width:100%;" onclick="applyUniversity()">${ICON.school}<span>申报大学建设</span></button>`;
  }
  html += '</div>';

  html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.building3}摩天大楼申报</h3>`;
  html += `<p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">自定义摩天大楼高度，建成后提供增益效果。<br>300米以下自由申报；300米以上需人口≥200万；500米以上有概率被驳回。</p>`;
  html += `<div class="policy-card">
    <div class="pc-title">${ICON.ruler}建筑高度</div>
    <div class="pc-desc">输入摩天大楼高度（50-800米）</div>
    <div class="pc-control">
      <input type="range" id="sky-height" min="50" max="800" step="10" value="200" oninput="document.getElementById('sky-h-val').textContent=this.value+'m'">
      <span class="pc-value" id="sky-h-val">200m</span>
    </div>
  </div>`;
  html += `<button class="start-btn primary" style="width:100%;margin-top:8px;" onclick="applySkyscraper()">${ICON.megaStructure}<span>申报摩天大楼</span></button>`;
  if (s.skyscrapers.length > 0) {
    html += `<div style="margin-top:10px;"><div style="font-size:13px;font-weight:600;margin-bottom:6px;">已建摩天大楼</div>`;
    for (const sk of s.skyscrapers) {
      html += `<div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--separator-light);border-radius:8px;margin-bottom:4px;">
        <span style="font-size:12px;">${sk.name}</span>
        <span style="font-size:12px;font-weight:600;color:var(--accent);">${sk.height}m</span></div>`;
    }
    html += '</div>';
  }

  // v2.4.6: 行政区划申报
  const lv = getCityLevel();
  const cs = gameState.cityStatus || { isCountyCity: false, isSeparatelyPlanned: false, hasNationalNewArea: false };
  html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.govStat}行政区划申报</h3>`;
  html += `<p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">根据城市规模和发展水平，可向上级申报行政区划升级，获批后财政上缴比例降低并获得定期资金扶持。</p>`;

  // 1. 撤县设市（县城级别可申报）
  // v2.4.6c: 统一样式，移除效果数值，只显示条件数值
  if (lv.id === 1 && !cs.isCountyCity) {
    const popOK = gameState.population >= 120000;
    const gdpOK = (gameState.gdp || 0) >= 3000;
    const urbanRatio = (gameState.agriStats && gameState.agriStats.urbanizationRatio) || 0;
    const urbanOK = urbanRatio >= 0.35;
    const fiscalOK = ((gameState.monthlyRevenue || 0) * 12) >= 4000;
    const corruptionOK = (gameState.corruption || 0) < 30;
    const allOK = popOK && gdpOK && urbanOK && fiscalOK && corruptionOK;
    const app = gameState.adminApplication;
    const inReview = app && app.type === 'countyCity' && app.status === 'reviewing';
    if (inReview) {
      const reviewLeft = (app.reviewMonths || 6) - (gameState.turn - app.turnSubmitted);
      html += `<div style="background:rgba(255,165,0,0.1);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="color:var(--orange);">${ICON.clock || '⏳'}</div>
        <div><div style="font-size:13px;font-weight:600;color:var(--orange);">撤县设市 · 考察期进行中</div>
        <div style="font-size:11px;color:var(--text-2);margin-top:2px;">剩余 ${reviewLeft} 个月，考察期内负面指标过高将被驳回</div></div></div>`;
    } else {
      html += `<div style="background:${allOK ? 'var(--accent-light)' : 'var(--separator-light)'};border-radius:10px;padding:12px;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:600;${allOK ? 'color:var(--accent);' : ''}">撤县设市申报${allOK ? ' · 符合条件' : ''}</div>
        <div style="font-size:11px;color:var(--text-3);margin:4px 0;">条件：人口≥12万、月GDP≥3000万、城镇化率≥35%、年财政≥4000万、腐败＜30</div>
        <div style="font-size:11px;">${popOK ? '✓' : '✗'} 人口 ${Math.round(gameState.population/10000)}万/12万　${gdpOK ? '✓' : '✗'} GDP ${Math.round(gameState.gdp)}万/3000万　${urbanOK ? '✓' : '✗'} 城镇化率 ${(urbanRatio*100).toFixed(0)}%/35%　${fiscalOK ? '✓' : '✗'} 年财政 ${Math.round((gameState.monthlyRevenue||0)*12)}万/4000万　${corruptionOK ? '✓' : '✗'} 腐败 ${Math.round(gameState.corruption||0)}/30</div>
        <button class="start-btn ${allOK ? 'primary' : ''}" style="width:100%;margin-top:8px;${allOK ? '' : 'opacity:0.5;pointer-events:none;'}" onclick="applyAdminUpgrade('countyCity')">申报撤县设市</button>
      </div>`;
    }
  }
  if (cs.isCountyCity) {
    html += `<div style="background:var(--green-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="color:var(--green);">${ICON.check}</div>
      <div style="font-size:13px;color:var(--green);font-weight:600;">已获批撤县设市</div></div>`;
  }

  // 2. 计划单列市（地级市级别可申报）
  // v2.4.6c: 统一样式，移除效果数值
  if (lv.id === 2 && !cs.isSeparatelyPlanned) {
    const popOK2 = gameState.population >= 600000;
    const gdpOK2 = (gameState.gdp || 0) >= 15000;
    const scoreOK2 = (gameState.livabilityScore + gameState.prosperityScore) / 2 >= 72;
    const corruptionOK2 = (gameState.corruption || 0) < 25;
    const allOK2 = popOK2 && gdpOK2 && scoreOK2 && corruptionOK2;
    const app = gameState.adminApplication;
    const inReview2 = app && app.type === 'separatelyPlanned' && app.status === 'reviewing';
    if (inReview2) {
      const reviewLeft2 = (app.reviewMonths || 8) - (gameState.turn - app.turnSubmitted);
      html += `<div style="background:rgba(255,165,0,0.1);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="color:var(--orange);">${ICON.clock || '⏳'}</div>
        <div><div style="font-size:13px;font-weight:600;color:var(--orange);">计划单列市 · 考察期进行中</div>
        <div style="font-size:11px;color:var(--text-2);margin-top:2px;">剩余 ${reviewLeft2} 个月，考察期内负面指标过高将被驳回</div></div></div>`;
    } else {
      html += `<div style="background:${allOK2 ? 'var(--accent-light)' : 'var(--separator-light)'};border-radius:10px;padding:12px;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:600;${allOK2 ? 'color:var(--accent);' : ''}">计划单列市申报${allOK2 ? ' · 符合条件' : ''}</div>
        <div style="font-size:11px;color:var(--text-3);margin:4px 0;">条件：人口≥60万、月GDP≥1.5亿、城市评分≥72、腐败＜25</div>
        <div style="font-size:11px;">${popOK2 ? '✓' : '✗'} 人口 ${Math.round(gameState.population/10000)}万/60万　${gdpOK2 ? '✓' : '✗'} GDP ${Math.round(gameState.gdp)}万/15000万　${scoreOK2 ? '✓' : '✗'} 评分 ${Math.round((gameState.livabilityScore + gameState.prosperityScore)/2)}/72　${corruptionOK2 ? '✓' : '✗'} 腐败 ${Math.round(gameState.corruption||0)}/25</div>
        <button class="start-btn ${allOK2 ? 'primary' : ''}" style="width:100%;margin-top:8px;${allOK2 ? '' : 'opacity:0.5;pointer-events:none;'}" onclick="applyAdminUpgrade('separatelyPlanned')">申报计划单列市</button>
      </div>`;
    }
  }
  if (cs.isSeparatelyPlanned) {
    html += `<div style="background:var(--green-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="color:var(--green);">${ICON.check}</div>
      <div style="font-size:13px;color:var(--green);font-weight:600;">已获批计划单列市</div></div>`;
  }

  // 3. 国家级新区（省会城市可申报）
  // v2.4.6c: 统一样式，移除效果数值
  if (lv.id === 3 && !cs.hasNationalNewArea) {
    const popOK3 = gameState.population >= 2500000;
    const gdpOK3 = (gameState.gdp || 0) >= 40000;
    const scoreOK3 = (gameState.livabilityScore + gameState.prosperityScore) / 2 >= 78;
    const corruptionOK3 = (gameState.corruption || 0) < 20;
    const allOK3 = popOK3 && gdpOK3 && scoreOK3 && corruptionOK3;
    const app = gameState.adminApplication;
    const inReview3 = app && app.type === 'nationalNewArea' && app.status === 'reviewing';
    if (inReview3) {
      const reviewLeft3 = (app.reviewMonths || 10) - (gameState.turn - app.turnSubmitted);
      html += `<div style="background:rgba(255,165,0,0.1);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="color:var(--orange);">${ICON.clock || '⏳'}</div>
        <div><div style="font-size:13px;font-weight:600;color:var(--orange);">国家级新区 · 考察期进行中</div>
        <div style="font-size:11px;color:var(--text-2);margin-top:2px;">剩余 ${reviewLeft3} 个月，考察期内负面指标过高将被驳回</div></div></div>`;
    } else {
      html += `<div style="background:${allOK3 ? 'var(--accent-light)' : 'var(--separator-light)'};border-radius:10px;padding:12px;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:600;${allOK3 ? 'color:var(--accent);' : ''}">国家级新区申报${allOK3 ? ' · 符合条件' : ''}</div>
        <div style="font-size:11px;color:var(--text-3);margin:4px 0;">条件：人口≥250万、月GDP≥4亿、城市评分≥78、腐败＜20</div>
        <div style="font-size:11px;">${popOK3 ? '✓' : '✗'} 人口 ${Math.round(gameState.population/10000)}万/250万　${gdpOK3 ? '✓' : '✗'} GDP ${Math.round(gameState.gdp)}万/40000万　${scoreOK3 ? '✓' : '✗'} 评分 ${Math.round((gameState.livabilityScore + gameState.prosperityScore)/2)}/78　${corruptionOK3 ? '✓' : '✗'} 腐败 ${Math.round(gameState.corruption||0)}/20</div>
        <button class="start-btn ${allOK3 ? 'primary' : ''}" style="width:100%;margin-top:8px;${allOK3 ? '' : 'opacity:0.5;pointer-events:none;'}" onclick="applyAdminUpgrade('nationalNewArea')">申报国家级新区</button>
      </div>`;
    }
  }
  if (cs.hasNationalNewArea) {
    html += `<div style="background:var(--green-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="color:var(--green);">${ICON.check}</div>
      <div style="font-size:13px;color:var(--green);font-weight:600;">已获批国家级新区${cs.newAreaExpanded ? '，地图已扩展' : ''}</div></div>`;
  }

  // v2.4.6c: 城市荣誉申报（文明城市、卫生城市）— 统一样式，移除效果数值
  const honors = gameState.cityHonors || {};
  if (lv.id >= 1) {
    html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.star}城市荣誉申报</h3>`;
    html += `<p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">县级及以上城市可申报国家级荣誉称号，获批后提升市民幸福度和城市形象。</p>`;

    // 文明城市
    if (!honors.civilizedCity) {
      const civScoreOK = (gameState.happiness || 0) >= 65 && (gameState.educationIndex || 0) >= 40;
      const civCorruptionOK = (gameState.corruption || 0) < 25;
      const civAirOK = (gameState.airQuality || 0) < 80;
      const civAllOK = civScoreOK && civCorruptionOK && civAirOK && !honors.civilizedApplying;
      if (honors.civilizedApplying) {
        const civLeft = honors.civilizedReviewTurn || 0;
        html += `<div style="background:rgba(255,165,0,0.1);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="color:var(--orange);">${ICON.clock || '⏳'}</div>
          <div><div style="font-size:13px;font-weight:600;color:var(--orange);">文明城市 · 考察期进行中</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:2px;">剩余 ${civLeft} 个月，考察期内保持各项指标达标即可获评</div></div></div>`;
      } else {
        html += `<div style="background:${civAllOK ? 'var(--accent-light)' : 'var(--separator-light)'};border-radius:10px;padding:12px;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:600;${civAllOK ? 'color:var(--accent);' : ''}">文明城市申报${civAllOK ? ' · 符合条件' : ''}</div>
          <div style="font-size:11px;color:var(--text-3);margin:4px 0;">条件：满意度≥65、教育≥40、腐败＜25、空气＜80</div>
          <div style="font-size:11px;">${civScoreOK ? '✓' : '✗'} 满意度 ${Math.round(gameState.happiness||0)}/65　${civCorruptionOK ? '✓' : '✗'} 腐败 ${Math.round(gameState.corruption||0)}/25　${civAirOK ? '✓' : '✗'} 空气 ${Math.round(gameState.airQuality||0)}/80</div>
          <button class="start-btn ${civAllOK ? 'primary' : ''}" style="width:100%;margin-top:8px;${civAllOK ? '' : 'opacity:0.5;pointer-events:none;'}" onclick="applyCityHonor('civilized')">申报文明城市</button>
        </div>`;
      }
    } else {
      html += `<div style="background:var(--green-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="color:var(--green);">${ICON.check}</div>
        <div style="font-size:13px;color:var(--green);font-weight:600;">已获评全国文明城市</div></div>`;
    }

    // 卫生城市
    if (!honors.sanitaryCity) {
      const sanHealthOK = (gameState.healthcareIndex || 0) >= 45;
      const sanWaterOK = (gameState.waterQuality || 0) >= 70;
      const sanGreenOK = (gameState.greenCoverage || 0) >= 20;
      const sanCorruptionOK = (gameState.corruption || 0) < 30;
      const sanAllOK = sanHealthOK && sanWaterOK && sanGreenOK && sanCorruptionOK && !honors.sanitaryApplying;
      if (honors.sanitaryApplying) {
        const sanLeft = honors.sanitaryReviewTurn || 0;
        html += `<div style="background:rgba(255,165,0,0.1);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="color:var(--orange);">${ICON.clock || '⏳'}</div>
          <div><div style="font-size:13px;font-weight:600;color:var(--orange);">卫生城市 · 考察期进行中</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:2px;">剩余 ${sanLeft} 个月，考察期内保持各项指标达标即可获评</div></div></div>`;
      } else {
        html += `<div style="background:${sanAllOK ? 'var(--accent-light)' : 'var(--separator-light)'};border-radius:10px;padding:12px;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:600;${sanAllOK ? 'color:var(--accent);' : ''}">卫生城市申报${sanAllOK ? ' · 符合条件' : ''}</div>
          <div style="font-size:11px;color:var(--text-3);margin:4px 0;">条件：医疗≥45、水质≥70、绿化≥20、腐败＜30</div>
          <div style="font-size:11px;">${sanHealthOK ? '✓' : '✗'} 医疗 ${Math.round(gameState.healthcareIndex||0)}/45　${sanWaterOK ? '✓' : '✗'} 水质 ${Math.round(gameState.waterQuality||0)}/70　${sanGreenOK ? '✓' : '✗'} 绿化 ${Math.round(gameState.greenCoverage||0)}/20　${sanCorruptionOK ? '✓' : '✗'} 腐败 ${Math.round(gameState.corruption||0)}/30</div>
          <button class="start-btn ${sanAllOK ? 'primary' : ''}" style="width:100%;margin-top:8px;${sanAllOK ? '' : 'opacity:0.5;pointer-events:none;'}" onclick="applyCityHonor('sanitary')">申报卫生城市</button>
        </div>`;
      }
    } else {
      html += `<div style="background:var(--green-light);border-radius:10px;padding:12px;display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="color:var(--green);">${ICON.check}</div>
        <div style="font-size:13px;color:var(--green);font-weight:600;">已获评国家卫生城市</div></div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  html += '</div>';
  return html;
}

let _investGroupOpen = { promo: false, enterprise: false, loan: false };
function renderInvestTab() {
  const investIcons = { promo: ICON.handshake, hightech: ICON.rocket, tourism: ICON.globe, ftz: ICON.building2 };
  let html = '<p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">工商发展可以提升城市经济活力。点击分组展开。</p>';

  // v2.3.5c: 三大折叠组 — 与政策页完全一致的设计
  // === 1. 招商项目 ===
  html += `<div class="policy-group">
    <div class="policy-group-header ${_investGroupOpen.promo ? 'open' : ''}" onclick="_investGroupOpen.promo=!_investGroupOpen.promo;renderSheet('gov');">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent);"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      <span>招商项目</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto;"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
    <div class="policy-group-body ${_investGroupOpen.promo ? 'open' : ''}">`;
  html += `<div class="effect-list" style="margin-bottom:8px;">
    <div class="effect-item"><span class="eff-label">${ICON.trendingUp}GDP增速倍率</span><span class="eff-val ${gameState.gdpMult > 1.2 ? 'pos' : ''}">${(gameState.gdpMult * 100).toFixed(0)}%（上限${(GDP_MULT_CAP * 100).toFixed(0)}%）</span></div>
    <div class="effect-item"><span class="eff-label">${ICON.wallet}财政收入上限</span><span class="eff-val">GDP的${(REVENUE_GDP_CAP_RATIO * 100).toFixed(0)}%</span></div>
  </div>`;
  for (const inv of INVESTMENT_OPTIONS) {
    const canAfford = gameState.treasury >= inv.cost;
    const meetsTurn = gameState.turn >= inv.minTurn;
    const used = gameState.investUsage[inv.id] || 0;
    const remaining = inv.maxPerTerm - used;
    const maxReached = remaining <= 0;
    const canDo = canAfford && meetsTurn && !maxReached;
    const invIcon = investIcons[inv.id] || ICON.trendingUp;
    html += `<div class="invest-card ${canDo ? '' : 'disabled'}">
      <div class="iv-title"><span class="iv-title-left">${invIcon}${inv.name}</span><span class="iv-cost">${inv.cost}万</span></div>
      <div class="iv-desc">${inv.desc}</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:4px;">本任期已用 ${used}/${inv.maxPerTerm} 次</div>
      ${!meetsTurn ? '<div style="font-size:12px;color:var(--red);">需任期' + inv.minTurn + '月以上</div>' : ''}
      ${!canAfford ? '<div style="font-size:12px;color:var(--red);">财政资金不足</div>' : ''}
      ${maxReached ? '<div style="font-size:12px;color:var(--orange);">本任期已达次数上限</div>' : ''}
      ${canDo ? `<button class="start-btn primary" style="width:100%;margin-top:8px;padding:10px;font-size:14px;" onclick="doInvestment('${inv.id}')">启动项目${remaining > 0 ? `（剩余${remaining}次）` : ''}</button>` : ''}
    </div>`;
  }
  html += '</div></div>';

  // === 2. 企业管理 ===
  html += `<div class="policy-group">
    <div class="policy-group-header ${_investGroupOpen.enterprise ? 'open' : ''}" onclick="_investGroupOpen.enterprise=!_investGroupOpen.enterprise;renderSheet('gov');">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent);"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h6"/></svg>
      <span>企业管理</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto;"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
    <div class="policy-group-body ${_investGroupOpen.enterprise ? 'open' : ''}">`;
  html += renderEnterpriseSection();
  html += '</div></div>';

  // === 3. 财政贷款 ===
  html += `<div class="policy-group">
    <div class="policy-group-header ${_investGroupOpen.loan ? 'open' : ''}" onclick="_investGroupOpen.loan=!_investGroupOpen.loan;renderSheet('gov');">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent);"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      <span>财政贷款</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto;"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
    <div class="policy-group-body ${_investGroupOpen.loan ? 'open' : ''}">`;
  html += `<div style="font-size:12px;color:var(--text-3);margin-bottom:8px;">向银行申请贷款，缓解财政资金压力。按月等额还本付息，利率${(gameState.policies.interestRate || 3) + 2}%/年。</div>`;
  if (gameState.loans && gameState.loans.length > 0) {
    html += '<div style="margin-bottom:10px;">';
    let totalMonthly = 0;
    for (const loan of gameState.loans) {
      totalMonthly += loan.monthlyPayment;
      html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--separator);">
        <span style="font-size:13px;">贷款${formatMoney(loan.amount * 10000)}（${loan.term}月期）</span>
        <span style="font-size:12px;color:var(--text-3);">月还${formatMoney(loan.monthlyPayment * 10000)}，剩余${loan.remainingMonths}月</span></div>`;
    }
    html += `<div style="font-size:13px;font-weight:600;margin-top:6px;color:var(--orange);">月度还款合计：${formatMoney(totalMonthly * 10000)}</div></div>`;
  }
  // v2.3.5c: 贷款按钮全部垂直排列，同步大小
  const loanOptions = [{ amount: 500, term: 24, label: '500万/24月' },{ amount: 1000, term: 36, label: '1000万/36月' },{ amount: 2000, term: 48, label: '2000万/48月' },{ amount: 5000, term: 60, label: '5000万/60月' }];
  for (const opt of loanOptions) {
    const annualRate = ((gameState.policies.interestRate || 3) + 2) / 100;
    const monthlyRate = annualRate / 12;
    const monthlyPayment = opt.amount * monthlyRate * Math.pow(1 + monthlyRate, opt.term) / (Math.pow(1 + monthlyRate, opt.term) - 1);
    html += `<button class="start-btn" style="width:100%;padding:12px;font-size:14px;margin-bottom:6px;" onclick="takeLoan(${opt.amount}, ${opt.term})">${opt.label} · 月还${monthlyPayment.toFixed(0)}万</button>`;
  }
  html += '</div></div>';

  return html;
}

function renderPowerTab() {
  const corruptIcons = { bribe: ICON.moneyBag, sellOffice: ICON.gavel, powerTrade: ICON.handshake, donation: ICON.bookmark, launder: ICON.check };
  let html = `<p style="font-size:13px;color:var(--text-2);margin-bottom:8px;">作为${getOfficialTitle()}，你手握大权。权力运作可以快速获取资金，但会增加腐败指数和纪委关注度。</p>`;
  html += `<div class="effect-list" style="margin-bottom:12px;">
    <div class="effect-item"><span class="eff-label">${ICON.alert}当前腐败指数</span><span class="eff-val ${gameState.corruption > 40 ? 'neg' : 'pos'}">${gameState.corruption.toFixed(0)}/100</span></div>
    <div class="effect-item"><span class="eff-label">${ICON.eye}纪委关注度</span><span class="eff-val ${gameState.inspectionRisk > 40 ? 'neg' : 'pos'}">${gameState.inspectionRisk.toFixed(0)}/100</span></div>
    <div class="effect-item"><span class="eff-label">${ICON.star}政治声誉</span><span class="eff-val ${gameState.reputation > 50 ? 'pos' : 'neg'}">${gameState.reputation.toFixed(0)}/100</span></div>
    <div class="effect-item"><span class="eff-label">${ICON.wallet}私人账户</span><span class="eff-val pos">¥${formatMoney(gameState.privateAccount * 10000)}</span></div>
  </div>`;
  html += `<p style="font-size:12px;color:var(--text-3);margin-bottom:8px;">非法所得自动进入私人账户，可前往"个人事务"进行投资理财。纪委调查时可用私人账户资金摆平。</p>`;
  for (const act of CORRUPTION_ACTIONS) {
    const cd = corruptionCooldowns[act.id] || 0;
    const canDo = cd <= 0;
    const actIcon = corruptIcons[act.id] || ICON.moneyBag;
    html += `<div class="corrupt-card ${canDo ? '' : 'disabled'}">
      <div class="cc-title">${actIcon}${act.name} ${!canDo ? `<span style="color:var(--orange);font-size:11px;">冷却${cd}月</span>` : ''}</div>
      <div class="cc-desc">${act.desc}</div>
      <div class="cc-effects">
        ${act.gain > 0 ? `<span class="cc-tag pos">+¥${act.gain}万</span>` : ''}
        ${act.cost > 0 ? `<span class="cc-tag neg">-¥${act.cost}万</span>` : ''}
        ${act.corruption ? `<span class="cc-tag ${act.corruption > 0 ? 'neg' : 'pos'}">腐败${act.corruption > 0 ? '+' : ''}${act.corruption}</span>` : ''}
        ${act.inspection ? `<span class="cc-tag neg">纪委+${act.inspection}</span>` : ''}
        ${act.reputation ? `<span class="cc-tag ${act.reputation > 0 ? 'pos' : 'neg'}">声誉${act.reputation > 0 ? '+' : ''}${act.reputation}</span>` : ''}
      </div>
      ${canDo ? `<button class="start-btn ${act.corruption > 0 ? '' : 'primary'}" style="width:100%;margin-top:8px;padding:10px;font-size:14px;${act.corruption > 0 ? 'background:var(--red);color:#fff;' : ''}" onclick="doCorruptionAction('${act.id}')">执行</button>` : ''}
    </div>`;
  }
  const uw = gameState.underworld;
  html += `<div style="margin-top:16px;padding:14px;background:var(--separator-light);border-radius:12px;">
    <div style="font-size:15px;font-weight:700;margin-bottom:8px;"><span class="section-title-icon">${ICON.gangster}黑社会系统</span></div>
    <div style="font-size:12px;color:var(--text-3);margin-bottom:10px;">豢养打手可用于处理群众事件，并对群众事件有威慑作用。但会增加腐败和犯罪率。</div>
    <div class="effect-list" style="margin-bottom:10px;">
      <div class="effect-item"><span class="eff-label">${ICON.fist}打手数量</span><span class="eff-val ${uw.thugs > 0 ? 'neg' : 'pos'}">${uw.thugs}人</span></div>
      <div class="effect-item"><span class="eff-label">${ICON.alert}犯罪率</span><span class="eff-val ${uw.crimeRate > 30 ? 'neg' : 'pos'}">${uw.crimeRate.toFixed(0)}/100</span></div>
      <div class="effect-item"><span class="eff-label">${ICON.crackdown}扫黑力度</span><span class="eff-val ${uw.crackdownLevel > 0 ? 'pos' : ''}">${uw.crackdownLevel.toFixed(0)}/100</span></div>
      <div class="effect-item"><span class="eff-label">${ICON.wallet}打手月支出</span><span class="eff-val ${uw.thugMonthlyCost > 0 ? 'neg' : 'pos'}">¥${formatMoney(uw.thugMonthlyCost * 10000)}/月</span></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">`;
  html += `<button class="start-btn" style="flex:1;min-width:100px;padding:10px 6px;font-size:12px;background:#8B4513;color:#fff;" onclick="recruitThugs(5)">招募5名打手<br><span style="font-size:10px;color:#ddd;">¥20万一次</span></button>`;
  html += `<button class="start-btn" style="flex:1;min-width:100px;padding:10px 6px;font-size:12px;background:#8B4513;color:#fff;" onclick="recruitThugs(10)">招募10名打手<br><span style="font-size:10px;color:#ddd;">¥40万一次</span></button>`;
  if (uw.thugs > 0) html += `<button class="start-btn" style="flex:1;min-width:100px;padding:10px 6px;font-size:12px;background:var(--text-3);color:#fff;" onclick="dismissThugs()">遣散全部打手</button>`;
  html += `<button class="start-btn" style="flex:1;min-width:100px;padding:10px 6px;font-size:12px;background:var(--accent);color:#fff;" onclick="crackdownOnCrime()">扫黑除恶行动<br><span style="font-size:10px;color:#ddd;">¥30万一次</span></button>`;
  html += '</div>';
  if (uw.thugs > 0) html += `<div style="margin-top:8px;font-size:12px;color:var(--orange);"><span class="inline-icon">${ICON.alert}</span>拥有打手时（≥2名），处理群众事件可选择"派打手摆平"选项。</div>`;
  html += '</div>';
  return html;
}

// v2.2.1: 农田转建设用地审批
// 玩家可申请将农田转为建设用地，一次最多 50 格
// 成功率与月 GDP 成正比（基准 30%，上限 90%）
// 获批后拆除对应数量农田且不触发耕地红线违规处分；被驳回则增加纪委关注度
function applyFarmlandConversion() {
  const s = gameState;
  const cellsEl = document.getElementById('farmland-convert-cells');
  if (!cellsEl) return;
  const cells = parseInt(cellsEl.value);
  if (isNaN(cells) || cells < 1 || cells > 50) { showNotification('请输入 1-50 格', 'warn'); return; }

  // 当前农田格数
  const farmlandBuildings = s.buildings.filter(b => b.type === 'farmland' && !b.underConstruction);
  if (farmlandBuildings.length < cells) { showNotification(`农田不足，当前仅 ${farmlandBuildings.length} 格`, 'warn'); return; }

  // 审批手续费
  const adminFeePerCell = 30;
  const totalFee = cells * adminFeePerCell;
  if (s.treasury < totalFee) { showNotification(`财政不足，需审批手续费 ¥${totalFee}万`, 'warn'); return; }

  // 成功率：与月 GDP 成正比
  const successRate = clamp(0.30 + (s.gdp / 14000) * 0.60, 0.30, 0.90);

  // 二次确认
  showModal(
    '确认农田转建设用地审批',
    `<p>拟转换农田：${cells} 格</p>
     <p>审批手续费：¥${totalFee}万（不可退还）</p>
     <p>预估成功率：${Math.round(successRate * 100)}%（与月 GDP 成正比）</p>
     <p style="font-size:13px;color:var(--text-3);">获批后，对应数量农田将被拆除且不触发耕地红线违规处分；被驳回将增加纪委关注度 +5。</p>`,
    [
      {
        text: '确认提交',
        color: 'blue',
        action: () => {
          closeModal();
          s.treasury -= totalFee;
          const approved = Math.random() < successRate;
          if (approved) {
            // 获批：拆除 N 格最旧的农田，且不触发红线违规
            // 策略：拆除后若低于红线，重置违规计数（代表获得合法转换许可）
            let removed = 0;
            const toRemove = [];
            for (const b of s.buildings) {
              if (removed >= cells) break;
              if (b.type === 'farmland' && !b.underConstruction) {
                toRemove.push(b);
                removed++;
              }
            }
            for (const b of toRemove) {
              const idx = b.y * MAP_W + b.x;
              if (mapCells[idx] && mapCells[idx].building === b) mapCells[idx].building = null;
            }
            s.buildings = s.buildings.filter(b => !toRemove.includes(b));
            // 合法转换：重置违规计数，不触发处分
            if (s.agriStats) {
              s.agriStats.belowRedlineMonths = 0;
              s.agriStats.redlinePenaltyTriggered = [];
            }
            showNotification(`农田转换审批通过！已拆除 ${removed} 格农田（合法转换，不触发红线处分）`, 'success');
            logEvent(`农田转建设用地审批获批：转换 ${removed} 格`, 'success');
            s.achievementStats.redlineViolations = s.achievementStats.redlineViolations || 0;
          } else {
            // 被驳回：增加纪委关注度
            s.inspectionRisk = clamp((s.inspectionRisk || 0) + 5, 0, 100);
            showNotification('农田转换审批被上级驳回，纪委关注度 +5', 'danger');
            logEvent('农田转建设用地审批被驳回', 'warn');
          }
          updateUI();
          renderSheet(currentTab);
        }
      },
      { text: '取消', color: 'gray', action: closeModal }
    ],
    '农田转换审批',
    'info'
  );
}

// v2.4.6b: 行政区划升级申报（含考察期机制）
function applyAdminUpgrade(type) {
  const lv = getCityLevel();
  if (!gameState.cityStatus) gameState.cityStatus = { isCountyCity: false, isSeparatelyPlanned: false, hasNationalNewArea: false, newAreaExpanded: false };

  const configs = {
    countyCity: {
      name: '撤县设市', level: 1, cost: 500,
      reviewMonths: 6, // v2.4.6b: 考察期6个月
      baseRejectRate: 0.10,
      onSuccess: () => {
        gameState.cityStatus.isCountyCity = true;
        gameState.fiscalRemitRate = (gameState.fiscalRemitRate || 1.0) + 0.10;
        gameState.fiscalSupportMonthly = (gameState.fiscalSupportMonthly || 0) + 50;
        gameState.reputation = clamp((gameState.reputation || 50) + 10, 0, 100);
        showNotification('撤县设市申报获批！财政留成+10%，月度扶持+50万', 'success');
        logEvent('撤县设市申报获批，城市行政地位提升，可征收城建税', 'success');
      },
    },
    separatelyPlanned: {
      name: '计划单列市', level: 2, cost: 2000,
      reviewMonths: 8, // v2.4.6b: 考察期8个月
      baseRejectRate: 0.40,
      onSuccess: () => {
        gameState.cityStatus.isSeparatelyPlanned = true;
        gameState.fiscalRemitRate = (gameState.fiscalRemitRate || 1.0) + 0.20;
        gameState.fiscalSupportMonthly = (gameState.fiscalSupportMonthly || 0) + 200;
        gameState.reputation = clamp((gameState.reputation || 50) + 15, 0, 100);
        showNotification('计划单列市申报获批！财政直留中央（留成+20%），月度扶持+200万', 'success');
        logEvent('计划单列市申报获批，获得省级经济管理权限，省级财政不再分成', 'success');
      },
    },
    nationalNewArea: {
      name: '国家级新区', level: 3, cost: 5000,
      reviewMonths: 10, // v2.4.6b: 考察期10个月
      baseRejectRate: 0.30,
      onSuccess: () => {
        gameState.cityStatus.hasNationalNewArea = true;
        gameState.fiscalRemitRate = (gameState.fiscalRemitRate || 1.0) + 0.15;
        gameState.fiscalSupportMonthly = (gameState.fiscalSupportMonthly || 0) + 300;
        gameState.reputation = clamp((gameState.reputation || 50) + 20, 0, 100);
        const oldW = MAP_W, oldH = MAP_H;
        MAP_W = Math.round(MAP_W * 1.3);
        MAP_H = Math.round(MAP_H * 1.3);
        const newCells = new Array(MAP_W * MAP_H);
        for (let y = 0; y < MAP_H; y++) {
          for (let x = 0; x < MAP_W; x++) {
            if (x < oldW && y < oldH) { newCells[y * MAP_W + x] = mapCells[y * oldW + x]; }
            else { newCells[y * MAP_W + x] = { x, y, elev: 100 + Math.random() * 50, water: false, occupied: false, building: null }; }
          }
        }
        mapCells.length = 0;
        mapCells.push.apply(mapCells, newCells);
        gameState.cityStatus.newAreaExpanded = true;
        if (typeof generateTerrain === 'function') {
          for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
              if (x >= oldW || y >= oldH) {
                const idx = y * MAP_W + x;
                const cell = mapCells[idx];
                const nx = x / MAP_W * 3, ny = y / MAP_H * 2;
                const e1 = Math.sin(nx * 1.7) * Math.cos(ny * 2.3) * 40;
                const e2 = Math.sin(nx * 4.1 + 1.3) * Math.cos(ny * 3.7) * 20;
                const ex = 1 - Math.pow(Math.abs(x / MAP_W - 0.5) * 2, 4);
                cell.elev = 120 + e1 + e2 + (1 - ex) * 60 + Math.random() * 15;
                cell.water = cell.elev < 55;
              }
            }
          }
        }
        if (typeof renderTerrainToOffscreen === 'function') renderTerrainToOffscreen();
        if (typeof generateContours === 'function') contourSegments = generateContours(mapCells);
        showNotification(`国家级新区申报获批！地图扩展至${MAP_W}×${MAP_H}，财政留成+15%，月度扶持+300万`, 'success');
        logEvent(`国家级新区获批，可开发面积扩展至${MAP_W}×${MAP_H}，新区内企业所得税降至15%`, 'success');
      },
    },
  };

  const cfg = configs[type];
  if (!cfg) return;
  if (lv.id !== cfg.level) { showNotification('城市等级不符，无法申报', 'warn'); return; }
  if (gameState.treasury < cfg.cost) { showNotification(`财政不足，申报需¥${cfg.cost}万`, 'warn'); return; }
  // v2.4.6b: 已有申报在进行中
  if (gameState.adminApplication && gameState.adminApplication.status === 'reviewing') {
    showNotification('已有申报正在考察期内，无法重复申报', 'warn'); return;
  }

  showModal('行政区划申报',
    `<p style="font-size:14px;">确认申报<strong>${cfg.name}</strong>？</p>
     <p style="font-size:13px;color:var(--text-2);margin-top:8px;">申报费用：¥${cfg.cost}万（不退还）</p>
     <p style="font-size:13px;color:var(--text-2);">考察期：${cfg.reviewMonths}个月</p>
     <p style="font-size:12px;color:var(--orange);margin-top:8px;">⚠ 考察期内若腐败、污染、市民不满等负面指标过高，审核将被驳回。</p>`,
    [
      {
        text: '确认申报', color: 'blue', action: () => {
          gameState.treasury -= cfg.cost;
          // v2.4.6b: 启动考察期而非立即审批
          gameState.adminApplication = {
            type: type,
            turnSubmitted: gameState.turn,
            reviewMonths: cfg.reviewMonths,
            baseRejectRate: cfg.baseRejectRate,
            status: 'reviewing',
          };
          showNotification(`${cfg.name}申报已提交，进入${cfg.reviewMonths}个月考察期`, 'info');
          logEvent(`${cfg.name}申报已提交，进入考察期（${cfg.reviewMonths}个月）`, 'info');
          updateUI();
          renderSheet(currentTab);
        }
      },
      { text: '取消', color: 'gray', action: closeModal }
    ],
    '行政区划申报', 'info'
  );
}

// v2.4.6b: 城市荣誉申报（文明城市、卫生城市）
function applyCityHonor(type) {
  if (!gameState.cityHonors) gameState.cityHonors = { civilizedCity: false, sanitaryCity: false, civilizedApplying: false, sanitaryApplying: false, civilizedReviewTurn: 0, sanitaryReviewTurn: 0 };
  const lv = getCityLevel();
  if (lv.id < 1) { showNotification('城市等级不足，需县级及以上', 'warn'); return; }

  const configs = {
    civilized: {
      name: '全国文明城市', reviewMonths: 6, cost: 200,
      onSuccess: () => {
        gameState.cityHonors.civilizedCity = true;
        gameState.cityHonors.civilizedApplying = false;
        gameState.happiness = clamp((gameState.happiness || 50) + 8, 0, 100);
        gameState.reputation = clamp((gameState.reputation || 50) + 10, 0, 100);
        showNotification('获评全国文明城市！幸福度+8，声誉+10', 'success');
        logEvent('获评全国文明城市，市民幸福度和城市形象大幅提升', 'success');
      },
      onFail: () => {
        gameState.cityHonors.civilizedApplying = false;
        showNotification('文明城市评选未通过，考察期内部分指标未达标', 'danger');
        logEvent('文明城市评选未通过，考察期内指标波动较大', 'warn');
      },
    },
    sanitary: {
      name: '国家卫生城市', reviewMonths: 4, cost: 150,
      onSuccess: () => {
        gameState.cityHonors.sanitaryCity = true;
        gameState.cityHonors.sanitaryApplying = false;
        gameState.happiness = clamp((gameState.happiness || 50) + 5, 0, 100);
        gameState.healthcareIndex = clamp((gameState.healthcareIndex || 15) + 10, 0, 100);
        showNotification('获评国家卫生城市！幸福度+5，医疗指数+10', 'success');
        logEvent('获评国家卫生城市，城市卫生水平和医疗指数提升', 'success');
      },
      onFail: () => {
        gameState.cityHonors.sanitaryApplying = false;
        showNotification('卫生城市评选未通过，考察期内部分指标未达标', 'danger');
        logEvent('卫生城市评选未通过，考察期内指标波动较大', 'warn');
      },
    },
  };

  const cfg = configs[type];
  if (!cfg) return;
  if (gameState.treasury < cfg.cost) { showNotification(`财政不足，申报需¥${cfg.cost}万`, 'warn'); return; }

  showModal('城市荣誉申报',
    `<p style="font-size:14px;">确认申报<strong>${cfg.name}</strong>？</p>
     <p style="font-size:13px;color:var(--text-2);margin-top:8px;">申报费用：¥${cfg.cost}万</p>
     <p style="font-size:13px;color:var(--text-2);">考察期：${cfg.reviewMonths}个月</p>
     <p style="font-size:12px;color:var(--orange);margin-top:8px;">⚠ 考察期内需持续保持各项指标达标，否则评选不通过。</p>`,
    [
      {
        text: '确认申报', color: 'blue', action: () => {
          gameState.treasury -= cfg.cost;
          if (type === 'civilized') {
            gameState.cityHonors.civilizedApplying = true;
            gameState.cityHonors.civilizedReviewTurn = cfg.reviewMonths;
          } else {
            gameState.cityHonors.sanitaryApplying = true;
            gameState.cityHonors.sanitaryReviewTurn = cfg.reviewMonths;
          }
          showNotification(`${cfg.name}申报已提交，进入${cfg.reviewMonths}个月考察期`, 'info');
          logEvent(`${cfg.name}申报已提交，进入考察期`, 'info');
          updateUI();
          renderSheet(currentTab);
        }
      },
      { text: '取消', color: 'gray', action: closeModal }
    ],
    '城市荣誉申报', 'info'
  );
}

function applySubway() {
  if (gameState.subwayApproved) { showNotification('地铁已获批', 'info'); return; }
  if (gameState.population < 3000000) { showNotification('人口不足300万，无法申报', 'warn'); return; }
  if (gameState.treasury < 2000) { showNotification('财政不足，需至少¥2000万', 'warn'); return; }
  const rejectChance = 0.25;
  if (Math.random() < rejectChance) { showNotification('地铁申报被上级驳回', 'danger'); logEvent('地铁建设申报被驳回', 'warn'); gameState.treasury -= 200; updateUI(); return; }
  gameState.subwayApproved = true; gameState.treasury -= 2000;
  gameState.activeLayers.subway = true;
  showNotification('地铁建设申报获批！', 'success'); logEvent('地铁建设申报获批', 'success');
  // v2.4.7b: 交通获批钩子
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('transport:approved', { type: 'subway', approved: true });
  updateUI(); renderSheet(currentTab);
}

// v2.2.6: 轻轨建设申报（人口达150万可申报）
function applyLightRail() {
  if (gameState.lightRailApproved) { showNotification('轻轨已获批', 'info'); return; }
  if (gameState.population < 1500000) { showNotification('人口不足150万，无法申报', 'warn'); return; }
  if (gameState.treasury < 1000) { showNotification('财政不足，需至少¥1000万', 'warn'); return; }
  const rejectChance = 0.2;
  if (Math.random() < rejectChance) { showNotification('轻轨申报被上级驳回', 'danger'); logEvent('轻轨建设申报被驳回', 'warn'); gameState.treasury -= 100; updateUI(); return; }
  gameState.lightRailApproved = true; gameState.treasury -= 1000;
  gameState.activeLayers.elevated = true;
  showNotification('轻轨建设申报获批！', 'success'); logEvent('轻轨建设申报获批', 'success');
  // v2.4.7b: 交通获批钩子
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('transport:approved', { type: 'lightRail', approved: true });
  updateUI(); renderSheet(currentTab);
}

// v2.4.7: 机场建设申报
function applyAirport() {
  if (gameState.airportApproved) { showNotification('机场已获批', 'info'); return; }
  if (gameState.population < 200000) { showNotification('人口不足20万，无法申报', 'warn'); return; }
  if (gameState.cityLevelId < 2) { showNotification('需地级市以上才能申报机场', 'warn'); return; }
  if (gameState.treasury < 3000) { showNotification('财政不足，需至少¥3000万', 'warn'); return; }
  // v2.5.0b: 驳回后冷却期内禁止重新申请
  if (gameState.airportCooldown && gameState.airportCooldown > gameState.turn) {
    const remaining = gameState.airportCooldown - gameState.turn;
    showNotification(`机场申请被驳回，需等待${remaining}个月后方可重新申请`, 'warn'); return;
  }
  const rejectChance = 0.3;
  if (Math.random() < rejectChance) {
    showNotification('机场申报被上级驳回，12个月内不可重新申请', 'danger');
    logEvent('机场建设申报被驳回', 'warn');
    gameState.treasury -= 300;
    gameState.airportCooldown = gameState.turn + 12; // v2.5.0b: 12个月冷却期
    updateUI(); return;
  }
  gameState.airportApproved = true; gameState.treasury -= 3000;
  showNotification('机场建设申报获批！', 'success'); logEvent('机场建设申报获批', 'success');
  // v2.4.7b: 交通获批钩子
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('transport:approved', { type: 'airport', approved: true });
  updateUI(); renderSheet(currentTab);
}

// v2.4.7c: 为机场新建跑道
function addAirportRunway(buildingIdx, cost) {
  const b = gameState.buildings[buildingIdx];
  if (!b || b.type !== 'airport') return;
  if (!b.runways || b.runways.length >= 4) {
    showNotification('已达最大跑道数量（4条）', 'info'); return;
  }
  if (gameState.treasury < cost) { showNotification(`财政不足，需至少¥${cost}万`, 'warn'); return; }
  // v2.4.7c: 优先与现有跑道垂直方向
  const existingDirs = (b.runways || []).map(r => r.direction);
  let preferVertical = existingDirs.includes('horizontal');
  // 从机场航站楼出发寻找跑道
  const runway = findAirportRunway(b.x, b.y, preferVertical);
  if (runway.length <= 5) {
    showNotification('附近空间不足，无法新建跑道！需至少6格直线空地。', 'warn'); return;
  }
  // 检查与现有跑道是否重叠
  const newCells = runway.cells;
  const existingCells = new Set();
  for (const r of (b.runways || [])) {
    for (const c of r.cells) existingCells.add(c.x + ',' + c.y);
  }
  let overlap = false;
  for (const c of newCells) {
    if (existingCells.has(c.x + ',' + c.y)) { overlap = true; break; }
  }
  if (overlap) { showNotification('新跑道与现有跑道重叠', 'warn'); return; }
  // 扣费并添加跑道
  gameState.treasury -= cost;
  gameState.achievementStats.totalMoneySpent += cost;
  const direction = newCells[0].x === newCells[newCells.length - 1].x ? 'vertical' : 'horizontal';
  b.runways.push({ cells: newCells, length: runway.length, direction });
  // 更新机场等级和贸易收入
  const cls = getAirportClass(b.runways);
  b.airportClass = cls.code;
  b.tradeIncome = cls.tradeMult * 10;
  // v2.4.7c: runwayCells 包含所有跑道的格子（避免旧跑道格子失去保护）
  b.runwayCells = b.runways.flatMap(r => r.cells);
  b.runwayLength = b.runways.reduce((sum, r) => sum + r.length, 0);
  showNotification(`新建跑道完成！当前${b.runways.length}条跑道，等级${cls.code}`, 'success');
  logEvent(`${b.customName}新建第${b.runways.length}条跑道，机场等级提升为${cls.code}`, 'success');
  closeModal();
  updateUI(); renderMap();
  showPlacedBuildingDetail(buildingIdx);
}

// v2.4.7c: 机场申报国际机场 — 需至少4条D级跑道
function applyInternationalAirport(buildingIdx) {
  const b = gameState.buildings[buildingIdx];
  if (!b || b.type !== 'airport') return;
  if (b.isInternational) { showNotification('已是国际机场', 'info'); return; }
  // v2.4.7c: 使用新等级系统检查是否满足国际机场门槛
  const cls = getAirportClass(b.runways || b.runwayLength || 6);
  const runwayCount = cls.runwayCount || 1;
  const letterOrder = ['C', 'D', 'E', 'F'];
  const letterIdx = letterOrder.indexOf(cls.letter || 'C');
  const reqLetterIdx = letterOrder.indexOf(INTERNATIONAL_AIRPORT_REQ.minLetter);
  if (runwayCount < INTERNATIONAL_AIRPORT_REQ.runwayCount || letterIdx < reqLetterIdx) {
    showNotification(`需至少${INTERNATIONAL_AIRPORT_REQ.runwayCount}条${INTERNATIONAL_AIRPORT_REQ.minLetter}级跑道才能申报国际机场（当前${cls.code}）`, 'warn'); return;
  }
  if (gameState.treasury < 2000) { showNotification('财政不足，需至少¥2000万', 'warn'); return; }
  // v2.5.0b: 国际机场驳回后冷却期内禁止重新申请
  if (gameState.intlAirportCooldown && gameState.intlAirportCooldown > gameState.turn) {
    const remaining = gameState.intlAirportCooldown - gameState.turn;
    showNotification(`国际机场申请被驳回，需等待${remaining}个月后方可重新申请`, 'warn'); return;
  }
  const rejectChance = 0.25;
  if (Math.random() < rejectChance) {
    showNotification('国际机场申报被驳回，12个月内不可重新申请', 'danger');
    logEvent('国际机场申报被驳回', 'warn');
    gameState.treasury -= 200;
    gameState.intlAirportCooldown = gameState.turn + 12; // v2.5.0b: 12个月冷却期
    updateUI(); return;
  }
  gameState.treasury -= 2000;
  b.isInternational = true;
  b.customName = generateAirportName(gameState.cityName, true);
  b.tradeIncome = (b.tradeIncome || 0) * 2; // v2.4.7b: 空值保护
  b.internationalUpgradeTurn = gameState.turn; // v2.4.7b: 记录升级时间供新闻触发
  // v2.4.7b: 国际机场升级钩子
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('transport:internationalUpgraded', { building: b, buildingIdx });
  showNotification('国际机场申报获批！', 'success'); logEvent(`${b.customName}获批为国际机场`, 'success');
  // v2.4.7b: 刷新建筑详情弹窗和地图
  closeModal();
  updateUI(); renderMap();
  showPlacedBuildingDetail(buildingIdx);
}

function applyUniversity() {
  if (gameState.universityApproved) { showNotification('大学建设已获批', 'info'); return; }
  if (gameState.population < 100000) { showNotification('人口不足10万，无法申报', 'warn'); return; }
  if (gameState.treasury < 1500) { showNotification('财政不足，需至少¥1500万', 'warn'); return; }
  const rejectChance = 0.2;
  if (Math.random() < rejectChance) { showNotification('大学建设申报被上级驳回', 'danger'); logEvent('大学建设申报被驳回', 'warn'); gameState.treasury -= 100; updateUI(); return; }
  gameState.universityApproved = true; gameState.treasury -= 1500;
  showNotification('大学建设申报获批！可建造高等学府', 'success'); logEvent('大学建设申报获批', 'success');
  updateUI(); renderSheet(currentTab);
}

function upgradeUniversity(buildingIdx) {
  const b = gameState.buildings[buildingIdx]; if (!b || b.type !== 'university') return;
  if (b.universityUpgraded) { showNotification('该大学已升本', 'info'); return; }
  const monthsSinceBuilt = gameState.turn - (b.universityBuiltMonth || 0);
  if (monthsSinceBuilt < 48) { showNotification(`建校未满4年（还需${48 - monthsSinceBuilt}个月）`, 'warn'); return; }
  if (gameState.treasury < 2000) { showNotification('升本需¥2000万，财政不足', 'warn'); return; }
  gameState.treasury -= 2000; b.universityUpgraded = true; b.level = (b.level || 1) + 1;
  if (b.customName) { b.customName = b.customName.replace('师范高等专科学校', '师范学院').replace('医学高等专科学校', '医学院'); }
  showNotification(`${b.customName}升格为本科院校！`, 'success'); logEvent(`${b.customName}升格为本科院校`, 'success');
  updateUI(); renderSheet(currentTab);
}

function applySkyscraper() {
  const heightEl = document.getElementById('sky-height'); if (!heightEl) return;
  const height = parseInt(heightEl.value); const s = gameState;
  if (height < 50 || height > 800) { showNotification('高度需在50-800米之间', 'warn'); return; }
  const lv = getCityLevel();
  if (lv.id <= 0) { showNotification('乡镇级别不允许建设摩天大楼！', 'danger'); return; }
  const costMult = lv.id === 4 ? 1.0 : lv.id === 3 ? 1.2 : lv.id === 2 ? 3.0 : lv.id === 1 ? 6.0 : 10.0;
  const cost = Math.round(height * 8 * costMult);
  if (s.treasury < cost) { showNotification(`财政不足，需要¥${cost}万（${lv.name}建造成本${costMult}倍）`, 'warn'); return; }
  if (height >= 500 && Math.random() < 0.4) { showNotification(`${height}米摩天大楼申报被驳回（高度过高）`, 'danger'); logEvent(`${height}米摩天大楼申报被驳回`, 'warn'); s.treasury -= 50; updateUI(); return; }
  if (height >= 300 && s.population < 2000000) { showNotification(`人口不足200万，${height}米摩天大楼申报被驳回`, 'danger'); logEvent(`${height}米摩天大楼因人口不足被驳回`, 'warn'); s.treasury -= 50; updateUI(); return; }
  const sk = { height, name: `${s.cityName}${height}米大厦`, built: s.turn, costMult };
  s.skyscrapers.push(sk); s.treasury -= cost;
  const revMult = lv.id === 4 ? 1.0 : lv.id === 3 ? 0.6 : lv.id === 2 ? 0.3 : lv.id === 1 ? 0.1 : 0;
  const gdpBoost = height * 0.5 * revMult;
  const happyBoost = Math.round((height >= 300 ? 5 : height >= 200 ? 3 : 1) * revMult);
  const repBoost = Math.round((height >= 400 ? 8 : height >= 200 ? 4 : 2) * revMult);
  if (lv.id < 3) { const maintCost = Math.round(height * 0.5 * (3 - lv.id)); sk.monthlyMaint = maintCost; showNotification(`${height}米摩天大楼建设完成！${lv.name}建造成本${costMult}倍，月维护¥${maintCost}万`, 'success'); logEvent(`${height}米摩天大楼建成，${lv.name}级城市月维护¥${maintCost}万`, lv.id >= 3 ? 'success' : 'warn'); }
  else { showNotification(`${height}米摩天大楼建设完成！`, 'success'); logEvent(`${height}米摩天大楼建成，GDP+${(gdpBoost/10).toFixed(1)}%`, 'success'); }
  s.gdpMult *= 1 + gdpBoost / 1000; s.happiness = clamp(s.happiness + happyBoost, 0, 100); s.reputation = clamp(s.reputation + repBoost, 0, 100);
  updateUI(); renderSheet(currentTab);
}

function takeLoan(amount, term) {
  const perfScore = Math.round(gameState.livabilityScore * 0.3 + gameState.prosperityScore * 0.2 + gameState.happiness * 0.2 + (100 - gameState.corruption) * 0.15 + gameState.reputation * 0.15);
  const lv = getCityLevel(); const baseLimit = lv.treasury;
  const scoreMult = 0.3 + perfScore / 200; const corruptionPenalty = 1 - gameState.corruption / 100;
  const maxLoan = Math.round(baseLimit * scoreMult * corruptionPenalty);
  const existingDebt = (gameState.loans || []).reduce((s, l) => s + l.amount + (l.overdueInterest || 0), 0);
  const availableLoan = Math.max(0, maxLoan - existingDebt);
  if (amount > availableLoan) { showNotification(`贷款额度不足！政绩评估可贷¥${formatMoney(maxLoan * 10000)}，已用¥${formatMoney(existingDebt * 10000)}，剩余可贷¥${formatMoney(availableLoan * 10000)}`, 'warn'); return; }
  const annualRate = ((gameState.policies.interestRate || 3) + 2) / 100; const monthlyRate = annualRate / 12;
  const monthlyPayment = amount * monthlyRate * Math.pow(1 + monthlyRate, term) / (Math.pow(1 + monthlyRate, term) - 1);
  const totalPay = monthlyPayment * term; const totalInterest = totalPay - amount;
  showModal('确认贷款', `<p>向银行申请财政贷款¥${formatMoney(amount * 10000)}。</p><p>贷款期限：${term}个月</p><p>年利率：${((gameState.policies.interestRate || 3) + 2).toFixed(1)}%</p><p>月还款：¥${formatMoney(monthlyPayment * 10000)}</p><p>总还款：¥${formatMoney(totalPay * 10000)}（利息¥${formatMoney(totalInterest * 10000)}）</p><p style="font-size:13px;color:var(--text-3);">政绩评分：${perfScore}，可贷额度：¥${formatMoney(maxLoan * 10000)}，剩余可贷：¥${formatMoney(availableLoan * 10000)}</p>`, [{ text: '确认贷款', color: 'blue', action: () => { closeModal(); gameState.loans.push({ amount, term, remainingMonths: term, monthlyPayment, startDate: gameState.turn }); gameState.treasury += amount; logEvent(`申请财政贷款¥${formatMoney(amount * 10000)}（${term}月期，月还¥${formatMoney(monthlyPayment * 10000)}）`, 'info'); showNotification(`贷款到账：¥${formatMoney(amount * 10000)}`, 'success'); updateUI(); }}, { text: '取消', color: 'gray', action: closeModal }], '银行贷款', 'info');
}

// ============== v2.3.5c: 企业板块（折叠组内，卡片点击触发弹窗） ==============
let _enterpriseSubTab = 'stateOwned';

function renderEnterpriseSection() {
  const enterprises = gameState.enterprises || [];
  if (enterprises.length === 0) {
    return '<div style="padding:12px;text-align:center;color:var(--text-3);font-size:13px;">暂无企业入驻。划定商业区或工业区后将自动生成企业。</div>';
  }
  const stats = getEnterpriseStats();
  let html = '';
  // 统计概览
  html += '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">';
  html += `<div style="flex:1;min-width:60px;padding:6px;background:var(--separator-light);border-radius:var(--radius-xs);text-align:center;"><div style="font-size:18px;font-weight:600;color:var(--text);">${stats.total}</div><div style="font-size:10px;color:var(--text-3);">企业总数</div></div>`;
  html += `<div style="flex:1;min-width:60px;padding:6px;background:var(--separator-light);border-radius:var(--radius-xs);text-align:center;"><div style="font-size:14px;font-weight:600;color:var(--accent);">${stats.stateOwned}</div><div style="font-size:10px;color:var(--text-3);">公有</div></div>`;
  html += `<div style="flex:1;min-width:60px;padding:6px;background:var(--separator-light);border-radius:var(--radius-xs);text-align:center;"><div style="font-size:14px;font-weight:600;color:var(--green);">${stats.private}</div><div style="font-size:10px;color:var(--text-3);">民营</div></div>`;
  html += `<div style="flex:1;min-width:60px;padding:6px;background:var(--separator-light);border-radius:var(--radius-xs);text-align:center;"><div style="font-size:14px;font-weight:600;color:#2d6a8c;">${stats.foreign || 0}</div><div style="font-size:10px;color:var(--text-3);">外资</div></div>`;
  html += `<div style="flex:1;min-width:60px;padding:6px;background:var(--separator-light);border-radius:var(--radius-xs);text-align:center;"><div style="font-size:14px;font-weight:600;color:var(--purple);">${stats.mixed}</div><div style="font-size:10px;color:var(--text-3);">混合</div></div>`;
  html += `<div style="flex:1;min-width:60px;padding:6px;background:var(--separator-light);border-radius:var(--radius-xs);text-align:center;"><div style="font-size:14px;font-weight:600;color:var(--green);">+${stats.totalGdp}</div><div style="font-size:10px;color:var(--text-3);">月GDP</div></div>`;
  html += `<div style="flex:1;min-width:60px;padding:6px;background:var(--separator-light);border-radius:var(--radius-xs);text-align:center;"><div style="font-size:14px;font-weight:600;color:var(--accent);">+${stats.totalTax}</div><div style="font-size:10px;color:var(--text-3);">年税收</div></div>`;
  html += '</div>';

  // 子标签
  const subs = [
    { id: 'stateOwned', name: '公有企业', color: 'var(--accent)' },
    { id: 'private', name: '民营企业', color: 'var(--green)' },
    { id: 'foreign', name: '外资企业', color: '#2d6a8c' },
    { id: 'mixed', name: '混合所有制', color: 'var(--purple)' },
  ];
  html += '<div class="gov-subnav" style="margin-bottom:8px;">';
  for (const sub of subs) {
    const count = sub.id === 'stateOwned' ? stats.stateOwned : sub.id === 'private' ? stats.private : sub.id === 'foreign' ? (stats.foreign || 0) : stats.mixed;
    html += `<button class="gov-subnav-btn ${_enterpriseSubTab === sub.id ? 'active' : ''}" style="${_enterpriseSubTab === sub.id ? 'border-bottom-color:' + sub.color : ''}" onclick="_enterpriseSubTab='${sub.id}';renderSheet('gov');">${sub.name}(${count})</button>`;
  }
  html += '</div>';

  const byOwnership = getEnterprisesByOwnership();
  const list = byOwnership[_enterpriseSubTab] || [];
  if (list.length === 0) {
    html += '<div style="padding:8px;text-align:center;color:var(--text-3);font-size:13px;">暂无此类企业</div>';
  } else {
    for (const ent of list) {
      html += renderEnterpriseCard(ent);
    }
  }
  return html;
}

// v2.3.5c: 企业卡片 — 简洁信息，点击触发弹窗（类似公共建筑升级弹窗）
function renderEnterpriseCard(ent) {
  const typeDef = ENTERPRISE_TYPES[ent.ownership];
  const isStateOwned = ent.ownership === 'stateOwned';
  // v2.3.5c: 使用简称显示，颜色统一用CSS变量
  // v2.3.6c: 新增外资企业颜色
  const cardColor = isStateOwned ? 'var(--accent)' : ent.ownership === 'private' ? 'var(--green)' : ent.ownership === 'foreign' ? '#2d6a8c' : 'var(--purple)';
  let html = `<div onclick="showEnterpriseModal('${ent.id}')" style="background:var(--bg-card);border:1px solid var(--separator);border-left:3px solid ${cardColor};border-radius:var(--radius-xs);padding:10px;margin-bottom:8px;cursor:pointer;box-shadow:var(--shadow-xs);">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;">`;
  html += `<div style="flex:1;">`;
  html += `<div style="font-size:14px;font-weight:600;color:var(--text);">${ent.shortName || ent.name}</div>`;
  html += `<div style="font-size:11px;color:var(--text-3);margin-top:2px;">${typeDef.shortName} · ${ent.type === 'commercial' ? '商贸' : '制造'} · 注册${ent.capital}万</div>`;
  html += `</div>`;
  // 右侧箭头SVG（统一颜色）
  html += `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-3);"><polyline points="9 18 15 12 9 6"/></svg>`;
  html += `</div>`;
  html += `</div>`;
  return html;
}

// v2.3.5c: 企业详情弹窗（类似公共建筑升级弹窗）
function showEnterpriseModal(entId) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  const typeDef = ENTERPRISE_TYPES[ent.ownership];
  const isStateOwned = ent.ownership === 'stateOwned';
  const isMixed = ent.ownership === 'mixed';
  const cardColor = isStateOwned ? 'var(--accent)' : ent.ownership === 'private' ? 'var(--green)' : ent.ownership === 'foreign' ? '#2d6a8c' : 'var(--purple)';
  const realProfit = getEnterpriseProfit(ent);
  const realTax = getEnterpriseTax(ent);

  // 弹窗body — 与公共建筑升级弹窗统一风格
  let body = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">`;
  body += `<div style="width:36px;height:36px;border-radius:8px;background:${cardColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">`;
  body += `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h6"/></svg>`;
  body += `</div>`;
  body += `<div><div style="font-size:16px;font-weight:600;">${ent.name}</div>`;
  body += `<div style="font-size:12px;color:var(--text-3);">${typeDef.name} · ${ent.type === 'commercial' ? '商贸类' : '制造类'}</div></div>`;
  body += `</div>`;

  // 信息列表 — 用effect-list样式（与公共建筑弹窗一致）
  body += `<div class="effect-list">`;
  body += `<div class="effect-item"><span class="eff-label">注册资本</span><span class="eff-val">${ent.capital}万</span></div>`;
  if (isStateOwned) {
    body += `<div class="effect-item"><span class="eff-label">月GDP贡献</span><span class="eff-val pos">+${Math.round(ent.gdpContribution * (1 + (ent.profitBonus || 0)))}</span></div>`;
    if (ent.fiscalSupport > 0) {
      body += `<div class="effect-item"><span class="eff-label">月财政扶持</span><span class="eff-val pos">+${ent.fiscalSupport}</span></div>`;
    }
  } else {
    body += `<div class="effect-item"><span class="eff-label">年税收</span><span class="eff-val pos">+${realTax}万</span></div>`;
    if (ent.fiscalSupport > 0) {
      body += `<div class="effect-item"><span class="eff-label">月财政扶持</span><span class="eff-val pos">+${ent.fiscalSupport}</span></div>`;
    }
  }
  body += `<div class="effect-item"><span class="eff-label">年利润</span><span class="eff-val ${realProfit > 0 ? 'pos' : 'neg'}">${realProfit}万</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">股权结构</span><span class="eff-val">国有${ent.equity.state}% · 民营${ent.equity.private}%${ent.equity.foreign > 0 ? ' · 外资' + ent.equity.foreign + '%' : ''}</span></div>`;
  if (ent.capitalInjected > 0) {
    body += `<div class="effect-item"><span class="eff-label">已注资</span><span class="eff-val">${ent.capitalInjected}万</span></div>`;
  }
  if (ent.reformed) {
    body += `<div class="effect-item"><span class="eff-label">改制状态</span><span class="eff-val">已完成所有制改革</span></div>`;
  }
  if (ent.acquired) {
    body += `<div class="effect-item"><span class="eff-label">并购状态</span><span class="eff-val">已并购/回购</span></div>`;
  }
  body += `</div>`;

  // v2.3.5c: 按钮数组 — 与公共建筑升级弹窗底部按钮统一
  const buttons = [];
  if (!ent.acquired && !ent.ownedBy) {
    if (isStateOwned) {
      buttons.push({ text: '财政注资', color: 'blue', action: () => { closeModal(); injectCapital(ent.id); } });
      buttons.push({ text: '所有制改革', color: 'gold', action: () => { closeModal(); reformOwnership(ent.id); } });
      buttons.push({ text: '并购民企', color: 'green', action: () => { closeModal(); acquirePrivate(ent.id); } });
    }
    if (isMixed) {
      buttons.push({ text: '回购股权', color: 'purple', action: () => { closeModal(); buybackEquity(ent.id); } });
    }
    buttons.push({ text: '企业改名', color: 'gray', action: () => { closeModal(); showRenameModal(ent.id); } });
  }
  buttons.push({ text: '关闭', color: 'gray', action: closeModal });

  showModal(ent.shortName || ent.name, body, buttons, '企业详情', 'info');
}

// v2.3.5b: 改名弹窗
function showRenameModal(entId) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  showModal('企业改名', `<p>修改「${ent.name}」的名称：</p><input id="renameInput" type="text" value="${ent.name}" style="width:100%;padding:8px;border:1px solid var(--separator);border-radius:4px;font-size:14px;" />`, [
    { text: '确认改名', color: 'blue', action: () => {
      const input = document.getElementById('renameInput');
      if (input) renameEnterprise(entId, input.value);
      else closeModal();
    }},
    { text: '取消', color: 'gray', action: closeModal },
  ], '企业改名', 'info');
}

// ============== 企业投资功能 ==============
function injectCapital(entId) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  if (ent.ownership !== 'stateOwned') { showNotification('只能对公有企业进行注资', 'warn'); return; }
  const cost = Math.round(ent.capital * 0.1);
  showModal('财政注资', `<p>向「${ent.shortName || ent.name}」注入财政资金${cost}万，增加注册资本。</p><p>当前注册资本：${ent.capital}万</p><p style="color:var(--text-3);font-size:13px;">注资主要扩大企业资本规模，有概率小幅提升利润（2%-5%），经营利润维持在较低水平。</p><p style="color:var(--text-3);font-size:13px;">当前财政余额：${gameState.treasury}万</p>`, [{ text: '确认注资', color: 'blue', action: () => {
    closeModal();
    if (gameState.treasury < cost) { showNotification('财政资金不足', 'warn'); return; }
    gameState.treasury -= cost;
    ent.capital += cost;
    ent.capitalInjected += cost;
    // v2.3.6: 注资只增加注册资本，利润提升极小且有概率
    const lucky = Math.random() < 0.35; // 35%概率小幅提升利润
    const smallBonus = lucky ? (0.02 + Math.random() * 0.03) : 0; // 2%-5%
    if (smallBonus > 0) {
      ent.profitBonus = (ent.profitBonus || 0) + smallBonus;
      ent.annualProfit = Math.round(ent.annualProfit * (1 + smallBonus));
      ent.fiscalSupport = Math.round(ent.fiscalSupport * (1 + smallBonus));
      ent.gdpContribution = Math.round(ent.gdpContribution * (1 + smallBonus));
    }
    logEvent(`财政注资「${ent.shortName || ent.name}」${cost}万，注册资本增至${ent.capital}万${smallBonus > 0 ? '，利润小幅提升' : ''}`, 'success');
    showNotification(`注资成功，注册资本增至${ent.capital}万${smallBonus > 0 ? '，利润小幅提升' : '，利润暂无明显变化'}`, 'success');
    gameState.corruption = Math.min(100, (gameState.corruption || 0) + 1);
    updateUI();
  }}, { text: '取消', color: 'gray', action: closeModal }], '企业注资', 'info');
}

function reformOwnership(entId) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  if (ent.ownership !== 'stateOwned') { showNotification('只能对公有企业进行所有制改革', 'warn'); return; }
  if (ent.reformed) { showNotification('该企业已完成所有制改革', 'warn'); return; }
  showModal('所有制改革', `<p>对「${ent.name}」进行所有制改革，转为民营企业。</p><p>改革后：</p><ul style="font-size:13px;color:var(--text-2);"><li>企业所有制转为民营</li><li>GDP贡献提升20%</li><li>财政扶持降为0，但产生税收</li><li>获得一次性改革收益${Math.round(ent.capital * 0.2)}万</li><li>纪委注意度+5</li></ul>`, [{ text: '确认改革', color: 'gold', action: () => {
    closeModal();
    ent.ownership = 'private';
    ent.reformed = true;
    ent.equity = { state: 0, private: 100, foreign: 0 };
    ent.gdpContribution = Math.round(ent.gdpContribution * 1.2);
    ent.fiscalSupport = 0;
    const reformIncome = Math.round(ent.capital * 0.2);
    gameState.treasury += reformIncome;
    gameState.corruption = Math.min(100, (gameState.corruption || 0) + 5);
    logEvent(`「${ent.name}」完成所有制改革，转为民营企业，获得改革收益${reformIncome}万`, 'info');
    showNotification(`所有制改革完成，获得${reformIncome}万`, 'success');
    updateUI();
  }}, { text: '取消', color: 'gray', action: closeModal }], '所有制改革', 'warn');
}

function acquirePrivate(entId) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  if (ent.ownership !== 'stateOwned') { showNotification('只能由公有企业发起并购', 'warn'); return; }
  // v2.4.0: 修复只匹配private不匹配foreign的bug
  const targets = (gameState.enterprises || []).filter(e => (e.ownership === 'private' || e.ownership === 'foreign') && !e.acquired && e.id !== entId);
  if (targets.length === 0) { showNotification('没有可并购的民营企业', 'warn'); return; }
  let targetHtml = '<p>选择要并购的民营企业：</p>';
  for (const t of targets.slice(0, 5)) {
    const cost = Math.round(t.capital * 0.8);
    targetHtml += `<button onclick="confirmAcquire('${entId}','${t.id}')" style="display:block;width:100%;text-align:left;padding:8px;margin:4px 0;background:var(--bg-card);border:1px solid var(--separator);border-radius:4px;cursor:pointer;font-size:13px;">${t.name}<br><span style="font-size:11px;color:var(--text-3);">注册资本${t.capital}万 · 并购成本${cost}万</span></button>`;
  }
  showModal('并购民营企业', targetHtml, [{ text: '关闭', color: 'gray', action: closeModal }], '企业并购', 'info');
}

function confirmAcquire(acquirerId, targetId) {
  const acquirer = (gameState.enterprises || []).find(e => e.id === acquirerId);
  const target = (gameState.enterprises || []).find(e => e.id === targetId);
  if (!acquirer || !target) return;
  const cost = Math.round(target.capital * 0.8);
  closeModal();
  showModal('确认并购', `<p>由「${acquirer.name}」并购「${target.name}」。</p><p>并购成本：${cost}万</p><p>并购后：</p><ul style="font-size:13px;"><li>目标企业转为公有</li><li>GDP贡献合并</li><li>财政扶持增加</li></ul><p style="color:var(--text-3);font-size:13px;">当前财政余额：${gameState.treasury}万</p>`, [{ text: '确认并购', color: 'green', action: () => {
    closeModal();
    if (gameState.treasury < cost) { showNotification('财政资金不足', 'warn'); return; }
    gameState.treasury -= cost;
    target.ownership = 'stateOwned';
    target.acquired = true;
    target.equity = { state: 100, private: 0, foreign: 0 };
    acquirer.gdpContribution += Math.round(target.gdpContribution * 0.8);
    acquirer.annualProfit += Math.round(target.annualProfit * 0.5 || 0);
    acquirer.fiscalSupport += Math.round(target.gdpContribution * 0.1);
    gameState.corruption = Math.min(100, (gameState.corruption || 0) + 3);
    logEvent(`「${acquirer.name}」成功并购「${target.name}」，花费${cost}万`, 'success');
    showNotification(`并购成功，「${target.name}」转为公有`, 'success');
    updateUI();
  }}, { text: '取消', color: 'gray', action: closeModal }], '企业并购', 'info');
}

// v2.3.5b: 混合所有制按比例回购
function buybackEquity(entId) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  if (ent.ownership !== 'mixed') { showNotification('只能对混合所有制企业回购股权', 'warn'); return; }
  // v2.3.5b: 选择回购比例
  const privatePct = ent.equity.private;
  const foreignPct = ent.equity.foreign;
  let html = `<p>选择回购「${ent.name}」的股权比例：</p>`;
  html += '<p style="font-size:11px;color:var(--text-3);">当前股权：国有' + ent.equity.state + '% · 民营' + privatePct + '%' + (foreignPct > 0 ? ' · 外资' + foreignPct + '%' : '') + '</p>';
  // 计算不同比例的回购成本
  const fullCost = Math.round(ent.capital * (privatePct + foreignPct) / 100 * 0.8);
  const halfCost = Math.round(fullCost * 0.5);
  html += `<button onclick="confirmBuyback('${entId}', 0.5, ${halfCost})" style="display:block;width:100%;text-align:left;padding:8px;margin:4px 0;background:var(--bg-card);border:1px solid var(--separator);border-radius:4px;cursor:pointer;font-size:13px;">回购50%民营股权<br><span style="font-size:11px;color:var(--text-3);">成本${halfCost}万 · 国有股权+${Math.round((privatePct + foreignPct) * 0.5)}%</span></button>`;
  html += `<button onclick="confirmBuyback('${entId}', 1.0, ${fullCost})" style="display:block;width:100%;text-align:left;padding:8px;margin:4px 0;background:var(--bg-card);border:1px solid var(--separator);border-radius:4px;cursor:pointer;font-size:13px;">回购全部民营股权<br><span style="font-size:11px;color:var(--text-3);">成本${fullCost}万 · 企业转为公有</span></button>`;
  showModal('股权回购', html, [{ text: '取消', color: 'gray', action: closeModal }], '股权回购', 'info');
}

function confirmBuyback(entId, ratio, cost) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  closeModal();
  showModal('确认回购', `<p>回购「${ent.name}」中${Math.round(ratio * 100)}%的民营股权。</p><p>回购成本：${cost}万</p><p>当前财政余额：${gameState.treasury}万</p>`, [{ text: '确认回购', color: 'purple', action: () => {
    closeModal();
    if (gameState.treasury < cost) { showNotification('财政资金不足', 'warn'); return; }
    gameState.treasury -= cost;
    const buybackPct = Math.round((ent.equity.private + ent.equity.foreign) * ratio);
    ent.equity.state += buybackPct;
    ent.equity.private = Math.round(ent.equity.private * (1 - ratio));
    ent.equity.foreign = Math.round(ent.equity.foreign * (1 - ratio));
    ent.fiscalSupport = Math.round(ent.fiscalSupport * (1 + 0.3 * ratio));
    if (ratio >= 1.0) {
      ent.ownership = 'stateOwned';
      ent.acquired = true;
      ent.equity = { state: 100, private: 0, foreign: 0 };
    }
    gameState.corruption = Math.min(100, (gameState.corruption || 0) + 2);
    logEvent(`回购「${ent.name}」${Math.round(ratio * 100)}%民营股权，花费${cost}万`, 'success');
    showNotification(`回购成功，国有股权增至${ent.equity.state}%`, 'success');
    updateUI();
  }}, { text: '取消', color: 'gray', action: closeModal }], '股权回购', 'info');
}
