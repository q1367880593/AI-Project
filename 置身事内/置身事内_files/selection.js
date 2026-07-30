/* 源自《置身事内》单文件版 - 建筑选择 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 建筑选择 ==============
// 宽裕财政模式切换
function toggleGenerousFinance() {
  if (gameState.generousFinance) {
    showNotification('宽裕财政模式一旦开启便无法关闭', 'warn');
    return;
  }
  gameState.generousFinance = true;
  gameState.generousFinanceLocked = true;
  gameState.treasury = 999999;
  showNotification('宽裕财政模式已开启，财政资金无限（不可关闭）', 'success');
  logEvent('宽裕财政模式已开启，此操作不可逆', 'warn');
  updateUI();
}

// 无尽仕途模式切换
function toggleEndlessMode() {
  if (gameState.endlessMode) {
    showNotification('无尽仕途模式已开启，无法关闭', 'warn');
    return;
  }
  gameState.endlessMode = true;
  showNotification('无尽仕途模式已开启（不可关闭）', 'info');
  logEvent('无尽仕途模式已开启（不可关闭）', 'info');
  updateUI();
}

// 姓名选择数据
const SURNAMES = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈'];
const GIVEN_NAMES = ['伟', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚', '桂英', '芳', '鑫', '波', '斌', '辉', '玉婷', '浩', '宇', '凯', '健', '俊', '红', '丽', '建国', '建华', '国强', '志明', '志强', '德', '海', '林', '斌', '鹏', '晨', '曦', '悦', '欣', '怡', '然', '梦', '雅', '博', '文'];

function selectBuilding(id) {
  gameState.selectedBuilding = id;
  gameState.selectedTool = 'paint';
  gameState.selectedZone = null;
  gameState.selectedZoneSub = null;
  gameState.selectedRoadType = null;
  gameState.selectedTransitType = null;
  gameState.isPainting = false;
  gameState.paintCells = [];
  gameState.paintStartCell = null;
  updateToolUI();
  refreshBuildWindow();
  // 关闭建筑窗口以查看地图
  const bw = document.getElementById('build-window');
  if (bw && bw.classList.contains('active')) bw.classList.remove('active');
  renderMap();
}

function deselectBuilding() {
  gameState.selectedBuilding = null;
  updateToolUI();
  refreshBuildWindow();
}

function selectZoneType(zoneType, subType) {
  gameState.selectedZone = zoneType;
  gameState.selectedZoneSub = subType;
  gameState.selectedRoadType = null;
  gameState.selectedTransitType = null;
  gameState.selectedBuilding = null;
  gameState.selectedTool = 'paint';
  gameState.isPainting = false;
  gameState.paintCells = [];
  gameState.paintStartCell = null;
  updateToolUI();
  // Close building window to see the map
  const bw = document.getElementById('build-window');
  if (bw && bw.classList.contains('active')) bw.classList.remove('active');
  renderMap();
}

function selectRoadType(roadType) {
  gameState.selectedRoadType = roadType;
  gameState.selectedZone = null;
  gameState.selectedZoneSub = null;
  gameState.selectedBuilding = null;
  gameState.selectedTransitType = null;
  gameState.selectedTool = 'paint';
  gameState.isPainting = false;
  gameState.paintCells = [];
  gameState.paintStartCell = null;
  updateToolUI();
  const bw = document.getElementById('build-window');
  if (bw && bw.classList.contains('active')) bw.classList.remove('active');
  renderMap();
}

function selectTransitType(transitType) {
  gameState.selectedTransitType = transitType;
  gameState.selectedZone = null;
  gameState.selectedZoneSub = null;
  gameState.selectedBuilding = null;
  gameState.selectedRoadType = null;
  gameState.selectedTool = 'paint';
  gameState.isPainting = false;
  gameState.paintCells = [];
  gameState.paintStartCell = null;
  updateToolUI();
  const bw = document.getElementById('build-window');
  if (bw && bw.classList.contains('active')) bw.classList.remove('active');
  renderMap();
}

function setBrushMode(mode) {
  gameState.brushMode = mode;
  document.querySelectorAll('.brush-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.brush === mode);
  });
  if (canvas) canvas.style.cursor = mode === 'fill' ? 'pointer' : 'crosshair';
}

function setTool(tool) {
  gameState.selectedTool = tool;
  gameState.isDemolishBrushing = false;
  gameState.isPainting = false;
  gameState.paintCells = [];
  gameState.paintStartCell = null;
  gameState._demolishPaintMode = false;
  if (tool !== 'paint') {
    gameState.selectedZone = null;
    gameState.selectedZoneSub = null;
    gameState.selectedRoadType = null;
    gameState.selectedTransitType = null;
  }
  if (tool !== 'build') gameState.selectedBuilding = null;
  if (tool === 'demolish') {
    if (gameState.demolishMode !== 'whole' && gameState.demolishMode !== 'partial' && gameState.demolishMode !== 'rect') {
      gameState.demolishMode = 'whole';
    }
  }
  updateToolUI();
}

function updateToolUI() {
  document.getElementById('tb-build').classList.toggle('active', gameState.selectedTool === 'build' || gameState.selectedTool === 'paint');
  document.getElementById('tb-demolish').classList.toggle('active', gameState.selectedTool === 'demolish');
  document.getElementById('tb-inspect').classList.toggle('active', gameState.selectedTool === 'inspect');
  const bp = document.getElementById('brush-palette');
  const zib = document.getElementById('zone-info-bar');
  if (gameState.selectedTool === 'paint') {
    if (bp) {
      bp.classList.add('active');
      // 恢复画笔模式按钮
      bp.innerHTML = `
        <button class="brush-btn ${gameState.brushMode === 'free' ? 'active' : ''}" data-brush="free" onclick="setBrushMode('free')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg></button>
        <button class="brush-btn ${gameState.brushMode === 'rect' ? 'active' : ''}" data-brush="rect" onclick="setBrushMode('rect')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></button>
        <button class="brush-btn ${gameState.brushMode === 'line' ? 'active' : ''}" data-brush="line" onclick="setBrushMode('line')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg></button>
        <button class="brush-btn ${gameState.brushMode === 'fill' ? 'active' : ''}" data-brush="fill" onclick="setBrushMode('fill')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 11h-8V3a1 1 0 0 0-2 0v8H1v2h8v8a1 1 0 0 0 2 0v-8h8z"/></svg></button>
      `;
    }
    if (zib) {
      let html = '';
      if (gameState.selectedZone) {
        const zt = ZONE_TYPES[gameState.selectedZone];
        const sub = zt.subTypes[gameState.selectedZoneSub] || zt;
        const cost = sub.costPerCell || zt.costPerCell;
        html = `<div class="zib-dot" style="background:${sub.color || zt.color};"></div>` +
               `<span>${zt.name}${sub.name !== zt.name ? ' · ' + sub.name : ''}</span>` +
               `<span class="zib-cost">¥${cost}/格</span>` +
               `<span class="zib-close" onclick="setTool('build');refreshBuildWindow();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
      } else if (gameState.selectedRoadType) {
        const rt = ROAD_TYPES[gameState.selectedRoadType];
        html = `<div class="zib-dot" style="background:${rt.color};"></div>` +
               `<span>${rt.name}</span>` +
               `<span class="zib-cost">¥${rt.costPerCell}/格</span>` +
               `<span class="zib-close" onclick="setTool('build');refreshBuildWindow();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
      } else if (gameState.selectedTransitType) {
        const tt = TRANSIT_TYPES[gameState.selectedTransitType];
        html = `<div class="zib-dot" style="background:${tt.color};"></div>` +
               `<span>${tt.name}</span>` +
               `<span class="zib-cost">¥${tt.costPerCell}/格</span>` +
               `<span class="zib-close" onclick="setTool('build');refreshBuildWindow();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
      } else if (gameState.selectedBuilding) {
        const def = BUILDING_TYPES[gameState.selectedBuilding];
        html = `<div class="zib-dot" style="background:${def.color};"></div>` +
               `<span>${def.name}</span>` +
               `<span class="zib-cost">¥${def.cost}万/格</span>` +
               `<span class="zib-close" onclick="deselectBuilding();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
      }
      zib.innerHTML = html;
      zib.classList.toggle('active', !!html);
    }
    if (canvas) canvas.style.cursor = 'crosshair';
  } else if (gameState.selectedTool === 'build' && gameState.selectedBuilding) {
    // Show info bar for selected building with close button
    if (bp) bp.classList.remove('active');
    if (zib) {
      const def = BUILDING_TYPES[gameState.selectedBuilding];
      if (def) {
        zib.innerHTML = `<div class="zib-dot" style="background:${def.color};"></div>` +
               `<span>${def.name}</span>` +
               `<span class="zib-cost">¥${def.cost}万</span>` +
               `<span class="zib-close" onclick="deselectBuilding();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
        zib.classList.add('active');
      }
    }
    if (canvas) canvas.style.cursor = 'crosshair';
  } else if (gameState.selectedTool === 'demolish') {
    // 拆除模式：显示 brush-palette 浮层，内容为拆除模式按钮
    if (bp) {
      bp.classList.add('active');
      const isWhole = gameState.demolishMode === 'whole';
      const isPartial = gameState.demolishMode === 'partial';
      const isRect = gameState.demolishMode === 'rect';
      bp.innerHTML = `
        <button class="brush-btn ${isWhole ? 'active' : ''}" title="整段拆除" onclick="setDemolishMode('whole')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        <button class="brush-btn ${isPartial ? 'active' : ''}" title="单格画笔" onclick="setDemolishMode('partial')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="12" y1="10" x2="12" y2="20" stroke-dasharray="2,2"/></svg></button>
        <button class="brush-btn ${isRect ? 'active' : ''}" title="框选删除" onclick="setDemolishMode('rect')"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></button>
      `;
    }
    if (zib) zib.classList.remove('active');
    if (canvas) canvas.style.cursor = 'crosshair';
  } else {
    if (bp) bp.classList.remove('active');
    if (zib) zib.classList.remove('active');
    if (canvas) canvas.style.cursor = (gameState.selectedTool === 'inspect') ? 'pointer' : ((gameState.selectedTool === 'placeBranch' || gameState.selectedTool === 'placeFacility') ? 'crosshair' : 'grab');
  }
}

