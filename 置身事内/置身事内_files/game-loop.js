/* 源自《置身事内》单文件版 - 游戏循环 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 游戏循环 ==============
function nextMonth() {
  if (gameState.gameOver) { showNotification('游戏已结束', 'warn'); return; }
  // [v2.3.0] 模组钩子：每月开始前
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('sim:beforeMonth', { state: gameState, month: gameState.month, year: gameState.year });
  // Auto-resolve expired events
  const expired = gameState.pendingEvents.filter(e => e.deadline <= gameState.turn + 1);
  for (const ev of expired) { autoResolveExpiredEvent(ev); }
  if (corruptionCooldowns) { for (const id in corruptionCooldowns) { if (corruptionCooldowns[id] > 0) corruptionCooldowns[id]--; } }
  gameState.month++;
  if (gameState.month > 12) { gameState.month = 1; gameState.year++; }
  gameState.turn++;
  gameState.termTurn++;
  gameState.regionTermTurn++;
  // v2.3.7: 提级巡视锁定递减
  if (gameState.inspectionLockdown > 0) {
    gameState.inspectionLockdown--;
    if (gameState.inspectionLockdown === 0) {
      logEvent('提级巡视结束，政务和个人事务页面已解锁', 'info');
      showNotification('提级巡视结束，已恢复正常工作', 'info');
    } else {
      // v2.4.1d: 巡视期间检查兼职状态是否有效（各地图等级通用）
      if (gameState.deputyPosition !== null && gameState.deputyPosition > (gameState.cityLevelId || 0) + 1) {
        gameState.deputyPosition = null;
        logEvent('巡视期间发现兼职等级不匹配，已免除兼职职务', 'warn');
        showNotification('兼职职务因等级不匹配已被免除', 'warn');
      }
      // 巡视期间纪委风险持续增加
      gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 5, 0, 100);
    }
  }
  // v2.4.6b: 行政区划申报考察期处理
  if (gameState.adminApplication && gameState.adminApplication.status === 'reviewing') {
    const app = gameState.adminApplication;
    const monthsPassed = gameState.turn - app.turnSubmitted;
    const monthsLeft = app.reviewMonths - monthsPassed;
    if (monthsLeft <= 0) {
      // 考察期结束，计算通过率
      let rejectBonus = app.baseRejectRate;
      // 考察期内负面指标过高增加驳回概率
      if ((gameState.corruption || 0) > 30) rejectBonus += 0.15;
      if ((gameState.airQuality || 0) > 100) rejectBonus += 0.10;
      if ((gameState.happiness || 50) < 40) rejectBonus += 0.15;
      if ((gameState.inspectionRisk || 0) > 40) rejectBonus += 0.10;
      if ((gameState.unemployment || 0) > 0.12) rejectBonus += 0.05;
      rejectBonus = Math.min(rejectBonus, 0.85); // 最高驳回85%
      const passed = Math.random() > rejectBonus;
      // 查找对应配置
      const upgradeConfigs = {
        countyCity: { name: '撤县设市', onSuccess: () => {
          gameState.cityStatus.isCountyCity = true;
          gameState.fiscalRemitRate = (gameState.fiscalRemitRate || 1.0) + 0.10;
          gameState.fiscalSupportMonthly = (gameState.fiscalSupportMonthly || 0) + 50;
          gameState.reputation = clamp((gameState.reputation || 50) + 10, 0, 100);
          showNotification('撤县设市申报获批！财政留成+10%，月度扶持+50万', 'success');
          logEvent('撤县设市申报获批，城市行政地位提升，可征收城建税', 'success');
        }},
        separatelyPlanned: { name: '计划单列市', onSuccess: () => {
          gameState.cityStatus.isSeparatelyPlanned = true;
          gameState.fiscalRemitRate = (gameState.fiscalRemitRate || 1.0) + 0.20;
          gameState.fiscalSupportMonthly = (gameState.fiscalSupportMonthly || 0) + 200;
          gameState.reputation = clamp((gameState.reputation || 50) + 15, 0, 100);
          showNotification('计划单列市申报获批！财政直留中央（留成+20%），月度扶持+200万', 'success');
          logEvent('计划单列市申报获批，获得省级经济管理权限，省级财政不再分成', 'success');
        }},
        nationalNewArea: { name: '国家级新区', onSuccess: () => {
          gameState.cityStatus.hasNationalNewArea = true;
          gameState.fiscalRemitRate = (gameState.fiscalRemitRate || 1.0) + 0.15;
          gameState.fiscalSupportMonthly = (gameState.fiscalSupportMonthly || 0) + 300;
          gameState.reputation = clamp((gameState.reputation || 50) + 20, 0, 100);
          const oldW = MAP_W, oldH = MAP_H;
          MAP_W = Math.round(MAP_W * 1.3); MAP_H = Math.round(MAP_H * 1.3);
          const newCells = new Array(MAP_W * MAP_H);
          for (let y = 0; y < MAP_H; y++) { for (let x = 0; x < MAP_W; x++) {
            if (x < oldW && y < oldH) { newCells[y * MAP_W + x] = mapCells[y * oldW + x]; }
            else { newCells[y * MAP_W + x] = { x, y, elev: 100 + Math.random() * 50, water: false, occupied: false, building: null }; }
          }}
          mapCells.length = 0; mapCells.push.apply(mapCells, newCells);
          gameState.cityStatus.newAreaExpanded = true;
          if (typeof generateTerrain === 'function') {
            for (let y = 0; y < MAP_H; y++) { for (let x = 0; x < MAP_W; x++) {
              if (x >= oldW || y >= oldH) { const idx = y * MAP_W + x; const cell = mapCells[idx];
                const nx = x / MAP_W * 3, ny = y / MAP_H * 2;
                const e1 = Math.sin(nx * 1.7) * Math.cos(ny * 2.3) * 40;
                const e2 = Math.sin(nx * 4.1 + 1.3) * Math.cos(ny * 3.7) * 20;
                const ex = 1 - Math.pow(Math.abs(x / MAP_W - 0.5) * 2, 4);
                cell.elev = 120 + e1 + e2 + (1 - ex) * 60 + Math.random() * 15; cell.water = cell.elev < 55;
              }
            }}
          }
          if (typeof renderTerrainToOffscreen === 'function') renderTerrainToOffscreen();
          if (typeof generateContours === 'function') contourSegments = generateContours(mapCells);
          showNotification(`国家级新区申报获批！地图扩展至${MAP_W}×${MAP_H}，财政留成+15%，月度扶持+300万`, 'success');
          logEvent(`国家级新区获批，可开发面积扩展至${MAP_W}×${MAP_H}，新区内企业所得税降至15%`, 'success');
          if (typeof fitMapToView === 'function') fitMapToView();
          if (typeof renderMap === 'function') renderMap();
        }},
      };
      const upCfg = upgradeConfigs[app.type];
      if (upCfg) {
        if (passed) { upCfg.onSuccess(); }
        else {
          showNotification(`${upCfg.name}申报考察未通过，被上级驳回`, 'danger');
          logEvent(`${upCfg.name}申报在考察期结束后被驳回（负面指标过高）`, 'warn');
        }
      }
      gameState.adminApplication = null;
    } else if (monthsLeft === 1) {
      // 考察期最后一个月提醒
      logEvent(`行政区划申报考察期即将结束，请保持各项指标稳定`, 'info');
    }
  }
  // v2.4.6b: 城市荣誉考察期处理
  if (gameState.cityHonors) {
    const h = gameState.cityHonors;
    // 文明城市
    if (h.civilizedApplying && h.civilizedReviewTurn > 0) {
      h.civilizedReviewTurn--;
      if (h.civilizedReviewTurn === 0) {
        // 考察期结束，检查是否持续达标
        const pass = (gameState.happiness || 0) >= 60 && (gameState.educationIndex || 0) >= 35 &&
          (gameState.corruption || 0) < 30 && (gameState.airQuality || 0) < 90;
        if (pass) {
          h.civilizedCity = true; h.civilizedApplying = false;
          gameState.happiness = clamp((gameState.happiness || 50) + 8, 0, 100);
          gameState.reputation = clamp((gameState.reputation || 50) + 10, 0, 100);
          showNotification('获评全国文明城市！幸福度+8，声誉+10', 'success');
          logEvent('获评全国文明城市，市民幸福度和城市形象大幅提升', 'success');
        } else {
          h.civilizedApplying = false;
          showNotification('文明城市评选未通过，考察期内部分指标未达标', 'danger');
          logEvent('文明城市评选未通过，考察期内指标波动较大', 'warn');
        }
      }
    }
    // 卫生城市
    if (h.sanitaryApplying && h.sanitaryReviewTurn > 0) {
      h.sanitaryReviewTurn--;
      if (h.sanitaryReviewTurn === 0) {
        const pass = (gameState.healthcareIndex || 0) >= 40 && (gameState.waterQuality || 0) >= 65 &&
          (gameState.greenCoverage || 0) >= 15 && (gameState.corruption || 0) < 35;
        if (pass) {
          h.sanitaryCity = true; h.sanitaryApplying = false;
          gameState.happiness = clamp((gameState.happiness || 50) + 5, 0, 100);
          gameState.healthcareIndex = clamp((gameState.healthcareIndex || 15) + 10, 0, 100);
          showNotification('获评国家卫生城市！幸福度+5，医疗指数+10', 'success');
          logEvent('获评国家卫生城市，城市卫生水平和医疗指数提升', 'success');
        } else {
          h.sanitaryApplying = false;
          showNotification('卫生城市评选未通过，考察期内部分指标未达标', 'danger');
          logEvent('卫生城市评选未通过，考察期内指标波动较大', 'warn');
        }
      }
    }
  }
  // v2.3.7c: 提级巡视触发条件 — 玩家腐败过高 或 下属各局贪腐值过高
  if (gameState.month === 1 && gameState.inspectionLockdown === 0) {
    // v2.4.4: 模组钩子 — 年初
    if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('sim:beforeYear', { year: gameState.year, gameState });
    // v2.4.1a: 年初重置强制排板计数
    gameState._forceAppointCount = 0;
    // v2.4.3: 年初重置探矿冷却
    gameState._prospectingCooldown = false;
    let shouldTrigger = false;
    let triggerReason = '';
    // 条件1：玩家自身腐败过高
    if ((gameState.corruption || 0) > 50) {
      const triggerChance = Math.min(0.7, ((gameState.corruption || 0) - 50) / 50);
      if (Math.random() < triggerChance) {
        shouldTrigger = true;
        triggerReason = '个人廉政问题';
      }
    }
    // v2.3.7c: 条件2：下属各局贪腐值过高
    if (!shouldTrigger && gameState.personnel && gameState.cityLevelId >= 1) {
      const ps = gameState.personnel;
      let highCorruptionOfficials = 0;
      let totalCorruptionTendency = 0;
      let appointedCount = 0;
      for (const bId of Object.keys(ps.appointments)) {
        const off = ps.officials.find(o => o.id === ps.appointments[bId]);
        if (off) {
          appointedCount++;
          totalCorruptionTendency += (off.corruptionTendency || 1);
          if ((off.corruptionTendency || 1) >= 4) highCorruptionOfficials++;
        }
      }
      // 有2个以上高贪腐干部，或平均贪腐倾向>3.5
      if (appointedCount > 0 && (highCorruptionOfficials >= 2 || totalCorruptionTendency / appointedCount > 3.5)) {
        if (Math.random() < 0.5) {
          shouldTrigger = true;
          triggerReason = '下属干部违纪问题';
        }
      }
    }
    // v2.4.1: 常务委员会成员贪腐过高也触发提级巡视
    if (!shouldTrigger && gameState.committee) {
      let highCorrCommittee = 0;
      for (const m of gameState.committee) {
        if (!m.isPlayer && (m.corruptionTendency || 1) >= 4) highCorrCommittee++;
      }
      if (highCorrCommittee >= 2) {
        if (Math.random() < 0.4) {
          shouldTrigger = true;
          triggerReason = '班子成员违纪问题';
        }
      }
    }
    // v2.4.1a: 多次强制排板任命增加提级巡视概率
    if (!shouldTrigger && (gameState._forceAppointCount || 0) >= 2) {
      const forceChance = Math.min(0.6, (gameState._forceAppointCount || 0) * 0.15);
      if (Math.random() < forceChance) {
        shouldTrigger = true;
        triggerReason = '人事任免程序不规范';
      }
    }
    // v2.4.1b: 曾包庇纪委干部，提级巡视时大概率败露
    if (!shouldTrigger && gameState._coverUpCommitted && Math.random() < 0.5) {
      shouldTrigger = true;
      triggerReason = '包庇行为败露';
    }
    if (shouldTrigger) {
      const lockdownTurns = 1 + Math.floor(Math.random() * 3); // 1-3回合
      gameState.inspectionLockdown = lockdownTurns;
      // v2.4.1b: 包庇败露触发成就
      if (gameState._coverUpCommitted) {
        if (gameState.achievementStats) gameState.achievementStats.coverUpExposed = (gameState.achievementStats.coverUpExposed || 0) + 1;
        gameState._coverUpCommitted = false;
      }
      logEvent(`上级纪委提级巡视进驻（原因：${triggerReason}）！政务和个人事务页面锁定${lockdownTurns}个月`, 'danger');
      showNotification(`提级巡视进驻！政务和个人事务页面锁定${lockdownTurns}个月`, 'danger');
      gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 15, 0, 100);
    }
  }
  // 每半年（3月和9月）弹出晚报
  if ((gameState.month === 3 || gameState.month === 9) && gameState.turn > 0) {
    setTimeout(() => showNewspaper(), 500);
  }
  // 初始化仕途年限（首次进入游戏时）
  if (gameState.maxCareerYears === 0) {
    gameState.maxCareerYears = 35 + Math.floor(Math.random() * 11); // 35-45年
    gameState.careerStartTurn = gameState.turn - 1;
  }
  simulateMonth();
  // v2.4.7: 交通建筑经济效果（GDP/噪音在此计算，eff中已置0避免双重计算）
  let transportGdpBonus = 0;
  let transportFiscalBonus = 0;
  let transportNoiseBonus = 0;
  let transportTourismIncome = 0;

  for (const b of gameState.buildings) {
    if (b.underConstruction) continue;
    if (b.type === 'railwayStation' || b.type === 'hsrStation') {
      const grade = getStationGrade(gameState.population);
      const oldGrade = b.stationGrade;
      b.stationGrade = grade.code; // v2.4.7b: 动态更新车站等级
      const gdpMult = grade.gdpMult;
      const lvl = b.level || 1;
      if (b.type === 'railwayStation') {
        transportGdpBonus += 60 * gdpMult * lvl;
        transportFiscalBonus += 15 * gdpMult * lvl;
        transportNoiseBonus += 8;
      } else {
        transportGdpBonus += 120 * gdpMult * lvl;
        transportFiscalBonus += 30 * gdpMult * lvl;
        transportNoiseBonus += 6;
      }
      // v2.4.7b: 车站等级升级通知（仅当等级变化时）
      if (oldGrade && oldGrade !== grade.code) {
        logEvent(`${b.customName || '车站'}由${oldGrade}升级为${grade.code}`, 'success');
        // v2.4.7b: 触发模组钩子
        if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('transport:stationGradeChanged', { building: b, oldGrade, newGrade: grade.code });
      }
    }
    if (b.type === 'airport') {
      // v2.4.7c: 使用 runways 数组计算机场等级
      const cls = getAirportClass(b.runways || b.runwayLength || 6);
      b.airportClass = cls.code;
      const lvl = b.level || 1;
      transportGdpBonus += 150 * cls.tradeMult * lvl;
      transportFiscalBonus += 30 * cls.tradeMult * lvl;
      transportNoiseBonus += 20;
      // 贸易收入
      if (b.tradeIncome) transportFiscalBonus += b.tradeIncome;
      // 国际机场游客收入
      if (b.isInternational) {
        transportTourismIncome += 50 * cls.tradeMult;
      }
    }
    if (b.type === 'port') {
      const lvl = b.level || 1;
      transportGdpBonus += 80 * lvl;
      transportFiscalBonus += 20 * lvl;
      transportNoiseBonus += 5;
    }
  }

  gameState.gdp += transportGdpBonus;
  gameState.monthlyRevenue += transportFiscalBonus + transportTourismIncome;
  gameState.noiseLevel = Math.min(85, gameState.noiseLevel + transportNoiseBonus * 0.1);

  // v2.4.7: 客流量随机波动
  for (const b of gameState.buildings) {
    if (b.type === 'railwayStation' || b.type === 'hsrStation' || b.type === 'airport' || b.type === 'port') {
      if (b.passengerFlow) {
        const fluctuation = 0.8 + Math.random() * 0.4; // ±20%
        b.passengerFlow = Math.floor(b.passengerFlow * fluctuation);
      }
    }
  }

  // v2.4.7: 春运事件
  if (gameState.month === 1 || gameState.month === 2) {
    const stations = gameState.buildings.filter(b =>
      (b.type === 'railwayStation' || b.type === 'hsrStation') && !b.underConstruction
    );
    if (stations.length > 0 && Math.random() < 0.4) {
      // 春运客流激增
      for (const s of stations) {
        if (s.passengerFlow) {
          s.passengerFlow = Math.floor(s.passengerFlow * 2.5);
        }
      }
      // 春运经济效应
      const springBonus = stations.length * 20;
      gameState.gdp += springBonus;
      gameState.monthlyRevenue += springBonus * 0.3;
      logEvent(`春运期间客流量激增，${stations.length}个车站迎来客流高峰，预计带来${springBonus}万GDP增量`, 'info');
      // v2.4.7b: 春运钩子
      if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('transport:springFestival', { stations, totalFlow: stations.reduce((s, st) => s + (st.passengerFlow || 0), 0), gdpBonus: springBonus });

      // 春运拥堵可能导致幸福度下降
      const congestion = Math.min(5, stations.length);
      gameState.happiness = Math.max(0, gameState.happiness - congestion);
    }
  }

  // v2.2.7: 年度干部招录（每年6月随机考试：国考/省考/选调/林遴选）
  checkAnnualRecruitment();
  // v2.2.4b: 更新干部任职月数
  if (typeof updateOfficialTenure === 'function') updateOfficialTenure();
  updateUI();
  renderMap();
  if (gameState.turn % 3 === 0) logEvent(`季度报告：GDP ¥${formatMoney(gameState.gdp * 10000)}，人口 ${formatPop(gameState.population)}`, 'info');
  checkPositiveGuidance();
  if (currentTab === 'events') renderSheet('events');
  checkAchievements();
  if (currentTab === 'events') renderSheet('events');
  checkTermEnd();
  autoSave();
  // [v2.3.0] 模组钩子：每月结束后
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('sim:afterMonth', { state: gameState, month: gameState.month, year: gameState.year });
  // [v2.3.0] 模组事件：月末事件
  if (typeof ModAPI !== 'undefined') ModAPI.events.emit('monthEnd', gameState);
}

function checkTermEnd() {
  // 无尽仕途模式：跳过退休检查，自由选择去留
  if (gameState.endlessMode) { checkTermEndEndless(); return; }
  // 退休检查：达到仕途年限上限
  const careerMonths = gameState.turn - gameState.careerStartTurn;
  if (gameState.maxCareerYears > 0 && careerMonths >= gameState.maxCareerYears * 12) {
    triggerRetirement();
    return;
  }
  if (gameState.termTurn < gameState.termEnd) return;
  // 同一地区任期上限：10年（120个月）
  if (gameState.regionTermTurn >= 120) {
    const lv = getCityLevel();
    const score = Math.round(gameState.livabilityScore * 0.3 + gameState.prosperityScore * 0.2 + gameState.happiness * 0.2 + (100 - gameState.corruption) * 0.15 + gameState.reputation * 0.15);
    const canPromote = gameState.population >= lv.promoPop && score >= lv.promoScore && lv.id < 4;
    if (!canPromote) {
      // 平调：同等级，新地图，人口和经济更多 — 先显示红头文件
      showModal('任期届满 - 异地平调', `<p style="font-size:15px;line-height:1.8;">${getOfficialTitle()}在同一地区任职已满10年，根据干部交流制度，组织决定安排异地平调。</p>
        <p style="font-size:13px;color:var(--text-2);margin-top:8px;">将调任同等级新地区，初始人口和经济条件更好，但需重新开始建设。</p>
        <div class="effect-list" style="margin-top:8px;">
          ${effectItem(ICON.users, '考核评分', score + '分', 'pos')}
          ${effectItem(ICON.clock, '任职时长', '10年', 'info')}
        </div>`, [
        { text: '接受平调', color: 'blue', action: () => { closeModal(); showTransferRedLetter(() => doTransfer()); } },
      ], '干部交流', 'info');
      return;
    }
  }
  const lv = getCityLevel();
  const score = Math.round(gameState.livabilityScore * 0.3 + gameState.prosperityScore * 0.2 + gameState.happiness * 0.2 + (100 - gameState.corruption) * 0.15 + gameState.reputation * 0.15);
  const nextLv = CITY_LEVELS[Math.min(lv.id + 1, 4)];
  const reqDegree = DEGREE_REQUIREMENTS[nextLv.id];
  const hasDegreeReq = !reqDegree || (gameState.playerDegree && DEGREE_LEVELS.indexOf(gameState.playerDegree) >= DEGREE_LEVELS.indexOf(reqDegree));
  const meetsPromoReqs = gameState.population >= lv.promoPop && score >= lv.promoScore && lv.id < 4 && hasDegreeReq;
  // v2.3.6c: 处分期不能提拔（noPromotionUntil > 当前回合 = 处分期未过）
  const inPromotionBan = (gameState.noPromotionUntil || 0) > gameState.turn;
  // v2.3.6: 政绩特别突出（超过晋升线20分）可一步升正职
  const exceptionallyOutstanding = meetsPromoReqs && score >= lv.promoScore + 20;
  // v2.3.6: 已有副职才能升正职
  const hasDeputy = gameState.deputyPosition !== null && gameState.deputyPosition === lv.id + 1;
  // v2.3.6c: 处分期内不能提拔（即使是破格直升也不行）
  const canDirectPromote = exceptionallyOutstanding && !inPromotionBan;
  const canPromote = meetsPromoReqs && (hasDeputy || exceptionallyOutstanding) && !inPromotionBan;
  // v2.3.6: 政绩突出但无副职 → 先兼任副职（处分期内也不能兼任副职）
  const canGetDeputy = meetsPromoReqs && !hasDeputy && !exceptionallyOutstanding && !inPromotionBan;
  const canDemote = score < 30 || gameState.reputation < 15;

  let title, body;
  if (canDirectPromote || (canPromote && hasDeputy)) {
    const nextLv = CITY_LEVELS[lv.id + 1];
    title = '任期结束 - 获得晋升！';
    body = `<p style="font-size:15px;line-height:1.8;">${getOfficialTitle()}任期届满，政绩考核${exceptionallyOutstanding ? '特别突出' : '优异'}！</p>`;
    body += `<div class="effect-list" style="margin-top:8px;">`;
    body += effectItem(ICON.users, '考核评分', score + '分', 'pos');
    body += effectItem(ICON.heart, '宜居度', Math.round(gameState.livabilityScore), 'pos');
    body += effectItem(ICON.star, '繁荣度', Math.round(gameState.prosperityScore), 'pos');
    body += effectItem(ICON.alert, '腐败指数', Math.round(gameState.corruption), gameState.corruption > 30 ? 'neg' : 'pos');
    body += `</div>`;
    if (exceptionallyOutstanding) {
      body += `<p style="font-size:13px;margin-top:8px;color:var(--green);font-weight:600;">政绩特别突出，经组织破格提拔，直接晋升正职！</p>`;
    } else {
      body += `<p style="font-size:13px;margin-top:8px;color:var(--accent);">此前已兼任${nextLv.name}副职，本次正式晋升正职。</p>`;
    }
    body += `<p style="font-size:14px;margin-top:12px;color:var(--accent);font-weight:600;">${lv.name} → ${nextLv.name}　${getOfficialTitle()} → ${nextLv.title}</p>`;
    body += `<p style="font-size:13px;color:var(--text-2);margin-top:6px;">新的人口基础：${formatPop(nextLv.initPop)}，财政拨款：¥${formatMoney(nextLv.treasury * 10000)}</p>`;
    showModal(title, body, [
      { text: '接受晋升', color: 'blue', action: () => { closeModal(); showPromotionRedLetter(nextLv, () => doPromotion()); } },
      { text: '查看详情', color: 'gray', action: () => {} },
    ], '任期结算', 'success');
  } else if (canGetDeputy) {
    // v2.3.6: 政绩突出但无副职 → 先兼任上级副职
    const nextLv = CITY_LEVELS[lv.id + 1];
    const deputyTitle = getDeputyTitle(nextLv.id);
    title = '任期结束 - 兼任副职';
    body = `<p style="font-size:15px;line-height:1.8;">${getOfficialTitle()}任期届满，政绩考核优秀。</p>`;
    body += `<p style="font-size:13px;color:var(--text-2);margin-top:6px;">根据干部选拔任用规定，先安排兼任上级副职进行培养锻炼。</p>`;
    body += `<div class="effect-list" style="margin-top:8px;">`;
    body += effectItem(ICON.users, '考核评分', score + '分', 'pos');
    body += effectItem(ICON.heart, '宜居度', Math.round(gameState.livabilityScore), 'pos');
    body += effectItem(ICON.star, '繁荣度', Math.round(gameState.prosperityScore), 'pos');
    body += effectItem(ICON.alert, '腐败指数', Math.round(gameState.corruption), gameState.corruption > 30 ? 'neg' : 'pos');
    body += `</div>`;
    body += `<p style="font-size:14px;margin-top:12px;color:var(--orange);font-weight:600;">${getOfficialTitle()} → 兼任${deputyTitle}</p>`;
    body += `<p style="font-size:12px;color:var(--text-3);margin-top:6px;">兼任副职后，下个任期政绩达标可正式晋升${nextLv.name}${nextLv.title}。</p>`;
    showModal(title, body, [
      { text: '接受任命', color: 'blue', action: () => { closeModal(); showDeputyRedLetter(nextLv, () => doDeputyAppointment()); } },
      { text: '查看详情', color: 'gray', action: () => {} },
    ], '任期结算', 'info');
  } else if (canDemote && lv.id > 0) {
    const prevLv = CITY_LEVELS[lv.id - 1];
    title = '任期结束 - 降级处理';
    body = `<p style="font-size:15px;line-height:1.8;">${getOfficialTitle()}任期届满，政绩考核不合格。</p>`;
    body += `<div class="effect-list" style="margin-top:8px;">`;
    body += effectItem(ICON.users, '考核评分', score + '分', 'neg');
    body += effectItem(ICON.heart, '宜居度', Math.round(gameState.livabilityScore), 'neg');
    body += effectItem(ICON.star, '繁荣度', Math.round(gameState.prosperityScore), 'neg');
    body += `</div>`;
    body += `<p style="font-size:14px;margin-top:12px;color:var(--red);font-weight:600;">${lv.name} → ${prevLv.name}　${getOfficialTitle()} → ${prevLv.title}</p>`;
    showModal(title, body, [{ text: '接受降级', color: 'red', action: () => { closeModal(); doDemotion(); } }], '任期结算', 'danger');
  } else if (inPromotionBan && meetsPromoReqs && !canDemote) {
    // v2.3.6c: 政绩达标但处分期内不能提拔
    const banRemaining = (gameState.noPromotionUntil || 0) - gameState.turn;
    title = '任期结束 - 处分期未满';
    body = `<p style="font-size:15px;line-height:1.8;">${getOfficialTitle()}任期届满，政绩考核达标，但因处于党纪处分期内（剩余${banRemaining}个月），不得提拔任用。</p>`;
    body += `<div class="effect-list" style="margin-top:8px;">`;
    body += effectItem(ICON.users, '考核评分', score + '分', 'pos');
    body += effectItem(ICON.heart, '宜居度', Math.round(gameState.livabilityScore), 'pos');
    body += effectItem(ICON.star, '繁荣度', Math.round(gameState.prosperityScore), 'pos');
    body += effectItem(ICON.alert, '处分剩余', banRemaining + '个月', 'neg');
    body += `</div>`;
    body += `<p style="font-size:12px;color:var(--text-3);margin-top:10px;">处分期满后可正常晋升。继续连任当前职务。</p>`;
    showModal(title, body, [{ text: '继续执政', color: 'blue', action: () => { closeModal(); doContinue(); } }], '任期结算', 'info');
  } else {
    title = '任期结束 - 继续连任';
    body = `<p style="font-size:15px;line-height:1.8;">${getOfficialTitle()}任期届满，政绩考核合格，继续连任。</p>`;
    body += `<div class="effect-list" style="margin-top:8px;">`;
    body += effectItem(ICON.users, '考核评分', score + '分', 'pos');
    body += effectItem(ICON.heart, '宜居度', Math.round(gameState.livabilityScore), gameState.livabilityScore >= 60 ? 'pos' : 'neg');
    body += effectItem(ICON.star, '繁荣度', Math.round(gameState.prosperityScore), gameState.prosperityScore >= 50 ? 'pos' : 'neg');
    body += effectItem(ICON.alert, '腐败指数', Math.round(gameState.corruption), gameState.corruption > 30 ? 'neg' : 'pos');
    body += `</div>`;
    if (lv.id < 4) {
      const nextLv2 = CITY_LEVELS[lv.id + 1];
      const scoreGap = Math.max(0, lv.promoScore - score);
      body += `<p style="font-size:12px;color:var(--text-3);margin-top:10px;">晋升${nextLv2.name}需：人口达${formatPop(lv.promoPop)}（还差${formatPop(Math.max(0, lv.promoPop - gameState.population))}）、评分达${lv.promoScore}分（还差${scoreGap}分）</p>`;
      if (gameState.deputyPosition === lv.id + 1) {
        body += `<p style="font-size:12px;color:var(--green);margin-top:4px;">已兼任${nextLv2.name}副职，下个任期达标即可正式晋升</p>`;
      } else {
        body += `<p style="font-size:12px;color:var(--text-3);margin-top:4px;">需先兼任${nextLv2.name}副职，方可正式晋升（评分超线20分可破格直升）</p>`;
      }
      if (reqDegree) {
        body += `<p style="font-size:12px;color:${hasDegreeReq ? 'var(--green)' : 'var(--red)'};margin-top:4px;">学历要求：${reqDegree}${hasDegreeReq ? '（已满足）' : '（未满足，请在学历页面学习）'}</p>`;
      }
    }
    showModal(title, body, [{ text: '继续执政', color: 'blue', action: () => { closeModal(); doContinue(); } }], '任期结算', 'info');
  }
}

// v2.3.6: 获取副职名称
function getDeputyTitle(targetLevelId) {
  const deputyTitles = ['副镇长', '副县长', '副市长', '副省长', '副市长'];
  return deputyTitles[targetLevelId] || '副职';
}

// v2.3.6: 兼任副职
function doDeputyAppointment() {
  const lv = getCityLevel();
  if (lv.id >= 4) return;
  const nextLv = CITY_LEVELS[lv.id + 1];
  gameState.deputyPosition = nextLv.id;
  gameState.merit = (gameState.merit || 0) + 5;
  gameState.reputation = clamp(gameState.reputation + 5, 0, 100);
  gameState.termTurn = 0;
  gameState.termEnd = lv.termMonths;
  gameState.investUsage = {};
  showNotification(`已兼任${getDeputyTitle(nextLv.id)}，继续担任${lv.title}`, 'success');
  logEvent(`兼任${nextLv.name}${getDeputyTitle(nextLv.id)}，继续主持${lv.name}工作`, 'success');
  updateUI();
}

// 无尽仕途模式：任期结束时自由选择去留
function checkTermEndEndless() {
  if (gameState.termTurn < gameState.termEnd) return;
  const lv = getCityLevel();
  const score = Math.round(gameState.livabilityScore * 0.3 + gameState.prosperityScore * 0.2 + gameState.happiness * 0.2 + (100 - gameState.corruption) * 0.15 + gameState.reputation * 0.15);
  const buttons = [];
  if (lv.id < 4) {
    buttons.push({ text: '晋升', color: 'blue', action: () => { closeModal(); doPromotion(); } });
  }
  if (lv.id > 0) {
    buttons.push({ text: '降职', color: 'red', action: () => { closeModal(); doDemotion(); } });
  }
  if (gameState.regionTermTurn >= 60) {
    buttons.push({ text: '平调', color: 'gray', action: () => { closeModal(); showTransferRedLetter(() => doTransfer()); } });
  }
  buttons.push({ text: '本地连任', color: 'green', action: () => { closeModal(); doContinue(); } });
  const body = `<p style="font-size:15px;line-height:1.8;">任期届满，可自由选择去留。</p>
    <div class="effect-list" style="margin-top:8px;">
      ${effectItem(ICON.users, '考核评分', score + '分', 'pos')}
      ${effectItem(ICON.star, '当前职务', lv.title, 'info')}
      ${effectItem(ICON.clock, '本地区任职', gameState.regionTermTurn + '月', 'info')}
    </div>
    <p style="font-size:13px;color:var(--text-2);margin-top:8px;">无尽仕途模式下无退休限制，请选择下一步动向。</p>`;
  showModal('任期结束 - 自由选择', body, buttons, '任期结算', 'info');
}

function effectItem(icon, label, val, cls) {
  return `<div class="effect-item"><span class="eff-label">${icon}${label}</span><span class="eff-val ${cls}">${val}</span></div>`;
}

// 财产审查：调离/晋升时检查私人财产，过多则增加纪委风险
function performAssetAudit() {
  const privateAccount = gameState.privateAccount || 0;
  const totalAssets = privateAccount +
    (gameState.privateAssets?.stocks?.reduce((s, st) => s + st.shares * st.currentPrice, 0) || 0) +
    (gameState.privateAssets?.land?.reduce((s, l) => s + l.currentValue, 0) || 0) +
    (gameState.privateAssets?.projects?.reduce((s, p) => s + p.investment, 0) || 0) +
    (gameState.privateAssets?.villas?.reduce((s, v) => s + v.value, 0) || 0);
  // 财产超过500万开始引起关注，超过2000万严重
  let riskAdd = 0;
  let auditMsg = '';
  if (totalAssets > 2000) {
    riskAdd = 20;
    auditMsg = `财产审查发现私人资产达¥${Math.round(totalAssets * 10000).toLocaleString()}，远超正常收入水平，纪委已重点关注`;
    gameState.corruption = clamp(gameState.corruption + 5, 0, 100);
  } else if (totalAssets > 1000) {
    riskAdd = 10;
    auditMsg = `财产审查发现私人资产达¥${Math.round(totalAssets * 10000).toLocaleString()}，需进一步核实来源`;
  } else if (totalAssets > 500) {
    riskAdd = 5;
    auditMsg = `财产审查发现私人资产达¥${Math.round(totalAssets * 10000).toLocaleString()}，已记录在案`;
  } else {
    auditMsg = `财产审查通过，私人资产在合理范围内`;
    gameState.achievementStats.auditPassed = (gameState.achievementStats.auditPassed || 0) + 1;
  }
  gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + riskAdd, 0, 100);
  if (riskAdd > 0) {
    showNotification(auditMsg, 'warn');
    logEvent(`财产审查：私人资产¥${Math.round(totalAssets * 10000).toLocaleString()}，纪委风险+${riskAdd}`, 'warn');
  } else {
    logEvent(`财产审查通过`, 'info');
  }
  return riskAdd;
}

function doPromotion() {
  const lv = getCityLevel();
  if (lv.id >= 4) { showNotification('已达到最高城市等级', 'info'); return; }
  const nextLv = CITY_LEVELS[lv.id + 1];
  const score = Math.round(gameState.livabilityScore * 0.3 + gameState.prosperityScore * 0.2 + gameState.happiness * 0.2 + (100 - gameState.corruption) * 0.15 + gameState.reputation * 0.15);
  gameState.promotionHistory.push({ from: lv.name, to: nextLv.name, turn: gameState.turn, score });
  gameState.achievementStats.promotions++;
  gameState.achievementStats.consecutivePromotions = (gameState.achievementStats.consecutivePromotions || 0) + 1;
  gameState.achievementStats.consecutiveNonDemotions = (gameState.achievementStats.consecutiveNonDemotions || 0) + 1;
  gameState.cityLevelId = nextLv.id;
  // 晋升后债务不继承：清空贷款，重置财政为新等级初始值
  gameState.loans = [];
  const oldDebt = Math.max(0, -gameState.treasury);
  gameState.treasury = nextLv.treasury;
  // 财产审查：私人财产过多增加纪委风险
  const assetAuditRisk = performAssetAudit();
  gameState.termTurn = 0;
  gameState.regionTermTurn = 0; // 新地区任期重置
  gameState.termEnd = nextLv.termMonths;
  gameState.reputation = clamp(gameState.reputation + 10, 0, 100);
  gameState.corruption = Math.max(0, gameState.corruption - 5);
  // v2.3.6: 晋升后清除副职
  gameState.deputyPosition = null;
  // 重置工商次数
  gameState.investUsage = {};
  // 荣誉保留：累计政绩
  gameState.merit = Math.round((gameState.merit || 0) + score);

  // 生成全新地图和城市
  gameState.mapSeed = randomInt(1, 999999);
  // v2.2.4: 晋升到新地图，重新随机分配地图派系
  gameState.mapFaction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
  gameState.buildings = [];
  gameState.buildingCount = 0;
  gameState.zones = [];
  gameState.roads = [];
  gameState.transits = [];
  gameState.skyscrapers = [];
  usedRoadNames = new Set();
  roadNameCounter = 0;
  gameState.pendingEvents = [];
  gameState.pendingEvent = null;
  // v2.2.6: 地铁/轻轨审批改为人口门槛，不再按城市等级自动获批
  // 保留已获批状态，晋升不撤销已有审批
  if (gameState.subwayApproved === undefined) gameState.subwayApproved = false;
  if (gameState.lightRailApproved === undefined) gameState.lightRailApproved = false;
  // 大学审批不随晋升自动获批，需重新申报
  gameState.universityApproved = false;
  // v2.4.7b: 机场审批也需重新申报
  gameState.airportApproved = false;
  if (nextLv.id >= 1 && !gameState.personnel) initPersonnelSystem();
  else if (nextLv.id >= 1) resetPersonnelOnPromotion();
  // 生成新地形（按新等级扩展地图）
  const ms = getMapSizeForLevel(gameState.cityLevelId);
  MAP_W = ms.w; MAP_H = ms.h;
  offscreenCanvas.width = MAP_W * CELL;
  offscreenCanvas.height = MAP_H * CELL;
  mapCells = generateTerrain(gameState.mapSeed);
  // generateRivers is already called inside generateTerrain
  generateContours(mapCells);
  renderTerrainToOffscreen();
  // 设定新城市名称
  updateCityName();
  // 在新地图上生成初始城市（含新等级的初始人口和财政）
  generateStarterCity();
  // 重置视图
  fitMapToView();
  renderMap();

  showNotification(`晋升为${nextLv.title}！已抵达新的${nextLv.name}`, 'success');
  logEvent(`晋升为${nextLv.name}，出任${nextLv.title}`, 'success');
  logEvent(`新地图已生成，初始人口：${formatPop(gameState.population)}，财政拨款：¥${formatMoney(nextLv.treasury * 10000)}`, 'info');
  updateUI();
}

function doDemotion() {
  const lv = getCityLevel();
  const prevLv = CITY_LEVELS[lv.id - 1];
  gameState.promotionHistory.push({ from: lv.name, to: prevLv.name, turn: gameState.turn, demoted: true });
  gameState.achievementStats.demotions++;
  gameState.achievementStats.consecutivePromotions = 0;
  gameState.achievementStats.consecutiveNonDemotions = 0;
  gameState.cityLevelId = prevLv.id;
  gameState.termTurn = 0;
  gameState.regionTermTurn = 0; // 新地区任期重置
  gameState.termEnd = prevLv.termMonths;
  gameState.deputyPosition = null; // v2.3.6: 降级清除副职
  gameState.investUsage = {}; // 重置工商次数
  gameState.reputation = Math.max(10, gameState.reputation - 15);
  updateCityName();
  showNotification(`降级为${prevLv.title}`, 'danger');
  logEvent(`因政绩不佳，降级为${prevLv.name}，改任${prevLv.title}`, 'warn');
  updateUI();
}

function doContinue() {
  const lv = getCityLevel();
  gameState.termTurn = 0;
  gameState.termEnd = lv.termMonths;
  gameState.investUsage = {}; // 重置工商次数
  gameState.achievementStats.consecutivePromotions = 0;
  gameState.achievementStats.consecutiveNonDemotions = (gameState.achievementStats.consecutiveNonDemotions || 0) + 1;
  gameState.reputation = clamp(gameState.reputation + 3, 0, 100);
  showNotification(`连任成功，开始新的任期`, 'info');
  logEvent(`连任${getOfficialTitle()}，开始第${Math.floor(gameState.turn / lv.termMonths) + 1}个任期`, 'info');
  updateUI();
}

// 异地平调：同等级新地图，人口和经济条件更好
function doTransfer() {
  const lv = getCityLevel();
  const score = Math.round(gameState.livabilityScore * 0.3 + gameState.prosperityScore * 0.2 + gameState.happiness * 0.2 + (100 - gameState.corruption) * 0.15 + gameState.reputation * 0.15);
  gameState.promotionHistory.push({ from: lv.name, to: lv.name, turn: gameState.turn, transfer: true, score });
  gameState.merit = Math.round((gameState.merit || 0) + score * 0.5);
  gameState.termTurn = 0;
  gameState.regionTermTurn = 0;
  gameState.termEnd = lv.termMonths;
  gameState.deputyPosition = null; // v2.3.6: 平调清除副职
  gameState.investUsage = {};
  gameState.achievementStats.consecutiveNonDemotions = (gameState.achievementStats.consecutiveNonDemotions || 0) + 1;
  // 平调到更好的新地图：初始人口和财政提升20%
  const boostedInitPop = Math.round(lv.initPop * 1.2);
  // 调离后债务不继承：清空贷款，重置财政为该等级初始值+50%补贴
  gameState.loans = [];
  gameState.treasury = Math.round(lv.treasury * 0.5);
  // 财产审查：私人财产过多增加纪委风险
  const assetAuditRisk = performAssetAudit();
  gameState.population = Math.max(gameState.population, boostedInitPop);
  gameState.reputation = clamp(gameState.reputation + 5, 0, 100);
  gameState.corruption = Math.max(0, gameState.corruption - 3);
  // 生成新地图
  gameState.mapSeed = randomInt(1, 999999);
  // v2.2.4: 平调到新地图，重新随机分配地图派系
  gameState.mapFaction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
  gameState.buildings = [];
  gameState.buildingCount = 0;
  gameState.zones = [];
  gameState.roads = [];
  gameState.skyscrapers = [];
  usedRoadNames = new Set();
  roadNameCounter = 0;
  gameState.pendingEvents = [];
  gameState.pendingEvent = null;
  // v2.2.6: 地铁/轻轨审批改为人口门槛，不再按城市等级自动获批
  if (gameState.subwayApproved === undefined) gameState.subwayApproved = false;
  if (gameState.lightRailApproved === undefined) gameState.lightRailApproved = false;
  gameState.universityApproved = false;
  // v2.4.7b: 机场审批也需重新申报
  gameState.airportApproved = false;
  if (lv.id >= 1 && !gameState.personnel) initPersonnelSystem();
  else if (lv.id >= 1) resetPersonnelOnPromotion();
  // 生成新地形（按等级扩展地图）
  const ms = getMapSizeForLevel(gameState.cityLevelId);
  MAP_W = ms.w; MAP_H = ms.h;
  offscreenCanvas.width = MAP_W * CELL;
  offscreenCanvas.height = MAP_H * CELL;
  mapCells = generateTerrain(gameState.mapSeed);
  // generateRivers is already called inside generateTerrain
  generateContours(mapCells);
  renderTerrainToOffscreen();
  // 城市名已在平调红头文件中由玩家填写，不再自动更新
  generateStarterCity();
  fitMapToView();
  renderMap();
  showNotification(`异地平调至新${lv.name}，继续担任${lv.title}`, 'info');
  logEvent(`因干部交流制度，平调至新${lv.name}，初始人口${formatPop(gameState.population)}，财政补贴¥${formatMoney(Math.round(lv.treasury * 0.5) * 10000)}`, 'info');
  updateUI();
}

// 退休机制
function triggerRetirement() {
  const lv = getCityLevel();
  const careerYears = Math.floor((gameState.turn - gameState.careerStartTurn) / 12);
  const score = Math.round(gameState.livabilityScore * 0.3 + gameState.prosperityScore * 0.2 + gameState.happiness * 0.2 + (100 - gameState.corruption) * 0.15 + gameState.reputation * 0.15);
  const isClean = gameState.corruption < 20;
  const html = `<div style="font-size:15px;line-height:1.8;">
    <p>经组织批准，${gameState.playerName}同志因达到任职年限，正式办理退休手续。</p>
    <p>仕途履历：从乡镇党委书记${lv.id > 0 ? `逐步晋升至${lv.title}` : ''}，累计任职${careerYears}年。</p>
    <div class="effect-list" style="margin-top:10px;">
      ${effectItem(ICON.star, '最终考核', score + '分', 'pos')}
      ${effectItem(ICON.clock, '仕途总长', careerYears + '年', 'info')}
      ${effectItem(ICON.alert, '腐败指数', gameState.corruption.toFixed(0), gameState.corruption > 30 ? 'neg' : 'pos')}
      ${effectItem(ICON.users, '最终人口', formatPop(gameState.population), 'pos')}
      ${effectItem(ICON.medal, '累计政绩', Math.round(gameState.merit) + '分', 'pos')}
    </div>
    <p style="margin-top:12px;font-size:14px;color:${isClean ? 'var(--green)' : 'var(--red)'};font-weight:600;">${isClean ? '一生清正廉洁，平安着陆，颐养天年。' : '仕途存在污点，虽平安退休，但终有遗憾。'}</p>
  </div>`;
  showModal('光荣退休', html, [
    { text: '功成身退', color: 'blue', action: () => {
      closeModal();
      gameState.gameOver = true;
      showGameOver('retirement', '光荣退休', `${gameState.playerName}同志仕途${careerYears}年，以${lv.title}身份退休。累计政绩${Math.round(gameState.merit)}分。`);
    }},
  ], '仕途终结', 'success');
}

function updateCityName() {
  const lv = getCityLevel();
  const baseName = gameState.cityName.replace(/[镇城县市]+$/, '');
  const suffix = lv.id === 0 ? '镇' : lv.id === 1 ? '县城' : lv.id === 2 ? '市' : lv.id === 3 ? '市' : '市';
  gameState.cityName = baseName + suffix;
}

function checkWinLose() {
  if (gameState.treasury < -5000) { showGameOver('bankruptcy', '财政破产', `${gameState.cityName}财政已严重负债，无力维持城市运转。`); return; }
  if (gameState.reputation < 5) { showGameOver('downfall', '政治危机', `你的政治声誉已降至冰点，被迫引咎辞职。`); return; }
  if (gameState.happiness < 5) { showGameOver('collapse', '城市崩溃', `市民满意度极低，社会秩序崩溃。`); return; }
}

function showGameOver(type, title, msg) {
  gameState.gameOver = true;
  gameState.endReason = type;
  checkAchievements();
  let body = `<p style="font-size:15px;line-height:1.8;">${msg}</p><div class="effect-list" style="margin-top:12px;">`;
  body += `<div class="effect-item"><span class="eff-label">${ICON.clock}任期</span><span class="eff-val pos">${gameState.turn}个月</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">${ICON.users}最终人口</span><span class="eff-val pos">${formatPop(gameState.population)}</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">${ICON.chart}最终GDP</span><span class="eff-val pos">¥${formatMoney(gameState.gdp * 10000)}/月</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">${ICON.heart}宜居度</span><span class="eff-val pos">${gameState.livabilityScore}</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">${ICON.star}繁荣度</span><span class="eff-val pos">${gameState.prosperityScore}</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">${ICON.alert}腐败指数</span><span class="eff-val ${gameState.corruption > 30 ? 'neg' : 'pos'}">${gameState.corruption.toFixed(0)}</span></div>`;
  body += `</div>`;
  if (type === 'retirement') {
    body += `<div style="margin-top:16px;padding:12px;border:1px dashed var(--separator);border-radius:var(--radius);background:linear-gradient(135deg,rgba(176,58,46,0.05),rgba(62,122,85,0.05));text-align:center;">
      <p style="font-size:14px;font-weight:600;color:var(--accent);">「颐养天年」DLC 制作中</p>
      <p style="font-size:12px;color:var(--text-3);margin-top:4px;">退休后的悠闲生活即将开放，敬请期待……</p>
    </div>`;
  }
  showModal(title, body, [{ text: '返回主菜单', color: 'blue', action: () => location.reload() }], type === 'promotion' ? '胜利' : '结局', type === 'promotion' ? 'success' : 'danger');
}

