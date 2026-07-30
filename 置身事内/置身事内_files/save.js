/* 源自《置身事内》单文件版 - 存档系统 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 存档系统 ==============
function getSaveData() {
  return {
    state: { ...gameState, hoverCell: null, pendingEvent: null, isPainting: false, paintCells: [], paintStartCell: null },
    map: mapCells.map(c => ({ e: c.elevation, w: c.isWater ? 1 : 0, t: c.terrain, r: c.river ? 1 : 0 })),
    rivers: riverPaths,
    contours: contourSegments,
    mapW: MAP_W, mapH: MAP_H, // v2.4.6: 保存地图尺寸（新区扩展后需记录）
    timestamp: Date.now(),
    version: '2.4.7',
  };
}

// 静默自动存档（不弹通知、不刷新存档界面）
function autoSave() {
  try {
    const data = getSaveData();
    // 轮换使用两个自动存档槽
    const slot = gameState.turn % 2 === 0 ? 'auto1' : 'auto2';
    localStorage.setItem('cityPlanner_save_' + slot, JSON.stringify(data));
  } catch(e) { /* 静默失败 */ }
}

function getAutoSaveInfo() {
  const slots = [];
  for (const slot of ['auto1', 'auto2']) {
    try {
      const raw = localStorage.getItem('cityPlanner_save_' + slot);
      if (raw) {
        const data = JSON.parse(raw);
        slots.push({
          slot, name: data.state ? `${data.state.playerName}·${data.state.cityName}` : '自动存档',
          detail: data.state ? `${data.state.year}年${data.state.month}月 · 第${data.state.turn}月` : '',
          date: new Date(data.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch(e) {}
  }
  return slots;
}

function saveGame(slot) {
  try {
    // v2.4.4: 模组钩子 — 存档前
    if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('save:before', { slot, gameState });
    const data = getSaveData();
    localStorage.setItem('cityPlanner_save_' + slot, JSON.stringify(data));
    // v2.4.4: 模组钩子 — 存档后
    if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('save:after', { slot, gameState });
    showNotification(`已保存到存档位 ${slot}`, 'success');
    showSaveScreen(saveMode);
  } catch(e) { showNotification('保存失败：' + e.message, 'danger'); }
}

function loadGame(slot) {
  try {
    const raw = localStorage.getItem('cityPlanner_save_' + slot);
    if (!raw) { showNotification('存档不存在', 'warn'); return; }
    const data = JSON.parse(raw);
    // v2.4.4: 模组钩子 — 读档前
    if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('load:before', { slot, data });
    Object.assign(gameState, data.state);
    // v2.2.3: 旧存档兼容，默认启用所有已加载模组
    if (!gameState.enabledMods) {
      gameState.enabledMods = ModLoader.loaded.map(m => m.id);
    }
    // v2.2.4: 旧存档兼容，补充派系和车流状态
    if (!gameState.playerFaction) {
      gameState.playerFaction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
    }
    if (!gameState.mapFaction) {
      gameState.mapFaction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
    }
    if (!gameState.trafficStats) {
      gameState.trafficStats = { congestionLevel: 0, congestedCells: [], avgSpeed: 1.0 };
    }
    // v2.2.4c: 旧存档兼容，补充车流层模式
    if (!gameState.trafficLayerMode) gameState.trafficLayerMode = 'congestion';
    // v2.2.5c: 旧存档兼容，补充公共交通政策
    if (!gameState.policies) gameState.policies = {};
    if (gameState.policies.transitFare === undefined) gameState.policies.transitFare = 1;
    if (gameState.policies.transitInterval === undefined) gameState.policies.transitInterval = 5;
    if (gameState.policies.transitSubsidy === undefined) gameState.policies.transitSubsidy = 0;
    // v2.3.5: 旧存档兼容，补充企业系统字段
    if (!gameState.enterprises) gameState.enterprises = [];
    if (!gameState.enterpriseFacilities) gameState.enterpriseFacilities = [];
    if (!gameState.personalCompanies) gameState.personalCompanies = [];
    // v2.2.4b: 旧存档兼容，补充车流图层
    if (!gameState.activeLayers) gameState.activeLayers = { ground: true, underground: true, subway: true, elevated: true, traffic: false };
    if (gameState.activeLayers.traffic === undefined) gameState.activeLayers.traffic = false;
    if (!gameState.skyscrapers) gameState.skyscrapers = [];
    if (!gameState.zones) gameState.zones = [];
    if (!gameState.roads) gameState.roads = [];
    if (!gameState.transits) gameState.transits = [];
    if (!gameState.personnel) gameState.personnel = null;
    if (!gameState.brushMode) gameState.brushMode = 'free';
    if (gameState.generousFinance === undefined) gameState.generousFinance = false;
    if (gameState.generousFinanceLocked === undefined) gameState.generousFinanceLocked = false;
    if (gameState.endlessMode === undefined) gameState.endlessMode = false;
    if (gameState.subwayApproved === undefined) gameState.subwayApproved = false;
    if (gameState.lightRailApproved === undefined) gameState.lightRailApproved = false; // v2.2.6
    if (gameState.universityApproved === undefined) gameState.universityApproved = false;
    if (gameState.playerDegree === undefined) gameState.playerDegree = null;
    if (gameState.degreeFake === undefined) gameState.degreeFake = false;
    if (gameState.partySchoolCooldown === undefined) gameState.partySchoolCooldown = 0;
    if (gameState.cityLevelId === undefined) gameState.cityLevelId = 0;
    if (gameState.termTurn === undefined) gameState.termTurn = 0;
    if (gameState.termEnd === undefined || gameState.termEnd < 60) gameState.termEnd = 60; // v2.3.6: 5年任期
    if (gameState.deputyPosition === undefined) gameState.deputyPosition = null; // v2.3.6: 副职
    if (gameState.noPromotionUntil === undefined) gameState.noPromotionUntil = 0; // v2.3.6c: 处分期不能提拔
    // v2.4.6: 行政区划申报系统初始化
    if (!gameState.cityStatus) gameState.cityStatus = { isCountyCity: false, isSeparatelyPlanned: false, hasNationalNewArea: false, newAreaExpanded: false };
    if (gameState.fiscalRemitRate === undefined) gameState.fiscalRemitRate = 1.0;
    if (gameState.fiscalSupportMonthly === undefined) gameState.fiscalSupportMonthly = 0;
    // v2.4.6b: 城市荣誉系统初始化
    if (!gameState.cityHonors) gameState.cityHonors = { civilizedCity: false, sanitaryCity: false, civilizedApplying: false, sanitaryApplying: false, civilizedReviewTurn: 0, sanitaryReviewTurn: 0 };
    // v2.4.7: 机场建设审批初始化
    if (gameState.airportApproved === undefined) gameState.airportApproved = false;
    if (gameState.inspectionLockdown === undefined) gameState.inspectionLockdown = 0; // v2.3.7: 提级巡视锁定
    if (gameState.committee === undefined) gameState.committee = null; // v2.4.1: 常务委员会
    if (gameState.committeeUnity === undefined) gameState.committeeUnity = 50; // v2.4.1: 班子团结度
    if (gameState._lastYearRating === undefined) gameState._lastYearRating = null; // v2.4.1c: 去年城市评分
    if (!gameState.promotionHistory) gameState.promotionHistory = [];
    if (gameState.regionTermTurn === undefined) gameState.regionTermTurn = 0;
    if (gameState.careerStartTurn === undefined) gameState.careerStartTurn = 0;
    if (gameState.maxCareerYears === undefined) gameState.maxCareerYears = 0;
    if (gameState.retirementAge === undefined) gameState.retirementAge = 60;
    if (!gameState.pendingEvents) gameState.pendingEvents = [];
    if (!gameState.achievements) gameState.achievements = [];
    if (!gameState.achievementStats) gameState.achievementStats = {
      totalBribes: 0, totalCorruptionActions: 0, maxTreasury: 0, minHappiness: 55,
      monthsHappy80: 0, monthsCorrupt0: 0, totalBuildingsBuilt: 0, totalMoneySpent: 0,
      eventsResolved: 0, promotions: 0, demotions: 0, monthsLowAir: 0, maxDebt: 0,
      moneyOnBribes: 0, buildingsDemolished: 0, consecutivePromotions: 0,
    };
    if (gameState.policies.housingSubsidy === undefined) {
      Object.assign(gameState.policies, { housingSubsidy: 0, bizSubsidy: 0, interestRate: 3, bankReserve: 12, greenBond: 0, consumerVoucher: 0, talentIncentive: 0, mortgageRate: 4 });
    }
    // v2.4.3: 资源政策初始化
    if (gameState.policies.miningIntensity === undefined) gameState.policies.miningIntensity = 1.0;
    if (gameState.policies.transformationFunding === undefined) gameState.policies.transformationFunding = 1.0;
    if (gameState.policies.envRestoration === undefined) gameState.policies.envRestoration = 0;
    // v3.2.4: Initialize construction projects and loans
    if (!gameState.constructionProjects) gameState.constructionProjects = [];
    if (!gameState.loans) gameState.loans = [];
    // v3.3: Initialize underworld system
    if (!gameState.underworld) gameState.underworld = { thugs: 0, crimeRate: 5, crackdownLevel: 0, thugMonthlyCost: 0, thugActionsUsed: 0, crackdownsDone: 0 };
    // v2.3.0: Initialize privateAssets (旧存档无此字段，缺失会导致 achievements/fab-sheet 崩溃)
    if (!gameState.privateAssets) gameState.privateAssets = {
      stocks: [], land: [], projects: [], villas: [],
      totalGained: 0, totalLost: 0
    };
    if (gameState.privateTotalGained === undefined) gameState.privateTotalGained = 0;
    // v3.3: Initialize petition tracking
    if (gameState.achievementStats && gameState.achievementStats.petitionsResolved === undefined) gameState.achievementStats.petitionsResolved = 0;
    if (gameState.externalPower === undefined) gameState.externalPower = 0;
    if (gameState.deficitMonths === undefined) gameState.deficitMonths = 0;
    if (gameState.povertyStatus === undefined) gameState.povertyStatus = 'normal';
    if (gameState.povertyGrantReceived === undefined) gameState.povertyGrantReceived = false;
    if (gameState.postGrantDeficitMonths === undefined) gameState.postGrantDeficitMonths = 0;
    if (gameState.alleviationMonths === undefined) gameState.alleviationMonths = 0;
    // v2.4.3: 资源枯竭型城市机制 — 旧存档兼容
    if (gameState.isResourceCity === undefined) gameState.isResourceCity = false;
    if (!gameState.mineralZones) gameState.mineralZones = [];
    if (gameState.resourceDependency === undefined) gameState.resourceDependency = 0;
    if (gameState.resourceDepleted === undefined) gameState.resourceDepleted = false;
    if (gameState.resourceDepletionMonths === undefined) gameState.resourceDepletionMonths = 0;
    if (gameState.transformationProject === undefined) gameState.transformationProject = null;
    if (gameState.transformationBonus === undefined) gameState.transformationBonus = null;
    if (gameState._noTransformWarningMonths === undefined) gameState._noTransformWarningMonths = 0;
    if (gameState._cashOutUsed === undefined) gameState._cashOutUsed = false;
    if (gameState._transformationEventShown === undefined) gameState._transformationEventShown = false;
    if (gameState._prospectingCooldown === undefined) gameState._prospectingCooldown = false;
    if (!gameState.personnelSummary) gameState.personnelSummary = null;
    if (!gameState.eventLog) gameState.eventLog = [];
    if (!gameState.personalEvents) gameState.personalEvents = [];
    if (!gameState.personalEventCooldowns) gameState.personalEventCooldowns = {};
    if (!gameState.eventCooldowns) gameState.eventCooldowns = {};
    // v2.2.0 农业系统字段兜底（旧存档无 agriStats）
    if (!gameState.agriStats) {
      gameState.agriStats = {
        primaryGdp: 0, secondaryGdp: 0, tertiaryGdp: 0, otherGdp: 0,
        primaryRatio: 0, secondaryRatio: 0, tertiaryRatio: 0,
        agriJobs: 0, totalJobs: 0, urbanizationRatio: 0, urbanizationLevelId: 0,
        farmlandArea: 0, buildableArea: 0, farmlandRedline: 0, farmlandRedlineRatio: 0.30,
        belowRedlineMonths: 0, redlinePenaltyTriggered: [],
      };
    } else {
      if (!gameState.agriStats.redlinePenaltyTriggered) gameState.agriStats.redlinePenaltyTriggered = [];
      if (gameState.agriStats.farmlandRedlineRatio === undefined) gameState.agriStats.farmlandRedlineRatio = 0.30;
      // v2.4.3: 第二产业明细字段兜底
      if (gameState.agriStats.miningGdp === undefined) gameState.agriStats.miningGdp = 0;
      if (gameState.agriStats.manufacturingGdp === undefined) gameState.agriStats.manufacturingGdp = 0;
      if (gameState.agriStats.miningRatio === undefined) gameState.agriStats.miningRatio = 0;
      if (gameState.agriStats.manufacturingRatio === undefined) gameState.agriStats.manufacturingRatio = 0;
    }
    if (gameState.achievementStats) {
      if (gameState.achievementStats.farmlandCellsBuilt === undefined) gameState.achievementStats.farmlandCellsBuilt = 0;
      if (gameState.achievementStats.agriCellsBuilt === undefined) gameState.achievementStats.agriCellsBuilt = 0;
      if (gameState.achievementStats.redlineViolations === undefined) gameState.achievementStats.redlineViolations = 0;
      if (gameState.achievementStats.maxUrbanizationRatio === undefined) gameState.achievementStats.maxUrbanizationRatio = 0;
      if (gameState.achievementStats.redlineGuardMonths === undefined) gameState.achievementStats.redlineGuardMonths = 0;
    }
    // Mark buildings from old saves as not under construction
    if (gameState.buildings) {
      for (const b of gameState.buildings) {
        if (b.underConstruction === undefined) b.underConstruction = false;
      }
      // v1.3.0.2 backward compat: convert old 'school' type to 'elementarySchool'
      for (const b of gameState.buildings) {
        if (b.type === 'school') {
          b.type = 'elementarySchool';
          if (b.customName) b.customName = b.customName.replace(/中学（总校）/, '小学').replace(/初级中学/, '小学').replace(/高级中学/, '小学');
        }
      }
      // v1.3.0.0 backward compat: add level/facilities to existing public buildings
      const _nameCounters = {};
      for (const b of gameState.buildings) {
        if (PUBLIC_BUILDING_TYPES.includes(b.type)) {
          if (!b.level) b.level = 1;
          if (!b.facilities) b.facilities = [];
          if (b.branchOf === undefined) b.branchOf = null;
          if (!b.customName) {
            if (!_nameCounters[b.type]) _nameCounters[b.type] = 0;
            const idx = _nameCounters[b.type]++;
            b.customName = generatePublicBuildingName(b.type, b.level, idx, gameState.cityName, gameState.cityLevelId);
          }
        }
      }
    }
    // 按城市等级恢复地图尺寸（v2.4.6: 优先使用存档中的地图尺寸，支持新区扩展）
    if (data.mapW && data.mapH) { MAP_W = data.mapW; MAP_H = data.mapH; }
    else { const ms = getMapSizeForLevel(gameState.cityLevelId); MAP_W = ms.w; MAP_H = ms.h; }
    // 安全重建mapCells：如果存档数据长度与当前地图尺寸不匹配，重新生成地形
    const expectedLen = MAP_W * MAP_H;
    if (data.map && data.map.length === expectedLen) {
      mapCells = data.map.map((m, i) => ({
        x: i % MAP_W, y: Math.floor(i / MAP_W),
        elevation: (m.e !== undefined && m.e !== null) ? m.e : 100,
        isWater: !!m.w, terrain: m.t || 'plain', river: !!m.r,
        building: null, buildingLayer: null
      }));
    } else {
      // 尺寸不匹配（版本升级或数据损坏）：重新生成地形
      console.warn('Map size mismatch, regenerating terrain. Expected:', expectedLen, 'Got:', data.map ? data.map.length : 0);
      mapCells = generateTerrain(gameState.mapSeed || randomInt(1, 999999));
      generateRivers(mapCells, gameState.mapSeed || 1);
      contourSegments = generateContours(mapCells);
    }
    riverPaths = data.rivers || [];
    contourSegments = data.contours || contourSegments || [];
    corruptionCooldowns = {};
    initGameScreen();
    renderTerrainToOffscreen();
    renderMap();
    updateUI();
    hideSaveScreen();
    // v2.4.4: 模组钩子 — 读档后
    if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('load:after', { slot, gameState });
    showNotification('存档已加载', 'success');
    logEvent('读取存档继续游戏', 'info');
  } catch(e) { showNotification('读取失败：' + e.message, 'danger'); console.error('Load error:', e); }
}

function deleteSave(slot) {
  localStorage.removeItem('cityPlanner_save_' + slot);
  showSaveScreen(saveMode);
  showNotification('存档已删除', 'info');
}

function getSaveSlots() {
  const slots = [];
  for (let i = 1; i <= 3; i++) {
    const raw = localStorage.getItem('cityPlanner_save_' + i);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        const s = data.state;
        const date = new Date(data.timestamp);
        slots.push({
          num: i, empty: false,
          name: `${s.cityName} - ${s.year}年${s.month}月`,
          detail: `人口${formatPop(s.population)} | 财政¥${formatMoney(s.treasury * 10000)} | 宜居${s.livabilityScore} | 第${s.turn}月`,
          date: `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`,
        });
      } catch(e) { slots.push({ num: i, empty: true }); }
    } else { slots.push({ num: i, empty: true }); }
  }
  return slots;
}

function showSaveScreen(mode) {
  saveMode = mode;
  document.getElementById('save-screen-title').textContent = mode === 'save' ? '保存到存档位' : '读取存档';
  const container = document.getElementById('save-slots-container');
  const slots = getSaveSlots();
  const autoSlots = getAutoSaveInfo();
  let html = '';
  // 自动存档槽位置顶
  if (autoSlots.length > 0) {
    html += autoSlots.map(a => {
      return `<div class="save-slot auto-slot" onclick="loadGame('${a.slot}')">
        <div class="slot-num">A</div>
        <div class="slot-info"><div class="slot-name">自动存档 · ${a.name}</div><div class="slot-detail">${a.detail}<br>${a.date}</div></div>
        <div class="slot-actions">
          <button class="slot-btn export" onclick="event.stopPropagation(); exportSave('${a.slot}')" title="导出">${ICON.download}</button>
          <button class="slot-btn delete" onclick="event.stopPropagation(); deleteSave('${a.slot}')">${ICON.trash}
          </button>
        </div>
      </div>`;
    }).join('');
  }
  // 手动存档槽
  html += slots.map(s => {
    if (s.empty) {
      return `<div class="save-slot empty" ${mode === 'save' ? `onclick="saveGame(${s.num})"` : ''}>
        <div class="slot-num">${s.num}</div>
        <div class="slot-info"><div class="slot-name">空存档位</div><div class="slot-detail">${mode === 'save' ? '点击此处保存' : '暂无存档'}</div></div>
      </div>`;
    }
    return `<div class="save-slot" onclick="${mode === 'save' ? `saveGame(${s.num})` : `loadGame(${s.num})`}">
      <div class="slot-num">${s.num}</div>
      <div class="slot-info"><div class="slot-name">${s.name}</div><div class="slot-detail">${s.detail}<br>${s.date}</div></div>
      <div class="slot-actions">
        <button class="slot-btn export" onclick="event.stopPropagation(); exportSave(${s.num})" title="导出">${ICON.download}</button>
        <button class="slot-btn delete" onclick="event.stopPropagation(); deleteSave(${s.num})">${ICON.trash}
        </button>
      </div>
    </div>`;
  }).join('');
  // 导出当前进度 + 导入存档按钮
  html += `<div style="display:flex;gap:8px;margin-top:10px;padding:0 4px;">
    <button class="start-btn" style="flex:1;padding:10px;font-size:13px;background:var(--accent-light);color:var(--accent);" onclick="exportSave('current')">
      <div class="btn-text">导出当前进度</div>
    </button>
    <button class="start-btn" style="flex:1;padding:10px;font-size:13px;background:var(--green-light,var(--separator));color:var(--green,#34c759);" onclick="importSave()">
      <div class="btn-text">导入存档文件</div>
    </button>
  </div>`;
  container.innerHTML = html;
  document.getElementById('save-screen').classList.add('active');
}

function hideSaveScreen() { document.getElementById('save-screen').classList.remove('active'); }

