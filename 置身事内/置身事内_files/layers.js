/* 源自《置身事内》单文件版 - 图层管理 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 图层管理 ==============
function toggleLayer(layer) {
  gameState.activeLayers[layer] = !gameState.activeLayers[layer];
  // v2.2.4c: 刷新图层弹窗内容（复用 fab-sheet.js 中的 _renderLayersPopupContent）
  const popup = document.getElementById('layers-popup');
  if (popup && popup.classList.contains('active')) {
    if (typeof _renderLayersPopupContent === 'function') {
      popup.innerHTML = _renderLayersPopupContent();
    }
  }
  renderMap();
}

// [v2.3.0] 切换同类地块合并显示模式
function toggleMergeZones() {
  gameState.mergeZones = !gameState.mergeZones;
  const popup = document.getElementById('layers-popup');
  if (popup && popup.classList.contains('active')) {
    if (typeof _renderLayersPopupContent === 'function') {
      popup.innerHTML = _renderLayersPopupContent();
    }
  }
  renderMap();
}
