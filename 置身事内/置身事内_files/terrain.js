/* 源自《置身事内》单文件版 - 地形生成 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 地形生成 ==============
function generateTerrain(seed) {
  const cells = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      // Low frequency for larger, continuous landmasses
      const nx = x / MAP_W * 3, ny = y / MAP_H * 2;
      // Fewer octaves, lower persistence for smoother terrain
      let elev = fbm(nx, ny, 4, 0.45, 2.0, seed);
      // Minimal ridge noise for mountain ridges
      let ridge = ridgeNoise(nx * 1.2, ny * 1.2, seed + 5000);
      ridge = Math.pow(ridge, 3);
      elev = elev * 0.80 + ridge * 0.20;
      // Gentle edge falloff - min 0.5 to avoid edge islands
      const ex = 1 - Math.pow(Math.abs(x / MAP_W - 0.5) * 2, 4);
      const ey = 1 - Math.pow(Math.abs(y / MAP_H - 0.5) * 2, 4);
      elev *= Math.max(0.5, ex * ey);
      // Power curve favors low elevations (plains), few mountains
      elev = Math.pow(elev, 1.4) * 750;
      const isWater = elev < WATER_LEVEL;
      cells.push({ x, y, elevation: elev, isWater, terrain: getTerrainType(elev, isWater), building: null, buildingLayer: null, river: false });
    }
  }
  generateRivers(cells, seed);
  return cells;
}

function getTerrainType(elev, isWater) {
  if (isWater) { if (elev < 25) return 'deepWater'; if (elev < 42) return 'water'; return 'shallow'; }
  if (elev < 70) return 'sand'; if (elev < 200) return 'grass'; if (elev < 320) return 'forest';
  if (elev < 450) return 'hill'; if (elev < 600) return 'mountain'; if (elev < 750) return 'highMountain';
  return 'snow';
}

function generateRivers(cells, seed) {
  const paths = [], numRivers = randomInt(3, 5);
  for (let r = 0; r < numRivers; r++) {
    let bestIdx = -1, bestElev = -1;
    for (let i = 0; i < 300; i++) {
      const idx = randomInt(0, cells.length - 1);
      if (cells[idx].elevation > 200 && cells[idx].elevation > bestElev && !cells[idx].river) { bestIdx = idx; bestElev = cells[idx].elevation; }
    }
    if (bestIdx < 0) continue;
    const path = []; let current = bestIdx, steps = 0;
    while (steps < 300) {
      const c = cells[current]; path.push(current);
      if (c.elevation < WATER_LEVEL || c.isWater) break;
      let lowestIdx = -1, lowestElev = c.elevation;
      for (let dy = -1; dy <= 1; dy++) { for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = c.x + dx, ny = c.y + dy;
        if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
        const nidx = ny * MAP_W + nx;
        if (cells[nidx].elevation < lowestElev) { lowestElev = cells[nidx].elevation; lowestIdx = nidx; }
      }}
      if (lowestIdx < 0 || lowestIdx === current) break;
      current = lowestIdx; steps++;
    }
    for (const idx of path) {
      cells[idx].river = true;
      if (cells[idx].elevation > WATER_LEVEL) { cells[idx].elevation = Math.max(WATER_LEVEL - 5, cells[idx].elevation - 25); cells[idx].isWater = true; cells[idx].terrain = 'water'; }
    }
    paths.push(path);
  }
  riverPaths = paths;
}

function generateContours(cells) {
  const segments = [], levels = [];
  for (let l = WATER_LEVEL + CONTOUR_INTERVAL; l < 800; l += CONTOUR_INTERVAL) levels.push(l);
  for (const level of levels) {
    for (let y = 0; y < MAP_H - 1; y++) {
      for (let x = 0; x < MAP_W - 1; x++) {
        const i = y * MAP_W + x;
        const tl = cells[i].elevation, tr = cells[i+1].elevation, bl = cells[i+MAP_W].elevation, br = cells[i+MAP_W+1].elevation;
        let idx = 0;
        if (tl > level) idx |= 1; if (tr > level) idx |= 2; if (br > level) idx |= 4; if (bl > level) idx |= 8;
        if (idx === 0 || idx === 15) continue;
        const px = x * CELL, py = y * CELL;
        const t = (level - tl) / (tr - tl || 1), t2 = (level - bl) / (br - bl || 1), t3 = (level - tl) / (bl - tl || 1), t4 = (level - tr) / (br - tr || 1);
        const p_t = [px + CELL * t, py], p_b = [px + CELL * t2, py + CELL], p_l = [px, py + CELL * t3], p_r = [px + CELL, py + CELL * t4];
        const segs = { 1:[p_l,p_t], 2:[p_t,p_r], 3:[p_l,p_r], 4:[p_r,p_b], 5:[p_l,p_t,p_r,p_b], 6:[p_t,p_b], 7:[p_l,p_b], 8:[p_l,p_b], 9:[p_t,p_b], 10:[p_l,p_b,p_t,p_r], 11:[p_r,p_b], 12:[p_l,p_r], 13:[p_t,p_r], 14:[p_l,p_t] };
        if (segs[idx]) { const s = segs[idx]; for (let k = 0; k < s.length; k += 2) segments.push({ x1: s[k][0], y1: s[k][1], x2: s[k+1][0], y2: s[k+1][1], level }); }
      }
    }
  }
  return segments;
}

