/* 源自《置身事内》单文件版 - 个人事件系统 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 个人事件系统 ==============
const PERSONAL_EVENTS = [
  {
    id: 'visitOldLeader',
    title: '探望老领导',
    desc: (s) => `退休的老领导来电，邀请你去家中一叙。老领导人脉广泛，这次拜访可能对你的仕途有所帮助。`,
    options: [
      { text: '带上好茶登门拜访', cost: 5, effects: { merit: 10, corruption: -2, inspectionRisk: -3, happiness: 2 }, msg: '老领导甚是欣慰，向组织部门美言了几句，你的政绩评分提升' },
      { text: '电话问候一下就好', cost: 0, effects: { merit: 2 }, msg: '老领导表示理解，但你感觉错过了一些人脉积累的机会' },
      { text: '以工作繁忙为由推辞', cost: 0, effects: { merit: -5, happiness: -1 }, msg: '老领导在电话那头沉默了许久…听说他在老干部局有些影响力' },
    ]
  },
  {
    id: 'stockTip',
    title: '股票内幕消息',
    desc: (s) => `一位"朋友"透露某只股票即将大涨，称这是稳赚不赔的机会。但你隐约知道此人背景复杂。`,
    options: [
      { text: '投入¥50万跟一波', cost: 50, effects: { privateAccount: 80, corruption: 5, inspectionRisk: 8 }, msg: '股票果然大涨，你净赚¥30万！但这笔钱的来源经得起查吗？', requirePrivate: 50 },
      { text: '投入¥200万重仓杀入', cost: 200, effects: { privateAccount: 350, corruption: 12, inspectionRisk: 20 }, msg: '大赚¥150万！但有人开始注意你的异常财富增长', requirePrivate: 200 },
      { text: '婉拒，君子爱财取之有道', cost: 0, effects: { merit: 5, corruption: -3 }, msg: '你坚持原则，虽然错过了一笔钱，但问心无愧' },
    ]
  },
  {
    id: 'banquetInvite',
    title: '企业家宴请',
    desc: (s) => `本地知名企业家设宴邀请你出席，席间可能会"聊到"一些审批事项。`,
    options: [
      { text: '出席宴会，来者不拒', cost: 0, effects: { privateAccount: 20, corruption: 8, inspectionRisk: 10, happiness: -2 }, msg: '宴会上收到"土特产"若干，企业家的事也好办了' },
      { text: '出席但只吃饭不办事', cost: 0, effects: { privateAccount: 5, corruption: 2, inspectionRisk: 3 }, msg: '饭吃了，事没办，企业家面带微笑但眼神不太友善' },
      { text: '拒绝赴宴', cost: 0, effects: { merit: 3, corruption: -1 }, msg: '你以公务为由婉拒，虽然得罪了人，但保住了底线' },
    ]
  },
  {
    id: 'colleagueGossip',
    title: '同事密谈',
    desc: (s) => `一位同僚私下找到你，透露了一些关于上级考核的小道消息，并提出"互相关照"的建议。`,
    options: [
      { text: '结成同盟，互通有无', cost: 0, effects: { corruption: 6, inspectionRisk: 5, merit: 3 }, msg: '你与同僚达成了默契，在考核中互相美言，但这也意味着利益捆绑' },
      { text: '听听就好，不表态', cost: 0, effects: { merit: 1 }, msg: '你保持了距离，同僚有些失望但也没说什么' },
      { text: '向上级反映此事', cost: 0, effects: { merit: 8, corruption: -3, happiness: -3 }, msg: '上级对你的政治觉悟表示肯定，但同僚从此对你敬而远之' },
    ]
  },
  {
    id: 'relativeJob',
    title: '亲戚求安排',
    desc: (s) => `一个远房亲戚带着礼物上门，想让你帮忙安排孩子进体制内工作。`,
    options: [
      { text: '安排个闲职', cost: 0, effects: { corruption: 5, inspectionRisk: 5, happiness: 1 }, msg: '亲戚的孩子进了某个清闲部门，但这件事迟早会被人知道' },
      { text: '帮忙通过正规考试', cost: 5, effects: { merit: 3, happiness: 1 }, msg: '你让亲戚的孩子好好备考，并推荐了复习资料，算帮得光明正大' },
      { text: '一口回绝', cost: 0, effects: { happiness: -2 }, msg: '亲戚悻悻而去，逢年过节怕是要绕着走了' },
    ]
  },
  {
    id: 'oldFriendTrouble',
    title: '老友求助',
    desc: (s) => `发小打来电话，说他被卷入了一场经济纠纷，想让你跟有关部门"打个招呼"。`,
    options: [
      { text: '出面帮忙打招呼', cost: 0, effects: { corruption: 8, inspectionRisk: 12, merit: -3 }, msg: '你给有关部门打了电话，发小的事很快解决了，但这事留下了痕迹' },
      { text: '请律师帮他打官司', cost: 30, effects: { merit: 5, happiness: 1 }, msg: '你自掏腰包请了律师，发小最终胜诉，对你的义气感激不已' },
      { text: '爱莫能助', cost: 0, effects: { happiness: -1 }, msg: '你表示无能为力，发小虽然理解但语气中透着失望' },
    ]
  },
  {
    id: 'charityDonation',
    title: '慈善募捐',
    desc: (s) => `县里组织慈善募捐活动，捐得多了能提升声望，但私人账户也要出血。`,
    options: [
      { text: '捐¥30万，做个表率', cost: 30, effects: { merit: 8, reputation: 5, happiness: 3, corruption: -2 }, msg: '你的慷慨捐款上了本地新闻，群众纷纷点赞' },
      { text: '捐¥100万，大出风头', cost: 100, effects: { merit: 15, reputation: 10, happiness: 5, corruption: -4, inspectionRisk: -5 }, msg: '你的大手笔募捐轰动全县，上级也注意到了你的"格局"' },
      { text: '意思一下，捐¥5万', cost: 5, effects: { merit: 1 }, msg: '你捐了象征性的数目，没人说什么但也没人记住' },
    ]
  },
  // v2.2.4b: 拉拢干部事件
  {
    id: 'recruitOfficial',
    title: '拉拢干部',
    desc: (s) => {
      if (!s.personnel) return '人事系统尚未解锁。';
      const factionless = s.personnel.officials.filter(o => !o.faction && !Object.values(s.personnel.appointments).includes(o.id));
      if (factionless.length === 0) return '目前储备池中没有无派系干部可供拉拢。等待年度考试补充新人。';
      const names = factionless.slice(0, 3).map(o => o.name).join('、');
      return `储备池中有${factionless.length}名无派系干部（${names}等），可通过宴请、谈心将其拉拢为嫡系。嫡系忠诚度更高，晋升时可随调。`;
    },
    options: [
      {
        text: '设宴拉拢（¥20万）',
        cost: 20,
        effects: { corruption: 2, inspectionRisk: 3 },
        msg: '宴席上觥筹交错，干部被你的诚意打动',
        requirePrivate: 20,
        customAction: 'recruitOfficial'
      },
      {
        text: '谈心谈话（免费）',
        cost: 0,
        effects: { merit: 1 },
        msg: '你与干部促膝长谈，但效果一般',
        customAction: 'recruitOfficialLow'
      },
      { text: '暂时不拉拢', cost: 0, effects: {}, msg: '你决定再观察观察' },
    ]
  },
  // v2.4.1: 班子谈话 — 提升班子团结度
  {
    id: 'committeeTalk',
    title: '班子谈心',
    desc: (s) => {
      if (!s.committee) return '常务委员会尚未组建。';
      const unity = s.committeeUnity || 50;
      const unityStr = unity >= 75 ? '团结融洽' : unity >= 50 ? '基本团结' : unity >= 30 ? '存在分歧' : '矛盾突出';
      return `当前班子团结程度为"${unityStr}"。可以找班子成员谈心谈话，加强沟通交流，凝聚共识。`;
    },
    condition: (s) => s.committee && s.cityLevelId >= 1,
    options: [
      {
        text: '与班子成员逐一谈心',
        cost: 0,
        effects: { merit: 1 },
        msg: '你与班子成员逐一开展谈心谈话，增进了相互理解',
        customAction: 'committeeTalkAll'
      },
      {
        text: '请班子成员喝茶（¥10万）',
        cost: 10,
        effects: { corruption: 1, inspectionRisk: 2 },
        msg: '茶桌上推心置腹，班子氛围明显改善',
        requirePrivate: 10,
        customAction: 'committeeTalkBanquet'
      },
      { text: '暂不安排', cost: 0, effects: {}, msg: '你决定暂时不安排谈话' },
    ]
  },
  // v2.4.1: 民主生活会 — 大幅提升班子团结度
  {
    id: 'democraticLifeMeeting',
    title: '民主生活会',
    desc: (s) => {
      if (!s.committee) return '常务委员会尚未组建。';
      return `召开班子民主生活会，开展批评与自我批评，查找问题、增进团结。民主生活会是党内政治生活的重要载体，有助于凝聚班子共识、提升团结程度。`;
    },
    condition: (s) => s.committee && s.cityLevelId >= 1,
    options: [
      {
        text: '认真开展批评与自我批评',
        cost: 0,
        effects: { merit: 2 },
        msg: '民主生活会气氛热烈，班子成员坦诚相见',
        customAction: 'democraticLifeMeeting'
      },
      {
        text: '走过场应付了事',
        cost: 0,
        effects: { reputation: -3 },
        msg: '民主生活会流于形式，班子对此颇有微词',
        customAction: 'democraticLifeMeetingLow'
      },
      { text: '暂不召开', cost: 0, effects: {}, msg: '你决定暂时不召开民主生活会' },
    ]
  },
  // v2.2.4b: 秘书汇报工作
  {
    id: 'secretaryReport',
    title: '秘书汇报',
    desc: (s) => {
      if (!s.personnel || !s.personnel.secretary) return '你还没有任命秘书。可在个人事务中任命。';
      const sec = s.personnel.officials.find(o => o.id === s.personnel.secretary);
      if (!sec) return '秘书已离任。';
      return `秘书${sec.name}前来汇报工作。${sec.recruited ? '作为你的嫡系，' : ''}他已跟随你${sec.tenureMonths || 0}个月，能力与忠诚随任职时间提升。`;
    },
    options: [
      {
        text: '嘉勉鼓励',
        cost: 0,
        effects: { merit: 2, happiness: 1 },
        msg: '秘书受到鼓舞，工作更加卖力',
        customAction: 'secretaryEncourage'
      },
      {
        text: '安排私人任务（¥10万）',
        cost: 10,
        effects: { privateAccount: 15, corruption: 3, inspectionRisk: 4 },
        msg: '秘书帮你处理了一些"私事"',
        requirePrivate: 10,
        customAction: 'secretaryPrivateTask'
      },
      { text: '让他去忙', cost: 0, effects: {}, msg: '秘书退下了' },
    ]
  },
];

// 获取个人事件冷却状态（剩余月数）
function getPersonalEventCooldown(eid) {
  if (!gameState.personalEventCooldowns) gameState.personalEventCooldowns = {};
  return gameState.personalEventCooldowns[eid] || 0;
}

// 设置个人事件冷却
function setPersonalEventCooldown(eid, months) {
  if (!gameState.personalEventCooldowns) gameState.personalEventCooldowns = {};
  gameState.personalEventCooldowns[eid] = months;
}

// 渲染个人事件子选项卡
function renderPersonalEventsSubTab() {
  let html = '<p style="font-size:13px;color:var(--text-2);margin-bottom:12px;">个人事务需要主动选择执行，每个事件有独立冷却时间。选择需权衡利弊，影响仕途、贪腐、声望等。</p>';
  html += '<div style="margin-top:8px;">';

  const enabledSet = new Set(gameState.enabledMods || []);
  for (const event of PERSONAL_EVENTS) {
    if (event._modId && !enabledSet.has(event._modId)) continue;
    const cooldown = getPersonalEventCooldown(event.id);
    const desc = typeof event.desc === 'function' ? event.desc(gameState) : event.desc;
    const onCooldown = cooldown > 0;

    html += `<div style="border:1px solid var(--separator);border-radius:8px;padding:10px;margin-bottom:8px;background:${onCooldown ? 'var(--separator-light)' : 'var(--bg-card)'};">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">`;
    html += `<span style="font-size:14px;font-weight:600;color:var(--text);">${event.title}</span>`;
    if (onCooldown) {
      html += `<span style="font-size:11px;color:var(--text-3);background:var(--separator);padding:2px 8px;border-radius:10px;">冷却中 (${cooldown}月)</span>`;
    } else {
      html += `<span style="font-size:11px;color:var(--green);background:var(--green-light);padding:2px 8px;border-radius:10px;">可执行</span>`;
    }
    html += `</div>`;
    html += `<div style="font-size:12px;color:var(--text-2);line-height:1.6;margin-bottom:6px;">${desc}</div>`;

    if (!onCooldown) {
      for (const opt of event.options) {
        const canAfford = !opt.requirePrivate || (gameState.privateAccount || 0) >= opt.requirePrivate;
        const costStr = opt.cost > 0 ? ` <span style="color:var(--red);">(-¥${opt.cost}万)</span>` : '';
        const effectsStr = formatPersonalEventEffects(opt.effects);
        html += `<button onclick="resolvePersonalEvent('${event.id}', ${event.options.indexOf(opt)})" style="width:100%;text-align:left;padding:8px 10px;margin-bottom:4px;border-radius:6px;border:1px solid var(--separator);background:var(--bg);font-size:12px;cursor:pointer;${canAfford ? '' : 'opacity:0.4;'}" ${canAfford ? '' : 'disabled'}>`;
        html += `<div style="font-weight:500;">${opt.text}${costStr}</div>`;
        if (effectsStr) html += `<div style="font-size:10px;color:var(--text-3);margin-top:2px;">${effectsStr}</div>`;
        html += `</button>`;
      }
    }
    html += `</div>`;
  }

  // 事件记录
  if (gameState.personalEvents && gameState.personalEvents.length > 0) {
    html += '<div class="effect-list" style="margin-top:8px;">';
    html += '<div class="effect-item" style="font-weight:600;color:var(--text);margin-bottom:4px;">个人事件记录</div>';
    for (const pe of gameState.personalEvents.slice(-10).reverse()) {
      const monthStr = `${pe.year}.${String(pe.month).padStart(2, '0')}`;
      html += `<div class="effect-item" style="font-size:12px;"><span class="eff-label" style="color:var(--text-2);">${monthStr} ${pe.option}</span></div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// v2.2.7: 个人事件去除具体数字增益显示
function formatPersonalEventEffects(e) {
  return '';
}

function resolvePersonalEvent(eventId, optionIdx) {
  const event = PERSONAL_EVENTS.find(e => e.id === eventId);
  if (!event) return;
  const opt = event.options[optionIdx];
  if (!opt) return;
  // Check cooldown
  if (getPersonalEventCooldown(eventId) > 0) {
    showNotification('该事件冷却中', 'warn');
    return;
  }
  // Check cost
  if (opt.cost > 0 && (gameState.privateAccount || 0) < opt.cost) {
    showNotification('私人账户余额不足', 'warn');
    return;
  }
  // Apply cost
  if (opt.cost > 0) {
    gameState.privateAccount -= opt.cost;
    // Track donations for achievements
    if (eventId === 'charityDonation') {
      gameState.achievementStats.totalDonated = (gameState.achievementStats.totalDonated || 0) + opt.cost;
    }
  }
  // Apply effects
  const e = opt.effects;
  if (e.privateAccount) gameState.privateAccount = Math.max(0, gameState.privateAccount + e.privateAccount);
  if (e.corruption) gameState.corruption = clamp((gameState.corruption || 0) + e.corruption, 0, 100);
  if (e.inspectionRisk) gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + e.inspectionRisk, 0, 100);
  if (e.merit) gameState.merit = (gameState.merit || 0) + e.merit;
  if (e.reputation) gameState.reputation = clamp((gameState.reputation || 0) + e.reputation, 0, 100);
  if (e.happiness) gameState.happiness = clamp((gameState.happiness || 50) + e.happiness, 0, 100);
  // Set cooldown: 4-8 months
  setPersonalEventCooldown(eventId, 4 + Math.floor(Math.random() * 5));
  // v2.2.4b: 执行自定义动作（拉拢干部、秘书汇报等）
  if (opt.customAction) {
    handlePersonalEventCustomAction(opt.customAction, eventId, opt);
  }
  // Log
  gameState.personalEvents.push({ id: eventId, option: opt.text, turn: gameState.turn, month: gameState.month, year: gameState.year, msg: opt.msg });
  while (gameState.personalEvents.length > 50) gameState.personalEvents.shift();
  logEvent(`【个人事件】${event.title}：${opt.msg}`, e.corruption > 0 ? 'corruption' : 'info');
  showNotification(opt.msg, e.corruption > 0 ? 'warn' : 'success');
  updateUI();
  // Re-render the events tab to update cooldown display
  if (currentTab === 'events') renderSheet('events');
}

// v2.2.4b: 处理个人事件的自定义动作
function handlePersonalEventCustomAction(action, eventId, opt) {
  if (action === 'recruitOfficial') {
    // 设宴拉拢：高成功率
    _tryRecruitOfficial(0.8, true);
  } else if (action === 'recruitOfficialLow') {
    // 谈心谈话：低成功率
    _tryRecruitOfficial(0.35, false);
  } else if (action === 'secretaryEncourage') {
    // 秘书鼓励：提升秘书忠诚
    if (gameState.personnel && gameState.personnel.secretary) {
      const sec = gameState.personnel.officials.find(o => o.id === gameState.personnel.secretary);
      if (sec) {
        sec.loyalty = Math.min(10, (sec.loyalty || 3) + 1);
        logEvent(`秘书${sec.name}受到嘉勉，忠诚度提升`, 'info');
      }
    }
  } else if (action === 'secretaryPrivateTask') {
    // 秘书私人任务：秘书获得额外经验
    if (gameState.personnel && gameState.personnel.secretary) {
      const sec = gameState.personnel.officials.find(o => o.id === gameState.personnel.secretary);
      if (sec) {
        sec.tenureMonths = (sec.tenureMonths || 0) + 3; // 额外3个月经验
        logEvent(`秘书${sec.name}处理私人事务，获得额外经验`, 'info');
      }
    }
  } else if (action === 'committeeTalkAll') {
    // v2.4.1: 与班子成员逐一谈心
    if (gameState.committee) {
      gameState.committeeUnity = clamp((gameState.committeeUnity || 50) + 5, 0, 100);
      for (const m of gameState.committee) {
        if (!m.isPlayer) m.loyalty = Math.min(10, (m.loyalty || 5) + 1);
      }
      logEvent('与班子成员逐一谈心，班子团结度提升', 'success');
      showNotification('班子谈心谈话完成，团结程度有所提升', 'success');
    }
  } else if (action === 'committeeTalkBanquet') {
    // v2.4.1: 请班子成员喝茶
    if (gameState.committee) {
      gameState.committeeUnity = clamp((gameState.committeeUnity || 50) + 10, 0, 100);
      for (const m of gameState.committee) {
        if (!m.isPlayer) m.loyalty = Math.min(10, (m.loyalty || 5) + 1);
      }
      logEvent('请班子成员喝茶，班子团结度显著提升', 'success');
      showNotification('班子茶叙效果良好，团结程度显著提升', 'success');
    }
  } else if (action === 'democraticLifeMeeting') {
    // v2.4.1: 认真开展民主生活会
    if (gameState.committee) {
      gameState.committeeUnity = clamp((gameState.committeeUnity || 50) + 15, 0, 100);
      for (const m of gameState.committee) {
        if (!m.isPlayer) m.loyalty = Math.min(10, (m.loyalty || 5) + 1);
      }
      logEvent('民主生活会认真开展，班子团结度大幅提升', 'success');
      showNotification('民主生活会效果显著，班子团结程度大幅提升', 'success');
      // v2.4.1a: 成就统计
      if (gameState.achievementStats) gameState.achievementStats.democraticMeetings = (gameState.achievementStats.democraticMeetings || 0) + 1;
    }
  } else if (action === 'democraticLifeMeetingLow') {
    // v2.4.1: 走过场民主生活会
    if (gameState.committee) {
      gameState.committeeUnity = clamp((gameState.committeeUnity || 50) - 5, 0, 100);
      for (const m of gameState.committee) {
        if (!m.isPlayer) m.loyalty = Math.max(1, (m.loyalty || 5) - 1);
      }
      logEvent('民主生活会流于形式，班子对此颇有微词，团结度下降', 'warn');
    }
  }
}

// v2.2.4b: 尝试拉拢无派系干部到玩家派系
function _tryRecruitOfficial(successRate, isBanquet) {
  if (!gameState.personnel || !gameState.playerFaction) return;
  const factionless = gameState.personnel.officials.filter(o => !o.faction && !Object.values(gameState.personnel.appointments).includes(o.id));
  if (factionless.length === 0) {
    showNotification('储备池中没有无派系干部可供拉拢', 'warn');
    return;
  }
  // 随机选一个干部
  const target = factionless[Math.floor(Math.random() * factionless.length)];
  if (Math.random() < successRate) {
    // 成功拉拢
    target.faction = gameState.playerFaction;
    target.recruited = true;
    target.loyalty = Math.min(10, (target.loyalty || 3) + 2);
    const pfName = FACTIONS[gameState.playerFaction].name;
    logEvent(`成功拉拢${target.name}加入${pfName}，成为嫡系下属`, 'success');
    showNotification(`${isBanquet ? '设宴拉拢成功' : '谈心拉拢成功'}：${target.name}已加入你的派系`, 'success');
    // 如果有秘书空缺且该干部适合，提示可以任命为秘书
    if (!gameState.personnel.secretary) {
      showNotification(`${target.name}可以任命为秘书，获得额外能力加成`, 'info');
    }
  } else {
    // 失败
    logEvent(`拉拢${target.name}未成功，干部保持中立`, 'warn');
    showNotification(`拉拢${target.name}未成功${isBanquet ? '' : '，谈心效果有限'}`, 'warn');
  }
}

