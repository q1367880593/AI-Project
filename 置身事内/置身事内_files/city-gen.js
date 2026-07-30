function generateStarterCity() {
  const ms = getMapSizeForLevel(gameState.cityLevelId);
  MAP_W = ms.w;
  MAP_H = ms.h;

  gameState.zones = [];
  gameState.roads = [];
  gameState.transits = [];

  const level = getCityLevel();
  const lvId = level.id;

  const cx = Math.floor(MAP_W / 2);
  const cy = Math.floor(MAP_H / 2);

  // === Buildable cells ===
  const buildable = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const c = mapCells[y * MAP_W + x];
      if (!c || c.elevation === undefined) continue;
      if (!c.isWater && c.elevation >= 70 && c.elevation < 300) {
        buildable.push({ x, y });
      }
    }
  }

  if (buildable.length < 30) {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const c = mapCells[y * MAP_W + x];
        if (!c || c.elevation === undefined) continue;
        if (!c.isWater && c.elevation < 500) buildable.push({ x, y });
      }
    }
    if (buildable.length < 30) return;
  }

  // === Helpers ===
  const k = (x, y) => x + ',' + y;
  const inMap = (x, y) => x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
  const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  const buildableKey = new Set(buildable.map(c => k(c.x, c.y)));
  const placedRoads = new Set();
  const occupied = new Set();
  const cityCells = new Set();
  // v2.2.1: 先抽取城市化等级（城市等级越高，初始城市化率越高），用于控制农田与城市建筑配比
  // 农田必须先于城市建筑生成，保证初始地图满足耕地红线要求
  const _urbanPick = pickInitialUrbanizationLevel(lvId);
  const _targetUrbanRatio = _urbanPick.targetUrbanRatio;
  const _uLevel = URBANIZATION_LEVELS[_urbanPick.levelId];
  // 目标农田格数 = 全部可建格数（与 calcBuildableArea 口径一致）× 红线比例 × 1.20（留 20% 安全余量）
  const _targetFarmland = Math.ceil((calcBuildableArea(mapCells) || buildable.length) * _uLevel.farmlandRedlineRatio * 1.20);
  const cellKind = Object.create(null);
  const cityCellsByKind = {
    cbd: [],
    residential: [],
    commercial: [],
    industrial: []
  };

  // === v2.3.1e: 风向参数 — 根据主导风向布局工业区（下风向）和住宅区（上风向） ===
  function findBuildableNear(tx, ty, searchR) {
    if (buildableKey.has(k(tx, ty))) return { x: tx, y: ty };
    for (let r = 1; r <= searchR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;
          const nx = clamp(tx + dx, 0, MAP_W - 1), ny = clamp(ty + dy, 0, MAP_H - 1);
          if (buildableKey.has(k(nx, ny))) return { x: nx, y: ny };
        }
      }
    }
    return { x: tx, y: ty };
  }
  const WIND_DIRECTIONS = [
    { name: '北风',   upDx: 0,  upDy: -1 },
    { name: '东北风', upDx: 1,  upDy: -1 },
    { name: '东风',   upDx: 1,  upDy: 0 },
    { name: '东南风', upDx: 1,  upDy: 1 },
    { name: '南风',   upDx: 0,  upDy: 1 },
    { name: '西南风', upDx: -1, upDy: 1 },
    { name: '西风',   upDx: -1, upDy: 0 },
    { name: '西北风', upDx: -1, upDy: -1 },
  ];
  const _windWeights = [0.08, 0.06, 0.06, 0.18, 0.08, 0.06, 0.06, 0.42];
  let _wAcc = 0, _wR = Math.random(), _wIdx = 0;
  for (let i = 0; i < WIND_DIRECTIONS.length; i++) {
    _wAcc += _windWeights[i];
    if (_wR < _wAcc) { _wIdx = i; break; }
  }
  const _wind = WIND_DIRECTIONS[_wIdx];
  const upDx = _wind.upDx, upDy = _wind.upDy;
  const dwDx = -upDx, dwDy = -upDy;
  const perpDx = -upDy, perpDy = upDx;
  gameState.windDirection = _wind.name;

  // === 6个锚点（根据风向布局：住宅上风向，工业下风向） ===
  const indOffset = Math.round(10 + lvId * 2);
  const resOffset = Math.round(8 + lvId * 2);
  const anchors = [
    Object.assign(findBuildableNear(cx, cy, 10), { kind: 'cbd', weight: 20 }),
    // 商业区：靠近市中心
    Object.assign(findBuildableNear(clamp(cx + randInt(-10, 10), 0, MAP_W - 1), clamp(cy + randInt(-8, 8), 0, MAP_H - 1), 8), { kind: 'commercial', weight: 16 }),
    // 住宅区：上风向
    Object.assign(findBuildableNear(
      clamp(cx + upDx * resOffset + perpDx * randInt(-6, 6), 0, MAP_W - 1),
      clamp(cy + upDy * resOffset + perpDy * randInt(-6, 6), 0, MAP_H - 1), 8), { kind: 'residential', weight: 15 }),
    Object.assign(findBuildableNear(
      clamp(cx + upDx * (resOffset - 3) + perpDx * randInt(-10, -3), 0, MAP_W - 1),
      clamp(cy + upDy * (resOffset - 3) + perpDy * randInt(-10, -3), 0, MAP_H - 1), 8), { kind: 'residential', weight: 15 }),
    // 工业区：下风向
    Object.assign(findBuildableNear(
      clamp(cx + dwDx * indOffset + perpDx * randInt(-6, 6), 0, MAP_W - 1),
      clamp(cy + dwDy * indOffset + perpDy * randInt(-6, 6), 0, MAP_H - 1), 8), { kind: 'industrial', weight: 13 }),
    Object.assign(findBuildableNear(
      clamp(cx + dwDx * (indOffset - 3) + perpDx * randInt(3, 10), 0, MAP_W - 1),
      clamp(cy + dwDy * (indOffset - 3) + perpDy * randInt(3, 10), 0, MAP_H - 1), 8), { kind: 'industrial', weight: 13 })
  ];

  function scoreCellToAnchor(c, a) {
    const dx = Math.abs(c.x - a.x);
    const dy = Math.abs(c.y - a.y);
    const noise = (Math.sin((c.x + a.x) * 0.23) + Math.cos((c.y - a.y) * 0.19)) * 1.4;
    return a.weight - dx * 0.5 - dy * 0.5 + noise;
  }

  // === Footprint ===
  // v2.2.1b: 城市范围随等级扩展，避免城市被严重压缩
  // v2.3.1e: 扩大城市规模
  const targetFootprint = Math.min(250 + lvId * 150, 1000);
  let threshold = 4.0;
  for (let pass = 0; pass < 4; pass++) {
    cityCells.clear();
    for (const c of buildable) {
      let bestScore = -1e9;
      let bestKind = 'residential';
      for (const a of anchors) {
        const s = scoreCellToAnchor(c, a);
        if (s > bestScore) {
          bestScore = s;
          bestKind = a.kind;
        }
      }
      if (bestScore >= threshold) {
        const kk = k(c.x, c.y);
        cityCells.add(kk);
        cellKind[kk] = bestKind;
        cityCellsByKind[bestKind].push({ x: c.x, y: c.y });
      }
    }
    if (cityCells.size >= targetFootprint) break;
    threshold -= 0.5;
  }

  function growFootprint(rounds) {
    const neigh = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let r = 0; r < rounds; r++) {
      const add = [];
      for (const c of buildable) {
        const kk = k(c.x, c.y);
        if (cityCells.has(kk)) continue;
        let n = 0;
        for (const d of neigh) {
          if (cityCells.has(k(c.x + d[0], c.y + d[1]))) n++;
        }
        if (n >= 2 && Math.random() < 0.45) {
          add.push(c);
        }
      }
      for (const c of add) {
        const kk = k(c.x, c.y);
        cityCells.add(kk);
        if (!cellKind[kk]) {
          let bestAnchor = anchors[0];
          let bestScore = -1e9;
          for (const a of anchors) {
            const s = scoreCellToAnchor(c, a);
            if (s > bestScore) {
              bestScore = s;
              bestAnchor = a;
            }
          }
          cellKind[kk] = bestAnchor.kind;
          cityCellsByKind[bestAnchor.kind].push({ x: c.x, y: c.y });
        }
      }
    }
  }
  // v2.3.1e: 增加生长轮次，扩大城市范围
  growFootprint(6 + lvId * 3);

  if (cityCells.size < targetFootprint * 0.5) {
    const fallback = buildable
      .slice()
      .sort((a, b) => {
        const da = Math.abs(a.x - cx) + Math.abs(a.y - cy);
        const db = Math.abs(b.x - cx) + Math.abs(b.y - cy);
        return da - db;
      })
      .slice(0, targetFootprint);
    for (const c of fallback) {
      const kk = k(c.x, c.y);
      cityCells.add(kk);
      if (!cellKind[kk]) {
        cellKind[kk] = 'residential';
        cityCellsByKind.residential.push({ x: c.x, y: c.y });
      }
    }
  }

  const cityList = [];
  for (const kk of cityCells) {
    const sp = kk.split(',');
    cityList.push({ x: parseInt(sp[0], 10), y: parseInt(sp[1], 10) });
  }

  let minX = MAP_W, minY = MAP_H, maxX = 0, maxY = 0;
  for (const c of cityList) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  minX = clamp(minX - 2, 0, MAP_W - 1);
  minY = clamp(minY - 2, 0, MAP_H - 1);
  maxX = clamp(maxX + 2, 0, MAP_W - 1);
  maxY = clamp(maxY + 2, 0, MAP_H - 1);

  // === Road cell helpers ===
  function isValidRoadCell(x, y) {
    if (!inMap(x, y)) return false;
    const cell = mapCells[y * MAP_W + x];
    if (!cell) return false;
    if (cell.elevation > 500) return false;
    if (!buildableKey.has(k(x, y)) && !cell.isWater && !cell.river) return false;
    return true;
  }

  function classifyRoadCell(x, y, allowWater) {
    if (!inMap(x, y)) return 'invalid';
    const cell = mapCells[y * MAP_W + x];
    if (!cell) return 'invalid';
    if (cell.elevation > 500) return 'invalid';
    if ((cell.isWater || cell.river) && !allowWater) return 'invalid';
    if (!isValidRoadCell(x, y) && !(cell.isWater || cell.river)) return 'invalid';
    if (placedRoads.has(k(x, y))) return 'existing';
    return 'new';
  }

  function drawHVPath(roadCells, x0, y0, x1, y1, allowWater) {
    function tryAdd(x, y) {
      const status = classifyRoadCell(x, y, allowWater);
      if (status === 'invalid') return false;
      roadCells.push({ x, y });
      return status !== 'existing';
    }
    if (!tryAdd(x0, y0)) return;
    let x = x0, y = y0;
    const stepX = x < x1 ? 1 : -1;
    const stepY = y < y1 ? 1 : -1;
    while (x !== x1) {
      x += stepX;
      if (!tryAdd(x, y)) break;
    }
    while (y !== y1) {
      y += stepY;
      if (!tryAdd(x, y)) break;
    }
  }

  const MIN_PARALLEL_DIST = 2;
  const horizontalRoadYs = new Set();
  const verticalRoadXs = new Set();

  function tooCloseToParallel(isHorizontal, pos) {
    const set = isHorizontal ? horizontalRoadYs : verticalRoadXs;
    for (let d = 1; d <= MIN_PARALLEL_DIST; d++) {
      if (set.has(pos + d) || set.has(pos - d)) return true;
    }
    return false;
  }

  function sortRoadCells(cells) {
    if (cells.length <= 1) return cells;
    const allSameY = cells.every(c => c.y === cells[0].y);
    const allSameX = cells.every(c => c.x === cells[0].x);
    if (allSameY) {
      cells.sort((a, b) => a.x - b.x);
    } else if (allSameX) {
      cells.sort((a, b) => a.y - b.y);
    }
    return cells;
  }

  function commitRoad(roadCells, grade) {
    if (!roadCells || roadCells.length < 1) return;
    const seen = new Set();
    const deduped = [];
    for (const c of roadCells) {
      const key = c.x + ',' + c.y;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(c);
      }
    }
    if (deduped.length < 1) return;
    sortRoadCells(deduped);
    if (deduped.length > 1) {
      const allSameY = deduped.every(c => c.y === deduped[0].y);
      const allSameX = deduped.every(c => c.x === deduped[0].x);
      if (allSameY) horizontalRoadYs.add(deduped[0].y);
      if (allSameX) verticalRoadXs.add(deduped[0].x);
    }
    gameState.roads.push({
      id: 'road_' + (++paintIdCounter),
      grade: grade,
      cells: deduped,
      name: generateRoadName(grade)
    });
    for (const c of deduped) {
      const kk = k(c.x, c.y);
      if (!placedRoads.has(kk)) {
        placedRoads.add(kk);
        gameState.buildings.push({ x: c.x, y: c.y, type: 'road', layer: 'ground', age: 0 });
      }
    }
  }

  // ========== v2.3.2: 地形分级生成 — 乡镇（lvId === 0）横平竖直+至多一条正斜向路 ==========
  function buildTownshipRoads() {
    const allowWater = true;
    const mainGrade = 'avenue';
    const streetGrade = 'street';
    const cbdAnchor = anchors.find(a => a.kind === 'cbd') || anchors[0];

    // --- 1. 主十字路：穿过 CBD 的一条水平 + 一条垂直（大道级别） ---
    // 水平主干
    {
      const y = cbdAnchor.y;
      const cells = [];
      drawHVPath(cells, clamp(cbdAnchor.x - 14, 0, MAP_W - 1), y,
                 clamp(cbdAnchor.x + 14, 0, MAP_W - 1), y, allowWater);
      if (cells.length > 1) commitRoad(cells, mainGrade);
    }
    // 垂直主干
    {
      const x = cbdAnchor.x;
      if (!tooCloseToParallel(false, x)) {
        const cells = [];
        drawHVPath(cells, x, clamp(cbdAnchor.y - 14, 0, MAP_H - 1),
                   x, clamp(cbdAnchor.y + 14, 0, MAP_H - 1), allowWater);
        if (cells.length > 1) commitRoad(cells, mainGrade);
      }
    }

    // --- 2. 其他锚点通过横平竖直街道连接到主十字路 ---
    for (const a of anchors) {
      if (a === cbdAnchor) continue;
      // 水平街道：从锚点水平延伸到 CBD 的 x 列
      {
        const y = a.y;
        if (!tooCloseToParallel(true, y)) {
          const cells = [];
          drawHVPath(cells, a.x, y, cbdAnchor.x, y, allowWater);
          if (cells.length > 1) commitRoad(cells, streetGrade);
        }
      }
      // 垂直街道：从锚点垂直延伸到 CBD 的 y 行
      {
        const x = a.x;
        if (!tooCloseToParallel(false, x)) {
          const cells = [];
          drawHVPath(cells, x, a.y, x, cbdAnchor.y, allowWater);
          if (cells.length > 1) commitRoad(cells, streetGrade);
        }
      }
    }

    // --- 3. 至多一条正斜向路（45°对角线） ---
    // 50% 概率生成一条对角线街道
    if (Math.random() < 0.5) {
      let bestPair = null, bestDiff = 1e9;
      for (let i = 0; i < anchors.length; i++) {
        for (let j = i + 1; j < anchors.length; j++) {
          const dx = Math.abs(anchors[j].x - anchors[i].x);
          const dy = Math.abs(anchors[j].y - anchors[i].y);
          const diff = Math.abs(dx - dy);
          // 选择最接近 45° 的锚点对（dx ≈ dy，且长度足够）
          if (diff < bestDiff && dx >= 4 && dy >= 4) {
            bestDiff = diff;
            bestPair = [anchors[i], anchors[j]];
          }
        }
      }
      // 只在能找到近似 45° 的锚点对时生成（容差 3 格）
      if (bestPair && bestDiff <= 3) {
        const [a, b] = bestPair;
        const sx = a.x < b.x ? 1 : -1;
        const sy = a.y < b.y ? 1 : -1;
        const len = Math.min(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        const cells = [];
        let cx = a.x, cy = a.y;
        for (let i = 0; i <= len; i++) {
          const status = classifyRoadCell(cx, cy, allowWater);
          if (status === 'invalid') break;
          cells.push({ x: cx, y: cy });
          if (status === 'existing' && i > 0) break;
          cx += sx; cy += sy;
        }
        if (cells.length >= 3) commitRoad(cells, streetGrade);
      }
    }
  }

  // ========== 高复杂度路网生成（县城及以上） ==========
  function buildMultiCenterBFSRoads() {
    const allowWater = true;
    const backboneGrade = 'avenue';
    const mainRayGrade = 'avenue';
    const secondaryRayGrade = 'street';
    const branchGrade = 'street';

    function spawnBranches(x, y, dir, depth, maxDepth, branchLenBase, cells) {
      if (depth > maxDepth) return;
      const perpDirs = dir.dx !== 0
        ? [{ dx: 0, dy: 1 }, { dx: 0, dy: -1 }]
        : [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }];
      for (const perp of perpDirs) {
        const prob = depth === 1 ? 0.7 : (depth === 2 ? 0.5 : 0.3);
        if (Math.random() < prob) {
          const branchIsHorizontal = perp.dx !== 0;
          const branchPos = branchIsHorizontal ? y : x;
          if (tooCloseToParallel(branchIsHorizontal, branchPos)) continue;
          const startStatus = classifyRoadCell(x, y, allowWater);
          if (startStatus === 'invalid') continue;
          const branchLen = branchLenBase + randInt(0, 2) - depth;
          const branchCells = [{ x, y }];
          let bx = x, by = y;
          for (let b = 0; b < branchLen; b++) {
            bx += perp.dx;
            by += perp.dy;
            const bStatus = classifyRoadCell(bx, by, allowWater);
            if (bStatus === 'invalid') break;
            branchCells.push({ x: bx, y: by });
            if (bStatus === 'existing') break;
          }
          if (branchCells.length > 1) {
            commitRoad(branchCells, depth === 1 ? branchGrade : 'street');
            if (depth < maxDepth && branchCells.length > 2) {
              const last = branchCells[branchCells.length - 1];
              const prev = branchCells[branchCells.length - 2];
              const lastDir = { dx: last.x - prev.x, dy: last.y - prev.y };
              spawnBranches(last.x, last.y, lastDir, depth + 1, maxDepth, Math.max(2, branchLenBase - 1), branchCells);
            }
          }
        }
      }
    }

    function bfsFromAnchor(anchor, rayGrade) {
      const dirs = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
      ];
      const mainLen = 12 + lvId * 4 + randInt(0, 6);

      for (const dir of dirs) {
        const isHorizontal = dir.dy === 0;
        const rayPos = isHorizontal ? anchor.y : anchor.x;
        if (tooCloseToParallel(isHorizontal, rayPos)) continue;

        const rayCells = [];
        const seedStatus = classifyRoadCell(anchor.x, anchor.y, allowWater);
        if (seedStatus === 'invalid') continue;
        rayCells.push({ x: anchor.x, y: anchor.y });

        let x = anchor.x, y = anchor.y;
        let lastBranch = -10;
        for (let step = 0; step < mainLen; step++) {
          x += dir.dx;
          y += dir.dy;
          const status = classifyRoadCell(x, y, allowWater);
          if (status === 'invalid') break;
          rayCells.push({ x, y });
          if (status === 'existing') break;

          if (step - lastBranch >= 3 && Math.random() < 0.65) {
            lastBranch = step;
            spawnBranches(x, y, dir, 1, 3, 5 + randInt(0, 4), rayCells);
          }
        }
        if (rayCells.length > 1) {
          commitRoad(rayCells, rayGrade);
        }
      }
    }

    for (const a of anchors) {
      const rayGrade = (a.kind === 'cbd' || a.kind === 'commercial')
        ? mainRayGrade
        : secondaryRayGrade;
      bfsFromAnchor(a, rayGrade);
    }

    function connectAnchors(a, b, grade) {
      function findSpacedPos(isHorizontal, pos) { return pos; }
      if (a.y === b.y) {
        const y = findSpacedPos(true, a.y);
        const cells = [];
        drawHVPath(cells, a.x, y, b.x, y, allowWater);
        commitRoad(cells, grade);
      } else if (a.x === b.x) {
        const x = findSpacedPos(false, a.x);
        const cells = [];
        drawHVPath(cells, x, a.y, x, b.y, allowWater);
        commitRoad(cells, grade);
      } else {
        const hCells1 = [], vCells1 = [];
        drawHVPath(hCells1, a.x, a.y, b.x, a.y, allowWater);
        drawHVPath(vCells1, b.x, a.y, b.x, b.y, allowWater);
        const len1 = hCells1.length + vCells1.length;
        const hCells2 = [], vCells2 = [];
        drawHVPath(vCells2, a.x, a.y, a.x, b.y, allowWater);
        drawHVPath(hCells2, a.x, b.y, b.x, b.y, allowWater);
        const len2 = vCells2.length + hCells2.length;
        if (len1 <= len2) {
          if (hCells1.length > 1) commitRoad(hCells1, grade);
          if (vCells1.length > 1) commitRoad(vCells1, grade);
        } else {
          if (vCells2.length > 1) commitRoad(vCells2, grade);
          if (hCells2.length > 1) commitRoad(hCells2, grade);
        }
      }
    }

    const cbdAnchor = anchors.find(a => a.kind === 'cbd') || anchors[0];
    for (const a of anchors) {
      if (a === cbdAnchor) continue;
      connectAnchors(cbdAnchor, a, backboneGrade);
    }

    const nonCBD = anchors.filter(a => a !== cbdAnchor);
    for (let i = 0; i < nonCBD.length; i++) {
      for (let j = i + 1; j < nonCBD.length; j++) {
        if (Math.random() < 0.7) {
          connectAnchors(nonCBD[i], nonCBD[j], secondaryRayGrade);
        }
      }
    }
  }

  // v2.3.2: 地形分级生成 — 乡镇用简化路网，县城及以上用复杂路网
  if (lvId === 0) {
    buildTownshipRoads();
  } else {
    buildMultiCenterBFSRoads();
  }

  // === 断头路连接 ===
  function connectDeadEnds(forceAll = false) {
    const roadCellSet = new Set();
    const roadCellMap = new Map();
    for (const road of gameState.roads) {
      for (const c of road.cells) {
        const key = k(c.x, c.y);
        roadCellSet.add(key);
        if (!roadCellMap.has(key)) roadCellMap.set(key, 0);
      }
    }
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const key of roadCellSet) {
      const [x, y] = key.split(',').map(Number);
      let deg = 0;
      for (const d of dirs) {
        const nk = k(x+d[0], y+d[1]);
        if (roadCellSet.has(nk)) deg++;
      }
      roadCellMap.set(key, deg);
    }
    const endpoints = [];
    for (const [key, deg] of roadCellMap) {
      if (deg <= 1) {
        const [x, y] = key.split(',').map(Number);
        endpoints.push({ x, y });
      }
    }
    for (const ep of endpoints) {
      for (const d of dirs) {
        let nx = ep.x, ny = ep.y;
        let steps = 0;
        const maxSteps = forceAll ? 6 : 4;
        let path = [];
        while (steps < maxSteps) {
          nx += d[0];
          ny += d[1];
          if (!inMap(nx, ny)) break;
          const nk = k(nx, ny);
          if (roadCellSet.has(nk)) {
            if (!(nx === ep.x && ny === ep.y)) {
              if (path.length > 0) {
                const newRoad = {
                  id: 'road_' + (++paintIdCounter),
                  grade: 'street',
                  cells: path,
                  name: generateRoadName('street')
                };
                gameState.roads.push(newRoad);
                for (const c of path) {
                  const ck = k(c.x, c.y);
                  if (!placedRoads.has(ck)) {
                    placedRoads.add(ck);
                    gameState.buildings.push({ x: c.x, y: c.y, type: 'road', layer: 'ground', age: 0 });
                  }
                  roadCellSet.add(ck);
                }
              }
            }
            break;
          }
          const status = classifyRoadCell(nx, ny, true);
          if (status === 'invalid') break;
          path.push({ x: nx, y: ny });
          steps++;
        }
      }
    }
  }

  connectDeadEnds(false);

  // === 内部街道网格化 ===
  function generateInternalStreets() {
    const streetGrade = 'street';
    const targetZones = gameState.zones.filter(z =>
      z.type === 'residential' || z.type === 'commercial' || z.type === 'industrial'
    );
    for (const zone of targetZones) {
      if (zone.cells.length < 4) continue;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const c of zone.cells) {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.y > maxY) maxY = c.y;
      }
      const spacing = 3;
      for (let y = minY + spacing; y <= maxY - spacing; y += spacing) {
        let startX = null, endX = null;
        for (let x = minX; x <= maxX; x++) {
          const inZone = zone.cells.some(c => c.x === x && c.y === y);
          if (!inZone) {
            if (startX !== null) { tryCommitSegment(startX, endX, y, 'horizontal'); startX = null; endX = null; }
            continue;
          }
          const status = classifyRoadCell(x, y, true);
          if (status === 'invalid') {
            if (startX !== null) { tryCommitSegment(startX, endX, y, 'horizontal'); startX = null; endX = null; }
            continue;
          }
          if (startX === null) startX = x;
          endX = x;
        }
        if (startX !== null) tryCommitSegment(startX, endX, y, 'horizontal');
      }
      for (let x = minX + spacing; x <= maxX - spacing; x += spacing) {
        let startY = null, endY = null;
        for (let y = minY; y <= maxY; y++) {
          const inZone = zone.cells.some(c => c.x === x && c.y === y);
          if (!inZone) {
            if (startY !== null) { tryCommitSegment(x, startY, endY, 'vertical'); startY = null; endY = null; }
            continue;
          }
          const status = classifyRoadCell(x, y, true);
          if (status === 'invalid') {
            if (startY !== null) { tryCommitSegment(x, startY, endY, 'vertical'); startY = null; endY = null; }
            continue;
          }
          if (startY === null) startY = y;
          endY = y;
        }
        if (startY !== null) tryCommitSegment(x, startY, endY, 'vertical');
      }

      function tryCommitSegment(a, b, fixed, orientation) {
        const cells = [];
        if (orientation === 'horizontal') {
          for (let tx = a; tx <= b; tx++) {
            const tkey = k(tx, fixed);
            if (occupied.has(tkey)) { cells.length = 0; break; }
            cells.push({ x: tx, y: fixed });
          }
        } else {
          for (let ty = a; ty <= b; ty++) {
            const tkey = k(fixed, ty);
            if (occupied.has(tkey)) { cells.length = 0; break; }
            cells.push({ x: fixed, y: ty });
          }
        }
        if (cells.length >= 2) {
          let connected = false;
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
          for (const c of cells) {
            for (const d of dirs) {
              const nx = c.x + d[0], ny = c.y + d[1];
              if (placedRoads.has(k(nx, ny))) { connected = true; break; }
            }
            if (connected) break;
          }
          if (connected) {
            commitRoad(cells, streetGrade);
          }
        }
      }
    }
  }

  generateInternalStreets();
  connectDeadEnds(true);

  // === 合并同一直线相邻道路 ===
  function mergeCollinearRoads() {
    let merged = true;
    while (merged) {
      merged = false;
      const hGroups = new Map();
      for (const road of gameState.roads) {
        if (road.cells.length < 2) continue;
        const allSameY = road.cells.every(c => c.y === road.cells[0].y);
        if (allSameY) {
          const y = road.cells[0].y;
          if (!hGroups.has(y)) hGroups.set(y, []);
          hGroups.get(y).push(road);
        }
      }
      for (const [y, roads] of hGroups) {
        roads.sort((a, b) => a.cells[0].x - b.cells[0].x);
        for (let i = 0; i < roads.length - 1; i++) {
          const a = roads[i];
          const b = roads[i+1];
          const aEnd = a.cells[a.cells.length-1].x;
          const bStart = b.cells[0].x;
          const gap = bStart - aEnd - 1;
          if (gap <= 3) {
            let canConnect = true;
            for (let x = aEnd + 1; x < bStart; x++) {
              const key = k(x, y);
              if (occupied.has(key)) { canConnect = false; break; }
              if (!buildableKey.has(key) && !placedRoads.has(key)) { canConnect = false; break; }
            }
            if (canConnect) {
              const newCells = [];
              for (const c of a.cells) newCells.push({ x: c.x, y: c.y });
              for (let x = aEnd + 1; x < bStart; x++) newCells.push({ x, y });
              for (const c of b.cells) newCells.push({ x: c.x, y: c.y });
              const newRoad = {
                id: 'road_' + (++paintIdCounter),
                grade: a.grade,
                cells: newCells,
                name: generateRoadName(a.grade)
              };
              const remove = [a, b];
              gameState.roads = gameState.roads.filter(r => !remove.includes(r));
              gameState.roads.push(newRoad);
              for (const c of newCells) {
                const kk = k(c.x, c.y);
                if (!placedRoads.has(kk)) {
                  placedRoads.add(kk);
                  gameState.buildings.push({ x: c.x, y: c.y, type: 'road', layer: 'ground', age: 0 });
                }
              }
              merged = true;
              break;
            }
          }
        }
        if (merged) break;
      }
      if (merged) continue;

      const vGroups = new Map();
      for (const road of gameState.roads) {
        if (road.cells.length < 2) continue;
        const allSameX = road.cells.every(c => c.x === road.cells[0].x);
        if (allSameX) {
          const x = road.cells[0].x;
          if (!vGroups.has(x)) vGroups.set(x, []);
          vGroups.get(x).push(road);
        }
      }
      for (const [x, roads] of vGroups) {
        roads.sort((a, b) => a.cells[0].y - b.cells[0].y);
        for (let i = 0; i < roads.length - 1; i++) {
          const a = roads[i];
          const b = roads[i+1];
          const aEnd = a.cells[a.cells.length-1].y;
          const bStart = b.cells[0].y;
          const gap = bStart - aEnd - 1;
          if (gap <= 3) {
            let canConnect = true;
            for (let y = aEnd + 1; y < bStart; y++) {
              const key = k(x, y);
              if (occupied.has(key)) { canConnect = false; break; }
              if (!buildableKey.has(key) && !placedRoads.has(key)) { canConnect = false; break; }
            }
            if (canConnect) {
              const newCells = [];
              for (const c of a.cells) newCells.push({ x: c.x, y: c.y });
              for (let y = aEnd + 1; y < bStart; y++) newCells.push({ x, y });
              for (const c of b.cells) newCells.push({ x: c.x, y: c.y });
              const newRoad = {
                id: 'road_' + (++paintIdCounter),
                grade: a.grade,
                cells: newCells,
                name: generateRoadName(a.grade)
              };
              const remove = [a, b];
              gameState.roads = gameState.roads.filter(r => !remove.includes(r));
              gameState.roads.push(newRoad);
              for (const c of newCells) {
                const kk = k(c.x, c.y);
                if (!placedRoads.has(kk)) {
                  placedRoads.add(kk);
                  gameState.buildings.push({ x: c.x, y: c.y, type: 'road', layer: 'ground', age: 0 });
                }
              }
              merged = true;
              break;
            }
          }
        }
        if (merged) break;
      }
    }
  }

  mergeCollinearRoads();

  // ========== 强力连接相邻但不同道路的单元格（防止环路） ==========
  function forceConnectAdjacentRoads() {
    const cellToRoadIds = new Map();
    for (const road of gameState.roads) {
      const id = road.id;
      for (const c of road.cells) {
        const key = k(c.x, c.y);
        if (!cellToRoadIds.has(key)) cellToRoadIds.set(key, new Set());
        cellToRoadIds.get(key).add(id);
      }
    }
    const roadCellSet = new Set(cellToRoadIds.keys());
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    const addedPairs = new Set();
    const newRoads = [];
    for (const [key, roadIds] of cellToRoadIds) {
      if (roadIds.size === 0) continue;
      const [x, y] = key.split(',').map(Number);
      for (const d of dirs) {
        const nx = x + d[0], ny = y + d[1];
        if (!inMap(nx, ny)) continue;
        const nkey = k(nx, ny);
        const nRoadIds = cellToRoadIds.get(nkey);
        if (!nRoadIds) continue;
        let shared = false;
        for (const id of roadIds) {
          if (nRoadIds.has(id)) { shared = true; break; }
        }
        if (shared) continue;
        const pairKey = [key, nkey].sort().join('|');
        if (addedPairs.has(pairKey)) continue;

        // 环路检测：如果添加这条边会形成 2x2 闭合环，则跳过
        let willFormLoop = false;
        if (d[0] === 0) { // 垂直连接 (x,y)-(x,y+1)
          const left1 = k(x-1, y), left2 = k(x-1, ny);
          if (roadCellSet.has(left1) && roadCellSet.has(left2)) willFormLoop = true;
          const right1 = k(x+1, y), right2 = k(x+1, ny);
          if (roadCellSet.has(right1) && roadCellSet.has(right2)) willFormLoop = true;
        } else { // 水平连接 (x,y)-(x+1,y)
          const up1 = k(x, y-1), up2 = k(nx, y-1);
          if (roadCellSet.has(up1) && roadCellSet.has(up2)) willFormLoop = true;
          const down1 = k(x, y+1), down2 = k(nx, y+1);
          if (roadCellSet.has(down1) && roadCellSet.has(down2)) willFormLoop = true;
        }
        if (willFormLoop) continue;

        addedPairs.add(pairKey);
        const newRoad = {
          id: 'road_' + (++paintIdCounter),
          grade: 'street',
          cells: [{ x, y }, { x: nx, y: ny }],
          name: generateRoadName('street')
        };
        newRoads.push(newRoad);
      }
    }
    for (const road of newRoads) {
      gameState.roads.push(road);
      for (const c of road.cells) {
        const ck = k(c.x, c.y);
        if (!placedRoads.has(ck)) {
          placedRoads.add(ck);
          gameState.buildings.push({ x: c.x, y: c.y, type: 'road', layer: 'ground', age: 0 });
        }
      }
    }
  }

  forceConnectAdjacentRoads();
  connectDeadEnds(true);

  // v2.3.1e: 剔除过短的街道及以上道路（少于3格的街道/大道/高速）
  // 小路（path）不受此限制，因为农田连接路可能很短
  (function removeShortRoads() {
    const keepRoads = [];
    const removedCells = new Set();
    for (const road of gameState.roads) {
      const isStreetPlus = road.grade === 'street' || road.grade === 'avenue' || road.grade === 'highway';
      if (isStreetPlus && road.cells.length < 3) {
        // 标记要删除的道路格子（仅当该格不被其他道路共享时才从 placedRoads 移除）
        for (const c of road.cells) removedCells.add(k(c.x, c.y));
      } else {
        keepRoads.push(road);
      }
    }
    // 从 placedRoads 中移除被删道路的格子（仅当没有其他保留道路使用该格时）
    if (removedCells.size > 0) {
      const stillUsedCells = new Set();
      for (const road of keepRoads) {
        for (const c of road.cells) stillUsedCells.add(k(c.x, c.y));
      }
      for (const ck of removedCells) {
        if (!stillUsedCells.has(ck)) placedRoads.delete(ck);
      }
      gameState.roads = keepRoads;
    }
  })();

  // ========== v2.3.1e: 城市分区只能沿街道及以上道路分布，不能沿小路分布 ==========
  function hasStreetNearbyFn(x, y, radius) {
    for (const road of gameState.roads) {
      if (road.grade !== 'street' && road.grade !== 'avenue' && road.grade !== 'highway') continue;
      for (const c of road.cells) {
        const dx = Math.abs(c.x - x), dy = Math.abs(c.y - y);
        if (dx <= radius && dy <= radius) return true;
      }
    }
    return false;
  }

  // ========== 分区生成 ==========
  const resSubTypes = lvId <= 0
    ? ['low', 'low', 'mid']
    : lvId === 1
      ? ['low', 'mid', 'mid', 'high']
      : lvId === 2
        ? ['mid', 'high', 'high']
        : ['mid', 'high', 'high', 'high'];

  const targetPop = level.initPop;
  // v2.3.1e: 按 GB 50137-2011 标准重新分配区域占比
  // 住宅 30%, 商业 10%, 工业 22%, 公园 12%
  const totalZoneArea = Math.min(300 + lvId * 120, 800);
  const maxResZones = Math.min(16 + lvId * 7, 48);
  const comZoneCount = Math.min(2 + lvId, 6);
  const indZoneCount = Math.min(6 + lvId * 4, 18);

  let resPlaced = 0, comPlaced = 0, indPlaced = 0;
  let housingCapacity = 0, totalPowerCons = 0, totalWaterCons = 0;
  // v2.2.1b: 追踪就业容量，保证满足±5%就业需求
  let jobCapacity = 0;

  function pickKindCell(kindList, preferX, preferY) {
    if (!kindList || kindList.length === 0) return null;
    let best = null, bestScore = 1e9;
    const shuffled = shuffle(kindList.slice());
    for (let i = 0; i < Math.min(60, shuffled.length); i++) {
      const c = shuffled[i];
      const d = Math.abs(c.x - preferX) + Math.abs(c.y - preferY);
      if (d < bestScore && !occupied.has(k(c.x, c.y))) {
        bestScore = d;
        best = c;
      }
    }
    return best || shuffled[0];
  }

  function growCluster(seed, targetCount, maxRadius, minRadius, filterFn) {
    if (!seed) return [];
    const seedKey = k(seed.x, seed.y);
    if (occupied.has(seedKey) || placedRoads.has(seedKey)) return [];
    const result = [], seen = new Set(), frontier = [{ x: seed.x, y: seed.y }];
    seen.add(seedKey);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    while (frontier.length > 0 && result.length < targetCount) {
      const idx = randInt(0, frontier.length - 1);
      const cur = frontier.splice(idx, 1)[0];
      const ckey = k(cur.x, cur.y);
      if (!occupied.has(ckey) && !placedRoads.has(ckey) && buildableKey.has(ckey)) {
        if (!filterFn || filterFn(cur.x, cur.y)) {
          result.push({ x: cur.x, y: cur.y });
          occupied.add(ckey);
        }
      }
      const ndirs = shuffle(dirs.slice());
      for (const d of ndirs) {
        if (result.length >= targetCount) break;
        const nx = cur.x + d[0], ny = cur.y + d[1];
        if (!inMap(nx, ny)) continue;
        const nk = k(nx, ny);
        if (seen.has(nk) || occupied.has(nk) || placedRoads.has(nk)) continue;
        if (!buildableKey.has(nk)) continue;
        const dist = Math.abs(nx - seed.x) + Math.abs(ny - seed.y);
        if (dist > maxRadius) continue;
        if (dist < minRadius && Math.random() < 0.25) continue;
        if (Math.random() < 0.72) {
          frontier.push({ x: nx, y: ny });
          seen.add(nk);
        }
      }
    }
    return result;
  }

  function placeZone(zoneType, subType, cells, zoneName) {
    if (!cells || cells.length < 2) return null;
    const zone = {
      id: 'zone_' + (++paintIdCounter),
      type: zoneType,
      subType: subType,
      cells: cells,
      name: zoneName,
      shops: []
    };
    generateZoneBuildings(zone);
    gameState.zones.push(zone);
    // v2.2.1c: 将所有区域格子标记为已占用，防止后续区域重叠
    for (const c of cells) {
      occupied.add(k(c.x, c.y));
    }
    return zone;
  }

  // v2.2.1: 先生成农业区域（农田+农村民居），再生成城市建筑，保证初始地图满足耕地红线
  generateAgriAreas(_targetFarmland);

  // v2.2.1c: 农村民居也提供住宅容量，需计入 housingCapacity
  // 否则住宅区会过度放置，后置调整会移除全部中密度住宅（破坏比例）
  for (const b of gameState.buildings) {
    if (b.type === 'ruralHouse') {
      const def = BUILDING_TYPES.ruralHouse;
      if (def?.eff?.pop) housingCapacity += def.eff.pop;
    }
  }

  // v2.5.0d: 铁路/高铁生成移至农田之后、城市分区之前
  // 农田可压在铁路线下方（农田先生成），其他区域会跳过铁路格（铁路格已标记 occupied）
  // v2.5.0d: _railLines 声明移至调用前，避免 TDZ 错误
  let _railLines = []; // 已生成线路 { horizontal, fixed }，避免铁路与高铁完全重合
  // 省会(lvId>=3)：必有铁路+高铁；地级市(lvId==2)：必有铁路，70%概率高铁；
  // 县城(lvId==1)：必有铁路，15%概率高铁；乡镇(lvId==0)：40%概率铁路，3%概率高铁
  (function genRailTransits() {
    let genRailway = false, genHSR = false;
    if (lvId >= 3) { genRailway = true; genHSR = true; }
    else if (lvId === 2) { genRailway = true; genHSR = Math.random() < 0.70; }
    else if (lvId === 1) { genRailway = true; genHSR = Math.random() < 0.15; }
    else { genRailway = Math.random() < 0.40; genHSR = Math.random() < 0.03; }
    if (genRailway) buildRailTransit(false);
    if (genHSR) buildRailTransit(true);
  })();

  // Residential
  const targetHousingCap = targetPop * 1.05;  // v2.2.1b: 住宅上限±5%
  // v2.2.2c: 住宅密度比例按城市等级调整
  // 乡镇(lvId=0): 低5:中3（低密度最多，无高密度）
  // 县城+(lvId>=1): 低3:中5:高2（高密度最少）
  const resSubTypesAvail = lvId >= 1 ? ['mid', 'low', 'high'] : ['low', 'mid'];
  const resRatioTargets = resSubTypesAvail.includes('high')
    ? { low: 3, mid: 5, high: 2 }
    : { low: 5, mid: 3 };
  // v2.2.1c: 基于已放置建筑数量，选择最不足比例的密度类型
  // 扫描 gameState.buildings 统计各密度实际建筑数，选比值最低的类型
  function pickResSubType() {
    const counts = { low: 0, mid: 0, high: 0 };
    for (const b of gameState.buildings) {
      if (b.type === 'lowRes') counts.low++;
      else if (b.type === 'midRes') counts.mid++;
      else if (b.type === 'highRes') counts.high++;
    }
    let bestType = resSubTypesAvail[0];
    let bestRatio = Infinity;
    for (const t of resSubTypesAvail) {
      const ratio = counts[t] / resRatioTargets[t];
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestType = t;
      }
    }
    return bestType;
  }
  const resCandidates = shuffle((cityCellsByKind.residential.length ? cityCellsByKind.residential : cityList).slice());
  for (const c of resCandidates) {
    if (housingCapacity >= targetHousingCap || resPlaced >= maxResZones) break;
    const kk = k(c.x, c.y);
    if (occupied.has(kk) || placedRoads.has(kk)) continue;
    if (!hasStreetNearbyFn(c.x, c.y, 2)) continue; // v2.3.1e: 城市分区只沿街道及以上道路分布
    // v2.2.1c: 按比例 5:3:2 选择密度，高密度最少
    const subType = pickResSubType();
    const targetCells = subType === 'low' ? 16 : subType === 'mid' ? 12 : 10;
    const zoneCells = growCluster(c, targetCells, 6 + lvId * 2, 0,
      (x, y) => !occupied.has(k(x, y)) && !placedRoads.has(k(x, y)));
    if (zoneCells.length < 2) continue;
    // v2.2.1c: 先计算住宅缺口，限制单次区域生成的建筑数
    const buildingType = ZONE_TYPES.residential.subTypes[subType].buildingType;
    const def = BUILDING_TYPES[buildingType];
    const housingGap = targetHousingCap - housingCapacity;
    const maxByGap = def ? Math.max(1, Math.ceil(housingGap / Math.max(1, def.eff.pop || 1))) : 99;
    const lenBefore = gameState.buildings.length;
    const zone = placeZone('residential', subType, zoneCells, '住宅区');
    if (!zone) continue;
    // v2.2.1c: 统计实际生成建筑数，移除超出缺口的多余建筑
    let actualPlaced = gameState.buildings.length - lenBefore;
    if (actualPlaced > maxByGap) {
      const excess = actualPlaced - maxByGap;
      let removed = 0;
      for (let i = gameState.buildings.length - 1; i >= 0 && removed < excess; i--) {
        if (gameState.buildings[i].type === buildingType) {
          gameState.buildings.splice(i, 1);
          removed++;
        }
      }
      actualPlaced = maxByGap;
    }
    if (def) {
      housingCapacity += (def.eff.pop || 0) * actualPlaced;
      totalPowerCons += Math.abs(def.eff.power || 0) * actualPlaced;
      totalWaterCons += Math.abs(def.eff.water || 0) * actualPlaced;
    }
    resPlaced++;
  }
  // v2.2.1b: 补充住宅（仅在不足95%时触发，上限105%）
  while (housingCapacity < targetPop * 0.95 && resPlaced < maxResZones + 10) {
    let placed = false;
    const shuffled = shuffle((cityCellsByKind.residential.length ? cityCellsByKind.residential : cityList).slice());
    for (const c of shuffled) {
      if (housingCapacity >= targetPop * 0.95) break;
      const kk = k(c.x, c.y);
      if (occupied.has(kk) || placedRoads.has(kk)) continue;
      if (!hasStreetNearbyFn(c.x, c.y, 2)) continue; // v2.3.1e: 城市分区只沿街道及以上道路分布
      const zoneCells = growCluster(c, 14, 8 + lvId * 2, 0,
        (x, y) => !occupied.has(k(x, y)) && !placedRoads.has(k(x, y)));
      if (zoneCells.length < 2) continue;
      // v2.2.1c: 补充也按比例选择，优先中密度
      const fillSub = pickResSubType();
      const fillBuildingType = ZONE_TYPES.residential.subTypes[fillSub].buildingType;
      const fillDef = BUILDING_TYPES[fillBuildingType];
      const fillGap = targetPop * 0.95 - housingCapacity;
      const fillMaxByGap = fillDef ? Math.max(1, Math.ceil(fillGap / Math.max(1, fillDef.eff.pop || 1))) : 99;
      const fillLenBefore = gameState.buildings.length;
      const zone = placeZone('residential', fillSub, zoneCells, '住宅区');
      if (!zone) continue;
      let fillActualPlaced = gameState.buildings.length - fillLenBefore;
      if (fillActualPlaced > fillMaxByGap) {
        const fillExcess = fillActualPlaced - fillMaxByGap;
        let fillRemoved = 0;
        for (let i = gameState.buildings.length - 1; i >= 0 && fillRemoved < fillExcess; i--) {
          if (gameState.buildings[i].type === fillBuildingType) {
            gameState.buildings.splice(i, 1);
            fillRemoved++;
          }
        }
        fillActualPlaced = fillMaxByGap;
      }
      if (fillDef) {
        housingCapacity += (fillDef.eff.pop || 0) * fillActualPlaced;
        totalPowerCons += Math.abs(fillDef.eff.power || 0) * fillActualPlaced;
        totalWaterCons += Math.abs(fillDef.eff.water || 0) * fillActualPlaced;
      }
      resPlaced++;
      placed = true;
      break;
    }
    if (!placed) break;
  }

  // Commercial
  // v2.3.1e: 调整就业目标为人口的50%（含工业+商业岗位），符合职住比0.5标准
  const targetJobsCap = targetPop * 0.5 * 1.05;
  // v2.3.1e: 商业类型比例——沿街商业最多，广场次之，综合体最少
  const comStreetCount = Math.max(1, Math.floor(comZoneCount * 0.6));
  const comPlazaCount = Math.max(1, Math.floor(comZoneCount * 0.3));
  const comComplexCount = Math.max(0, Math.floor(comZoneCount * 0.1));
  const comCandidates = shuffle((cityCellsByKind.cbd.length ? cityCellsByKind.cbd : cityList).slice());
  const comPhases = [
    { sub: 'street', target: comStreetCount },
    { sub: 'plaza', target: comPlazaCount },
    { sub: 'complex', target: comComplexCount },
  ];
  for (const phase of comPhases) {
    let phasePlaced = 0;
    for (const c of comCandidates) {
      if (phasePlaced >= phase.target || comPlaced >= comZoneCount || jobCapacity >= targetJobsCap) break;
      const kk = k(c.x, c.y);
      if (occupied.has(kk) || placedRoads.has(kk)) continue;
      if (!hasStreetNearbyFn(c.x, c.y, 2)) continue; // v2.3.1e: 城市分区只沿街道及以上道路分布
      // v2.3.1e: 缩小商业集群，控制商业占比
      const zoneCells = growCluster(c, 3 + randInt(0, 3), 5 + lvId * 2, 0,
        (x, y) => !occupied.has(k(x, y)) && !placedRoads.has(k(x, y)));
      if (zoneCells.length < 2) continue;
      const comSub = phase.sub;
      const zone = placeZone('commercial', comSub, zoneCells, '商业区');
      if (!zone) continue;
      // v2.2.1b: 追踪商业就业容量
      const comBuildingType = ZONE_TYPES.commercial.subTypes[comSub].buildingType;
      const comDef = BUILDING_TYPES[comBuildingType];
      if (comDef) {
        const comPlacedCount = Math.max(1, Math.floor(zoneCells.length / 2));
        jobCapacity += (comDef.eff.jobs || 0) * comPlacedCount;
      }
      for (const b of zone.cells) {
        totalPowerCons += 15;
        totalWaterCons += 8;
      }
      comPlaced++;
      phasePlaced++;
    }
  }

  // Industrial
  const outerBuildable = buildable.filter(c => {
    const d = Math.abs(c.x - cx) + Math.abs(c.y - cy);
    return d > Math.max(10, Math.floor((maxX - minX + maxY - minY) / 4));
  });
  const indCandidates = shuffle((cityCellsByKind.industrial.length ? cityCellsByKind.industrial : outerBuildable).slice());
  for (const c of indCandidates) {
    if (indPlaced >= indZoneCount || jobCapacity >= targetJobsCap) break;
    const kk = k(c.x, c.y);
    if (occupied.has(kk) || placedRoads.has(kk)) continue;
    if (!hasStreetNearbyFn(c.x, c.y, 2)) continue; // v2.3.1e: 城市分区只沿街道及以上道路分布
    const zoneCells = growCluster(c, 7 + randInt(0, 4), 8 + lvId * 2, 0,
      (x, y) => {
        const nk = k(x, y);
        if (occupied.has(nk) || placedRoads.has(nk)) return false;
        const idx = y * MAP_W + x;
        const cell = mapCells[idx];
        if (!cell || cell.isWater) return false;
        return true;
      });
    if (zoneCells.length < 2) continue;
    // v2.3.1e: 根据风向分配工业等级 — 下风向放重工业，上风向只放轻工业
    const _zoneCx = zoneCells.reduce((s, c) => s + c.x, 0) / zoneCells.length;
    const _zoneCy = zoneCells.reduce((s, c) => s + c.y, 0) / zoneCells.length;
    const _downwindDot = (_zoneCx - cx) * dwDx + (_zoneCy - cy) * dwDy;
    let indSub;
    if (lvId <= 1) {
      indSub = 'light';
    } else if (_downwindDot > 2 && Math.random() < 0.65) {
      indSub = 'heavy';
    } else if (_downwindDot < -2) {
      indSub = 'light';
    } else {
      indSub = Math.random() < 0.5 ? 'light' : 'heavy';
    }
    const zone = placeZone('industrial', indSub, zoneCells, '工业区');
    if (!zone) continue;
    // v2.2.1b: 追踪工业就业容量
    const indBuildingType = ZONE_TYPES.industrial.subTypes[indSub].buildingType;
    const indDef = BUILDING_TYPES[indBuildingType];
    if (indDef) {
      const indPlacedCount = Math.max(1, Math.floor(zoneCells.length / 2));
      jobCapacity += (indDef.eff.jobs || 0) * indPlacedCount;
    }
    totalPowerCons += 40;
    totalWaterCons += 25;
    indPlaced++;
  }

  // ===== v2.4.7: 铁路/高铁线路生成 — 横穿地图的交通干线 =====
  // 根据城市等级决定是否生成铁路(railway)和高铁(hsr)线路
  // v2.5.0d: _railLines 和 genRailTransits 已移至农田生成后调用（见上方）
  function buildRailTransit(isHSR) {
    const railType = isHSR ? 'hsr' : 'railway';
    const tt = TRANSIT_TYPES[railType];
    if (!tt) return;
    // v2.5.0b: 铁路线在直线基础上以火车站为原点向左或向右旋转135°
    // 走向：0=水平直线, 1=垂直直线, 2=水平+向右旋转135°, 3=水平+向左旋转135°
    //       4=垂直+向右旋转135°, 5=垂直+向左旋转135°
    const direction = Math.floor(Math.random() * 6);
    // 高铁尽可能远离城区
    const offsetRange = isHSR ? [15, 25] : [5, 15];
    let offset = randInt(offsetRange[0], offsetRange[1]) * (Math.random() < 0.5 ? 1 : -1);

    // 避免与已有同走向线路重合
    let tries = 0;
    let _dirKey = ['H','V','HR','HL','VR','VL'][direction];
    while (tries < 20 && _railLines.some(l => l.dirKey === _dirKey && Math.abs(l.fixed - offset) < 5)) {
      offset = randInt(offsetRange[0], offsetRange[1]) * (Math.random() < 0.5 ? 1 : -1);
      tries++;
    }

    const railCells = [];
    if (direction === 0) {
      // 水平直线 — 贯穿整张地图
      const fixed = clamp(cy + offset, 1, MAP_H - 2);
      for (let x = 0; x < MAP_W; x++) {
        const cell = mapCells[fixed * MAP_W + x];
        if (!cell || cell.elevation > 500) continue;
        railCells.push({ x, y: fixed });
      }
    } else if (direction === 1) {
      // 垂直直线 — 贯穿整张地图
      const fixed = clamp(cx + offset, 1, MAP_W - 2);
      for (let y = 0; y < MAP_H; y++) {
        const cell = mapCells[y * MAP_W + fixed];
        if (!cell || cell.elevation > 500) continue;
        railCells.push({ x: fixed, y });
      }
    } else if (direction === 2 || direction === 3) {
      // v2.5.0b: 水平直线 + 以火车站为原点旋转135°
      // 火车站位置作为旋转原点（pivotX, fixedY）
      const fixedY = clamp(cy + offset, 1, MAP_H - 2);
      const pivotX = clamp(cx + randInt(-10, 10), 2, MAP_W - 3);
      // 第一段：水平从 x=0 到 pivotX（火车站左侧）
      for (let x = 0; x <= pivotX; x++) {
        const cell = mapCells[fixedY * MAP_W + x];
        if (!cell || cell.elevation > 500) continue;
        railCells.push({ x, y: fixedY });
      }
      // 第二段：从火车站向右旋转135°
      // 向右旋转135°：dx=+1, dy=+1（右下方向，与水平线夹角为135°的补角45°向下）
      // 向左旋转135°：dx=+1, dy=-1（右上方向）
      const turnDy = (direction === 2) ? 1 : -1; // 2=向右(下), 3=向左(上)
      let tx = pivotX + 1, ty = fixedY + turnDy;
      while (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
        const cell = mapCells[ty * MAP_W + tx];
        if (cell && cell.elevation <= 500) railCells.push({ x: tx, y: ty });
        tx += 1; ty += turnDy; // 45°斜向延伸
      }
    } else {
      // v2.5.0b: 垂直直线 + 以火车站为原点旋转135°
      const fixedX = clamp(cx + offset, 1, MAP_W - 2);
      const pivotY = clamp(cy + randInt(-10, 10), 2, MAP_H - 3);
      // 第一段：垂直从 y=0 到 pivotY（火车站上方）
      for (let y = 0; y <= pivotY; y++) {
        const cell = mapCells[y * MAP_W + fixedX];
        if (!cell || cell.elevation > 500) continue;
        railCells.push({ x: fixedX, y });
      }
      // 第二段：从火车站向下旋转135°
      // 向右旋转135°：dx=+1, dy=+1（右下方向）
      // 向左旋转135°：dx=-1, dy=+1（左下方向）
      const turnDx = (direction === 4) ? 1 : -1; // 4=向右, 5=向左
      let tx = fixedX + turnDx, ty = pivotY + 1;
      while (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
        const cell = mapCells[ty * MAP_W + tx];
        if (cell && cell.elevation <= 500) railCells.push({ x: tx, y: ty });
        tx += turnDx; ty += 1; // 45°斜向延伸
      }
    }
    if (railCells.length <= 5) return;
    _railLines.push({ dirKey: _dirKey, horizontal: direction <= 3, fixed: offset });
    const baseName = gameState.cityName.replace(/[镇县城市区]+$/, '');
    const railName = isHSR ? `${baseName}高铁线` : `${baseName}铁路`;
    gameState.transits.push({
      id: 'transit_' + (++paintIdCounter), type: railType, cells: railCells,
      name: railName, color: tt.color,
    });
    for (const c of railCells) {
      const kk = k(c.x, c.y);
      // v2.5.0d: 铁路建筑始终放置（即使下方有农田，农田可压在铁路下方）
      // 此处仅有农田和道路已生成，其他区域尚未生成，不会覆盖铁路格
      gameState.buildings.push({ x: c.x, y: c.y, type: tt.buildingType, layer: tt.layer, age: 0 });
      occupied.add(kk);
    }
  }

  // v2.5.0d: 铁路/高铁生成移至农田之后、城市分区之前
  // 这样铁路线所在地块只被农田覆盖（农田先生成），其他区域会跳过铁路格

  // Social facilities
  const estPop = level.initPop;
  const infraConfig = [
    { type: 'govBuilding', count: 1 },
    { type: 'elementarySchool', count: Math.min(10, Math.max(1, Math.ceil(estPop / 8000))) },
    { type: 'middleSchool', count: Math.min(8, Math.max(1, Math.ceil(estPop / 15000))) },
    { type: 'highSchool', count: Math.min(5, Math.max(1, Math.ceil(estPop / 30000))) },
    { type: 'hospital', count: Math.min(12, Math.max(1, Math.ceil(estPop / 8000))) },
    { type: 'police', count: Math.min(10, Math.max(1, Math.ceil(estPop / 10000))) },
    { type: 'fireStation', count: Math.min(10, Math.max(1, Math.ceil(estPop / 10000))) }
  ];
  const infraCandidates = shuffle((cityCellsByKind.cbd.length ? cityCellsByKind.cbd : cityList).slice());
  for (const infra of infraConfig) {
    let placed = 0;
    for (const c of infraCandidates) {
      if (placed >= infra.count) break;
      const kk = k(c.x, c.y);
      if (occupied.has(kk) || placedRoads.has(kk)) continue;
      if (!hasRoadNearby(c.x, c.y, 2)) continue;
      gameState.buildings.push({ x: c.x, y: c.y, type: infra.type, layer: 'ground', age: 0 });
      occupied.add(kk);
      placed++;
    }
  }

  // ===== v2.4.7: 初始交通枢纽建筑 — 机场/火车站/高铁站/港口 =====
  // 在铁路/高铁线路上靠近市中心处放置车站（车站与轨道建筑共存）
  function findTransitCellNearCenter(transitType) {
    const transit = gameState.transits.find(t => t.type === transitType);
    if (!transit || !transit.cells || transit.cells.length === 0) return null;
    const tt = TRANSIT_TYPES[transitType];
    if (!tt) return null;
    // 仅选择确实铺设了轨道建筑(railwayLine/hsrLine)的陆地格子
    const lineCellSet = new Set();
    for (const b of gameState.buildings) {
      if (b.type === tt.buildingType) lineCellSet.add(k(b.x, b.y));
    }
    // v2.4.8b: 优先选择附近有道路的轨道格（车站需要道路连接）
    let best = null, bestDist = 1e9;
    let bestWithRoad = null, bestWithRoadDist = 1e9;
    for (const c of transit.cells) {
      if (!lineCellSet.has(k(c.x, c.y))) continue;
      const cell = mapCells[c.y * MAP_W + c.x];
      if (!cell) continue;
      if (cell.isWater || cell.river) continue; // 车站建在陆地上
      // v2.5.0d: 杜绝火车站/高铁站与道路生成在同一地块
      if (placedRoads.has(k(c.x, c.y))) continue;
      const dist = Math.abs(c.x - cx) + Math.abs(c.y - cy);
      const hasRoad = hasRoadNearby(c.x, c.y, 2);
      if (hasRoad && dist < bestWithRoadDist) { bestWithRoadDist = dist; bestWithRoad = c; }
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    // 优先返回有道路连接的格子
    return bestWithRoad || best;
  }

  function placeStation(transitType, isHSR) {
    const stationType = isHSR ? 'hsrStation' : 'railwayStation';
    const def = BUILDING_TYPES[stationType];
    if (!def) return;
    const cell = findTransitCellNearCenter(transitType);
    if (!cell) return;
    // 避免重复放置同类型车站
    if (gameState.buildings.some(b => b.x === cell.x && b.y === cell.y && b.type === stationType)) return;
    const grade = getStationGrade(estPop);
    const baseName = gameState.cityName.replace(/[镇县城市区]+$/, '');
    gameState.buildings.push({
      x: cell.x, y: cell.y, type: stationType, layer: def.layer, age: 0,
      level: 1, facilities: [], branchOf: null, // v2.4.7b: 补全公共建筑字段
      stationGrade: grade.code,
      passengerFlow: Math.floor(grade.capacity * (0.5 + Math.random() * 0.5)),
      customName: baseName + (isHSR ? '高铁站' : '火车站'),
    });
    occupied.add(k(cell.x, cell.y));
    // v2.5.0d: 火车站/高铁站附近空出一定地块（半径2格），清除已有区域和建筑
    const clearRadius = 2;
    for (let dy = -clearRadius; dy <= clearRadius; dy++) {
      for (let dx = -clearRadius; dx <= clearRadius; dx++) {
        if (dx === 0 && dy === 0) continue; // 跳过车站本身
        if (Math.abs(dx) + Math.abs(dy) > clearRadius) continue; // 曼哈顿距离
        const nx = cell.x + dx, ny = cell.y + dy;
        if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
        const nk = k(nx, ny);
        // 跳过铁路线建筑（铁路线必须保留）
        if (gameState.buildings.some(b => b.x === nx && b.y === ny &&
          (b.type === 'railwayLine' || b.type === 'hsrLine'))) continue;
        // 跳过道路（道路保留）
        if (placedRoads.has(nk)) continue;
        // 从区域中移除该格（仅移除该格，不删除整个区域）
        for (const z of gameState.zones) {
          const idx = z.cells.findIndex(c => c.x === nx && c.y === ny);
          if (idx >= 0) z.cells.splice(idx, 1);
        }
        // 移除该格的非铁路/非道路建筑
        gameState.buildings = gameState.buildings.filter(b =>
          !((b.x === nx && b.y === ny) && b.type !== 'railwayLine' && b.type !== 'hsrLine' && b.type !== 'road'));
        // 标记为已占用，防止后续区域/建筑放置
        occupied.add(nk);
      }
    }
    // v2.5.0d: 清理空区域（清除后可能剩余0或1格的区域）
    gameState.zones = gameState.zones.filter(z => z.cells.length >= 2);
  }

  // 机场：仅省会(lvId>=3)放置，4D级国际机场，需跑道长度>=12
  function placeAirport() {
    const def = BUILDING_TYPES.airport;
    if (!def) return false;
    const runwayLength = randInt(12, 13); // 4D级跑道>=12
    for (let attempt = 0; attempt < 100; attempt++) {
      const horizontal = Math.random() < 0.5;
      // v2.4.8b: 机场远离市区生成 — 距离增加到 25-40 格
      const dist = 25 + randInt(0, 15);
      const ang = Math.random() * Math.PI * 2;
      const px = clamp(Math.round(cx + Math.cos(ang) * dist), 2, MAP_W - 3);
      const py = clamp(Math.round(cy + Math.sin(ang) * dist), 2, MAP_H - 3);
      const half = Math.floor(runwayLength / 2);
      const cells = [];
      let valid = true;
      for (let i = -half; i <= runwayLength - half - 1; i++) {
        const rx = horizontal ? clamp(px + i, 0, MAP_W - 1) : px;
        const ry = horizontal ? py : clamp(py + i, 0, MAP_H - 1);
        if (!inMap(rx, ry)) { valid = false; break; }
        const kk = k(rx, ry);
        if (occupied.has(kk) || placedRoads.has(kk)) { valid = false; break; }
        const cell = mapCells[ry * MAP_W + rx];
        if (!cell || cell.isWater || cell.river) { valid = false; break; }
        if (cell.elevation > 500) { valid = false; break; }
        cells.push({ x: rx, y: ry });
      }
      if (valid && cells.length === runwayLength) {
        // v2.4.7c: 机场航站楼放在跑道旁边，不放在跑道上
        const midIdx = Math.floor(cells.length / 2);
        const runwayMid = cells[midIdx];
        // 在跑道垂直方向寻找相邻空地作为航站楼
        let terminalX = runwayMid.x, terminalY = runwayMid.y;
        let terminalFound = false;
        const perpDirs = horizontal ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        for (const [tdx, tdy] of perpDirs) {
          const tx = runwayMid.x + tdx, ty = runwayMid.y + tdy;
          if (!inMap(tx, ty)) continue;
          const tk = k(tx, ty);
          if (occupied.has(tk) || placedRoads.has(tk)) continue;
          const tcell = mapCells[ty * MAP_W + tx];
          if (!tcell || tcell.isWater || tcell.river || tcell.elevation > 500) continue;
          // 检查是否与跑道重叠
          if (cells.some(c => c.x === tx && c.y === ty)) continue;
          terminalX = tx; terminalY = ty; terminalFound = true;
          break;
        }
        if (!terminalFound) continue; // 找不到合适的航站楼位置，重试
        const airportBuilding = {
          x: terminalX, y: terminalY, type: 'airport', layer: 'ground', age: 0,
          level: 1, facilities: [], branchOf: null,
          runways: [{ cells: cells, length: runwayLength, direction: horizontal ? 'horizontal' : 'vertical' }],
          runwayCells: cells, runwayLength: runwayLength,
          airportClass: '4D', isInternational: true,
          passengerFlow: Math.floor(1200 * (0.5 + Math.random() * 0.5)),
          tradeIncome: 25,
          customName: generateAirportName(gameState.cityName, true),
        };
        gameState.buildings.push(airportBuilding);
        for (const c of cells) occupied.add(k(c.x, c.y));
        occupied.add(k(terminalX, terminalY));
        return true;
      }
    }
    return false;
  }

  // 港口：邻水可建，每图最多2个
  function placePorts() {
    // 检查地图是否有水域
    let hasWater = false;
    for (let i = 0; i < mapCells.length; i++) {
      const c = mapCells[i];
      if (c && (c.isWater || c.river)) { hasWater = true; break; }
    }
    if (!hasWater) return;
    const def = BUILDING_TYPES.port;
    if (!def) return;
    const maxPorts = 2;
    const portCount = randInt(1, maxPorts);
    let placed = 0;
    const baseName = gameState.cityName.replace(/[镇县城市区]+$/, '');
    for (const c of shuffle(buildable.slice())) {
      if (placed >= portCount) break;
      const kk = k(c.x, c.y);
      if (occupied.has(kk) || placedRoads.has(kk)) continue;
      if (!hasWaterNearby(c.x, c.y, 3)) continue;
      gameState.buildings.push({
        x: c.x, y: c.y, type: 'port', layer: def.layer, age: 0,
        customName: baseName + '港',
      });
      occupied.add(kk);
      placed++;
    }
  }

  // 按城市等级放置交通枢纽建筑
  if (lvId >= 3) {
    // 省会：机场(4D国际) + 铁路站 + 高铁站
    placeAirport();
    placeStation('railway', false);
    placeStation('hsr', true);
  } else if (lvId === 2) {
    // 地级市：铁路站；若有高铁则放高铁站
    placeStation('railway', false);
    if (gameState.transits.some(t => t.type === 'hsr')) placeStation('hsr', true);
  } else if (lvId === 1) {
    // 县城：若有铁路则放铁路站
    if (gameState.transits.some(t => t.type === 'railway')) placeStation('railway', false);
  } else {
    // 乡镇：若有铁路则放铁路站
    if (gameState.transits.some(t => t.type === 'railway')) placeStation('railway', false);
  }
  // 港口（所有等级，邻水即可，最多2个）
  placePorts();

  // Parks
  // v2.3.1e: 增加公园数量并使用多格集群（符合GB 50137-2011公园占比12%标准）
  const parkCount = Math.min(8 + lvId * 3, 20);
  let parkPlaced = 0;
  const parkCandidates = shuffle(cityList.slice());
  for (const c of parkCandidates) {
    if (parkPlaced >= parkCount) break;
    const kk = k(c.x, c.y);
    if (occupied.has(kk) || placedRoads.has(kk)) continue;
    if (!hasStreetNearbyFn(c.x, c.y, 2)) continue; // v2.3.1e: 城市分区只沿街道及以上道路分布
    // v2.3.1e: 公园使用2-4格集群
    const parkCells = growCluster(c, 2 + randInt(0, 2), 4 + lvId, 0,
      (x, y) => !occupied.has(k(x, y)) && !placedRoads.has(k(x, y)));
    if (parkCells.length < 1) continue;
    const zone = {
      id: 'zone_' + (++paintIdCounter),
      type: 'park',
      subType: 'park',
      cells: parkCells,
      name: '公园绿地',
      shops: []
    };
    generateZoneBuildings(zone);
    gameState.zones.push(zone);
    for (const pc of parkCells) occupied.add(k(pc.x, pc.y));
    parkPlaced++;
  }

  // v2.2.1b: 最终填充——利用道路分割出的空地块，保证住宅和就业需求满足±5%
  // 遍历所有 cityCells，对空地块按需补建住宅/商业/工业建筑
  const targetHousingMin = targetPop * 0.95;
  const targetHousingMax = targetPop * 1.05;
  const targetJobsMin = targetPop * 0.4 * 0.95;  // 就业需求约为人口的40%
  const targetJobsMax = targetPop * 0.4 * 1.05;
  const fillCandidates = shuffle(cityList.slice());
  for (const c of fillCandidates) {
    if (housingCapacity >= targetHousingMin && jobCapacity >= targetJobsMin) break;
    const kk = k(c.x, c.y);
    if (occupied.has(kk) || placedRoads.has(kk)) continue;
    if (!hasStreetNearbyFn(c.x, c.y, 2)) continue; // v2.3.1e: 城市分区只沿街道及以上道路分布
    // 优先补住宅，再补商业/工业
    if (housingCapacity < targetHousingMin) {
      // v2.2.1c: 按比例选择住宅密度，优先中密度
      const fillSub = pickResSubType();
      const fillType = ZONE_TYPES.residential.subTypes[fillSub].buildingType;
      const def = BUILDING_TYPES[fillType];
      if (def) {
        const fillPop = def.eff.pop || 0;
        // 不超过上限
        if (housingCapacity + fillPop > targetHousingMax) continue;
        gameState.buildings.push({ x: c.x, y: c.y, type: fillType, layer: def.layer, age: 0 });
        occupied.add(kk);
        housingCapacity += fillPop;
        totalPowerCons += Math.abs(def.eff.power || 0);
        totalWaterCons += Math.abs(def.eff.water || 0);
      }
    } else if (jobCapacity < targetJobsMin) {
      // v2.2.1c: 沿街商业为主
      const fillType = 'streetCom';
      const def = BUILDING_TYPES[fillType];
      if (def) {
        gameState.buildings.push({ x: c.x, y: c.y, type: fillType, layer: def.layer, age: 0 });
        occupied.add(kk);
        jobCapacity += (def.eff.jobs || 0);
        totalPowerCons += Math.abs(def.eff.power || 0);
        totalWaterCons += Math.abs(def.eff.water || 0);
      }
    }
  }
  // 如果住宅仍不足，放宽道路限制补建（在任意空 cityCell 上建住宅）
  if (housingCapacity < targetHousingMin) {
    for (const c of shuffle(cityList.slice())) {
      if (housingCapacity >= targetHousingMin) break;
      const kk = k(c.x, c.y);
      if (occupied.has(kk) || placedRoads.has(kk)) continue;
      // v2.2.1c: 按比例选择住宅密度
      const fillSub = pickResSubType();
      const fillType = ZONE_TYPES.residential.subTypes[fillSub].buildingType;
      const def = BUILDING_TYPES[fillType];
      if (def) {
        const fillPop = def.eff.pop || 0;
        if (housingCapacity + fillPop > targetHousingMax) continue;
        gameState.buildings.push({ x: c.x, y: c.y, type: fillType, layer: def.layer, age: 0 });
        occupied.add(kk);
        housingCapacity += fillPop;
      }
    }
  }

  // v2.2.1b: 后置调整——统计实际住宅容量，如超出+5%上限则移除多余高密度住宅
  // v2.2.1c: 只统计城市住宅（不含农村民居），避免农村民居住房导致城市住宅被全部移除
  (function adjustHousing() {
    const targetHousingMax = targetPop * 1.05;
    // 只统计城市住宅容量（不含农村民居）
    let actualHousing = 0;
    for (const b of gameState.buildings) {
      const def = BUILDING_TYPES[b.type];
      if (!def || !def.eff) continue;
      if (b.type === 'lowRes' || b.type === 'midRes' || b.type === 'highRes') {
        actualHousing += def.eff.pop || 0;
      }
    }
    // 移除多余住宅（从高密度开始移除，高密度应最少）
    if (actualHousing > targetHousingMax) {
      const densityOrder = ['highRes', 'midRes', 'lowRes'];
      for (const type of densityOrder) {
        if (actualHousing <= targetHousingMax) break;
        const toRemove = gameState.buildings.filter(b => b.type === type);
        for (const b of toRemove) {
          if (actualHousing <= targetHousingMax) break;
          const def = BUILDING_TYPES[b.type];
          actualHousing -= def?.eff?.pop || 0;
          const idx = gameState.buildings.indexOf(b);
          if (idx >= 0) gameState.buildings.splice(idx, 1);
        }
      }
    }
  })();

  gameState.population = Math.round(level.initPop * (0.95 + Math.random() * 0.1));

  // Power
  const powerNeeded = totalPowerCons * 1.3;
  let powerPlaced = 0, powerAttempts = 0;
  const outerArea = buildable.filter(c => Math.abs(c.x - cx) + Math.abs(c.y - cy) > 8);
  while (powerPlaced < powerNeeded && powerAttempts < 30) {
    let plantType;
    const remaining = powerNeeded - powerPlaced;
    if (lvId >= 3 && remaining > 4000) plantType = 'nuclearPlant';
    else if (lvId >= 2 && remaining > 2000) plantType = 'hydroDam';
    else if (lvId >= 1 && remaining > 1000) plantType = 'gasPower';
    else if (remaining > 500) plantType = 'powerPlant';
    else plantType = 'cleanEnergy';
    const def = BUILDING_TYPES[plantType];
    let placed = false;
    for (const c of outerArea) {
      const kk = k(c.x, c.y);
      if (occupied.has(kk) || placedRoads.has(kk)) continue;
      if (!hasRoadNearby(c.x, c.y, 2)) continue;
      gameState.buildings.push({ x: c.x, y: c.y, type: plantType, layer: 'ground', age: 0 });
      occupied.add(kk);
      powerPlaced += def.eff.power;
      placed = true;
      break;
    }
    if (!placed) break;
    powerAttempts++;
  }

  // Water
  const waterNeeded = totalWaterCons * 1.25;
  let waterPlaced = 0, waterAttempts = 0;
  while (waterPlaced < waterNeeded && waterAttempts < 20) {
    let plantType;
    const remaining = waterNeeded - waterPlaced;
    if (lvId >= 2 && remaining > 500) plantType = 'reservoir';
    else if (lvId >= 1 && remaining > 300) plantType = 'desalination';
    else if (remaining > 100) plantType = 'waterPlant';
    else plantType = 'waterTower';
    const def = BUILDING_TYPES[plantType];
    let placed = false;
    for (const c of outerArea) {
      const kk = k(c.x, c.y);
      if (occupied.has(kk) || placedRoads.has(kk)) continue;
      if (!hasRoadNearby(c.x, c.y, 2)) continue;
      gameState.buildings.push({ x: c.x, y: c.y, type: plantType, layer: 'ground', age: 0 });
      occupied.add(kk);
      waterPlaced += def.eff.water;
      placed = true;
      break;
    }
    if (!placed) break;
    waterAttempts++;
  }

  // Waste
  const wasteNeeded = gameState.population * 0.02;
  let wastePlaced = 0, wasteAttempts = 0;
  while (wastePlaced < wasteNeeded && wasteAttempts < 10) {
    const plantType = lvId >= 2 ? 'wasteIncinerator' : 'wastePlant';
    const def = BUILDING_TYPES[plantType];
    let placed = false;
    for (const c of outerArea) {
      const kk = k(c.x, c.y);
      if (occupied.has(kk) || placedRoads.has(kk)) continue;
      if (!hasRoadNearby(c.x, c.y, 2)) continue;
      gameState.buildings.push({ x: c.x, y: c.y, type: plantType, layer: 'ground', age: 0 });
      occupied.add(kk);
      wastePlaced += plantType === 'wasteIncinerator'
        ? (def.eff.wasteCap || 0)
        : Math.abs(def.eff.airPol || 0) * 5;
      placed = true;
      break;
    }
    if (!placed) break;
    wasteAttempts++;
  }

  // ===== v2.2.0 农业区域生成（农田/林地/牧业/鱼塘 + 农村民居 + 道路连接） =====
  // v2.3.1e: 小路只能走对角线或直线（最多一个拐弯），消除锯齿状路径
  function diagonalStraightLine(x0, y0, x1, y1) {
    const cells = [];
    const adx = Math.abs(x1 - x0), ady = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let cx = x0, cy = y0;
    // 先走对角线（min(adx,ady)步）
    const diag = Math.min(adx, ady);
    for (let i = 0; i < diag; i++) {
      cells.push({ x: cx, y: cy });
      cx += sx; cy += sy;
    }
    // 再走直线（剩余步数）
    while (cx !== x1) { cells.push({ x: cx, y: cy }); cx += sx; }
    while (cy !== y1) { cells.push({ x: cx, y: cy }); cy += sy; }
    cells.push({ x: x1, y: y1 });
    return cells;
  }
  function connectAgriToRoad(x, y) {
    let nearestRoad = null, minDist = 1e9;
    for (const r of gameState.roads) {
      for (const c of r.cells) {
        const d = Math.abs(c.x - x) + Math.abs(c.y - y);
        if (d < minDist) { minDist = d; nearestRoad = c; }
      }
    }
    if (!nearestRoad || minDist <= 2) return;
    const path = diagonalStraightLine(x, y, nearestRoad.x, nearestRoad.y);
    // v2.3.1e: 检查路径是否穿越任何已有道路（除终点连接点外不允许重叠）
    let crossesRoad = false;
    for (let i = 1; i < path.length - 1; i++) {
      if (placedRoads.has(k(path[i].x, path[i].y))) {
        crossesRoad = true;
        break;
      }
    }
    if (crossesRoad) return; // 不创建穿越已有道路的小路
    const newRoadCells = [];
    for (const p of path) {
      const kk = k(p.x, p.y);
      if (placedRoads.has(kk)) continue;
      const cell = mapCells[p.y * MAP_W + p.x];
      if (!cell) continue;
      if (cell.elevation > 500) continue; // 跳过高山
      // 水域上建桥（path 等级允许水上）
      placedRoads.add(kk);
      newRoadCells.push({ x: p.x, y: p.y });
    }
    if (newRoadCells.length > 1) {
      gameState.roads.push({
        id: 'agri_rd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        grade: 'path', cells: newRoadCells,
        name: generateRoadName('path'),
      });
    }
  }
  function generateAgriAreas(targetFarmland) {
    // v2.2.1: 接受 targetFarmland 目标格数，保证农田数量满足耕地红线
    targetFarmland = targetFarmland || 30;
    // 1. 筛选农业候选地：远离城市核心、非水域非高山
    //    候选范围与 calcBuildableArea 口径一致（elevation ≤ 500），不限于 city-gen 的 buildable
    const agriCandidates = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const cell = mapCells[y * MAP_W + x];
        if (!cell) continue;
        if (cell.isWater) continue;
        if (cell.elevation > 500) continue;
        const kk = k(x, y);
        if (cityCells.has(kk) || occupied.has(kk) || placedRoads.has(kk)) continue;
        if (cell.elevation > 400) continue; // 山地不放农田
        const distCbd = Math.abs(x - cx) + Math.abs(y - cy);
        // 距 CBD 距离随城市等级放宽，保证高级别城市也能留出足够农田
        const minDist = Math.max(8, 12 - lvId);
        if (distCbd < minDist) continue;
        agriCandidates.push({ x, y, terrain: cell.terrain, elev: cell.elevation });
      }
    }
    if (agriCandidates.length < 10) return;

    // 2. 按地理分区生成农业聚落，循环至达到 targetFarmland 或候选耗尽
    let farmlandPlaced = 0;
    let clusterRounds = 0;
    const maxRounds = 200; // v2.2.1: 大幅提高上限，保证达到红线目标
    let remaining = shuffle(agriCandidates.slice());

    while (farmlandPlaced < targetFarmland && remaining.length > 0 && clusterRounds < maxRounds) {
      clusterRounds++;
      // 取一批候选形成聚落
      const seed = remaining.shift();
      const cluster = { seed, cells: [seed] };
      for (let j = remaining.length - 1; j >= 0; j--) {
        const c = remaining[j];
        // v2.2.1b: 使用欧几里得距离替代曼哈顿距离，避免菱形分布
        const dx = c.x - seed.x, dy = c.y - seed.y;
        if (dx * dx + dy * dy <= 36) {
          cluster.cells.push(c);
          remaining.splice(j, 1);
        }
      }
      if (cluster.cells.length < 1) continue;

      const placedCells = [];
      for (const c of cluster.cells) {
        if (farmlandPlaced >= targetFarmland) break;
        const kk = k(c.x, c.y);
        if (occupied.has(kk) || placedRoads.has(kk)) continue;
        // 按地形选择农业类型；当未达红线目标时全部放 farmland（保证满足红线）
        let type;
        const needMoreFarmland = farmlandPlaced < targetFarmland;
        if (!needMoreFarmland) {
          // 已达目标，按地形分配多样化农业
          if (c.terrain === 'shallow' || c.terrain === 'river') {
            type = Math.random() < 0.5 ? 'farmland' : 'fishpond';
          } else if (c.terrain === 'forest' || c.terrain === 'mountain' || c.terrain === 'hill') {
            type = Math.random() < 0.4 ? 'farmland' : 'forest';
          } else if (c.terrain === 'grass' || c.terrain === 'sand') {
            type = Math.random() < 0.7 ? 'farmland' : 'pasture';
          } else {
            type = 'farmland';
          }
        } else {
          // 未达目标：全部放 farmland
          type = 'farmland';
        }
        const def = BUILDING_TYPES[type];
        if (!def) continue;
        gameState.buildings.push({ x: c.x, y: c.y, type, layer: def.layer, age: 0 });
        occupied.add(kk);
        placedCells.push(c);
        if (type === 'farmland') farmlandPlaced++;
      }
      if (placedCells.length === 0) continue;

      // 在农田附近放 1-3 个农村民居
      // v2.2.2c: 农村民居设数量上限，避免乡镇级地图民居占满住宅容量导致城市住宅区域稀少
      // 上限按城市等级递减：乡镇(lvId=0) 最多8个，依次递减
      const maxRuralHouses = [8, 15, 25, 35, 50][lvId] || 20;
      let totalRuralHouses = gameState.buildings.filter(b => b.type === 'ruralHouse').length;
      const houseCount = clamp(Math.floor(placedCells.length / 6), 1, 3);
      let housesPlaced = 0;
      for (let i = 0; i < placedCells.length && housesPlaced < houseCount && totalRuralHouses < maxRuralHouses; i += 2) {
        const base = placedCells[i];
        outer: for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const hx = base.x + dx, hy = base.y + dy;
            if (!inMap(hx, hy)) continue;
            const hkk = k(hx, hy);
            if (occupied.has(hkk) || placedRoads.has(hkk)) continue;
            const cell = mapCells[hy * MAP_W + hx];
            if (!cell || cell.isWater || cell.elevation > 400) continue;
            const def = BUILDING_TYPES.ruralHouse;
            if (!def) break outer;
            gameState.buildings.push({ x: hx, y: hy, type: 'ruralHouse', layer: def.layer, age: 0 });
            occupied.add(hkk);
            housesPlaced++;
            totalRuralHouses++;
            break outer;
          }
        }
      }

      // 道路连接：从聚落中心到最近道路
      const center = placedCells[Math.floor(placedCells.length / 2)];
      connectAgriToRoad(center.x, center.y);
    }

    // v2.2.1: 最终兜底——若聚类循环结束仍未达红线目标，遍历全图所有空的可建格放 farmland
    // 口径与 calcBuildableArea 一致（elevation ≤ 500），不限制距 CBD 距离，允许占用 cityCells
    // （city 生成器会跳过 occupied 格，因此 farmland 会优先保留）
    if (farmlandPlaced < targetFarmland) {
      for (let y = 0; y < MAP_H && farmlandPlaced < targetFarmland; y++) {
        for (let x = 0; x < MAP_W && farmlandPlaced < targetFarmland; x++) {
          const cell = mapCells[y * MAP_W + x];
          if (!cell || cell.isWater || cell.elevation > 500) continue;
          const kk = k(x, y);
          if (occupied.has(kk) || placedRoads.has(kk)) continue;
          const def = BUILDING_TYPES.farmland;
          if (!def) break;
          gameState.buildings.push({ x, y, type: 'farmland', layer: def.layer, age: 0 });
          occupied.add(kk);
          farmlandPlaced++;
        }
      }
    }
  }
  // generateAgriAreas 已在道路网络完成后、城市建筑生成前调用（v2.2.1）

  // ===== v2.4.3: 矿产资源区生成 — 随机判定资源型城市，在城区周边放置矿区 =====
  // 60%概率为资源型城市；非资源型城市不涉及此次更新内容
  gameState.isResourceCity = Math.random() < 0.60;
  gameState.mineralZones = [];
  if (gameState.isResourceCity) {
    const MINERAL_TYPES = [
      { type: 'coal', name: '煤炭', weight: 30 },
      { type: 'iron', name: '铁矿', weight: 25 },
      { type: 'copper', name: '铜矿', weight: 18 },
      { type: 'limestone', name: '石灰石', weight: 15 },
      { type: 'gold', name: '金矿', weight: 7 },
      { type: 'rare_earth', name: '稀土', weight: 5 },
    ];
    function pickMineralType() {
      const total = MINERAL_TYPES.reduce((s, m) => s + m.weight, 0);
      let r = Math.random() * total;
      for (const m of MINERAL_TYPES) { r -= m.weight; if (r <= 0) return m; }
      return MINERAL_TYPES[0];
    }
    // v2.4.3c: 为一个矿区挑选1-2种矿产
    function pickMineralTypesForZone() {
      const count = Math.random() < 0.35 ? 2 : 1; // 35%概率双矿种
      const types = [pickMineralType()];
      if (count === 2) {
        let second;
        do { second = pickMineralType(); } while (second.type === types[0].type);
        types.push(second);
      }
      return types;
    }
    // v2.4.3b: 不使用 growCluster（它检查 buildableKey，排除了高海拔区域）
    // 改为直接在候选地上放置矿区建筑
    function placeMineCluster(seed, targetCount, maxRadius) {
      const result = [];
      const seen = new Set();
      const frontier = [{ x: seed.x, y: seed.y }];
      seen.add(k(seed.x, seed.y));
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      while (frontier.length > 0 && result.length < targetCount) {
        const idx = randInt(0, frontier.length - 1);
        const cur = frontier.splice(idx, 1)[0];
        const ckey = k(cur.x, cur.y);
        if (!occupied.has(ckey) && !placedRoads.has(ckey) && !cityCells.has(ckey)) {
          const cell = mapCells[cur.y * MAP_W + cur.x];
          if (cell && !cell.isWater && cell.elevation <= 600) {
            result.push({ x: cur.x, y: cur.y });
          }
        }
        const ndirs = shuffle(dirs.slice());
        for (const d of ndirs) {
          if (result.length >= targetCount) break;
          const nx = cur.x + d[0], ny = cur.y + d[1];
          if (!inMap(nx, ny)) continue;
          const nk = k(nx, ny);
          if (seen.has(nk)) continue;
          const dist = Math.abs(nx - seed.x) + Math.abs(ny - seed.y);
          if (dist > maxRadius) continue;
          if (occupied.has(nk) || placedRoads.has(nk) || cityCells.has(nk)) continue;
          const cell = mapCells[ny * MAP_W + nx];
          if (!cell || cell.isWater || cell.elevation > 600) continue;
          if (Math.random() < 0.75) {
            frontier.push({ x: nx, y: ny });
            seen.add(nk);
          }
        }
      }
      return result;
    }
    // 筛选矿区候选地：远离市中心、非水域、非已占用
    const mineCandidates = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const cell = mapCells[y * MAP_W + x];
        if (!cell || cell.isWater) continue;
        if (cell.elevation > 600) continue;
        const kk = k(x, y);
        if (cityCells.has(kk) || occupied.has(kk) || placedRoads.has(kk)) continue;
        const distCbd = Math.abs(x - cx) + Math.abs(y - cy);
        const minDist = Math.max(8, 12 - lvId);
        if (distCbd < minDist) continue;
        mineCandidates.push({ x, y, terrain: cell.terrain, elev: cell.elevation });
      }
    }
    if (mineCandidates.length >= 4) {
      const zoneCount = 1 + Math.floor(Math.random() * 3);
      let shuffled = shuffle(mineCandidates.slice());
      for (let zi = 0; zi < zoneCount && shuffled.length > 0; zi++) {
        const seed = shuffled.shift();
        // v2.4.3b: 直接放置矿区，不依赖 buildableKey
        const clusterCells = placeMineCluster(seed, 4 + randInt(0, 4), 5 + lvId);
        if (clusterCells.length < 2) continue;
        // 放置矿区建筑
        const mineBuildings = [];
        for (const c of clusterCells) {
          const kk = k(c.x, c.y);
          if (occupied.has(kk)) continue;
          const def = BUILDING_TYPES.mine;
          if (!def) continue;
          gameState.buildings.push({ x: c.x, y: c.y, type: 'mine', layer: 'ground', age: 0 });
          occupied.add(kk);
          mineBuildings.push({ x: c.x, y: c.y });
        }
        if (mineBuildings.length === 0) continue;
        // v2.4.3c: 每个矿区可以有1-2种矿产，随机初始产量60-100
        const mineralTypes = pickMineralTypesForZone();
        const primaryMineral = mineralTypes[0];
        const zoneId = 'mineral_' + zi + '_' + Date.now();
        const zoneName = mineralTypes.map(m => m.name).join('·') + '矿区';
        const initProd = 60 + randInt(0, 40); // 60-100随机初始产量
        const maxProd = 100;
        gameState.mineralZones.push({
          id: zoneId,
          name: zoneName,
          resourceType: primaryMineral.type,
          resourceTypeName: mineralTypes.map(m => m.name).join('·'),
          mineralTypes: mineralTypes, // v2.4.3c: 完整矿种列表
          cells: clusterCells,
          mineBuildings: mineBuildings,
          production: initProd,
          maxProduction: maxProd,
          depleted: false,
        });
        // 道路连接：从矿区中心到最近道路
        const center = mineBuildings[Math.floor(mineBuildings.length / 2)];
        connectAgriToRoad(center.x, center.y);
      }
    }
    // 如果没有成功放置任何矿区，降级为非资源型城市
    if (gameState.mineralZones.length === 0) {
      gameState.isResourceCity = false;
    } else {
      // v2.4.3: 有概率开局即为资源枯竭型城市（15%概率）
      if (Math.random() < 0.15) {
        gameState.resourceDepleted = true;
        gameState.resourceDepletionMonths = 0;
        gameState._noTransformWarningMonths = 0;
        // 将所有矿区产量降至 10-25%（接近枯竭）
        for (const mz of gameState.mineralZones) {
          mz.production = 10 + randInt(0, 15);
          if (mz.production <= 0) {
            mz.production = 0;
            mz.depleted = true;
          }
        }
        logEvent('本市矿产资源已近枯竭，开局即为资源枯竭型城市', 'danger');
      }
    }
  }

  // ===== v2.3.5: 企业生成 — 为商业区/工业区生成企业，为住宅区生成附属设施 =====
  gameState.enterprises = [];
  gameState.enterpriseFacilities = [];
  for (const zone of gameState.zones) {
    if (zone.type === 'commercial' || zone.type === 'industrial') {
      // v2.3.6c: 工业区企业数量根据子类型调整，重工业和高新企业更多
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
      // 住宅区50%概率生成附属设施
      if (Math.random() < 0.5 && zone.cells.length > 0) {
        const c = zone.cells[Math.floor(Math.random() * zone.cells.length)];
        const fac = generateResidentialFacility(lvId, c.x, c.y, gameState.cityName);
        gameState.enterpriseFacilities.push(fac);
      }
    }
  }
  // v2.4.3: 为矿产资源区生成采矿型国企
  if (gameState.isResourceCity && gameState.mineralZones.length > 0) {
    for (const mz of gameState.mineralZones) {
      // 每个矿区生成 1-2 家采矿国企
      const entCount = Math.min(mz.mineBuildings.length, 1 + Math.floor(Math.random() * 2));
      for (let i = 0; i < entCount; i++) {
        const mb = mz.mineBuildings[Math.floor(i * mz.mineBuildings.length / entCount)];
        const mineralForEnt = (mz.mineralTypes && mz.mineralTypes.length > 0)
          ? mz.mineralTypes[i % mz.mineralTypes.length] : { name: mz.resourceTypeName || '采矿', type: mz.resourceType };
        // 构造矿种行业名：如"煤炭矿业"、"铁矿开发"
        const miningIndustry = mineralForEnt.name + '矿业';
        const ent = generateEnterprise('industrial', lvId, mb.x, mb.y, gameState.cityName, 'mining');
        ent.mineralZoneId = mz.id;
        ent.resourceType = mineralForEnt.type;
        // v2.4.3: 使用标准命名但替换行业为矿种行业
        // generateEnterprise 已生成 name=[前缀]地名+专名+行业+后缀, shortName=专名+行业
        // 替换其中的行业部分为矿种行业
        const oldIndustry = ent.industry;
        ent.name = ent.name.replace(oldIndustry, miningIndustry);
        ent.shortName = ent.properName + mineralForEnt.name;
        ent.industry = miningIndustry;
        gameState.enterprises.push(ent);
      }
    }
  }

  gameState.buildingCount = gameState.buildings.length;
  gameState.treasury = level.treasury;
  gameState.termEnd = level.termMonths;
  gameState.termTurn = 0;
}