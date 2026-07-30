/* 源自《置身事内》单文件版 - 事件系统 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 事件系统 ==============
// v2.2.7: 判断事件是否可用打手处理（仅限群体性/社会矛盾类事件）
const _THUG_COMPATIBLE_TAGS = ['群众上访', '群体事件', '社会矛盾', '舆情事件', '民生问题', '治安事件'];
function _eventCanUseThugs(ev) {
  if (!ev || !ev.tag) return false;
  return _THUG_COMPATIBLE_TAGS.includes(ev.tag);
}

function checkEvents() {
  // Filter out events on cooldown (recently resolved)
  if (!gameState.eventCooldowns) gameState.eventCooldowns = {};
  if (!Array.isArray(EVENT_POOL)) return;
  // v2.2.3: 过滤未启用模组的事件
  const enabledSet = new Set(gameState.enabledMods || []);
  const eligible = EVENT_POOL.filter(ev => {
    if (ev._modId && !enabledSet.has(ev._modId)) return false;
    return ev.condition(gameState) && !gameState.eventCooldowns[ev.id];
  });
  if (eligible.length === 0) return;
  const totalWeight = eligible.reduce((s, ev) => {
    const w = typeof ev.weight === 'function' ? ev.weight(gameState) : ev.weight;
    return s + w;
  }, 0);
  let r = Math.random() * totalWeight;
  for (const ev of eligible) {
    const w = typeof ev.weight === 'function' ? ev.weight(gameState) : ev.weight;
    r -= w; if (r <= 0) { triggerEvent(ev); return; }
  }
}

function triggerEvent(event) {
  // Pre-process: run event-level customAction to set up context (e.g. pick official)
  if (typeof event.customAction === 'function') event.customAction();
  // Add to pending events with deadline
  const pending = {
    id: event.id,
    title: event.title,
    tag: event.tag,
    type: event.type,
    desc: typeof event.desc === 'function' ? event.desc(gameState) : event.desc,
    choices: event.choices,
    postEffect: event.postEffect,
    deadline: gameState.turn + 3, // 3 months to resolve
    issuedTurn: gameState.turn,
    issuedDate: `${gameState.year}.${String(gameState.month).padStart(2,'0')}`,
  };
  if (!Array.isArray(gameState.pendingEvents)) gameState.pendingEvents = [];
  gameState.pendingEvents.push(pending);
  gameState.pendingEvent = pending; // Keep backward compat for modal display
  // v2.4.4: 模组钩子 — 事件触发
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('event:trigger', { event: pending });
  updateEventBadge();
  // Show modal immediately
  showEventModal(pending);
}

function showEventModal(pending) {
  let body = `<p>${pending.desc}</p><div class="effect-list">`;
  body += `<div class="effect-item"><span class="eff-label">${ICON.wallet}当前财政</span><span class="eff-val ${gameState.treasury > 0 ? 'pos' : 'neg'}">¥${formatMoney(gameState.treasury * 10000)}</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">${ICON.alert}腐败指数</span><span class="eff-val ${gameState.corruption > 30 ? 'neg' : 'pos'}">${gameState.corruption.toFixed(0)}</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">${ICON.clock}限期处理</span><span class="eff-val ${pending.deadline - gameState.turn <= 1 ? 'neg' : 'pos'}">剩余 ${pending.deadline - gameState.turn} 个月</span></div>`;
  body += `</div>`;
  const validChoices = pending.choices.filter(c => !c.condition || c.condition(gameState));
  const buttons = validChoices.map((choice) => {
    const origIdx = pending.choices.indexOf(choice);
    return { text: choice.text, color: choice.color || 'blue', action: () => resolveEvent(pending.id, origIdx) };
  });
  buttons.push({ text: '稍后处理', color: 'gray', action: () => { closeModal(); showNotification('事件已暂存，可在"事件"页面处理', 'info'); } });
  showModal(pending.title, body, buttons, pending.tag, pending.type);
}

function resolveEvent(eventId, choiceIndex) {
  const pending = gameState.pendingEvents.find(e => e.id === eventId);
  if (!pending) { closeModal(); return; }
  if (!pending.choices[choiceIndex]) { closeModal(); return; }
  const choice = pending.choices[choiceIndex];
  const beforePop = gameState.population;
  const beforeTreasury = gameState.treasury;
  applyEffects(choice.effects || {});
  // Execute custom action if present (e.g. clearing construction debt)
  if (choice.customAction) {
    choice.customAction(gameState);
  }
  // Track "赔了夫人又折兵" achievement
  if (gameState.treasury - beforeTreasury < -2000 && gameState.population - beforePop < -500) {
    gameState.achievementStats.lostWifeTriggered = true;
  }
  gameState.achievementStats.eventsResolved++;
  // Track petition resolution (fix: use pending.tag, not pending.event.tag)
  if (pending.tag === '群众上访' && choice.color === 'green') {
    gameState.achievementStats.petitionsResolved = (gameState.achievementStats.petitionsResolved || 0) + 1;
  }
  // Set event cooldown: 8-16 months before this event can trigger again
  if (!gameState.eventCooldowns) gameState.eventCooldowns = {};
  gameState.eventCooldowns[eventId] = 8 + Math.floor(Math.random() * 9);
  closeModal();
  // Remove from pending
  gameState.pendingEvents = gameState.pendingEvents.filter(e => e.id !== eventId);
  gameState.pendingEvent = null;
  if (pending.postEffect) {
    const result = pending.postEffect(gameState, choiceIndex);
    if (result) {
      if (result.effects) applyEffects(result.effects);
      if (result.gameOver) {
        // 东窗事发 — show red-letter before game over
        if (result.type === 'corruption_caught') {
          setTimeout(() => showInspectionRedLetter(() => {
            showGameOver(result.type, result.title, result.msg);
          }), 300);
        } else {
          setTimeout(() => showGameOver(result.type, result.title, result.msg), 300);
        }
        return;
      }
      if (result.title) {
        // 警告处分 — show warning red-letter
        if (result.title.includes('警告')) {
          setTimeout(() => showWarningRedLetter(() => {
            updateUI();
          }), 300);
        } else {
          setTimeout(() => showModal(result.title, `<p>${result.msg}</p>`, [{ text: '知道了', color: 'blue', action: closeModal }], '后续', 'info'), 300);
        }
      }
    }
  }
  logEvent(`${pending.title}：${choice.text}`, pending.type);
  // 归档已处理事件
  _resolvedEvents.push({
    title: pending.title, choice: choice.text,
    date: `${gameState.year}.${String(gameState.month).padStart(2,'0')}`,
    type: pending.type
  });
  if (_resolvedEvents.length > 50) _resolvedEvents.shift();
  // v2.4.4: 模组钩子 — 事件解决后
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('event:resolved', { event: pending, choiceIndex, choice });
  updateEventBadge();
  updateUI();
}

function autoResolveExpiredEvent(pending) {
  // Auto-resolve with the last choice (usually the worst/passive option)
  const lastChoice = pending.choices[pending.choices.length - 1];
  const lastIdx = pending.choices.length - 1;
  applyEffects(lastChoice.effects || {});
  gameState.pendingEvents = gameState.pendingEvents.filter(e => e.id !== pending.id);
  // Set event cooldown for auto-resolved events too
  if (!gameState.eventCooldowns) gameState.eventCooldowns = {};
  gameState.eventCooldowns[pending.id] = 8 + Math.floor(Math.random() * 9);
  if (pending.postEffect) {
    const result = pending.postEffect(gameState, lastIdx);
    if (result) {
      if (result.effects) applyEffects(result.effects);
      if (result.gameOver) { setTimeout(() => showGameOver(result.type, result.title, result.msg), 300); return; }
    }
  }
  logEvent(`${pending.title}：逾期未处理，自动执行"${lastChoice.text}"`, 'warn');
  showNotification(`事件"${pending.title}"已逾期自动处理`, 'warn');
  updateEventBadge();
}

function updateEventBadge() {
  const badge = document.getElementById('event-badge');
  if (!badge) return;
  const count = gameState.pendingEvents.length;
  if (count > 0) {
    badge.style.display = 'flex';
    badge.textContent = count;
  } else {
    badge.style.display = 'none';
  }
}

// 已处理事件归档（不持久化，仅在当前会话有效）
let _resolvedEvents = [];

function renderEventsTab() {
  let html = '';

  // ===== 分类一：突发事件（城市事件 + 限时事件） =====
  html += `<div class="stats-section"><h3>${ICON.bell}突发事件</h3>`;
  const events = gameState.pendingEvents;
  if (events.length === 0) {
    html += `<div style="text-align:center;padding:20px;color:var(--text-3);font-size:12px;">暂无待办突发事件</div>`;
  } else {
    for (const ev of events) {
      const remaining = ev.deadline - gameState.turn;
      const urgent = remaining <= 1;
      const typeColors = { danger: ['var(--red-light)', 'var(--red)'], warn: ['var(--orange-light)', 'var(--orange)'], success: ['var(--green-light)', 'var(--green)'], corruption: ['var(--purple-light)', 'var(--purple)'], info: ['var(--accent-light)', 'var(--accent)'] };
      const [bg, fg] = typeColors[ev.type] || typeColors.info;
      html += `<div style="background:${bg};border-radius:10px;padding:10px;margin-bottom:8px;border-left:3px solid ${fg};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
          <div><span style="font-size:10px;color:${fg};font-weight:600;background:rgba(255,255,255,0.6);padding:1px 6px;border-radius:4px;">${ev.tag}</span>
          <span style="font-size:13px;font-weight:700;margin-left:4px;">${ev.title}</span></div>
          <span style="font-size:11px;font-weight:600;color:${urgent ? 'var(--red)' : 'var(--text-3)'};">${urgent ? '紧急' : '限期'} ${remaining}月</span>
        </div>
        <p style="font-size:12px;color:var(--text-2);line-height:1.5;margin-bottom:8px;">${ev.desc}</p>`;
      const validChoices = ev.choices.filter(c => !c.condition || c.condition(gameState));
      for (const choice of validChoices) {
        const origIdx = ev.choices.indexOf(choice);
        const btnColors = { green: 'var(--green)', blue: 'var(--accent)', yellow: 'var(--orange)', orange: 'var(--orange)', red: 'var(--red)', gray: 'var(--text-3)' };
        const btnColor = btnColors[choice.color] || 'var(--accent)';
        html += `<button onclick="resolveEvent('${ev.id}', ${origIdx})" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid ${btnColor};background:transparent;color:${btnColor};font-size:12px;font-weight:500;margin-bottom:4px;cursor:pointer;">${choice.text}</button>`;
      }
      if (gameState.underworld && gameState.underworld.thugs >= 2 && _eventCanUseThugs(ev)) {
        html += `<button onclick="useThugsOnEvent('${ev.id}')" style="width:100%;padding:8px 12px;border-radius:6px;border:1px solid #8B4513;background:rgba(139,69,19,0.1);color:#8B4513;font-size:12px;font-weight:500;margin-bottom:4px;cursor:pointer;">${ICON.fist}派打手摆平（消耗2名打手）</button>`;
      }
      html += `</div>`;
    }
  }
  html += '</div>';

  // ===== 分类二：个人事件（原 PERSONAL_EVENTS） =====
  html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.user}个人事件</h3>`;
  html += '<p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">个人事务需要主动选择执行，每个事件有独立冷却时间。</p>';
  const enabledSet2 = new Set(gameState.enabledMods || []);
  for (const event of (Array.isArray(PERSONAL_EVENTS) ? PERSONAL_EVENTS : [])) {
    if (event._modId && !enabledSet2.has(event._modId)) continue;
    const cooldown = getPersonalEventCooldown(event.id);
    const desc = typeof event.desc === 'function' ? event.desc(gameState) : event.desc;
    const onCooldown = cooldown > 0;
    html += `<div style="border:1px solid var(--separator);border-radius:8px;padding:8px;margin-bottom:6px;background:${onCooldown ? 'var(--separator-light)' : 'var(--bg-card)'};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
        <span style="font-size:13px;font-weight:600;color:var(--text);">${event.title}</span>`;
    if (onCooldown) {
      html += `<span style="font-size:10px;color:var(--text-3);background:var(--separator);padding:1px 6px;border-radius:8px;">冷却中 (${cooldown}月)</span>`;
    } else {
      html += `<span style="font-size:10px;color:var(--green);background:var(--green-light);padding:1px 6px;border-radius:8px;">可执行</span>`;
    }
    html += `</div><div style="font-size:11px;color:var(--text-2);line-height:1.5;margin-bottom:4px;">${desc}</div>`;
    if (!onCooldown) {
      for (const opt of event.options) {
        const canAfford = !opt.requirePrivate || (gameState.privateAccount || 0) >= opt.requirePrivate;
        const costStr = opt.cost > 0 ? ` <span style="color:var(--red);">(-¥${opt.cost}万)</span>` : '';
        const effectsStr = formatPersonalEventEffects(opt.effects);
        html += `<button onclick="resolvePersonalEvent('${event.id}', ${event.options.indexOf(opt)})" style="width:100%;text-align:left;padding:6px 8px;margin-bottom:3px;border-radius:6px;border:1px solid var(--separator);background:var(--bg);font-size:11px;cursor:pointer;${canAfford ? '' : 'opacity:0.4;'}" ${canAfford ? '' : 'disabled'}>
          <div style="font-weight:500;">${opt.text}${costStr}</div>
          ${effectsStr ? `<div style="font-size:10px;color:var(--text-3);margin-top:1px;">${effectsStr}</div>` : ''}
        </button>`;
      }
    }
    html += '</div>';
  }
  // 个人事件记录
  if (gameState.personalEvents && gameState.personalEvents.length > 0) {
    html += '<div style="margin-top:6px;font-size:11px;color:var(--text-3);">';
    html += '<div style="font-weight:600;margin-bottom:2px;">个人事件记录</div>';
    for (const pe of gameState.personalEvents.slice(-5).reverse()) {
      const monthStr = `${pe.year}.${String(pe.month).padStart(2, '0')}`;
      html += `<div style="padding:2px 0;">${monthStr} ${pe.option}</div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  // ===== 分类三：已归档事件（最近处理的历史） =====
  if (_resolvedEvents.length > 0) {
    html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.archive}已归档事件</h3>`;
    for (const re of _resolvedEvents.slice(-10).reverse()) {
      html += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px;border-bottom:0.5px solid var(--separator-light);">
        <span style="color:var(--text-2);">${re.title}</span>
        <span style="color:var(--text-3);">${re.date} ${re.choice}</span>
      </div>`;
    }
    html += '</div>';
  }

  return html;
}

function applyEffects(effects) {
  if (!effects) return;
  if (effects.treasury) gameState.treasury += effects.treasury;
  if (effects.privateAccount) {
    gameState.privateAccount += effects.privateAccount;
    gameState.privateTotalGained = (gameState.privateTotalGained || 0) + effects.privateAccount;
  }
  if (effects.corruption) gameState.corruption = clamp(gameState.corruption + effects.corruption, 0, 100);
  if (effects.reputation) gameState.reputation = clamp(gameState.reputation + effects.reputation, 0, 100);
  if (effects.happiness) gameState.happiness = clamp(gameState.happiness + effects.happiness, 0, 100);
  if (effects.population) gameState.population = Math.max(0, gameState.population + effects.population);
  // v2.3.0: 兼容 inspection 与 inspectionRisk 两种字段名
  const inspDelta = effects.inspection || effects.inspectionRisk || 0;
  if (inspDelta) gameState.inspectionRisk = clamp(gameState.inspectionRisk + inspDelta, 0, 100);
  if (effects.gdpMult) gameState.gdpMult *= effects.gdpMult;
  // v2.3.0: 兼容 education 与 educationIndex 两种字段名
  const eduDelta = effects.educationIndex !== undefined ? effects.educationIndex : (effects.education || 0);
  if (eduDelta) gameState.educationIndex = clamp(gameState.educationIndex + eduDelta, 0, 100);
  if (effects.healthcare) gameState.healthcareIndex = clamp(gameState.healthcareIndex + effects.healthcare, 0, 100);
  if (effects.unemployment) gameState.unemployment = clamp(gameState.unemployment + effects.unemployment, 0, 0.5);
  if (effects.merit) gameState.merit += effects.merit;
}

