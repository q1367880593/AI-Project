/* 源自《置身事内》单文件版 - 视图变换 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 视图变换 ==============
function screenToCanvas(clientX, clientY) {
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function canvasToMapCoords(cx, cy) {
  const mapX = (cx - viewState.offsetX) / viewState.zoom;
  const mapY = (cy - viewState.offsetY) / viewState.zoom;
  return { x: Math.floor(mapX / CELL), y: Math.floor(mapY / CELL) };
}

// Convert map/canvas coordinates back to screen (client) coordinates
function canvasToScreen(canvasX, canvasY) {
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  return { x: canvasX * scaleX + rect.left, y: canvasY * scaleY + rect.top };
}

function clampView() {
  if (!canvas) return;
  const mapW = MAP_W * CELL, mapH = MAP_H * CELL;
  const viewW = canvas.width, viewH = canvas.height;
  viewState.zoom = Math.max(0.2, Math.min(viewState.zoom, 8));
  const scaledMapW = mapW * viewState.zoom;
  const scaledMapH = mapH * viewState.zoom;
  if (scaledMapW <= viewW) {
    viewState.offsetX = (viewW - scaledMapW) / 2;
  } else {
    viewState.offsetX = Math.min(0, Math.max(viewW - scaledMapW, viewState.offsetX));
  }
  if (scaledMapH <= viewH) {
    viewState.offsetY = (viewH - scaledMapH) / 2;
  } else {
    viewState.offsetY = Math.min(0, Math.max(viewH - scaledMapH, viewState.offsetY));
  }
}

function fitMapToView() {
  if (!canvas) return;
  const mapW = MAP_W * CELL, mapH = MAP_H * CELL;
  const viewW = canvas.width, viewH = canvas.height;
  const scale = Math.min(viewW / mapW, viewH / mapH);
  viewState.zoom = scale;
  viewState.offsetX = (viewW - mapW * scale) / 2;
  viewState.offsetY = (viewH - mapH * scale) / 2;
  clampView();
  renderMap();
}

function zoomBy(factor) {
  if (!canvas) return;
  const viewW = canvas.width, viewH = canvas.height;
  const centerX = viewW / 2, centerY = viewH / 2;
  const newZoom = Math.max(0.2, Math.min(viewState.zoom * factor, 8));
  const actualFactor = newZoom / viewState.zoom;
  viewState.offsetX = centerX - (centerX - viewState.offsetX) * actualFactor;
  viewState.offsetY = centerY - (centerY - viewState.offsetY) * actualFactor;
  viewState.zoom = newZoom;
  clampView();
  renderMap();
}

function zoomAtPoint(canvasX, canvasY, factor) {
  const newZoom = Math.max(0.2, Math.min(viewState.zoom * factor, 8));
  const actualFactor = newZoom / viewState.zoom;
  viewState.offsetX = canvasX - (canvasX - viewState.offsetX) * actualFactor;
  viewState.offsetY = canvasY - (canvasY - viewState.offsetY) * actualFactor;
  viewState.zoom = newZoom;
  clampView();
  renderMap();
}

function resetView() {
  fitMapToView();
}

function renderMap() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // v2.3.0: 手机地图浅色背景
  ctx.fillStyle = '#f0f2f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(viewState.offsetX, viewState.offsetY);
  ctx.scale(viewState.zoom, viewState.zoom);
  ctx.drawImage(offscreenCanvas, 0, 0);
  // --- Render zones (painted areas) ---
  // v2.2.5d: 区域属于地面层，关闭地面层时不显示
  if (gameState.activeLayers.ground) {
    // v2.3.0: 同类地块合并显示模式 — 将相邻同类型区域合并为矩形显示
    const mergeMode = gameState.mergeZones;
    // 合并模式下预先计算各合并组的矩形
    let mergedRects = null;
    if (mergeMode) mergedRects = computeMergedZoneRects(gameState.zones);
    for (const zone of gameState.zones) {
      const zt = ZONE_TYPES[zone.type];
      if (!zt) continue;
      const sub = zt.subTypes[zone.subType] || zt;
      const zoneColor = sub.color || zt.color;

      if (mergeMode && mergedRects) {
        // v2.3.0c: 合并模式 — 填充所有格子（无内部边框），仅描边组边界，保留锯齿轮廓
        const groupKey = zone.type + ':' + zone.subType;
        const group = mergedRects.get(groupKey);
        if (group) {
          const groupCellSet = group.zoneCellMap.get(zone);
          if (groupCellSet) {
            // 填充该 zone 的所有格子
            ctx.fillStyle = zoneColor;
            ctx.globalAlpha = 0.75;
            for (const c of zone.cells) {
              ctx.fillRect(c.x * CELL, c.y * CELL, CELL, CELL);
            }
            ctx.globalAlpha = 1;
            // 仅在组边界描边（该格的某条边面向非组内格子时才画该边）
            ctx.strokeStyle = zt.borderColor;
            ctx.lineWidth = 1.2 / viewState.zoom;
            ctx.globalAlpha = 0.5;
            for (const c of zone.cells) {
              const rx = c.x * CELL, ry = c.y * CELL;
              // 检查四条边是否为组边界
              const top    = !groupCellSet.has(c.x + ',' + (c.y - 1));
              const bottom = !groupCellSet.has(c.x + ',' + (c.y + 1));
              const left   = !groupCellSet.has((c.x - 1) + ',' + c.y);
              const right  = !groupCellSet.has((c.x + 1) + ',' + c.y);
              if (top)    { ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + CELL, ry); ctx.stroke(); }
              if (bottom) { ctx.beginPath(); ctx.moveTo(rx, ry + CELL); ctx.lineTo(rx + CELL, ry + CELL); ctx.stroke(); }
              if (left)   { ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry + CELL); ctx.stroke(); }
              if (right)  { ctx.beginPath(); ctx.moveTo(rx + CELL, ry); ctx.lineTo(rx + CELL, ry + CELL); ctx.stroke(); }
            }
            ctx.globalAlpha = 1;
            continue;
          }
        }
      }
      // 标准模式：逐格渲染圆角方块
      for (const c of zone.cells) {
        ctx.fillStyle = zoneColor;
        ctx.globalAlpha = 0.75;
        const rx = c.x * CELL, ry = c.y * CELL;
        const radius = Math.min(CELL * 0.3, 4);
        ctx.beginPath();
        ctx.moveTo(rx + radius, ry);
        ctx.lineTo(rx + CELL - radius, ry);
        ctx.arcTo(rx + CELL, ry, rx + CELL, ry + radius, radius);
        ctx.lineTo(rx + CELL, ry + CELL - radius);
        ctx.arcTo(rx + CELL, ry + CELL, rx + CELL - radius, ry + CELL, radius);
        ctx.lineTo(rx + radius, ry + CELL);
        ctx.arcTo(rx, ry + CELL, rx, ry + CELL - radius, radius);
        ctx.lineTo(rx, ry + radius);
        ctx.arcTo(rx, ry, rx + radius, ry, radius);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Zone border
      ctx.strokeStyle = zt.borderColor;
      ctx.lineWidth = 1.2 / viewState.zoom;
      ctx.globalAlpha = 0.35;
      for (const c of zone.cells) {
        const rx = c.x * CELL, ry = c.y * CELL;
        const radius = Math.min(CELL * 0.3, 4);
        ctx.beginPath();
        ctx.moveTo(rx + radius, ry);
        ctx.lineTo(rx + CELL - radius, ry);
        ctx.arcTo(rx + CELL, ry, rx + CELL, ry + radius, radius);
        ctx.lineTo(rx + CELL, ry + CELL - radius);
        ctx.arcTo(rx + CELL, ry + CELL, rx + CELL - radius, ry + CELL, radius);
        ctx.lineTo(rx + radius, ry + CELL);
        ctx.arcTo(rx, ry + CELL, rx, ry + CELL - radius, radius);
        ctx.lineTo(rx, ry + radius);
        ctx.arcTo(rx, ry, rx + radius, ry, radius);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Shop labels moved to centroid rendering below
    }
  }
  // --- Render roads ---
  // v2.2.5d: 道路属于地面层，关闭地面层时不显示
  if (gameState.activeLayers.ground) {
    for (const road of gameState.roads) {
    const rt = ROAD_TYPES[road.grade];
    if (!rt) continue;
    if (road.cells.length < 1) continue;
    // Road fill
    ctx.strokeStyle = rt.color;
    ctx.lineWidth = rt.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < road.cells.length; i++) {
      const c = road.cells[i];
      const px = c.x * CELL + CELL/2, py = c.y * CELL + CELL/2;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // Road outline
    if (rt.width > 3) {
      ctx.strokeStyle = rt.lineColor;
      ctx.lineWidth = rt.width + 1.5;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.beginPath();
      for (let i = 0; i < road.cells.length; i++) {
        const c = road.cells[i];
        const px = c.x * CELL + CELL/2, py = c.y * CELL + CELL/2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    // Dash pattern for highway
    if (rt.dashPattern.length > 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.setLineDash(rt.dashPattern);
      ctx.beginPath();
      for (let i = 0; i < road.cells.length; i++) {
        const c = road.cells[i];
        const px = c.x * CELL + CELL/2, py = c.y * CELL + CELL/2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Road name label follows road direction (including diagonal)
    if (road.name && viewState.zoom > 1.5 && road.cells.length > 3) {
      const midIdx = Math.floor(road.cells.length / 2);
      const mc = road.cells[midIdx];
      // Determine road direction from surrounding cells
      let angle = 0; // 0 = horizontal, 90 = vertical, 45/135 = diagonal
      if (midIdx > 0 && midIdx < road.cells.length - 1) {
        const prev = road.cells[midIdx - 1], next = road.cells[midIdx + 1];
        const dx = next.x - prev.x, dy = next.y - prev.y;
        angle = Math.atan2(dy, dx); // angle in radians
      }
      ctx.save();
      ctx.font = `${CELL * 0.42}px sans-serif`;
      ctx.fillStyle = 'rgba(40,40,40,0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const mcx = mc.x * CELL + CELL/2, mcy = mc.y * CELL + CELL/2;
      const angleDeg = angle * 180 / Math.PI;
      // Vertical: draw character by character (avoid rotation artifacts)
      if (Math.abs(angleDeg) > 75 && Math.abs(angleDeg) < 105) {
        const chars = road.name.split('');
        const charSpacing = CELL * 0.5;
        const startY = mcy - (chars.length * charSpacing) / 2;
        for (let ci = 0; ci < chars.length; ci++) {
          ctx.fillText(chars[ci], mcx, startY + ci * charSpacing);
        }
      } else if (Math.abs(angleDeg) > 15 && Math.abs(angleDeg) < 75) {
        // Diagonal: rotate text along road direction
        ctx.translate(mcx, mcy);
        ctx.rotate(angle);
        ctx.fillText(road.name, 0, -CELL * 0.15);
      } else {
        // Horizontal
        ctx.fillText(road.name, mcx, mcy);
      }
      ctx.restore();
    }
  } // v2.2.5d: end for road loop
  } // v2.2.5d: end if ground layer for roads
  // v2.2.5d: 渲染公共交通线路（railmapgen风格：单色线条+圆角端点+站点标记）
  if (gameState.transits && gameState.transits.length > 0) {
    for (const transit of gameState.transits) {
      const tt = TRANSIT_TYPES[transit.type];
      if (!tt || !tt.width) continue;
      if (transit.cells.length < 1) continue;
      // 仅在该线路所属图层激活时渲染
      const layerKey = tt.layer || 'elevated';
      if (gameState.activeLayers && gameState.activeLayers[layerKey] === false) continue;
      // v2.2.6b: 直接绘制彩色线条（移除白色描边，L型拐角更清晰）
      // v2.4.7c: 铁路/高铁跳过首层，由3层图例风格渲染覆盖
      if (!(tt.isRailway || tt.isHSR)) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = transit.color || tt.color;
        ctx.lineWidth = tt.width;
        if (tt.dashPattern && tt.dashPattern.length > 0) {
          ctx.setLineDash(tt.dashPattern);
        } else {
          ctx.setLineDash([]);
        }
        ctx.beginPath();
        for (let i = 0; i < transit.cells.length; i++) {
          const c = transit.cells[i];
          const px = c.x * CELL + CELL/2, py = c.y * CELL + CELL/2;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

    }
  } // end if transits
  if (gameState.activeLayers && gameState.activeLayers.traffic) {
    const mode = gameState.trafficLayerMode || 'congestion';
    if (mode === 'heatmap' && typeof renderTrafficHeatmap === 'function') {
      renderTrafficHeatmap(ctx);
    } else if (typeof renderTrafficOverlay === 'function') {
      renderTrafficOverlay(ctx);
    }
  }
  // --- Render buildings (infrastructure only; zone buildings get one icon per zone) ---
  // Build a set of zone cell coordinates to skip
  const zoneCellSet = new Set();
  for (const z of gameState.zones) {
    for (const c of z.cells) zoneCellSet.add(c.x + ',' + c.y);
  }
  // v2.3.0d: 合并模式下预先计算建筑合并组（农田、沿街商业等同类相邻建筑）
  const mergedBuildings = (gameState.mergeZones && gameState.activeLayers.ground)
    ? computeMergedBuildings(gameState.buildings)
    : null;
  for (const b of gameState.buildings) {
    if (b.type === 'road') continue; // Roads rendered as polylines above
    // v2.2.5d: 跳过transit线路建筑（它们通过transits数组以polyline渲染）
    if (['subwayLine', 'lightRail', 'elevatedRail', 'elevatedRoad', 'utility', 'railwayLine', 'hsrLine'].includes(b.type)) continue;
    // v2.2.7c: 站点建筑跳过色块渲染（由站点标记代码独立绘制圆点图标）
    if (['subwayStation', 'lightRailStation', 'railwayStation', 'hsrStation'].includes(b.type)) continue;
    // v2.4.8: 跑道建筑跳过色块渲染（由跑道渲染代码独立绘制）
    if (b.type === 'runway' || b.type === 'runwayCell') continue;
    // Skip zone buildings — they get a single text label per zone
    if (zoneCellSet.has(b.x + ',' + b.y)) continue;
    // 配套建筑（_fac类型）：用父建筑颜色渲染，显示配套名简称
    // v2.2.5d: 配套建筑也需要检查父建筑所在图层
    if (b.type.endsWith('_fac')) {
      const parentType = b.type.replace('_fac', '');
      const parentDef = BUILDING_TYPES[parentType];
      const parentLayer = parentDef ? parentDef.layer : 'ground';
      if (parentDef && gameState.activeLayers[parentLayer]) {
        const px = b.x * CELL, py = b.y * CELL;
        ctx.fillStyle = parentDef.color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        ctx.globalAlpha = 1;
        // 边框区分
        ctx.strokeStyle = parentDef.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2);
        ctx.setLineDash([]);
        // 显示配套名
        const fac = (BUILDING_FACILITIES[parentType] || []).find(f => f.id === b.facilityId);
        if (fac) {
          ctx.font = `${CELL * 0.28}px sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(fac.name, px + CELL/2, py + CELL/2);
        }
      }
      continue;
    }
    const def = BUILDING_TYPES[b.type];
    if (!def) continue;
    if (!gameState.activeLayers[def.layer]) continue;
    const px = b.x * CELL, py = b.y * CELL;
    if (b.underConstruction) {
      // Draw construction site: striped pattern with progress indicator
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      // Diagonal stripes (construction barrier)
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -CELL; i < CELL * 2; i += 6) {
        ctx.moveTo(px + i, py);
        ctx.lineTo(px + i + CELL, py + CELL);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      // Show progress percentage
      if (viewState.zoom > 1.5 && b.constructionProjectId) {
        const proj = gameState.constructionProjects?.find(p => p.id === b.constructionProjectId);
        if (proj) {
          const pct = Math.round(proj.elapsedMonths / proj.totalMonths * 100);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(px, py + CELL * 0.6, CELL, CELL * 0.4);
          ctx.fillStyle = '#fff';
          ctx.font = `${CELL * 0.3}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pct + '%', px + CELL/2, py + CELL * 0.8);
        }
      }
    } else {
      // v2.3.0d: 合并模式下渲染合并组（填充无间隙，仅描边组边界，保留锯齿轮廓）
      const group = mergedBuildings ? mergedBuildings.get(b) : null;
      if (group && def.layer === 'ground') {
        // 填充整个格子（无内边距，使相邻同类型建筑无缝连接）
        ctx.fillStyle = def.color;
        ctx.globalAlpha = 0.88;
        ctx.fillRect(px, py, CELL, CELL);
        ctx.globalAlpha = 1;
        // 仅描边组边界（该格的某条边面向非组内格子时才画该边）
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 0.6 / viewState.zoom;
        ctx.globalAlpha = 0.7;
        const top    = !group.cells.has(b.x + ',' + (b.y - 1));
        const bottom = !group.cells.has(b.x + ',' + (b.y + 1));
        const left   = !group.cells.has((b.x - 1) + ',' + b.y);
        const right  = !group.cells.has((b.x + 1) + ',' + b.y);
        if (top)    { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + CELL, py); ctx.stroke(); }
        if (bottom) { ctx.beginPath(); ctx.moveTo(px, py + CELL); ctx.lineTo(px + CELL, py + CELL); ctx.stroke(); }
        if (left)   { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + CELL); ctx.stroke(); }
        if (right)  { ctx.beginPath(); ctx.moveTo(px + CELL, py); ctx.lineTo(px + CELL, py + CELL); ctx.stroke(); }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = def.color;
        const pad = def.layer === 'ground' ? 1 : 2;
        ctx.globalAlpha = def.layer === 'ground' ? 0.88 : 0.7;
        ctx.fillRect(px + pad, py + pad, CELL - pad*2, CELL - pad*2);
        ctx.globalAlpha = 1;
        if (def.layer !== 'ground') {
          ctx.strokeStyle = def.color; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
          ctx.strokeRect(px + 1, py + 1, CELL - 2, CELL - 2); ctx.setLineDash([]);
        }
      }
    }
    // 在公共建筑上显示简称
    if (!b.underConstruction && PUBLIC_BUILDING_TYPES.includes(b.type) && b.customName) {
      const abbr = getBuildingAbbr(b);
      if (abbr) {
        ctx.font = `${CELL * 0.32}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(abbr, px + CELL/2, py + CELL/2);
      }
    }
    // v2.4.3c: 在矿区建筑上显示采矿企业名称（与工业区逻辑一致）
    if (!b.underConstruction && b.type === 'mine' && gameState.enterprises && viewState.zoom > 1.3) {
      const ent = gameState.enterprises.find(e => e.x === b.x && e.y === b.y);
      if (ent) {
        const name = viewState.zoom > 2.5 ? (ent.shortName || ent.name).slice(0, 5) : (ent.shortName || ent.name).slice(0, 3);
        ctx.font = `${CELL * 0.26}px sans-serif`;
        ctx.fillStyle = 'rgba(255,240,200,0.92)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, px + CELL/2, py + CELL/2);
      }
    }
  }
  // v2.4.8: 渲染机场跑道（在建筑之上，支持机场关联跑道和独立跑道建筑）
  if (gameState.activeLayers && gameState.activeLayers.ground !== false) {
    // 收集所有跑道：机场关联的跑道 + 独立跑道建筑
    const allRenderRunways = [];
    for (const b of gameState.buildings) {
      if (b.underConstruction) continue;
      if (b.type === 'airport') {
        // v2.4.8d: 修复空 runwayCells 数组导致渲染崩溃（b.runwayCells[0].x 访问 undefined）
        const runways = (b.runways && b.runways.length > 0) ? b.runways : (b.runwayCells && b.runwayCells.length > 0 ? [{ cells: b.runwayCells, direction: b.runwayCells[0].x === b.runwayCells[b.runwayCells.length-1].x ? 'vertical' : 'horizontal' }] : []);
        for (const r of runways) allRenderRunways.push(r);
      } else if (b.type === 'runway' && b.runwayData) {
        allRenderRunways.push(b.runwayData);
      }
    }
    for (const runway of allRenderRunways) {
      if (!runway.cells || runway.cells.length === 0) continue;
      const isVertical = runway.direction === 'vertical' || (runway.cells[0].x === runway.cells[runway.cells.length - 1].x);
      // 跑道底色：深灰条带
      ctx.fillStyle = '#3a3a3a';
      for (const c of runway.cells) {
        const px = c.x * CELL, py = c.y * CELL;
        if (isVertical) {
          ctx.fillRect(px + CELL * 0.3, py, CELL * 0.4, CELL);
        } else {
          ctx.fillRect(px, py + CELL * 0.3, CELL, CELL * 0.4);
        }
      }
      // 跑道中心虚线
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < runway.cells.length; i++) {
        const c = runway.cells[i];
        const px = c.x * CELL + CELL/2, py = c.y * CELL + CELL/2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // v2.4.8c: 铁路/高铁渲染移至建筑循环之后（确保在农田上方）
  if (gameState.transits && gameState.transits.length > 0 && gameState.activeLayers && gameState.activeLayers.ground !== false) {
    for (const transit of gameState.transits) {
      const tt = TRANSIT_TYPES[transit.type];
      if (!tt || !tt.width) continue;
      if (!(tt.isRailway || tt.isHSR)) continue;
      if (transit.cells.length < 1) continue;
      const layerKey = tt.layer || 'elevated';
      if (gameState.activeLayers && gameState.activeLayers[layerKey] === false) continue;
      const outlineColor = tt.isHSR ? '#cc0000' : '#222222';
      const segLen = CELL * 0.5;
      // 第一层：粗描边线（无圆角）
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = tt.width + 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let i = 0; i < transit.cells.length; i++) {
        const c = transit.cells[i];
        const px = c.x * CELL + CELL/2, py = c.y * CELL + CELL/2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // 第二层：白色底色（无圆角）
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = tt.width - 1;
      ctx.beginPath();
      for (let i = 0; i < transit.cells.length; i++) {
        const c = transit.cells[i];
        const px = c.x * CELL + CELL/2, py = c.y * CELL + CELL/2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // 第三层：黑/红矩形色块（1:1比例，无圆角）
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = tt.width - 1;
      ctx.setLineDash([segLen, segLen]);
      ctx.lineDashOffset = 0;
      ctx.beginPath();
      for (let i = 0; i < transit.cells.length; i++) {
        const c = transit.cells[i];
        const px = c.x * CELL + CELL/2, py = c.y * CELL + CELL/2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // v2.4.8d: 站点标记渲染移至铁路线之后（确保站点在铁路线上方）
  // 构建格子→线路颜色和方向索引
  const cellTransitColor = {};
  const cellTransitDir = {};
  if (gameState.transits) {
    for (const t of gameState.transits) {
      if (!t.color) continue;
      for (let i = 0; i < t.cells.length; i++) {
        const c = t.cells[i];
        cellTransitColor[c.x + ',' + c.y] = t.color;
        // v2.5.0: 计算该格处的线路走向（水平/垂直/斜向）
        if (i > 0 && i < t.cells.length - 1) {
          const prev = t.cells[i - 1], next = t.cells[i + 1];
          const dx = next.x - prev.x, dy = next.y - prev.y;
          if (Math.abs(dx) > 0 && dy === 0) cellTransitDir[c.x + ',' + c.y] = 'h';
          else if (Math.abs(dy) > 0 && dx === 0) cellTransitDir[c.x + ',' + c.y] = 'v';
          else cellTransitDir[c.x + ',' + c.y] = 'd'; // 斜向
        } else if (i === 0 && t.cells.length > 1) {
          const next = t.cells[1];
          const dx = next.x - c.x, dy = next.y - c.y;
          if (Math.abs(dx) > 0 && dy === 0) cellTransitDir[c.x + ',' + c.y] = 'h';
          else if (Math.abs(dy) > 0 && dx === 0) cellTransitDir[c.x + ',' + c.y] = 'v';
          else cellTransitDir[c.x + ',' + c.y] = 'd';
        } else if (t.cells.length > 1) {
          const prev = t.cells[i - 1];
          const dx = c.x - prev.x, dy = c.y - prev.y;
          if (Math.abs(dx) > 0 && dy === 0) cellTransitDir[c.x + ',' + c.y] = 'h';
          else if (Math.abs(dy) > 0 && dx === 0) cellTransitDir[c.x + ',' + c.y] = 'v';
          else cellTransitDir[c.x + ',' + c.y] = 'd';
        }
      }
    }
  }
  const stationTypes = ['subwayStation', 'lightRailStation', 'railwayStation', 'hsrStation'];
  for (const b of gameState.buildings) {
    if (b.underConstruction) continue;
    if (!stationTypes.includes(b.type)) continue;
    const def = BUILDING_TYPES[b.type];
    if (!def) continue;
    if (gameState.activeLayers && gameState.activeLayers[def.layer] === false) continue;
    const px = b.x * CELL + CELL/2, py = b.y * CELL + CELL/2;
    const lineColor = cellTransitColor[b.x + ',' + b.y] || def.color;
    // v2.5.0: 火车站/高铁站长边跟格子一样长（CELL），长边跟着铁路走向走
    if (b.type === 'railwayStation' || b.type === 'hsrStation') {
      const dir = cellTransitDir[b.x + ',' + b.y] || 'h'; // 默认水平
      // v2.5.0: 长边=CELL（跟格子一样长），短边=CELL*4/7（保持7:4比例）
      const longSide = CELL;
      const shortSide = CELL * 4 / 7;
      const isHorizontal = (dir === 'h');
      const rectW = isHorizontal ? longSide : shortSide;
      const rectH = isHorizontal ? shortSide : longSide;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5; // v2.5.0b: 描边调细
      ctx.fillRect(px - rectW/2, py - rectH/2, rectW, rectH);
      ctx.strokeRect(px - rectW/2, py - rectH/2, rectW, rectH);
    } else {
      // 地铁/轻轨站保持圆形
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // v2.4.8: 站点文字改为黑字+白描边，与建筑标签风格一致
    if (b.customName && viewState.zoom > 1.5) {
      const abbr = getBuildingAbbr(b) || b.customName;
      ctx.font = `${CELL * 0.32}px sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2 / viewState.zoom;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // v2.5.0: 文字位置根据铁路走向调整
      const dir = cellTransitDir[b.x + ',' + b.y] || 'h';
      const textOffset = (b.type === 'railwayStation' || b.type === 'hsrStation')
        ? (dir === 'h' ? CELL * 0.6 : CELL * 0.5)
        : CELL * 0.5;
      ctx.strokeText(abbr, px, py + textOffset);
      ctx.fillText(abbr, px, py + textOffset);
    }
  }
  // --- Draw one SVG icon per zone at centroid ---
  // v2.2.5d: 区域centroid也受地面层控制
  if (gameState.activeLayers.ground) {
    for (const zone of gameState.zones) {
    if (zone.cells.length === 0) continue;
    const zt = ZONE_TYPES[zone.type];
    if (!zt) continue;
    const sub = zt.subTypes[zone.subType] || zt;
    // Calculate centroid
    let cxSum = 0, cySum = 0;
    for (const c of zone.cells) { cxSum += c.x; cySum += c.y; }
    const ccx = Math.round(cxSum / zone.cells.length);
    const ccy = Math.round(cySum / zone.cells.length);
    // No SVG icon at centroid — zones show as colored areas only
    // Commercial zone: draw shop name(s) at centroid
    if (zone.type === 'commercial' && zone.shops && zone.shops.length > 0 && viewState.zoom > 1.3) {
      ctx.font = `${CELL * 0.38}px sans-serif`;
      ctx.fillStyle = 'rgba(60,40,10,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Show up to 2 shop names depending on zoom
      const maxShops = viewState.zoom > 2.5 ? 2 : 1;
      for (let si = 0; si < Math.min(maxShops, zone.shops.length); si++) {
        const shop = zone.shops[si];
        const name = viewState.zoom > 2 ? shop.name.slice(0, 5) : shop.name.slice(0, 3);
        ctx.fillText(name, ccx * CELL + CELL/2, ccy * CELL + CELL/2 + CELL * (0.5 + si * 0.4));
      }
    }
    // v2.3.5c: 工业区/商业区显示企业名称（字号缩小确保4字完整显示，颜色统一）
    if ((zone.type === 'industrial' || zone.type === 'commercial') && gameState.enterprises && viewState.zoom > 1.3) {
      const zoneEnts = gameState.enterprises.filter(e => e.x !== undefined && zone.cells.some(c => c.x === e.x && c.y === e.y));
      if (zoneEnts.length > 0) {
        ctx.font = `${CELL * 0.26}px sans-serif`;
        ctx.fillStyle = 'rgba(50,35,10,0.92)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxEnts = viewState.zoom > 2.5 ? 2 : 1;
        for (let ei = 0; ei < Math.min(maxEnts, zoneEnts.length); ei++) {
          const ent = zoneEnts[ei];
          const name = viewState.zoom > 2.5 ? (ent.shortName || ent.name).slice(0, 6) : (ent.shortName || ent.name).slice(0, 4);
          const yOffset = zone.type === 'commercial' && zone.shops && zone.shops.length > 0
            ? CELL * (0.5 + zone.shops.length * 0.4 + ei * 0.4)
            : CELL * (0.5 + ei * 0.4);
          ctx.fillText(name, ccx * CELL + CELL/2, ccy * CELL + CELL/2 + yOffset);
        }
      }
    }
    // v2.3.5: 住宅区显示附属设施名称
    if (zone.type === 'residential' && gameState.enterpriseFacilities && viewState.zoom > 1.5) {
      const zoneFacs = gameState.enterpriseFacilities.filter(f => f.x !== undefined && zone.cells.some(c => c.x === f.x && c.y === f.y));
      if (zoneFacs.length > 0) {
        ctx.font = `${CELL * 0.34}px sans-serif`;
        ctx.fillStyle = 'rgba(40,60,80,0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fac = zoneFacs[0];
        const name = viewState.zoom > 2 ? (fac.shortName || fac.name).slice(0, 5) : (fac.shortName || fac.name).slice(0, 3);
        ctx.fillText(name, ccx * CELL + CELL/2, ccy * CELL + CELL/2 + CELL * 0.5);
      }
    }
  }
  } // v2.2.5d: end if ground layer for zone centroids
  // --- Paint preview (drawing or demolish rect) ---
  if (gameState.isPainting && gameState.paintCells.length > 0) {
    let previewColor, previewAlpha;
    if (gameState._demolishPaintMode) {
      // 拆除框选：红色
      previewColor = 'rgba(255,59,48,0.25)';
      previewAlpha = 1;
    } else if (gameState.selectedZone) {
      const zt = ZONE_TYPES[gameState.selectedZone];
      const sub = zt.subTypes[gameState.selectedZoneSub] || zt;
      previewColor = sub.color || zt.color;
      previewAlpha = 0.5;
    } else if (gameState.selectedRoadType) {
      const rt = ROAD_TYPES[gameState.selectedRoadType];
      previewColor = rt.color;
      previewAlpha = 0.5;
    } else if (gameState.selectedTransitType) {
      const tt = TRANSIT_TYPES[gameState.selectedTransitType];
      previewColor = tt.color;
      previewAlpha = 0.5;
    }
    ctx.fillStyle = previewColor;
    ctx.globalAlpha = previewAlpha;
    for (const c of gameState.paintCells) {
      ctx.fillRect(c.x * CELL, c.y * CELL, CELL, CELL);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = previewColor;
    ctx.lineWidth = 1.5 / viewState.zoom;
    for (const c of gameState.paintCells) {
      ctx.strokeRect(c.x * CELL + 0.5, c.y * CELL + 0.5, CELL - 1, CELL - 1);
    }
  }
  // --- Hover cell ---
  if (gameState.hoverCell && !gameState.isPainting) {
    const { x, y } = gameState.hoverCell;
    ctx.strokeStyle = '#b03a2e'; ctx.lineWidth = 2 / viewState.zoom;
    ctx.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1);
    // 区域/道路/线路/建筑预览（paint 模式）
    if (gameState.selectedTool === 'paint') {
      let previewColor = null;
      if (gameState.selectedZone) {
        const zt = ZONE_TYPES[gameState.selectedZone];
        const sub = zt.subTypes[gameState.selectedZoneSub] || zt;
        previewColor = sub.color || zt.color;
      } else if (gameState.selectedRoadType) {
        previewColor = ROAD_TYPES[gameState.selectedRoadType].color;
      } else if (gameState.selectedTransitType) {
        previewColor = TRANSIT_TYPES[gameState.selectedTransitType].color;
      } else if (gameState.selectedBuilding) {
        const def = BUILDING_TYPES[gameState.selectedBuilding];
        if (def) previewColor = def.color;
      }
      if (previewColor) { ctx.fillStyle = previewColor; ctx.globalAlpha = 0.4; ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4); ctx.globalAlpha = 1; }
    }
    if (gameState.selectedTool === 'demolish') { ctx.fillStyle = 'rgba(255,59,48,0.3)'; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2); }
  }
  // --- Demolish target highlight (单点删除红色框提示) ---
  if (gameState.demolishTarget && !gameState.isPainting) {
    const dt = gameState.demolishTarget;
    let cells = [];
    if (dt.type === 'zone' && gameState.zones[dt.idx]) {
      cells = gameState.zones[dt.idx].cells;
    } else if (dt.type === 'road' && gameState.roads[dt.idx]) {
      cells = gameState.roads[dt.idx].cells;
    } else if (dt.type === 'transit' && gameState.transits[dt.idx]) {
      cells = gameState.transits[dt.idx].cells;
    } else if (dt.type === 'building') {
      cells = [{ x: dt.cell.x, y: dt.cell.y }];
    }
    ctx.fillStyle = 'rgba(255,59,48,0.2)';
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 2 / viewState.zoom;
    for (const c of cells) {
      ctx.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
      ctx.strokeRect(c.x * CELL + 0.5, c.y * CELL + 0.5, CELL - 1, CELL - 1);
    }
  }
  // --- Subtle grid (only at high zoom) ---
  if (viewState.zoom > 1.5) {
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 0.5 / viewState.zoom;
    for (let x = 0; x <= MAP_W; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, MAP_H * CELL); ctx.stroke(); }
    for (let y = 0; y <= MAP_H; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(MAP_W * CELL, y * CELL); ctx.stroke(); }
  }
  ctx.restore();
  // [v2.3.0] 模组钩子：渲染完成后（可叠加自定义内容）
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('render:after', { canvas, ctx, viewState });
}

// SVG-based building icon paths (normalized to 24x24 viewBox, scaled to CELL)
const BUILDING_SVG_PATHS = {
  lowRes:    { path: 'M12 3L4 9v12h16V9z M9 14h6v3H9z', fill: 'rgba(255,255,255,0.7)', stroke: 'rgba(80,120,80,0.9)' },
  midRes:    { path: 'M4 10h16v11H4z M6 12h4v4H6z M14 12h4v4h-4z M6 18h12v1H6z', fill: 'rgba(255,255,255,0.7)', stroke: 'rgba(70,100,70,0.9)' },
  highRes:   { path: 'M3 21h18z M5 21V10l3-2v13z M10 21V8l4-3v16z M16 21V10l3-2v13z', fill: 'rgba(255,255,255,0.65)', stroke: 'rgba(60,90,60,0.9)' },
  luxuryRes: { path: 'M12 3L3 12h3v9h12v-9h3z M10 14h4v4h-4z', fill: 'rgba(255,245,220,0.7)', stroke: 'rgba(120,100,60,0.9)' },
  lightInd:  { path: 'M3 21V8l9-4 9 4v13z M6 12h4v4H6z M14 12h4v4h-4z', fill: 'rgba(230,230,235,0.7)', stroke: 'rgba(90,100,120,0.9)' },
  heavyInd:  { path: 'M2 21V10l5-3 5 3 5-3 5 3v11z M5 14h3v3H5z M12 14h3v3h-3z M17 14h3v3h-3z M3 19h18v2H3z', fill: 'rgba(200,200,210,0.7)', stroke: 'rgba(60,70,90,0.95)' },
  hazInd:    { path: 'M3 21V9l4-2v14z M17 21V7l4 2v12z M7 21V11h10v10z M10 14h4v3h-4z', fill: 'rgba(255,220,220,0.7)', stroke: 'rgba(180,60,60,0.95)' },
  // v2.4.3b: 矿区图标 — 矿山+矿井架
  mine:      { path: 'M2 21l5-8 4 5 3-4 4 6 4-7 4 8z M10 21V14h4v7z M9 14h6v3H9z', fill: 'rgba(160,130,80,0.75)', stroke: 'rgba(90,70,40,0.95)' },
  streetCom: { path: 'M4 20V8l8-4 8 4v12z M9 12h6v5H9z M6 18h2v2H6z M16 18h2v2h-2z', fill: 'rgba(255,240,200,0.75)', stroke: 'rgba(180,140,40,0.9)' },
  concCom:   { path: 'M4 20V8l8-4 8 4v12z M7 12h4v8H7z M13 12h4v8h-4z', fill: 'rgba(255,235,180,0.75)', stroke: 'rgba(170,130,30,0.9)' },
  mixCom:    { path: 'M3 21V9l5-3 4 2 4-2 5 3v12z M6 13h3v5H6z M15 13h3v5h-3z M10 13h4v5h-4z', fill: 'rgba(255,230,170,0.75)', stroke: 'rgba(160,120,20,0.9)' },
  plazaCom:  { path: 'M3 21V8l9-4 9 4v13z M8 12h8v6H8z M5 18h3v3H5z M16 18h3v3h-3z', fill: 'rgba(255,225,150,0.75)', stroke: 'rgba(150,110,10,0.95)' },
  comStreet: { path: 'M5 20V9l7-3 7 3v11z M9 12h6v4H9z', fill: 'rgba(255,240,200,0.75)', stroke: 'rgba(180,140,40,0.9)' },
  comComplex:{ path: 'M2 21V7l6-3v17z M10 21V4l4-2 8 4 2 15z M12 8h4v3h-4z M12 13h4v3h-4z', fill: 'rgba(255,220,130,0.75)', stroke: 'rgba(140,100,10,0.95)' },
  park:      { path: 'M12 2C8 6 6 10 6 13a6 6 0 0 0 12 0c0-3-2-7-6-11z M10 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', fill: 'rgba(100,180,80,0.8)', stroke: 'rgba(40,100,30,0.9)' },
  school:    { path: 'M3 21V9l9-5 9 5v12z M7 13h4v8H7z M13 13h4v8h-4z M10 7h4v2h-4z', fill: 'rgba(220,240,255,0.75)', stroke: 'rgba(40,80,140,0.9)' },
  hospital:  { path: 'M3 21V8l9-4 9 4v13z M10 10h4v3h-4z M8 12h2v2H8z M14 12h2v2h-2z M10 16h4v3h-4z', fill: 'rgba(255,230,230,0.75)', stroke: 'rgba(180,40,40,0.9)' },
  police:    { path: 'M12 2L3 6v4c0 6 4 10 9 12 5-2 9-6 9-12V6z M10 8h4v3h-4z M9 12h6v2H9z', fill: 'rgba(220,235,255,0.75)', stroke: 'rgba(30,60,120,0.9)' },
  fireStation:{ path: 'M3 21V9l9-5 9 5v12z M9 13h6v8H9z M11 6h2v3h-2z M3 18h6v3H3z M15 18h6v3h-6z', fill: 'rgba(255,230,220,0.75)', stroke: 'rgba(160,40,20,0.9)' },
  powerPlant:{ path: 'M3 21V11l9-6 9 6v10z M7 14h4v4H7z M13 14h4v4h-4z M10 9h4v3h-4z', fill: 'rgba(255,255,200,0.7)', stroke: 'rgba(180,140,20,0.9)' },
  gasPower:  { path: 'M12 2c-3 3-5 6-5 9a5 5 0 0 0 10 0c0-3-2-6-5-9z M10 11a2 2 0 0 0 4 0c0-1-1-2-2-3-1 1-2 2-2 3z', fill: 'rgba(255,200,100,0.7)', stroke: 'rgba(180,100,10,0.9)' },
  cleanEnergy:{ path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2', fill: 'none', stroke: 'rgba(80,160,60,0.9)', sw: 1.5 },
  solarPlant:{ path: 'M3 21h18z M5 21V8l7-4 7 4v13z M9 12h6v4H9z M12 8v4', fill: 'rgba(255,250,180,0.7)', stroke: 'rgba(180,160,20,0.9)' },
  windFarm:  { path: 'M12 21V11z M12 11a4 4 0 1 0-4-4 M8 7l4 4 M12 11l4-4', fill: 'none', stroke: 'rgba(80,160,80,0.9)', sw: 1.2 },
  hydroDam:  { path: 'M2 21V14l10-7 10 7v7z M6 17h4v4H6z M14 17h4v4h-4z M12 10v4', fill: 'rgba(220,230,255,0.7)', stroke: 'rgba(40,60,120,0.9)' },
  nuclearPlant:{ path: 'M3 21V11l9-6 9 6v10z M12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 8v3 M9.5 9.5l2.6 1.5 M14.5 9.5l-2.6 1.5', fill: 'rgba(240,230,255,0.7)', stroke: 'rgba(100,40,140,0.9)' },
  substation:{ path: 'M6 21V8l6-4 6 4v13z M9 21v-6h6v6 M9 12h6 M12 4V2', fill: 'rgba(255,240,210,0.7)', stroke: 'rgba(120,80,20,0.9)' },
  waterPump:{ path: 'M4 21V10a8 8 0 0 1 16 0v11z M8 21v-6a4 4 0 0 1 8 0v6 M8 10a4 4 0 0 1 8 0', fill: 'rgba(210,240,255,0.7)', stroke: 'rgba(30,100,180,0.9)' },
  waterPlant:{ path: 'M3 21V8l9-4 9 4v13z M7 12h4v9H7z M13 12h4v9h-4z', fill: 'rgba(220,240,255,0.7)', stroke: 'rgba(30,80,140,0.9)' },
  waterTower:{ path: 'M8 21V8a4 4 0 0 1 8 0v13z M8 8h8 M6 21h12 M10 14h4v3h-4z', fill: 'rgba(230,245,255,0.7)', stroke: 'rgba(20,70,130,0.9)' },
  reservoir: { path: 'M2 16c4-4 8-4 10 0s6 4 10 0v5H2z M6 10c4-4 8-4 12 0 M9 6c3-3 6-3 9 0', fill: 'rgba(180,220,255,0.7)', stroke: 'rgba(20,80,140,0.9)' },
  desalination:{ path: 'M3 21V9l9-5 9 5v12z M7 12h4v5H7z M13 12h4v5h-4z M10 7l2-2 2 2', fill: 'rgba(220,245,255,0.7)', stroke: 'rgba(20,90,150,0.9)' },
  govBuilding:{ path: 'M3 21V8l9-5 9 5v13z M3 8h18 M12 3l9 5 M12 3L3 8 M8 13h2v8H8z M14 13h2v8h-2z', fill: 'rgba(240,240,250,0.75)', stroke: 'rgba(40,50,80,0.9)' },
  utility:   { path: 'M3 12c3 0 3-3 6-3s3 3 6 3 3-3 6-3 M3 17c3 0 3-3 6-3s3 3 6 3 3-3 6-3', fill: 'none', stroke: 'rgba(80,80,100,0.8)', sw: 1.2 },
  parking:   { path: 'M5 21V3h8a4 4 0 0 1 0 8H7 M5 13h10 M7 21v-3', fill: 'none', stroke: 'rgba(60,80,120,0.85)', sw: 1.2 },
  subwayStation:{ path: 'M5 21V5h14v16z M9 9h6v3H9z M9 15h6v3H9z M3 12h2 M19 12h2', fill: 'rgba(230,240,255,0.7)', stroke: 'rgba(30,80,160,0.9)' },
  subwayLine:{ path: 'M3 12h18 M6 12a3 3 0 1 0 6 0 M12 12a3 3 0 1 0 6 0', fill: 'none', stroke: 'rgba(30,100,180,0.8)', sw: 1.5 },
  elevatedRoad:{ path: 'M2 10h20 M4 10v8 M8 10v8 M12 10v8 M16 10v8 M20 10v8 M2 14h20', fill: 'none', stroke: 'rgba(160,170,190,0.7)', sw: 1.2 },
  elevatedRail:{ path: 'M2 12h20 M4 12l-1 8 M8 12l-1 8 M12 12l-1 8 M16 12l-1 8 M20 12l-1 8', fill: 'none', stroke: 'rgba(140,150,170,0.7)', sw: 1.2 },
  airFilter: { path: 'M3 8c3 0 3 3 6 3s3-3 6-3 3 3 6 3 M3 13c3 0 3 3 6 3s3-3 6-3 3 3 6 3 M3 18c3 0 3 3 6 3s3-3 6-3 3 3 6 3', fill: 'none', stroke: 'rgba(40,130,70,0.9)', sw: 1.3 },
  sewagePlant:{ path: 'M3 21V9l9-5 9 5v12z M7 12h4v9H7z M13 12h4v9h-4z M10 7h4', fill: 'rgba(220,240,255,0.7)', stroke: 'rgba(20,80,140,0.9)' },
  ecoWetland:{ path: 'M12 21c-4-6-6-9-6-12a6 6 0 0 1 12 0c0 3-2 6-6 12z M12 6a3 3 0 0 0-3 3 M10 9a2 2 0 0 0 4 0', fill: 'rgba(60,140,70,0.7)', stroke: 'rgba(30,90,40,0.9)' },
  noiseBarrier:{ path: 'M2 21V8l4-3v16z M6 21V5l4-3v19z M10 21V7l4-3v17z M14 21V9l4-3v15z M18 21V11l4-3v13z', fill: 'rgba(180,190,200,0.6)', stroke: 'rgba(60,70,90,0.9)' },
  wastePlant:{ path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M8 12l3 3 5-5', fill: 'none', stroke: 'rgba(60,120,40,0.9)', sw: 1.5 },
};

function drawBuildingIcon(ctx, type, px, py) {
  const svg = BUILDING_SVG_PATHS[type];
  if (!svg) {
    // Fallback: simple square
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(px + 3, py + 3, CELL - 6, CELL - 6);
    ctx.restore();
    return;
  }
  ctx.save();
  const scale = CELL / 24;
  ctx.translate(px, py);
  ctx.scale(scale, scale);
  ctx.lineWidth = (svg.sw || 1.0) / scale;
  if (svg.fill && svg.fill !== 'none') { ctx.fillStyle = svg.fill; }
  if (svg.stroke) { ctx.strokeStyle = svg.stroke; }
  // Parse and draw SVG path
  drawSVGPath(ctx, svg.path);
  if (svg.fill && svg.fill !== 'none') ctx.fill();
  if (svg.stroke) ctx.stroke();
  ctx.restore();
}

// Simple SVG path parser for basic M/L/H/V/Z commands
function drawSVGPath(ctx, pathStr) {
  const commands = pathStr.match(/[MLHVCQZSTmlhvcqzst][^MLHVCQZSTmlhvcqzst]*/g) || [];
  ctx.beginPath();
  let cx = 0, cy = 0;
  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd.slice(1).trim().split(/[\s,]+/).filter(s => s.length > 0).map(Number);
    switch(type) {
      case 'M': cx = args[0]; cy = args[1]; ctx.moveTo(cx, cy); break;
      case 'm': cx += args[0]; cy += args[1]; ctx.moveTo(cx, cy); break;
      case 'L': for (let i = 0; i < args.length; i += 2) { cx = args[i]; cy = args[i+1]; ctx.lineTo(cx, cy); } break;
      case 'l': for (let i = 0; i < args.length; i += 2) { cx += args[i]; cy += args[i+1]; ctx.lineTo(cx, cy); } break;
      case 'H': cx = args[0]; ctx.lineTo(cx, cy); break;
      case 'h': cx += args[0]; ctx.lineTo(cx, cy); break;
      case 'V': cy = args[0]; ctx.lineTo(cx, cy); break;
      case 'v': cy += args[0]; ctx.lineTo(cx, cy); break;
      case 'C': for (let i = 0; i < args.length; i += 6) { ctx.bezierCurveTo(args[i], args[i+1], args[i+2], args[i+3], args[i+4], args[i+5]); cx = args[i+4]; cy = args[i+5]; } break;
      case 'c': for (let i = 0; i < args.length; i += 6) { ctx.bezierCurveTo(cx+args[i], cy+args[i+1], cx+args[i+2], cy+args[i+3], cx+args[i+4], cy+args[i+5]); cx += args[i+4]; cy += args[i+5]; } break;
      case 'Q': for (let i = 0; i < args.length; i += 4) { ctx.quadraticCurveTo(args[i], args[i+1], args[i+2], args[i+3]); cx = args[i+2]; cy = args[i+3]; } break;
      case 'q': for (let i = 0; i < args.length; i += 4) { ctx.quadraticCurveTo(cx+args[i], cy+args[i+1], cx+args[i+2], cy+args[i+3]); cx += args[i+2]; cy += args[i+3]; } break;
      case 'S': for (let i = 0; i < args.length; i += 4) { ctx.bezierCurveTo(cx, cy, args[i], args[i+1], args[i+2], args[i+3]); cx = args[i+2]; cy = args[i+3]; } break;
      case 'T': for (let i = 0; i < args.length; i += 2) { ctx.quadraticCurveTo(cx, cy, args[i], args[i+1]); cx = args[i]; cy = args[i+1]; } break;
      case 'Z': case 'z': ctx.closePath(); break;
    }
  }
}

// [v2.3.0c] 计算同类地块合并组 — 保留锯齿状边缘
// 将相邻的同 type+subType 区域合并成若干连通组，每组返回所有格子集合
// 渲染时：填充所有格子（无内部边框），仅在组边界描边，保留锯齿轮廓
// 返回 Map<groupKey, { zoneCellMap: Map<zone, Set<cellKey>>, allCells: Set<cellKey> }>
function computeMergedZoneRects(zones) {
  const groups = new Map(); // groupKey -> [{zone, cells}]
  for (const zone of zones) {
    const key = zone.type + ':' + zone.subType;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(zone);
  }
  const result = new Map();
  for (const [key, zoneList] of groups) {
    // 用并查集合并相邻的 zone
    const parent = zoneList.map((_, i) => i);
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    // 预计算每个 zone 的格子集合
    const cellSets = zoneList.map(z => new Set(z.cells.map(c => c.x + ',' + c.y)));
    // 两两检查是否相邻（任意格曼哈顿距离<=1）
    for (let i = 0; i < zoneList.length; i++) {
      for (let j = i + 1; j < zoneList.length; j++) {
        if (find(i) === find(j)) continue;
        let adjacent = false;
        for (const c of zoneList[i].cells) {
          const k1 = (c.x + 1) + ',' + c.y, k2 = (c.x - 1) + ',' + c.y;
          const k3 = c.x + ',' + (c.y + 1), k4 = c.x + ',' + (c.y - 1);
          if (cellSets[j].has(k1) || cellSets[j].has(k2) || cellSets[j].has(k3) || cellSets[j].has(k4)) {
            adjacent = true; break;
          }
        }
        if (adjacent) union(i, j);
      }
    }
    // 按组聚合
    const zoneCellMap = new Map();
    const groupMap = new Map(); // root -> { zones, cellSet }
    for (let i = 0; i < zoneList.length; i++) {
      const r = find(i);
      if (!groupMap.has(r)) groupMap.set(r, { zones: [], cellSet: new Set() });
      const g = groupMap.get(r);
      g.zones.push(zoneList[i]);
      for (const c of zoneList[i].cells) g.cellSet.add(c.x + ',' + c.y);
    }
    // 为每个 zone 记录其所属组的 cellSet（用于边界判定）
    for (const [, g] of groupMap) {
      for (const z of g.zones) zoneCellMap.set(z, g.cellSet);
    }
    result.set(key, { zoneCellMap });
  }
  return result;
}

// [v2.3.0d] 计算同类相邻建筑合并组 — 用于合并模式渲染（农田、沿街商业等）
// 将相邻的同 type 地面建筑合并成若干连通组，每组返回所有格子集合
// 渲染时：填充所有格子（无内部间隙），仅在组边界描边，保留锯齿轮廓
// 返回 Map<buildingRef, { type, cells: Set<cellKey> }>
function computeMergedBuildings(buildings) {
  const result = new Map();
  if (!buildings || buildings.length === 0) return result;

  // 仅合并地面层、非在建、非线路/站点/配套/道路建筑
  const SKIP_TYPES = new Set(['road', 'subwayLine', 'lightRail', 'elevatedRail', 'elevatedRoad', 'utility', 'subwayStation', 'lightRailStation', 'railwayLine', 'hsrLine', 'railwayStation', 'hsrStation']);
  const filtered = buildings.filter(b =>
    b && !b.underConstruction &&
    !SKIP_TYPES.has(b.type) &&
    !(typeof b.type === 'string' && b.type.endsWith('_fac')) &&
    BUILDING_TYPES[b.type]
  );
  if (filtered.length === 0) return result;

  // 按 type 分组：type -> Map<cellKey, building>
  const typeCellMap = new Map();
  for (const b of filtered) {
    if (!typeCellMap.has(b.type)) typeCellMap.set(b.type, new Map());
    typeCellMap.get(b.type).set(b.x + ',' + b.y, b);
  }

  // 对每种 type 单独做并查集（仅同类型相邻才合并）
  for (const [type, cellMap] of typeCellMap) {
    const cellKeys = [...cellMap.keys()];
    const idx = new Map();
    cellKeys.forEach((ck, i) => idx.set(ck, i));
    const parent = cellKeys.map((_, i) => i);
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

    // 检查四邻是否同类型
    for (const ck of cellKeys) {
      const sp = ck.split(',');
      const x = +sp[0], y = +sp[1];
      const neighbors = [(x + 1) + ',' + y, (x - 1) + ',' + y, x + ',' + (y + 1), x + ',' + (y - 1)];
      for (const nk of neighbors) {
        const ni = idx.get(nk);
        if (ni !== undefined) union(idx.get(ck), ni);
      }
    }

    // 按 root 聚合
    const groupMap = new Map();
    for (let i = 0; i < cellKeys.length; i++) {
      const r = find(i);
      if (!groupMap.has(r)) groupMap.set(r, new Set());
      groupMap.get(r).add(cellKeys[i]);
    }

    // 为每个 building 记录其所属组的 cellSet（用于边界判定）
    for (const [, groupCells] of groupMap) {
      for (const ck of groupCells) {
        const b = cellMap.get(ck);
        if (b) result.set(b, { type, cells: groupCells });
      }
    }
  }

  return result;
}

