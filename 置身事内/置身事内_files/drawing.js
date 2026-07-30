/* 源自《置身事内》单文件版 - 区域/道路绘制系统 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 区域/道路绘制系统 ==============
let paintIdCounter = 0;

// v2.3.0: 全局道路/交通建筑数据对账 — 同步 buildings[] 与 roads[]/transits[]
// 在拆除操作后调用，清除幽灵建筑并补建缺失实体，防止存档膨胀与数据不一致
function reconcileRoadBuildings() {
  // 移除空路
  gameState.roads = gameState.roads.filter(r => r.cells && r.cells.length > 0);
  gameState.transits = gameState.transits.filter(t => t.cells && t.cells.length > 0);
  // 重建道路格集合
  const roadCellSet = new Set();
  for (const r of gameState.roads) for (const c of r.cells) roadCellSet.add(c.x + ',' + c.y);
  // 重建交通格集合（按 type 分组）
  const transitCellTypes = new Map(); // key -> type
  for (const t of gameState.transits) {
    for (const c of t.cells) {
      transitCellTypes.set(c.x + ',' + c.y, t.type);
    }
  }
  // 删除 buildings 里的幽灵 road 实体（不在任何 road.cells 上）
  // 删除 buildings 里的幽灵交通实体（不在任何 transit.cells 上）
  // v2.4.7c: 补充 railwayLine 和 hsrLine 类型的清理
  const _transitBuildingTypes = ['subwayLine', 'lightRail', 'elevatedRoad', 'utility', 'elevatedRail', 'railwayLine', 'hsrLine'];
  gameState.buildings = gameState.buildings.filter(b => {
    if (b.type === 'road') return roadCellSet.has(b.x + ',' + b.y);
    if (_transitBuildingTypes.includes(b.type)) {
      return transitCellTypes.has(b.x + ',' + b.y);
    }
    return true;
  });
  // 为缺失的 road 格补建实体
  const existing = new Set();
  for (const b of gameState.buildings) {
    if (b.type === 'road' || _transitBuildingTypes.includes(b.type)) {
      existing.add(b.x + ',' + b.y + ':' + b.type);
    }
  }
  for (const key of roadCellSet) {
    if (!existing.has(key + ':road')) {
      const [x, y] = key.split(',').map(Number);
      gameState.buildings.push({ x, y, type: 'road', layer: 'ground', age: 0 });
    }
  }
  // v2.4.7c: 重建交通建筑时使用正确的 buildingType 和 layer
  for (const [key, type] of transitCellTypes) {
    const tt = TRANSIT_TYPES[type];
    if (!tt) continue;
    const buildingType = tt.buildingType || type;
    if (!existing.has(key + ':' + buildingType)) {
      const [x, y] = key.split(',').map(Number);
      const layer = tt.layer || 'ground';
      gameState.buildings.push({ x, y, type: buildingType, layer, age: 0 });
    }
  }
  gameState.buildingCount = gameState.buildings.length;
}

// v2.4.7c: 获取机场所有跑道格子（兼容 runways 数组和旧版 runwayCells）
// v2.4.8: 同时支持独立跑道建筑
function getAllRunwayCells(airport) {
  if (!airport) return [];
  if (airport.type === 'runway' && airport.runwayData) {
    return airport.runwayData.cells || [];
  }
  if (airport.type !== 'airport') return [];
  if (airport.runways && airport.runways.length > 0) {
    return airport.runways.flatMap(r => r.cells || []);
  }
  return airport.runwayCells || [];
}

// 拆除框选专用：只检查地图边界，不排除建筑/道路/区域
function isCellDemolishable(x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  return true;
}

function isCellPaintable(x, y) {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return false;
  const idx = y * MAP_W + x;
  const cell = mapCells[idx];
  if (!cell) return false;
  // Transit types: can overlap with ground-layer items (roads, zones, buildings)
  // since they are on elevated or underground layers
  if (gameState.selectedTransitType) {
    const tt = TRANSIT_TYPES[gameState.selectedTransitType];
    if (cell.elevation > 500) return false;
    // v2.2.6: 审批检查（通过requireApproval字段统一处理）
    if (tt.requireApproval && !gameState[tt.requireApproval]) return false;
    // Check for same-layer transit building at this cell
    for (const b of gameState.buildings) {
      if (b.x === x && b.y === y && b.layer === tt.layer && b.type === tt.buildingType) return false;
    }
    return true;
  }
  // Building brush mode
  if (gameState.selectedBuilding) {
    const def = BUILDING_TYPES[gameState.selectedBuilding];
    if (!def) return false;
    // v2.2.6: 审批检查（通过requireApproval统一处理，不再硬编码）
    if (def.requireApproval && !gameState[def.requireApproval]) return false;
    // v2.4.7b: 不能在机场跑道上建造任何建筑
    for (const b of gameState.buildings) {
      if (b.type === 'airport') {
        for (const rc of getAllRunwayCells(b)) {
          if (rc.x === x && rc.y === y) return false;
        }
      }
    }
    // v2.2.6: 地铁站只能放置在地铁线路上
    if (gameState.selectedBuilding === 'subwayStation') {
      if (!hasTransitAtCell(x, y, 'subway')) return false;
    }
    // v2.2.6: 轻轨站只能放置在轻轨线路上（需轻轨审批通过）
    if (gameState.selectedBuilding === 'lightRailStation') {
      if (!hasTransitAtCell(x, y, 'lightRail')) return false;
    }
    // v2.4.7: 火车站只能放置在铁路线上
    if (gameState.selectedBuilding === 'railwayStation') {
      if (!hasTransitAtCell(x, y, 'railway')) return false;
    }
    // v2.4.7: 高铁站只能放置在高铁线上
    if (gameState.selectedBuilding === 'hsrStation') {
      if (!hasTransitAtCell(x, y, 'hsr')) return false;
    }
    // v2.4.7: 港口只能建在邻水区域或水上，且每图最多2个
    if (gameState.selectedBuilding === 'port') {
      const portCount = gameState.buildings.filter(b => b.type === 'port').length;
      if (portCount >= 2) return false;
    }
    // v2.4.8c: 机场数量按城市等级限制
    // 省会及以上最多2个，计划单列市也可建2个（可拆除旧建新），地级市只能建1个
    if (gameState.selectedBuilding === 'airport') {
      const lvId = gameState.cityLevelId || 0;
      const isSeparatelyPlanned = gameState.cityStatus && gameState.cityStatus.isSeparatelyPlanned;
      const maxAirports = (lvId >= 3 || isSeparatelyPlanned) ? 2 : 1;
      const airportCount = gameState.buildings.filter(b => b.type === 'airport').length;
      if (airportCount >= maxAirports) return false;
    }
    if (def.layer === 'ground') {
      if (gameState.selectedBuilding === 'hydroDam') {
        if (!cell.isWater && !cell.river) return false;
      } else if (gameState.selectedBuilding === 'reservoir') {
        if (!cell.isWater && !hasWaterNearby(x, y, 2)) return false;
      } else if (gameState.selectedBuilding === 'port') {
        // v2.5.0b: 港口必须邻水或在水本身（含河流、湖泊、海洋）
        if (!hasWaterNearby(x, y, 2)) return false;
      } else if (gameState.selectedBuilding === 'runway') {
        // v2.5.0: 跑道可建在任何地面（含水上），不做地形限制
      } else {
        if (cell.isWater || cell.river) return false;
      }
      if (cell.elevation > 500) return false;
    }
    // v2.2.7b: 站点建筑允许与同层线路建筑共存（地铁站可放在地铁线上，轻轨站可放在轻轨线上）
    const _stationLineMap = { subwayStation: 'subwayLine', lightRailStation: 'lightRail', railwayStation: 'railwayLine', hsrStation: 'hsrLine' };
    for (const b of gameState.buildings) {
      if (b.x === x && b.y === y && b.layer === def.layer) {
        if (_stationLineMap[gameState.selectedBuilding] === b.type) continue;
        return false;
      }
    }
    // v2.2.7: 地下层/高架层建筑不检查地面道路和区域冲突（可跨层共存）
    if (def.layer === 'ground') {
      for (const z of gameState.zones) {
        for (const c of z.cells) {
          if (c.x === x && c.y === y) return false;
        }
      }
      for (const r of gameState.roads) {
        for (const c of r.cells) {
          if (c.x === x && c.y === y) return false;
        }
      }
    }
    // v2.4.7c: 道路邻近检查（与 filterValidBuildingCells 保持一致，避免预览/实际不一致）
    // v2.5.0b: 跑道加入交通枢纽豁免列表，不要求附近有道路
    const _previewTransportTypes = ['airport', 'port', 'railwayStation', 'hsrStation', 'runway'];
    if (gameState.selectedBuilding !== 'road' && def.layer === 'ground' && !isPrimarySector(gameState.selectedBuilding) && !_previewTransportTypes.includes(gameState.selectedBuilding)) {
      if (!hasRoadNearby(x, y, 2)) return false;
    }
    return true;
  }
  // Can't paint on water or very high terrain
  // Exception: roads can be built on water (bridges) with extra cost
  if (gameState.selectedRoadType) {
    // Roads CAN be built on water (bridges), but with extra cost
    if (cell.elevation > 500) return false;
  } else {
    if (cell.isWater || cell.river) return false;
    if (cell.elevation > 500) return false;
  }
  // If painting a road, allow painting over existing roads (to extend/connect)
  if (gameState.selectedRoadType) {
    // Roads can be painted over existing roads (for extension/connection)
    // But can't paint roads on existing buildings or zones
    for (const b of gameState.buildings) {
      if (b.x === x && b.y === y && b.type !== 'road') return false;
    }
    for (const z of gameState.zones) {
      for (const c of z.cells) {
        if (c.x === x && c.y === y) return false;
      }
    }
    return true;
  }
  // For zones: can't paint on existing buildings, roads, or zones
  for (const b of gameState.buildings) {
    if (b.x === x && b.y === y) return false;
  }
  for (const z of gameState.zones) {
    for (const c of z.cells) {
      if (c.x === x && c.y === y) return false;
    }
  }
  for (const r of gameState.roads) {
    for (const c of r.cells) {
      if (c.x === x && c.y === y) return false;
    }
  }
  return true;
}

function cellKey(x, y) { return x + ',' + y; }

// v2.2.3b: 建筑画笔有效格子筛选（实际放置时的检查，区别于预览检查）
function filterValidBuildingCells(cells, def) {
  const validCells = [];
  for (const c of cells) {
    const idx = c.y * MAP_W + c.x;
    const cell = mapCells[idx];
    if (!cell) continue;
    if (def.layer === 'ground') {
      if (gameState.selectedBuilding === 'hydroDam') {
        if (!cell.isWater && !cell.river) continue;
      } else if (gameState.selectedBuilding === 'reservoir') {
        if (!cell.isWater && !hasWaterNearby(c.x, c.y, 2)) continue;
      } else if (gameState.selectedBuilding === 'port') {
        // v2.5.0b: 港口必须邻水或在水本身
        if (!hasWaterNearby(c.x, c.y, 2)) continue;
      } else if (gameState.selectedBuilding === 'runway') {
        // v2.5.0: 跑道可建在任何地面，不做地形限制
      } else {
        if (cell.isWater || cell.river) continue;
      }
      if (cell.elevation > 500) continue;
    }
    // v2.2.7b: 站点建筑允许与同层线路建筑共存
    const _stationLineMap2 = { subwayStation: 'subwayLine', lightRailStation: 'lightRail', railwayStation: 'railwayLine', hsrStation: 'hsrLine' };
    let occupied = false;
    for (const b of gameState.buildings) {
      if (b.x === c.x && b.y === c.y && b.layer === def.layer) {
        if (_stationLineMap2[gameState.selectedBuilding] === b.type) continue;
        occupied = true; break;
      }
    }
    if (occupied) continue;
    // v2.4.7c: 交通枢纽建筑（机场/港口/火车站/高铁站）不需要附近有道路
    // v2.5.0b: 跑道加入豁免列表
    const _batchTransportTypes = ['airport', 'port', 'railwayStation', 'hsrStation', 'runway'];
    if (gameState.selectedBuilding !== 'road' && def.layer === 'ground' && !isPrimarySector(gameState.selectedBuilding) && !_batchTransportTypes.includes(gameState.selectedBuilding)) {
      if (!hasRoadNearby(c.x, c.y, 2)) continue;
    }
    // v2.2.6: 审批检查（通过requireApproval统一处理）
    if (def.requireApproval && !gameState[def.requireApproval]) continue;
    // v2.4.7b: 不能在机场跑道上建造任何建筑
    let onRunway = false;
    for (const b of gameState.buildings) {
      if (b.type === 'airport') {
        for (const rc of getAllRunwayCells(b)) {
          if (rc.x === c.x && rc.y === c.y) { onRunway = true; break; }
        }
        if (onRunway) break;
      }
    }
    if (onRunway) continue;
    // v2.5.0: 机场航站楼不再自动查找跑道（跑道改为独立自由画笔建设）
    // v2.2.6: 地铁站只能放置在地铁线路上
    if (gameState.selectedBuilding === 'subwayStation') {
      if (!hasTransitAtCell(c.x, c.y, 'subway')) continue;
    }
    // v2.2.6: 轻轨站只能放置在轻轨线路上
    if (gameState.selectedBuilding === 'lightRailStation') {
      if (!hasTransitAtCell(c.x, c.y, 'lightRail')) continue;
    }
    // v2.4.7: 火车站只能放置在铁路线上
    if (gameState.selectedBuilding === 'railwayStation') {
      if (!hasTransitAtCell(c.x, c.y, 'railway')) continue;
    }
    // v2.4.7: 高铁站只能放置在高铁线上
    if (gameState.selectedBuilding === 'hsrStation') {
      if (!hasTransitAtCell(c.x, c.y, 'hsr')) continue;
    }
    // v2.5.0: 港口数量限制（临河检查已在上方地形判断中完成）
    if (gameState.selectedBuilding === 'port') {
      const portCount = gameState.buildings.filter(b => b.type === 'port').length;
      if (portCount >= 2) continue;
    }
    validCells.push(c);
  }
  return validCells;
}

// Check if any road cell is within `range` cells (Manhattan distance) of (x, y)
function hasRoadNearby(x, y, range) {
  range = range || 2;
  for (const r of gameState.roads) {
    for (const c of r.cells) {
      if (Math.abs(c.x - x) + Math.abs(c.y - y) <= range) return true;
    }
  }
  return false;
}

// v2.4.7: 查找机场跑道方向 — 寻找最长的直线空地
function findAirportRunway(x, y, preferVertical) {
  // v2.4.7c: 去重方向（[1,0]和[-1,0]产生相同水平线）
  const dirs = preferVertical ? [[0, 1], [1, 0]] : [[1, 0], [0, 1]];
  // v2.4.7c: 预构建所有机场跑道格的集合，避免重叠
  const allRunwayCells = new Set();
  for (const b of gameState.buildings) {
    if (b.type !== 'airport') continue;
    for (const c of getAllRunwayCells(b)) allRunwayCells.add(c.x + ',' + c.y);
  }
  let bestRunway = null;
  let bestLen = 0;
  for (const [dx, dy] of dirs) {
    const cells = [{ x, y }];
    // 正方向延伸
    let nx = x + dx, ny = y + dy;
    while (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
      const idx = ny * MAP_W + nx;
      const cell = mapCells[idx];
      if (!cell || cell.isWater || cell.elevation > 500) break;
      if (allRunwayCells.has(nx + ',' + ny)) break; // v2.4.7c: 不与其他机场跑道重叠
      let occupied = false;
      for (const b of gameState.buildings) {
        if (b.x === nx && b.y === ny && b.layer === 'ground') { occupied = true; break; }
      }
      if (occupied) break;
      for (const z of gameState.zones) {
        if (z.cells.some(c => c.x === nx && c.y === ny)) { occupied = true; break; }
      }
      if (occupied) break;
      cells.push({ x: nx, y: ny });
      nx += dx; ny += dy;
    }
    // 反方向延伸
    nx = x - dx; ny = y - dy;
    while (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
      const idx = ny * MAP_W + nx;
      const cell = mapCells[idx];
      if (!cell || cell.isWater || cell.elevation > 500) break;
      if (allRunwayCells.has(nx + ',' + ny)) break; // v2.4.7c: 不与其他机场跑道重叠
      let occupied = false;
      for (const b of gameState.buildings) {
        if (b.x === nx && b.y === ny && b.layer === 'ground') { occupied = true; break; }
      }
      if (occupied) break;
      for (const z of gameState.zones) {
        if (z.cells.some(c => c.x === nx && c.y === ny)) { occupied = true; break; }
      }
      if (occupied) break;
      cells.unshift({ x: nx, y: ny });
      nx -= dx; ny -= dy;
    }
    if (cells.length > bestLen) {
      bestLen = cells.length;
      bestRunway = cells;
    }
  }
  return { cells: bestRunway, length: bestLen };
}

// v2.2.8: 获取最近的道路名称（用于站名联动）
function getNearbyRoadName(x, y, range) {
  range = range || 2;
  let nearestRoad = null;
  let minDist = Infinity;
  for (const r of gameState.roads) {
    for (const c of r.cells) {
      const dist = Math.abs(c.x - x) + Math.abs(c.y - y);
      if (dist <= range && dist < minDist) {
        minDist = dist;
        nearestRoad = r;
      }
    }
  }
  return nearestRoad ? nearestRoad.name : null;
}

// v2.2.5c: 检查指定格子是否有特定类型的交通线路经过
function hasTransitAtCell(x, y, transitType) {
  if (!gameState.transits) return false;
  for (const t of gameState.transits) {
    if (t.type !== transitType) continue;
    for (const c of t.cells) {
      if (c.x === x && c.y === y) return true;
    }
  }
  return false;
}

// v2.2.5c: 检查指定格子是否有特定类型的建筑
function hasBuildingAtCell(x, y, buildingType) {
  for (const b of gameState.buildings) {
    if (b.x === x && b.y === y && b.type === buildingType) return true;
  }
  return false;
}

function hasWaterNearby(x, y, range) {
  range = range || 2;
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > range) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
      const cell = mapCells[ny * MAP_W + nx];
      if (cell && (cell.isWater || cell.river)) return true;
    }
  }
  return false;
}

// v2.5.0: 检查附近是否有河流（不含湖泊等水域）
function hasRiverNearby(x, y, range) {
  range = range || 2;
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > range) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
      const cell = mapCells[ny * MAP_W + nx];
      if (cell && cell.river) return true;
    }
  }
  return false;
}

// Floating confirm for zone painting
let _pendingZonePaint = null;

function showFloatConfirm(screenX, screenY, title, cost, onConfirm) {
  const fc = document.getElementById('float-confirm');
  if (!fc) return;
  const shortTitle = title.length > 8 ? title.substring(0, 7) + '…' : title;
  fc.querySelector('.fc-info').textContent = shortTitle + ' ¥' + cost + '万';
  _pendingZonePaint = onConfirm;
  // 水平限制
  let px = Math.max(80, Math.min(window.innerWidth - 80, screenX));
  // 垂直限制：确认框高约34px，至少留40px空间，底部工具栏约70px
  const bottomMargin = 80;
  let py = Math.max(50, screenY);
  if (py > window.innerHeight - bottomMargin) {
    py = window.innerHeight - bottomMargin;
  }
  fc.style.left = px + 'px';
  fc.style.top = py + 'px';
  fc.classList.add('active');
}

function cancelFloatConfirm() {
  const fc = document.getElementById('float-confirm');
  if (fc) fc.classList.remove('active');
  _pendingZonePaint = null;
  gameState.paintCells = [];
  gameState.isPainting = false;
  gameState.demolishTarget = null;
  if (canvas) canvas.classList.remove('painting');
  renderMap();
}

function confirmFloatConfirm() {
  const fc = document.getElementById('float-confirm');
  if (fc) fc.classList.remove('active');
  if (_pendingZonePaint) {
    const fn = _pendingZonePaint;
    _pendingZonePaint = null;
    fn();
  }
}

function startPaint(cellX, cellY) {
  const isDemolish = gameState.selectedTool === 'demolish';
  const paintable = isDemolish ? isCellDemolishable(cellX, cellY) : isCellPaintable(cellX, cellY);
  if (!paintable) return;
  gameState.isPainting = true;
  gameState.paintStartCell = { x: cellX, y: cellY };
  gameState.paintCells = [{ x: cellX, y: cellY }];
  if (canvas) canvas.classList.add('painting');
  renderMap();
}

function updatePaint(cellX, cellY) {
  if (!gameState.isPainting) return;
  const mode = gameState.brushMode;
  const isRoadPaint = !!gameState.selectedRoadType || !!gameState.selectedTransitType;
  if (mode === 'free') {
    if (isRoadPaint) {
      // Roads: snap to the dominant direction (H, V, or diagonal)
      // This allows extending in 8 directions but keeps each stroke straight
      const s = gameState.paintStartCell;
      if (!s) return;
      const dx = cellX - s.x, dy = cellY - s.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      // Only allow H, V, or 45-degree diagonal (ratio between 0.7 and 1.4)
      let snapType;
      if (adx === 0 && ady === 0) { gameState.paintCells = [{ x: s.x, y: s.y }]; renderMap(); return; }
      else if (ady <= adx * 0.3) snapType = 'h';        // mostly horizontal
      else if (adx <= ady * 0.3) snapType = 'v';        // mostly vertical
      else {
        // Only allow diagonal if ratio is close to 1.0 (45 degrees)
        const ratio = adx / ady;
        if (ratio >= 0.7 && ratio <= 1.4) snapType = 'd';
        else if (adx > ady) snapType = 'h';  // fall back to horizontal
        else snapType = 'v';                  // fall back to vertical
      }
      const newCells = [];
      if (snapType === 'h') {
        const x0 = Math.min(s.x, cellX), x1 = Math.max(s.x, cellX);
        for (let x = x0; x <= x1; x++) { if (isCellPaintable(x, s.y)) newCells.push({ x, y: s.y }); }
      } else if (snapType === 'v') {
        const y0 = Math.min(s.y, cellY), y1 = Math.max(s.y, cellY);
        for (let y = y0; y <= y1; y++) { if (isCellPaintable(s.x, y)) newCells.push({ x: s.x, y }); }
      } else {
        // Diagonal: Bresenham line from start to cursor
        let x0 = s.x, y0 = s.y, x1 = cellX, y1 = cellY;
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        const ldx = Math.abs(x1 - x0), ldy = Math.abs(y1 - y0);
        let err = ldx - ldy;
        while (true) {
          if (isCellPaintable(x0, y0)) newCells.push({ x: x0, y: y0 });
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 > -ldy) { err -= ldy; x0 += sx; }
          if (e2 < ldx) { err += ldx; y0 += sy; }
        }
      }
      gameState.paintCells = newCells;
      renderMap();
    } else {
      // Non-road: original free behavior
      const exists = gameState.paintCells.some(c => c.x === cellX && c.y === cellY);
      if (!exists && isCellPaintable(cellX, cellY)) {
        gameState.paintCells.push({ x: cellX, y: cellY });
        renderMap();
      }
    }
  } else if (mode === 'rect') {
    // Calculate rectangle from start to current
    const s = gameState.paintStartCell;
    if (!s) return;
    const x0 = Math.min(s.x, cellX), x1 = Math.max(s.x, cellX);
    const y0 = Math.min(s.y, cellY), y1 = Math.max(s.y, cellY);
    const newCells = [];
    const isDemolish = gameState.selectedTool === 'demolish';
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const paintable = isDemolish ? isCellDemolishable(x, y) : isCellPaintable(x, y);
        if (paintable) newCells.push({ x, y });
      }
    }
    gameState.paintCells = newCells;
    renderMap();
  } else if (mode === 'line') {
    const s = gameState.paintStartCell;
    if (!s) return;
    const newCells = [];
    let x0 = s.x, y0 = s.y, x1 = cellX, y1 = cellY;
    // Roads: only allow H, V, or 45-degree diagonal
    if (isRoadPaint) {
      const rdx = Math.abs(x1 - x0), rdy = Math.abs(y1 - y0);
      const ratio = rdx / Math.max(rdy, 1);
      if (rdy <= rdx * 0.3) { y1 = y0; }         // snap to horizontal
      else if (rdx <= rdy * 0.3) { x1 = x0; }     // snap to vertical
      else if (ratio >= 0.7 && ratio <= 1.4) { /* keep diagonal */ }
      else if (rdx > rdy) { y1 = y0; }             // fall back to horizontal
      else { x1 = x0; }                            // fall back to vertical
    }
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      if (isCellPaintable(x0, y0)) newCells.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    gameState.paintCells = newCells;
    renderMap();
  }
}

// ===== 拆除框选（复用 paint 拖拽机制） =====
function endDemolishPaint() {
  if (!gameState.isPainting) return;
  gameState.isPainting = false;
  if (canvas) canvas.classList.remove('painting');
  const cells = [...gameState.paintCells];
  gameState.paintCells = [];
  gameState.paintStartCell = null;
  if (cells.length === 0) { renderMap(); return; }

  // 统计拆除对象
  const cellSet = new Set(cells.map(c => c.x + ',' + c.y));
  let buildingCount = 0, roadCount = 0, zoneCount = 0, transitCount = 0;
  gameState.buildings.forEach(b => { if (b.type !== 'road' && cellSet.has(b.x + ',' + b.y)) buildingCount++; });
  gameState.roads.forEach(r => { if (r.cells.some(c => cellSet.has(c.x + ',' + c.y))) roadCount++; });
  gameState.zones.forEach(z => { if (z.cells.some(c => cellSet.has(c.x + ',' + c.y))) zoneCount++; });
  gameState.transits.forEach(t => { if (t.cells.some(c => cellSet.has(c.x + ',' + c.y))) transitCount++; });
  const totalCount = buildingCount + roadCount + zoneCount + transitCount;

  if (totalCount === 0) {
    renderMap();
    showNotification('框选区域内无可拆除对象', 'info');
    return;
  }

  const parts = [];
  if (buildingCount > 0) parts.push(`建筑×${buildingCount}`);
  if (roadCount > 0) parts.push(`道路×${roadCount}`);
  if (zoneCount > 0) parts.push(`区域×${zoneCount}`);
  if (transitCount > 0) parts.push(`线路×${transitCount}`);

  const midCell = cells[Math.floor(cells.length / 2)];
  const screenPt = canvasToScreen(midCell.x * CELL + CELL / 2, midCell.y * CELL + CELL / 2);

  showFloatConfirm(screenPt.x, screenPt.y, `框选删除·${totalCount}个`, 0, () => {
    let count = 0;
    gameState.buildings = gameState.buildings.filter(b => {
      if (b.type === 'road') return true;
      if (cellSet.has(b.x + ',' + b.y)) { count++; return false; }
      return true;
    });
    const newRoads = [];
    for (const road of gameState.roads) {
      const rc = road.cells.filter(c => !cellSet.has(c.x + ',' + c.y));
      if (rc.length > 0) { road.cells = rc; newRoads.push(road); } else { count++; }
    }
    gameState.roads = newRoads;
    const newZones = [];
    for (const zone of gameState.zones) {
      const zc = zone.cells.filter(c => !cellSet.has(c.x + ',' + c.y));
      if (zc.length > 0) {
        zone.cells = zc;
        if (zone.shops) zone.shops = zone.shops.filter(s => !cellSet.has(s.x + ',' + s.y));
        newZones.push(zone);
      } else { count++; }
    }
    gameState.zones = newZones;
    const newTransits = [];
    for (const t of gameState.transits) {
      const tc = t.cells.filter(c => !cellSet.has(c.x + ',' + c.y));
      if (tc.length > 0) { t.cells = tc; newTransits.push(t); } else { count++; }
    }
    gameState.transits = newTransits;
    // v2.3.0: 数据对账 — 清除幽灵建筑、补建缺失实体
    reconcileRoadBuildings();
    gameState.buildingCount = gameState.buildings.length;
    showNotification(`框选删除完成：清除 ${count} 个对象`, 'info');
    updateUI();
    renderMap();
  });
}

function endPaint() {
  if (!gameState.isPainting) return;
  gameState.isPainting = false;
  if (canvas) canvas.classList.remove('painting');
  const cells = [...gameState.paintCells];
  gameState.paintCells = [];
  gameState.paintStartCell = null;
  if (cells.length === 0) { renderMap(); return; }
  // For zones: show floating confirm popup instead of committing directly
  if (gameState.selectedZone && !gameState.selectedRoadType) {
    // v2.2.1b: 农业区不需要道路邻近检查
    const isAgriZone = gameState.selectedZone === 'agriculture';
    // Road proximity check for zones (skip for agriculture)
    let hasNearbyRoad = false;
    if (!isAgriZone) {
      for (const c of cells) {
        if (hasRoadNearby(c.x, c.y, 2)) { hasNearbyRoad = true; break; }
      }
    }
    if (!isAgriZone && !hasNearbyRoad) {
      showNotification('区域附近2格内无道路，无法建造！请先修建道路。', 'warn');
      renderMap();
      return;
    }
    // Calculate cost
    const zt = ZONE_TYPES[gameState.selectedZone];
    const sub = zt.subTypes[gameState.selectedZoneSub] || zt;
    const costPerCell = sub.costPerCell || zt.costPerCell;
    // Calculate total cost
    const totalCost = costPerCell * cells.length;
    if (!gameState.generousFinance && gameState.treasury < totalCost) {
      showNotification(`财政资金不足！需要 ¥${totalCost}万`, 'danger');
      renderMap();
      return;
    }
    // Show floating confirm at the center of the painted area
    const cx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
    const cy = cells.reduce((s, c) => s + c.y, 0) / cells.length;
    const screenPt = canvasToScreen(cx * CELL + CELL / 2, cy * CELL + CELL / 2);
    showFloatConfirm(screenPt.x, screenPt.y, `${zt.name}${sub.name !== zt.name ? ' · ' + sub.name : ''}`, totalCost, () => {
      commitPaint(cells);
    });
    // Restore paint cells for display
    gameState.paintCells = cells;
    renderMap();
    return;
  }
  // For roads: show floating confirm popup
  if (gameState.selectedRoadType && !gameState.selectedZone) {
    const rt = ROAD_TYPES[gameState.selectedRoadType];
    // Water cells cost 50% extra (bridge construction)
    let totalCost = 0;
    for (const c of cells) {
      const idx = c.y * MAP_W + c.x;
      const cell = mapCells[idx];
      if (cell && (cell.isWater || cell.river)) {
        totalCost += Math.ceil(rt.costPerCell * 1.5); // 50% extra for water
      } else {
        totalCost += rt.costPerCell;
      }
    }
    if (!gameState.generousFinance && gameState.treasury < totalCost) {
      showNotification(`财政资金不足！需要 ¥${totalCost}万`, 'danger');
      renderMap();
      return;
    }
    const cx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
    const cy = cells.reduce((s, c) => s + c.y, 0) / cells.length;
    const screenPt = canvasToScreen(cx * CELL + CELL / 2, cy * CELL + CELL / 2);
    showFloatConfirm(screenPt.x, screenPt.y, rt.name, totalCost, () => {
      commitPaint(cells);
    });
    gameState.paintCells = cells;
    renderMap();
    return;
  }
  // For transit types: show floating confirm popup
  if (gameState.selectedTransitType && !gameState.selectedZone && !gameState.selectedRoadType) {
    const tt = TRANSIT_TYPES[gameState.selectedTransitType];
    // Water cells cost 50% extra (for elevated types on water)
    let totalCost = 0;
    for (const c of cells) {
      const idx = c.y * MAP_W + c.x;
      const cell = mapCells[idx];
      if (cell && (cell.isWater || cell.river) && tt.layer === 'elevated') {
        totalCost += Math.ceil(tt.costPerCell * 1.5); // 50% extra for water (bridge)
      } else {
        totalCost += tt.costPerCell;
      }
    }
    if (!gameState.generousFinance && gameState.treasury < totalCost) {
      showNotification(`财政资金不足！需要 ¥${totalCost}万`, 'danger');
      renderMap();
      return;
    }
    const cx = cells.reduce((s, c) => s + c.x, 0) / cells.length;
    const cy = cells.reduce((s, c) => s + c.y, 0) / cells.length;
    const screenPt = canvasToScreen(cx * CELL + CELL / 2, cy * CELL + CELL / 2);
    showFloatConfirm(screenPt.x, screenPt.y, tt.name, totalCost, () => {
      commitPaint(cells);
    });
    gameState.paintCells = cells;
    renderMap();
    return;
  }
  // For building brush: show floating confirm popup
  if (gameState.selectedBuilding && !gameState.selectedZone && !gameState.selectedRoadType && !gameState.selectedTransitType) {
    const def = BUILDING_TYPES[gameState.selectedBuilding];
    if (!def) { renderMap(); return; }
    // v2.2.3b: 先筛选有效格子（道路邻近等检查），再按实际数量计算成本
    const validCells = filterValidBuildingCells(cells, def);
    if (validCells.length === 0) {
      // v2.5.0b: 港口画笔模式下给出更具体的提示
      if (gameState.selectedBuilding === 'port') {
        showNotification('选定区域内无邻水位置！码头需建在水边。', 'warn');
      } else {
        showNotification('选定区域内无有效建造位置（需2格内有道路且无占用）', 'warn');
      }
      renderMap();
      return;
    }
    const totalCost = def.cost * validCells.length;
    if (!gameState.generousFinance && gameState.treasury < totalCost) {
      showNotification(`财政资金不足！需要 ¥${totalCost}万`, 'danger');
      renderMap();
      return;
    }
    const cx = validCells.reduce((s, c) => s + c.x, 0) / validCells.length;
    const cy = validCells.reduce((s, c) => s + c.y, 0) / validCells.length;
    const screenPt = canvasToScreen(cx * CELL + CELL / 2, cy * CELL + CELL / 2);
    showFloatConfirm(screenPt.x, screenPt.y, `${def.name}×${validCells.length}`, totalCost, () => {
      commitPaint(validCells);
    });
    gameState.paintCells = cells;
    renderMap();
    return;
  }
  commitPaint(cells);
}

function commitPaint(cells) {
  if (cells.length === 0) return;
  // Calculate cost
  let costPerCell = 10;
  let isRoad = false;
  let isTransit = false;
  if (gameState.selectedZone) {
    const zt = ZONE_TYPES[gameState.selectedZone];
    const sub = zt.subTypes[gameState.selectedZoneSub] || zt;
    costPerCell = sub.costPerCell || zt.costPerCell;
  } else if (gameState.selectedRoadType) {
    const rt = ROAD_TYPES[gameState.selectedRoadType];
    costPerCell = rt.costPerCell;
    isRoad = true;
  } else if (gameState.selectedTransitType) {
    const tt = TRANSIT_TYPES[gameState.selectedTransitType];
    costPerCell = tt.costPerCell;
    isTransit = true;
  } else if (gameState.selectedBuilding) {
    const def = BUILDING_TYPES[gameState.selectedBuilding];
    if (!def) return;
    // v2.2.3b: 复用 filterValidBuildingCells 筛选有效格子
    const validCells = filterValidBuildingCells(cells, def);
    if (validCells.length === 0) { renderMap(); return; }
    const totalCost = def.cost * validCells.length;
    if (!gameState.generousFinance && gameState.treasury < totalCost) {
      showNotification(`财政资金不足！需要 ¥${totalCost}万，当前 ¥${gameState.treasury}万`, 'danger');
      renderMap();
      return;
    }
    gameState.treasury -= totalCost;
    gameState.achievementStats.totalMoneySpent += totalCost;
    paintIdCounter++;

    // v2.5.0: 跑道特殊处理 — 整批格子作为一条跑道建筑
    if (gameState.selectedBuilding === 'runway') {
      if (validCells.length < 5) {
        gameState.treasury += totalCost;
        gameState.achievementStats.totalMoneySpent -= totalCost;
        showNotification('跑道至少需要5格！', 'warn');
        renderMap();
        return;
      }
      // 判断跑道方向
      const xs = validCells.map(c => c.x);
      const ys = validCells.map(c => c.y);
      const isVertical = Math.max(...xs) === Math.min(...xs);
      const direction = isVertical ? 'vertical' : 'horizontal';
      const runwayCells = validCells.map(c => ({ x: c.x, y: c.y }));
      const newRunway = {
        x: validCells[0].x, y: validCells[0].y,
        type: 'runway', layer: def.layer, age: 0,
        runwayData: { cells: runwayCells, length: runwayCells.length, direction },
        runwayCells: runwayCells,
        runwayLength: runwayCells.length,
        customName: `${gameState.cityName.replace(/[镇县城市区]+$/, '')}机场跑道`,
      };
      gameState.achievementStats.totalBuildingsBuilt++;
      gameState.buildings.push(newRunway);
      // 标记跑道格为已占用
      const runwayIdx = gameState.buildings.length - 1;
      for (const c of runwayCells) {
        gameState.buildings.push({ x: c.x, y: c.y, type: 'runwayCell', layer: 'ground', age: 0, parentRunway: runwayIdx });
      }
      // 关联最近的机场航站楼
      const runwayMid = runwayCells[Math.floor(runwayCells.length / 2)];
      let nearestAirport = null;
      let nearestDist = Infinity;
      for (const b of gameState.buildings) {
        if (b.type !== 'airport' || b === newRunway) continue;
        const dist = Math.abs(b.x - runwayMid.x) + Math.abs(b.y - runwayMid.y);
        if (dist < nearestDist) { nearestDist = dist; nearestAirport = b; }
      }
      if (nearestAirport && nearestDist <= 10) {
        if (!nearestAirport.runways) nearestAirport.runways = [];
        nearestAirport.runways.push({ ...newRunway.runwayData, runwayBuildingIdx: runwayIdx });
        nearestAirport.runwayCells = nearestAirport.runways.flatMap(r => r.cells);
        nearestAirport.runwayLength = nearestAirport.runways.reduce((sum, r) => sum + r.length, 0);
        const cls = getAirportClass(nearestAirport.runways);
        nearestAirport.airportClass = cls.code;
        nearestAirport.tradeIncome = cls.tradeMult * 10;
        nearestAirport.passengerFlow = Math.floor(nearestAirport.runwayLength * 100 * (0.5 + Math.random() * 0.5));
      }
      gameState.buildingCount = gameState.buildings.length;
      updateUI(); renderMap();
      showNotification(`建造：${def.name}（${runwayCells.length}格，-¥${totalCost}万）`, 'info');
      return;
    }

    for (const c of validCells) {
      gameState.achievementStats.totalBuildingsBuilt++;
      const isPublic = PUBLIC_BUILDING_TYPES.includes(gameState.selectedBuilding);
      const existingCount = gameState.buildings.filter(b => b.type === gameState.selectedBuilding && !b.branchOf).length;
      const newBuilding = { x: c.x, y: c.y, type: gameState.selectedBuilding, layer: def.layer, age: 0 };
      if (isPublic) {
        newBuilding.level = 1;
        newBuilding.facilities = [];
        newBuilding.branchOf = null;
        newBuilding.customName = generatePublicBuildingName(gameState.selectedBuilding, 1, existingCount, gameState.cityName, gameState.cityLevelId);
        if (gameState.selectedBuilding === 'university') newBuilding.universityBuiltMonth = gameState.turn;
      }
      // v2.2.6b: 为地铁站和轻轨站生成随机站名
      // v2.2.8: 站名联动附近道路名
      if (gameState.selectedBuilding === 'subwayStation' || gameState.selectedBuilding === 'lightRailStation') {
        newBuilding.customName = generateStationName(c.x, c.y);
      }
      // v2.4.7: 火车站/高铁站命名和等级
      if (gameState.selectedBuilding === 'railwayStation' || gameState.selectedBuilding === 'hsrStation') {
        const grade = getStationGrade(gameState.population);
        newBuilding.stationGrade = grade.code;
        newBuilding.passengerFlow = Math.floor(grade.capacity * (0.5 + Math.random() * 0.5));
        newBuilding.customName = `${gameState.cityName.replace(/[镇县城市区]+$/, '')}${gameState.selectedBuilding === 'hsrStation' ? '高铁' : '火车'}站`;
      }
      // v2.4.8: 机场航站楼 — 批量放置也不再自动创建跑道
      if (gameState.selectedBuilding === 'airport') {
        newBuilding.runways = [];
        newBuilding.runwayCells = [];
        newBuilding.runwayLength = 0;
        const cls = getAirportClass(newBuilding.runways);
        newBuilding.airportClass = cls.code;
        newBuilding.isInternational = false;
        newBuilding.passengerFlow = 0;
        newBuilding.tradeIncome = 0;
        newBuilding.customName = generateAirportName(gameState.cityName, false);
      }
      // v2.4.7: 港口命名
      if (gameState.selectedBuilding === 'port') {
        // v2.4.7c: 批量放置时重新校验港口数量上限
        const currentPortCount = gameState.buildings.filter(b => b.type === 'port').length;
        if (currentPortCount >= 2) {
          gameState.treasury += def.cost;
          gameState.achievementStats.totalMoneySpent -= def.cost;
          gameState.achievementStats.totalBuildingsBuilt--;
          continue;
        }
        newBuilding.passengerFlow = Math.floor(500 * (0.5 + Math.random() * 0.5));
        newBuilding.customName = `${gameState.cityName.replace(/[镇县城市区]+$/, '')}港`;
      }
      gameState.buildings.push(newBuilding);
    }
    gameState.buildingCount = gameState.buildings.length;
    if (def.eff && def.eff.green) gameState.greenCoverage = Math.max(0, gameState.greenCoverage + def.eff.green * 0.1 * validCells.length);
    updateUI(); renderMap();
    showNotification(`批量建造：${def.name} ×${validCells.length}（-¥${def.cost * validCells.length}万）`, 'info');
    return;
  } else {
    return;
  }
  const totalCost = costPerCell * cells.length;
  if (!gameState.generousFinance && gameState.treasury < totalCost) {
    showNotification(`财政资金不足！需要 ¥${totalCost}万，当前 ¥${gameState.treasury}万`, 'danger');
    renderMap();
    return;
  }
  // Deduct cost
  gameState.treasury -= totalCost;
  gameState.achievementStats.totalMoneySpent += totalCost;
  paintIdCounter++;
  if (isRoad) {
    // Build a set of all existing road cells for reference
    const existingRoadCells = new Set();
    for (const r of gameState.roads) {
      for (const c of r.cells) existingRoadCells.add(c.x + ',' + c.y);
    }
    // Separate cells into new (not yet road) and overlap (already a road cell)
    const newCells = cells.filter(c => !existingRoadCells.has(c.x + ',' + c.y));
    const overlapCells = cells.filter(c => existingRoadCells.has(c.x + ',' + c.y));
    // Refund cost for overlap cells that were included in totalCost, then charge upgrade difference
    const newGradeCost = costPerCell;
    let upgradeCost = 0;
    for (const c of overlapCells) {
      for (const r of gameState.roads) {
        if (r.cells.some(rc => rc.x === c.x && rc.y === c.y)) {
          const oldGradeCost = ROAD_TYPES[r.grade].costPerCell;
          if (newGradeCost > oldGradeCost) {
            upgradeCost += (newGradeCost - oldGradeCost);
          }
        }
      }
    }
    // Refund the overlap cells (they were incorrectly charged in totalCost)
    const refundCost = costPerCell * overlapCells.length;
    gameState.treasury += refundCost;
    // Deduct upgrade cost
    gameState.treasury -= upgradeCost;
    // Correct the achievement stats for the actual net cost
    gameState.achievementStats.totalMoneySpent -= refundCost;
    gameState.achievementStats.totalMoneySpent += upgradeCost;

    if (newCells.length === 0) {
      // All cells are already roads — only upgrade the painted cells, charge for each
      // 收集需要升级的格子（旧等级低于新等级的格子）
      const upgradeCellsList = [];
      for (const c of overlapCells) {
        for (const r of gameState.roads) {
          if (r.cells.some(rc => rc.x === c.x && rc.y === c.y)) {
            const oldGradeCost = ROAD_TYPES[r.grade].costPerCell;
            if (newGradeCost > oldGradeCost) {
              upgradeCellsList.push({ cell: c, road: r, oldGrade: r.grade });
            }
          }
        }
      }
      // 将升级的格子从原道路拆出，合并为一条新等级道路
      if (upgradeCellsList.length > 0) {
        // 从各道路中移除被升级的格子
        const cellsToUpgrade = [];
        for (const item of upgradeCellsList) {
          item.road.cells = item.road.cells.filter(rc => !(rc.x === item.cell.x && rc.y === item.cell.y));
          cellsToUpgrade.push(item.cell);
        }
        // 移除空道路
        gameState.roads = gameState.roads.filter(r => r.cells.length > 0);
        // 创建新等级道路
        gameState.roads.push({ id: 'road_' + (++paintIdCounter), grade: gameState.selectedRoadType, cells: cellsToUpgrade, name: generateRoadName(gameState.selectedRoadType) });
        // 重新计算升级费用（按实际升级格数）
        upgradeCost = 0;
        for (const item of upgradeCellsList) {
          upgradeCost += (newGradeCost - ROAD_TYPES[item.oldGrade].costPerCell);
        }
        showNotification(`道路升级为${ROAD_TYPES[gameState.selectedRoadType].name}（升级${upgradeCellsList.length}格，-¥${upgradeCost}万）`, 'info');
        logEvent(`道路升级：${upgradeCellsList.length}格升级为${ROAD_TYPES[gameState.selectedRoadType].name}（-¥${upgradeCost}万）`, 'info');
      } else {
        showNotification('道路已连接到现有道路', 'info');
      }
      renderMap();
      return;
    }

    // Determine the direction of this paint stroke
    const firstCell = cells[0], lastCell = cells[cells.length - 1];
    const strokeDx = lastCell.x - firstCell.x, strokeDy = lastCell.y - firstCell.y;
    const strokeAdx = Math.abs(strokeDx), strokeAdy = Math.abs(strokeDy);
    let strokeDir;
    if (strokeAdy <= strokeAdx * 0.3) strokeDir = 'h';
    else if (strokeAdx <= strokeAdy * 0.3) strokeDir = 'v';
    else strokeDir = 'd';

    function getRoadDirection(r) {
      if (r.cells.length < 2) return null;
      const c0 = r.cells[0], c1 = r.cells[r.cells.length - 1];
      const rdx = Math.abs(c1.x - c0.x), rdy = Math.abs(c1.y - c0.y);
      if (rdy <= rdx * 0.3) return 'h';
      if (rdx <= rdy * 0.3) return 'v';
      return 'd';
    }

    // Find the best merge target: only merge into a road with the SAME direction
    let mergeTarget = null;
    let mergeScore = 0;
    for (const r of gameState.roads) {
      const rDir = getRoadDirection(r);
      if (rDir !== strokeDir) continue;  // different direction = intersection, not merge
      let score = 0;
      // Check ALL stroke cells (including overlap) for adjacency/overlap
      for (const nc of cells) {
        for (const rc of r.cells) {
          const dx = Math.abs(nc.x - rc.x), dy = Math.abs(nc.y - rc.y);
          if (dx === 0 && dy === 0) { score = Math.max(score, 5); }
          else if (dx + dy <= 1) { score = Math.max(score, 3); }
        }
      }
      if (score > mergeScore) { mergeScore = score; mergeTarget = r; }
    }

    if (mergeTarget && mergeScore >= 3) {
      // Merge: add ALL new cells (not overlap cells) to the existing road
      const existingSet = new Set(mergeTarget.cells.map(c => c.x + ',' + c.y));
      for (const c of newCells) {
        if (!existingSet.has(c.x + ',' + c.y)) {
          mergeTarget.cells.push({ x: c.x, y: c.y });
          existingSet.add(c.x + ',' + c.y);
        }
      }
    } else {
      // Create new road with ALL new cells
      const roadName = generateRoadName(gameState.selectedRoadType);
      gameState.roads.push({
        id: 'road_' + paintIdCounter,
        grade: gameState.selectedRoadType,
        cells: newCells.map(c => ({ x: c.x, y: c.y })),
        name: roadName,
      });
    }

    // Add road buildings for all NEW cells (overlap cells already have road buildings)
    // This ensures the road is continuous even across intersections
    for (const c of newCells) {
      const hasRoadBldg = gameState.buildings.some(b => b.x === c.x && b.y === c.y && b.type === 'road');
      if (!hasRoadBldg) {
        gameState.buildings.push({ x: c.x, y: c.y, type: 'road', layer: 'ground', age: 0 });
      }
    }
    gameState.buildingCount = gameState.buildings.length;
    const actualCost = costPerCell * newCells.length;
    const roadName = mergeTarget ? mergeTarget.name : (gameState.roads[gameState.roads.length - 1] ? gameState.roads[gameState.roads.length - 1].name : '');
    if (mergeTarget) {
      showNotification(`道路延伸：${mergeTarget.name}（新建${newCells.length}格，交叉${overlapCells.length}格，-¥${actualCost}万）`, 'info');
    } else {
      showNotification(`修建${ROAD_TYPES[gameState.selectedRoadType].name}：${roadName}（新建${newCells.length}格，交叉${overlapCells.length}格，-¥${actualCost}万）`, 'info');
    }
  } else if (isTransit) {
    // v2.2.6: 审批检查（transit画笔也需检查审批）
    const tt = TRANSIT_TYPES[gameState.selectedTransitType];
    if (tt.requireApproval && !gameState[tt.requireApproval]) {
      showNotification(`需先在"申报"页面获批${tt.name}建设`, 'warn'); return;
    }
    // v2.2.6: 独立命名和颜色分配（地铁→X号线，轻轨→SX）
    const { name: transitName, color: transitColor } = generateTransitNameAndColor(gameState.selectedTransitType);
    gameState.transits.push({
      id: 'transit_' + paintIdCounter,
      type: gameState.selectedTransitType,
      cells: cells.map(c => ({ x: c.x, y: c.y })),
      name: transitName,
      color: transitColor, // v2.2.6: 每条线路独立颜色
    });
    // Add building entries for each cell (for rendering and effects)
    for (const c of cells) {
      gameState.buildings.push({ x: c.x, y: c.y, type: tt.buildingType, layer: tt.layer, age: 0 });
    }
    gameState.buildingCount = gameState.buildings.length;
    // Calculate actual cost (with water surcharge for elevated)
    let actualCost = 0;
    for (const c of cells) {
      const idx = c.y * MAP_W + c.x;
      const cell = mapCells[idx];
      if (cell && (cell.isWater || cell.river) && tt.layer === 'elevated') {
        actualCost += Math.ceil(tt.costPerCell * 1.5);
      } else {
        actualCost += tt.costPerCell;
      }
    }
    // Adjust treasury for the difference between flat cost and actual cost
    gameState.treasury += totalCost - actualCost; // refund the difference
    showNotification(`修建${tt.name}：${transitName}（${cells.length}格，-¥${actualCost}万）`, 'info');
    logEvent(`修建${tt.name}：${transitName}（${cells.length}格，-¥${actualCost}万）`, 'info');
  } else {
    // Create zone with construction period
    const zone = {
      id: 'zone_' + paintIdCounter,
      type: gameState.selectedZone,
      subType: gameState.selectedZoneSub,
      cells: cells.map(c => ({ x: c.x, y: c.y })),
      name: ZONE_TYPES[gameState.selectedZone].name,
      shops: [],
    };
    // Generate buildings within the zone
    generateZoneBuildings(zone);
    // Create construction project for this zone
    const zt = ZONE_TYPES[gameState.selectedZone];
    const sub = zt.subTypes[zone.subType] || zt;
    // Construction time based on zone type (in months)
    const constructionTimes = {
      residential: sub === zt.subTypes?.low ? 3 : 6,
      industrial: 4,
      commercial: 5,
      park: 2,
    };
    const totalMonths = constructionTimes[zone.type] || 4;
    const totalInstallments = Math.min(totalMonths, 3); // 2-3 payment milestones
    const installmentAmount = totalCost / totalInstallments;
    const projId = 'proj_' + paintIdCounter;
    const projName = `${zt.name}·${sub.name}工程`;
    const proj = {
      id: projId,
      name: projName,
      zoneId: zone.id,
      totalMonths: totalMonths,
      elapsedMonths: 0,
      totalCost: totalCost,
      totalInstallments: totalInstallments,
      installmentAmount: installmentAmount,
      paidInstallments: 0,
      paidAmount: 0,
      accruedDebt: 0,
      deferredPayments: 0, // Player can set this to defer next N payments
      completed: false,
    };
    if (!gameState.constructionProjects) gameState.constructionProjects = [];
    gameState.constructionProjects.push(proj);
    // Mark zone buildings as under construction
    for (const b of gameState.buildings) {
      if (zone.cells.some(c => c.x === b.x && c.y === b.y)) {
        b.underConstruction = true;
        b.constructionProjectId = projId;
      }
    }
    // Pay first installment now
    gameState.treasury -= installmentAmount;
    proj.paidInstallments = 1;
    proj.paidAmount = installmentAmount;
    gameState.zones.push(zone);
    gameState.buildingCount = gameState.buildings.length;
    showNotification(`开工：${projName}（工期${totalMonths}月，首期款¥${formatMoney(installmentAmount * 10000)}，共${totalInstallments}期）`, 'info');
  }
  updateUI();
  renderMap();
}

function generateZoneBuildings(zone) {
  const zt = ZONE_TYPES[zone.type];
  if (!zt) return;
  const sub = zt.subTypes[zone.subType] || zt;
  const buildingType = sub.buildingType;
  if (!buildingType) return;
  // Determine building density based on zone type
  let spacing = 2; // Default: place building every 2 cells
  if (zone.type === 'residential') {
    if (zone.subType === 'low') spacing = 3;
    else if (zone.subType === 'mid') spacing = 2;
    else if (zone.subType === 'high') spacing = 1;
    else if (zone.subType === 'luxury') spacing = 4;
  } else if (zone.type === 'commercial') {
    spacing = 2;
  } else if (zone.type === 'industrial') {
    spacing = 2;
  } else if (zone.type === 'park') {
    spacing = 1; // Fill all cells
  } else if (zone.type === 'agriculture') {
    spacing = 1; // v2.2.0 农业地块每格都生成建筑（农田/林地/牧业/鱼塘）
  }
  // Sort cells for consistent placement
  const sortedCells = [...zone.cells].sort((a, b) => a.y - b.y || a.x - b.x);
  let placed = 0;
  for (let i = 0; i < sortedCells.length; i++) {
    if (spacing > 1 && i % spacing !== 0) continue;
    const c = sortedCells[i];
    // Check not already occupied
    let occupied = false;
    for (const b of gameState.buildings) {
      if (b.x === c.x && b.y === c.y) { occupied = true; break; }
    }
    if (occupied) continue;
    let bType = buildingType;
    // High-tech industrial uses its own building type
    if (zone.type === 'industrial' && sub.isHighTech) {
      bType = 'highTechInd';
    }
    const def = BUILDING_TYPES[bType];
    if (!def) continue;
    const building = { x: c.x, y: c.y, type: bType, layer: def.layer, age: 0 };
    if (sub.isHighTech) building.isHighTech = true;
    gameState.buildings.push(building);
    placed++;
    // Apply green effect immediately
    if (def.eff.green) gameState.greenCoverage = Math.max(0, gameState.greenCoverage + def.eff.green * 0.1);
  }
  // Generate shops for commercial zones
  if (zone.type === 'commercial') {
    generateCommercialShops(zone);
  }
  // v2.3.5: 为商业区/工业区生成企业，住宅区生成附属设施
  if (zone.type === 'commercial' || zone.type === 'industrial') {
    const lvId = gameState.cityLevelId || 0;
    // v2.3.6c: 工业区企业数量根据子类型调整
    let entCount;
    if (zone.type === 'industrial') {
      entCount = zone.subType === 'heavy' ? Math.min(zone.cells.length, 2 + Math.floor(Math.random() * 3))
                 : zone.subType === 'hightech' ? Math.min(zone.cells.length, 2 + Math.floor(Math.random() * 3))
                 : Math.min(zone.cells.length, 1 + Math.floor(Math.random() * 3));
    } else {
      entCount = Math.min(zone.cells.length, 1 + Math.floor(Math.random() * 3));
    }
    const sortedCells = [...zone.cells].sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 0; i < entCount; i++) {
      const c = sortedCells[Math.floor(i * sortedCells.length / entCount)];
      const ent = generateEnterprise(zone.type, lvId, c.x, c.y, gameState.cityName, zone.subType);
      gameState.enterprises.push(ent);
    }
  } else if (zone.type === 'residential') {
    if (Math.random() < 0.5 && zone.cells.length > 0) {
      const lvId = gameState.cityLevelId || 0;
      const c = zone.cells[Math.floor(Math.random() * zone.cells.length)];
      const fac = generateResidentialFacility(lvId, c.x, c.y, gameState.cityName);
      gameState.enterpriseFacilities.push(fac);
    }
  }
}

function generateCommercialShops(zone) {
  const sortedCells = [...zone.cells].sort((a, b) => a.y - b.y || a.x - b.x);
  let shopIdx = 0;
  for (let i = 0; i < sortedCells.length; i += 2) {
    const c = sortedCells[i];
    const shop = generateShopName();
    zone.shops.push({ name: shop.name, type: shop.type, x: c.x, y: c.y });
    shopIdx++;
  }
}

function floodFillCells(startX, startY) {
  if (!isCellPaintable(startX, startY)) return [];
  const startCell = mapCells[startY * MAP_W + startX];
  if (!startCell) return [];
  const targetTerrain = startCell.terrain;
  const visited = new Set();
  const result = [];
  const queue = [{ x: startX, y: startY }];
  let count = 0;
  const maxCells = 500; // Safety limit
  while (queue.length > 0 && count < maxCells) {
    const { x, y } = queue.shift();
    const key = cellKey(x, y);
    if (visited.has(key)) continue;
    visited.add(key);
    if (!isCellPaintable(x, y)) continue;
    const cell = mapCells[y * MAP_W + x];
    if (!cell || cell.terrain !== targetTerrain) continue;
    result.push({ x, y });
    count++;
    // Add neighbors
    queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
  }
  return result;
}

function placeBuilding(idx, type) {
  const cell = mapCells[idx];
  const def = BUILDING_TYPES[type];
  if (!def) return;
  if (def.layer === 'ground') {
    // 水力发电站可以建在水上（大坝建在河流上）
    // 水库必须建在水上或紧邻水域
    if (type === 'hydroDam') {
      if (!cell.isWater && !cell.river) { showNotification('水力发电站必须建在河流或水域上', 'warn'); return; }
    } else if (type === 'reservoir') {
      if (!cell.isWater && !hasWaterNearby(cell.x, cell.y, 2)) { showNotification('水库必须建在水域上或紧邻水源', 'warn'); return; }
    } else if (type === 'port') {
      // v2.5.0b: 港口必须邻水或在水本身（含河流、湖泊、海洋）
      if (!hasWaterNearby(cell.x, cell.y, 2)) { showNotification('码头需建在邻水或水本身位置！请在水边建造。', 'warn'); return; }
    } else if (type === 'runway') {
      // v2.5.0: 跑道可建在任何地面，不做地形限制
    } else {
      if (cell.isWater) { showNotification('不能在水域上建造', 'warn'); return; }
    }
    if (cell.elevation > 500) { showNotification('海拔过高，不宜建造', 'warn'); return; }
  }
  // v2.2.6: 审批检查（通过requireApproval统一处理）
  if (def.requireApproval && !gameState[def.requireApproval]) {
    showNotification(`需先在"申报"页面获批${def.name}建设`, 'warn'); return;
  }
  // v2.5.0: 跑道为自由画笔建设，单点放置时以当前格作为跑道
  let _cachedRunway = null;
  if (type === 'runway') {
    // v2.5.0: 检查是否与已有跑道重叠
    const allRunwayCells = new Set();
    for (const b of gameState.buildings) {
      if (b.type === 'airport' || b.type === 'runway') {
        for (const c of getAllRunwayCells(b)) allRunwayCells.add(c.x + ',' + c.y);
      }
    }
    if (allRunwayCells.has(cell.x + ',' + cell.y)) {
      showNotification('新跑道与已有跑道重叠', 'warn'); return;
    }
    // v2.5.0: 单点放置，跑道长度为1（提交时若总数不足5格会拒绝）
    _cachedRunway = { cells: [{ x: cell.x, y: cell.y }], length: 1 };
  }
  // v2.4.7: 港口数量限制
  if (type === 'port') {
    const portCount = gameState.buildings.filter(b => b.type === 'port').length;
    if (portCount >= 2) {
      showNotification('每个地图最多只能建设2个港口码头', 'warn'); return;
    }
  }
  // v2.4.8c: 机场数量按城市等级限制
  if (type === 'airport') {
    const lvId = gameState.cityLevelId || 0;
    const isSeparatelyPlanned = gameState.cityStatus && gameState.cityStatus.isSeparatelyPlanned;
    const maxAirports = (lvId >= 3 || isSeparatelyPlanned) ? 2 : 1;
    const airportCount = gameState.buildings.filter(b => b.type === 'airport').length;
    if (airportCount >= maxAirports) {
      const msg = isSeparatelyPlanned || lvId >= 3
        ? `机场数量已达上限（${maxAirports}个），可拆除旧机场后重建`
        : `地级市最多只能建设${maxAirports}个机场`;
      showNotification(msg, 'warn'); return;
    }
  }
  // v2.4.7b: 不能在机场跑道上建造任何建筑（单点放置路径也需校验）
  for (const b of gameState.buildings) {
    if (b.type === 'airport') {
      for (const rc of getAllRunwayCells(b)) {
        if (rc.x === cell.x && rc.y === cell.y) {
          showNotification('不能在机场跑道上建造建筑', 'warn'); return;
        }
      }
    }
  }
  // v2.4.7b: 站点建筑必须建在对应线路上（单点放置路径也需校验）
  const _stationLineReq = { subwayStation: 'subway', lightRailStation: 'lightRail', railwayStation: 'railway', hsrStation: 'hsr' };
  if (_stationLineReq[type] && !hasTransitAtCell(cell.x, cell.y, _stationLineReq[type])) {
    showNotification(`${def.name}必须建在对应的交通线路上`, 'warn'); return;
  }
  if (!gameState.generousFinance && gameState.treasury < def.cost) { showNotification('财政资金不足！', 'danger'); return; }
  // v2.4.7b: 站点建筑允许与同层线路建筑共存
  const _stationLineMap3 = { subwayStation: 'subwayLine', lightRailStation: 'lightRail', railwayStation: 'railwayLine', hsrStation: 'hsrLine' };
  for (const b of gameState.buildings) {
    if (b.x === cell.x && b.y === cell.y && b.layer === def.layer) {
      if (_stationLineMap3[type] === b.type) continue;
      showNotification('该位置已有建筑', 'warn'); return;
    }
  }
  // Road proximity check: all buildings except roads, agricultural buildings, and transport buildings need a road within 2 cells
  // v2.2.1b: 农业建筑（农田/林地/牧业/鱼塘/农村民居）不需要附近有道路
  // v2.4.7c: 交通枢纽建筑（机场/港口/火车站/高铁站）不需要附近有道路
  // v2.5.0b: 跑道加入豁免列表
  const _transportTypes = ['airport', 'port', 'railwayStation', 'hsrStation', 'runway'];
  if (type !== 'road' && def.layer === 'ground' && !isPrimarySector(type) && !_transportTypes.includes(type)) {
    if (!hasRoadNearby(cell.x, cell.y, 2)) {
      showNotification('附近2格内无道路，无法建造！请先修建道路。', 'warn');
      return;
    }
  }
  // Show floating capsule confirm at the build location
  const screenPt = canvasToScreen(cell.x * CELL + CELL / 2, cell.y * CELL + CELL / 2);
  showFloatConfirm(screenPt.x, screenPt.y, def.name, def.cost, () => {
    gameState.treasury -= def.cost;
    gameState.achievementStats.totalMoneySpent += def.cost;
    gameState.achievementStats.totalBuildingsBuilt++;
    const isPublic = PUBLIC_BUILDING_TYPES.includes(type);
    const existingCount = gameState.buildings.filter(b => b.type === type && !b.branchOf).length;
    const newBuilding = { x: cell.x, y: cell.y, type, layer: def.layer, age: 0 };
    if (isPublic) {
      newBuilding.level = 1;
      newBuilding.facilities = [];
      newBuilding.branchOf = null;
      newBuilding.customName = generatePublicBuildingName(type, 1, existingCount, gameState.cityName, gameState.cityLevelId);
      if (type === 'university') newBuilding.universityBuiltMonth = gameState.turn;
    }
    // v2.2.6b: 为地铁站和轻轨站生成随机站名
    // v2.2.8: 站名联动附近道路名
    if (type === 'subwayStation' || type === 'lightRailStation') {
      newBuilding.customName = generateStationName(cell.x, cell.y);
    }
    // v2.4.7: 火车站/高铁站命名和等级
    if (type === 'railwayStation' || type === 'hsrStation') {
      const grade = getStationGrade(gameState.population);
      newBuilding.stationGrade = grade.code;
      newBuilding.passengerFlow = Math.floor(grade.capacity * (0.5 + Math.random() * 0.5));
      newBuilding.customName = `${gameState.cityName.replace(/[镇县城市区]+$/, '')}${type === 'hsrStation' ? '高铁' : '火车'}站`;
    }
    // v2.4.8: 机场航站楼 — 不再自动创建跑道，初始无跑道，等待玩家单独建设跑道
    if (type === 'airport') {
      newBuilding.runways = [];
      newBuilding.runwayCells = [];
      newBuilding.runwayLength = 0;
      const cls = getAirportClass(newBuilding.runways);
      newBuilding.airportClass = cls.code;
      newBuilding.isInternational = false;
      newBuilding.passengerFlow = 0;
      newBuilding.tradeIncome = 0;
      newBuilding.customName = generateAirportName(gameState.cityName, false);
    }
    // v2.4.8: 跑道 — 独立建筑，建成后关联最近的机场航站楼
    if (type === 'runway') {
      const runway = _cachedRunway;
      const direction = runway.cells[0].x === runway.cells[runway.cells.length-1].x ? 'vertical' : 'horizontal';
      newBuilding.runwayData = { cells: runway.cells, length: runway.length, direction };
      newBuilding.runwayCells = runway.cells; // 兼容渲染
      newBuilding.runwayLength = runway.length;
      newBuilding.customName = `${gameState.cityName.replace(/[镇县城市区]+$/, '')}机场跑道`;
    }
    // v2.4.7: 港口命名
    if (type === 'port') {
      newBuilding.passengerFlow = Math.floor(500 * (0.5 + Math.random() * 0.5));
      newBuilding.customName = `${gameState.cityName.replace(/[镇县城市区]+$/, '')}港`;
    }
    gameState.buildings.push(newBuilding);
    // v2.4.8d: 跑道格标记已占用 — 在主建筑push之后，确保parentRunway索引正确
    if (type === 'runway') {
      const runwayIdx = gameState.buildings.length - 1;
      for (const c of newBuilding.runwayData.cells) {
        gameState.buildings.push({ x: c.x, y: c.y, type: 'runwayCell', layer: 'ground', age: 0, parentRunway: runwayIdx });
      }
    }
    // v2.4.8: 跑道建成后关联最近的机场航站楼
    if (type === 'runway') {
      const newRunwayIdx = gameState.buildings.length - 1;
      const runwayMid = newBuilding.runwayData.cells[Math.floor(newBuilding.runwayData.cells.length / 2)];
      let nearestAirport = null;
      let nearestDist = Infinity;
      for (const b of gameState.buildings) {
        if (b.type !== 'airport' || b === newBuilding) continue;
        const dist = Math.abs(b.x - runwayMid.x) + Math.abs(b.y - runwayMid.y);
        if (dist < nearestDist) { nearestDist = dist; nearestAirport = b; }
      }
      if (nearestAirport && nearestDist <= 10) {
        // 关联到机场
        if (!nearestAirport.runways) nearestAirport.runways = [];
        nearestAirport.runways.push({ ...newBuilding.runwayData, runwayBuildingIdx: newRunwayIdx });
        nearestAirport.runwayCells = nearestAirport.runways.flatMap(r => r.cells);
        nearestAirport.runwayLength = nearestAirport.runways.reduce((sum, r) => sum + r.length, 0);
        const cls = getAirportClass(nearestAirport.runways);
        nearestAirport.airportClass = cls.code;
        nearestAirport.tradeIncome = cls.tradeMult * 10;
        nearestAirport.passengerFlow = Math.floor(nearestAirport.runwayLength * 100 * (0.5 + Math.random() * 0.5));
        showNotification(`跑道已关联${nearestAirport.customName}，当前${nearestAirport.runways.length}条跑道，等级${cls.code}`, 'success');
      } else {
        showNotification('跑道已建设，但附近5格内无机场航站楼，请先建设机场航站楼', 'warn');
      }
    }
    gameState.buildingCount = gameState.buildings.length;
    if (def.eff.green) gameState.greenCoverage = Math.max(0, gameState.greenCoverage + def.eff.green * 0.1);
    // v2.4.4: 模组钩子 — 建筑放置后
    if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('building:placed', { building: newBuilding, cell });
    updateUI(); renderMap();
    showNotification(`建造：${def.name}（-¥${def.cost}万）`, 'info');
  });
}

// 部分拆除（画笔模式）：直接拆除单格道路/线路，无确认弹窗，支持拖拽连续拆除
function demolishPartial(idx) {
  const cell = mapCells[idx];
  if (!cell) return;
  // 只处理道路的部分拆除
  for (let i = gameState.roads.length - 1; i >= 0; i--) {
    const r = gameState.roads[i];
    for (let j = 0; j < r.cells.length; j++) {
      if (r.cells[j].x === cell.x && r.cells[j].y === cell.y) {
        const rt = ROAD_TYPES[r.grade];
        const demoCost = Math.ceil(rt.costPerCell * 0.25);
        if (gameState.treasury < demoCost) return; // 余额不足，静默跳过
        gameState.treasury -= demoCost;
        r.cells.splice(j, 1);
        for (let k = gameState.buildings.length - 1; k >= 0; k--) {
          if (gameState.buildings[k].x === cell.x && gameState.buildings[k].y === cell.y && gameState.buildings[k].type === 'road') {
            gameState.buildings.splice(k, 1);
            break;
          }
        }
        if (r.cells.length === 0) gameState.roads.splice(i, 1);
        // v2.3.0: 数据对账 — 单格拆除后同步建筑实体
        reconcileRoadBuildings();
        gameState.buildingCount = gameState.buildings.length;
        updateUI(); renderMap();
        return;
      }
    }
  }
  // 检查交通线路的部分拆除
  for (let i = gameState.transits.length - 1; i >= 0; i--) {
    const t = gameState.transits[i];
    for (let j = 0; j < t.cells.length; j++) {
      if (t.cells[j].x === cell.x && t.cells[j].y === cell.y) {
        const tt = TRANSIT_TYPES[t.type];
        const demoCost = Math.ceil(tt.costPerCell * 0.25);
        if (gameState.treasury < demoCost) return;
        gameState.treasury -= demoCost;
        t.cells.splice(j, 1);
        for (let k = gameState.buildings.length - 1; k >= 0; k--) {
          if (gameState.buildings[k].x === cell.x && gameState.buildings[k].y === cell.y && gameState.buildings[k].type === t.type) {
            gameState.buildings.splice(k, 1);
            break;
          }
        }
        if (t.cells.length === 0) gameState.transits.splice(i, 1);
        // v2.3.0: 数据对账 — 单格拆除后同步建筑实体
        reconcileRoadBuildings();
        gameState.buildingCount = gameState.buildings.length;
        updateUI(); renderMap();
        return;
      }
    }
  }
  // 非道路/线路：画笔模式下静默跳过（不影响建筑和区域）
}

function demolishBuilding(idx) {
  const cell = mapCells[idx];
  // 先检测拆除目标，计算费用，再弹确认窗
  let demoTarget = null; // { type: 'zone'|'road'|'building', name, cost, action }
  // Check for zones first
  for (let i = gameState.zones.length - 1; i >= 0; i--) {
    const z = gameState.zones[i];
    for (const c of z.cells) {
      if (c.x === cell.x && c.y === cell.y) {
        const zt = ZONE_TYPES[z.type];
        const sub = zt.subTypes[z.subType] || zt;
        const cost = sub.costPerCell || zt.costPerCell;
        const demoCost = Math.ceil(cost * z.cells.length * 0.15); // 拆迁费=建造费15%
        demoTarget = {
          type: 'zone', idx: i, name: `${zt.name}·${sub.name}（${z.cells.length}格）`, cost: demoCost,
          action: () => {
            const zoneCellSet = new Set(z.cells.map(c => c.x + ',' + c.y));
            for (let j = gameState.buildings.length - 1; j >= 0; j--) {
              if (zoneCellSet.has(gameState.buildings[j].x + ',' + gameState.buildings[j].y)) {
                gameState.buildings.splice(j, 1);
              }
            }
            gameState.zones.splice(i, 1);
            gameState.buildingCount = gameState.buildings.length;
          }
        };
        break;
      }
    }
    if (demoTarget) break;
  }
  // Check for roads
  if (!demoTarget) {
    for (let i = gameState.roads.length - 1; i >= 0; i--) {
      const r = gameState.roads[i];
      for (const c of r.cells) {
        if (c.x === cell.x && c.y === cell.y) {
          const rt = ROAD_TYPES[r.grade];
          const demoCost = Math.ceil(rt.costPerCell * r.cells.length * 0.15);
          demoTarget = {
            type: 'road', idx: i, name: `${rt.name}：${r.name}（${r.cells.length}格）`, cost: demoCost,
            action: () => {
              const roadCellSet = new Set(r.cells.map(c => c.x + ',' + c.y));
              for (let j = gameState.buildings.length - 1; j >= 0; j--) {
                if (roadCellSet.has(gameState.buildings[j].x + ',' + gameState.buildings[j].y) && gameState.buildings[j].type === 'road') {
                  gameState.buildings.splice(j, 1);
                }
              }
              gameState.roads.splice(i, 1);
              // v2.3.0: 数据对账 — 修复交叉口共享格被误删后产生的幽灵建筑
              reconcileRoadBuildings();
              gameState.buildingCount = gameState.buildings.length;
            }
          };
          break;
        }
      }
      if (demoTarget) break;
    }
  }
  // v2.2.7: 先检查站点建筑，避免误删整条线路
  // Check for station buildings first (before transit lines)
  if (!demoTarget) {
    for (let i = gameState.buildings.length - 1; i >= 0; i--) {
      const b = gameState.buildings[i];
      if (b.x === cell.x && b.y === cell.y) {
        // v2.2.7: 跳过交通线路建筑（由线路拆除逻辑处理）
        if (['subwayLine', 'lightRail', 'elevatedRoad', 'utility', 'elevatedRail', 'road'].includes(b.type)) continue;
        // 配套建筑（_fac）使用父建筑定义计算拆迁费
        const isFac = b.type.endsWith('_fac');
        const lookupType = isFac ? b.type.replace('_fac', '') : b.type;
        const def = BUILDING_TYPES[lookupType];
        if (!def) continue; // v2.2.7: 未知类型跳过（继续检查其他建筑）
        const demoCost = Math.ceil(def.cost * 0.25); // 拆迁费=建造费25%
        demoTarget = {
          type: 'building', idx: i, name: isFac ? (b.facilityId ? def.name + '配套' : def.name) : def.name, cost: demoCost,
          action: () => {
            // 如果是配套建筑，从父建筑的 facilities 数组中移除对应 ID
            if (isFac && b.facilityId) {
              for (const pb of gameState.buildings) {
                if (pb.type === lookupType && pb.facilities && pb.facilities.includes(b.facilityId)) {
                  // v2.4.8b: 仅移除一个实例（支持 maxCount > 1 的配套如航站楼）
                  const fIdx = pb.facilities.indexOf(b.facilityId);
                  if (fIdx >= 0) pb.facilities.splice(fIdx, 1);
                  break;
                }
              }
            }
            // 如果是父建筑且拥有配套，连带拆除所有关联的 _fac 建筑
            if (!isFac && b.facilities && b.facilities.length > 0) {
              for (let j = gameState.buildings.length - 1; j >= 0; j--) {
                const fb = gameState.buildings[j];
                if (j !== i && fb.type === b.type + '_fac' && fb.facilityId && b.facilities.includes(fb.facilityId)) {
                  gameState.buildings.splice(j, 1);
                  // 修正主建筑索引（如果配套在主建筑之前被删除）
                  if (j < i) i--;
                }
              }
            }
            gameState.buildings.splice(i, 1);
            gameState.buildingCount = gameState.buildings.length;
            // v2.4.4: 模组钩子 — 建筑拆除后
            if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('building:demolished', { building: b, cell });
          }
        };
        break;
      }
    }
  }
  // v2.2.7: 最后检查交通线路（站点建筑已优先处理，避免误删整条线路）
  if (!demoTarget) {
    for (let i = gameState.transits.length - 1; i >= 0; i--) {
      const t = gameState.transits[i];
      for (const c of t.cells) {
        if (c.x === cell.x && c.y === cell.y) {
          const tt = TRANSIT_TYPES[t.type];
          if (!tt) continue;
          const demoCost = Math.ceil(tt.costPerCell * t.cells.length * 0.15);
          demoTarget = {
            type: 'transit', idx: i, name: `${tt.name}：${t.name}（${t.cells.length}格）`, cost: demoCost,
            action: () => {
              const transitCellSet = new Set(t.cells.map(c => c.x + ',' + c.y));
              for (let j = gameState.buildings.length - 1; j >= 0; j--) {
                if (transitCellSet.has(gameState.buildings[j].x + ',' + gameState.buildings[j].y) && gameState.buildings[j].type === t.type) {
                  gameState.buildings.splice(j, 1);
                }
              }
              gameState.transits.splice(i, 1);
              // v2.3.0: 数据对账 — 修复交通线路共享格被误删后产生的幽灵建筑
              reconcileRoadBuildings();
              gameState.buildingCount = gameState.buildings.length;
            }
          };
          break;
        }
      }
      if (demoTarget) break;
    }
  }
  if (!demoTarget) return;
  // 高亮拆除目标区域（在确认弹窗前）
  gameState.demolishTarget = { type: demoTarget.type, idx: demoTarget.idx, cell };
  renderMap();
  // 检查财政是否够付拆迁费
  if (gameState.treasury < demoTarget.cost) {
    showNotification(`财政不足，拆迁需要¥${demoTarget.cost}万`, 'danger');
    return;
  }
  // 弹出胶囊确认窗
  const screenPt = canvasToScreen(cell.x * CELL + CELL / 2, cell.y * CELL + CELL / 2);
  showFloatConfirm(screenPt.x, screenPt.y, `拆迁·${demoTarget.name}`, demoTarget.cost, () => {
    gameState.demolishTarget = null;
    gameState.treasury -= demoTarget.cost;
    gameState.achievementStats.buildingsDemolished++;
    demoTarget.action();
    updateUI(); renderMap();
    showNotification(`拆除${demoTarget.name}（-¥${demoTarget.cost}万）`, 'info');
  });
}

function terrainName(t) {
  return { deepWater:'深水区', water:'水域', shallow:'浅滩', sand:'沙地/河岸', grass:'草地/平原', forest:'林地', hill:'丘陵', mountain:'山地', highMountain:'高山', snow:'雪峰' }[t] || t;
}

function showCellInfo(cell, x, y) {
  let html = `<p><strong>坐标：</strong>(${x}, ${y})</p><p><strong>海拔：</strong>${Math.round(cell.elevation)}米</p><p><strong>地形：</strong>${terrainName(cell.terrain)}</p>`;
  if (cell.river) html += `<p><strong>河流：</strong>是</p>`;
  // Check zones
  let foundZone = null;
  for (const z of gameState.zones) {
    for (const c of z.cells) {
      if (c.x === x && c.y === y) { foundZone = z; break; }
    }
    if (foundZone) break;
  }
  if (foundZone) {
    const zt = ZONE_TYPES[foundZone.type];
    const sub = zt.subTypes[foundZone.subType] || zt;
    html += `<p><strong>区域类型：</strong>${zt.name} · ${sub.name}</p>`;
    html += `<p><strong>区域面积：</strong>${foundZone.cells.length}格</p>`;
    if (foundZone.type === 'commercial' && foundZone.shops && foundZone.shops.length > 0) {
      html += `<p><strong>入驻商家（${foundZone.shops.length}）：</strong></p>`;
      for (const shop of foundZone.shops.slice(0, 8)) {
        html += `<p style="margin-left:12px;"><svg viewBox="0 0 24 24" fill="currentColor" style="width:8px;height:8px;display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg> ${shop.name}（${shop.type}）</p>`;
      }
      if (foundZone.shops.length > 8) html += `<p style="margin-left:12px;color:var(--text-2);">...等${foundZone.shops.length}家</p>`;
    }
  }
  // Check roads
  let foundRoad = null;
  for (const r of gameState.roads) {
    for (const c of r.cells) {
      if (c.x === x && c.y === y) { foundRoad = r; break; }
    }
    if (foundRoad) break;
  }
  if (foundRoad) {
    const rt = ROAD_TYPES[foundRoad.grade];
    html += `<p><strong>道路：</strong>${rt.name} · ${foundRoad.name}</p>`;
    html += `<p><strong>道路长度：</strong>${foundRoad.cells.length}格</p>`;
    html += `<button class="modal-btn" style="margin-top:8px;" onclick="renameRoad('${foundRoad.id}')"><span>重命名道路</span></button>`;
  }
  // Check buildings
  const buildings = gameState.buildings.filter(b => b.x === x && b.y === y && b.type !== 'road');
  if (buildings.length > 0) {
    html += `<p><strong>建筑（${buildings.length}）：</strong></p>`;
    for (const b of buildings) {
      const def = BUILDING_TYPES[b.type];
      // 配套建筑显示
      if (b.type.endsWith('_fac')) {
        const parentType = b.type.replace('_fac', '');
        const parentDef = BUILDING_TYPES[parentType];
        const fac = (BUILDING_FACILITIES[parentType] || []).find(f => f.id === b.facilityId);
        if (parentDef && fac) {
          html += `<p style="margin-left:12px;color:${parentDef.color};"><svg viewBox="0 0 24 24" fill="currentColor" style="width:8px;height:8px;display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg> ${fac.name}（配套建筑）</p>`;
        }
        continue;
      }
      if (!def) continue;
      const bIdx = gameState.buildings.indexOf(b);
      const showName = b.customName || def.name;
      const levelTag = b.level ? ` · ${BUILDING_LEVELS[b.level]?.name || ''}` : '';
      // v2.2.7c: 站点建筑增加改名按钮
      const isStation = b.type === 'subwayStation' || b.type === 'lightRailStation';
      const renameBtn = isStation ? ` <button class="modal-btn" style="margin-left:6px;padding:2px 8px;font-size:11px;" onclick="renameStation(${bIdx})">改名</button>` : '';
      html += `<p style="margin-left:12px;color:${def.color};cursor:pointer;text-decoration:underline dotted;" onclick="closeModal();showPlacedBuildingDetail(${bIdx})"><svg viewBox="0 0 24 24" fill="currentColor" style="width:8px;height:8px;display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="6"/></svg> ${showName}${levelTag}（${LAYERS[def.layer].name}）</p>${renameBtn ? `<p style="margin-left:12px;">${renameBtn}</p>` : ''}`;
    }
  }
  if (!foundZone && !foundRoad && buildings.length === 0) html += `<p style="color:var(--text-2);">此处无建筑或区域</p>`;
  const buttons = [{ text: '关闭', color: 'blue', action: closeModal }];
  showModal('地块信息', html, buttons, '查看', 'info');
}

function renameRoad(roadId) {
  const road = gameState.roads.find(r => r.id === roadId);
  if (!road) return;
  const rt = ROAD_TYPES[road.grade];
  const html = `<p>当前名称：<strong>${road.name}</strong></p>
    <p style="margin: 12px 0 8px;">输入新名称：</p>
    <input id="road-name-input" type="text" value="${road.name}" style="width:100%;padding:10px 14px;border-radius:var(--radius-sm);border:1.5px solid var(--separator);font-size:15px;background:var(--bg-card);color:var(--text);" placeholder="如：人民路" />`;
  const buttons = [
    { text: '取消', color: 'gray', action: closeModal },
    { text: '随机生成', color: 'gray', action: () => {
      road.name = generateRoadName(road.grade);
      closeModal(); renderMap(); showNotification(`道路已重命名为：${road.name}`, 'info');
    }},
    { text: '确认', color: 'blue', action: () => {
      const input = document.getElementById('road-name-input');
      if (input && input.value.trim()) {
        road.name = input.value.trim().slice(0, 20);
        closeModal(); renderMap(); showNotification(`道路已重命名为：${road.name}`, 'info');
      }
    }},
  ];
  closeModal();
  showModal(`重命名${rt.name}`, html, buttons, '编辑', 'info');
}

// v2.2.7c: 站点改名功能（地铁站/轻轨站）
function renameStation(buildingIdx) {
  const b = gameState.buildings[buildingIdx];
  if (!b) return;
  const def = BUILDING_TYPES[b.type];
  if (!def) return;
  const currentName = b.customName || def.name;
  const html = `<p>当前站名：<strong>${currentName}</strong></p>
    <p style="margin: 12px 0 8px;">输入新站名：</p>
    <input id="station-name-input" type="text" value="${currentName}" style="width:100%;padding:10px 14px;border-radius:var(--radius-sm);border:1.5px solid var(--separator);font-size:15px;background:var(--bg-card);color:var(--text);" placeholder="如：人民广场站" />`;
  const buttons = [
    { text: '取消', color: 'gray', action: closeModal },
    { text: '随机生成', color: 'gray', action: () => {
      b.customName = generateStationName(b.x, b.y);
      closeModal(); renderMap(); showNotification(`站名已改为：${b.customName}`, 'info');
    }},
    { text: '确认', color: 'blue', action: () => {
      const input = document.getElementById('station-name-input');
      if (input && input.value.trim()) {
        b.customName = input.value.trim().slice(0, 20);
        closeModal(); renderMap(); showNotification(`站名已改为：${b.customName}`, 'info');
      }
    }},
  ];
  closeModal();
  showModal(`重命名${def.name}`, html, buttons, '编辑', 'info');
}

// ===== 拆除框选模式（rect demolish） =====
function startDemolishRect(cellX, cellY) {
  if (cellX < 0 || cellX >= MAP_W || cellY < 0 || cellY >= MAP_H) return;
  gameState.isDemolishBrushing = true;
  gameState._demolishStartCell = { x: cellX, y: cellY };
  gameState._demolishCells = [{ x: cellX, y: cellY }];
  if (canvas) canvas.classList.add('painting');
  renderMap();
}

function updateDemolishRect(cellX, cellY) {
  if (!gameState.isDemolishBrushing || !gameState._demolishStartCell) return;
  const s = gameState._demolishStartCell;
  const x1 = Math.min(s.x, cellX), x2 = Math.max(s.x, cellX);
  const y1 = Math.min(s.y, cellY), y2 = Math.max(s.y, cellY);
  const cells = [];
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) {
        cells.push({ x, y });
      }
    }
  }
  gameState._demolishCells = cells;
  renderMap();
}

function commitDemolishRect() {
  if (!gameState._demolishCells || gameState._demolishCells.length === 0) {
    gameState._demolishStartCell = null;
    gameState._demolishCells = [];
    gameState.isDemolishBrushing = false;
    if (canvas) canvas.classList.remove('painting');
    renderMap();
    return;
  }
  const cellCount = gameState._demolishCells.length;
  const midCell = gameState._demolishCells[Math.floor(cellCount / 2)];
  const screenPt = canvasToScreen(midCell.x * CELL + CELL / 2, midCell.y * CELL + CELL / 2);

  // 先统计拆除对象
  const cellSet = new Set(gameState._demolishCells.map(c => c.x + ',' + c.y));
  let buildingCount = 0, roadCount = 0, zoneCount = 0, transitCount = 0;
  gameState.buildings.forEach(b => { if (b.type !== 'road' && cellSet.has(b.x + ',' + b.y)) buildingCount++; });
  gameState.roads.forEach(r => { if (r.cells.some(c => cellSet.has(c.x + ',' + c.y))) roadCount++; });
  gameState.zones.forEach(z => { if (z.cells.some(c => cellSet.has(c.x + ',' + c.y))) zoneCount++; });
  gameState.transits.forEach(t => { if (t.cells.some(c => cellSet.has(c.x + ',' + c.y))) transitCount++; });
  const totalCount = buildingCount + roadCount + zoneCount + transitCount;

  if (totalCount === 0) {
    gameState._demolishStartCell = null;
    gameState._demolishCells = [];
    gameState.isDemolishBrushing = false;
    if (canvas) canvas.classList.remove('painting');
    renderMap();
    showNotification('框选区域内无可拆除对象', 'info');
    return;
  }

  const parts = [];
  if (buildingCount > 0) parts.push(`建筑×${buildingCount}`);
  if (roadCount > 0) parts.push(`道路×${roadCount}`);
  if (zoneCount > 0) parts.push(`区域×${zoneCount}`);
  if (transitCount > 0) parts.push(`线路×${transitCount}`);

  showFloatConfirm(screenPt.x, screenPt.y, `框选删除·${totalCount}个`, 0, () => {
    doDemolishRect(cellSet);
  });
}

function doDemolishRect(cellSet) {
  let demolishedCount = 0;
  gameState.buildings = gameState.buildings.filter(b => {
    if (b.type === 'road') return true;
    if (cellSet.has(b.x + ',' + b.y)) { demolishedCount++; return false; }
    return true;
  });
  const newRoads = [];
  for (const road of gameState.roads) {
    const remainingCells = road.cells.filter(c => !cellSet.has(c.x + ',' + c.y));
    if (remainingCells.length > 0) { road.cells = remainingCells; newRoads.push(road); }
    else { demolishedCount++; }
  }
  gameState.roads = newRoads;
  const newZones = [];
  for (const zone of gameState.zones) {
    const remainingCells = zone.cells.filter(c => !cellSet.has(c.x + ',' + c.y));
    if (remainingCells.length > 0) {
      zone.cells = remainingCells;
      if (zone.shops) zone.shops = zone.shops.filter(s => !cellSet.has(s.x + ',' + s.y));
      newZones.push(zone);
    } else { demolishedCount++; }
  }
  gameState.zones = newZones;
  const newTransits = [];
  for (const t of gameState.transits) {
    const remainingCells = t.cells.filter(c => !cellSet.has(c.x + ',' + c.y));
    if (remainingCells.length > 0) { t.cells = remainingCells; newTransits.push(t); }
    else { demolishedCount++; }
  }
  gameState.transits = newTransits;
  gameState.buildingCount = gameState.buildings.length;
  gameState._demolishStartCell = null;
  gameState._demolishCells = [];
  gameState.isDemolishBrushing = false;
  if (canvas) canvas.classList.remove('painting');
  showNotification(`框选删除完成：清除 ${demolishedCount} 个对象`, 'info');
  updateUI();
  renderMap();
}

