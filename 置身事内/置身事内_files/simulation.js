/* 源自《置身事内》单文件版 - 模拟引擎 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 模拟引擎 ==============
function simulateMonth() {
  if (gameState.gameOver) return;
  const agg = { pop: 0, jobs: 0, gdp: 0, airPol: 0, waterPol: 0, green: 0, edu: 0, health: 0, safety: 0, power: 0, water: 0, happiness: 0, risk: 0, connectivity: 0, transit: 0, utility: 0, admin: 0, noise: 0 };
  // 预扫描：统计学校数量（用于核电站污染减免）
  let schoolCount = 0, hasUniversity = false;
  for (const b of gameState.buildings) {
    if (b.underConstruction) continue;
    if (b.type === 'elementarySchool' || b.type === 'middleSchool' || b.type === 'highSchool') schoolCount++;
    if (b.type === 'university') { hasUniversity = true; schoolCount++; }
  }
  // 核电站污染减免因子：有大学直接清零，否则按学校数量递减（每所学校减免15%，最高90%）
  const nuclearMitigation = hasUniversity ? 1.0 : Math.min(0.9, schoolCount * 0.15);
  // v2.4.3: 矿产资源衰减与连锁反应预处理
  const mineProductionMap = {};  // "x,y" -> 产量倍率(0-1)
  if (gameState.isResourceCity && gameState.mineralZones && gameState.mineralZones.length > 0) {
    let _prevAvg = 0, _currAvg = 0;
    const _miningIntensity = (gameState.policies && gameState.policies.miningIntensity) || 1.0;
    const _envRestoration = (gameState.policies && gameState.policies.envRestoration) || 0;
    for (const mz of gameState.mineralZones) {
      _prevAvg += mz.production;
      // 衰减：每月产量下降 0.3-0.8 × 开发力度（力度越大衰减越快）
      if (!mz.depleted) {
        const decayRate = (0.3 + Math.random() * 0.5) * _miningIntensity;
        mz.production = Math.max(0, mz.production - decayRate);
        if (mz.production <= 0) {
          mz.production = 0;
          mz.depleted = true;
          logEvent(`${mz.name}已完全枯竭`, 'danger');
        }
      }
      _currAvg += mz.production;
      const mult = mz.production / mz.maxProduction;
      // 更新采矿企业产量倍率
      for (const ent of (gameState.enterprises || [])) {
        if (ent.mineralZoneId === mz.id) {
          ent.productionMult = mult;
        }
      }
      // 建立位置-产量映射
      for (const mb of mz.mineBuildings) {
        mineProductionMap[mb.x + ',' + mb.y] = mult;
      }
    }
    _prevAvg /= gameState.mineralZones.length;
    _currAvg /= gameState.mineralZones.length;
    // 检查是否进入资源枯竭阶段（平均产量低于30%）
    if (!gameState.resourceDepleted && _currAvg <= 30) {
      gameState.resourceDepleted = true;
      gameState.resourceDepletionMonths = 0;
      gameState._noTransformWarningMonths = 0;
      showNotification('资源产量大幅下降，城市进入资源枯竭阶段！', 'danger');
      logEvent('矿产资源产量跌破警戒线，城市正式进入资源枯竭阶段', 'danger');
    }
    if (gameState.resourceDepleted) {
      gameState.resourceDepletionMonths++;
      gameState._noTransformWarningMonths++;
    }
    // 连锁反应：产量下降导致人口流出（产量低于50%时开始），枯竭后惩罚加大
    if (_currAvg < 50) {
      // v2.4.3: 衰减导致失业和人口流出（力度加大）
      const outflowRate = (50 - _currAvg) / 50 * 0.005 * _miningIntensity; // 开发力度越大流出越多
      const popOutflow = Math.round(gameState.population * outflowRate);
      if (popOutflow > 0 && gameState.turn % 3 === 0) {
        gameState.population = Math.max(100, gameState.population - popOutflow);
        logEvent(`矿业衰退导致${popOutflow}人外流`, 'warn');
      }
      // v2.4.3: 财政缩减 — 采矿国企税收随产量下降
      const fiscalLoss = Math.round((50 - _currAvg) * 2 * _miningIntensity);
      if (fiscalLoss > 0 && gameState.turn % 2 === 0) {
        gameState.treasury = Math.max(0, gameState.treasury - fiscalLoss);
      }
    }
    // v2.4.3: 资源枯竭阶段额外惩罚 — GDP和幸福度大幅下降
    if (gameState.resourceDepleted) {
      const depletionPenalty = (30 - Math.min(30, _currAvg)) / 30;
      gameState.happiness = clamp((gameState.happiness || 50) - depletionPenalty * 2, 0, 100);
      gameState.reputation = clamp((gameState.reputation || 50) - depletionPenalty * 0.5, 0, 100);
    }
  }
  for (const b of gameState.buildings) {
    const def = BUILDING_TYPES[b.type]; if (!def) continue;
    // Buildings under construction don't contribute to economy
    if (b.underConstruction) { b.age++; continue; }
    const e = def.eff;
    // 核电站负面效果受本地学校数量减免
    let eWaterPol = e.waterPol||0, eSafety = e.safety||0, eHappiness = e.happiness||0, eRisk = e.risk||0;
    if (b.type === 'nuclearPlant' && nuclearMitigation > 0) {
      eWaterPol = eWaterPol * (1 - nuclearMitigation);
      eSafety = eSafety * (1 - nuclearMitigation);
      eHappiness = eHappiness * (1 - nuclearMitigation);
      eRisk = eRisk * (1 - nuclearMitigation);
    }
    // 公共建筑效果受等级影响 (v1.3.0.0)
    const isPublic = PUBLIC_BUILDING_TYPES.includes(b.type);
    const effMult = isPublic ? (BUILDING_LEVELS[b.level || 1]?.effMult || 1) : 1;
    const facBonus = isPublic && b.facilities ? b.facilities.reduce((sum, fid) => {
      const f = BUILDING_FACILITIES[b.type]?.find(x => x.id === fid);
      if (!f) return sum;
      for (const [k, v] of Object.entries(f.effBonus)) {
        sum[k] = (sum[k] || 0) + v;
      }
      return sum;
    }, {}) : {};
    // v2.2.0 农业地形增益：农田/林地/牧业/鱼塘/农村民居在不同地形上有产能系数
    let terrainBonus = 1;
    if (isPrimarySector(b.type)) {
      const cell = mapCells[b.y * MAP_W + b.x];
      const terrain = cell ? cell.terrain : 'grass';
      terrainBonus = getAgriTerrainBonus(b.type, terrain);
    }
    // v2.4.3: 矿区产量衰减倍率
    let miningMult = 1;
    if (b.type === 'mine') {
      const mp = mineProductionMap[b.x + ',' + b.y];
      if (mp !== undefined) miningMult = mp;
    }
    agg.pop += (e.pop||0) * effMult * (b.type === 'ruralHouse' ? terrainBonus : 1);
    agg.jobs += (e.jobs||0) * effMult * terrainBonus * miningMult + (facBonus.jobs||0);
    agg.gdp += (e.gdp||0) * effMult * terrainBonus * miningMult + (facBonus.gdp||0);
    agg.airPol += e.airPol||0; agg.waterPol += eWaterPol; agg.green += e.green||0;
    agg.edu += (e.edu||0) * effMult + (facBonus.edu||0);
    agg.health += (e.health||0) * effMult + (facBonus.health||0);
    agg.safety += eSafety * effMult + (facBonus.safety||0);
    agg.power += e.power||0; agg.water += e.water||0;
    agg.happiness += eHappiness * effMult + (facBonus.happiness||0);
    agg.risk += eRisk; agg.connectivity += e.connectivity||0; agg.transit += e.transit||0;
    agg.utility += e.utility||0; agg.admin += e.admin||0; agg.noise += e.noise||0; b.age++;
  }
  agg.power += (gameState.externalPower || 0); // 旧存档兼容：保留外部电力字段
  // 人事系统效果
  let personnelHappiness = 0, personnelCorruption = 0, personnelTaxBonus = 0, personnelSafety = 0;
  let personnelEdu = 0, personnelHealth = 0, personnelBuild = 0, personnelCommerce = 0, personnelEmploy = 0;
  if (gameState.personnel && gameState.cityLevelId >= 1) {
    const ps = gameState.personnel;
    const appts = ps.appointments;
    const factionCounts = {};
    const filledCount = Object.keys(appts).length;
    const totalBureaus = BUREAUS.length;
    for (const bId of Object.keys(appts)) {
      const off = ps.officials.find(o => o.id === appts[bId]);
      if (!off) continue;
      const fdef = FACTIONS[off.faction];
      factionCounts[off.faction] = (factionCounts[off.faction] || 0) + 1;
      const comp = off.competence; // 4-7
      const corr = off.corruptionTendency; // 1-5
      const loyal = off.loyalty; // 3-6
      const b = BUREAUS.find(x => x.id === bId);
      if (!b) continue;
      // Bureau-specific effects (大幅增强)
      switch (b.effKey) {
        case 'safety':    personnelSafety += (comp - 4) * 1.5; break;
        case 'tax':       personnelTaxBonus += (comp - 4) * 0.8; break;
        case 'edu':       personnelEdu += (comp - 4) * 3; break;
        case 'health':    personnelHealth += (comp - 4) * 3; break;
        case 'build':     personnelBuild += (comp - 4) * 0.5; break;
        case 'transport': personnelBuild += (comp - 4) * 0.3; break;
        case 'land':      personnelTaxBonus += (comp - 4) * 0.4; break;
        case 'commerce':  personnelCommerce += (comp - 4) * 2; break;
        case 'civil':     personnelHappiness += (comp - 4) * 0.8; break;
        case 'employ':    personnelEmploy += (comp - 4) * 0.5; break;
      }
      // Faction effects (增强)
      if (off.faction === 'local')    { personnelHappiness += 1.0; personnelCorruption += corr * 0.5; }
      else if (off.faction === 'airborne') { personnelCorruption -= 0.5; personnelHappiness -= 0.3; }
      else if (off.faction === 'academic') { personnelTaxBonus += 0.5; personnelEdu += 1; }
      // 低忠诚度干部有概率叛逃带来风险
      if (loyal <= 3 && Math.random() < 0.1) {
        personnelCorruption += 2;
        gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 3, 0, 100);
      }
      // 高贪腐倾向干部增加腐败
      personnelCorruption += corr * 0.3;
      // v2.3.7c: 间谍干部有概率向原派系泄密，增加纪委风险
      if (off._isSpy && Math.random() < 0.15) {
        gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 5, 0, 100);
        logEvent(`${off.name}疑似向外部传递信息，纪委风险上升`, 'warn');
      }
    }
    // v2.4.2: 加大空缺惩罚 — 未任命的局越多，效率越低
    const vacancyRate = 1 - filledCount / totalBureaus;
    if (vacancyRate > 0) {
      personnelHappiness -= vacancyRate * 4;   // v2.4.2: 2→4
      personnelTaxBonus -= vacancyRate * 1;   // v2.4.2: 0.5→1
      personnelSafety -= vacancyRate * 2;      // v2.4.2: 1→2
      // v2.4.2: 空缺过多增加纪委风险
      if (vacancyRate > 0.5) {
        gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 2, 0, 100);
      }
    }
    // v2.4.2: 加大派系独大惩罚
    if (filledCount >= 3) {
      for (const [faction, cnt] of Object.entries(factionCounts)) {
        const ratio = cnt / filledCount;
        if (ratio > 0.6) {
          // v2.4.2: 惩罚翻倍，并增加纪委风险
          personnelHappiness -= 4;    // v2.4.2: 2→4
          personnelCorruption += 2;   // v2.4.2: 1→2
          gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 1, 0, 100);
          logEvent(`${FACTIONS[faction] ? FACTIONS[faction].name : '某派系'}独大局面引发干部群众不满`, 'warn');
          break;
        }
      }
    }
    // 应用效果
    agg.happiness += personnelHappiness;
    agg.edu += personnelEdu;
    agg.health += personnelHealth;
    agg.gdp += personnelCommerce;
    agg.safety = (agg.safety || 0) + personnelSafety;
    if (personnelTaxBonus > 0) {
      const taxBoost = gameState.monthlyRevenue * personnelTaxBonus * 0.01;
      gameState.treasury += Math.round(taxBoost);
    }
    if (personnelEmploy > 0) agg.jobs += Math.round(personnelEmploy * 20);
    gameState.corruption = clamp(gameState.corruption + personnelCorruption * 0.15, 0, 100);
    // 存储当前人事效果摘要供UI显示
    gameState.personnelSummary = {
      happiness: Math.round(personnelHappiness * 10) / 10,
      corruption: Math.round(personnelCorruption * 10) / 10,
      tax: Math.round(personnelTaxBonus * 10) / 10,
      safety: Math.round(personnelSafety * 10) / 10,
      edu: Math.round(personnelEdu * 10) / 10,
      health: Math.round(personnelHealth * 10) / 10,
      gdp: Math.round(personnelCommerce * 10) / 10,
      filled: filledCount,
      total: totalBureaus,
    };
    // v2.4.1b: 常务委员会联动效果（大幅增强）
    if (gameState.committee && gameState.committee.length > 0) {
      let committeeCorruption = 0;
      let committeeCompetenceBonus = 0;
      const pf = gameState.playerFaction;
      let sameFactionMembers = 0;
      let totalNonPlayerMembers = 0;
      for (const m of gameState.committee) {
        if (m.isPlayer || m.isVacant) continue;
        totalNonPlayerMembers++;
        committeeCorruption += (m.corruptionTendency || 1) * 0.2;
        committeeCompetenceBonus += ((m.competence || 5) - 4) * 0.3;
        if (m.faction === pf) sameFactionMembers++;
        // 间谍常委有概率泄密
        if (m._isSpy && Math.random() < 0.12) {
          gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 6, 0, 100);
          logEvent(`常务委员会成员${m.name}疑似向外部传递信息，纪委风险上升`, 'warn');
        }
        // v2.4.1b: 各常委职务的具体联动效果
        if (m.role === 'mayor') {
          // 行政主官能力直接影响GDP和税收
          agg.gdp += ((m.competence || 5) - 4) * 1.5;
          if (m.recruited) agg.gdp += 0.5;
        } else if (m.role === 'deputy') {
          // 分管副书记影响幸福度和行政效率
          agg.happiness += ((m.competence || 5) - 4) * 0.8;
        } else if (m.role === 'discipline') {
          // 纪委书记清廉则降低纪委风险，贪腐则增加
          if ((m.corruptionTendency || 1) <= 2) {
            gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) - 1, 0, 100);
          } else if ((m.corruptionTendency || 1) >= 4) {
            gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 2, 0, 100);
          }
        } else if (m.role === 'organization') {
          // 组织部长能力影响人事系统效率
          if (gameState.personnel && gameState.personnel.officials) {
            // 高能力组织部长每月有小概率提升一名干部能力
            if ((m.competence || 5) >= 6 && Math.random() < 0.05) {
              const available = gameState.personnel.officials.filter(o => !o.recruited && (o.competence || 4) < 7);
              if (available.length > 0) {
                const target = available[Math.floor(Math.random() * available.length)];
                target.competence = Math.min(7, (target.competence || 4) + 1);
              }
            }
          }
        }
      }
      gameState.corruption = clamp(gameState.corruption + committeeCorruption * 0.1, 0, 100);
      agg.gdp += committeeCompetenceBonus;
      // v2.4.1b: 派系一致性影响税收效率（v2.4.2: 加大独大惩罚）
      if (totalNonPlayerMembers > 0) {
        const factionAlignment = sameFactionMembers / totalNonPlayerMembers;
        if (factionAlignment >= 0.75) {
          // 常委中同派系占多数，行政执行力强
          agg.gdp += 1;
        } else if (factionAlignment <= 0.25) {
          // v2.4.2: 异派系占多数惩罚加大
          agg.gdp -= 2;          // v2.4.2: 1→2
          agg.happiness -= 1;    // v2.4.2: 0.5→1
          gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 1, 0, 100);
        }
        // v2.4.2: 检查常委中是否有单一非玩家派系独大（排除玩家派系）
        const committeeFactionCounts = {};
        for (const m of gameState.committee) {
          if (m.isPlayer || m.isVacant || !m.faction) continue;
          committeeFactionCounts[m.faction] = (committeeFactionCounts[m.faction] || 0) + 1;
        }
        for (const [fac, cnt] of Object.entries(committeeFactionCounts)) {
          if (cnt >= 3 && fac !== pf) {
            // v2.4.2: 常委中某非玩家派系独大（3人及以上）
            agg.gdp -= 2;
            agg.happiness -= 1.5;
            gameState.corruption = clamp(gameState.corruption + 2 * 0.15, 0, 100);
            gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 2, 0, 100);
            logEvent(`常委中${FACTIONS[fac] ? FACTIONS[fac].name : '某派系'}独大，影响行政效率和班子团结`, 'warn');
            break;
          }
        }
      }
      // 班子团结度自然衰减（每月微降，需通过活动维持）
      gameState.committeeUnity = clamp((gameState.committeeUnity || 50) - 0.5, 0, 100);
      // 班子团结度过低影响幸福度和效率
      if ((gameState.committeeUnity || 50) < 30) {
        agg.happiness -= 2;
        agg.gdp -= 1;
        // 低团结度有概率产生内斗事件
        if (Math.random() < 0.1) {
          gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 3, 0, 100);
          logEvent('班子内部矛盾加剧，影响工作开展', 'warn');
        }
      }
      // 高团结度有正面效果
      if ((gameState.committeeUnity || 50) >= 75) {
        agg.happiness += 1;
        agg.gdp += 0.5;
      }
      // v2.4.1b: 常委空缺过多严重影响效率
      const vacantCount = gameState.committee.filter(m => m.isVacant).length;
      if (vacantCount >= 2) {
        agg.gdp -= 2;
        agg.happiness -= 1;
        if (Math.random() < 0.15) {
          logEvent('多个常委职务空缺，行政效率严重下降', 'warn');
        }
      }
    }
    // 公共建筑与人事联动 (v1.3.0.0)
    const _ps = gameState.personnel;
    // 教育局长管理学校：高贪腐倾向可能引发学校问题
    const _eduOffId = _ps.appointments['education'];
    if (_eduOffId) {
      const _eduOff = _ps.officials.find(o => o.id === _eduOffId);
      const _schools = gameState.buildings.filter(b => (b.type === 'elementarySchool' || b.type === 'middleSchool' || b.type === 'highSchool' || b.type === 'university') && !b.underConstruction);
      if (_eduOff && _schools.length > 0 && _eduOff.corruptionTendency >= 4) {
        if (Math.random() < 0.08) {
          const _school = _schools[Math.floor(Math.random() * _schools.length)];
          const _sName = _school.customName || '学校';
          logEvent(`${_sName}发生教育问题，教育局长${_eduOff.name}被追究责任`, 'warn');
          gameState.inspectionRisk = clamp((gameState.inspectionRisk||0) + 5, 0, 100);
          gameState.happiness = clamp((gameState.happiness||50) - 3, 0, 100);
          delete _ps.appointments['education'];
          _ps.officials = _ps.officials.filter(o => o.id !== _eduOff.id);
          showNotification(`${_sName}出问题了！教育局长${_eduOff.name}被追责免职`, 'warn');
        }
      }
    }
    // 卫健委主任管理医院
    const _healthOffId = _ps.appointments['health'];
    if (_healthOffId) {
      const _healthOff = _ps.officials.find(o => o.id === _healthOffId);
      const _hospitals = gameState.buildings.filter(b => b.type === 'hospital' && !b.underConstruction);
      if (_healthOff && _hospitals.length > 0 && _healthOff.corruptionTendency >= 4) {
        if (Math.random() < 0.06) {
          const _hosp = _hospitals[Math.floor(Math.random() * _hospitals.length)];
          const _hName = _hosp.customName || '医院';
          logEvent(`${_hName}发生医疗事故，卫健委主任${_healthOff.name}被追究责任`, 'danger');
          gameState.inspectionRisk = clamp((gameState.inspectionRisk||0) + 8, 0, 100);
          gameState.happiness = clamp((gameState.happiness||50) - 5, 0, 100);
          delete _ps.appointments['health'];
          _ps.officials = _ps.officials.filter(o => o.id !== _healthOff.id);
          showNotification(`${_hName}发生医疗事故！卫健委主任${_healthOff.name}被追责免职`, 'danger');
        }
      }
    }
    // 公安局长管理警局
    const _psOffId = _ps.appointments['publicSecurity'];
    if (_psOffId) {
      const _psOff = _ps.officials.find(o => o.id === _psOffId);
      const _policeStations = gameState.buildings.filter(b => b.type === 'police' && !b.underConstruction);
      if (_psOff && _policeStations.length > 0 && _psOff.corruptionTendency >= 4) {
        if (Math.random() < 0.07) {
          const _station = _policeStations[Math.floor(Math.random() * _policeStations.length)];
          const _pName = _station.customName || '警局';
          logEvent(`${_pName}发生违纪事件，公安局长${_psOff.name}被追究责任`, 'warn');
          gameState.corruption = clamp((gameState.corruption||0) + 3, 0, 100);
          gameState.inspectionRisk = clamp((gameState.inspectionRisk||0) + 6, 0, 100);
          delete _ps.appointments['publicSecurity'];
          _ps.officials = _ps.officials.filter(o => o.id !== _psOff.id);
          showNotification(`${_pName}发生违纪事件！公安局长${_psOff.name}被追责免职`, 'warn');
        }
      }
    }
  }
  // 工业区邻近检查：学校/医院靠近工业产生debuff
  let industrialProximityPenalty = 0;
  const industrialBuildings = gameState.buildings.filter(b => {
    const def = BUILDING_TYPES[b.type];
    return def && (def.cat === 'industrial' || def.cat === 'hazardous');
  });
  const sensitiveBuildings = gameState.buildings.filter(b => {
    const def = BUILDING_TYPES[b.type];
    return b.type === 'elementarySchool' || b.type === 'middleSchool' || b.type === 'highSchool' || b.type === 'university' || b.type === 'hospital';
  });
  for (const sb of sensitiveBuildings) {
    for (const ib of industrialBuildings) {
      const dist = Math.abs(sb.x - ib.x) + Math.abs(sb.y - ib.y);
      if (dist <= 3) {
        industrialProximityPenalty += 2;
      }
    }
  }
  if (industrialProximityPenalty > 0) {
    // 随机触发投诉事件
    if (Math.random() < 0.15 && industrialProximityPenalty > 4) {
      gameState.pendingEvents = gameState.pendingEvents || [];
      const hasPending = gameState.pendingEvents.some(e => e.id === 'industrialComplaint');
      if (!hasPending) {
        gameState.pendingEvents.push({
          id: 'industrialComplaint', title: '学校/医院周边污染投诉', tag: '群众投诉', type: 'warn',
          desc: `${gameState.cityName}居民投诉：学校/医院附近工业污染严重影响健康，要求搬迁工业设施或加装环保设备。`,
          choices: [
            { text: '责令工厂搬迁（¥800万）', effects: { treasury: -800, happiness: 5, reputation: 4 }, color: 'green' },
            { text: '加装环保设备（¥300万）', effects: { treasury: -300, happiness: 2 }, color: 'blue' },
            { text: '不管不问', effects: { happiness: -8, reputation: -5, inspection: 5 }, color: 'red' },
          ],
          deadline: gameState.turn + 3,
          issuedTurn: gameState.turn,
          issuedDate: `${gameState.year}.${String(gameState.month).padStart(2,'0')}`,
        });
        gameState.pendingEvent = gameState.pendingEvents[gameState.pendingEvents.length - 1];
      }
    }
    // Apply happiness penalty
    agg.happiness -= Math.min(industrialProximityPenalty, 10);
  }
  // v2.2.1: 使用真实可建格数（calcBuildableArea 返回格数），替代旧的 MAP_W*MAP_H*0.7 近似值
  const buildableArea = calcBuildableArea(mapCells) || (MAP_W * MAP_H * 0.7);
  const popRatio = Math.max(gameState.population / 10000, 0.5);
  const housingCapacity = agg.pop;
  const jobDemand = agg.jobs;
  const desiredPop = Math.min(housingCapacity, Math.max(jobDemand * 2.5, gameState.population * 0.98));
  let popGrowthRate = (desiredPop - gameState.population) / Math.max(gameState.population, 1000) * 0.12;
  popGrowthRate += (gameState.livabilityScore - 50) * 0.001;
  popGrowthRate -= Math.max(0, gameState.airQuality - 100) * 0.0002;
  popGrowthRate -= Math.max(0, gameState.unemployment - 0.12) * 0.04;
  popGrowthRate += (gameState.policies.housingSubsidy || 0) * 0.00003;
  popGrowthRate += (gameState.policies.consumerVoucher || 0) * 0.000015;
  popGrowthRate += (gameState.policies.talentIncentive || 0) * 0.00004;
  popGrowthRate -= Math.max(0, (gameState.policies.interestRate || 3) - 5) * 0.0008;
  popGrowthRate -= Math.max(0, (gameState.policies.mortgageRate || 4) - 4) * 0.0004;
  popGrowthRate = clamp(popGrowthRate, -0.04, 0.10);
  gameState.populationGrowth = popGrowthRate;
  gameState.population = Math.max(100, gameState.population + gameState.population * popGrowthRate);
  const baseGdp = agg.gdp * gameState.gdpMult;
  const bizSubMult = 1 + (gameState.policies.bizSubsidy || 0) * 0.002;
  const voucherMult = 1 + (gameState.policies.consumerVoucher || 0) * 0.0003;
  const interestPenalty = Math.max(0, (gameState.policies.interestRate || 3) - 4) * 0.01;
  const greenBondBoost = (gameState.policies.greenBond || 0) * 0.0005;
  gameState.gdp = baseGdp * bizSubMult * voucherMult * (1 - interestPenalty + greenBondBoost);
  // v2.3.5b: 企业系统 GDP/财政/税收贡献
  let entGdp = 0, entFiscal = 0, entTax = 0;
  const sasacBonus = typeof getSasacEffect === 'function' ? getSasacEffect() : 0;
  const ndrcBonus = typeof getNdrcEffect === 'function' ? getNdrcEffect() : 0;
  for (const ent of (gameState.enterprises || [])) {
    if (ent.acquired && ent.ownership === 'stateOwned') continue;
    const profitMult = typeof getEnterpriseProfitMultiplier === 'function' ? getEnterpriseProfitMultiplier(ent) : 1;
    let entContribution = ent.gdpContribution * (1 + (ent.profitBonus || 0)) * profitMult;
    // v2.4.3: 采矿企业产值随资源衰减
    const entMiningMult = ent.subType === 'mining' ? (ent.productionMult || 1) : 1;
    entContribution *= entMiningMult;
    if (ent.ownership === 'stateOwned' && sasacBonus !== 0) {
      entContribution *= (1 + sasacBonus);
    }
    if (ndrcBonus !== 0) {
      entContribution *= (1 + ndrcBonus);
    }
    entGdp += entContribution;
    let entFiscalContrib = ent.fiscalSupport * (1 + (ent.profitBonus || 0)) * (1 + (ent.ownership === 'stateOwned' ? sasacBonus : 0)) * profitMult;
    entFiscalContrib *= entMiningMult;
    entFiscal += entFiscalContrib;
    // v2.3.5b: 民营和混合所有制产生税收（月度，关联税率）
    if (ent.ownership !== 'stateOwned' && typeof getEnterpriseTax === 'function') {
      entTax += Math.round(getEnterpriseTax(ent) / 12); // 年税收转月
    }
  }
  // 住宅区附属设施
  for (const fac of (gameState.enterpriseFacilities || [])) {
    entGdp += fac.gdpContribution;
  }
  gameState.gdp += entGdp;
  gameState.treasury += Math.round(entFiscal) + entTax;
  gameState.gdpGrowth = (gameState.gdp / Math.max(baseGdp, 1)) - 1;
  gameState.gdpMult = lerp(gameState.gdpMult, 1, 0.3);
  // ====== 经济与财政模型 (基于2024年真实财政数据) ======
  const housingUnits = Math.min(gameState.population, housingCapacity);
  const workforce = gameState.population * 0.55;
  gameState.unemployment = clamp(1 - (agg.jobs / Math.max(workforce, 1)), 0, 0.5);
  gameState.businesses = gameState.buildings.filter(b => { const d = BUILDING_TYPES[b.type]; return d && (d.cat === 'commercial' || d.cat === 'industrial' || d.cat === 'hazardous'); }).length;
  // ====== v2.2.0 农业系统：产业占比 / 城市化率 / 耕地红线 ======
  updateAgriSystem(agg, buildableArea);
  // ====== 财政收入模型 (分税制, 参考2024年财政部决算数据) ======
  // 1. 增值税（地方分享50%, 占地方税收40%）— 与GDP/工业商业产出强相关
  const industrialGdp = agg.gdp * 0.45; // 工业增加值约占GDP 45%
  const vatRate = gameState.policies.businessTax / 100; // 增值税率约6-13%
  // v2.4.6: 行政区划升级后地方留成比例提高（fiscalRemitRate > 1.0 表示留成增加）
  const _localShareBonus = gameState.fiscalRemitRate || 1.0;
  const vatLocalShare = industrialGdp * vatRate * 0.50 * _localShareBonus; // 原地方50%，升级后按倍率增加

  // 2. 企业所得税（地方分享40%）— v2.3.6: 直接联动企业系统利润计算，不再用旧算法
  const citRate = 0.25; // 企业所得税率25%
  const entStatsForCit = typeof getEnterpriseStats === 'function' ? getEnterpriseStats() : { totalProfit: 0, totalTax: 0 };
  // 企业系统总利润 × 25%税率 × 地方40%分享 + 旧系统部分（无企业时的基础值）
  const citLocalShare = ((entStatsForCit.totalProfit * citRate * 0.40) + (entStatsForCit.totalProfit === 0 ? baseGdp * 0.12 * citRate * 0.40 : 0)) * _localShareBonus;

  // 3. 个人所得税（地方分享40%, 占地方税收7%）— 与居民收入/就业相关
  const avgIncome = gameState.gdp / Math.max(gameState.population, 1) * 0.45; // 居民可支配收入约占GDP人均45%
  const pitRate = gameState.policies.incomeTax / 100;
  const pitLocalShare = gameState.population * avgIncome * pitRate * 0.40 * _localShareBonus; // 地方分享40%

  // 4. 房产税（100%归地方, 占地方税收5.6%）— 与房地产存量相关
  const propertyTaxRev = housingUnits * 80 * gameState.policies.propertyTax / 100 / 12;

  // 5. 城市维护建设税（100%归地方, 占地方税收5.7%）— 基于增值税
  const urbanTax = vatLocalShare * 0.07;

  // 6. 土地增值税+契税+城镇土地使用税（100%归地方, 合计约16%）— 与房地产交易相关
  const realEstateActivity = Math.min(1, housingUnits / Math.max(gameState.population, 1));
  const landRelatedTax = baseGdp * 0.015 * realEstateActivity * (gameState.policies.landPrice / 1.0);

  // 7. 印花税（100%归地方, 占2.6%）
  const stampTax = baseGdp * 0.003;

  // 8. 非税收入（行政事业性收费等, 占一般公共预算收入29.9%）
  const nonTaxRevenue = baseGdp * 0.02 * (1 + gameState.businesses * 0.001);

  // 9. 土地出让金（政府性基金, 独立于税收, 占地方政府基金收入80%+, 高波动）
  const landSaleRev = gameState.policies.landPrice > 1
    ? baseGdp * 0.04 * (gameState.policies.landPrice - 1) * (0.7 + Math.random() * 0.6) // ±30%波动
    : 0;

  // 合计税收收入
  const taxRevenue = vatLocalShare + citLocalShare + pitLocalShare + propertyTaxRev + urbanTax + landRelatedTax + stampTax;
  // 合计一般公共预算收入（税收+非税）
  const generalBudgetRevenue = taxRevenue + nonTaxRevenue;

  // 10. 转移支付（每年一次, 与GDP反比例: GDP越高给的越少）
  // 逻辑：经济越发达的城市越不依赖转移支付，欠发达城市获得更多补助
  let transferPayment = 0;
  const fiscalGap = Math.max(0, (gameState.buildings.length * 5 + gameState.population * 0.5) - generalBudgetRevenue);
  if (gameState.turn > 0 && gameState.turn % TRANSFER_PAYMENT_INTERVAL === 0) {
    const lv = getCityLevel();
    // GDP反比例因子：GDP越高，转移支付系数越低
    // 基准GDP = 5000万（月GDP），当GDP=5000时因子=1，GDP=10000时因子=0.3，GDP=2500时因子=1.5
    const gdpFactor = Math.max(0.05, 3000 / Math.max(gameState.gdp, 300));
    // 城市等级修正：低等级城市获得更多
    const levelFactor = Math.max(0.2, 0.8 - lv.id * 0.12);
    // 宜居度修正
    const livabilityFactor = (1 + (gameState.livabilityScore - 50) / 300);
    transferPayment = Math.round(TRANSFER_PAYMENT_BASE * gdpFactor * levelFactor * livabilityFactor + fiscalGap * 0.15);
    gameState.treasury += transferPayment;
    logEvent(`收到年度转移支付¥${formatMoney(transferPayment * 10000)}`, 'info');
  }

  // v2.4.6: 行政区划升级后的月度财政扶持资金
  if (gameState.fiscalSupportMonthly > 0) {
    gameState.treasury += gameState.fiscalSupportMonthly;
    if (gameState.turn % 12 === 0) {
      logEvent(`收到上级财政扶持资金¥${formatMoney(gameState.fiscalSupportMonthly * 12 * 10000)}/年`, 'success');
    }
  }

  // 月度收入 = 税收(月度化) + 非税(月度化) + 土地出让金(月度化)
  gameState.monthlyRevenue = (generalBudgetRevenue / 12) + (landSaleRev / 12);
  // 存储详细收入分解（用于统计面板显示）
  gameState.revenueBreakdown = {
    vat: vatLocalShare / 12,
    cit: citLocalShare / 12,
    pit: pitLocalShare / 12,
    property: propertyTaxRev,
    urban: urbanTax / 12,
    landRelated: landRelatedTax / 12,
    stamp: stampTax / 12,
    nonTax: nonTaxRevenue / 12,
    landSale: landSaleRev / 12,
    transfer: transferPayment / TRANSFER_PAYMENT_INTERVAL, // 月均转移支付
    enterpriseTax: entTax, // v2.3.5c: 企业系统税收（月度）
    enterpriseFiscal: Math.round(entFiscal), // v2.3.5c: 企业系统财政扶持（月度）
  };

  // 财政收入不得超过GDP的指定比例（一般公共预算/GDP约16%）
  const revenueCap = gameState.gdp * REVENUE_GDP_CAP_RATIO;
  if (gameState.monthlyRevenue > revenueCap) {
    gameState.monthlyRevenue = revenueCap;
  }

  // ====== 财政支出模型 (参考2024年支出结构, 开局默认平衡) ======
  // 核心原则：支出 ≈ 收入的 55-70%，留出建设空间
  const totalRevenue = gameState.monthlyRevenue;
  // 1. 建筑维护（基础设施运维）— 仅对非道路建筑收费
  // v2.2.8c: 农业建筑维护费大幅降低（农田靠天吃饭，0.1万/格；其他农业0.2万/格）
  const nonRoadBuildings = gameState.buildings.filter(b => b.type !== 'road');
  let buildingMaint = 0;
  for (const b of nonRoadBuildings) {
    if (b.type === 'farmland') buildingMaint += 0.1;
    else if (isPrimarySector(b.type)) buildingMaint += 0.2;
    else buildingMaint += 0.5;
  }
  // 2. 教育支出
  const eduExp = totalRevenue * (gameState.policies.eduBudget || 15) / 100 * 0.5;
  // 3. 社会保障支出
  const socialExp = totalRevenue * 0.06 + gameState.population * 0.005;
  // 4. 医疗卫生支出
  const healthExp = totalRevenue * (gameState.policies.healthBudget || 8) / 100 * 0.5;
  // 5. 基础设施支出
  const infraExp = totalRevenue * (gameState.policies.infraBudget || 12) / 100 * 0.4;
  // 6. 行政管理支出
  const adminExp = nonRoadBuildings.length * 0.08 + totalRevenue * 0.02;
  // 7. 贷款还本付息（含逾期利息）
  let loanPayment = 0;
  if (gameState.loans && gameState.loans.length > 0) {
    for (const loan of gameState.loans) {
      if (loan.remainingMonths > 0) {
        let payment = loan.monthlyPayment;
        // 逾期利息：如果财政为负（无法按期还款），累计逾期罚息
        if (gameState.treasury < 0 && !gameState.generousFinance) {
          const overdueRate = 0.005; // 逾期月利率0.5%
          const overdueInterest = Math.round(loan.amount * overdueRate);
          loan.overdueInterest = (loan.overdueInterest || 0) + overdueInterest;
          payment += overdueInterest;
          if (gameState.turn % 6 === 0) {
            logEvent(`贷款逾期罚息¥${formatMoney(overdueInterest * 10000)}（累计逾期¥${formatMoney(loan.overdueInterest * 10000)}）`, 'warn');
          }
        }
        // 如果还不起，扣到负数也要扣
        loanPayment += payment;
        loan.remainingMonths--;
        if (loan.remainingMonths <= 0) {
          // 还清时一并收取累计逾期利息
          if (loan.overdueInterest > 0) {
            loanPayment += loan.overdueInterest;
            logEvent(`贷款已还清：¥${formatMoney(loan.amount * 10000)}（含逾期罚息¥${formatMoney(loan.overdueInterest * 10000)}）`, 'info');
          } else {
            logEvent(`贷款已还清：¥${formatMoney(loan.amount * 10000)}（${loan.term}月期）`, 'info');
          }
        }
      }
    }
    // Remove paid-off loans
    gameState.loans = gameState.loans.filter(l => l.remainingMonths > 0);
  }
  // 8. 债务付息（随债务规模增长, 约4-5%）
  const debtService = gameState.treasury < 0 ? Math.abs(gameState.treasury) * 0.002 : 0;
  // 9. 黑社会打手月维护费
  const thugMaintCost = (gameState.underworld?.thugs || 0) * 1; // 1万/人/月
  // 10. 摩天大楼月维护费（非省会城市）
  let skyMaintCost = 0;
  if (gameState.skyscrapers) {
    for (const sk of gameState.skyscrapers) {
      if (sk.monthlyMaint) skyMaintCost += sk.monthlyMaint;
    }
  }
  // 11. 变电站购电费 + 水泵站抽水费（按GDP比率收取）
  const monthlyGDP = agg.gdp || gameState.gdp || 0;
  const substationCount = gameState.buildings.filter(b => b.type === 'substation' && !b.underConstruction).length;
  const waterPumpCount = gameState.buildings.filter(b => b.type === 'waterPump' && !b.underConstruction).length;
  // 变电站购电费 = GDP × 0.5% × 变电站数量（最低50万/座）
  const substationCost = substationCount * Math.max(50, Math.round(monthlyGDP * 0.005));
  // 水泵站抽水费 = GDP × 0.4% × 水泵站数量（最低40万/座）
  const waterPumpCost = waterPumpCount * Math.max(40, Math.round(monthlyGDP * 0.004));
  // 存储到gameState供成就判定使用
  gameState.substationCost = substationCost;
  gameState.waterPumpCost = waterPumpCost;
  gameState.powerBalance = agg.power; // 正=供电有余, 负=供电不足
  gameState.waterBalance = agg.water; // 正=供水有余, 负=供水不足
  gameState.monthlyExpenditure = buildingMaint + eduExp + socialExp + healthExp + infraExp + adminExp + loanPayment + debtService + thugMaintCost + skyMaintCost + substationCost + waterPumpCost;
  // v2.2.7d: 存储财政支出明细供UI显示
  gameState.expenditureBreakdown = {
    buildingMaint, eduExp, socialExp, healthExp, infraExp, adminExp,
    loanPayment, debtService, thugMaintCost, skyMaintCost, substationCost, waterPumpCost,
  };
  // v2.2.5c: 公共交通运营成本
  let transitOpCost = 0;
  if (typeof getTransitOperatingCost === 'function') {
    transitOpCost = getTransitOperatingCost();
    gameState.monthlyExpenditure += transitOpCost;
  }
  // v2.2.5c: 公交补贴收入（财政补贴减少支出）
  const transitSubsidy = (gameState.policies && gameState.policies.transitSubsidy) || 0;
  if (transitSubsidy > 0) {
    gameState.monthlyExpenditure = Math.max(0, gameState.monthlyExpenditure - transitSubsidy);
  }
  // v2.2.5c: 票务收入（基于票价和客流量）
  let transitRevenue = 0;
  if (transitOpCost > 0) {
    const fare = (gameState.policies && gameState.policies.transitFare) || 1.0;
    // 票务收入 ≈ 运营成本 × 票价倍率 × 0.6（真实地铁票务收入约覆盖60%运营成本）
    transitRevenue = transitOpCost * fare * 0.6;
    gameState.monthlyRevenue += transitRevenue;
  }
  gameState.transitOpCost = transitOpCost;
  gameState.transitRevenue = transitRevenue;
  // v2.2.7d: 补充公共交通相关支出到明细
  if (gameState.expenditureBreakdown) {
    gameState.expenditureBreakdown.transitOpCost = transitOpCost;
    gameState.expenditureBreakdown.transitSubsidy = transitSubsidy;
  }
  // 防止数值溢出：支出限制
  gameState.monthlyExpenditure = Math.max(0, Math.min(gameState.monthlyExpenditure, 999999));
  gameState.monthlyRevenue = Math.max(0, Math.min(gameState.monthlyRevenue, 999999));
  // Crime rate effects on happiness
  if (gameState.underworld) {
    const cr = gameState.underworld.crimeRate;
    if (cr > 30) { applyEffects({ happiness: -1 * (cr - 30) / 10 }); }
    // Crime rate naturally drifts down slightly
    gameState.underworld.crimeRate = Math.max(0, gameState.underworld.crimeRate - 0.5);
    // Crackdown level decays
    gameState.underworld.crackdownLevel = Math.max(0, gameState.underworld.crackdownLevel - 2);
  }
  gameState.treasury += gameState.monthlyRevenue - gameState.monthlyExpenditure;
  // ====== 贫困地区机制 ======
  // 财政赤字 = 月度收入 < 月度支出
  if (!gameState.generousFinance) {
    const monthlyBal = gameState.monthlyRevenue - gameState.monthlyExpenditure;
    const isDeficit = monthlyBal < 0;
    if (isDeficit) {
      gameState.deficitMonths = (gameState.deficitMonths || 0) + 1;
      gameState.postGrantDeficitMonths = (gameState.postGrantDeficitMonths || 0) + 1;
      gameState.alleviationMonths = 0;
    } else {
      gameState.deficitMonths = 0;
      gameState.postGrantDeficitMonths = 0;
      gameState.alleviationMonths = (gameState.alleviationMonths || 0) + 1;
    }
    // 触发贫困地区：连续6个月赤字
    if ((gameState.povertyStatus || 'normal') === 'normal' && gameState.deficitMonths >= 6) {
      const grant = Math.round(gameState.monthlyExpenditure * 3);
      gameState.treasury += grant;
      gameState.povertyStatus = 'poverty';
      gameState.povertyGrantReceived = true;
      gameState.postGrantDeficitMonths = 0;
      showNotification(`连续6个月财政赤字，触发贫困地区机制！获专项拨款¥${formatMoney(grant * 10000)}`, 'warn');
      logEvent(`财政连续赤字6个月，被评为贫困地区，获专项拨款¥${formatMoney(grant * 10000)}`, 'warn');
    }
    // 升级特困地区：领取拨款后仍连续3个月赤字
    if (gameState.povertyStatus === 'poverty' && gameState.postGrantDeficitMonths >= 3) {
      const grant = Math.round(gameState.monthlyExpenditure * 3);
      gameState.treasury += grant;
      gameState.povertyStatus = 'extreme';
      gameState.alleviationMonths = 0;
      showNotification(`财政持续恶化，被评为"特困地区"！再获3个月财政拨款¥${formatMoney(grant * 10000)}`, 'danger');
      logEvent(`领取拨款后仍连续3个月赤字，被评为特困地区，再获拨款¥${formatMoney(grant * 10000)}`, 'danger');
    }
    // 脱贫摘帽：连续12个月无赤字
    if ((gameState.povertyStatus === 'poverty' || gameState.povertyStatus === 'extreme') && gameState.alleviationMonths >= 12) {
      gameState.povertyStatus = 'normal';
      gameState.povertyGrantReceived = false;
      gameState.deficitMonths = 0;
      gameState.postGrantDeficitMonths = 0;
      gameState.alleviationMonths = 0;
      showNotification('连续12个月财政收支平衡，脱贫摘帽！', 'success');
      logEvent('连续12个月无财政赤字，脱贫摘帽', 'success');
    }
  }
  // ====== v2.4.3: 资源枯竭型城市 — 产业转型与惩罚机制 ======
  if (gameState.resourceDepleted) {
    // v2.4.3: 生态修复政策效果
    const _envRest = (gameState.policies && gameState.policies.envRestoration) || 0;
    if (_envRest > 0 && gameState.treasury >= _envRest) {
      gameState.treasury -= _envRest;
      gameState.happiness = clamp((gameState.happiness || 50) + _envRest * 0.02, 0, 100);
      gameState.airQuality = clamp((gameState.airQuality || 50) + _envRest * 0.05, 0, 200);
    }
    // 产业转型项目月度处理
    if (gameState.transformationProject && !gameState.transformationProject.completed) {
      const tp = gameState.transformationProject;
      // v2.4.3: 转型资金投入倍率影响月度投入和进度
      const _transFund = (gameState.policies && gameState.policies.transformationFunding) || 1.0;
      const monthlyCost = Math.round(tp.monthlyCost * _transFund);
      if (gameState.treasury >= monthlyCost) {
        gameState.treasury -= monthlyCost;
        tp.totalInvested = (tp.totalInvested || 0) + monthlyCost;
        tp.monthsCompleted++;
        if (tp.monthsCompleted >= tp.monthsRequired) {
          tp.completed = true;
          // 解锁转型增益
          if (tp.type === 'tourism') {
            gameState.transformationBonus = { type: 'tourism', gdpMult: 1.15, happinessBonus: 5, commerceBonus: 0 };
            showNotification('产业转型成功！城市已转型为文旅型城市，GDP+15%，幸福度+5', 'success');
            logEvent('文旅产业转型规划完成，城市获得文旅型城市增益', 'success');
          } else if (tp.type === 'logistics') {
            gameState.transformationBonus = { type: 'logistics', gdpMult: 1.12, happinessBonus: 2, commerceBonus: 20 };
            showNotification('产业转型成功！城市已转型为物流枢纽城市，GDP+12%，商业+20', 'success');
            logEvent('物流产业转型规划完成，城市获得物流枢纽城市增益', 'success');
          }
          gameState._noTransformWarningMonths = 0;
        }
      } else {
        // 财政不足，暂停进度
        logEvent('财政资金不足，产业转型进度暂停', 'warn');
      }
    } else if (!gameState.transformationProject) {
      // 未启动转型 — 逐步触发惩罚机制
      const wMonths = gameState._noTransformWarningMonths || 0;
      // 6个月未转型：班子免职问责
      if (wMonths === 6) {
        showNotification('资源枯竭迟迟未启动转型，上级对班子启动免职问责！', 'danger');
        logEvent('上级对资源枯竭城市班子启动免职问责程序', 'danger');
        gameState.reputation = clamp(gameState.reputation - 15, 0, 100);
        gameState.happiness = clamp(gameState.happiness - 5, 0, 100);
        // 免职一名常委（非玩家）
        if (gameState.committee) {
          const nonPlayer = gameState.committee.filter(m => !m.isPlayer && !m.isVacant);
          if (nonPlayer.length > 0) {
            const target = nonPlayer[Math.floor(Math.random() * nonPlayer.length)];
            target.isVacant = true;
            logEvent(`常委${target.name}因问责被免职`, 'danger');
          }
        }
      }
      // 12个月未转型：提级巡视
      if (wMonths === 12) {
        const lockdownTurns = 2 + Math.floor(Math.random() * 2);
        gameState.inspectionLockdown = lockdownTurns;
        gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 20, 0, 100);
        showNotification(`资源枯竭城市长期未转型，上级提级巡视进驻！锁定${lockdownTurns}个月`, 'danger');
        logEvent('资源枯竭城市长期未启动产业转型，上级纪委提级巡视进驻', 'danger');
      }
      // 18个月未转型：贫困县锁定
      if (wMonths === 18 && (gameState.povertyStatus || 'normal') === 'normal') {
        gameState.povertyStatus = 'poverty';
        gameState.povertyGrantReceived = false;
        gameState.deficitMonths = 6;
        showNotification('资源枯竭导致经济崩溃，城市被锁定为贫困地区！', 'danger');
        logEvent('资源枯竭叠加长期不转型，城市被上级锁定为贫困地区', 'danger');
      }
    }
  }
  // v2.4.3: 转型增益应用
  if (gameState.transformationBonus) {
    const tb = gameState.transformationBonus;
    gameState.gdp *= (tb.gdpMult || 1);
    if (tb.happinessBonus) {
      gameState.happiness = clamp(gameState.happiness + tb.happinessBonus * 0.1, 0, 100);
    }
  }
  // 防止数值溢出：财政限制在合理范围
  gameState.treasury = clamp(gameState.treasury, -99999, 9999999);
  // 防止数值溢出：人口限制
  gameState.population = clamp(gameState.population, 100, 99999999);
  // 防止数值溢出：GDP限制
  gameState.gdp = clamp(gameState.gdp, 0, 9999999999);
  // 防止数值溢出：私人账户限制
  gameState.privateAccount = Math.max(0, Math.min(gameState.privateAccount, 999999));
  // 宽裕财政模式：保持财政无限
  if (gameState.generousFinance) {
    gameState.treasury = 999999;
  }

  // ====== 工程进度推进 ======
  if (gameState.constructionProjects && gameState.constructionProjects.length > 0) {
    const completed = [];
    for (const proj of gameState.constructionProjects) {
      if (proj.completed) continue;
      // Advance construction progress by 1 month
      proj.elapsedMonths++;
      // Determine if this month requires a payment
      const paymentInterval = Math.ceil(proj.totalMonths / proj.totalInstallments);
      if (proj.elapsedMonths % paymentInterval === 0 && proj.paidInstallments < proj.totalInstallments) {
        const installmentAmount = proj.installmentAmount;
        if (proj.deferredPayments > 0) {
          // Player chose to defer this installment
          proj.deferredPayments--;
          proj.accruedDebt += installmentAmount;
          proj.paidInstallments++;
          logEvent(`${proj.name}：本月工程款¥${formatMoney(installmentAmount * 10000)}已拖欠（累计拖欠¥${formatMoney(proj.accruedDebt * 10000)}）`, 'warn');
        } else if (gameState.treasury >= installmentAmount) {
          // Pay installment
          gameState.treasury -= installmentAmount;
          proj.paidInstallments++;
          proj.paidAmount += installmentAmount;
        } else {
          // Not enough money — auto-defer
          proj.accruedDebt += installmentAmount;
          proj.paidInstallments++;
          logEvent(`${proj.name}：财政资金不足，本月工程款¥${formatMoney(installmentAmount * 10000)}自动拖欠`, 'danger');
        }
      }
      // Check if construction is complete
      if (proj.elapsedMonths >= proj.totalMonths) {
        proj.completed = true;
        // Mark buildings as operational
        for (const b of gameState.buildings) {
          if (b.constructionProjectId === proj.id) {
            b.underConstruction = false;
            b.age = 0;
          }
        }
        // Pay off any accrued debt
        if (proj.accruedDebt > 0) {
          if (gameState.treasury >= proj.accruedDebt) {
            gameState.treasury -= proj.accruedDebt;
            logEvent(`${proj.name}：工程竣工，结清拖欠工程款¥${formatMoney(proj.accruedDebt * 10000)}`, 'info');
          } else {
            // Debt remains, will be paid over time
            logEvent(`${proj.name}：工程竣工，但仍有¥${formatMoney(proj.accruedDebt * 10000)}拖欠工程款未结清`, 'warn');
            // Add as a loan-like obligation
            gameState.loans.push({
              amount: proj.accruedDebt,
              term: 12,
              remainingMonths: 12,
              monthlyPayment: proj.accruedDebt / 12,
              startDate: gameState.turn,
              isConstructionDebt: true,
            });
          }
          proj.accruedDebt = 0;
        }
        logEvent(`${proj.name}：工程竣工！历时${proj.totalMonths}个月`, 'success');
        completed.push(proj.id);
      }
    }
    // Remove completed projects from active list (keep for history)
    // gameState.constructionProjects = gameState.constructionProjects.filter(p => !p.completed);
  }

  // 股市波动模拟
  simulateStockMarket();
  // 私人账户投资项目月度收益
  simulatePrivateAssets();
  // 月工资收入
  const lv = getCityLevel();
  if (lv.salary) {
    gameState.privateAccount += lv.salary;
  }
  // v2.3.5: 个人企业月利润（v2.3.6: 代持人能力影响利润，贪腐倾向直接增加腐败值）
  // v2.3.6b: 每持有一个企业回合（月）增加纪委风险+1
  if (gameState.personalCompanies && gameState.personalCompanies.length > 0) {
    let pcProfit = 0;
    // v2.3.6b: 每持有一个企业每月纪委风险+1
    const ownedCount = gameState.personalCompanies.filter(pc => pc.status === '经营中').length;
    if (ownedCount > 0) {
      gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + ownedCount);
    }
    for (const pc of gameState.personalCompanies) {
      if (pc.status === '经营中') {
        let profit = pc.monthlyProfit;
        if (pc.heldBy && gameState.personnel) {
          const holder = gameState.personnel.officials.find(o => o.id === pc.heldBy);
          if (holder) {
            // 代持人能力影响利润：能力越高利润越高（能力4-7）
            const abilityMult = 0.7 + (holder.competence - 3) * 0.1;
            profit = Math.round(profit * abilityMult);
            // v2.3.6b: 直接复用原贪腐值，贪腐倾向高的代持人每月增加腐败值
            if (holder.corruptionTendency >= 4) {
              gameState.corruption = clamp((gameState.corruption || 0) + (holder.corruptionTendency - 3) * 0.2, 0, 100);
            }
          }
        }
        pcProfit += profit;
      }
    }
    if (pcProfit > 0) {
      gameState.privateAccount += pcProfit;
    }
  }
  // 环保法规因子：法规越严格，污染影响越小（修正：原逻辑反了）
  const envRegLevel = gameState.policies.envRegulation || 1;
  const envReduction = 1 - Math.min(0.8, (envRegLevel - 1) * 0.08); // 法规等级1=无减免，等级10=减免72%
  const greenAbsorption = Math.max(0, agg.green) * 3;
  // 空气质量：基准35（AQI越低越好），污染正向值提高AQI，净化建筑降低AQI，绿化吸收
  // 污染影响：正airPol提高AQI（变差），受环保法规减免
  const airPollutionEffect = Math.max(0, agg.airPol) * envReduction;
  // 净化效果：负airPol降低AQI（变好），不受法规影响
  const airPurifyEffect = Math.abs(Math.min(0, agg.airPol));
  gameState.airQuality = clamp(35 + airPollutionEffect - airPurifyEffect - greenAbsorption, 10, 500);
  // 水质：基准90，污染正向值（正waterPol）降低水质，净化建筑（负waterPol）提升水质，绿化也有净水作用
  const waterGreenAbsorption = Math.max(0, agg.green) * 0.5;
  // 污染影响：正waterPol降低水质
  const waterPollutionEffect = Math.max(0, agg.waterPol) * envReduction * 0.8;
  // 净化效果：负waterPol提升水质（取绝对值）
  const waterPurifyEffect = Math.abs(Math.min(0, agg.waterPol)) * 0.5;
  gameState.waterQuality = clamp(90 - waterPollutionEffect + waterPurifyEffect + waterGreenAbsorption, 0, 100);
  gameState.greenCoverage = clamp((Math.max(0, agg.green) / buildableArea) * 100, 0, 95);
  // 噪音：基准35dB，工业区噪音+建筑密度，隔音屏障吸收
  gameState.noiseLevel = clamp(35 + Math.max(0, agg.airPol) * 0.05 + gameState.buildings.length * 0.03 + agg.noise, 25, 85);
  const eduFromBudget = (eduExp / popRatio) * 0.5;
  gameState.educationIndex = clamp(20 + agg.edu / popRatio + eduFromBudget, 0, 100);
  const healthFromBudget = (healthExp / popRatio) * 0.5;
  gameState.healthcareIndex = clamp(15 + agg.health / popRatio + healthFromBudget, 0, 100);
  gameState.publicSafety = clamp(20 + agg.safety + agg.admin * 2, 0, 100);
  let happyTarget = 50;
  happyTarget += gameState.airQuality < 100 ? 10 : -(gameState.airQuality - 100) * 0.1;
  happyTarget += (gameState.waterQuality - 70) * 0.2;
  happyTarget += gameState.greenCoverage * 0.3;
  happyTarget += (gameState.educationIndex - 30) * 0.2;
  happyTarget += (gameState.healthcareIndex - 30) * 0.2;
  happyTarget += (gameState.publicSafety - 30) * 0.2;
  happyTarget += agg.happiness / Math.max(popRatio, 1);
  happyTarget -= gameState.unemployment * 100;
  happyTarget -= Math.max(0, gameState.corruption - 30) * 0.1;
  happyTarget = clamp(happyTarget, 0, 100);
  gameState.happiness = lerp(gameState.happiness, happyTarget, 0.3);
  const airScore = gameState.airQuality <= 50 ? 100 : gameState.airQuality <= 100 ? 80 : gameState.airQuality <= 150 ? 55 : gameState.airQuality <= 200 ? 30 : 10;
  const waterScore = gameState.waterQuality >= 80 ? 100 : gameState.waterQuality >= 60 ? 75 : gameState.waterQuality >= 40 ? 50 : 25;
  const greenScore = Math.min(100, gameState.greenCoverage * 4);
  const unemployScore = clamp(100 - gameState.unemployment * 500, 0, 100);
  gameState.livabilityScore = Math.round(airScore * 0.15 + waterScore * 0.1 + greenScore * 0.1 + gameState.educationIndex * 0.15 + gameState.healthcareIndex * 0.15 + gameState.publicSafety * 0.1 + gameState.happiness * 0.15 + unemployScore * 0.1);
  gameState.prosperityScore = Math.round(clamp((gameState.gdp / 100) * 0.3 + (gameState.population / 1000) * 0.2 + gameState.livabilityScore * 0.3 + gameState.happiness * 0.2, 0, 100));
  gameState.corruption = Math.max(0, gameState.corruption - 0.5);
  // v2.3.0: inspectionRisk 使用 lerp 向腐败基线靠拢，而非直接覆盖
  // 这样事件/人事带来的临时压力会随时间衰减但不会被立即清除
  const inspectionBase = gameState.corruption * 0.8 + Math.max(0, gameState.corruption - 30) * 2;
  gameState.inspectionRisk = clamp(lerp(gameState.inspectionRisk || 0, inspectionBase, 0.3), 0, 100);
  let repTarget = 50 + (gameState.livabilityScore - 50) * 0.3 + (gameState.happiness - 50) * 0.2 - gameState.corruption * 0.3 + agg.admin * 0.5;
  gameState.reputation = clamp(lerp(gameState.reputation, repTarget, 0.15), 0, 100);
  gameState.merit = Math.round((gameState.merit || 0) + Math.max(0, gameState.livabilityScore - 60) * 0.5 + Math.max(0, gameState.gdp - 500) * 0.01);
  // 拥有打手时降低群众事件触发概率（威慑效果）
  const thugSuppress = Math.min(0.08, (gameState.underworld?.thugs || 0) * 0.005);
  if (Math.random() < (0.20 - thugSuppress)) checkEvents();
  // 个人事件冷却递减（子选项卡系统，不再自动弹窗）
  if (gameState.personalEventCooldowns) {
    for (const eid in gameState.personalEventCooldowns) {
      if (gameState.personalEventCooldowns[eid] > 0) gameState.personalEventCooldowns[eid]--;
    }
  }
  // 随机事件冷却递减（已处理过的事件一段时间内不重复）
  if (gameState.eventCooldowns) {
    for (const eid in gameState.eventCooldowns) {
      if (gameState.eventCooldowns[eid] > 0) gameState.eventCooldowns[eid]--;
      else delete gameState.eventCooldowns[eid];
    }
  }
  // 党校学习冷却递减
  if (gameState.partySchoolCooldown > 0) {
    gameState.partySchoolCooldown--;
    if (gameState.partySchoolCooldown === 0 && gameState._pendingDegree) {
      setTimeout(() => startDegreeExam(), 500);
    }
  }
  // 伪造学历风险检查
  if (gameState.degreeFake && Math.random() < 0.04) {
    // 检查教育局长是否举报
    const _ps = gameState.personnel;
    if (_ps) {
      const _eduOffId = _ps.appointments['education'];
      if (_eduOffId) {
        const _eduOff = _ps.officials.find(o => o.id === _eduOffId);
        if (_eduOff && _eduOff.loyalty < 4 && Math.random() < 0.4) {
          showNotification(`教育局长${_eduOff.name}举报你学历造假！`, 'danger');
          logEvent(`教育局长${_eduOff.name}举报学历造假`, 'danger');
          gameState.inspectionRisk = clamp((gameState.inspectionRisk||0) + 20, 0, 100);
          gameState.degreeFake = false; // 被揭穿
          gameState.playerDegree = null;
        }
      }
    }
    // 纪委直接发现
    if (gameState.degreeFake && Math.random() < 0.15) {
      showNotification('纪委检查发现你的学历系伪造！罪加一等', 'danger');
      logEvent('纪委查实学历造假，罪加一等', 'danger');
      gameState.inspectionRisk = clamp((gameState.inspectionRisk||0) + 30, 0, 100);
      gameState.corruption = clamp((gameState.corruption||0) + 15, 0, 100);
      gameState.degreeFake = false;
      gameState.playerDegree = null;
    }
  }
  // ====== v2.2.0 耕地红线违规处分（必须在 inspectionRisk/merit/reputation 重计算之后触发，避免被覆盖） ======
  if (gameState.agriStats && gameState.agriStats.belowRedlineMonths > 0) {
    checkFarmlandRedlineViolation();
  }
  // v2.2.4: 车流模拟（在所有建筑/道路数据稳定后计算）
  if (typeof simulateTraffic === 'function') simulateTraffic();
  // v2.2.4b: 秘书能力加成（政绩、GDP）
  if (gameState.personnel && gameState.personnel.secretary) {
    const sec = gameState.personnel.officials.find(o => o.id === gameState.personnel.secretary);
    if (sec) {
      const secComp = getEffectiveCompetence(sec);
      const meritBonus = Math.floor(secComp / 3);
      const gdpBonus = secComp / 400; // 能力8时+2%GDP
      gameState.merit = (gameState.merit || 0) + meritBonus;
      gameState.gdpMult = Math.min(GDP_MULT_CAP || 3.0, (gameState.gdpMult || 1.0) + gdpBonus);
    }
  }
  checkWinLose();
}

// ============== v2.2.0 农业系统月度更新 ==============
function updateAgriSystem(agg, buildableArea) {
  const s = gameState;
  const as = s.agriStats;
  if (!as) return; // 旧存档兜底由 save.js 处理

  // 1. 按 GDP 贡献分类累加（参考 2024 三产占比 6.8% / 36.5% / 56.7%）
  //    分类标准（与现实统计口径一致）：
  //    第一产业 = 农林牧渔（农业建筑）
  //    第二产业 = 工业建筑业（industrial/hazardous）
  //    第三产业 = 服务业，含商业、房地产、公共事业、基础设施（住宅/公共/基础设施归入三产）
  //    v2.4.3: 第二产业细分工矿业和制造业
  let primaryGdp = 0, secondaryGdp = 0, tertiaryGdp = 0;
  let miningGdp = 0, manufacturingGdp = 0; // v2.4.3: 工矿业 vs 制造业
  let agriJobs = 0, totalJobsRaw = 0;
  let farmlandCells = 0;
  for (const b of s.buildings) {
    if (b.underConstruction) continue;
    const def = BUILDING_TYPES[b.type]; if (!def) continue;
    const e = def.eff;
    // 地形增益
    let bonus = 1;
    if (isPrimarySector(b.type)) {
      const cell = mapCells[b.y * MAP_W + b.x];
      const terrain = cell ? cell.terrain : 'grass';
      bonus = getAgriTerrainBonus(b.type, terrain);
    }
    // v2.4.3: 矿区产量衰减倍率
    let mineBonus = 1;
    if (b.type === 'mine' && s.mineralZones) {
      for (const mz of s.mineralZones) {
        if (mz.mineBuildings.some(mb => mb.x === b.x && mb.y === b.y)) {
          mineBonus = mz.production / mz.maxProduction;
          break;
        }
      }
    }
    const g = (e.gdp || 0) * bonus * mineBonus;
    const j = (e.jobs || 0) * bonus * mineBonus;
    totalJobsRaw += j;
    if (isPrimarySector(b.type)) {
      primaryGdp += g;
      agriJobs += j;
      if (b.type === 'farmland') farmlandCells++;
    } else if (def.cat === 'industrial' || def.cat === 'hazardous') {
      secondaryGdp += g;
      // v2.4.3: 区分工矿业和制造业
      if (b.type === 'mine') {
        miningGdp += g;
      } else {
        manufacturingGdp += g;
      }
    } else {
      // commercial / residential / public / infrastructure 全部归入第三产业（与现实口径一致）
      tertiaryGdp += g;
    }
  }
  const totalGdp = primaryGdp + secondaryGdp + tertiaryGdp;
  as.primaryGdp = primaryGdp;
  as.secondaryGdp = secondaryGdp;
  as.tertiaryGdp = tertiaryGdp;
  as.otherGdp = 0; // 已并入第三产业，保留字段兼容旧存档
  // v2.4.3: 第二产业细分
  as.miningGdp = miningGdp;
  as.manufacturingGdp = manufacturingGdp;
  as.miningRatio = secondaryGdp > 0 ? miningGdp / secondaryGdp : 0;
  as.manufacturingRatio = secondaryGdp > 0 ? manufacturingGdp / secondaryGdp : 0;
  // v2.4.3: 资源依赖度 = 矿业GDP / 总GDP × 100
  s.resourceDependency = totalGdp > 0 ? Math.round(miningGdp / totalGdp * 100) : 0;
  // 三产占比分母为三产之和，确保三者相加 = 100%
  as.primaryRatio = totalGdp > 0 ? primaryGdp / totalGdp : 0;
  as.secondaryRatio = totalGdp > 0 ? secondaryGdp / totalGdp : 0;
  as.tertiaryRatio = totalGdp > 0 ? tertiaryGdp / totalGdp : 0;

  // 2. 城市化率 = 非农就业 / 总就业（参考：中国 2024 城镇化率 67%）
  as.agriJobs = agriJobs;
  as.totalJobs = totalJobsRaw;
  const urbanRatio = totalJobsRaw > 0 ? clamp(1 - agriJobs / totalJobsRaw, 0, 1) : 0;
  as.urbanizationRatio = urbanRatio;
  const uLevel = getUrbanizationLevel(urbanRatio);
  as.urbanizationLevelId = uLevel.id;
  // 记录历史最高城市化率（成就用）
  if (urbanRatio > (s.achievementStats.maxUrbanizationRatio || 0)) {
    s.achievementStats.maxUrbanizationRatio = urbanRatio;
  }

  // 3. 耕地红线（按格计算：buildableArea 是可建格数，farmlandCells 是当前农田格数）
  as.buildableArea = buildableArea;
  as.farmlandArea = farmlandCells;
  as.farmlandRedlineRatio = uLevel.farmlandRedlineRatio;
  as.farmlandRedline = Math.round(buildableArea * uLevel.farmlandRedlineRatio);

  // 4. 耕地红线违规检查（仅累计违规月数；处分触发延后到 simulateMonth 末尾，避免被 inspectionRisk/merit 重计算覆盖）
  if (as.farmlandArea < as.farmlandRedline && as.farmlandRedline > 0) {
    as.belowRedlineMonths++;
  } else {
    // 恢复达标：重置计数与已触发档位
    if (as.belowRedlineMonths > 0) {
      logEvent(`耕地面积恢复至红线以上，解除整改预警`, 'success');
    }
    as.belowRedlineMonths = 0;
    as.redlinePenaltyTriggered = [];
  }
}

// 耕地红线违规处分梯度触发（每档只触发一次）+ 持续纪委关注压力
function checkFarmlandRedlineViolation() {
  const s = gameState;
  const as = s.agriStats;
  const months = as.belowRedlineMonths;
  if (!as.redlinePenaltyTriggered) as.redlinePenaltyTriggered = [];

  // 1. 持续纪委关注压力：根据当前违规月数取最高档位的 inspect 值（每月累加到 inspectionRisk）
  //    这样违规越久，纪委关注持续越高（不被 inspectionRisk 月度重置冲掉）
  let currentInspectPressure = 0;
  for (const p of FARMLAND_REDLINE_PENALTY) {
    if (months >= p.months) currentInspectPressure = p.inspect;
  }
  if (currentInspectPressure > 0) {
    s.inspectionRisk = clamp((s.inspectionRisk || 0) + currentInspectPressure, 0, 100);
  }

  // 2. 一次性档位触发：首次到达 1/3/6/12 月时触发 merit/reputation 处分与红头文件
  //    v2.3.6c: 如果当前耕地已达标（缺口为0），说明玩家已整改，不再触发处分红头文件
  for (const p of FARMLAND_REDLINE_PENALTY) {
    if (months >= p.months && !as.redlinePenaltyTriggered.includes(p.months)) {
      // v2.3.6c: 如果当前已达标，跳过处分触发并重置计数
      if (as.farmlandArea >= as.farmlandRedline) {
        as.belowRedlineMonths = 0;
        as.redlinePenaltyTriggered = [];
        logEvent(`耕地面积已恢复至红线以上，免除耕地违规处分`, 'success');
        break;
      }
      as.redlinePenaltyTriggered.push(p.months);
      s.merit = Math.max(0, (s.merit || 0) + p.merit);
      s.reputation = clamp((s.reputation || 0) + p.reputation, 0, 100);
      s.achievementStats.redlineViolations = (s.achievementStats.redlineViolations || 0) + 1;
      logEvent(p.msg, 'danger');
      showNotification(p.msg, 'danger');
      // 第 6/12 月触发党内警告/严重警告红头文件
      if (p.redLetter === 'warning' && typeof showFarmlandWarningRedLetter === 'function') {
        showFarmlandWarningRedLetter(months >= 12);
      }
      break; // 每月最多触发一档
    }
  }
}

