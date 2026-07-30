/* ============================================================
   置身事内 v2.2.5d — 车流模拟系统
   ============================================================
   v2.2.5d 修复：
   - 移除断裂的离屏画布缓存（无法应用viewState变换导致不渲染）
   - 直接在主画布渲染（已应用translate/scale变换）
   - 用fillRect替代createRadialGradient保持性能
   ============================================================ */

// 道路容量基准
const ROAD_CAPACITY = {
  path:    3,
  street:  8,
  avenue:  16,
  highway: 30,
};

// v2.2.5c: 公共交通分流能力参数
const TRANSIT_DIVERSION = {
  subwayLine:    0.15,
  lightRail:     0.10,
  subwayStation: 0.02,
  lightRailStation: 0.015,
  busStop:       0.01,
  busTerminal:   0.03,
  elevatedRail:  0.08,
};

// v2.2.5c: 公共交通运营成本（每月，单位：万元）
const TRANSIT_OPERATING_COST = {
  subwayLine:    0.8,
  lightRail:     0.4,
  subwayStation: 5,
  lightRailStation: 3,
  busStop:       0.5,
  busTerminal:   8,
  elevatedRail:  0.4,
  elevatedRoad:  0.3,
};

// v2.2.5c: 获取公共交通分摊比例
function getTransitShare() {
  let share = 0;
  let subwayLines = 0, lightRails = 0, elevatedRails = 0;
  if (gameState.transits && gameState.transits.length > 0) {
    for (const t of gameState.transits) {
      if (t.type === 'subway') subwayLines++;
      else if (t.type === 'lightRail') lightRails++;
      else if (t.type === 'elevatedRail') elevatedRails++;
    }
  }
  if (gameState.buildings) {
    const buildingCounts = {};
    for (const b of gameState.buildings) {
      if (b.underConstruction) continue;
      buildingCounts[b.type] = (buildingCounts[b.type] || 0) + 1;
    }
    const subwayLineCells = buildingCounts['subwayLine'] || 0;
    const lightRailCells = buildingCounts['lightRail'] || 0;
    if (subwayLineCells > 0 && subwayLines === 0) {
      subwayLines = Math.max(1, Math.floor(subwayLineCells / 15));
    }
    if (lightRailCells > 0 && lightRails === 0) {
      lightRails = Math.max(1, Math.floor(lightRailCells / 15));
    }
    share += (buildingCounts['subwayStation'] || 0) * TRANSIT_DIVERSION.subwayStation;
    share += (buildingCounts['lightRailStation'] || 0) * TRANSIT_DIVERSION.lightRailStation;
    share += (buildingCounts['busStop'] || 0) * TRANSIT_DIVERSION.busStop;
    share += (buildingCounts['busTerminal'] || 0) * TRANSIT_DIVERSION.busTerminal;
  }
  share += subwayLines * TRANSIT_DIVERSION.subwayLine;
  share += lightRails * TRANSIT_DIVERSION.lightRail;
  share += elevatedRails * TRANSIT_DIVERSION.elevatedRail;
  const fare = (gameState.policies && gameState.policies.transitFare) || 1.0;
  const interval = (gameState.policies && gameState.policies.transitInterval) || 5;
  const fareMultiplier = Math.max(0.3, 1 - (fare - 1) * 0.4);
  const intervalMultiplier = Math.max(0.2, Math.min(1.5, 5 / interval));
  share *= fareMultiplier * intervalMultiplier;
  return Math.min(0.6, share);
}

// v2.2.5c: 计算公共交通月度运营成本
function getTransitOperatingCost() {
  if (!gameState.buildings) return 0;
  const counts = {};
  for (const b of gameState.buildings) {
    if (b.underConstruction) continue;
    counts[b.type] = (counts[b.type] || 0) + 1;
  }
  let subwayCells = 0, lightRailCells = 0, elevatedRailCells = 0, elevatedRoadCells = 0;
  if (gameState.transits) {
    for (const t of gameState.transits) {
      const len = t.cells ? t.cells.length : 0;
      if (t.type === 'subway') subwayCells += len;
      else if (t.type === 'lightRail') lightRailCells += len;
      else if (t.type === 'elevatedRail') elevatedRailCells += len;
      else if (t.type === 'elevatedRoad') elevatedRoadCells += len;
    }
  }
  subwayCells += counts['subwayLine'] || 0;
  lightRailCells += counts['lightRail'] || 0;
  elevatedRailCells += counts['elevatedRail'] || 0;
  elevatedRoadCells += counts['elevatedRoad'] || 0;
  let cost = 0;
  cost += subwayCells * TRANSIT_OPERATING_COST.subwayLine;
  cost += lightRailCells * TRANSIT_OPERATING_COST.lightRail;
  cost += elevatedRailCells * TRANSIT_OPERATING_COST.elevatedRail;
  cost += elevatedRoadCells * TRANSIT_OPERATING_COST.elevatedRoad;
  cost += (counts['subwayStation'] || 0) * TRANSIT_OPERATING_COST.subwayStation;
  cost += (counts['lightRailStation'] || 0) * TRANSIT_OPERATING_COST.lightRailStation;
  cost += (counts['busStop'] || 0) * TRANSIT_OPERATING_COST.busStop;
  cost += (counts['busTerminal'] || 0) * TRANSIT_OPERATING_COST.busTerminal;
  const interval = (gameState.policies && gameState.policies.transitInterval) || 5;
  const intervalCostMultiplier = Math.max(0.4, Math.min(2.0, 5 / interval));
  cost *= intervalCostMultiplier;
  return cost;
}

// 车流模拟主函数
function simulateTraffic() {
  if (!gameState.roads || gameState.roads.length === 0) {
    gameState.trafficStats = { congestionLevel: 0, congestedCells: [], avgSpeed: 1.0, congestedCount: 0, totalCells: 0, allCells: [], demandMap: {} };
    return;
  }
  const cellToRoad = {};
  for (let ri = 0; ri < gameState.roads.length; ri++) {
    const road = gameState.roads[ri];
    for (const c of road.cells) {
      cellToRoad[c.x + ',' + c.y] = { grade: road.grade, roadId: ri };
    }
  }
  const roadDemand = new Array(gameState.roads.length).fill(0);
  const demandMap = {};
  const scanRange = 3;
  for (const b of gameState.buildings) {
    if (b.underConstruction) continue;
    if (b.layer && b.layer !== 'ground') continue;
    const def = BUILDING_TYPES[b.type];
    if (!def) continue;
    const cat = def.cat;
    let weight = 0;
    if (cat === 'residential') weight = 1.0;
    else if (cat === 'commercial') weight = 1.2;
    else if (cat === 'industrial') weight = 0.8;
    else if (cat === 'hazardous') weight = 0.6;
    else if (cat === 'infrastructure') weight = 0.3;
    else continue;
    for (let dy = -scanRange; dy <= scanRange; dy++) {
      for (let dx = -scanRange; dx <= scanRange; dx++) {
        if (dx === 0 && dy === 0) continue;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist > scanRange) continue;
        const key = (b.x + dx) + ',' + (b.y + dy);
        const info = cellToRoad[key];
        if (info) {
          const contribution = weight * (1 - dist / (scanRange + 1));
          roadDemand[info.roadId] += contribution;
          demandMap[key] = (demandMap[key] || 0) + contribution;
        }
      }
    }
  }
  const transitShare = getTransitShare();
  const effectiveDemand = roadDemand.map(d => d * (1 - transitShare));
  const allCells = [];
  const congestedCells = [];
  let totalCongestion = 0;
  let totalCells = 0;
  for (let ri = 0; ri < gameState.roads.length; ri++) {
    const road = gameState.roads[ri];
    const cap = ROAD_CAPACITY[road.grade] || 5;
    const cellCount = road.cells.length;
    if (cellCount === 0) continue;
    const avgDemand = effectiveDemand[ri] / cellCount;
    const congestionRatio = avgDemand / cap;
    let level = 0;
    if (congestionRatio > 2.0) level = 3;
    else if (congestionRatio > 1.3) level = 2;
    else if (congestionRatio > 0.8) level = 1;
    for (const c of road.cells) {
      allCells.push({ x: c.x, y: c.y, level, roadId: ri, ratio: congestionRatio });
      if (level > 0) {
        congestedCells.push({ x: c.x, y: c.y, level, roadId: ri });
      }
    }
    totalCongestion += congestionRatio * cellCount;
    totalCells += cellCount;
  }
  const avgRatio = totalCells > 0 ? totalCongestion / totalCells : 0;
  const avgSpeed = Math.max(0.1, 1 - avgRatio * 0.4);
  const congestionLevel = avgRatio > 2 ? 3 : avgRatio > 1.3 ? 2 : avgRatio > 0.8 ? 1 : 0;
  const connectivityGaps = _findConnectivityGaps(cellToRoad, demandMap);
  // v2.2.6: 构建建筑热力图（沿岗位和住宅分布，而非道路）
  const buildingHeatmap = {};
  const heatSpread = 4; // 扩散范围
  for (const b of gameState.buildings) {
    if (b.underConstruction) continue;
    if (b.layer && b.layer !== 'ground') continue;
    const def = BUILDING_TYPES[b.type];
    if (!def) continue;
    const cat = def.cat;
    let weight = 0;
    if (cat === 'residential') weight = 1.0;
    else if (cat === 'commercial') weight = 1.3;
    else if (cat === 'industrial') weight = 0.9;
    else if (cat === 'hazardous') weight = 0.5;
    else continue;
    // 在建筑自身位置及周围扩散需求热度
    for (let dy = -heatSpread; dy <= heatSpread; dy++) {
      for (let dx = -heatSpread; dx <= heatSpread; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > heatSpread) continue;
        const key = (b.x + dx) + ',' + (b.y + dy);
        const falloff = 1 - dist / (heatSpread + 1);
        buildingHeatmap[key] = (buildingHeatmap[key] || 0) + weight * falloff;
      }
    }
  }
  gameState.trafficStats = {
    congestionLevel,
    congestedCells,
    allCells,
    avgSpeed,
    congestedCount: congestedCells.length,
    totalCells,
    avgRatio: avgRatio,
    demandMap,
    buildingHeatmap, // v2.2.6: 建筑热力图
    connectivityGaps,
    transitShare,
  };
  if (congestionLevel >= 3) {
    gameState.happiness = Math.max(0, (gameState.happiness || 50) - 0.5);
  } else if (congestionLevel >= 2) {
    gameState.happiness = Math.max(0, (gameState.happiness || 50) - 0.2);
  }
}

function _findConnectivityGaps(cellToRoad, demandMap) {
  const gaps = [];
  const buildingClusters = {};
  const clusterKey = (x, y) => Math.floor(x / 5) + ',' + Math.floor(y / 5);
  for (const b of gameState.buildings) {
    if (b.underConstruction) continue;
    if (b.layer && b.layer !== 'ground') continue;
    const def = BUILDING_TYPES[b.type];
    if (!def) continue;
    const cat = def.cat;
    if (cat !== 'residential' && cat !== 'commercial' && cat !== 'industrial') continue;
    const ck = clusterKey(b.x, b.y);
    if (!buildingClusters[ck]) buildingClusters[ck] = { x: 0, y: 0, count: 0, hasRoad: false };
    buildingClusters[ck].x += b.x;
    buildingClusters[ck].y += b.y;
    buildingClusters[ck].count++;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (cellToRoad[(b.x + dx) + ',' + (b.y + dy)]) {
          buildingClusters[ck].hasRoad = true;
        }
      }
    }
  }
  for (const [ck, cluster] of Object.entries(buildingClusters)) {
    if (cluster.count >= 3 && !cluster.hasRoad) {
      gaps.push({
        x: Math.round(cluster.x / cluster.count),
        y: Math.round(cluster.y / cluster.count),
        count: cluster.count,
      });
    }
  }
  return gaps;
}

// v2.2.5d: 渲染拥堵色带（直接在主画布渲染，已应用viewState变换）
function renderTrafficOverlay(ctx) {
  const ts = gameState.trafficStats;
  if (!ts || !ts.allCells || ts.allCells.length === 0) return;
  const levelColor = {
    0: 'rgba(46, 204, 113, 0.35)',
    1: 'rgba(241, 196, 15, 0.55)',
    2: 'rgba(230, 126, 34, 0.70)',
    3: 'rgba(231, 76, 60, 0.80)',
  };
  const levelWidth = { 0: 2, 1: 3, 2: 4, 3: 5.5 };
  const byRoad = {};
  for (const cc of ts.allCells) {
    if (!byRoad[cc.roadId]) byRoad[cc.roadId] = [];
    byRoad[cc.roadId].push(cc);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [roadIdStr, cells] of Object.entries(byRoad)) {
    const road = gameState.roads[parseInt(roadIdStr)];
    if (!road) continue;
    const cellLevelMap = {};
    for (const cc of cells) {
      cellLevelMap[cc.x + ',' + cc.y] = cc.level;
    }
    for (let lv = 0; lv <= 3; lv++) {
      ctx.strokeStyle = levelColor[lv];
      ctx.lineWidth = levelWidth[lv];
      ctx.beginPath();
      let started = false;
      for (const c of road.cells) {
        const cellLv = cellLevelMap[c.x + ',' + c.y];
        if (cellLv !== lv) { started = false; continue; }
        const px = c.x * CELL + CELL / 2, py = c.y * CELL + CELL / 2;
        if (!started) { ctx.moveTo(px, py); started = true; }
        else { ctx.lineTo(px, py); }
      }
      ctx.stroke();
    }
  }
}

// v2.2.6: 渲染需求热力图（沿岗位和住宅分布，圆形渐变，更圆润）
function renderTrafficHeatmap(ctx) {
  const ts = gameState.trafficStats;
  // v2.2.6: 使用建筑热力图（而非道路需求图）
  const heatmap = ts.buildingHeatmap || ts.demandMap;
  if (!heatmap) return;
  const heatEntries = Object.entries(heatmap);
  if (heatEntries.length === 0) return;
  let maxHeat = 0;
  for (const [, val] of heatEntries) {
    if (val > maxHeat) maxHeat = val;
  }
  if (maxHeat === 0) return;
  ctx.save();
  // v2.2.6: 用圆形渐变绘制，重叠形成圆润的热力图效果
  for (const [key, val] of heatEntries) {
    const [x, y] = key.split(',').map(Number);
    const intensity = val / maxHeat;
    if (intensity < 0.08) continue;
    const px = x * CELL + CELL / 2, py = y * CELL + CELL / 2;
    // v2.2.6: 圆形渐变（radial gradient）让边缘自然过渡
    const radius = CELL * (1.2 + intensity * 1.5);
    const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
    let color;
    if (intensity > 0.65) { color = '231, 76, 60'; }
    else if (intensity > 0.35) { color = '230, 126, 34'; }
    else { color = '241, 196, 15'; }
    const alpha = Math.min(0.5, intensity * 0.55);
    grad.addColorStop(0, `rgba(${color}, ${alpha})`);
    grad.addColorStop(0.6, `rgba(${color}, ${alpha * 0.4})`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // 连通性缺口标记
  if (ts.connectivityGaps && ts.connectivityGaps.length > 0) {
    ctx.strokeStyle = 'rgba(155, 89, 182, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    for (const gap of ts.connectivityGaps) {
      const px = gap.x * CELL + CELL / 2, py = gap.y * CELL + CELL / 2;
      ctx.beginPath();
      ctx.arc(px, py, CELL * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(155, 89, 182, 0.5)';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// 兼容性：保留空函数（旧代码可能调用）
function invalidateTrafficCache() {}

function getTrafficStatusText() {
  const ts = gameState.trafficStats;
  if (!ts || !ts.totalCells) return '暂无道路';
  const lv = ts.congestionLevel || 0;
  const labels = ['畅通', '局部缓慢', '多处拥堵', '严重拥堵'];
  const colors = ['var(--green)', 'var(--yellow)', 'var(--accent)', 'var(--red)'];
  return { text: labels[lv], color: colors[lv], level: lv, speed: ts.avgSpeed };
}
