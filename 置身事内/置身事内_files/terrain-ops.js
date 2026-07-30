/* 源自《置身事内》单文件版 - 地形操作 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 地形操作 ==============
function regenerateMap() {
  if (gameState.buildings.length > 0) {
    showModal('确认', '<p>重新生成地形将清除所有已建造的建筑，确定继续吗？</p>', [
      { text: '取消', color: 'gray', action: closeModal },
      { text: '确认', color: 'red', action: () => { closeModal(); doRegenerateMap(); } },
    ], '地形', 'warn');
  } else doRegenerateMap();
}

function doRegenerateMap() {
  gameState.mapSeed = randomInt(1, 999999);
  gameState.buildings = [];
  gameState.buildingCount = 0;
  mapCells = generateTerrain(gameState.mapSeed);
  contourSegments = generateContours(mapCells);
  renderTerrainToOffscreen();
  generateStarterCity();
  renderMap();
  updateUI();
  showNotification('新城市地形已生成', 'success');
  logEvent('重新生成城市地形', 'info');
}

