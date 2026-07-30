/* 源自《置身事内》单文件版 - 输入处理 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 输入处理 ==============
const PAN_THRESHOLD = 5;

function handleMapAction(cellX, cellY) {
  if (gameState.gameOver) return;
  if (cellX < 0 || cellX >= MAP_W || cellY < 0 || cellY >= MAP_H) return;
  const idx = cellY * MAP_W + cellX;
  const cell = mapCells[idx];
  if (!cell) return;
  if (gameState.selectedTool === 'inspect') { showCellInfo(cell, cellX, cellY); return; }
  if (gameState.selectedTool === 'placeBranch') { commitBranch(idx); return; }
  if (gameState.selectedTool === 'placeFacility') { commitFacility(idx); return; }
  if (gameState.selectedTool === 'demolish') {
    if (gameState.demolishMode === 'partial') { demolishPartial(idx); return; }
    demolishBuilding(idx); return;
  }
  if (gameState.selectedTool === 'paint') {
    // For fill mode, handle on tap; for other modes, painting starts on drag
    if (gameState.brushMode === 'fill') {
      const cells = floodFillCells(cellX, cellY);
      if (cells.length > 0) commitPaint(cells);
    } else {
      startPaint(cellX, cellY);
    }
    return;
  }
  if (gameState.selectedTool === 'build' && gameState.selectedBuilding) placeBuilding(idx, gameState.selectedBuilding);
}

function handleMouseDown(e) {
  if (gameState.gameOver) return;
  e.preventDefault();
  if (gameState.selectedTool === 'paint') {
    const cv = screenToCanvas(e.clientX, e.clientY);
    const mc = canvasToMapCoords(cv.x, cv.y);
    startPaint(mc.x, mc.y);
    return;
  }
  // Demolish modes: partial (brush), rect (drag-select), whole (click)
  if (gameState.selectedTool === 'demolish') {
    if (gameState.demolishMode === 'partial') {
      gameState.isDemolishBrushing = true;
      const cv = screenToCanvas(e.clientX, e.clientY);
      const mc = canvasToMapCoords(cv.x, cv.y);
      handleMapAction(mc.x, mc.y);
      return;
    }
    if (gameState.demolishMode === 'rect') {
      // 完全复用 paint rect 机制：用 startPaint 启动拖拽
      gameState._demolishPaintMode = true;  // 标记为拆除模式
      const cv = screenToCanvas(e.clientX, e.clientY);
      const mc = canvasToMapCoords(cv.x, cv.y);
      startPaint(mc.x, mc.y);
      return;
    }
    // whole mode: falls through to panning, click handled in mouseup
  }
  panState.isPanning = true;
  panState.hasMoved = false;
  panState.startX = e.clientX;
  panState.startY = e.clientY;
  panState.startOffsetX = viewState.offsetX;
  panState.startOffsetY = viewState.offsetY;
  if (canvas) canvas.classList.add('panning');
}

function handleMouseMove(e) {
  if (!canvas) return;
  if (gameState.isPainting) {
    const cv = screenToCanvas(e.clientX, e.clientY);
    const mc = canvasToMapCoords(cv.x, cv.y);
    updatePaint(mc.x, mc.y);
    return;
  }
  // Partial demolish brush
  if (gameState.isDemolishBrushing) {
    const cv = screenToCanvas(e.clientX, e.clientY);
    const mc = canvasToMapCoords(cv.x, cv.y);
    if (mc.x >= 0 && mc.x < MAP_W && mc.y >= 0 && mc.y < MAP_H) {
      handleMapAction(mc.x, mc.y);
    }
    return;
  }
  if (panState.isPanning) {
    const dx = e.clientX - panState.startX;
    const dy = e.clientY - panState.startY;
    if (Math.abs(dx) > PAN_THRESHOLD || Math.abs(dy) > PAN_THRESHOLD) {
      panState.hasMoved = true;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      viewState.offsetX = panState.startOffsetX + dx * scaleX;
      viewState.offsetY = panState.startOffsetY + dy * scaleY;
      clampView();
      renderMap();
    }
    return;
  }
  updateHover(e.clientX, e.clientY);
}

function handleMouseUp(e) {
  if (canvas) canvas.classList.remove('panning');
  if (gameState.isPainting) {
    if (gameState._demolishPaintMode) {
      // 拆除框选提交
      gameState._demolishPaintMode = false;
      endDemolishPaint();
    } else {
      endPaint();
    }
    return;
  }
  if (gameState.isDemolishBrushing) {
    gameState.isDemolishBrushing = false;
    return;
  }
  if (!panState.isPanning) return;
  panState.isPanning = false;
  if (!panState.hasMoved) {
    const cv = screenToCanvas(e.clientX, e.clientY);
    const mc = canvasToMapCoords(cv.x, cv.y);
    handleMapAction(mc.x, mc.y);
  }
}

function updateHover(clientX, clientY) {
  if (!canvas) return;
  const cv = screenToCanvas(clientX, clientY);
  const mc = canvasToMapCoords(cv.x, cv.y);
  if (mc.x < 0 || mc.x >= MAP_W || mc.y < 0 || mc.y >= MAP_H) {
    gameState.hoverCell = null;
    renderMap();
    return;
  }
  gameState.hoverCell = { x: mc.x, y: mc.y };
  renderMap();
}

function handleWheel(e) {
  e.preventDefault();
  const cv = screenToCanvas(e.clientX, e.clientY);
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  zoomAtPoint(cv.x, cv.y, factor);
}

function handleTouchStart(e) {
  if (gameState.gameOver) return;
  e.preventDefault();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    if (gameState.selectedTool === 'paint' && gameState.brushMode !== 'fill') {
      const cv = screenToCanvas(t.clientX, t.clientY);
      const mc = canvasToMapCoords(cv.x, cv.y);
      startPaint(mc.x, mc.y);
    } else if (gameState.selectedTool === 'demolish' && gameState.demolishMode === 'partial') {
      gameState.isDemolishBrushing = true;
      const cv = screenToCanvas(t.clientX, t.clientY);
      const mc = canvasToMapCoords(cv.x, cv.y);
      handleMapAction(mc.x, mc.y);
    } else if (gameState.selectedTool === 'demolish' && gameState.demolishMode === 'rect') {
      // 复用 paint rect 机制
      gameState._demolishPaintMode = true;
      const cv = screenToCanvas(t.clientX, t.clientY);
      const mc = canvasToMapCoords(cv.x, cv.y);
      startPaint(mc.x, mc.y);
    } else {
      panState.isPanning = true;
      panState.hasMoved = false;
      panState.startX = t.clientX;
      panState.startY = t.clientY;
      panState.startOffsetX = viewState.offsetX;
      panState.startOffsetY = viewState.offsetY;
    }
  } else if (e.touches.length === 2) {
    // Two fingers always pinch-zoom, cancel any painting
    if (gameState.isPainting) { gameState.isPainting = false; gameState.paintCells = []; renderMap(); }
    gameState.isDemolishBrushing = false;
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const midX = (t1.clientX + t2.clientX) / 2;
    const midY = (t1.clientY + t2.clientY) / 2;
    pinchState = { dist, zoom: viewState.zoom, midX, midY };
    panState.isPanning = false;
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 2 && pinchState) {
    const t1 = e.touches[0], t2 = e.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const midX = (t1.clientX + t2.clientX) / 2;
    const midY = (t1.clientY + t2.clientY) / 2;
    const cv = screenToCanvas(midX, midY);
    const factor = dist / pinchState.dist;
    const newZoom = Math.max(0.2, Math.min(pinchState.zoom * factor, 8));
    const actualFactor = newZoom / viewState.zoom;
    viewState.offsetX = cv.x - (cv.x - viewState.offsetX) * actualFactor;
    viewState.offsetY = cv.y - (cv.y - viewState.offsetY) * actualFactor;
    viewState.zoom = newZoom;
    const dx = midX - pinchState.midX;
    const dy = midY - pinchState.midY;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    viewState.offsetX += dx * scaleX;
    viewState.offsetY += dy * scaleY;
    pinchState.dist = dist;
    pinchState.midX = midX;
    pinchState.midY = midY;
    clampView();
    renderMap();
  } else if (e.touches.length === 1 && gameState.isPainting) {
    const t = e.touches[0];
    const cv = screenToCanvas(t.clientX, t.clientY);
    const mc = canvasToMapCoords(cv.x, cv.y);
    updatePaint(mc.x, mc.y);
  } else if (e.touches.length === 1 && gameState.isDemolishBrushing) {
    const t = e.touches[0];
    const cv = screenToCanvas(t.clientX, t.clientY);
    const mc = canvasToMapCoords(cv.x, cv.y);
    if (mc.x >= 0 && mc.x < MAP_W && mc.y >= 0 && mc.y < MAP_H) {
      handleMapAction(mc.x, mc.y);
    }
  } else if (e.touches.length === 1 && panState.isPanning) {
    const t = e.touches[0];
    const dx = t.clientX - panState.startX;
    const dy = t.clientY - panState.startY;
    if (Math.abs(dx) > PAN_THRESHOLD || Math.abs(dy) > PAN_THRESHOLD) {
      panState.hasMoved = true;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      viewState.offsetX = panState.startOffsetX + dx * scaleX;
      viewState.offsetY = panState.startOffsetY + dy * scaleY;
      clampView();
      renderMap();
    } else {
      updateHover(t.clientX, t.clientY);
    }
  }
}

function handleTouchEnd(e) {
  if (gameState.isPainting) {
    if (gameState._demolishPaintMode) {
      gameState._demolishPaintMode = false;
      endDemolishPaint();
    } else {
      endPaint();
    }
    panState.isPanning = false;
    if (e.touches.length < 2) pinchState = null;
    return;
  }
  if (gameState.isDemolishBrushing) {
    gameState.isDemolishBrushing = false;
    if (e.touches.length < 2) pinchState = null;
    return;
  }
  if (panState.isPanning && !panState.hasMoved && e.changedTouches.length > 0) {
    const t = e.changedTouches[0];
    const cv = screenToCanvas(t.clientX, t.clientY);
    const mc = canvasToMapCoords(cv.x, cv.y);
    handleMapAction(mc.x, mc.y);
  }
  panState.isPanning = false;
  if (e.touches.length < 2) pinchState = null;
}

function handleCanvasLeave() {
  gameState.hoverCell = null;
  panState.isPanning = false;
  gameState.isDemolishBrushing = false;
  gameState._demolishPaintMode = false;
  if (canvas) canvas.classList.remove('panning');
  // Cancel painting when leaving canvas
  if (gameState.isPainting) {
    gameState.isPainting = false;
    gameState.paintCells = [];
    gameState.paintStartCell = null;
    renderMap();
  }
}

