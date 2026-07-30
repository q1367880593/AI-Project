/* 源自《置身事内》单文件版 - 渲染 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 渲染 ==============
function initCanvas() {
  canvas = document.getElementById('mapcanvas');
  ctx = canvas.getContext('2d');
  offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = MAP_W * CELL;
  offscreenCanvas.height = MAP_H * CELL;
  offscreenCtx = offscreenCanvas.getContext('2d');
}

function renderTerrainToOffscreen() {
  // 按当前地图尺寸调整离屏画布（修改尺寸后需重新获取上下文）
  if (offscreenCanvas.width !== MAP_W * CELL) { offscreenCanvas.width = MAP_W * CELL; offscreenCtx = offscreenCanvas.getContext('2d'); }
  if (offscreenCanvas.height !== MAP_H * CELL) { offscreenCanvas.height = MAP_H * CELL; offscreenCtx = offscreenCanvas.getContext('2d'); }
  const oc = offscreenCtx;
  // Base terrain fill (flat colors only, no hand-drawn shapes)
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const cell = mapCells[y * MAP_W + x];
      if (!cell || cell.elevation === undefined) continue;
      const color = getTerrainColor(cell.elevation, cell.isWater || cell.river);
      oc.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      oc.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
  // SVG-based terrain feature icons (mountains, forests, hills)
  const TERRAIN_SVG = {
    mountain: 'M2 14 L8 2 L14 14 Z',
    highMountain: 'M1 15 L8 1 L15 15 Z M5 12 L8 6 L11 12',
    forest: 'M8 1 C5 5 5 9 8 9 C11 9 11 5 8 1 M4 6 C2 9 2 12 4 12 C6 12 6 9 4 6 M12 6 C10 9 10 12 12 12 C14 12 14 9 12 6',
    hill: 'M1 12 Q4 6 8 6 Q12 6 15 12',
  };
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const cell = mapCells[y * MAP_W + x];
      if (!cell || cell.elevation === undefined) continue;
      const svgPath = TERRAIN_SVG[cell.terrain];
      if (!svgPath) continue;
      const color = getTerrainColor(cell.elevation, cell.isWater || cell.river);
      const darken = `rgba(${Math.max(0,color[0]-30)},${Math.max(0,color[1]-25)},${Math.max(0,color[2]-20)},0.5)`;
      const lighten = `rgba(${Math.min(255,color[0]+25)},${Math.min(255,color[1]+25)},${Math.min(255,color[2]+25)},0.4)`;
      const px = x * CELL, py = y * CELL;
      // Draw SVG path scaled to cell
      oc.save();
      oc.translate(px, py);
      oc.scale(CELL / 16, CELL / 16);
      // Shadow fill
      oc.fillStyle = darken;
      drawSVGPath(oc, svgPath);
      oc.fill();
      // Highlight (offset)
      oc.translate(-1, -1);
      oc.fillStyle = lighten;
      drawSVGPath(oc, svgPath);
      oc.fill();
      oc.restore();
    }
  }
  // Contour lines (SVG-style thin strokes)
  oc.strokeStyle = 'rgba(160, 150, 130, 0.3)';
  oc.lineWidth = 0.5;
  for (const seg of contourSegments) {
    oc.beginPath(); oc.moveTo(seg.x1, seg.y1); oc.lineTo(seg.x2, seg.y2); oc.stroke();
  }
  oc.strokeStyle = 'rgba(140, 125, 100, 0.45)';
  oc.lineWidth = 0.9;
  for (const seg of contourSegments) {
    if (seg.level % 200 === 0) { oc.beginPath(); oc.moveTo(seg.x1, seg.y1); oc.lineTo(seg.x2, seg.y2); oc.stroke(); }
  }
  // Rivers (SVG-style polyline strokes)
  oc.strokeStyle = 'rgba(94, 140, 178, 0.75)';
  oc.lineWidth = 2.8;
  oc.lineCap = 'round';
  for (const path of riverPaths) {
    oc.beginPath();
    for (let i = 0; i < path.length; i++) {
      const cell = mapCells[path[i]];
      if (!cell) continue;
      const px = cell.x * CELL + CELL/2, py = cell.y * CELL + CELL/2;
      if (i === 0) oc.moveTo(px, py); else oc.lineTo(px, py);
    }
    oc.stroke();
  }
  oc.strokeStyle = 'rgba(190, 210, 225, 0.4)';
  oc.lineWidth = 1;
  for (const path of riverPaths) {
    oc.beginPath();
    for (let i = 0; i < path.length; i++) {
      const cell = mapCells[path[i]];
      if (!cell) continue;
      const px = cell.x * CELL + CELL/2, py = cell.y * CELL + CELL/2;
      if (i === 0) oc.moveTo(px, py); else oc.lineTo(px, py);
    }
    oc.stroke();
  }
}

