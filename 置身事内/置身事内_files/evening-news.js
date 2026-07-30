/* 源自《置身事内》单文件版 - 晚报系统 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 晚报系统 ==============
function showNewspaper() {
  const cityName = gameState.cityName || '新安';
  const baseName = cityName.replace(/[镇县城]+$/, '');
  const paperName = baseName + '晚报';
  const dateStr = `${gameState.year}年${gameState.month}月${gameState.turn}期`;
  const lv = getCityLevel();
  const lvTitle = lv ? lv.title : '镇长';
  // v2.4.1d: 根据地图等级动态获取行政区域称谓
  const lvId = gameState.cityLevelId || 0;
  const areaUnit = ['全乡', '全县', '全市', '全市', '全市'][lvId] || '全市';
  const govUnit = ['乡政府', '县政府', '市政府', '市政府', '市政府'][lvId] || '市政府';
  const deptUnit = ['乡住建所', '县住建局', '市住建局', '市住建局', '市住建局'][lvId] || '市住建局';
  const civilianUnit = ['村民', '村民', '市民', '市民', '市民'][lvId] || '市民';
  const areaShort = lv ? lv.name : '辖区';

  // 获取过去一年的事件日志
  const logs = (gameState.eventLog || []).filter(e => e.turn >= gameState.turn - 12);
  const successLogs = logs.filter(e => e.type === 'success' || e.type === 'info');
  const dangerLogs = logs.filter(e => e.type === 'danger');
  const warnLogs = logs.filter(e => e.type === 'warn' || e.type === 'corruption');

  let html = `<div class="np-doc"><div class="np-page">`;

  // 报头
  html += `<div class="np-masthead">`;
  html += `<div class="np-masthead-title">${paperName}</div>`;
  html += `<div class="np-masthead-sub">${gameState.year}年${gameState.month}月 · ${lvTitle}·${gameState.playerName || '同志'}主政</div>`;
  html += `<div class="np-masthead-meta"><span>第${gameState.turn}期</span><span>${dateStr}</span><span>今日8版</span></div>`;
  html += `</div>`;

  // 头条
  const headline = generateHeadline(gameState, lvTitle);
  html += `<div class="np-headline">${headline}</div>`;
  html += `<div class="np-divider"></div>`;

  // 建设竣工板块
  html += `<div class="np-section">`;
  html += `<div class="np-section-title">建设速递</div>`;
  const constructions = successLogs.filter(e => e.text.includes('建成') || e.text.includes('竣工') || e.text.includes('建成') || e.text.includes('建设') || e.text.includes('招聘') || e.text.includes('任命'));
  if (constructions.length > 0) {
    for (const c of constructions.slice(0, 5)) {
      html += `<div class="np-item np-item-success">${c.text}</div>`;
    }
  } else {
    const buildingCount = gameState.buildings ? gameState.buildings.length : 0;
    html += `<div class="np-item">本期无重大工程竣工。全市现有各类建筑${buildingCount}栋，城市运转平稳有序。</div>`;
  }
  html += `</div>`;

  // 事故通报板块
  html += `<div class="np-section">`;
  html += `<div class="np-section-title">事故通报</div>`;
  if (dangerLogs.length > 0) {
    for (const d of dangerLogs.slice(0, 4)) {
      html += `<div class="np-item np-item-danger">${d.text}</div>`;
    }
  } else {
    html += `<div class="np-item">本期辖区内无重大安全事故发生，安全生产形势持续稳定向好。</div>`;
  }
  html += `</div>`;

  // 廉政宣传板块
  // v2.3.7c: 增加更多文案层级和提级巡视报道
  html += `<div class="np-section">`;
  html += `<div class="np-section-title">廉政之窗</div>`;
  const corruptionLevel = gameState.corruption || 0;
  if (corruptionLevel < 10) {
    const cleanPhrases = [
      `${baseName}始终坚持全面从严治党，深入推进党风廉政建设和反腐败斗争。${lvTitle}以身作则、率先垂范，带头落实中央八项规定精神，营造了风清气正的良好政治生态。`,
      `${baseName}党风廉政建设成效显著，连续多期无违纪违法案件发生。${lvTitle}强调，要持续推进作风建设常态化长效化，以优良作风凝聚发展合力。`,
      `本辖区政治生态持续向好，干部清正、政府清廉、政治清明。${lvTitle}带头签订廉政承诺书，以上率下推动全面从严治党向纵深发展。`,
      `${baseName}严格落实"两个责任"，强化监督执纪问责。本期开展廉政谈话多次，组织党员干部参观警示教育基地，筑牢拒腐防变思想防线。`,
    ];
    html += `<div class="np-item">${cleanPhrases[Math.floor(Math.random() * cleanPhrases.length)]}</div>`;
  } else if (corruptionLevel < 25) {
    const mildPhrases = [
      `${baseName}持续开展廉政教育，组织党员干部学习《纪律处分条例》和《监察法》。本期共有若干干部接受组织谈话，体现了我区"抓早抓小、防微杜渐"的纪律要求。`,
      `${baseName}开展"作风建设年"活动，聚焦形式主义、官僚主义等突出问题进行专项整治。${lvTitle}要求各级干部对照检查，立行立改。`,
      `本辖区强化日常监督，运用监督执纪"四种形态"，做到早发现、早提醒、早纠正。${lvTitle}主持召开廉政工作专题会议，部署下一阶段反腐倡廉任务。`,
      `${baseName}深入推进廉政文化建设，打造"清风"品牌。通过廉政书画展、廉政微电影等形式，营造崇廉尚洁的社会氛围。`,
    ];
    html += `<div class="np-item">${mildPhrases[Math.floor(Math.random() * mildPhrases.length)]}</div>`;
  } else if (corruptionLevel < 45) {
    const warnPhrases = [
      `${baseName}纪检部门加大执纪审查力度，本期对多名干部进行诫勉谈话。${lvTitle}表示，对苗头性、倾向性问题必须高度重视，坚决防止小错酿成大祸。`,
      `区纪委监委通报：近期查办多起违纪违法案件，多名干部被立案调查。${lvTitle}表示坚决拥护上级决定，将全力配合纪检工作，以案为鉴、以案促改。`,
      `${baseName}开展"纪律教育学习月"活动，组织全体干部集中观看警示教育片。片中曝光的典型案例令人警醒，${lvTitle}强调要以案为鉴、警钟长鸣。`,
      `本辖区推进巡察工作全覆盖，发现问题线索若干。${lvTitle}要求对巡察发现的问题立行立改、即知即改，做到件件有着落、事事有回音。`,
    ];
    html += `<div class="np-item np-item-warn">${warnPhrases[Math.floor(Math.random() * warnPhrases.length)]}</div>`;
  } else if (corruptionLevel < 65) {
    const seriousPhrases = [
      `区纪委监委严肃查处违纪违法问题，本期立案调查多起案件。${lvTitle}表示将深刻反思、汲取教训，全力配合上级纪委调查工作，绝不姑息迁就。`,
      `${baseName}廉政建设形势严峻，多名干部因严重违纪违法被移送司法机关。${lvTitle}在干部大会上作深刻检讨，表示将以刮骨疗毒的决心推进反腐败斗争。`,
      `上级纪委对本辖区反腐败工作提出严肃批评，要求限期整改。${lvTitle}表示诚恳接受、照单全收，将逐一制定整改方案，确保问题整改到位。`,
      `本辖区干部队伍中暴露出严重问题，群众反映强烈。${lvTitle}主持召开专题民主生活会，带头开展批评与自我批评，深刻剖析问题根源。`,
    ];
    html += `<div class="np-item np-item-warn">${seriousPhrases[Math.floor(Math.random() * seriousPhrases.length)]}</div>`;
  } else {
    const criticalPhrases = [
      `本辖区反腐败斗争形势异常严峻，上级纪委已进驻开展提级巡视。${lvTitle}表示坚决服从组织决定，全力配合巡视组工作，如实交代问题。`,
      `${baseName}多名干部相继落马，涉案金额巨大，社会影响恶劣。上级纪委已启动提级调查程序，${lvTitle}表示深刻检讨、诚恳认错。`,
      `区纪委监委通报：经初步核查，发现多起严重违纪违法线索，已移交上级纪委提级办理。${lvTitle}表示绝不逃避、主动配合，相信组织会给出公正处理。`,
    ];
    html += `<div class="np-item np-item-warn">${criticalPhrases[Math.floor(Math.random() * criticalPhrases.length)]}</div>`;
  }
  // v2.3.7c: 提级巡视专题报道
  if ((gameState.inspectionLockdown || 0) > 0) {
    html += `<div class="np-item np-item-warn" style="font-weight:600;margin-top:6px;">提级巡视快讯：上级纪委巡视组已进驻本辖区，对权力运行、项目建设、财政资金使用等重点领域开展专项巡视。巡视期间，各项权力运行将接受全面审查，干部群众可通过巡视组专线电话和信箱反映问题。</div>`;
  }
  // 贪腐相关事件（含落马干部的具体报道）
  const corruptionLogs = logs.filter(e => (e.type === 'warn' || e.type === 'danger') && (e.text.includes('贪') || e.text.includes('腐败') || e.text.includes('落马') || e.text.includes('免职') || e.text.includes('查处') || e.text.includes('追究') || e.text.includes('纪检') || e.text.includes('调查') || e.text.includes('反水') || e.text.includes('伪造学历')));
  if (corruptionLogs.length > 0) {
    html += `<div class="np-item np-item-warn" style="font-weight:600;margin-top:6px;">本期查处情况通报：</div>`;
    for (const c of corruptionLogs.slice(0, 5)) {
      // 添加定性描述
      let prefix = '';
      if (c.text.includes('落马') || c.text.includes('免职') || c.text.includes('带走')) prefix = '经查实，';
      else if (c.text.includes('追究')) prefix = '经查实，';
      else if (c.text.includes('伪造')) prefix = '经群众举报，';
      html += `<div class="np-item np-item-warn">${prefix}${c.text}${c.text.includes('落马') || c.text.includes('追究') ? '。数额特别巨大，情节特别恶劣，社会影响极坏。' : ''}</div>`;
    }
  }
  html += `</div>`;

  // 歌颂功德板块
  html += `<div class="np-section">`;
  html += `<div class="np-section-title">政绩颂扬</div>`;
  const praise = generatePraise(gameState, lvTitle, baseName);
  html += `<div class="np-item">${praise}</div>`;
  // 关键数据
  html += `<div class="np-item">据统计，${areaUnit}人口${Math.round(gameState.population).toLocaleString()}人，GDP达¥${Math.round(gameState.gdp).toLocaleString()}万，幸福指数${(gameState.happiness || 50).toFixed(1)}分，空气质量指数${(gameState.airQuality || 35).toFixed(0)}，绿化覆盖率${(gameState.greenCoverage || 0).toFixed(1)}%。</div>`;
  html += `</div>`;

  // v2.4.1d: 构建动态上下文（行政称谓）
  const newsCtx = { areaUnit, govUnit, deptUnit, civilianUnit, areaShort };

  // v2.4.1c: 资源供需报道板块（v2.4.1d: 每次只选一个主题，留言合并到市民信箱）
  const extraQuotes = [];

  // v2.4.3b: 矿产资源报道板块（仅资源型城市显示）
  if (gameState.isResourceCity && gameState.mineralZones && gameState.mineralZones.length > 0) {
    const zones = gameState.mineralZones;
    const avgProd = Math.round(zones.reduce((a, m) => a + m.production, 0) / zones.length);
    const zoneNames = zones.map(z => z.name).join('、');
    const depLevel = gameState.resourceDependency || 0;
    html += `<div class="np-section">`;
    html += `<div class="np-section-title">矿业动态</div>`;
    if (gameState.resourceDepleted) {
      html += `<div class="np-item np-item-warn">${baseName}已被上级正式列为资源枯竭型城市，矿产资源平均产量仅${avgProd}%。辖区现有矿区${zones.length}处（${zoneNames}），产业结构转型迫在眉睫。${lvTitle}表示将全力推进产业转型，培育新的经济增长点。</div>`;
      if (gameState.transformationProject) {
        const tp = gameState.transformationProject;
        const tpType = tp.type === 'tourism' ? '文旅产业' : '现代物流业';
        const tpPct = Math.round(tp.monthsCompleted / tp.monthsRequired * 100);
        if (tp.completed) {
          html += `<div class="np-item">${baseName}${tpType}转型项目已圆满完成，城市成功实现产业转型，焕发新的发展活力。${lvTitle}表示这是全市干部群众团结奋斗的结果。</div>`;
        } else {
          html += `<div class="np-item">${tpType}转型项目进展顺利，已完成${tpPct}%，累计投入¥${formatMoney((tp.totalInvested || 0) * 10000)}。项目建成后将为${areaUnit}注入新的经济活力。</div>`;
        }
      } else {
        const wMonths = gameState._noTransformWarningMonths || 0;
        if (wMonths >= 12) {
          html += `<div class="np-item np-item-warn">上级已启动提级巡视，对${areaUnit}产业转型工作进行专项督查。${lvTitle}表示将认真配合巡视，加快推进转型。</div>`;
        } else if (wMonths >= 6) {
          html += `<div class="np-item np-item-warn">上级对${areaUnit}未及时启动产业转型表示关注，已启动班子问责程序。</div>`;
        } else if (wMonths >= 3) {
          html += `<div class="np-item np-item-warn">上级对${baseName}产业转型进展缓慢提出批评，要求限期启动转型规划。</div>`;
        }
      }
    } else if (avgProd > 70) {
      html += `<div class="np-item">${baseName}矿产资源开发形势良好，辖区${zones.length}处矿区平均产量${avgProd}%，资源依赖度${depLevel}%。${lvTitle}强调要统筹好开发与保护，走可持续发展之路。</div>`;
    } else {
      html += `<div class="np-item">${baseName}矿产资源产量呈下降趋势，辖区矿区平均产量${avgProd}%。${lvTitle}要求提前谋划产业转型，避免被动应对资源枯竭。</div>`;
    }
    // 矿业经济数据
    const miningEnts = (gameState.enterprises || []).filter(e => e.subType === 'mining');
    if (miningEnts.length > 0) {
      const totalGdp = miningEnts.reduce((sum, e) => sum + (e.gdpContribution || 0), 0);
      html += `<div class="np-item">矿业经济：辖区共有采矿企业${miningEnts.length}家（其中国企${miningEnts.filter(e => e.ownership === 'stateOwned').length}家），月GDP贡献约¥${formatMoney(totalGdp * 10000)}。</div>`;
    }
    html += `</div>`;
    // 矿业相关吐槽
    if (gameState.resourceDepleted) {
      extraQuotes.push(`${civilianUnit}："以前矿上一个月挣五千，现在矿关了，连五千都没了。"`);
      extraQuotes.push(`${civilianUnit}："报纸上说要转型，转了半年了，转出个啥来？"`);
      if (avgProd < 20) extraQuotes.push(`${civilianUnit}："矿快挖完了，年轻人全跑光了，这报纸还有人看吗？"`);
    } else if (avgProd < 50) {
      extraQuotes.push(`${civilianUnit}："矿上的活越来越少了，说是产量降了，我看是老板跑路了。"`);
      extraQuotes.push(`${civilianUnit}："报纸说矿业形势大好，我邻居在矿上上班说快发不出工资了。"`);
    } else {
      extraQuotes.push(`${civilianUnit}："矿上效益确实好，就是灰尘大，洗了衣服都不用晾干就脏了。"`);
    }
    if ((gameState.airQuality || 35) > 120) {
      extraQuotes.push(`${civilianUnit}："矿区那边空气，吸一口嗓子疼三天，报纸上可没写这个。"`);
    }
  }

  const resourceResult = generateResourceReport(gameState, newsCtx);
  if (resourceResult.html) {
    html += `<div class="np-section">`;
    html += `<div class="np-section-title">民生保障</div>`;
    html += resourceResult.html;
    html += `</div>`;
    // v2.4.1d: 收集留言，稍后合并到市民信箱
    for (const q of resourceResult.quotes) {
      extraQuotes.push(`${civilianUnit}："${q}"`);
    }
  }

  // v2.4.1c: 城市综合评分（每年1月年报，v2.4.1d: 留言合并到市民信箱）
  if (gameState.month === 1) {
    const ratingResult = generateCityRatingReport(gameState, newsCtx);
    if (ratingResult.html) {
      html += `<div class="np-section">`;
      html += `<div class="np-section-title">城市综合考评年报</div>`;
      html += ratingResult.html;
      html += `</div>`;
      for (const q of ratingResult.quotes) {
        extraQuotes.push(`${civilianUnit}："${q}"`);
      }
    }
  }

  // 九月高考喜报板块
  if (gameState.month === 9) {
    const gaokaoHtml = generateGaokaoNews(gameState, baseName);
    if (gaokaoHtml) {
      html += `<div class="np-section">`;
      html += `<div class="np-section-title">高考喜报</div>`;
      html += gaokaoHtml;
      html += `</div>`;
    }
  }

  // v2.4.6b: 行政区划申报与城市荣誉报道板块
  const adminNews = generateAdminUpgradeNews(gameState, baseName, areaShort);
  if (adminNews) {
    html += adminNews;
  }

  // v2.4.7: 交通建筑报纸联动文案
  const transportNews = generateTransportNews(gameState, baseName);
  if (transportNews && transportNews.length > 0) {
    html += `<div class="np-section">`;
    html += `<div class="np-section-title">交通要闻</div>`;
    for (const item of transportNews) {
      html += `<div class="np-item"><strong>${item.title}</strong></div>`;
      html += `<div class="np-item">${item.content}</div>`;
    }
    html += `</div>`;
  }

  // v2.2.7: 公务员招录板块（每年6月随机考试：国考/省考/选调/林遴选）
  if (gameState.month === 6) {
    const recruitLogs = (gameState.eventLog || []).filter(e =>
      e.turn === gameState.turn && e.type === 'success' && e.text.includes('录用')
    );
    if (recruitLogs.length > 0) {
      // v2.2.7: 从日志文本中提取考试类型
      const examTypes = ['国考', '省考', '选调', '林遴选'];
      let examName = '公务员招录';
      for (const et of examTypes) {
        if (recruitLogs[0].text.includes(et)) { examName = et; break; }
      }
      html += `<div class="np-section">`;
      html += `<div class="np-section-title">${gameState.year}年${examName}录用公告</div>`;
      html += `<div class="np-item np-item-success">本报讯（记者 人事）${gameState.year}年${examName}公务员招录工作圆满结束，${baseName}本次共录用干部若干名，已全部进入干部储备池，将根据工作需要安排任职。</div>`;
      for (const r of recruitLogs.slice(0, 3)) {
        html += `<div class="np-item np-item-success">${r.text}</div>`;
      }
      html += `<div class="np-item" style="font-size:11px;color:var(--text-3);">下一步将组织岗前培训，新录用干部将分赴各条战线，为${baseName}发展注入新的活力。</div>`;
      html += `</div>`;
    }
  }

  // 市民吐槽板块（v2.4.1d: 合并民生保障和城市评分的市民留言）
  html += `<div class="np-roast">`;
  html += `<div class="np-roast-title">市民信箱（吐槽版）</div>`;
  const roasts = generateRoasts(gameState);
  // v2.4.1d: 将民生保障/城市评分的留言插入市民信箱前面
  const allRoasts = [...extraQuotes, ...roasts];
  for (const r of allRoasts) {
    html += `<div class="np-roast-item">${r}</div>`;
  }
  html += `</div>`;

  // 尾部
  // v2.4.1c: 删除广告图片，仅保留广告位招租
  html += `<div style="margin:8px 0;padding:14px;border:1px dashed #bbb;background:#f9f9f9;text-align:center;">
    <div style="font-size:11px;color:#999;letter-spacing:2px;">ADVERTISEMENTS</div>
    <div style="font-size:18px;color:#ccc;font-weight:700;margin-top:4px;">广告位招租中</div>
    <div style="font-size:10px;color:#bbb;margin-top:2px;">联系电话：详见编辑部</div>
  </div>`;
  html += `<div style="font-size:9px;color:#bbb;text-align:center;margin:4px 0 8px;">广告由第三方提供，请注意辨别！</div>`;
  html += `<div class="np-footer">${paperName}编辑部 · ${gameState.year}年${gameState.month}月 · 本报仅代表编辑个人观点</div>`;
  html += `<button class="np-btn" onclick="closeNewspaper()">阅毕</button>`;
  html += `</div></div>`;

  document.getElementById('newspaper-content').innerHTML = html;
  document.getElementById('newspaper-overlay').classList.add('active');
  // Track achievement stat
  gameState.achievementStats.newspapersRead = (gameState.achievementStats.newspapersRead || 0) + 1;
}

function closeNewspaper() {
  document.getElementById('newspaper-overlay').classList.remove('active');
}

function generateHeadline(s, lvTitle) {
  const popGrowth = s.populationGrowth || 0;
  const happiness = s.happiness || 50;
  // v2.3.7c: 提级巡视优先头条
  if ((s.inspectionLockdown || 0) > 0) return `${s.cityName}迎来上级纪委提级巡视 党风廉政建设接受全面检阅`;
  if (popGrowth > 0.03) return `${s.cityName}人口突破${Math.round(s.population).toLocaleString()}大关 城市发展势头强劲`;
  if (happiness > 75) return `${s.cityName}幸福指数再创新高 居民满意度达${happiness.toFixed(0)}分`;
  if (s.corruption > 50) return `${s.cityName}深入推进反腐败斗争 多名违纪干部被严肃查处`;
  if (s.corruption > 30) return `${s.cityName}深入开展反腐败工作 纪检部门通报最新进展`;
  if (s.gdp > 5000) return `${s.cityName}GDP突破¥${Math.round(s.gdp).toLocaleString()}万 经济总量稳步增长`;
  // v2.3.7c: 企业相关头条
  const entCount = (s.enterprises || []).length;
  if (entCount > 15) return `${s.cityName}营商环境持续优化 辖区企业突破${entCount}家`;
  return `${s.cityName}${s.year}年${s.month}月工作简报 各项事业稳步推进`;
}

function generatePraise(s, lvTitle, baseName) {
  const happiness = s.happiness || 50;
  const treasury = s.treasury || 0;
  const green = s.greenCoverage || 0;
  const airQ = s.airQuality || 35;
  const edu = s.educationIndex || 0;
  const health = s.healthcareIndex || 0;
  const safety = s.publicSafety || 0;
  const phrases = [];

  // 民生篇（不提领导名，以工作成效为导向）
  const livPhrases = {
    excellent: [
      `本辖区民生保障有力，居民获得感、幸福感、安全感显著增强`,
      `各项民生指标持续向好，群众满意度保持在较高水平`,
      `民生投入持续加大，社会事业全面发展，成果惠及广大居民`,
      `坚持以人民为中心的发展思想，民生实事项目扎实推进，群众拍手称赞`,
      `社会保障体系不断完善，困难群众兜底保障有力，民生温度可感可知`,
      `城市更新步伐加快，老旧小区改造惠及千家万户，居民生活环境大幅改善`,
    ],
    good: [
      `民生事业稳步推进，基本公共服务保障有力`,
      `社会大局和谐稳定，居民生活水平稳步提升`,
      `民生保障体系日趋完善，各项社会事业协调发展`,
      `就业优先战略深入实施，城镇新增就业稳步增长，居民收入持续增加`,
      `公共服务供给持续优化，教育、医疗、养老等民生实事进展顺利`,
    ],
    fair: [
      `面对发展中的困难与挑战，各项工作仍有序推进`,
      `坚持问题导向，着力补齐民生短板，各项工作取得初步成效`,
      `在复杂形势下保障了基本民生需求，社会大局总体稳定`,
      `虽然面临不少困难和压力，但通过努力确保了民生底线不失守`,
      `正视发展中存在的不平衡不充分问题，积极采取措施加以解决`,
    ],
  };
  const livTier = happiness > 70 ? 'excellent' : happiness > 50 ? 'good' : 'fair';
  phrases.push(livPhrases[livTier][Math.floor(Math.random() * livPhrases[livTier].length)]);

  // 财政篇
  const finPhrases = {
    surplus: [
      `财政运行稳健，收支结构持续优化，为长远发展积蓄了势能`,
      `财政保障能力不断增强，重点领域投入力度持续加大`,
      `财源建设成效显现，财政收入稳步增长，支出结构合理有序`,
      `财政实力迈上新台阶，重点项目建设资金保障充足`,
      `税收征管科学规范，非税收入管理有序，财政运行质量持续提升`,
    ],
    balanced: [
      `财政收支基本平衡，预算执行情况良好`,
      `财政管理规范有序，资金使用效益稳步提升`,
      `坚持过紧日子思想，财政运转保障有力`,
      `预算绩效管理全面推进，财政资金配置效率不断提高`,
    ],
    tight: [
      `面对财政收支压力，多措并举保障了正常运转`,
      `积极应对财政困难，优先保障民生和重点支出`,
      `在财政紧张的情况下，坚持压减一般性支出，保障基本运转`,
    ],
  };
  const finTier = treasury > 5000 ? 'surplus' : treasury > 1000 ? 'balanced' : 'tight';
  phrases.push(finPhrases[finTier][Math.floor(Math.random() * finPhrases[finTier].length)]);

  // 生态篇
  if (green > 30) phrases.push(`城区绿化覆盖率达${green.toFixed(0)}%，人居环境持续改善，生态文明建设成效显著`);
  else if (green > 15) phrases.push(`持续推进绿化建设，城市环境品质稳步提升`);
  if (airQ < 50) phrases.push(`大气污染防治攻坚深入推进，空气质量持续好转，蓝天白云成为常态`);
  else if (airQ < 100) phrases.push(`环保治理力度不断加大，区域环境质量总体向好`);

  // 教育医疗篇
  if (edu > 70) phrases.push(`教育均衡发展扎实推进，办学条件持续改善，教育质量稳步提升`);
  if (health > 70) phrases.push(`医疗卫生服务体系不断完善，居民健康水平稳步提高`);

  // 治安篇
  if (safety > 70) phrases.push(`平安建设深入推进，社会治安形势持续向好，群众安全感不断增强`);

  // v2.2.0 农业与城镇化篇
  if (s.agriStats) {
    const as = s.agriStats;
    const uLevel = (typeof URBANIZATION_LEVELS !== 'undefined' && URBANIZATION_LEVELS[as.urbanizationLevelId]) || { name: '' };
    const farmlandCount = s.buildings.filter(b => !b.underConstruction && b.type === 'farmland').length;
    const agriCount = s.buildings.filter(b => !b.underConstruction && isPrimarySector(b.type)).length;
    if (as.urbanizationRatio >= 0.6) {
      phrases.push(`城镇化率达${(as.urbanizationRatio * 100).toFixed(0)}%，进入${uLevel.name}阶段，城乡融合高质量发展`);
    } else if (as.urbanizationRatio >= 0.3) {
      phrases.push(`城镇化进程稳步推进，城乡统筹协调发展，${uLevel.name}格局加快形成`);
    } else if (farmlandCount > 0) {
      phrases.push(`坚持农业农村优先发展，粮食生产保持稳定，乡村振兴战略深入实施`);
    }
    // 产业占比
    if (as.tertiaryRatio >= 0.5) {
      phrases.push(`三次产业结构优化为${(as.primaryRatio * 100).toFixed(0)}:${(as.secondaryRatio * 100).toFixed(0)}:${(as.tertiaryRatio * 100).toFixed(0)}，第三产业成为经济增长主引擎`);
    } else if (as.secondaryRatio >= 0.4) {
      phrases.push(`三次产业结构持续优化，工业经济支撑作用明显，产业转型升级加快推进`);
    }
    // 耕地保护
    if (as.farmlandArea >= as.farmlandRedline && farmlandCount > 0) {
      phrases.push(`严守耕地保护红线，耕地面积保持在${as.farmlandArea * 100}亩，粮食安全根基稳固`);
    } else if (as.belowRedlineMonths > 0) {
      phrases.push(`耕地保护形势严峻，已下发整改通知，要求限期恢复耕地面积至红线以上`);
    }
  }

  // 发展篇（通用收尾）
  const closingPhrases = [
    `总体来看，本辖区经济社会发展呈现稳中向好的良好态势`,
    `各项事业取得了新进展、新成效，为下一步高质量发展奠定了基础`,
    `展望未来，本辖区将继续凝心聚力、真抓实干，推动各项事业再上新台阶`,
    `将以更加昂扬的斗志、更加务实的作风，奋力谱写高质量发展新篇章`,
    `将继续坚持稳中求进工作总基调，统筹推进各项工作再上新水平`,
    `下一步将聚焦补短板、强弱项，推动经济社会发展实现新跨越`,
  ];
  phrases.push(closingPhrases[Math.floor(Math.random() * closingPhrases.length)]);

  return phrases.join('。') + '。';
}

function generateRoasts(s) {
  const roasts = [];
  const happiness = s.happiness || 50;
  const unemployment = s.unemployment || 0;
  const corruption = s.corruption || 0;
  const treasury = s.treasury || 0;
  const airQuality = s.airQuality || 35;
  const noiseLevel = s.noiseLevel || 35;

  // 根据状态生成吐槽
  if (happiness < 40) roasts.push(`市民老王：说好的幸福呢？我这幸福指数比股市还惨。`);
  else if (happiness < 55) roasts.push(`市民老王：幸福？哦你说那个以前有的东西。`);
  else if (happiness > 80) roasts.push(`市民老王：说实话，比隔壁市好太多了，但我们还想要更多！（众：贪心！）`);

  if (unemployment > 0.15) roasts.push(`网友"找工作的人"：简历投了200份，最后发现只有市长办公室在招人。`);
  else if (unemployment > 0.08) roasts.push(`网友"打工人"：工作倒是能找到，就是工资还没外卖员高。`);

  if (corruption > 30) roasts.push(`匿名市民：听说有些领导上班比下班还忙——忙着数钱。`);
  else if (corruption > 15) roasts.push(`匿名市民：食堂的菜越来越贵了，不知道跟某些人有没关系。`);
  else if (corruption < 5) roasts.push(`匿名市民：清廉得让我都不习惯了，是不是在憋什么大招？`);

  if (treasury < 0) roasts.push(`市民小李：看新闻说财政赤字，建议领导去摆个地摊贴补家用。`);
  else if (treasury < 500) roasts.push(`市民小李：听说市财政紧张，我那10块钱停车费能不交吗？`);

  if (airQuality > 150) roasts.push(`网友"呼吸困难的张三"：出门不用戴口罩，因为口罩挡不住这味儿。`);
  else if (airQuality > 80) roasts.push(`网友"呼吸困难的张三"：今天的空气……嗯，嚼着有嚼劲。`);

  if (noiseLevel > 70) roasts.push(`市民赵阿姨：楼下施工吵得我血压都高了，能不能给个耳塞补贴？`);

  // 九月高考相关吐槽
  if (s.month === 9) {
    const highSchools = (s.buildings || []).filter(b => b.type === 'highSchool');
    if (highSchools.length > 0) {
      const eduLevel = s.educationIndex || 0;
      const gaokaoRoasts = [
        `家长老张：高考喜报写得真漂亮，就是我家娃连二本都没上线，报纸能不能也报一下我们？`,
        `网友"落榜的青春"：报上清北录取多少人，我复读班报名多少人，这数字倒是成正比。`,
        `市民老李：最高分那学校离我家三条街，怎么我家门口学校一个清北都没有？是不是教育资源分配不均？`,
        `网友"吃瓜家长"：报纸说本科上线率创新高，我儿子说他们班一半人没过线，到底谁在说谎？`,
        `市民王大妈：看了高考喜报很高兴，转念一想我家孙子才上幼儿园，高兴早了。`,
        `网友"教育公平"：清华北大录取的都在那几所学校，其他学校的孩子是陪跑的吗？`,
        `市民刘师傅：高考最高分创新高，我补课费也创新高了，这算不算正相关？`,
      ];
      if (eduLevel < 10) {
        gaokaoRoasts.push(`网友"焦虑妈妈"：看了喜报才发现，我市教育水平跟分数线一样——全靠运气。`);
        gaokaoRoasts.push(`市民老周：报上说"稳中有升"，我孩子成绩倒是"稳中有降"，方向是不是反了？`);
      }
      roasts.push(gaokaoRoasts[Math.floor(Math.random() * gaokaoRoasts.length)]);
      if (gaokaoRoasts.length > 1 && Math.random() < 0.5) {
        let r2;
        do { r2 = gaokaoRoasts[Math.floor(Math.random() * gaokaoRoasts.length)]; } while (r2 === roasts[roasts.length - 1]);
        roasts.push(r2);
      }
    } else {
      roasts.push(`市民老赵：邻市都在发高考喜报，我们连个高中都没有，孩子上学还得坐大巴。`);
    }
  }

  // 针对具体行为的吐槽
  if (s.underworld && s.underworld.thugs > 10) roasts.push(`匿名市民：最近街上多了些戴墨镜的大哥，问就是"社区治安志愿者"。`);
  if (s.underworld && s.underworld.crackdownsDone > 0) roasts.push(`市民老刘：刚扫黑了？哦那我等风头过了再说。`);

  if (s.buildings && s.buildings.length > 100) {
    const indCount = s.buildings.filter(b => b.type === 'heavyInd' || b.type === 'hazInd').length;
    if (indCount > 10) roasts.push(`网友"环保先锋"：再建两个化工厂，我们就能移民火星了，因为地球这边已经不能住了。`);
  }

  const resCount = s.buildings ? s.buildings.filter(b => b.type && b.type.includes('Res')).length : 0;
  if (resCount > 20) roasts.push(`市民小陈：楼是越盖越高了，就是不知道买不买得起。`);

  // v2.2.0 农业相关吐槽
  if (s.agriStats) {
    const as = s.agriStats;
    const farmlandCount = s.buildings.filter(b => !b.underConstruction && b.type === 'farmland').length;
    if (as.belowRedlineMonths >= 3) {
      roasts.push(`村民老李：领导说要严守耕地红线，自家祖坟旁边的田先给推了盖厂房。`);
      roasts.push(`网友"种地老王"：报纸天天说粮食安全，我家三亩水浇地去年被占了修路。`);
    } else if (as.urbanizationRatio >= 0.8 && farmlandCount < 5) {
      roasts.push(`市民小张：城镇化率都 80% 了，菜市场里连本地菜都买不到，全靠外调。`);
      roasts.push(`网友"乡村记忆"：小时候这里全是稻田，现在孩子想看稻穗得去博物馆。`);
    } else if (as.urbanizationRatio < 0.3) {
      roasts.push(`村民老赵：咱村年轻人全进城打工了，田里就剩我和老头儿种地，城镇化率没涨反降。`);
      roasts.push(`网友"留守村长"：领导说农业是基础，可基础收入连化肥钱都不够。`);
    } else {
      roasts.push(`市民小钱：城边那片鱼塘水质越来越差，说是搞水产养殖，我看是排污池。`);
      roasts.push(`网友"吃货联盟"：本地猪肉价格比外地贵一倍，畜牧场说在"提质增效"。`);
    }
  }

  // v2.3.7c: 提级巡视和调查相关吐槽
  if ((s.inspectionLockdown || 0) > 0) {
    const inspectionRoasts = [
      `匿名干部：巡视组来了之后，办公室突然变得特别安静，大家都在"忙学习"。`,
      `网友"纪委热线"：巡视组进驻第一天，举报信箱就被塞满了，建议多备几个。`,
      `市民老钱：听说纪委来了，单位食堂的茅台突然从菜单上消失了。`,
      `匿名干部：以前开会讨论工程，现在开会讨论学习，气氛确实不一样了。`,
    ];
    roasts.push(inspectionRoasts[Math.floor(Math.random() * inspectionRoasts.length)]);
  }
  if ((s.inspectionRisk || 0) > 50 && (!s.inspectionLockdown || s.inspectionLockdown === 0)) {
    roasts.push(`匿名市民：听说纪委在关注我们这边了，有些人最近走路都不太自然。`);
  }

  // v2.3.7c: 企业相关吐槽
  const entCount = (s.enterprises || []).length;
  if (entCount > 0) {
    const foreignCount = (s.enterprises || []).filter(e => e.ownership === 'foreign').length;
    const stateOwnedCount = (s.enterprises || []).filter(e => e.ownership === 'stateOwned').length;
    if (foreignCount > 5) roasts.push(`网友"民族品牌"：满大街外资企业招牌，我差点以为出国了。`);
    if (stateOwnedCount > 10) roasts.push(`市民老吴：国企改革喊了半天，门口牌子换了，食堂还是那味儿。`);
    const microCount = (s.enterprises || []).filter(e => e.isMicro).length;
    if (microCount > 8) roasts.push(`网友"小微企业主"：报纸说营商环境好，我开个小店光审批就跑了三个月。`);
  }
  // 随机补充
  const randomRoasts = [
    `市民老孙：报纸上写得真好，就是跟我看到的不太一样。`,
    `网友"键盘侠001"：建议领导多看看评论区，少看汇报材料。`,
    `市民老周：每次看晚报歌颂功德，我都觉得我活在另一个城市。`,
    `网友"吃瓜群众"：这报纸印刷质量不错，就是内容可以当小说看。`,
    `市民老赵：领导说"成效显著"，我老婆说"工资没涨"，到底听谁的？`,
    `网友"匿名市民"：看这报上写的，我还以为我们市是北上广呢。`,
    `市民小钱：晚报写得跟简报似的，要不改名《工作简报》得了。`,
    `网友"真相帝"：报纸说"稳步提升"，我的体重也在"稳步提升"。`,
    `市民老吴：建议晚报加个板块叫"领导说了啥vs实际做了啥"`,
    `网友"老司机"：看晚报就像看天气预报——知道不准但还是得看。`,
  ];
  // v2.4.1b: 常委会相关吐槽
  if (s.committee) {
    const unity = s.committeeUnity || 50;
    if (unity < 30) {
      const unityRoasts = [
        `机关干部小周：常委会天天吵架，会议精神就是"谁嗓门大谁有理"。`,
        `网友"旁观者"：听说领导班子里几个人互相看不顺眼，开会比宫斗剧还精彩。`,
        `市民老赵：这班子团结程度，跟我们家过年差不多——表面和气，背地摔碗。`,
      ];
      roasts.push(unityRoasts[Math.floor(Math.random() * unityRoasts.length)]);
    }
    const vacantCount = s.committee.filter(m => m.isVacant).length;
    if (vacantCount > 0) {
      roasts.push(`匿名干部：常委会好几个位置空着，书记一个人干五份活，也不知道累不累。`);
    }
  }

  if (roasts.length < 3) {
    roasts.push(randomRoasts[Math.floor(Math.random() * randomRoasts.length)]);
  }

  return roasts.slice(0, 5);
}

// 生成九月高考喜报（返回正式排版HTML，关键字眼红色）
function generateGaokaoNews(s, baseName) {
  const highSchools = (s.buildings || []).filter(b => b.type === 'highSchool' && !b.underConstruction);
  const universities = (s.buildings || []).filter(b => b.type === 'university' && !b.underConstruction);
  if (highSchools.length === 0) return null;

  const eduLevel = s.educationIndex || 0;
  const cityLvId = s.cityLevelId || 0;
  const eduBonus = eduLevel / 20;
  const lvBonus = cityLvId * 0.15;
  const schoolBonus = highSchools.length * 0.1;
  const totalBonus = eduBonus + lvBonus + schoolBonus;

  const baseScore = 580 + Math.floor(Math.random() * 60);
  const topScore = Math.min(735, Math.round(baseScore + totalBonus * 30));
  // 先算参考人数，所有后续数据从它派生，保证不会超过100%
  const examinees = Math.max(50, Math.floor(s.population * 0.003 + Math.random() * 100));
  // 本科上线率（百分比，上限85%）
  const benkeRate = Math.min(85, Math.round(35 + totalBonus * 15 + Math.random() * 8));
  const benkeCount = Math.round(examinees * benkeRate / 100);
  // 一本上线率（本科上线率的40%-60%）
  const yibenRate = Math.round(benkeRate * (0.4 + Math.random() * 0.2));
  const yibenCount = Math.round(examinees * yibenRate / 100);
  // 清北录取人数（一本上线人数的一小部分，上限50）
  const qingbeiCount = Math.min(50, Math.max(0, Math.floor(yibenCount * (0.02 + totalBonus * 0.01 + Math.random() * 0.03))));
  const R = '<span style="color:#c0392b;">'; // 红色关键字开始
  const RE = '</span>'; // 红色关键字结束

  const topSchool = highSchools[Math.floor(Math.random() * highSchools.length)];
  const topSchoolName = topSchool.customName || (baseName + '高级中学');

  let html = '';
  // 导语段
  html += `<div class="np-item">本报讯（记者 教育报道）${s.year}年全国普通高校招生统一考试成绩日前揭晓，我市共有${R}${examinees.toLocaleString()}名${RE}考生参加考试，本科上线率达${R}${benkeRate}%${RE}，各项指标稳中有升。</div>`;

  // 最高分
  html += `<div class="np-item">据悉，我市今年高考最高分为${R}${topScore}分${RE}，该成绩出自${R}${topSchoolName}${RE}，位列全省前列，创近年新高。市教育局相关负责人表示，这一成绩的取得离不开全市教育工作者的辛勤付出和广大家长的支持配合。</div>`;

  // 清北录取
  if (qingbeiCount > 0) {
    const qing = Math.ceil(qingbeiCount * 0.5);
    const bei = qingbeiCount - qing;
    html += `<div class="np-item">在${R}清华、北大${RE}录取方面，我市今年共有${R}${qingbeiCount}人${RE}被两校录取，其中${R}清华大学${qing}人${RE}、${R}北京大学${bei}人${RE}，录取人数较往年有新突破。此外，另有大批学子被985、211重点高校录取，详细名单将在近日公布。</div>`;
  } else {
    html += `<div class="np-item">今年我市暂无${R}清华、北大${RE}录取，但多名学子被${R}985、211${RE}重点高校录取，整体升学质量保持稳定。</div>`;
  }

  // 一本上线
  html += `<div class="np-item">统计数据显示，我市一本上线${R}${yibenCount.toLocaleString()}人${RE}，上线率${R}${yibenRate.toFixed(1)}%${RE}，本科上线${R}${benkeCount.toLocaleString()}人${RE}。多项指标位居同类城市前列。市教育局表示，将继续深化教育改革，推动基础教育高质量发展。</div>`;

  // 大学招生
  if (universities.length > 0) {
    const uniName = universities[0].customName || (baseName + '师范高等专科学校');
    const enrolled = Math.floor(800 + totalBonus * 200 + Math.random() * 500);
    html += `<div class="np-item">此外，${R}${uniName}${RE}今年面向全国招收新生${R}${enrolled.toLocaleString()}人${RE}，涵盖师范、医学等多个专业方向，为地方经济社会发展培养输送高素质人才。</div>`;
  }

  // 结语
  html += `<div class="np-item" style="margin-top:4px;">市委、市政府向全市教育工作者和广大考生致以热烈祝贺，将一如既往地关心支持教育事业发展，努力办好人民满意的教育。</div>`;

  return html;
}

// v2.4.1d: 资源供需报道文案库（动态文案，根据地图等级替换行政称谓）
// 文案中使用占位符: {areaUnit}=全乡/全县/全市, {govUnit}=乡政府/县政府/市政府, {deptUnit}=乡住建所/县住建局/市住建局, {civilianUnit}=村民/市民
const RESOURCE_REPORTS = {
  housing: {
    name: '住房容量',
    sufficient: [
      { title: '{areaUnit}住房空置率较高，租购市场供过于求',
        body: '新建公租房再入市，{areaUnit}存量房去化周期较长。{deptUnit}表示短期内不再新批住宅用地，下一步将重点消化现有库存。',
        quotes: ['我家楼上楼下都空着，租都租不出去。', '刚从外地来，几天就租到房，价格还比老家便宜。'] },
      { title: '棚改安置房全面交付，老城居民喜迁新居',
        body: '最后一批棚改安置小区提前竣工，居民顺利拿到钥匙，户型面积比原住房平均增加不少。{govUnit}表示将继续推进老旧小区改造。',
        quotes: ['住了半辈子平房，终于能上楼了。', '没想到这么快就分到房，{govUnit}这次说到做到了。'] },
      { title: '人才安居计划收效显著，申请全数获批',
        body: '今年推出的人才安居工程累计配租配售房源，申请通过率高，仍有剩余房源待分配。{govUnit}将继续扩大保障面。',
        quotes: ['硕士毕业来这儿，第一年免费住，压力小太多了。', '我们企业招人时，住房保障是最好用的条件。'] },
    ],
    insufficient: [
      { title: '廉租房轮候排期较长，困难户盼房心焦',
        body: '{areaUnit}廉租房在保家庭已超数干户，新增申请者预计需排队较长时间，部分低保户只能挤在亲戚家。{govUnit}表示将加快房源筹集。',
        quotes: ['全家四口挤在很小的棚子里，冬天漏风夏天漏雨。', '交了三年申请，还没见着房影儿。'] },
      { title: '房价连续上涨，新婚小夫妻买房成奢望',
        body: '新房均价较前年明显上涨，普通工薪层不吃不喝多年才够首付，不少年轻家庭被迫推迟生育计划。{govUnit}表示将加大调控力度。',
        quotes: ['我俩工资加起来不够买一平米，怎么买？', '租房结婚老人能接受，但总归不是长久之计。'] },
      { title: '老城区危房改造缓慢，住户苦等',
        body: '老城区多个棚户区列入改造计划多年，因资金未到位迟迟未动工。部分房屋墙体开裂，雨季漏雨严重。{govUnit}承诺争取专项资金。',
        quotes: ['墙上裂缝能塞进手指头，睡觉都不踏实。', '说要拆五年了，每年都说快了快了。'] },
    ],
    critical: [
      { title: '桥洞下安家，{areaUnit}露宿者激增',
        body: '救助站床位已连续满员，公园长椅、高架桥下等处成临时住所。民政部门启动应急收容预案，{govUnit}呼吁社会各界关注。',
        quotes: ['工地停工就没地方住了，只能在这儿凑合。', '每天晚上路过都看见他们，心里真不是滋味。'] },
      { title: '厂房改建群租房爆满，消防隐患触目惊心',
        body: '一废旧厂房被隔成上百个隔间出租，狭小空间内电线私拉乱接，隐患重重，周边{civilianUnit}多次举报。消防部门已介入。',
        quotes: ['没办法，便宜，一个月才两百。', '我家就在隔壁，天天提心吊胆怕着火。'] },
      { title: '过渡安置房停建，拆迁户无家可归',
        body: '因开发商资金链断裂，原计划建的安置小区停工，拆迁户过渡费也被拖欠多月。{govUnit}已启动法律程序追讨。',
        quotes: ['拿着拆迁协议，却找不到落脚的地儿。', '租房过渡费不够，租房还得自己垫钱。'] },
    ],
  },
  jobs: {
    name: '就业岗位',
    sufficient: [
      { title: '开春首场招聘会现"粥多僧少"',
        body: '{areaUnit}春季人才交流会提供大量岗位，进场求职者相对较少，部分企业降低学历门槛仍招不满人。人社部门将继续加大招工力度。',
        quotes: ['以前是人找工作，现在是工作找人，这种感觉真好。', '我们厂要招几十个操作工，一上午只收到几份简历。'] },
      { title: '登记失业率降至新低，就业形势稳中向好',
        body: '得益于经济持续向好和企业扩产，{areaUnit}城镇登记失业率降至近年新低，就业形势稳中向好。{govUnit}表示将巩固成果。',
        quotes: ['工作不难找，关键是要肯干。', '收入比去年涨了不少，日子越过越有盼头。'] },
      { title: '创业扶持政策落地，新增市场主体大幅增长',
        body: '一系列创业扶持政策落地见效，新增市场主体数量创近年新高，带动就业效果显著。{govUnit}将继续优化营商环境。',
        quotes: ['贷款很快就批了，开个小店不用再看人脸色。', '政策好，我们小老板心里也踏实。'] },
    ],
    insufficient: [
      { title: '结构性就业矛盾突出，"有岗无人"与"有人无岗"并存',
        body: '制造业企业反映技工招工难，而高校毕业生普遍反映岗位薪资低于预期，结构性矛盾突出。人社部门将加强职业培训对接。',
        quotes: ['找了三个月工作，不是嫌工资低就是嫌没经验。', '工厂开出六千月薪都招不到焊工，年轻人不愿意干。'] },
      { title: '应届毕业生就业率低于预期',
        body: '受经济下行压力影响，今年应届毕业生签约率较去年同期下降，不少毕业生选择考研或考公暂缓就业。{govUnit}已出台帮扶措施。',
        quotes: ['投了上百份简历，面试通知没几个。', '先考研再说，找不到工作总不能闲着。'] },
      { title: '部分企业裁员，在岗职工忧心忡忡',
        body: '受市场波动影响，部分企业缩减产能并裁员，在岗职工对就业前景表示担忧。人社部门已启动失业预警机制。',
        quotes: ['上个月部门裁了三分之一，不知道下个月轮到谁。', '工资降了两成，好歹还有份工作。'] },
    ],
    critical: [
      { title: '失业率攀升至高位，就业形势严峻',
        body: '{areaUnit}城镇登记失业率创近年新高，大量劳动者面临就业困难，人社部门启动就业应急预案。{govUnit}承诺加大公益性岗位开发力度。',
        quotes: ['干了二十年，厂子说关就关了，下一步咋办？', '投了几百份简历都石沉大海，不知道还能干啥。'] },
      { title: '停产企业增多，工人集中待岗',
        body: '多家企业因经营困难停产或半停产，大量工人集中待岗，再就业压力骤增。{govUnit}正协调金融机构提供过渡贷款。',
        quotes: ['上个月工资还没发，孩子学费都没着落。', '想换工作又怕找不到，只能先耗着。'] },
      { title: '青年失业率偏高，社会稳定隐患增大',
        body: '青年群体失业率明显高于{areaUnit}平均水平，部分长期失业青年出现情绪波动，社会稳定风险上升。{govUnit}已启动青年就业援助计划。',
        quotes: ['毕业就失业，同学里好几个都回老家了。', '不是不想干，是真没合适的活儿。'] },
    ],
  },
  power: {
    name: '电力供给',
    sufficient: [
      { title: '迎峰度夏电力盈余，企业居民用电无忧',
        body: '供电公司表示，今夏{areaUnit}电力供应充足，不会实施有序用电。新投运变电站使{areaUnit}供电能力提升，电网运行安全稳定。',
        quotes: ['今年夏天再也没跳过闸，空调随便开。', '以前总怕限电耽误生产，今年心里踏实了。'] },
      { title: '新变电站投用，企业"开足马力"生产',
        body: '新建变电站已顺利投用，供电可靠性大幅提升，多个此前因供电不足受限的企业得以满负荷生产。供电公司表示将继续优化网架结构。',
        quotes: ['以前机器不敢全开，现在终于能甩开膀子干了。', '不停电，订单就能按时交，效益自然好。'] },
      { title: '光伏电站并网，偏远地区用电从此"不卡脖子"',
        body: '大型光伏电站并网发电，偏远地区电压不稳问题得到根本改善，惠及广大农户。{govUnit}表示将继续推进清洁能源项目建设。',
        quotes: ['以前一到晚上灯就暗，现在亮堂堂的。', '电压稳了，家里的电器都能用了。'] },
    ],
    insufficient: [
      { title: '高温天负荷连创新高，部分老旧小区频繁跳闸',
        body: '连日高温使用电负荷创历史新高，多个老旧小区因线路老化出现频繁跳闸，居民生活受严重影响。供电公司已安排应急抢修。',
        quotes: ['一天能跳三四次，冰箱里的东西都化了。', '孩子热得哭，空调开一会儿就跳闸。'] },
      { title: '工业区用电需"错峰"，部分企业每周限产两天',
        body: '因区域供电能力不足，部分工业企业被要求错峰用电，每周停产两天，影响企业订单交付和工人收入。{govUnit}正争取上级电网调度支持。',
        quotes: ['工厂一限电就放假，在家待着没工资。', '订单压着交不了货，客户要索赔了。'] },
      { title: '"低电压"顽疾犹存，空调成摆设',
        body: '部分偏远地区电网改造滞后，夏季用电高峰时空调、水泵等大功率电器无法正常启动。供电公司表示改造资金已申报。',
        quotes: ['买了空调就是个摆设，电压不够带不动。', '浇地得错开用电高峰，半夜起来浇水。'] },
    ],
    critical: [
      { title: '{areaUnit}启动有序用电，停工停产波及民生',
        body: '电力缺口持续扩大，{areaUnit}启动有序用电响应。除保民生外，大量工业企业停产让电，部分区域路灯减半开启。{govUnit}呼吁全社会节约用电。',
        quotes: ['路灯灭了一半，晚上出门得打手电。', '医院要保电，我们这些小商户只能自己买发电机。'] },
      { title: '医院启动自备发电保生命线，非紧急手术推迟',
        body: '为优先保障核心医疗区域用电，部分非紧急手术和检查项目已有序推迟。卫生部门表示将全力保障患者安全。',
        quotes: ['手术推到下个月了，理解是理解，心里还是急。', '发电机声音吵，但没它更不行。'] },
      { title: '拉闸限电致停水多日，居民挑水度日',
        body: '因供电不足致水厂停摆，多个地区连续多日停水，居民只能靠消防车送水或到远处挑水维持生活。{govUnit}已启动应急供水预案。',
        quotes: ['这大热天的没水，咋活？', '天天等消防车，比过去还难。'] },
    ],
  },
  water: {
    name: '供水能力',
    sufficient: [
      { title: '新水厂投产，夏季高峰供水无忧',
        body: '新水厂正式并网供水，今夏高峰时段预计仍有较大供水量余度。{govUnit}表示水质检测全部达标，居民可放心饮用。',
        quotes: ['以前夏天水压低洗澡都成问题，今年水哗哗的。', '家住六楼也能正常用水，再也不用半夜起来接水了。'] },
      { title: '安全饮水工程全覆盖，{civilianUnit}告别挑水',
        body: '{areaUnit}所有行政村接通自来水，安全饮水工程实现全覆盖，{civilianUnit}拧开水龙头就有干净水。{govUnit}将继续加强管网维护。',
        quotes: ['活了大半辈子，终于不用挑水了。', '拧开水龙头就有水，跟做梦一样。'] },
      { title: '供水管网改造完成，老城区告别"黄水"困扰',
        body: '老城区供水管网改造工程全面竣工，铸铁管全部更换为新型管材，水质投诉降至近年新低。{govUnit}表示将建立长效管护机制。',
        quotes: ['以前水龙头出来的水是黄的，现在清亮多了。', '终于敢直接用水龙头的水烧饭了。'] },
    ],
    insufficient: [
      { title: '老城区水压偏低，高层住户洗澡靠"夜半"',
        body: '部分老城区供水管网老化，早晚高峰时高层水压不足，不少住户需错峰用水。水务公司表示将加快管网改造进度。',
        quotes: ['晚上九点以前洗澡跟滴油一样，只能等到半夜。', '洗衣机上水要等半天，太不方便了。'] },
      { title: '入夏用水高峰，部分小区定时降压供水',
        body: '水厂满负荷运行仍难满足全部需求，部分地势较高小区实施分时段降压供水，居民生活受到影响。{govUnit}已申请扩建水厂。',
        quotes: ['做饭洗菜要提前接好水，不然到点就没水了。', '降压那段时间水流跟筷子一样细。'] },
      { title: '水厂设备老化，水质时好时差引担忧',
        body: '部分水厂设备运行多年，过滤、消毒能力下降，水质时有浑浊，居民反映不敢直接饮用。{govUnit}承诺加快设备更新。',
        quotes: ['放出来的水有时候有味儿，我们只能买桶装水喝。', '跟上面反映好几次了，说是在想办法。'] },
    ],
    critical: [
      { title: '库容枯竭，{areaUnit}启动最严格用水限制',
        body: '持续干旱致主水源水库库容降至死水位以下，{areaUnit}实行严格限时供水，每日仅早晚各供水两小时。{govUnit}已向上级请求调水支援。',
        quotes: ['每天只有四个小时有水，得用盆盆罐罐接满。', '洗菜水留着冲厕所，一滴都不敢浪费。'] },
      { title: '部分小区断水，消防车成唯一水源',
        body: '因供水管网爆管及水源短缺，多个地势较高小区完全断水，居民靠政府组织的消防车定时送水。{govUnit}正全力抢修管网。',
        quotes: ['天天搬个小板凳等消防车来，比过去还难。', '我家住六楼，提两桶水上去浑身湿透。'] },
      { title: '旱区水源枯竭，{civilianUnit}徒步数公里寻水',
        body: '偏远村庄自备水源井几乎枯竭，部分{civilianUnit}需徒步数公里到邻村取水，老人和留守儿童饮水尤为困难。{govUnit}已紧急调配送水车。',
        quotes: ['一天得走两趟，一趟两小时，就为了两桶水。', '家里的牲口快渴死了，心疼也没办法。'] },
    ],
  },
  sewage: {
    name: '污水治理能力',
    sufficient: [
      { title: '新污水处理厂投运，污水收集处理率超九成',
        body: '新污水处理厂正式投运，日处理能力大幅提升，出水水质稳定达到一级A标准。{govUnit}表示将继续完善配套管网建设。',
        quotes: ['以前河是黑的，现在看着清亮多了。', '臭味没了，河边的房子也好租了。'] },
      { title: '雨污分流改造告竣，"逢雨必涝"成历史',
        body: '老城区雨污分流改造工程全面完工，初雨污染和道路积水问题明显改善。{govUnit}表示将在新区推广该经验。',
        quotes: ['以前一下暴雨门口就成河，今年几场大雨都没事。', '下水道不反味了，屋里空气都好了。'] },
      { title: '工业废水集中处理全覆盖，园区所有企业达标纳管',
        body: '工业园区废水集中处理设施及配套管网全面建成，所有排污企业实现预处理后纳管，集中深度处理。环保部门表示将严格监管。',
        quotes: ['再也不用担心厂里的水污染农田了。', '以前投诉过厂里偷排，现在终于放心了。'] },
    ],
    insufficient: [
      { title: '污水管网覆盖不全，部分生活污水直排',
        body: '{areaUnit}仅半数地区建成污水收集管网，其余地区生活污水多经简易化粪池处理后渗排或就近排入水体。{govUnit}已列入改造计划。',
        quotes: ['我们这条沟，家家户户的水都往里排，夏天臭得很。', '说了好多年要接管子，到现在也没动静。'] },
      { title: '污水处理厂频超负荷，汛期污水溢流风险高',
        body: '{areaUnit}唯一的污水处理厂已运行近二十年，处理能力捉襟见肘。每逢汛期大量雨水涌入，污水溢流时有发生。{govUnit}正推进扩建项目。',
        quotes: ['一下大雨，河里的水就变黑，鱼都翻白肚。', '那股味儿，经过都得捂着鼻子快走。'] },
      { title: '个别企业私设暗管偷排废水，监管难度大',
        body: '环保部门近期查处数起企业私设暗管偷排案件，因偷排手段隐蔽、多在夜间作业，监管查处难度较大。{govUnit}将加大夜间巡查力度。',
        quotes: ['半夜经常闻到一股酸味，熏得睡不着。', '举报好几次了，查完消停一阵又开始了。'] },
    ],
    critical: [
      { title: '河道成"龙须沟"，黑臭水体数年未消',
        body: '贯穿城区的河道因长期接纳未处理污水，河水终年黑臭，蚊蝇滋生，沿线居民不敢开窗。{govUnit}已纳入限期整治名单。',
        quotes: ['夏天窗子一开，那个味道能把人顶个跟头。', '小时候在河里游泳，现在连鱼虾都没了。'] },
      { title: '污水厂建设停工数年，每天数万吨污水直排',
        body: '规划的第二污水处理厂因资金问题停工两年多，新城区每天数万吨生活及工业污水未经处理直接排入下游河道。{govUnit}正争取专项债资金。',
        quotes: ['下游的水都是黑的，浇地都不敢用。', '井水打上来有股怪味儿，肯定跟污水有关。'] },
      { title: '零处理直排，{civilianUnit}饮用水源受威胁',
        body: '多数偏远地区尚无任何污水处理设施，生活污水、养殖废水散排，部分村庄浅层地下水已受污染。{govUnit}已启动应急水源勘探。',
        quotes: ['村里好几个人得怪病，都怀疑跟水有关系。', '上面来取过水样，后来就没下文了。'] },
    ],
  },
  garbage: {
    name: '垃圾处理能力',
    sufficient: [
      { title: '焚烧发电厂投用，告别填埋时代',
        body: '垃圾焚烧发电厂并网发电，{areaUnit}生活垃圾无害化处理率大幅提升，实现"零填埋"。{govUnit}表示将进一步推进垃圾分类。',
        quotes: ['现在垃圾车直接拉去烧了发电，不像以前那样臭了。', '垃圾也能发电，高科技就是好。'] },
      { title: '垃圾分类覆盖率超九成，厨余垃圾变有机肥',
        body: '所有小区完成垃圾分类设施配置，居民分类准确率逐步提升，厨余垃圾就地资源化制成有机肥。{govUnit}将继续扩大覆盖面。',
        quotes: ['一开始觉得麻烦，现在习惯了，分分也不费事。', '用自己分的厨余垃圾沤的肥种菜，心里踏实。'] },
      { title: '垃圾转运体系全面建成，"垃圾围村"彻底解决',
        body: '{areaUnit}所有行政村配备垃圾收集点和转运车，农村生活垃圾"户分类、村收集、镇转运、县处理"体系全覆盖。{govUnit}将加强长效管护。',
        quotes: ['以前垃圾顺手就扔沟里，现在村头就有垃圾桶。', '村里干净多了，城里亲戚回来都说变化大。'] },
    ],
    insufficient: [
      { title: '中转站超负荷运转，部分社区垃圾清运不及时',
        body: '{areaUnit}仅有少数垃圾中转站，处理能力已跟不上增量，部分小区垃圾桶满溢，需多日才能清理一次。{govUnit}已规划新建中转站。',
        quotes: ['垃圾桶都堆成山了，猫狗扒得到处都是。', '打电话催了好几次，说是中转站堆不下了。'] },
      { title: '填埋场将提前"寿终"，新建焚烧厂用地难选址',
        body: '原设计使用多年的垃圾填埋场，因增量过快，预计短期内填满。新建焚烧发电厂项目因选址遭周边反对而搁置。{govUnit}将加强选址论证。',
        quotes: ['谁都不想垃圾厂建在自家门口，但总得有个地方放啊。', '建也难不建也难，这事得有人拿主意。'] },
      { title: '餐厨垃圾正规收运率不足，"泔水猪"隐患大',
        body: '{areaUnit}每日产生餐厨垃圾逾百吨，正规收运处理量较低，大量餐厨垃圾去向不明，存在回流餐桌隐患。{govUnit}已开展专项整治。',
        quotes: ['经常看到有人骑三轮车来捞泔水，也不知道拉到哪儿去。', '地沟油的事听着就吓人，在外面吃饭心里都犯嘀咕。'] },
    ],
    critical: [
      { title: '城郊垃圾山自燃频发，浓烟终年不散',
        body: '存量数十万吨的非正规垃圾堆放点因沼气积聚，自燃频发，方圆数公里内居民常年受恶臭和浓烟困扰。{govUnit}已启动应急处置方案。',
        quotes: ['窗户一年四季不敢开，那股味儿能把人熏吐。', '孩子老是咳嗽，医生说跟空气有关系。'] },
      { title: '填埋场超库容拒收，千吨垃圾无处可去',
        body: '唯一的垃圾填埋场因严重超库容被迫关闭，{areaUnit}每天产生的大量生活垃圾面临"无处可送"的困境。{govUnit}紧急协调外运处理。',
        quotes: ['垃圾车停在停车场好几天了，车里都生蛆了。', '再这么下去，垃圾只能堆大街了。'] },
      { title: '偏远地区垃圾随意倾倒，山沟变成露天垃圾场',
        body: '部分偏远地区无任何正规垃圾处理设施，{civilianUnit}习惯将垃圾就近倾倒入山沟、河道，生态环境遭到严重破坏。{govUnit}已部署清理行动。',
        quotes: ['山沟里全是垃圾，塑料袋挂得满树都是。', '以前山沟里水是清的，现在都不敢下去。'] },
    ],
  },
};

// v2.4.1d: 替换文案中的占位符为动态称谓
function _fillReportTemplate(text, ctx) {
  return text
    .replace(/\{areaUnit\}/g, ctx.areaUnit)
    .replace(/\{govUnit\}/g, ctx.govUnit)
    .replace(/\{deptUnit\}/g, ctx.deptUnit)
    .replace(/\{civilianUnit\}/g, ctx.civilianUnit);
}

// v2.4.1c: 计算资源供需状态
function _getResourceStatus(s) {
  const results = {};
  let housingCap = 0;
  if (s.buildings) {
    for (const b of s.buildings) {
      if (b.underConstruction) continue;
      const def = (typeof BUILDINGS !== 'undefined') ? BUILDINGS[b.type] : null;
      if (def && def.eff && def.eff.pop) housingCap += def.eff.pop;
    }
  }
  const pop = Math.max(s.population || 1, 1);
  const housingRatio = housingCap / pop;
  results.housing = housingRatio > 1.2 ? 'sufficient' : housingRatio > 0.85 ? 'insufficient' : 'critical';
  const unemp = s.unemployment || 0;
  results.jobs = unemp < 0.03 ? 'sufficient' : unemp < 0.12 ? 'insufficient' : 'critical';
  const power = s.powerBalance || 0;
  results.power = power > 50 ? 'sufficient' : power > -20 ? 'insufficient' : 'critical';
  const water = s.waterBalance || 0;
  results.water = water > 50 ? 'sufficient' : water > -20 ? 'insufficient' : 'critical';
  let sewageCap = 0;
  if (s.buildings) {
    for (const b of s.buildings) {
      if (b.underConstruction) continue;
      const def = (typeof BUILDINGS !== 'undefined') ? BUILDINGS[b.type] : null;
      if (def && def.eff && def.eff.waterPol && def.eff.waterPol < 0) sewageCap += Math.abs(def.eff.waterPol) * 10;
    }
  }
  const sewageDemand = pop * 0.01;
  results.sewage = sewageCap > sewageDemand * 1.3 ? 'sufficient' : sewageCap > sewageDemand * 0.8 ? 'insufficient' : 'critical';
  let wasteCap = 0;
  if (s.buildings) {
    for (const b of s.buildings) {
      if (b.underConstruction) continue;
      const def = (typeof BUILDINGS !== 'undefined') ? BUILDINGS[b.type] : null;
      if (b.type === 'wastePlant' && def && def.eff && def.eff.airPol && def.eff.airPol < 0) wasteCap += Math.abs(def.eff.airPol) * 5;
    }
  }
  const wasteDemand = pop * 0.005;
  results.garbage = wasteCap > wasteDemand * 1.3 ? 'sufficient' : wasteCap > wasteDemand * 0.8 ? 'insufficient' : 'critical';
  return results;
}

// v2.4.1d: 生成资源供需报道（每次只选一个主题，返回{html, quotes}以便留言合并到市民信箱）
function generateResourceReport(s, ctx) {
  const statuses = _getResourceStatus(s);
  const allKeys = Object.keys(RESOURCE_REPORTS);
  // v2.4.1d: 每次只选一个主题
  const selected = allKeys[Math.floor(Math.random() * allKeys.length)];
  const cat = RESOURCE_REPORTS[selected];
  const status = statuses[selected];
  const entries = cat[status];
  if (!entries || entries.length === 0) return { html: '', quotes: [] };
  const entry = entries[Math.floor(Math.random() * entries.length)];
  const title = _fillReportTemplate(entry.title, ctx);
  const body = _fillReportTemplate(entry.body, ctx);
  let html = `<div class="np-item"><strong>${cat.name}：${title}</strong></div>`;
  html += `<div class="np-item" style="padding-left:12px;">${body}</div>`;
  // v2.4.1d: 留言合并到市民信箱，不在本板块显示
  return { html, quotes: entry.quotes };
}

// v2.4.1d: 城市综合评分报道（每年1月年报，使用动态称谓）
function generateCityRatingReport(s, ctx) {
  let score = (s.happiness || 50) * 0.35;
  score += clamp(100 - (s.airQuality || 35) * 0.4, 0, 100) * 0.1;
  score += (s.greenCoverage || 0) * 0.1;
  score += clamp(100 - (s.corruption || 0), 0, 100) * 0.15;
  score += clamp(100 - (s.unemployment || 0) * 500, 0, 100) * 0.1;
  score += clamp((s.gdp || 0) / 100, 0, 100) * 0.1;
  score += (s.waterQuality || 70) * 0.1;
  score = Math.round(clamp(score, 0, 100));
  const lastScore = s._lastYearRating || null;
  const diff = lastScore !== null ? score - lastScore : null;
  s._lastYearRating = score;
  let category, entries;
  if (score >= 90) {
    category = 'near_perfect';
    entries = [
      { title: `${s.cityName}综合评分${score}分，位列全省前列`, body: `最新年度城市综合考评结果公布，${ctx.areaShort}以${score}分位列前茅，生态环境、营商便利度、公共服务满意度三项指标均获好评。`, quotes: ['这几年变化太大了，路宽了、树多了、办事也方便了。', '以前觉得大城市好，现在出去出差反倒不习惯了。'] },
      { title: `宜居指数接近满分，${ctx.areaShort}获评"最具幸福感城市"`, body: `在刚刚发布的城市幸福感报告中，${ctx.areaShort}获评"最具幸福感城市"，社区服务、治安环境、邻里关系等指标名列前茅。`, quotes: ['在这儿生活了四十年，越来越舍不得走了。', '从外地调过来工作，现在把老婆孩子都接过来了，不想走了。'] },
    ];
  } else if (score >= 60) {
    category = 'passing';
    if (diff !== null && diff < -3) {
      entries = [
        { title: `${ctx.areaShort}综合评分${score}分，涉险保住及格线`, body: `最新考评${ctx.areaShort}获${score}分，较去年下降${Math.abs(diff)}分，距不及格仅一步之遥。报告指出多项指标拉分严重。`, quotes: ['刚及格？说实话我觉得好多地方不及格。', '评这个分也不容易，好歹及格了，明年再掉就难看了。'] },
      ];
    } else if (diff !== null && diff > 3) {
      entries = [
        { title: `涉险过线，${score}分背后喜忧参半`, body: `${ctx.areaShort}今年获${score}分，较去年微升${diff}分。部分指标有所改善，但仍有短板。`, quotes: ['分数涨了，可我没觉得生活有啥大变化。', '慢慢来吧，好歹方向是对的。'] },
      ];
    } else {
      entries = [
        { title: `刚好及格，${score}分让${ctx.civilianUnit}"松口气又提口气"`, body: `${ctx.areaShort}获${score}分，距及格线略有余量。考核组肯定了${ctx.areaShort}在债务化解方面的努力，但指出部分问题依然突出。`, quotes: ['好歹没掉下去，但听着也不踏实。', `${ctx.govUnit}说在努力了，希望明年能多涨几分。`] },
      ];
    }
  } else {
    category = 'failing';
    if (lastScore !== null && lastScore >= 60) {
      entries = [
        { title: `${ctx.areaShort}综合评分${score}分，首次跌入"不及格"区间`, body: `今年考评获${score}分，是实行城市综合考评以来首次不及格。基础设施老化、环境污染治理不力、公共服务满意度大幅下滑是主因。`, quotes: ['这个分数，听着像学生考试不及格，臊得慌。', '天天大兴土木，修了半天还不如不修，分低不冤。'] },
      ];
    } else {
      entries = [
        { title: `${score}分继续"红灯"，连续不及格`, body: `今年${ctx.areaShort}${score}分，连续不及格${diff !== null && diff < 0 ? `，且较去年再降${Math.abs(diff)}分` : ''}。考评报告措辞严厉，指出部分领域存在"治理失灵"风险。`, quotes: ['又不及格，这帮人该换换了吧。', '年轻人能走的都走了，这地方越来越没希望了。'] },
      ];
    }
  }
  if (diff !== null && diff >= 10 && category !== 'near_perfect') {
    entries = [
      { title: `触底反弹，综合评分升至${score}分`, body: `较去年大幅提升${diff}分，强力反腐、债务化解、民生补短板三记重拳初见成效，${ctx.civilianUnit}信心回暖。`, quotes: ['去年都没脸提，今年总算及格了，慢慢来吧。', '新书记上来后动静确实大，希望能稳住别掉回去。'] },
    ];
  } else if (diff !== null && diff <= -10 && category !== 'failing') {
    entries = [
      { title: `从"优秀"到"平庸"，综合评分一年降${Math.abs(diff)}分`, body: `今年${ctx.areaShort}综合评分仅${score}分，较去年下降${Math.abs(diff)}分。多项指标跌幅居全省首位，${ctx.civilianUnit}满意度明显下滑。`, quotes: ['办个执照跑四五趟，谁还愿意来投资？', '前几年招商热闹得很，今年好多厂子悄悄搬走了。'] },
    ];
  }
  const entry = entries[Math.floor(Math.random() * entries.length)];
  let html = `<div class="np-item"><strong>${entry.title}</strong></div>`;
  html += `<div class="np-item">${entry.body}</div>`;
  if (diff !== null) {
    const trendStr = diff > 0 ? `较去年上升${diff}分` : diff < 0 ? `较去年下降${Math.abs(diff)}分` : '与去年持平';
    html += `<div class="np-item" style="font-size:11px;color:var(--text-3);">（${trendStr}）</div>`;
  }
  // v2.4.1d: 留言合并到市民信箱
  return { html, quotes: entry.quotes };
}

// v2.4.6b: 行政区划申报与城市荣誉新闻报道
function generateAdminUpgradeNews(s, baseName, areaShort) {
  if (!areaShort) areaShort = s.cityName || '本市';
  const logs = (s.eventLog || []).filter(e => e.turn >= s.turn - 12);
  let html = '';
  let hasContent = false;

  // 检查近期是否有行政区划申报相关事件
  const adminEvents = logs.filter(e =>
    e.text.includes('撤县设市') || e.text.includes('计划单列市') || e.text.includes('国家级新区') ||
    e.text.includes('文明城市') || e.text.includes('卫生城市') || e.text.includes('考察期')
  );

  if (adminEvents.length === 0) {
    // 没有相关事件时，如果有已获评的荣誉或正在考察期，也生成报道
    const cs = s.cityStatus || {};
    const h = s.cityHonors || {};
    const app = s.adminApplication;
    if (!cs.isCountyCity && !cs.isSeparatelyPlanned && !cs.hasNationalNewArea &&
      !h.civilizedCity && !h.sanitaryCity &&
      !(app && app.status === 'reviewing') &&
      !(h.civilizedApplying || h.sanitaryApplying)) {
      return null;
    }
  }

  html += `<div class="np-section">`;
  html += `<div class="np-section-title">行政区划与荣誉</div>`;
  hasContent = true;

  // 1. 撤县设市报道
  const countyCityLogs = adminEvents.filter(e => e.text.includes('撤县设市'));
  if (countyCityLogs.length > 0) {
    const success = countyCityLogs.some(e => e.type === 'success');
    const rejected = countyCityLogs.some(e => e.text.includes('驳回') || e.text.includes('未通过'));
    const reviewing = countyCityLogs.some(e => e.text.includes('考察期'));
    if (success) {
      html += `<div class="np-item np-item-success"><strong>国务院批复${baseName}撤县设市 行政管理体制迈上新台阶</strong></div>`;
      html += `<div class="np-item">本报讯（记者 时政）经国务院批准，${areaShort}正式撤县设市，标志着${baseName}城市化进程迈出关键一步。撤县设市后，${baseName}将享有更大财政自主权，可直接征收城市维护建设税，上级转移支付力度也将加大。</div>`;
      html += `<div class="np-item">据悉，此次撤县设市历经严格考察审批，${baseName}在人口规模、经济总量、城镇化率、财政收入等方面均达到设市标准。${areaShort}相关负责人表示，将以撤县设市为契机，加快推进城市基础设施建设，提升公共服务水平。</div>`;
      html += `<div class="np-item" style="font-size:11px;color:var(--text-3);">业内人士指出，撤县设市不仅是名称变更，更意味着发展定位从农业主导向工商业主导转变。</div>`;
    } else if (rejected) {
      html += `<div class="np-item np-item-danger"><strong>${baseName}撤县设市申报未获批准</strong></div>`;
      html += `<div class="np-item">本报讯（记者 时政）记者从有关部门获悉，${baseName}撤县设市申报在考察期结束后未获批准。据了解，考察期内部分指标出现波动，未能持续达标，上级审批部门据此作出不予批准的决定。</div>`;
      html += `<div class="np-item">${areaShort}相关负责人表示，将认真总结经验，补齐短板，待条件成熟后重新申报。有关部门指出，撤县设市是严肃的行政事项，各地应量力而行，切勿盲目申报。</div>`;
    } else if (reviewing) {
      html += `<div class="np-item"><strong>${baseName}撤县设市申报进入考察期</strong></div>`;
      html += `<div class="np-item">本报讯（记者 时政）${baseName}正式向上级提交撤县设市申报，目前已进入为期数月的考察期。考察期间，上级有关部门将对${baseName}的人口规模、经济指标、城镇化水平、社会治理等各方面进行全面评估。</div>`;
      html += `<div class="np-item" style="font-size:11px;color:var(--text-3);">据了解，撤县设市考察期较长，期间各项指标需保持稳定，任何负面波动都可能影响最终审批结果。</div>`;
    }
  }

  // 2. 计划单列市报道
  const sepCityLogs = adminEvents.filter(e => e.text.includes('计划单列市'));
  if (sepCityLogs.length > 0) {
    const success = sepCityLogs.some(e => e.type === 'success');
    const rejected = sepCityLogs.some(e => e.text.includes('驳回'));
    const reviewing = sepCityLogs.some(e => e.text.includes('考察期'));
    if (success) {
      html += `<div class="np-item np-item-success"><strong>国务院批复${baseName}列为国家计划单列市 财政关系实现重大突破</strong></div>`;
      html += `<div class="np-item">本报讯（记者 时政）经国务院批准，${baseName}正式列为国家社会与经济发展计划单列市，成为全国少数享有此殊荣的城市之一。计划单列后，${baseName}财政预算直接与中央对接，省级财政不再参与分成，将极大增强地方财政实力。</div>`;
      html += `<div class="np-item">分析人士指出，计划单列市地位极为稀缺，全国目前仅有深圳、大连、青岛、宁波、厦门等城市享此待遇。${baseName}获此资格，充分体现了中央对其战略地位和综合实力的高度认可。</div>`;
    } else if (rejected) {
      html += `<div class="np-item np-item-danger"><strong>${baseName}计划单列市申报未获批准</strong></div>`;
      html += `<div class="np-item">本报讯（记者 时政）${baseName}计划单列市申报在考察期结束后未获国务院批准。据了解，计划单列市名额极为稀缺，审批标准极为严格，${baseName}在考察期内部分指标未达到预期水平。</div>`;
    } else if (reviewing) {
      html += `<div class="np-item"><strong>${baseName}计划单列市申报进入考察期</strong></div>`;
      html += `<div class="np-item">本报讯（记者 时政）${baseName}向上级提交计划单列市申报，现已进入考察期。计划单列市审批标准极为严格，全国仅有少数城市享此待遇，考察期内各项指标须保持优异水平。</div>`;
    }
  }

  // 3. 国家级新区报道
  const newAreaLogs = adminEvents.filter(e => e.text.includes('国家级新区'));
  if (newAreaLogs.length > 0) {
    const success = newAreaLogs.some(e => e.type === 'success');
    const rejected = newAreaLogs.some(e => e.text.includes('驳回'));
    const reviewing = newAreaLogs.some(e => e.text.includes('考察期'));
    if (success) {
      html += `<div class="np-item np-item-success"><strong>国务院批复设立${baseName}国家级新区 城市发展空间大幅拓展</strong></div>`;
      html += `<div class="np-item">本报讯（记者 时政）经国务院批复，${baseName}国家级新区正式设立。新区规划面积大幅扩展，将享受省级经济管理权限，新区内符合条件的企业所得税率降至15%，同时获得上级定期财政扶持资金。</div>`;
      html += `<div class="np-item">据了解，国家级新区是国家战略层面的重要发展平台，截至目前全国仅有19个国家级新区。${baseName}新区的设立，标志着${areaShort}被纳入国家区域发展重大战略布局，未来发展空间广阔。</div>`;
      html += `<div class="np-item" style="font-size:11px;color:var(--text-3);">新区获批后，可开发土地面积将增加约30%，为产业集聚和城市扩张提供了充足空间。</div>`;
    } else if (rejected) {
      html += `<div class="np-item np-item-danger"><strong>${baseName}国家级新区申报未获批准</strong></div>`;
      html += `<div class="np-item">本报讯（记者 时政）${baseName}国家级新区申报在考察期结束后未获国务院批准。国家级新区审批极为严格，全国自2017年以来已无新增。${baseName}在考察期内部分指标未达到设区标准。</div>`;
    } else if (reviewing) {
      html += `<div class="np-item"><strong>${baseName}国家级新区申报进入考察期</strong></div>`;
      html += `<div class="np-item">本报讯（记者 时政）${baseName}向国务院提交国家级新区设立申报，现已进入考察期。国家级新区审批标准极高，要求地区GDP、工业规模、财政收入等均达到较高水平，考察期内须保持各项指标稳定。</div>`;
    }
  }

  // 4. 文明城市报道
  const civLogs = adminEvents.filter(e => e.text.includes('文明城市'));
  if (civLogs.length > 0) {
    const success = civLogs.some(e => e.type === 'success');
    const rejected = civLogs.some(e => e.text.includes('未通过'));
    const reviewing = civLogs.some(e => e.text.includes('考察期') || e.text.includes('申报'));
    if (success) {
      html += `<div class="np-item np-item-success"><strong>${baseName}荣获"全国文明城市"称号 市民文明素质获高度评价</strong></div>`;
      html += `<div class="np-item">本报讯（记者 文明）在最新一届全国文明城市评选中，${baseName}凭借优异的城市文明建设成果，成功获评"全国文明城市"称号。这是${areaShort}在城市软实力建设方面取得的又一重大荣誉。</div>`;
      html += `<div class="np-item">评选组对${baseName}在市民文明素质、社会治安、教育水平、环境治理等方面的表现给予高度评价。据了解，获评文明城市后，${baseName}市民满意度显著提升，城市品牌效应增强，招商引资吸引力大幅提高。</div>`;
      html += `<div class="np-item" style="font-size:11px;color:var(--text-3);">全国文明城市是反映城市整体文明水平的最高荣誉，每三年评选一届。</div>`;
    } else if (rejected) {
      html += `<div class="np-item np-item-danger"><strong>${baseName}文明城市评选落选 考察期内部分指标未达标</strong></div>`;
      html += `<div class="np-item">本报讯（记者 文明）${baseName}在本届全国文明城市评选中未能获评。据了解，考察期内${baseName}在市民满意度、教育水平、空气质量等方面出现波动，未能持续达到评选标准。</div>`;
    } else if (reviewing) {
      html += `<div class="np-item"><strong>${baseName}申报全国文明城市 进入考察评估期</strong></div>`;
      html += `<div class="np-item">本报讯（记者 文明）${baseName}已正式申报全国文明城市，目前进入考察评估期。全国文明城市评选标准严格，要求市民满意度、教育水平、空气质量、廉政建设等多方面指标持续达标。</div>`;
    }
  }

  // 5. 卫生城市报道
  const sanLogs = adminEvents.filter(e => e.text.includes('卫生城市'));
  if (sanLogs.length > 0) {
    const success = sanLogs.some(e => e.type === 'success');
    const rejected = sanLogs.some(e => e.text.includes('未通过'));
    const reviewing = sanLogs.some(e => e.text.includes('考察期') || e.text.includes('申报'));
    if (success) {
      html += `<div class="np-item np-item-success"><strong>${baseName}荣获"国家卫生城市"称号 城市卫生水平获充分肯定</strong></div>`;
      html += `<div class="np-item">本报讯（记者 卫健）全国爱卫会日前正式命名${baseName}为"国家卫生城市"，这是${areaShort}在城市卫生和健康管理方面获得的国家级荣誉。</div>`;
      html += `<div class="np-item">评选组对${baseName}在医疗卫生服务体系、饮用水水质、绿化覆盖率、城市环境卫生等方面的表现给予充分肯定。获评后，${baseName}市民健康意识和幸福指数显著提升。</div>`;
    } else if (rejected) {
      html += `<div class="np-item np-item-danger"><strong>${baseName}卫生城市评选落选 考察期内指标波动</strong></div>`;
      html += `<div class="np-item">本报讯（记者 卫健）${baseName}在本轮国家卫生城市评选中未能获评。考察期内医疗、水质、绿化等指标出现波动，未能持续达到评选标准。</div>`;
    } else if (reviewing) {
      html += `<div class="np-item"><strong>${baseName}申报国家卫生城市 进入考察评估期</strong></div>`;
      html += `<div class="np-item">本报讯（记者 卫健）${baseName}已正式申报国家卫生城市，目前进入考察评估期。评选要求医疗指数、水质、绿化、廉政建设等指标持续达标。</div>`;
    }
  }

  // 6. 已获评荣誉展示（无新事件时也展示已有荣誉）
  const cs = s.cityStatus || {};
  const honors = s.cityHonors || {};
  const hasHonors = cs.isCountyCity || cs.isSeparatelyPlanned || cs.hasNationalNewArea ||
    honors.civilizedCity || honors.sanitaryCity;
  if (hasHonors && adminEvents.length === 0) {
    const honorList = [];
    if (cs.isCountyCity) honorList.push('撤县设市');
    if (cs.isSeparatelyPlanned) honorList.push('国家计划单列市');
    if (cs.hasNationalNewArea) honorList.push('国家级新区');
    if (honors.civilizedCity) honorList.push('全国文明城市');
    if (honors.sanitaryCity) honorList.push('国家卫生城市');
    html += `<div class="np-item"><strong>${baseName}城市荣誉榜：${honorList.join('、')}</strong></div>`;
    html += `<div class="np-item">${baseName}近年来在城市建设和治理方面取得显著成效，先后获得多项国家级荣誉称号和行政升级。这些荣誉不仅提升了城市形象，也为${areaShort}发展注入了强劲动力。</div>`;
    if (cs.isCountyCity || cs.isSeparatelyPlanned) {
      html += `<div class="np-item" style="font-size:11px;color:var(--text-3);">得益于行政地位提升，${baseName}财政留成比例提高，上级定期拨付扶持资金，地方可用财力显著增强。</div>`;
    }
  }

  // 正在考察中的提示
  const app = s.adminApplication;
  if (app && app.status === 'reviewing') {
    const monthsLeft = (app.reviewMonths || 6) - (s.turn - app.turnSubmitted);
    if (monthsLeft > 0 && adminEvents.filter(e => e.text.includes('考察期')).length === 0) {
      const appNames = { countyCity: '撤县设市', separatelyPlanned: '计划单列市', nationalNewArea: '国家级新区' };
      html += `<div class="np-item" style="font-size:11px;color:var(--text-3);">${appNames[app.type] || '行政区划'}申报正在考察期中，剩余${monthsLeft}个月。</div>`;
    }
  }

  html += `</div>`;
  return hasContent ? html : null;
}

// v2.4.7: 交通建筑报纸联动文案
function generateTransportNews(s, baseName) {
  const news = [];

  // 检查机场
  const airports = s.buildings.filter(b => b.type === 'airport' && !b.underConstruction);
  for (const airport of airports) {
    const name = airport.customName || '机场';
    // 新机场通航
    if (airport.age === 0 || (s.turn > 0 && airport.age <= 1)) {
      news.push({
        title: `${name}正式通航`,
        content: `本报讯 ${name}今日正式通航。该机场等级为${airport.airportClass || '2C'}级，跑道长度${airport.runwayLength || 6}格，` +
                 `月旅客吞吐量预计达${(airport.passengerFlow || 600).toLocaleString()}人次。` +
                 `机场的建成将极大改善我市交通条件，促进经济社会发展。`,
        category: 'transport'
      });
    }
    // v2.4.7b: 国际机场新闻 — 使用 internationalUpgradeTurn 而非 age
    if (airport.isInternational && s.turn - (airport.internationalUpgradeTurn ?? -999) <= 1) {
      news.push({
        title: `${name}获批升格为国际机场`,
        content: `本报讯 经国务院批准，${name}正式升格为国际机场。这标志着我市对外开放水平迈上新台阶，` +
                 `预计每月新增国际游客${Math.floor((airport.passengerFlow || 600) * 0.3).toLocaleString()}人次，` +
                 `带来可观旅游经济收入。市长表示，将以此为契机，加快打造区域航空枢纽。`,
        category: 'transport'
      });
    }
  }

  // 检查火车站/高铁站
  const stations = s.buildings.filter(b =>
    (b.type === 'railwayStation' || b.type === 'hsrStation') && !b.underConstruction
  );
  for (const station of stations) {
    const name = station.customName || (station.type === 'hsrStation' ? '高铁站' : '火车站');
    // 新站启用
    if (station.age === 0 || (s.turn > 0 && station.age <= 1)) {
      const isHsr = station.type === 'hsrStation';
      news.push({
        title: `${name}正式启用`,
        content: `本报讯 ${name}今日正式投入运营。该站等级为${station.stationGrade || '三等站'}，` +
                 `设计月发送旅客${(station.passengerFlow || 2000).toLocaleString()}人次。` +
                 `${isHsr ? '高铁的开通将使我市融入全国高铁网络，' : ''}` +
                 `极大方便市民出行和物资运输。`,
        category: 'transport'
      });
    }
  }

  // 春运新闻（1-2月）
  if (s.month === 1 || s.month === 2) {
    const stationCount = stations.length;
    if (stationCount > 0) {
      const totalFlow = stations.reduce((sum, st) => sum + (st.passengerFlow || 0), 0);
      news.push({
        title: `春运进行时：${baseName}迎来客流高峰`,
        content: `本报讯 一年一度的春运大幕已经拉开。${baseName}${stationCount}个火车站（含高铁站）` +
                 `预计发送旅客${(totalFlow * 2.5).toLocaleString()}人次。` +
                 `铁路部门已加开临客，增开售票窗口，全力保障旅客平安出行。` +
                 `相关部门提醒市民合理安排出行时间，注意出行安全。`,
        category: 'transport'
      });
    }
  }

  // 港口
  const ports = s.buildings.filter(b => b.type === 'port' && !b.underConstruction);
  for (const port of ports) {
    if (port.age === 0 || (s.turn > 0 && port.age <= 1)) {
      news.push({
        title: `${port.customName || '港口码头'}正式投入运营`,
        content: `本报讯 ${port.customName || '港口码头'}今日正式投入运营。` +
                 `该港口月客运量预计达${(port.passengerFlow || 500).toLocaleString()}人次，` +
                 `将有效提升我市水路客货运能力，促进对外贸易发展。`,
        category: 'transport'
      });
    }
  }

  return news;
}

