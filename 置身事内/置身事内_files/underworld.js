/* 源自《置身事内》单文件版 - 黑社会系统 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 黑社会系统 ==============
function recruitThugs(count) {
  const cost = count * 4;
  if (gameState.treasury < cost) { showNotification('财政资金不足', 'danger'); return; }
  showModal('招募打手', `<p>招募${count}名打手，一次性费用¥${formatMoney(cost * 10000)}。</p>
    <p>每名打手月维护费¥${formatMoney(10000)}。打手可用于处理群众事件，并对群众事件有威慑作用（降低触发概率），但会增加犯罪率和腐败指数。</p>`, [
    { text: '确认招募', color: 'brown', action: () => {
      closeModal();
      gameState.treasury -= cost;
      gameState.underworld.thugs += count;
      gameState.underworld.thugMonthlyCost = gameState.underworld.thugs * 1; // 1万/人/月
      gameState.underworld.crimeRate = Math.min(100, gameState.underworld.crimeRate + count * 0.3);
      applyEffects({ corruption: count * 0.3, inspectionRisk: count * 0.2, happiness: -count * 0.1 });
      logEvent(`招募${count}名打手（-¥${formatMoney(cost * 10000)}），现有打手${gameState.underworld.thugs}人`, 'warn');
      showNotification(`招募${count}名打手成功`, 'success');
      updateUI();
    }},
    { text: '取消', color: 'gray', action: closeModal },
  ], '黑社会', 'warn');
}

function dismissThugs() {
  if (gameState.underworld.thugs === 0) return;
  const count = gameState.underworld.thugs;
  showModal('遣散打手', `<p>遣散全部${count}名打手？</p>
    <p style="color:var(--orange);font-size:12px;">遣散后可能发生打手报复事件，导致治安短暂恶化。</p>`, [
    { text: '确认遣散', color: 'gray', action: () => {
      closeModal();
      gameState.underworld.thugs = 0;
      gameState.underworld.thugMonthlyCost = 0;
      // 30% chance of retaliation
      if (Math.random() < 0.3) {
        gameState.underworld.crimeRate = Math.min(100, gameState.underworld.crimeRate + 15);
        applyEffects({ happiness: -5, corruption: 3 });
        logEvent(`遣散打手后发生报复事件，犯罪率激增`, 'danger');
        showNotification('打手报复！犯罪率上升15点', 'danger');
      } else {
        gameState.underworld.crimeRate = Math.max(0, gameState.underworld.crimeRate - 5);
        logEvent(`遣散${count}名打手`, 'info');
        showNotification('打手已遣散', 'info');
      }
      updateUI();
    }},
    { text: '取消', color: 'gray', action: closeModal },
  ], '黑社会', 'info');
}

function crackdownOnCrime() {
  const cost = 30;
  if (gameState.treasury < cost) { showNotification('财政资金不足', 'danger'); return; }
  showModal('扫黑除恶', `<p>开展扫黑除恶专项行动，费用¥${formatMoney(cost * 10000)}。</p>
    <p>效果：犯罪率降低20-30点，声望+5-10，但如果有打手会被一并清除。</p>`, [
    { text: '执行扫黑', color: 'blue', action: () => {
      closeModal();
      gameState.treasury -= cost;
      const hadThugs = gameState.underworld.thugs;
      gameState.underworld.thugs = 0;
      gameState.underworld.thugMonthlyCost = 0;
      gameState.underworld.crackdownLevel = Math.min(100, gameState.underworld.crackdownLevel + 30);
      gameState.underworld.crimeRate = Math.max(0, gameState.underworld.crimeRate - 25 - Math.random() * 5);
      gameState.underworld.crackdownsDone++;
      applyEffects({ reputation: hadThugs > 0 ? 10 : 5, happiness: 3, corruption: -5, inspectionRisk: -3 });
      logEvent(`扫黑除恶行动完成（-¥${formatMoney(cost * 10000)}）${hadThugs > 0 ? '，清除打手' + hadThugs + '人' : ''}`, 'success');
      showNotification(`扫黑除恶完成，犯罪率降至${gameState.underworld.crimeRate.toFixed(0)}`, 'success');
      updateUI();
    }},
    { text: '取消', color: 'gray', action: closeModal },
  ], '扫黑除恶', 'info');
}

function useThugsOnEvent(eventId) {
  if (gameState.underworld.thugs < 2) {
    showNotification('打手不足（至少需要2名）', 'warn');
    return;
  }
  const event = gameState.pendingEvents.find(e => e.id === eventId);
  if (!event) return;
  showModal('派打手摆平', `<p>派遣打手处理"${event.title}"事件。</p>
    <p>打手会迅速"解决"问题，但会产生以下后果：</p>
    <ul style="font-size:13px;color:var(--orange);padding-left:20px;">
      <li>腐败+3，犯罪率+2</li>
      <li>纪委关注度+5</li>
      <li>声望-2，幸福度-1</li>
      <li>消耗2名打手</li>
    </ul>`, [
    { text: '派打手摆平', color: 'brown', action: () => {
      closeModal();
      gameState.underworld.thugs -= 2;
      // v2.3.0: 重新计算月维护费（原代码漏掉此步，导致月费虚高）
      gameState.underworld.thugMonthlyCost = gameState.underworld.thugs * 1;
      gameState.underworld.thugActionsUsed++;
      gameState.underworld.crimeRate = Math.min(100, gameState.underworld.crimeRate + 2);
      applyEffects({ corruption: 3, inspectionRisk: 5, reputation: -2, happiness: -1 });
      // v2.3.0: 设置事件冷却（原代码漏掉此步，导致摆平后立即重复触发）
      if (!gameState.eventCooldowns) gameState.eventCooldowns = {};
      gameState.eventCooldowns[eventId] = 8 + Math.floor(Math.random() * 9);
      // Remove event
      gameState.pendingEvents = gameState.pendingEvents.filter(e => e.id !== eventId);
      logEvent(`派打手摆平了"${event.title}"事件`, 'warn');
      showNotification('事件已用打手"处理"', 'warn');
      renderEventsTab();
      updateUI();
    }},
    { text: '取消', color: 'gray', action: closeModal },
  ], '黑社会', 'warn');
}
const STOCK_LIST = [
  { id: 'tech', name: '科技龙头股', basePrice: 50, volatility: 0.05, beta: 1.3 },
  { id: 'estate', name: '地产蓝筹股', basePrice: 30, volatility: 0.035, beta: 0.9 },
  { id: 'energy', name: '能源板块股', basePrice: 20, volatility: 0.04, beta: 1.1 },
  { id: 'finance', name: '金融龙头股', basePrice: 40, volatility: 0.03, beta: 1.0 },
  { id: 'consumer', name: '消费白马股', basePrice: 35, volatility: 0.025, beta: 0.8 },
];
const LAND_OPTIONS = [
  { id: 'cbd', name: 'CBD核心地段', cost: 5000, appreciation: 0.003, desc: '市中心黄金地段，保值增值缓慢' },
  { id: 'new', name: '新城开发区地块', cost: 2000, appreciation: 0.004, desc: '新兴区域地块，增值有限' },
  { id: 'suburb', name: '近郊住宅用地', cost: 800, appreciation: 0.002, desc: '城市近郊住宅用地，稳健保值' },
  { id: 'industrial', name: '工业园地块', cost: 1200, appreciation: 0.002, desc: '工业园区地块，回报微薄' },
];
const LAND_HOLD_LIMIT = 5; // 最多持有5块土地，超过引发纪委关注
// v2.4.2: 压低投资项目收益，提高风险（增加暴雷概率和纪委风险）
const PROJECT_OPTIONS = [
  { id: 'bridge', name: '跨江大桥PPP项目', cost: 3000, monthlyReturn: 0.008, months: 24, riskChance: 0.04, desc: '参与政府基建PPP，月回报率0.8%，持续24个月。存在资金链断裂风险' },
  { id: 'mall', name: '商业综合体开发', cost: 1500, monthlyReturn: 0.012, months: 18, riskChance: 0.06, desc: '开发商业综合体，月回报率1.2%，持续18个月。招商风险较高' },
  { id: 'techpark', name: '科技园区参股', cost: 800, monthlyReturn: 0.01, months: 36, riskChance: 0.03, desc: '参股科技园区建设，月回报率1.0%，持续36个月。回报周期长、不确定性大' },
  { id: 'bond', name: '私募债券基金', cost: 500, monthlyReturn: 0.006, months: 12, riskChance: 0.05, desc: '购买私募债券基金，月回报率0.6%，持续12个月。存在违约风险' },
];
const VILLA_OPTIONS = [
  { id: 'v1', name: '近郊独栋别墅', cost: 600, value: 600, desc: '城市近郊独栋别墅，带花园泳池', inspectionRisk: 5 },
  { id: 'v2', name: '湖景豪华别墅', cost: 1500, value: 1500, desc: '湖景豪华别墅，私人码头', inspectionRisk: 10 },
  { id: 'v3', name: '山顶庄园', cost: 3000, value: 3000, desc: '山顶私人庄园，占地数亩', inspectionRisk: 15 },
  { id: 'v4', name: '海景超级别墅', cost: 5000, value: 5000, desc: '一线海景超级别墅，私人沙滩', inspectionRisk: 20 },
];

let _assetDetailCollapsed = false;
function renderPrivateTab() {
  let html = '<p style="font-size:13px;color:var(--text-2);margin-bottom:12px;">私人账户可用于存储资产、投资理财和购置不动产。从财政划拨资金属违法行为，会增加纪委风险。</p>';
  // 账户概览
  html += `<div class="effect-list" style="margin-bottom:8px;">
    <div class="effect-item"><span class="eff-label">${ICON.wallet}账户余额</span><span class="eff-val pos">¥${formatMoney(gameState.privateAccount * 10000)}</span></div>
    <div class="effect-item"><span class="eff-label">${ICON.moneyFly}月工资收入</span><span class="eff-val pos">¥${formatMoney(getCityLevel().salary * 10000)}/月</span></div>
    <div class="effect-item"><span class="eff-label">${ICON.alert}纪委风险</span><span class="eff-val ${gameState.inspectionRisk > 40 ? 'neg' : 'pos'}">${gameState.inspectionRisk.toFixed(0)}/100</span></div>
    <div class="effect-item"><span class="eff-label">${ICON.trendingUp}累计非法所得</span><span class="eff-val neg">¥${formatMoney(gameState.privateTotalGained * 10000)}</span></div>
  </div>`;
  // 资产总览（含个人企业资本）
  const stockValue = gameState.privateAssets.stocks.reduce((s, st) => s + st.shares * st.currentPrice, 0);
  const landValue = gameState.privateAssets.land.reduce((s, l) => s + l.currentValue, 0);
  const projectValue = gameState.privateAssets.projects.reduce((s, p) => s + p.investment, 0);
  const villaValue = gameState.privateAssets.villas.reduce((s, v) => s + v.value, 0);
  const companyValue = (gameState.personalCompanies || []).reduce((s, pc) => s + pc.capital, 0);
  const totalAssets = gameState.privateAccount + stockValue + landValue + projectValue + villaValue + companyValue;

  // 功能按钮
  const privateActions = [
    { id: 'transfer', name: '财政划拨', desc: '将财政资金转入私人账户（违法）', action: 'showTransferModal()' },
    { id: 'transferBack', name: '转入公账', desc: '将私人账户资金转入财政（合法，可降低纪委风险）', action: 'showTransferBackModal()' },
    { id: 'stock', name: '股票交易', desc: '买卖股票，自负盈亏', action: 'showStockModal()' },
    { id: 'land', name: '购买土地', desc: '购买城市地块，长期增值', action: 'showLandModal()' },
    { id: 'project', name: '投资项目', desc: '投资PPP或商业项目，按月返利', action: 'showProjectModal()' },
    { id: 'villa', name: '购买别墅', desc: '购置豪华不动产', action: 'showVillaModal()' },
  ];
  for (const a of privateActions) {
    html += `<div class="invest-card" onclick="${a.action}" style="cursor:pointer;">
      <div class="iv-title"><span class="iv-title-left">${a.name}</span></div>
      <div class="iv-desc">${a.desc}</div>
    </div>`;
  }
  // v2.3.5b: 收购企业按钮
  html += `<div class="invest-card" onclick="showAcquireCompanyModal()" style="cursor:pointer;">
    <div class="iv-title"><span class="iv-title-left">收购公司</span></div>
    <div class="iv-desc">收购企业进行注资或经营，可获取月利润。但会大幅增加纪委注意度和腐败度。权力关联的收购收益更高但风险更大。</div>
  </div>`;

  // v2.3.5c: 总资产栏合并到资产明细，不折叠，位于最下方
  html += `<div class="effect-list" style="margin-top:12px;border-top:1px solid var(--separator);padding-top:8px;">`;
  html += `<div class="effect-item"><span class="eff-label" style="font-weight:600;">${ICON.star}总资产</span><span class="eff-val pos" style="font-weight:600;">¥${formatMoney(totalAssets * 10000)}</span></div>`;
  html += `<div class="effect-item"><span class="eff-label">${ICON.wallet}现金</span><span class="eff-val">¥${formatMoney(gameState.privateAccount * 10000)}</span></div>`;
  html += `<div class="effect-item"><span class="eff-label">${ICON.users}股票</span><span class="eff-val">¥${formatMoney(stockValue * 10000)}</span></div>`;
  html += `<div class="effect-item"><span class="eff-label">${ICON.building2}土地</span><span class="eff-val">¥${formatMoney(landValue * 10000)}</span></div>`;
  html += `<div class="effect-item"><span class="eff-label">${ICON.trendingUp}投资</span><span class="eff-val">¥${formatMoney(projectValue * 10000)}</span></div>`;
  html += `<div class="effect-item"><span class="eff-label">${ICON.building2}不动产</span><span class="eff-val">¥${formatMoney(villaValue * 10000)}</span></div>`;
  html += `<div class="effect-item"><span class="eff-label"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-2);display:inline-block;vertical-align:middle;"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h6"/></svg> 个人企业</span><span class="eff-val">¥${formatMoney(companyValue * 10000)}</span></div>`;
  html += `</div>`;

  // v2.3.5c: 只折叠具体明细（几个地皮几个公司）
  html += `<div class="policy-group" style="margin-top:8px;">
    <div class="policy-group-header ${_assetDetailCollapsed ? 'open' : ''}" onclick="_assetDetailCollapsed=!_assetDetailCollapsed;renderSheet('personal');">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent);"><path d="M3 3h18v18H3z M3 9h18 M9 21V9"/></svg>
      <span>资产明细</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto;"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
    <div class="policy-group-body ${_assetDetailCollapsed ? 'open' : ''}">`;
  if (gameState.privateAssets.stocks.length > 0) {
    html += '<div class="effect-list" style="margin-top:8px;margin-bottom:8px;">';
    html += '<div class="effect-item" style="font-weight:600;color:var(--text);margin-bottom:4px;">股票持仓</div>';
    for (const st of gameState.privateAssets.stocks) {
      const profit = (st.currentPrice - st.buyPrice) * st.shares;
      html += `<div class="effect-item"><span class="eff-label">${st.name} ×${st.shares}股</span><span class="eff-val">¥${st.currentPrice.toFixed(1)} <span style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};">${profit >= 0 ? '+' : ''}${profit.toFixed(0)}</span> <button style="background:none;border:1px solid var(--red);color:var(--red);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:11px;" onclick="sellStock('${st.id}')">卖出</button></span></div>`;
    }
    html += '</div>';
  }
  if (gameState.privateAssets.land.length > 0) {
    html += '<div class="effect-list" style="margin-bottom:8px;">';
    html += '<div class="effect-item" style="font-weight:600;color:var(--text);margin-bottom:4px;">土地资产</div>';
    for (const l of gameState.privateAssets.land) {
      const profit = l.currentValue - l.cost;
      html += `<div class="effect-item"><span class="eff-label">${l.name}</span><span class="eff-val">¥${formatMoney(l.currentValue * 10000)} <span style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'};">${profit >= 0 ? '+' : ''}${formatMoney(profit * 10000)}</span> <button style="background:none;border:1px solid var(--orange);color:var(--orange);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:11px;" onclick="sellLand(${gameState.privateAssets.land.indexOf(l)})">出售</button></span></div>`;
    }
    html += '</div>';
  }
  if (gameState.privateAssets.projects.length > 0) {
    html += '<div class="effect-list" style="margin-bottom:8px;">';
    html += '<div class="effect-item" style="font-weight:600;color:var(--text);margin-bottom:4px;">投资项目</div>';
    for (const p of gameState.privateAssets.projects) {
      html += `<div class="effect-item"><span class="eff-label">${p.name}</span><span class="eff-val">剩余${p.remainingMonths}月（月收益¥${formatMoney(p.monthlyGain * 10000)}）</span></div>`;
    }
    html += '</div>';
  }
  if (gameState.privateAssets.villas.length > 0) {
    html += '<div class="effect-list" style="margin-bottom:8px;">';
    html += '<div class="effect-item" style="font-weight:600;color:var(--text);margin-bottom:4px;">不动产</div>';
    for (const v of gameState.privateAssets.villas) {
      html += `<div class="effect-item"><span class="eff-label">${v.name}</span><span class="eff-val">¥${formatMoney(v.value * 10000)} <button style="background:none;border:1px solid var(--orange);color:var(--orange);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:11px;" onclick="sellVilla(${gameState.privateAssets.villas.indexOf(v)})">出售</button></span></div>`;
    }
    html += '</div>';
  }
  // v2.3.5c: 个人企业明细 — 显示简称
  if ((gameState.personalCompanies || []).length > 0) {
    html += '<div class="effect-list" style="margin-top:8px;margin-bottom:8px;">';
    html += '<div class="effect-item" style="font-weight:600;color:var(--text);margin-bottom:4px;display:flex;align-items:center;gap:6px;">';
    html += `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-2);"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h6"/></svg>`;
    html += `个人企业</div>`;
    for (const pc of gameState.personalCompanies) {
      html += `<div class="effect-item"><span class="eff-label">${pc.shortName || pc.name} <span style="font-size:10px;color:var(--text-3);">(${pc.status})</span></span>`;
      html += `<span class="eff-val">月利¥${formatMoney(pc.monthlyProfit * 10000)} <button style="background:none;border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:11px;" onclick="injectPersonalCompany('${pc.id}')">注资</button> <button style="background:none;border:1px solid var(--green);color:var(--green);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:11px;" onclick="operatePersonalCompany('${pc.id}')">经营</button> <button style="background:none;border:1px solid var(--orange);color:var(--orange);border-radius:4px;padding:1px 6px;cursor:pointer;font-size:11px;" onclick="transferPersonalCompany('${pc.id}')">转让</button></span></div>`;
    }
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

function showTransferModal() {
  // v2.4.2: 财政划拨额度限制 — 每月最多划拨财政的20%
  const maxMonthlyTransfer = Math.max(1, Math.floor((gameState.treasury || 0) * 0.2));
  const maxTransfer = Math.max(0, Math.min(Math.floor(gameState.treasury), maxMonthlyTransfer));
  // 做假账价格 = 划拨金额的5%
  const fakeCost = Math.ceil(maxTransfer * 0.05);
  showModal('财政划拨', `<p style="font-size:13px;color:var(--text-2);">将财政资金划拨到私人账户。</p>
    <p style="color:var(--red);font-size:12px;margin-top:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg> 这是违法行为！每次划拨都会增加纪委风险，划拨金额越大风险越高。</p>
    <p style="font-size:12px;color:var(--text-3);margin-top:6px;">当前财政：¥${formatMoney(gameState.treasury * 10000)}　私人账户：¥${formatMoney(gameState.privateAccount * 10000)}</p>
    <p style="font-size:11px;color:var(--yellow);margin-top:4px;">本月划拨额度上限：¥${formatMoney(maxTransfer * 10000)}（财政的20%）</p>
    <div style="margin-top:10px;">
      <label style="font-size:12px;">划拨金额（万）</label>
      <input type="number" id="transfer-amount" min="1" max="${maxTransfer}" value="${Math.min(maxTransfer, 100)}" style="width:100%;padding:8px;margin-top:4px;border-radius:var(--radius-xs);border:1px solid var(--separator);background:var(--separator-light);color:var(--text);">
    </div>
    <div style="margin-top:8px;">
      <label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;">
        <input type="checkbox" id="transfer-fake" style="width:auto;">
        <span>做假账掩盖（需从私人账户支付¥${formatMoney(fakeCost * 10000)}，降低50%风险暴露）</span>
      </label>
    </div>`, [
    { text: '取消', color: 'gray', action: () => closeModal() },
    { text: '确认划拨', color: 'red', action: () => {
      const amount = parseInt(document.getElementById('transfer-amount').value);
      const useFake = document.getElementById('transfer-fake').checked;
      if (!amount || amount <= 0 || amount > gameState.treasury) { showNotification('金额无效', 'danger'); return; }
      if (amount > maxTransfer) { showNotification(`本月划拨额度不足，最多可划拨¥${formatMoney(maxTransfer * 10000)}`, 'danger'); return; }
      // v2.4.2: 做假账扣除费用
      const actualFakeCost = Math.ceil(amount * 0.05);
      if (useFake && gameState.privateAccount < actualFakeCost) {
        showNotification(`做假账费用不足，需¥${formatMoney(actualFakeCost * 10000)}`, 'danger'); return;
      }
      gameState.treasury -= amount;
      gameState.privateAccount += amount;
      if (useFake) gameState.privateAccount -= actualFakeCost;
      // 纪委风险与金额成正比（做假账降低50%风险暴露但增加腐败）
      let risk = Math.ceil(amount / 100) + 5;
      if (useFake) risk = Math.ceil(risk * 0.5);
      gameState.inspectionRisk = clamp(gameState.inspectionRisk + risk, 0, 100);
      gameState.corruption = clamp(gameState.corruption + Math.ceil(risk / 3), 0, 100);
      // v2.4.2: 不忠诚的财政局长有概率举报
      const finDir = _getFinanceDirector();
      if (finDir && (finDir.loyalty || 5) <= 3 && Math.random() < 0.3) {
        gameState.inspectionRisk = clamp(gameState.inspectionRisk + 10, 0, 100);
        logEvent(`财政局长${finDir.name}对划拨行为不满，向纪委举报！纪委风险+10`, 'danger');
        showNotification(`财政局长${finDir.name}向纪委举报了你的划拨行为！`, 'danger');
      } else if (useFake && finDir && (finDir.loyalty || 5) <= 5 && Math.random() < 0.2) {
        gameState.inspectionRisk = clamp(gameState.inspectionRisk + 8, 0, 100);
        logEvent(`做假账行为被财政局长${finDir.name}察觉并举报！纪委风险+8`, 'danger');
        showNotification(`做假账被财政局长${finDir.name}举报！`, 'danger');
      }
      closeModal();
      showNotification(`已划拨¥${formatMoney(amount * 10000)}到私人账户（纪委风险+${risk}）${useFake ? '（已做假账）' : ''}`, 'warn');
      logEvent(`违规划拨财政资金¥${formatMoney(amount * 10000)}到私人账户${useFake ? '（做假账¥' + formatMoney(actualFakeCost * 10000) + '）' : ''}，纪委风险+${risk}`, 'corruption');
      gameState.achievementStats.transfersDone += amount;
      updateUI();
      renderSheet('personal');
    }},
  ], '财政划拨', 'danger');
}

function showTransferBackModal() {
  // v2.4.2: 转入公账额度限制 — 每月最多转入私人账户的30%
  const maxMonthlyBack = Math.max(1, Math.floor((gameState.privateAccount || 0) * 0.3));
  const maxBack = Math.max(0, Math.min(Math.floor(gameState.privateAccount), maxMonthlyBack));
  showModal('转入公账', `<p style="font-size:13px;color:var(--text-2);">将私人账户资金转入财政账户。</p>
    <p style="color:var(--green);font-size:12px;margin-top:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"><polyline points="20 6 9 17 4 12"/></svg> 主动归还非法所得可降低纪委风险和腐败指数。</p>
    <p style="font-size:12px;color:var(--text-3);margin-top:6px;">当前私人账户：¥${formatMoney(gameState.privateAccount * 10000)}　财政：¥${formatMoney(gameState.treasury * 10000)}</p>
    <p style="font-size:11px;color:var(--yellow);margin-top:4px;">本月转入额度上限：¥${formatMoney(maxBack * 10000)}（私人账户的30%）</p>
    <div style="margin-top:10px;">
      <label style="font-size:12px;">转入金额（万）</label>
      <input type="number" id="transferback-amount" min="1" max="${maxBack}" value="${Math.min(maxBack, 100)}" style="width:100%;padding:8px;margin-top:4px;border-radius:var(--radius-sm);border:1px solid var(--separator);background:var(--bg-card);color:var(--text);">
    </div>`, [
    { text: '取消', color: 'gray', action: () => closeModal() },
    { text: '确认转入', color: 'green', action: () => {
      const amount = parseInt(document.getElementById('transferback-amount').value);
      if (!amount || amount <= 0 || amount > gameState.privateAccount) { showNotification('金额无效', 'danger'); return; }
      if (amount > maxBack) { showNotification(`本月转入额度不足，最多可转入¥${formatMoney(maxBack * 10000)}`, 'danger'); return; }
      gameState.privateAccount -= amount;
      gameState.treasury += amount;
      // v2.4.2: 按比例降级纪委风险（而非直接扣除）
      // 风险>20时永远不会低于20；风险<=20时不再降低
      const currentRisk = gameState.inspectionRisk || 0;
      const riskReduction = Math.ceil(amount / 150);
      let newRisk = currentRisk - riskReduction;
      if (currentRisk > 20) newRisk = Math.max(20, newRisk);
      else newRisk = currentRisk; // 风险<=20时转入公账不再降低
      const actualRiskReduction = currentRisk - newRisk;
      const corruptionReduction = Math.ceil(amount / 200);
      gameState.inspectionRisk = clamp(newRisk, 0, 100);
      gameState.corruption = clamp(gameState.corruption - corruptionReduction * 0.5, 0, 100);
      gameState.achievementStats.transfersDone = Math.max(0, (gameState.achievementStats.transfersDone || 0) - amount);
      // v2.4.2: 不忠诚的财政局长有概率举报做假账行为
      const finDir = _getFinanceDirector();
      if (finDir && (finDir.loyalty || 5) <= 3 && Math.random() < 0.2) {
        gameState.inspectionRisk = clamp(gameState.inspectionRisk + 5, 0, 100);
        logEvent(`财政局长${finDir.name}对频繁转入公账行为产生怀疑，向纪委反映`, 'warn');
        showNotification(`财政局长${finDir.name}对转入行为产生怀疑`, 'warn');
      }
      closeModal();
      const riskMsg = actualRiskReduction > 0 ? `纪委风险-${actualRiskReduction}` : '纪委风险已达下限';
      showNotification(`已转入¥${formatMoney(amount * 10000)}到财政（${riskMsg}，腐败-${(corruptionReduction * 0.5).toFixed(1)}）`, 'success');
      logEvent(`转入¥${formatMoney(amount * 10000)}到财政账户，${riskMsg}，腐败指数-${(corruptionReduction * 0.5).toFixed(1)}`, 'info');
      updateUI();
      renderSheet('personal');
    }},
  ], '转入公账', 'info');
}

// v2.4.2: 获取现任财政局长
function _getFinanceDirector() {
  if (!gameState.personnel || !gameState.personnel.appointments) return null;
  const finId = gameState.personnel.appointments.finance;
  if (!finId) return null;
  return gameState.personnel.officials.find(o => o.id === finId) || null;
}

function showStockModal() {
  let stockHtml = `<p style="font-size:13px;color:var(--text-2);">选择股票进行买入操作。股市有风险，投资需谨慎。</p>`;
  stockHtml += `<p style="font-size:12px;color:var(--text-3);margin-top:6px;">当前股市指数：${gameState.stockMarket.index.toFixed(0)}点　趋势：${gameState.stockMarket.trend >= 0 ? '↑' : '↓'}${Math.abs(gameState.stockMarket.trend * 100).toFixed(1)}%</p>`;
  stockHtml += `<div style="margin-top:8px;">`;
  for (const s of STOCK_LIST) {
    const price = (gameState.stockMarket.index / 3000 * s.basePrice * (1 + (Math.sin(gameState.turn + s.basePrice) * 0.1))).toFixed(1);
    stockHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:var(--radius-xs);background:var(--separator-light);margin-bottom:6px;font-size:12px;">
      <div><div style="font-weight:600;">${s.name}</div><div style="color:var(--text-3);">¥${price}/股</div></div>
      <button style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;" onclick="buyStock('${s.id}', ${price})">买入</button>
    </div>`;
  }
  stockHtml += `</div>`;
  showModal('股票交易', stockHtml, [{ text: '关闭', color: 'gray', action: () => closeModal() }], '股市', 'info');
}

function buyStock(stockId, price) {
  const stock = STOCK_LIST.find(s => s.id === stockId);
  if (!stock) return;
  closeModal();
  showModal(`买入${stock.name}`, `<p style="font-size:12px;color:var(--text-3);">当前股价：¥${price.toFixed(1)}/股　私人账户余额：¥${formatMoney(gameState.privateAccount * 10000)}</p>
    <div style="margin-top:8px;">
      <label style="font-size:12px;">买入股数</label>
      <input type="number" id="stock-shares" min="1" value="10" style="width:100%;padding:8px;margin-top:4px;border-radius:var(--radius-xs);border:1px solid var(--separator);background:var(--separator-light);color:var(--text);">
      <p style="font-size:11px;color:var(--text-3);margin-top:4px;" id="stock-cost">预计花费：¥${(10 * price).toFixed(0)}万</p>
    </div>`, [
    { text: '取消', color: 'gray', action: () => closeModal() },
    { text: '买入', color: 'blue', action: () => {
      const shares = parseInt(document.getElementById('stock-shares').value);
      const cost = shares * price;
      if (!shares || shares <= 0) { showNotification('股数无效', 'danger'); return; }
      if (cost > gameState.privateAccount) { showNotification('私人账户余额不足', 'danger'); return; }
      gameState.privateAccount -= cost;
      const existing = gameState.privateAssets.stocks.find(s => s.id === stockId);
      if (existing) {
        existing.shares += shares;
        existing.buyPrice = (existing.buyPrice * (existing.shares - shares) + price * shares) / existing.shares;
        existing.currentPrice = price;
      } else {
        gameState.privateAssets.stocks.push({ id: stockId, name: stock.name, shares, buyPrice: price, currentPrice: price });
      }
      closeModal();
      showStockModal();
      showNotification(`买入${stock.name} ${shares}股（-¥${cost.toFixed(0)}万）`, 'success');
      logEvent(`股票买入：${stock.name} ${shares}股@¥${price.toFixed(1)}`, 'info');
      gameState.achievementStats.stockTrades++;
      renderSheet('personal');
    }},
  ], '股票买入', 'info');
}

function sellStock(stockId) {
  const st = gameState.privateAssets.stocks.find(s => s.id === stockId);
  if (!st) return;
  const proceeds = st.shares * st.currentPrice;
  gameState.privateAccount += proceeds;
  gameState.privateAssets.stocks = gameState.privateAssets.stocks.filter(s => s.id !== stockId);
  const profit = (st.currentPrice - st.buyPrice) * st.shares;
  gameState.achievementStats.stockTrades++;
  if (profit > gameState.achievementStats.maxStockProfit) gameState.achievementStats.maxStockProfit = profit;
  showNotification(`卖出${st.name} ${st.shares}股（+¥${proceeds.toFixed(0)}万，${profit >= 0 ? '盈利' : '亏损'}¥${profit.toFixed(0)}万）`, profit >= 0 ? 'success' : 'warn');
  logEvent(`股票卖出：${st.name} ${st.shares}股@¥${st.currentPrice.toFixed(1)}，${profit >= 0 ? '盈利' : '亏损'}¥${profit.toFixed(0)}万`, profit >= 0 ? 'success' : 'warn');
  renderSheet('personal');
}

function showLandModal() {
  let landHtml = `<p style="font-size:13px;color:var(--text-2);">购买城市土地，长期持有可增值。土地价格会随城市GDP增长而上涨。</p>`;
  landHtml += `<p style="font-size:12px;color:var(--text-3);margin-top:6px;">私人账户余额：¥${formatMoney(gameState.privateAccount * 10000)}</p>`;
  for (const l of LAND_OPTIONS) {
    landHtml += `<div style="padding:8px;border-radius:var(--radius-xs);background:var(--separator-light);margin-bottom:6px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;"><span style="font-weight:600;">${l.name}</span><span style="color:var(--orange);">¥${formatMoney(l.cost * 10000)}</span></div>
      <div style="color:var(--text-3);margin-top:2px;">${l.desc}</div>
      <div style="color:var(--green);margin-top:2px;">月增值率约${(l.appreciation * 100).toFixed(1)}%</div>
      <button style="width:100%;margin-top:6px;padding:6px;background:var(--green);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;" onclick="buyLand('${l.id}')">购买</button>
    </div>`;
  }
  showModal('购买土地', landHtml, [{ text: '关闭', color: 'gray', action: () => closeModal() }], '土地交易', 'info');
}

function buyLand(landId) {
  const opt = LAND_OPTIONS.find(l => l.id === landId);
  if (!opt) return;
  if (gameState.privateAccount < opt.cost) { showNotification('私人账户余额不足', 'danger'); return; }
  // 土地块数限制：超过上限引发纪委高度关注
  const landCount = gameState.privateAssets.land.length;
  if (landCount >= LAND_HOLD_LIMIT) {
    showNotification(`持有土地已达上限${LAND_HOLD_LIMIT}块，纪委风险急剧上升！`, 'danger');
    // 超限直接大幅增加纪委风险
    gameState.inspectionRisk = clamp(gameState.inspectionRisk + 20, 0, 100);
    gameState.corruption = clamp(gameState.corruption + 5, 0, 100);
    logEvent(`持有土地超过${LAND_HOLD_LIMIT}块，纪委高度关注！腐败+5，风险+20`, 'corruption');
    return;
  }
  closeModal();
  gameState.privateAccount -= opt.cost;
  gameState.privateAssets.land.push({ id: landId, name: opt.name, cost: opt.cost, currentValue: opt.cost, appreciation: opt.appreciation });
  // 买地增加纪委风险（大幅提升）
  const risk = Math.ceil(opt.cost / 200); // 风险翻倍
  gameState.inspectionRisk = clamp(gameState.inspectionRisk + risk, 0, 100);
  // 持有越多土地，每块新增风险越高
  const extraRisk = landCount * 3;
  gameState.inspectionRisk = clamp(gameState.inspectionRisk + extraRisk, 0, 100);
  showNotification(`购买${opt.name}（-¥${formatMoney(opt.cost * 10000)}，纪委风险+${risk + extraRisk}，持有${landCount + 1}/${LAND_HOLD_LIMIT}）`, 'success');
  logEvent(`私人账户购买土地：${opt.name}（¥${formatMoney(opt.cost * 10000)}），纪委风险+${risk + extraRisk}，持有${landCount + 1}/${LAND_HOLD_LIMIT}`, 'corruption');
  gameState.achievementStats.landPurchases++;
  renderSheet('personal');
}

function sellLand(index) {
  const land = gameState.privateAssets.land[index];
  if (!land) return;
  gameState.privateAccount += land.currentValue;
  const profit = land.currentValue - land.cost;
  gameState.privateAssets.land.splice(index, 1);
  showNotification(`出售${land.name}（+¥${formatMoney(land.currentValue * 10000)}，${profit >= 0 ? '盈利' : '亏损'}¥${formatMoney(profit * 10000)}）`, profit >= 0 ? 'success' : 'warn');
  logEvent(`出售土地：${land.name}（+¥${formatMoney(land.currentValue * 10000)}）`, 'info');
  renderSheet('personal');
}

function showProjectModal() {
  let projHtml = `<p style="font-size:13px;color:var(--text-2);">投资项目获取稳定月度收益，到期返还本金。</p>`;
  projHtml += `<p style="font-size:12px;color:var(--text-3);margin-top:6px;">私人账户余额：¥${formatMoney(gameState.privateAccount * 10000)}</p>`;
  for (const p of PROJECT_OPTIONS) {
    projHtml += `<div style="padding:8px;border-radius:var(--radius-xs);background:var(--separator-light);margin-bottom:6px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;"><span style="font-weight:600;">${p.name}</span><span style="color:var(--orange);">¥${formatMoney(p.cost * 10000)}</span></div>
      <div style="color:var(--text-3);margin-top:2px;">${p.desc}</div>
      <div style="color:var(--green);margin-top:2px;">总收益：¥${formatMoney(p.cost * p.monthlyReturn * p.months * 10000)}（${(p.monthlyReturn * p.months * 100).toFixed(0)}%）</div>
      <button style="width:100%;margin-top:6px;padding:6px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;" onclick="investProject('${p.id}')">投资</button>
    </div>`;
  }
  showModal('投资项目', projHtml, [{ text: '关闭', color: 'gray', action: () => closeModal() }], '项目投资', 'info');
}

function investProject(projId) {
  const opt = PROJECT_OPTIONS.find(p => p.id === projId);
  if (!opt) return;
  if (gameState.privateAccount < opt.cost) { showNotification('私人账户余额不足', 'danger'); return; }
  closeModal();
  gameState.privateAccount -= opt.cost;
  // v2.4.2: 保存风险暴雷概率
  gameState.privateAssets.projects.push({ id: projId, name: opt.name, investment: opt.cost, monthlyReturn: opt.monthlyReturn, monthlyGain: opt.cost * opt.monthlyReturn, remainingMonths: opt.months, totalMonths: opt.months, riskChance: opt.riskChance || 0 });
  showNotification(`投资${opt.name}（-¥${formatMoney(opt.cost * 10000)}）`, 'success');
  logEvent(`私人账户投资项目：${opt.name}（¥${formatMoney(opt.cost * 10000)}），月收益¥${formatMoney(opt.cost * opt.monthlyReturn * 10000)}`, 'info');
  renderSheet('personal');
}

function showVillaModal() {
  let villaHtml = `<p style="font-size:13px;color:var(--text-2);">购买豪华别墅等不动产。价值越高，纪委风险越大（明显超出合法收入水平）。</p>`;
  villaHtml += `<p style="font-size:12px;color:var(--text-3);margin-top:6px;">私人账户余额：¥${formatMoney(gameState.privateAccount * 10000)}</p>`;
  for (const v of VILLA_OPTIONS) {
    villaHtml += `<div style="padding:8px;border-radius:var(--radius-xs);background:var(--separator-light);margin-bottom:6px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;"><span style="font-weight:600;">${v.name}</span><span style="color:var(--orange);">¥${formatMoney(v.cost * 10000)}</span></div>
      <div style="color:var(--text-3);margin-top:2px;">${v.desc}</div>
      <div style="color:var(--red);margin-top:2px;">纪委风险+${v.inspectionRisk}</div>
      <button style="width:100%;margin-top:6px;padding:6px;background:var(--purple);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;" onclick="buyVilla('${v.id}')">购买</button>
    </div>`;
  }
  showModal('购买别墅', villaHtml, [{ text: '关闭', color: 'gray', action: () => closeModal() }], '豪宅购置', 'info');
}

function buyVilla(villaId) {
  const opt = VILLA_OPTIONS.find(v => v.id === villaId);
  if (!opt) return;
  if (gameState.privateAccount < opt.cost) { showNotification('私人账户余额不足', 'danger'); return; }
  closeModal();
  gameState.privateAccount -= opt.cost;
  gameState.privateAssets.villas.push({ id: villaId, name: opt.name, value: opt.value });
  gameState.inspectionRisk = clamp(gameState.inspectionRisk + opt.inspectionRisk, 0, 100);
  gameState.corruption = clamp(gameState.corruption + Math.ceil(opt.inspectionRisk / 3), 0, 100);
  showNotification(`购买${opt.name}（-¥${formatMoney(opt.cost * 10000)}，纪委风险+${opt.inspectionRisk}）`, 'success');
  logEvent(`私人账户购买不动产：${opt.name}（¥${formatMoney(opt.cost * 10000)}），纪委风险+${opt.inspectionRisk}`, 'corruption');
  gameState.achievementStats.villaPurchases++;
  renderSheet('personal');
}

function sellVilla(index) {
  const villa = gameState.privateAssets.villas[index];
  if (!villa) return;
  gameState.privateAccount += villa.value;
  gameState.privateAssets.villas.splice(index, 1);
  showNotification(`出售${villa.name}（+¥${formatMoney(villa.value * 10000)}）`, 'success');
  logEvent(`出售不动产：${villa.name}（+¥${formatMoney(villa.value * 10000)}）`, 'info');
  renderSheet('personal');
}

// ============== v2.3.5: 个人收购公司玩法 ==============
function showAcquireCompanyModal() {
  const available = (gameState.enterprises || []).filter(e => !e.ownedBy && !e.acquired);
  if (available.length === 0) {
    showNotification('当前没有可收购的企业', 'warn');
    return;
  }
  let html = '<p style="font-size:13px;color:var(--text-2);margin-bottom:8px;">选择要收购的企业。点击"收购"进行正常交易，点击"权力运作"触发特殊事件。</p>';
  html += '<div style="max-height:340px;overflow-y:auto;">';
  for (const ent of available.slice(0, 8)) {
    const cost = Math.round(ent.capital * 0.5);
    const typeDef = ENTERPRISE_TYPES[ent.ownership];
    const isPowerLinked = ent.ownership === 'stateOwned' || ent.ownership === 'mixed';
    const borderColor = ent.ownership === 'stateOwned' ? 'var(--accent)' : ent.ownership === 'private' ? 'var(--green)' : ent.ownership === 'foreign' ? '#2d6a8c' : 'var(--purple)';
    const powerIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--orange);display:inline-block;vertical-align:middle;"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
    html += `<div style="padding:10px;margin:6px 0;background:var(--bg-card);border:1px solid var(--separator);border-left:3px solid ${borderColor};border-radius:var(--radius-xs);font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:10px;">`;
    html += `<div style="flex:1;min-width:0;">`;
    html += `<div style="font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ent.shortName || ent.name}${isPowerLinked ? ' ' + powerIcon : ''}</div>`;
    html += `<div style="font-size:11px;color:var(--text-3);margin-top:2px;">${typeDef.name} · 收购价${cost}万</div>`;
    html += `</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">`;
    html += `<button onclick="confirmAcquireCompany('${ent.id}')" style="font-size:11px;padding:5px 12px;background:var(--green);color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;">正常收购</button>`;
    html += `<button onclick="triggerPowerEvent('${ent.id}')" style="font-size:11px;padding:5px 12px;background:var(--orange);color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;">权力运作</button>`;
    html += `</div></div>`;
  }
  html += '</div>';
  showModal('收购企业', html, [{ text: '关闭', color: 'gray', action: closeModal }], '个人收购', 'warn');
}

function confirmAcquireCompany(entId) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  const cost = Math.round(ent.capital * 0.5);
  const isPowerLinked = ent.ownership === 'stateOwned' || ent.ownership === 'mixed';
  const corruptionAdd = isPowerLinked ? 10 : 5;
  const riskAdd = isPowerLinked ? 15 : 8;
  closeModal();
  showModal('确认收购', `<p>收购「${ent.name}」。</p><p>收购价：${cost}万</p><p>月利润预估：${Math.round(ent.annualProfit * 0.3 || ent.gdpContribution * 0.2)}万</p><p style="color:var(--red);">纪委风险+${riskAdd}，腐败度+${corruptionAdd}${isPowerLinked ? '（权力关联收购风险更大）' : ''}</p><p style="color:var(--text-3);font-size:13px;">当前私人账户：${gameState.privateAccount}万</p>`, [{ text: '确认收购', color: 'purple', action: () => {
    closeModal();
    if (gameState.privateAccount < cost) { showNotification('私人账户资金不足！', 'warn'); return; }
    gameState.privateAccount -= cost;
    ent.ownedBy = 'player';
    const monthlyProfit = Math.round((ent.annualProfit * 0.3 || ent.gdpContribution * 0.2) * (0.5 + Math.random()));
    const pc = {
      id: 'pc_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
      name: ent.name,
      ownership: ent.ownership,
      capital: ent.capital,
      monthlyProfit: monthlyProfit,
      purchasedPrice: cost,
      x: ent.x,
      y: ent.y,
      status: '经营中',
      entId: ent.id,
      injected: 0,
    };
    gameState.personalCompanies = gameState.personalCompanies || [];
    gameState.personalCompanies.push(pc);
    gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + riskAdd);
    gameState.corruption = Math.min(100, (gameState.corruption || 0) + corruptionAdd);
    logEvent(`个人收购「${ent.name}」，花费¥${cost}万，纪委风险+${riskAdd}`, 'warn');
    showNotification(`收购成功！月利润约¥${monthlyProfit}万`, 'success');
    updateUI();
  }}, { text: '取消', color: 'gray', action: closeModal }], '个人收购', 'warn');
}

function injectPersonalCompany(pcId) {
  const pc = (gameState.personalCompanies || []).find(p => p.id === pcId);
  if (!pc) return;
  const cost = Math.round(pc.capital * 0.05);
  showModal('注资企业', `<p>向「${pc.shortName || pc.name}」注资¥${cost}万，增加注册资本。</p><p style="color:var(--text-3);font-size:13px;">注资主要扩大资本规模，有概率小幅提升利润（2%-5%）。每持有一个企业回合，纪委风险+1。</p><p style="color:var(--text-3);font-size:13px;">当前私人账户：¥${gameState.privateAccount}万</p>`, [{ text: '确认注资', color: 'blue', action: () => {
    closeModal();
    if (gameState.privateAccount < cost) { showNotification('私人账户资金不足！', 'warn'); return; }
    gameState.privateAccount -= cost;
    pc.injected = (pc.injected || 0) + cost;
    pc.capital = (pc.capital || 0) + cost;
    // v2.3.6b: 注资只增加注册资本，利润提升极小且有概率
    const lucky = Math.random() < 0.35;
    const smallBonus = lucky ? (0.02 + Math.random() * 0.03) : 0;
    if (smallBonus > 0) {
      pc.monthlyProfit = Math.round(pc.monthlyProfit * (1 + smallBonus));
    }
    // v2.3.6b: 每持有公司一回合增加纪委风险（在simulation中按月累加）
    logEvent(`个人注资「${pc.shortName || pc.name}」¥${cost}万，注册资本增至${pc.capital}万${smallBonus > 0 ? '，利润小幅提升' : ''}`, 'info');
    showNotification(`注资成功，注册资本增至${pc.capital}万${smallBonus > 0 ? '，利润小幅提升' : '，利润暂无明显变化'}`, 'success');
    updateUI();
  }}, { text: '取消', color: 'gray', action: closeModal }], '个人注资', 'info');
}

function operatePersonalCompany(pcId) {
  const pc = (gameState.personalCompanies || []).find(p => p.id === pcId);
  if (!pc) return;
  const isPowerLinked = pc.ownership === 'stateOwned' || pc.ownership === 'mixed';
  const gain = Math.round(pc.monthlyProfit * (0.5 + Math.random()));
  const loss = Math.round(pc.monthlyProfit * 0.3 * Math.random());
  const success = Math.random() > 0.3;
  const riskAdd = isPowerLinked ? 5 : 3;
  showModal('经营企业', `<p>经营「${pc.name}」一个月。</p><p>预估${success ? '收益' : '亏损'}：¥${success ? gain : loss}万</p><p style="color:var(--orange);">纪委风险+${riskAdd}（经营企业有利益冲突风险）</p>`, [{ text: '经营', color: 'green', action: () => {
    closeModal();
    if (success) {
      gameState.privateAccount += gain;
      logEvent(`经营「${pc.name}」获利¥${gain}万`, 'success');
      showNotification(`经营获利¥${gain}万`, 'success');
    } else {
      gameState.privateAccount = Math.max(0, gameState.privateAccount - loss);
      logEvent(`经营「${pc.name}」亏损¥${loss}万`, 'warn');
      showNotification(`经营亏损¥${loss}万`, 'warn');
    }
    gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + riskAdd);
    updateUI();
  }}, { text: '取消', color: 'gray', action: closeModal }], '企业经营', 'info');
}

function transferPersonalCompany(pcId) {
  const pc = (gameState.personalCompanies || []).find(p => p.id === pcId);
  if (!pc) return;
  // v2.3.6c: 修复转让价0元问题 — 使用资本作为保底，不仅仅是purchasedPrice
  const baseValue = pc.purchasedPrice > 0 ? pc.purchasedPrice : (pc.capital || 0) * 0.5;
  const sellPrice = Math.max(Math.round(baseValue * (0.8 + Math.random() * 0.6)), Math.round((pc.capital || 0) * 0.3));
  showModal('转让企业', `<p>转让「${pc.shortName || pc.name}」。</p><p>转让价：¥${sellPrice}万</p><p>转让后解除个人持有，降低纪委风险-10。</p>`, [{ text: '确认转让', color: 'orange', action: () => {
    closeModal();
    gameState.privateAccount += sellPrice;
    const ent = (gameState.enterprises || []).find(e => e.id === pc.entId);
    if (ent) ent.ownedBy = null;
    gameState.personalCompanies = gameState.personalCompanies.filter(p => p.id !== pcId);
    gameState.inspectionRisk = Math.max(0, (gameState.inspectionRisk || 0) - 10);
    logEvent(`转让「${pc.shortName || pc.name}」获得¥${sellPrice}万，纪委风险-10`, 'info');
    showNotification(`转让成功！获得¥${sellPrice}万`, 'success');
    updateUI();
  }}, { text: '取消', color: 'gray', action: closeModal }], '企业转让', 'info');
}

function simulateStockMarket() {
  // 大盘指数波动：±2%以内，趋势有惯性
  const prevTrend = gameState.stockMarket.trend || 0;
  // 趋势惯性：上期趋势有40%概率延续
  const momentum = prevTrend * 0.4;
  // 随机扰动：±1.2%
  const noise = (Math.random() - 0.5) * 0.024;
  const change = momentum + noise;
  gameState.stockMarket.trend = change;
  gameState.stockMarket.index = Math.max(1000, Math.min(20000, gameState.stockMarket.index * (1 + change)));
  // 更新持仓股价：个股跟随大盘（beta联动）+ 个股随机波动（已降低）
  const indexChange = change; // 大盘涨跌幅
  for (const st of gameState.privateAssets.stocks) {
    const stock = STOCK_LIST.find(s => s.id === st.id);
    if (!stock) continue;
    const beta = stock.beta || 1.0;
    const vol = stock.volatility;
    // 个股变动 = 大盘变动 × beta + 个股自身随机波动
    const marketEffect = indexChange * beta;
    const stockNoise = (Math.random() - 0.5) * vol * 2;
    const priceChange = marketEffect + stockNoise;
    st.currentPrice = Math.max(1, st.currentPrice * (1 + priceChange));
  }
}

function simulatePrivateAssets() {
  // 土地增值
  for (const land of gameState.privateAssets.land) {
    land.currentValue = Math.round(land.currentValue * (1 + land.appreciation) * 10) / 10;
  }
  // 项目收益
  for (let i = gameState.privateAssets.projects.length - 1; i >= 0; i--) {
    const p = gameState.privateAssets.projects[i];
    // v2.4.2: 项目暴雷风险 — 每月有概率暴雷，损失全部本金并增加纪委风险
    if (p.riskChance && Math.random() < p.riskChance) {
      gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 8, 0, 100);
      logEvent(`投资项目暴雷：${p.name}，本金¥${formatMoney(p.investment * 10000)}全部损失，纪委风险+8`, 'danger');
      showNotification(`${p.name}暴雷！本金全部损失，纪委风险上升`, 'danger');
      gameState.privateAssets.projects.splice(i, 1);
      continue;
    }
    gameState.privateAccount += p.monthlyGain;
    p.remainingMonths--;
    if (p.remainingMonths <= 0) {
      gameState.privateAccount += p.investment; // 返还本金
      logEvent(`投资项目到期：${p.name}，返还本金¥${formatMoney(p.investment * 10000)}，累计收益¥${formatMoney(p.monthlyGain * (p.totalMonths || p.remainingMonths + 1) * 10000)}`, 'success');
      gameState.privateAssets.projects.splice(i, 1);
    }
  }
}

function renderConstructionTab() {
  let html = '';
  const projects = gameState.constructionProjects || [];
  const activeProjects = projects.filter(p => !p.completed);
  const completedProjects = projects.filter(p => p.completed);

  if (activeProjects.length === 0 && completedProjects.length === 0) {
    return `<div style="padding:20px;text-align:center;color:var(--text-3);">
      <div style="font-size:32px;margin-bottom:8px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px;opacity:0.4;margin:0 auto 12px;display:block;"><path d="M2 20h20M4 20V8l8-6 8 6v12M9 20v-6h6v6"/></svg></div>
      <p>暂无在建工程</p>
      <p style="font-size:12px;margin-top:4px;">划定区域后会自动创建工程，按工期分期付款。</p>
    </div>`;
  }

  // Active projects
  if (activeProjects.length > 0) {
    html += `<div class="stat-section-title" style="margin:12px 16px 8px;">在建工程（${activeProjects.length}）</div>`;
    for (const proj of activeProjects) {
      const pct = Math.round(proj.elapsedMonths / proj.totalMonths * 100);
      const nextPaymentMonth = Math.ceil(proj.totalMonths / proj.totalInstallments) * (proj.paidInstallments + 1);
      const remainingInstallments = proj.totalInstallments - proj.paidInstallments;
      html += `<div style="margin:8px 16px;padding:14px;background:var(--separator-light);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:14px;font-weight:700;">${proj.name}</span>
          <span style="font-size:12px;color:${pct >= 80 ? 'var(--green)' : 'var(--text-3)'};">${pct}%</span>
        </div>
        <div style="height:6px;background:var(--separator);border-radius:3px;overflow:hidden;margin-bottom:8px;">
          <div style="height:100%;width:${pct}%;background:${pct >= 80 ? 'var(--green)' : 'var(--accent)'};border-radius:3px;transition:width 0.3s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);margin-bottom:6px;">
          <span>工期：第${proj.elapsedMonths}/${proj.totalMonths}月</span>
          <span>已付${proj.paidInstallments}/${proj.totalInstallments}期（¥${formatMoney(proj.paidAmount * 10000)}）</span>
        </div>
        ${proj.accruedDebt > 0 ? `<div style="font-size:12px;color:var(--red);margin-bottom:6px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg> 拖欠工程款：¥${formatMoney(proj.accruedDebt * 10000)}</div>` : ''}
        ${remainingInstallments > 0 ? `
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="start-btn" style="flex:1;padding:8px;font-size:12px;background:var(--orange);color:white;" onclick="deferConstructionPayment('${proj.id}')">拖欠下期工程款</button>
            <button class="start-btn" style="flex:1;padding:8px;font-size:12px;" onclick="payConstructionDebt('${proj.id}')">结清拖欠${proj.accruedDebt > 0 ? `（¥${formatMoney(proj.accruedDebt * 10000)}）` : ''}</button>
          </div>
        ` : ''}
      </div>`;
    }
  }

  // Completed projects
  if (completedProjects.length > 0) {
    html += `<div class="stat-section-title" style="margin:16px 16px 8px;">已竣工工程（${completedProjects.length}）</div>`;
    for (const proj of completedProjects.slice(-5)) {
      html += `<div style="margin:8px 16px;padding:10px 14px;background:var(--separator-light);border-radius:8px;opacity:0.7;">
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:13px;">${proj.name}</span>
          <span style="font-size:12px;color:var(--green);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"><polyline points="20 6 9 17 4 12"/></svg>竣工</span>
        </div>
      </div>`;
    }
  }

  return html;
}

function deferConstructionPayment(projId) {
  const proj = gameState.constructionProjects?.find(p => p.id === projId);
  if (!proj || proj.completed) return;
  const remainingInstallments = proj.totalInstallments - proj.paidInstallments;
  if (remainingInstallments <= 0) {
    showNotification('该工程已无待付期款', 'info');
    return;
  }
  showModal('拖欠工程款', `<p>确定要拖欠${proj.name}的下一期工程款（¥${formatMoney(proj.installmentAmount * 10000)}）吗？</p>
    <p style="color:var(--orange);font-size:12px;">拖欠的工程款将在工程竣工时一并结算。若财政资金不足，将转为12月期贷款。</p>`, [
    { text: '确认拖欠', color: 'yellow', action: () => {
      closeModal();
      proj.deferredPayments = (proj.deferredPayments || 0) + 1;
      showNotification(`已设定拖欠下一期工程款`, 'warn');
      logEvent(`${proj.name}：设定拖欠下一期工程款¥${formatMoney(proj.installmentAmount * 10000)}`, 'warn');
      // Chance of negative event
      if (Math.random() < 0.3) {
        applyEffects({ happiness: -3, reputation: -2 });
        showNotification('施工方对拖欠工程款表示不满', 'warn');
      }
      updateUI();
    }},
    { text: '取消', color: 'gray', action: closeModal },
  ], '工程款', 'warn');
}

function payConstructionDebt(projId) {
  const proj = gameState.constructionProjects?.find(p => p.id === projId);
  if (!proj || proj.accruedDebt <= 0) {
    showNotification('无拖欠工程款需要结清', 'info');
    return;
  }
  if (gameState.treasury < proj.accruedDebt) {
    showNotification(`财政资金不足，无法结清拖欠（需要¥${formatMoney(proj.accruedDebt * 10000)}）`, 'danger');
    return;
  }
  showModal('结清拖欠', `<p>结清${proj.name}的拖欠工程款¥${formatMoney(proj.accruedDebt * 10000)}？</p>`, [
    { text: '确认结清', color: 'blue', action: () => {
      closeModal();
      gameState.treasury -= proj.accruedDebt;
      logEvent(`${proj.name}：结清拖欠工程款¥${formatMoney(proj.accruedDebt * 10000)}`, 'info');
      proj.accruedDebt = 0;
      showNotification('拖欠工程款已结清', 'success');
      applyEffects({ happiness: 2, reputation: 1 });
      updateUI();
    }},
    { text: '取消', color: 'gray', action: closeModal },
  ], '工程款', 'info');
}

function initPersonnelSystem() {
  if (gameState.personnel) return;
  // v2.2.7: 初始干部池有派系（模拟既有干部），后续年度考试新招录的无派系
  gameState.personnel = {
    officials: generateOfficialPool(15, { faction: 'random' }),
    appointments: {},
    secretary: null,  // v2.2.4b: 秘书ID
  };
  // 随机分配派系给初始干部
  for (const off of gameState.personnel.officials) {
    off.faction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
  }
  // 默认自动任命3个关键局（公安局、财政局、教育局）
  const defaultBureaus = ['publicSecurity', 'finance', 'education'];
  const ps = gameState.personnel;
  for (const bId of defaultBureaus) {
    const avail = ps.officials.filter(o => !Object.values(ps.appointments).includes(o.id));
    if (avail.length > 0) {
      // 选能力最高的
      avail.sort((a, b) => b.competence - a.competence);
      ps.appointments[bId] = avail[0].id;
    }
  }
  // v2.4.1: 初始化常务委员会
  if (!gameState.playerFaction) {
    gameState.playerFaction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
  }
  initCommittee();
}

// v2.4.1: 初始化常务委员会
function initCommittee() {
  if (!gameState.playerFaction) {
    gameState.playerFaction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
  }
  gameState.committee = generateCommittee(gameState.playerFaction);
  // 常务委员会主导派系即为本地主导派系
  gameState.mapFaction = getCommitteeDominantFaction(gameState.committee) || gameState.playerFaction;
  if (gameState.committeeUnity === undefined) gameState.committeeUnity = 50;
  logEvent(`常务委员会班子组建完成，主导派系为${FACTIONS[gameState.mapFaction].name}`, 'info');
}

// v2.4.1: 晋升时重组常务委员会
function resetCommitteeOnPromotion() {
  gameState.committee = null;
  initCommittee();
}

// 晋升/平调后重置人事系统：清空任命，换一批新干部
// v2.2.4b: 带走嫡系下属 + 秘书可推荐为原地区一把手
function resetPersonnelOnPromotion() {
  if (!gameState.personnel) { initPersonnelSystem(); return; }
  const ps = gameState.personnel;
  const oldAppointments = ps.appointments;
  const oldOfficials = ps.officials;
  // v2.2.4b: 玩家可带走1-2名嫡系下属（recruited=true）
  const recruitedSubs = oldOfficials.filter(o => o.recruited && !Object.values(oldAppointments).includes(o.id));
  // 自动带走最多2名能力最高的嫡系
  recruitedSubs.sort((a, b) => getEffectiveCompetence(b) - getEffectiveCompetence(a));
  const broughtSubs = recruitedSubs.slice(0, 2);
  // 保留被任命的干部（跟随调动）
  const appointedIds = Object.values(oldAppointments);
  const retainedAppointed = oldOfficials.filter(o => appointedIds.includes(o.id));
  // v2.2.4b: 秘书推荐为原地区一把手
  let secretaryPromoted = false;
  let secretaryName = '';
  if (ps.secretary) {
    const sec = oldOfficials.find(o => o.id === ps.secretary);
    if (sec) {
      secretaryName = sec.name;
      // 成功概率取决于本地主导派系是否与玩家派系一致
      let successRate = 0.4; // 基础40%
      if (gameState.mapFaction === gameState.playerFaction) successRate = 0.7; // 同派系70%
      else successRate = 0.25; // 不同派系25%
      // 秘书能力和忠诚也影响
      successRate += (getEffectiveCompetence(sec) - 5) * 0.05;
      successRate += (getEffectiveLoyalty(sec) - 5) * 0.03;
      successRate = Math.max(0.1, Math.min(0.9, successRate));
      if (Math.random() < successRate) {
        secretaryPromoted = true;
        const mfName = gameState.mapFaction ? FACTIONS[gameState.mapFaction].name : '本地';
        const pfName = gameState.playerFaction ? FACTIONS[gameState.playerFaction].name : '上级';
        logEvent(`秘书${sec.name}被推荐为原${gameState.cityName}一把手，成功就任！`, 'success');
        showNotification(`秘书${sec.name}成功就任原地区一把手`, 'success');
      } else {
        logEvent(`秘书${sec.name}推荐为原地区一把手未获通过`, 'warn');
        showNotification(`秘书${sec.name}推荐未获通过，已随调`, 'info');
        // 未通过的秘书随调，保留为秘书
        broughtSubs.push(sec);
      }
    }
  }
  // 合并保留的干部
  const retained = [...retainedAppointed, ...broughtSubs];
  // 去重
  const retainedIds = new Set(retained.map(o => o.id));
  // v2.2.4b: 新招录的干部有派系（模拟调动后的本地干部）
  const newPool = generateOfficialPool(Math.max(15 - retained.length, 10), { faction: 'random' });
  for (const off of newPool) {
    off.faction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
  }
  ps.officials = [...retained, ...newPool];
  ps.appointments = {};
  // 如果秘书被提拔为一把手，清空秘书职位；否则保留
  if (secretaryPromoted) {
    ps.secretary = null;
  }
  showNotification(`人事系统已更新：带走${broughtSubs.length}名嫡系下属${secretaryPromoted ? '，秘书已就任原地区一把手' : ''}`, 'info');
  logEvent(`晋升调动：带走${broughtSubs.length}名嫡系下属，储备池已换新${secretaryPromoted ? '，秘书推荐成功' : ''}`, 'info');
  // v2.4.1: 晋升时重组常务委员会
  resetCommitteeOnPromotion();
}

// v2.2.4b: 获取随调下属列表（供 UI 显示）
function getBroughtSubordinates() {
  if (!gameState.personnel) return [];
  return gameState.personnel.officials.filter(o => o.recruited);
}

// 干部领导评价语言生成（不直接显示数值）
function getOfficialEvaluation(off) {
  const parts = [];
  // 能力评价
  if (off.competence >= 7) parts.push('能力突出');
  else if (off.competence >= 6) parts.push('能力是有的');
  else if (off.competence >= 5) parts.push('工作能力尚可');
  else parts.push('能力一般');

  // 忠诚度评价
  if (off.loyalty >= 6) parts.push('忠诚可靠');
  else if (off.loyalty >= 5) parts.push('服从安排');
  else if (off.loyalty >= 4) parts.push('有些自己的想法');
  else parts.push('不太听话');

  // 贪腐倾向评价
  if (off.corruptionTendency <= 1) parts.push('为人清廉');
  else if (off.corruptionTendency <= 2) parts.push('作风正派');
  else if (off.corruptionTendency <= 3) parts.push('偶有小毛病');
  else if (off.corruptionTendency <= 4) parts.push('不够检点');
  else parts.push('手脚不干净');

  // 组合成领导口吻
  const abilityPart = parts[0];
  const loyaltyPart = parts[1];
  const corruptionPart = parts[2];
  // 随机选一种句式
  const patterns = [
    `${abilityPart}，${loyaltyPart}，${corruptionPart}`,
    `${abilityPart}，${corruptionPart}，${loyaltyPart}`,
    `该同志${abilityPart}，${loyaltyPart}，但${corruptionPart}`,
    `${abilityPart}，${loyaltyPart}，就是${corruptionPart}`,
  ];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

function renderPersonnelTab() {
  if (gameState.cityLevelId < 1) {
    return `<div class="stats-section"><h3>人事管理</h3><div style="text-align:center;padding:24px;color:var(--text-3);"><p style="font-size:14px;margin-bottom:8px;">人事系统尚未解锁</p><p style="font-size:12px;">晋升至县城后解锁人事管理功能</p></div></div>`;
  }
  initPersonnelSystem();
  // v2.4.1: 确保常务委员会已初始化
  if (!gameState.committee) initCommittee();
  const ps = gameState.personnel;
  const sum = gameState.personnelSummary;
  let html = '';
  html += `<div class="stats-section"><h3>人事管理</h3>`;

  // v2.4.1: 派系信息栏 + 常务委员会
  if (gameState.playerFaction && gameState.mapFaction) {
    const pf = FACTIONS[gameState.playerFaction];
    const mf = FACTIONS[gameState.mapFaction];
    const sameFaction = gameState.playerFaction === gameState.mapFaction;
    const unity = gameState.committeeUnity || 50;
    const unityStr = unity >= 75 ? '团结融洽' : unity >= 50 ? '基本团结' : unity >= 30 ? '存在分歧' : '矛盾突出';
    const unityColor = unity >= 75 ? 'var(--green)' : unity >= 50 ? 'var(--text-2)' : unity >= 30 ? 'var(--yellow)' : 'var(--red)';
    html += `<div style="display:flex;gap:6px;margin-bottom:10px;padding:8px;background:var(--separator-light);border-radius:var(--radius-xs);font-size:11px;">`;
    html += `<div style="flex:1;display:flex;align-items:center;gap:4px;"><span class="prs-faction-tag" style="background:${pf.color};">你的派系 ${pf.name}</span></div>`;
    html += `<div style="flex:1;display:flex;align-items:center;gap:4px;"><span class="prs-faction-tag" style="background:${mf.color};">常委主导派系 ${mf.name}</span></div>`;
    html += `<div style="flex:1;display:flex;align-items:center;gap:4px;color:${unityColor};font-size:10px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>班子团结·${unityStr}</div>`;
    html += `</div>`;
  }

  // v2.4.1: 常务委员会折叠面板
  if (gameState.committee && gameState.committee.length > 0) {
    const cm = gameState.committee;
    const unity = gameState.committeeUnity || 50;
    const unityStr = unity >= 75 ? '团结融洽' : unity >= 50 ? '基本团结' : unity >= 30 ? '存在分歧' : '矛盾突出';
    const unityColor = unity >= 75 ? 'var(--green)' : unity >= 50 ? 'var(--text-2)' : unity >= 30 ? 'var(--yellow)' : 'var(--red)';
    // 折叠头
    html += `<div onclick="toggleCommitteePanel()" id="cm-header" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--separator-light);border-radius:var(--radius-xs);cursor:pointer;margin-bottom:4px;border:1px solid var(--separator);">`;
    html += `<div style="display:flex;align-items:center;gap:8px;">`;
    html += `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    html += `<span style="font-size:13px;font-weight:600;color:var(--text);">常务委员会</span>`;
    html += `<span style="font-size:11px;color:${unityColor};">班子团结：${unityStr}</span>`;
    html += `</div>`;
    html += `<svg id="cm-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>`;
    html += `</div>`;
    // 折叠内容（默认收起）
    html += `<div id="cm-panel" style="display:none;margin-bottom:10px;">`;
    for (const member of cm) {
      if (member.isVacant) {
        html += `<div style="background:var(--separator-light);border:1px dashed var(--text-3);border-radius:var(--radius-xs);padding:10px;margin-bottom:8px;opacity:0.7;">`;
        html += `<div style="display:flex;align-items:center;gap:6px;">`;
        html += `<span style="font-size:12px;font-weight:600;color:var(--text-3);min-width:70px;">${member.roleName}</span>`;
        html += `<span style="font-size:13px;color:var(--text-3);font-style:italic;">空缺（由书记兼任）</span>`;
        html += `<span style="font-size:11px;color:var(--yellow);">等待补充新任</span>`;
        html += `</div></div>`;
        continue;
      }
      const fdef = member.faction ? FACTIONS[member.faction] : null;
      const cardColor = member.isPlayer ? 'var(--accent)' : member.recruited ? 'var(--green)' : fdef ? fdef.color : 'var(--separator)';
      const factionTag = fdef
        ? `<span class="prs-faction-tag" style="background:${fdef.color};">${fdef.name}</span>`
        : '<span class="prs-faction-tag" style="background:var(--separator);color:var(--text-3);">无派系</span>';
      const recruitedTag = member.recruited && !member.isPlayer ? '<span style="font-size:10px;color:var(--green);">★嫡系</span>' : '';
      html += `<div ${member.isPlayer ? '' : `onclick="showCommitteeMemberDetail('${member.id}')"`} style="background:var(--bg-card);border:1px solid var(--separator);border-left:3px solid ${cardColor};border-radius:var(--radius-xs);padding:10px;margin-bottom:8px;${member.isPlayer ? '' : 'cursor:pointer;'}box-shadow:var(--shadow-xs);">`;
      html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">`;
      html += `<span style="font-size:12px;font-weight:600;color:var(--accent);min-width:70px;">${member.roleName}</span>`;
      html += `${factionTag}${recruitedTag}`;
      html += `<span style="font-size:14px;font-weight:600;color:var(--text);">${member.name}</span>`;
      html += `</div>`;
      if (!member.isPlayer) {
        html += `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-3);">`;
        html += `<span>${member.age}岁 · ${getOfficialEvaluation(member)}</span>`;
        html += `</div>`;
      } else {
        const tenureStr = (member.tenureMonths || 0) > 0 ? `任期${Math.floor((member.tenureMonths || 0) / 12)}年${(member.tenureMonths || 0) % 12}月` : '新任';
        html += `<div style="font-size:12px;color:var(--text-3);">${tenureStr}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  // 效果摘要
  if (sum) {
    const vCls = (v) => v > 0 ? 'prs-val-pos' : v < 0 ? 'prs-val-neg' : 'prs-val-zero';
    const fmt = (v) => v > 0 ? '+' + v : '' + v;
    html += `<div class="prs-summary">`;
    html += `<div class="prs-summary-item"><span class="prs-summary-val ${vCls(sum.happiness)}">${fmt(sum.happiness)}</span><span class="prs-summary-label">幸福</span></div>`;
    html += `<div class="prs-summary-item"><span class="prs-summary-val ${vCls(sum.tax)}">${fmt(sum.tax)}</span><span class="prs-summary-label">税收</span></div>`;
    html += `<div class="prs-summary-item"><span class="prs-summary-val ${vCls(sum.safety)}">${fmt(sum.safety)}</span><span class="prs-summary-label">安全</span></div>`;
    html += `<div class="prs-summary-item"><span class="prs-summary-val ${vCls(sum.edu)}">${fmt(sum.edu)}</span><span class="prs-summary-label">教育</span></div>`;
    html += `<div class="prs-summary-item"><span class="prs-summary-val ${vCls(sum.health)}">${fmt(sum.health)}</span><span class="prs-summary-label">医疗</span></div>`;
    html += `<div class="prs-summary-item"><span class="prs-summary-val ${vCls(sum.gdp)}">${fmt(sum.gdp)}</span><span class="prs-summary-label">GDP</span></div>`;
    html += `<div class="prs-summary-item"><span class="prs-summary-val ${vCls(-sum.corruption)}">${fmt(sum.corruption)}</span><span class="prs-summary-label">腐败</span></div>`;
    html += `</div>`;
  }

  // 派系分布 + 任命率
  const factionCounts = {};
  let factionlessCount = 0;
  for (const bId of Object.keys(ps.appointments)) {
    const off = ps.officials.find(o => o.id === ps.appointments[bId]);
    if (off) {
      if (off.faction) factionCounts[off.faction] = (factionCounts[off.faction] || 0) + 1;
      else factionlessCount++;
    }
  }
  const filled = Object.keys(ps.appointments).length;
  html += `<div class="prs-faction-bar">`;
  for (const fk of VISIBLE_FACTION_KEYS) {
    const fdef = FACTIONS[fk];
    const cnt = factionCounts[fk] || 0;
    html += `<div class="prs-faction-chip" style="background:${fdef.color}22;border:1px solid ${fdef.color}55;color:${fdef.color};">${fdef.name} ${cnt}</div>`;
  }
  if (factionlessCount > 0) {
    html += `<div class="prs-faction-chip" style="background:var(--separator);color:var(--text-2);">无派系 ${factionlessCount}</div>`;
  }
  html += `<div class="prs-faction-chip" style="background:var(--separator);color:var(--text-2);">已任 ${filled}/${BUREAUS.length}</div>`;
  html += `</div>`;

  // 局级单位列表
  html += `<div class="prs-section-title">局级单位 <span class="prs-section-count">${filled}/${BUREAUS.length}</span></div>`;
  for (const b of BUREAUS) {
    const appointedId = ps.appointments[b.id];
    const off = appointedId ? ps.officials.find(o => o.id === appointedId) : null;
    // v2.2.4b: 处理无派系干部
    const fdef = (off && off.faction) ? FACTIONS[off.faction] : null;
    html += `<div class="prs-bureau">`;
    html += `<div class="prs-bureau-left">`;
    html += `<span class="prs-bureau-name">${b.name}</span>`;
    if (off) {
      const effStr = off.competence >= 7 ? '能力突出' : off.competence >= 6 ? '堪当重任' : off.competence >= 5 ? '中规中矩' : '尚需历练';
      const recruitedTag = off.recruited ? ' ★' : '';
      html += `<span class="prs-bureau-desc">${off.name}${recruitedTag} · ${effStr}</span>`;
    } else {
      html += `<span class="prs-bureau-desc">${b.desc}</span>`;
    }
    html += `</div>`;
    if (off) {
      html += `<div class="prs-bureau-info">`;
      if (fdef) {
        html += `<span class="prs-faction-tag" style="background:${fdef.color};">${fdef.name}</span>`;
      } else {
        html += `<span class="prs-faction-tag" style="background:var(--separator);color:var(--text-3);">无派系</span>`;
      }
      html += `<span class="prs-official-stats">${getOfficialEvaluation(off)}</span>`;
      html += `</div>`;
      html += `<button class="prs-btn prs-btn-dismiss" onclick="dismissOfficial('${b.id}')">免职</button>`;
    } else {
      html += `<div class="prs-bureau-info"><span class="prs-empty">空缺</span></div>`;
      html += `<button class="prs-btn prs-btn-appoint" onclick="showAppointDialog('${b.id}')">任命</button>`;
    }
    html += `</div>`;
  }

  // 待任用干部
  // v2.3.7: 改为企业列表样式，可点击进入详情页
  const available = ps.officials.filter(o => !Object.values(ps.appointments).includes(o.id));
  html += `<div class="prs-section-title">待任用干部 <span class="prs-section-count">${available.length}人</span></div>`;
  if (available.length === 0) {
    html += `<div class="prs-empty" style="padding:8px;">暂无可用干部</div>`;
  } else {
    for (const off of available) {
      // v2.2.4b: 无派系干部显示"无派系"标签
      const fdef = off.faction ? FACTIONS[off.faction] : null;
      const factionTag = fdef
        ? `<span class="prs-faction-tag" style="background:${fdef.color};">${fdef.name}</span>`
        : `<span class="prs-faction-tag" style="background:var(--separator);color:var(--text-3);">无派系</span>`;
      const recruitedTag = off.recruited ? '<span style="font-size:10px;color:var(--green);">★嫡系</span>' : '';
      const tenureStr = off.tenureMonths ? `${off.tenureMonths}月` : '新';
      // v2.3.7: 使用企业卡片样式
      const cardColor = off.recruited ? 'var(--green)' : fdef ? fdef.color : 'var(--separator)';
      html += `<div onclick="showOfficialDetailModal('${off.id}')" style="background:var(--bg-card);border:1px solid var(--separator);border-left:3px solid ${cardColor};border-radius:var(--radius-xs);padding:10px;margin-bottom:8px;cursor:pointer;box-shadow:var(--shadow-xs);">`;
      html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">`;
      html += `${factionTag}${recruitedTag}`;
      html += `<span style="font-size:14px;font-weight:600;color:var(--text);">${off.name}</span>`;
      html += `</div>`;
      html += `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-3);">`;
      html += `<span>${off.age}岁 · ${tenureStr} · ${getOfficialEvaluation(off)}</span>`;
      html += `</div>`;
      html += `</div>`;
    }
  }

  // v2.3.2: 移除干部来源介绍标签
  html += `</div>`;
  return html;
}

// v2.2.4b: 秘书任命/免职/对话框已移至个人事务面板（fab-sheet.js）

function showAppointDialog(bureauId) {
  const ps = gameState.personnel;
  if (!ps) return;
  const b = BUREAUS.find(x => x.id === bureauId);
  const available = ps.officials.filter(o => !Object.values(ps.appointments).includes(o.id));
  let html = `<div style="font-size:14px;font-weight:600;margin-bottom:8px;">任命${b.name}负责人</div>`;
  html += `<div style="font-size:12px;color:var(--text-3);margin-bottom:8px;">${b.desc}</div>`;
  if (available.length === 0) {
    html += '<div class="prs-empty" style="padding:8px;">暂无可用干部</div>';
  } else {
    for (const off of available) {
      // v2.2.4b: 无派系干部显示"无派系"标签
      const fdef = off.faction ? FACTIONS[off.faction] : null;
      const factionTag = fdef
        ? `<span class="prs-faction-tag" style="background:${fdef.color};">${fdef.name}</span>`
        : '<span class="prs-faction-tag" style="background:var(--separator);color:var(--text-3);">无派系</span>';
      const recruitedTag = off.recruited ? '<span style="font-size:10px;color:var(--green);">★嫡系</span>' : '';
      // v2.3.7b: 固定按钮位置，左侧文字flex:1+min-width:0防止挤压按钮换行
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--separator-light);">`;
      html += `<div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">`;
      html += `${factionTag}${recruitedTag}`;
      html += `<span style="font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;">${off.name}</span>`;
      html += `<span style="font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${off.age}岁 ${getOfficialEvaluation(off)}</span>`;
      html += `</div>`;
      html += `<div style="flex-shrink:0;"><button class="prs-btn prs-btn-appoint" onclick="appointOfficial('${bureauId}','${off.id}')">任命</button></div>`;
      html += `</div>`;
    }
  }
  showModal('任命局长', html, [{ text: '关闭', color: 'gray', action: closeModal }], '人事', 'info');
}

// v2.4.1: 常务委员会投票计算任免通过率
function _calcCommitteeApproval(off, isDismiss) {
  if (!gameState.committee || !gameState.playerFaction) return { pass: true, reason: '' };
  const unity = gameState.committeeUnity || 50;
  const pf = gameState.playerFaction;
  // 统计同派系成员数（不含玩家）
  const sameFactionCount = gameState.committee.filter(m => !m.isPlayer && m.faction === pf).length;
  const totalNonPlayer = gameState.committee.filter(m => !m.isPlayer).length;
  // 基础通过率 = 团结度 * 0.6 + 同派系占比 * 0.4
  let baseRate = (unity / 100) * 0.6 + (sameFactionCount / totalNonPlayer) * 0.4;
  // 被任免干部的派系影响
  if (off.faction === pf || off.recruited) {
    baseRate += 0.1; // 同派系加成
  } else if (off.faction && off.faction !== pf) {
    baseRate -= 0.15; // 不同派系减成
  }
  // 免职比任命略难通过
  if (isDismiss) baseRate -= 0.05;
  // 玩家高腐败降低通过率（其他常委不信任）
  if ((gameState.corruption || 0) > 50) baseRate -= 0.1;
  baseRate = Math.max(0.1, Math.min(0.95, baseRate));
  const pass = Math.random() < baseRate;
  let reason = '';
  if (!pass) {
    if (unity < 30) reason = '班子团结程度较低，内部意见难以统一';
    else if (sameFactionCount < totalNonPlayer / 2) reason = '常委中其他派系占多数，对此项动议持保留意见';
    else if (off.faction && off.faction !== pf) reason = '该同志所属派系与班子主流意见存在分歧';
    else reason = '经班子讨论，认为此时不宜进行此项人事调整';
  }
  return { pass, reason };
}

function appointOfficial(bureauId, officialId) {
  const ps = gameState.personnel;
  if (!ps) return;
  const off = ps.officials.find(o => o.id === officialId);
  const b = BUREAUS.find(x => x.id === bureauId);
  if (!off || !b) { closeModal(); return; }
  // v2.4.1: 常务委员会投票决定任免
  const vote = _calcCommitteeApproval(off, false);
  if (!vote.pass) {
    closeModal();
    showNotification(`常务委员会未通过：${off.name}拟任${b.name}局长未能获得班子多数支持`, 'warn');
    logEvent(`人事任命未通过常务委员会审议：${off.name}拟任${b.name}局长，${vote.reason}`, 'warn');
    // v2.4.1a: 添加强制排板选项
    showModal('常务委员会审议未通过', `<div style="font-size:14px;line-height:1.8;">
      <p>拟任命<strong>${off.name}</strong>为${b.name}局长，经常务委员会讨论未能通过。</p>
      <p style="margin-top:8px;color:var(--text-2);">原因：${vote.reason}</p>
      <p style="margin-top:8px;color:var(--text-3);font-size:12px;">你可以选择等待时机凝聚共识，或以书记身份强制排板通过此项任命，但将承担相应后果。</p>
    </div>`, [
      { text: '强制排板任命', color: 'red', action: () => { closeModal(); _forceAppointOfficial(bureauId, officialId, vote.reason); } },
      { text: '暂不任命', color: 'gray', action: closeModal },
    ], '人事', 'warn');
    if (typeof updateUI === 'function') updateUI();
    if (currentTab === 'gov') renderSheet('gov');
    return;
  }
  // 任命与玩家同派系的干部，增加纪委关注度
  if (gameState.playerFaction && off.faction && off.faction === gameState.playerFaction) {
    gameState.inspectionRisk = (gameState.inspectionRisk || 0) + 1;
    logEvent(`人事任命：${off.name}任${b.name}局长（${FACTIONS[off.faction].name}，与主官同派系，纪委关注度上升）`, 'info');
  } else if (off.faction) {
    logEvent(`人事任命：${off.name}任${b.name}局长（${FACTIONS[off.faction].name}）`, 'info');
  } else {
    logEvent(`人事任命：${off.name}任${b.name}局长（无派系）`, 'info');
  }
  ps.appointments[bureauId] = officialId;
  closeModal();
  showNotification(`经常务委员会审议通过，已任命${off.name}为${b.name}局长`, 'success');
  // v2.4.0: 安全渲染，避免巡视锁定时渲染gov出错
  if (typeof updateUI === 'function') updateUI();
  if (currentTab === 'gov') renderSheet('gov');
}

// v2.4.1a: 强制排板任命 — 绕过常务委员会，承担后果
function _forceAppointOfficial(bureauId, officialId, reason) {
  const ps = gameState.personnel;
  if (!ps) return;
  const off = ps.officials.find(o => o.id === officialId);
  const b = BUREAUS.find(x => x.id === bureauId);
  if (!off || !b) return;
  // 强制排板后果：纪委风险大增、班子团结度下降、声誉下降
  gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 15, 0, 100);
  gameState.committeeUnity = clamp((gameState.committeeUnity || 50) - 15, 0, 100);
  gameState.reputation = clamp((gameState.reputation || 50) - 10, 0, 100);
  // 提级巡视概率临时增加（设一个临时标记）
  gameState._forceAppointCount = (gameState._forceAppointCount || 0) + 1;
  // v2.4.1a: 成就统计
  if (gameState.achievementStats) gameState.achievementStats.forceAppointCount = gameState._forceAppointCount;
  // 执行任命
  ps.appointments[bureauId] = officialId;
  logEvent(`强制排板任命：${off.name}任${b.name}局长（绕过常务委员会，原因：${reason}），纪委风险上升、班子团结度下降、声誉下降`, 'danger');
  showNotification(`已强制排板任命${off.name}为${b.name}局长，但纪委关注度大幅上升，班子团结度下降，声誉受损`, 'warn');
  if (typeof updateUI === 'function') updateUI();
  if (currentTab === 'gov') renderSheet('gov');
}

function dismissOfficial(bureauId) {
  const ps = gameState.personnel;
  if (!ps) return;
  const off = ps.officials.find(o => o.id === ps.appointments[bureauId]);
  const b = BUREAUS.find(x => x.id === bureauId);
  // v2.4.1: 免职也需常务委员会投票
  if (off) {
    const vote = _calcCommitteeApproval(off, true);
    if (!vote.pass) {
      showNotification(`常务委员会未通过：免去${off.name}职务的动议未获班子多数支持`, 'warn');
      logEvent(`免职未通过常务委员会审议：${off.name}（${b.name}局长），${vote.reason}`, 'warn');
      if (typeof updateUI === 'function') updateUI();
      if (currentTab === 'gov') renderSheet('gov');
      return;
    }
  }
  delete ps.appointments[bureauId];
  if (off) {
    showNotification(`经常务委员会审议通过，已免去${off.name}的${b.name}局长职务`, 'info');
    logEvent(`人事免职：免去${off.name}的${b.name}局长职务`, 'info');
  }
  // v2.4.0: 安全渲染
  if (typeof updateUI === 'function') updateUI();
  if (currentTab === 'gov') renderSheet('gov');
}

// v2.3.7b: 生成履历（随机但符合提拔逻辑，正序：旧→新）
// 不展示具体数值，用官样文字描述
function _generateCareerHistory(off) {
  if (off._careerHistory) return off._careerHistory;
  const entries = [];
  // v2.4.1a: 常委成员的履历以常委职务为主线
  if (off.isCommittee && off.roleName) {
    const committeePositions = [
      { title: '乡镇基层工作', desc: '从基层做起，积累了丰富的群众工作经验' },
      { title: '县级机关副科级干部', desc: '在县级机关锻炼，文字功底扎实，协调能力较强' },
      { title: '区直部门副职', desc: '推动多个重点项目落地，基层治理经验丰富' },
      { title: '市直部门副职', desc: '在市级机关工作，宏观统筹能力得到提升' },
    ];
    const numEntries = Math.min(committeePositions.length, Math.max(2, Math.floor((off.age - 30) / 5)));
    for (let i = 0; i < numEntries; i++) {
      entries.push({
        era: ['早年', '此后', '随后', '后来'][i] || '此后',
        title: committeePositions[i].title,
        desc: committeePositions[i].desc,
      });
    }
    // 现任职务为常委职务
    const competenceDesc = off.competence >= 7 ? '该同志能力突出，在班子中发挥重要作用' : off.competence >= 5 ? '该同志工作扎实，业务能力较强' : '该同志尚需历练';
    entries.push({ era: '现任', title: off.roleName, desc: competenceDesc });
    off._careerHistory = entries;
    return entries;
  }
  const positions = [
    { title: '乡镇基层工作', desc: '从基层做起，积累了丰富的群众工作经验' },
    { title: '县级机关副科级干部', desc: '在县级机关锻炼，文字功底扎实，协调能力较强' },
    { title: '区直部门副职', desc: '推动多个重点项目落地，基层治理经验丰富' },
    { title: '市直部门副职', desc: '在市级机关工作，宏观统筹能力得到提升' },
    { title: '县纪委副书记', desc: '纪律严明，查办多起案件，政治素质过硬' },
    { title: '市财政局副局长', desc: '财政管理经验丰富，经济工作能力突出' },
    { title: '区政府副区长', desc: '分管经济工作，成效显著，群众基础好' },
  ];
  // 根据年龄决定履历条数（年龄越大履历越丰富）
  const numEntries = Math.min(positions.length, Math.max(3, Math.floor((off.age - 22) / 4)));
  for (let i = 0; i < numEntries; i++) {
    entries.push({
      era: ['早年', '此后', '随后', '后来', '此后', '其后', '近年以来'][i] || '此后',
      title: positions[i].title,
      desc: positions[i].desc,
    });
  }
  // 根据能力调整最新描述
  if (off.competence >= 7) {
    entries.push({ era: '现任', title: '储备干部', desc: '该同志能力突出，多次获评优秀干部，群众口碑良好' });
  } else if (off.competence >= 5) {
    entries.push({ era: '现任', title: '储备干部', desc: '该同志工作踏实，业务能力较强，有待进一步培养锻炼' });
  } else {
    entries.push({ era: '现任', title: '储备干部', desc: '该同志尚需历练，建议加强基层锻炼' });
  }
  off._careerHistory = entries;
  return entries;
}

// v2.4.1: 常务委员会折叠面板展开/收起
function toggleCommitteePanel() {
  const panel = document.getElementById('cm-panel');
  const arrow = document.getElementById('cm-arrow');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  } else {
    panel.style.display = 'none';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

// v2.4.1: 常务委员会成员详情弹窗
function showCommitteeMemberDetail(memberId) {
  if (!gameState.committee) return;
  const member = gameState.committee.find(m => m.id === memberId);
  if (!member) return;
  const fdef = member.faction ? FACTIONS[member.faction] : null;
  const cardColor = member.recruited ? 'var(--green)' : fdef ? fdef.color : 'var(--separator)';
  const history = _generateCareerHistory(member);

  let body = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">`;
  body += `<div style="width:36px;height:36px;border-radius:8px;background:${cardColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">`;
  body += `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  body += `</div>`;
  body += `<div><div style="font-size:16px;font-weight:600;">${member.name}${member.recruited ? ' ★嫡系' : ''}</div>`;
  body += `<div style="font-size:12px;color:var(--accent);font-weight:500;margin-top:2px;">${member.roleName}</div>`;
  body += `<div style="font-size:12px;color:var(--text-3);margin-top:2px;">${member.age}岁 · ${fdef ? fdef.name : '无派系'}</div>`;
  body += `<div style="font-size:12px;color:var(--text-2);margin-top:2px;">${getOfficialEvaluation(member)}</div>`;
  body += `</div></div>`;

  // 信息列表
  body += `<div class="effect-list">`;
  const competenceStr = member.competence >= 7 ? '能力突出' : member.competence >= 6 ? '堪当重任' : member.competence >= 5 ? '中规中矩' : '尚需历练';
  const loyaltyStr = member.loyalty >= 7 ? '忠心耿耿' : member.loyalty >= 5 ? '忠诚可靠' : member.loyalty >= 3 ? '一般' : '存有二心';
  body += `<div class="effect-item"><span class="eff-label">能力评价</span><span class="eff-val">${competenceStr}</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">忠诚评价</span><span class="eff-val">${loyaltyStr}</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">担任职务</span><span class="eff-val">${member.roleName}</span></div>`;
  if (fdef) {
    body += `<div class="effect-item"><span class="eff-label">所属派系</span><span class="eff-val">${fdef.name}</span></div>`;
  }
  body += `</div>`;

  // 履历
  body += `<div style="margin-top:12px;font-size:13px;font-weight:600;color:var(--text-2);">个人履历</div>`;
  body += `<div style="margin-top:6px;">`;
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const isLast = i === history.length - 1;
    body += `<div style="display:flex;gap:8px;padding:4px 0;${isLast ? '' : 'border-bottom:1px solid var(--separator-light);'}">`;
    body += `<div style="font-size:11px;color:var(--text-3);min-width:50px;flex-shrink:0;">${entry.era}</div>`;
    body += `<div style="flex:1;">`;
    body += `<div style="font-size:12px;font-weight:500;color:var(--text);">${entry.title}</div>`;
    body += `<div style="font-size:11px;color:var(--text-3);">${entry.desc}</div>`;
    body += `</div>`;
    body += `</div>`;
  }
  body += `</div>`;

  // 按钮数组
  const buttons = [];
  buttons.push({ text: '调查', color: 'orange', action: () => { closeModal(); investigateCommitteeMember(memberId); } });
  if (!member.recruited) {
    buttons.push({ text: '拉拢', color: 'blue', action: () => { closeModal(); courtCommitteeMember(memberId); } });
  }
  buttons.push({ text: '关闭', color: 'gray', action: closeModal });
  showModal(member.name, body, buttons, '常委详情', 'info');
}

// v2.4.1: 调查常务委员会成员
function investigateCommitteeMember(memberId) {
  if (!gameState.committee) return;
  const member = gameState.committee.find(m => m.id === memberId);
  if (!member) return;
  if (member.isPlayer) { showNotification('不能调查自己', 'warn'); return; }
  if (member._investigated) { showNotification('该常委已被调查过', 'warn'); return; }
  member._investigated = true;
  const hasProblem = member.corruptionTendency >= 4 ? (Math.random() < 0.7)
    : member.corruptionTendency >= 3 ? (Math.random() < 0.35)
    : (Math.random() < 0.1);
  const playerCorrupt = (gameState.corruption || 0) > 50;
  const reportedByTarget = playerCorrupt && Math.random() < 0.3;

  if (hasProblem) {
    const confiscated = Math.round(100 + Math.random() * 300);
    gameState.merit = Math.round((gameState.merit || 0) + 8);
    gameState.treasury += confiscated;
    // 从常务委员会移除该成员，进入空缺期
    const idx = gameState.committee.findIndex(m => m.id === memberId);
    if (idx >= 0) {
      const role = member.role;
      const roleName = member.roleName;
      // v2.4.1a: 常委被查后设为空缺期，职务由玩家临时担任（3个月）
      const vacantMember = {
        id: 'cm_vacant_' + role,
        name: '（空缺·由书记兼任）',
        role: role,
        roleName: roleName,
        faction: null,
        isPlayer: false,
        isVacant: true,
        vacantMonths: 3,
        competence: 3,
        loyalty: 0,
        corruptionTendency: 0,
        age: 0,
        recruited: false,
        tenureMonths: 0,
      };
      gameState.committee[idx] = vacantMember;
      logEvent(`常委${member.roleName}因违纪被查处，职务空缺，由书记临时兼任（待补充新任）`, 'info');
      showNotification(`${roleName}职务空缺，由你临时兼任，将在适当时机补充新任`, 'info');
    }
    // 更新主导派系
    gameState.mapFaction = getCommitteeDominantFaction(gameState.committee) || gameState.playerFaction;
    logEvent(`常务委员会成员${member.name}因严重违纪被查处，收缴赃款¥${confiscated}万，职务空缺由书记兼任`, 'success');
    showNotification(`调查成功：${member.name}存在严重违纪问题，收缴赃款¥${confiscated}万，政绩提升`, 'success');
    // v2.4.1a: 成就统计
    if (gameState.achievementStats) gameState.achievementStats.committeeMembersInvestigated = (gameState.achievementStats.committeeMembersInvestigated || 0) + 1;
    if (reportedByTarget) {
      _handlePlayerReported(member, 'investigation');
    }
  } else {
    gameState.merit = Math.max(0, (gameState.merit || 0) - 4);
    gameState.reputation = clamp((gameState.reputation || 0) - 10, 0, 100);
    member.loyalty = Math.max(1, (member.loyalty || 5) - 3);
    // 班子团结度下降
    gameState.committeeUnity = clamp((gameState.committeeUnity || 50) - 10, 0, 100);
    // 同派系成员忠诚度也下降
    if (member.faction) {
      for (const other of gameState.committee) {
        if (!other.isPlayer && other.faction === member.faction && other.id !== memberId) {
          other.loyalty = Math.max(1, (other.loyalty || 5) - 2);
        }
      }
    }
    logEvent(`调查${member.name}未发现问题，造成误判，政绩下降，声誉受损，班子团结度下降`, 'warn');
    showNotification(`调查未发现问题：${member.name}清白无误，误判导致政绩下降、声誉受损，班子团结度下降`, 'warn');
    if (reportedByTarget) {
      _handlePlayerReported(member, 'investigation');
    }
  }
  if (typeof updateUI === 'function') updateUI();
  if (currentTab === 'gov') renderSheet('gov');
}

// v2.4.1: 拉拢常务委员会成员
function courtCommitteeMember(memberId) {
  if (!gameState.committee || !gameState.playerFaction) return;
  const member = gameState.committee.find(m => m.id === memberId);
  if (!member || member.isPlayer) return;
  if (member.recruited) { showNotification('该常委已是你的嫡系', 'info'); return; }
  const cost = 30; // 常委拉拢成本更高
  if (gameState.privateAccount < cost) {
    showNotification(`拉拢常委需要¥${cost}万私人资金`, 'warn');
    return;
  }
  gameState.privateAccount -= cost;
  gameState.corruption = clamp((gameState.corruption || 0) + 3, 0, 100);
  gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 5, 0, 100);
  const pf = gameState.playerFaction;

  if (member.faction === pf) {
    // 同派系：提高忠诚度
    member.loyalty = Math.min(10, (member.loyalty || 5) + 2);
    gameState.committeeUnity = clamp((gameState.committeeUnity || 50) + 3, 0, 100);
    logEvent(`与${member.roleName}${member.name}加深关系，忠诚度提升，班子团结度上升`, 'info');
    showNotification(`拉拢成功：${member.name}忠诚度提升，班子团结度上升`, 'success');
  } else {
    // 不同派系：有概率进入你的派系
    if (Math.random() < 0.30) {
      const oldFaction = member.faction;
      member.faction = pf;
      member.recruited = true;
      member.loyalty = Math.min(10, (member.loyalty || 3) + 1);
      // 原派系成员忠诚度降低
      for (const other of gameState.committee) {
        if (!other.isPlayer && other.faction === oldFaction && other.id !== memberId) {
          other.loyalty = Math.max(1, (other.loyalty || 5) - 2);
        }
      }
      // 班子团结度可能下降（派系变动引发不稳定）
      gameState.committeeUnity = clamp((gameState.committeeUnity || 50) - 5, 0, 100);
      // 有概率是间谍
      member._isSpy = Math.random() < 0.25;
      // 更新主导派系
      gameState.mapFaction = getCommitteeDominantFaction(gameState.committee) || pf;
      logEvent(`成功拉拢${member.roleName}${member.name}从${FACTIONS[oldFaction].name}转入${FACTIONS[pf].name}`, 'success');
      showNotification(`拉拢成功：${member.name}已转入你的派系`, 'success');
      // v2.4.1a: 成就统计
      if (gameState.achievementStats) gameState.achievementStats.committeeMembersCourted = (gameState.achievementStats.committeeMembersCourted || 0) + 1;
      if (member._isSpy) {
        gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 8, 0, 100);
      }
    } else {
      logEvent(`拉拢${member.roleName}${member.name}未成功，对方不为所动`, 'warn');
      showNotification(`拉拢${member.name}未成功`, 'warn');
    }
  }
  if (typeof updateUI === 'function') updateUI();
  if (currentTab === 'gov') renderSheet('gov');
}

// v2.3.7b: 干部详情弹窗（与企业详情页样式统一）
function showOfficialDetailModal(officialId) {
  const ps = gameState.personnel;
  if (!ps) return;
  const off = ps.officials.find(o => o.id === officialId);
  if (!off) return;
  const fdef = off.faction ? FACTIONS[off.faction] : null;
  const cardColor = off.recruited ? 'var(--green)' : fdef ? fdef.color : 'var(--separator)';
  const history = _generateCareerHistory(off);

  // 弹窗body — 与企业详情弹窗统一风格
  let body = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">`;
  body += `<div style="width:36px;height:36px;border-radius:8px;background:${cardColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;">`;
  body += `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  body += `</div>`;
  body += `<div><div style="font-size:16px;font-weight:600;">${off.name}${off.recruited ? ' ★嫡系' : ''}</div>`;
  // v2.3.7b: 年龄和派系单独一行，评价另起一行，不展示具体数值
  body += `<div style="font-size:12px;color:var(--text-3);margin-top:2px;">${off.age}岁 · ${fdef ? fdef.name : '无派系'}</div>`;
  body += `<div style="font-size:12px;color:var(--text-2);margin-top:2px;">${getOfficialEvaluation(off)}</div>`;
  body += `</div></div>`;

  // 信息列表 — 不展示具体数值，用文字描述
  body += `<div class="effect-list">`;
  const competenceStr = off.competence >= 7 ? '能力突出' : off.competence >= 6 ? '堪当重任' : off.competence >= 5 ? '中规中矩' : '尚需历练';
  const loyaltyStr = off.loyalty >= 7 ? '忠心耿耿' : off.loyalty >= 5 ? '忠诚可靠' : off.loyalty >= 3 ? '一般' : '存有二心';
  body += `<div class="effect-item"><span class="eff-label">能力评价</span><span class="eff-val">${competenceStr}</span></div>`;
  body += `<div class="effect-item"><span class="eff-label">忠诚评价</span><span class="eff-val">${loyaltyStr}</span></div>`;
  if (fdef) {
    body += `<div class="effect-item"><span class="eff-label">所属派系</span><span class="eff-val">${fdef.name}</span></div>`;
  }
  body += `</div>`;

  // 履历 — 正序展示（旧→新），用官样文字，不展示数值
  body += `<div style="margin-top:12px;font-size:13px;font-weight:600;color:var(--text-2);">个人履历</div>`;
  body += `<div style="margin-top:6px;">`;
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const isLast = i === history.length - 1;
    body += `<div style="display:flex;gap:8px;padding:4px 0;${isLast ? '' : 'border-bottom:1px solid var(--separator-light);'}">`;
    body += `<div style="font-size:11px;color:var(--text-3);min-width:50px;flex-shrink:0;">${entry.era}</div>`;
    body += `<div style="flex:1;">`;
    body += `<div style="font-size:12px;font-weight:500;color:var(--text);">${entry.title}</div>`;
    body += `<div style="font-size:11px;color:var(--text-3);">${entry.desc}</div>`;
    body += `</div>`;
    body += `</div>`;
  }
  body += `</div>`;

  // 按钮数组
  const buttons = [];
  // 调查按钮
  buttons.push({ text: '调查', color: 'orange', action: () => { closeModal(); investigateOfficial(officialId); } });
  // 拉拢按钮（如果还不是嫡系）
  if (!off.recruited) {
    buttons.push({ text: '拉拢', color: 'blue', action: () => { closeModal(); courtOfficial(officialId); } });
  }
  buttons.push({ text: '关闭', color: 'gray', action: closeModal });
  showModal(off.name, body, buttons, '干部详情', 'info');
}

// v2.3.7: 调查干部
function investigateOfficial(officialId) {
  const ps = gameState.personnel;
  if (!ps) return;
  const off = ps.officials.find(o => o.id === officialId);
  if (!off) return;
  if (off._investigated) {
    showNotification('该干部已被调查过', 'warn');
    return;
  }
  off._investigated = true;
  // 贪腐倾向高的干部有问题概率高
  const hasProblem = off.corruptionTendency >= 4 ? (Math.random() < 0.7)
    : off.corruptionTendency >= 3 ? (Math.random() < 0.35)
    : (Math.random() < 0.1);

  // 玩家自身腐败过高时，被调查对象有概率举报玩家
  const playerCorrupt = (gameState.corruption || 0) > 50;
  const reportedByTarget = playerCorrupt && Math.random() < 0.3;

  if (hasProblem) {
    // 查出问题：玩家加政绩，财政获得赃款
    const confiscated = Math.round(50 + Math.random() * 200);
    gameState.merit = Math.round((gameState.merit || 0) + 5);
    gameState.treasury += confiscated;
    // 免去该干部职务
    for (const bId of Object.keys(ps.appointments)) {
      if (ps.appointments[bId] === officialId) delete ps.appointments[bId];
    }
    // v2.3.7b: 如果被调查的是秘书，清除秘书职位
    if (ps.secretary === officialId) ps.secretary = null;
    // v2.3.7b: 如果被调查的是代持人，清除代持关系
    if (gameState.personalCompanies) {
      for (const pc of gameState.personalCompanies) {
        if (pc.heldBy === officialId) pc.heldBy = null;
      }
    }
    ps.officials = ps.officials.filter(o => o.id !== officialId);
    logEvent(`调查发现${off.name}存在严重违纪问题，收缴赃款¥${confiscated}万`, 'success');
    showNotification(`调查成功：${off.name}存在违纪问题，收缴赃款¥${confiscated}万，政绩+5`, 'success');
    if (reportedByTarget) {
      _handlePlayerReported(off, 'investigation');
    }
  } else {
    // 没问题：玩家掉政绩+声誉降低，该人物及派系忠诚度下降
    gameState.merit = Math.max(0, (gameState.merit || 0) - 3);
    gameState.reputation = clamp((gameState.reputation || 0) - 8, 0, 100);
    off.loyalty = Math.max(1, (off.loyalty || 5) - 2);
    // 同派系干部忠诚度也下降
    if (off.faction) {
      for (const other of ps.officials) {
        if (other.faction === off.faction) {
          other.loyalty = Math.max(1, (other.loyalty || 5) - 1);
        }
      }
    }
    logEvent(`调查${off.name}未发现问题，造成误判，政绩-3，声誉-8`, 'warn');
    showNotification(`调查未发现问题：${off.name}清白无误，误判导致政绩-3、声誉-8`, 'warn');
    if (reportedByTarget) {
      _handlePlayerReported(off, 'investigation');
    }
  }
  // v2.4.0: 安全渲染
  if (typeof updateUI === 'function') updateUI();
  if (currentTab === 'gov') renderSheet('gov');
}

// v2.3.7: 玩家被举报处理
function _handlePlayerReported(reporter, source) {
  gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 20, 0, 100);
  logEvent(`${reporter.name}在调查中举报了你的违纪行为！纪委风险+20`, 'danger');
  showNotification(`${reporter.name}举报了你的违纪行为！`, 'danger');
  // 有概率直接处分/免职/降职
  const roll = Math.random();
  if (roll < 0.15) {
    // 直接处分（党内警告）
    if (typeof applyPromotionBan === 'function') applyPromotionBan(12);
    gameState.merit = Math.max(0, (gameState.merit || 0) - 10);
    gameState.reputation = clamp((gameState.reputation || 0) - 15, 0, 100);
    showNotification('纪委对你给予党内警告处分，1年内不得提拔', 'danger');
    logEvent('因被举报，纪委给予党内警告处分', 'danger');
  } else if (roll < 0.25) {
    // 降职
    if (gameState.cityLevelId > 0) {
      gameState.cityLevelId--;
      // v2.4.1d: 降职时必须清除兼职状态（各地图等级通用）
      gameState.deputyPosition = null;
      const prevLv = CITY_LEVELS[gameState.cityLevelId];
      showNotification(`因被举报，被降职为${prevLv.title}，兼职职务一并免除`, 'danger');
      logEvent(`因被举报，降职为${prevLv.title}，兼任副职一并免除`, 'danger');
    }
  } else {
    // v2.4.1d: 未降职但有兼职时，检查兼职是否仍有效（兼职等级不能高于当前等级+1）
    if (gameState.deputyPosition !== null && gameState.deputyPosition > gameState.cityLevelId + 1) {
      gameState.deputyPosition = null;
      logEvent('因被举报审查，兼职职务被免除（等级不匹配）', 'warn');
    }
  }
  // v2.4.0: 修复缺少UI更新的bug
  if (typeof updateUI === 'function') updateUI();
  if (typeof renderSheet === 'function') renderSheet('gov');
}

// v2.3.7: 拉拢干部（从详情页）
function courtOfficial(officialId) {
  const ps = gameState.personnel;
  if (!ps || !gameState.playerFaction) {
    showNotification('无法拉拢：尚未确定你的派系', 'warn');
    return;
  }
  const off = ps.officials.find(o => o.id === officialId);
  if (!off) return;
  if (off.recruited) {
    showNotification('该干部已是你的嫡系', 'info');
    return;
  }
  const cost = 20;
  if (gameState.privateAccount < cost) {
    showNotification(`拉拢需要¥${cost}万私人资金`, 'warn');
    return;
  }
  gameState.privateAccount -= cost;
  gameState.corruption = clamp((gameState.corruption || 0) + 2, 0, 100);
  gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 3, 0, 100);

  const pf = gameState.playerFaction;
  if (!off.faction) {
    // 无派系：最高成功率
    if (Math.random() < 0.75) {
      off.faction = pf;
      off.recruited = true;
      off.loyalty = Math.min(10, (off.loyalty || 3) + 2);
      logEvent(`拉拢${off.name}成功，加入${FACTIONS[pf].name}成为嫡系`, 'success');
      showNotification(`拉拢成功：${off.name}已加入你的派系`, 'success');
    } else {
      logEvent(`拉拢${off.name}未成功`, 'warn');
      showNotification(`拉拢${off.name}未成功`, 'warn');
    }
  } else if (off.faction === pf) {
    // 同派系：提高忠诚度
    off.loyalty = Math.min(10, (off.loyalty || 5) + 1);
    logEvent(`与${off.name}加深关系，忠诚度提升`, 'info');
    showNotification(`${off.name}忠诚度提升`, 'success');
  } else {
    // 不同派系：有概率进入你的派系
    if (Math.random() < 0.40) {
      const oldFaction = off.faction;
      off.faction = pf;
      off.recruited = true;
      off.loyalty = Math.min(10, (off.loyalty || 3) + 1);
      // 原派系忠诚度降低
      for (const other of ps.officials) {
        if (other.faction === oldFaction && other.id !== officialId) {
          other.loyalty = Math.max(1, (other.loyalty || 5) - 1);
        }
      }
      // 有概率是间谍
      off._isSpy = Math.random() < 0.20;
      logEvent(`成功拉拢${off.name}从${FACTIONS[oldFaction].name}转入${FACTIONS[pf].name}`, 'success');
      showNotification(`拉拢成功：${off.name}已转入你的派系`, 'success');
      if (off._isSpy) {
        // 间谍增加被举报风险
        gameState.inspectionRisk = clamp((gameState.inspectionRisk || 0) + 5, 0, 100);
      }
    } else {
      logEvent(`拉拢${off.name}未成功，对方不为所动`, 'warn');
      showNotification(`拉拢${off.name}未成功`, 'warn');
    }
  }
  // v2.4.0: 安全渲染
  if (typeof updateUI === 'function') updateUI();
  if (currentTab === 'gov') renderSheet('gov');
}

function refreshOfficialPool() {
  if (gameState.treasury < 200) { showNotification('财政不足，需要¥200万', 'warn'); return; }
  gameState.treasury -= 200;
  const ps = gameState.personnel;
  // Keep appointed officials, replace the rest
  const appointedIds = Object.values(ps.appointments);
  const appointed = ps.officials.filter(o => appointedIds.includes(o.id));
  const newPool = generateOfficialPool(15);
  ps.officials = [...appointed, ...newPool];
  showNotification('已刷新干部储备池（-¥200万）', 'info');
  renderSheet('gov');
  updateUI();
}

// v2.2.7: 年度干部招录改为随机考试事件
// 每年6月随机触发一种考试（国考/省考/选调/林遴选），随机获取3-5名干部
// 新招录的干部不分配派系，需通过个人事件拉拢
function checkAnnualRecruitment() {
  if (!gameState.personnel) return;
  // v2.2.7: 每年随机触发一次考试
  if (gameState._lastRecruitYear === gameState.year) return;
  // 每年6月触发
  if (gameState.month !== 6) return;
  const examTypes = ['国考', '省考', '选调', '林遴选'];
  const examName = examTypes[Math.floor(Math.random() * examTypes.length)];
  // 招录人数：3-5人
  const recruitCount = 3 + Math.floor(Math.random() * 3);
  // 新招录干部无派系（faction: null）
  const newOfficials = generateOfficialPool(recruitCount, { faction: null });
  // 标记来源
  for (const off of newOfficials) {
    off.source = examName;
    off.recruitYear = gameState.year;
    off.tenureMonths = 0;
    off.recruited = false;
  }
  gameState.personnel.officials.push(...newOfficials);
  const nameList = newOfficials.map(o => o.name).join('、');
  logEvent(`${gameState.year}年${examName}录用干部${recruitCount}名：${nameList}，已进入储备池（无派系，可拉拢）`, 'success');
  showNotification(`${examName}录用${recruitCount}名干部（无派系），已进入储备池`, 'success');
  gameState._lastRecruitYear = gameState.year;
}

// v2.2.4b: 每月更新干部任职月数（用于能力增益计算）
function updateOfficialTenure() {
  if (!gameState.personnel) return;
  for (const off of gameState.personnel.officials) {
    off.tenureMonths = (off.tenureMonths || 0) + 1;
    // v2.3.7b: 干部年龄随时间增长（每年+1岁，即每12个月+1）
    if (!off._birthMonth) off._birthMonth = gameState.month;
    if (gameState.month === off._birthMonth) {
      off.age = (off.age || 40) + 1;
    }
    // v2.3.7: 无派系人员6个月后自动分配派系
    if (!off.faction && !off.recruited) {
      off.factionlessMonths = (off.factionlessMonths || 0) + 1;
      if (off.factionlessMonths >= 6) {
        // 随机分配到可见派系（不含隐藏派系）
        const factions = VISIBLE_FACTION_KEYS;
        const newFaction = factions[Math.floor(Math.random() * factions.length)];
        off.faction = newFaction;
        off.factionlessMonths = 0;
        const fName = FACTIONS[newFaction].name;
        logEvent(`${off.name}经组织考察，编入${fName}`, 'info');
      }
    }
  }
  // v2.4.1: 常务委员会成员年龄增长
  if (gameState.committee) {
    for (const m of gameState.committee) {
      if (m.isPlayer) continue;
      if (m.isVacant) {
        // v2.4.1a: 空缺期倒计时，到期后自动补充新任常委
        m.vacantMonths = (m.vacantMonths || 3) - 1;
        if (m.vacantMonths <= 0) {
          const idx = gameState.committee.findIndex(cm => cm.id === m.id);
          if (idx >= 0) {
            const newMember = generateOfficial({ faction: 'random' });
            newMember.id = 'cm_' + m.role + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            newMember.role = m.role;
            newMember.roleName = getCommitteeRoleName(m.role, gameState.cityLevelId);
            newMember.faction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
            newMember.age = Math.floor(Math.random() * 12) + 42;
            newMember.competence = Math.floor(Math.random() * 3) + 5;
            newMember.isPlayer = false;
            newMember.isCommittee = true;
            gameState.committee[idx] = newMember;
            // 更新主导派系
            gameState.mapFaction = getCommitteeDominantFaction(gameState.committee) || gameState.playerFaction;
            logEvent(`新任${newMember.roleName}${newMember.name}到任，补充常委空缺`, 'info');
            showNotification(`${newMember.roleName}空缺已补充，新任${newMember.name}到任`, 'info');
          }
        }
        continue;
      }
      if (!m._birthMonth) m._birthMonth = gameState.month;
      if (gameState.month === m._birthMonth) {
        m.age = (m.age || 45) + 1;
      }
    }
  }
}

// v2.2.4b: 计算干部能力增益（基于任职月数）
function getOfficialBonus(off) {
  if (!off) return { competence: 0, loyalty: 0 };
  const tenure = off.tenureMonths || 0;
  // 每12个月+1能力，上限+3；每24个月+1忠诚，上限+2
  const compBonus = Math.min(3, Math.floor(tenure / 12));
  const loyaltyBonus = Math.min(2, Math.floor(tenure / 24));
  // 已被拉拢的干部额外+1忠诚
  const recruitedBonus = off.recruited ? 1 : 0;
  return { competence: compBonus, loyalty: loyaltyBonus + recruitedBonus };
}

// v2.2.4b: 获取干部有效能力值（含增益）
function getEffectiveCompetence(off) {
  if (!off) return 0;
  return (off.competence || 5) + getOfficialBonus(off).competence;
}

// v2.2.4b: 获取干部有效忠诚值（含增益）
function getEffectiveLoyalty(off) {
  if (!off) return 0;
  return (off.loyalty || 3) + getOfficialBonus(off).loyalty;
}

function renderDemolishTab() {
  let html = '';
  html += `<div class="stats-section"><h3>拆除工具</h3>`;
  html += `<p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">选择拆除模式，然后在地图上操作。</p>`;
  const isWhole = gameState.demolishMode === 'whole';
  const isPartial = gameState.demolishMode === 'partial';
  const isRect = gameState.demolishMode === 'rect';
  html += `<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">`;
  html += `<button class="start-btn" style="flex:1;min-width:80px;padding:10px;font-size:13px;${isWhole ? '' : 'background:var(--separator);color:var(--text-2);'}" onclick="setDemolishMode('whole')">`;
  html += `<div style="display:flex;align-items:center;gap:6px;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>整段</div>`;
  html += `<div style="font-size:10px;opacity:0.7;margin-top:2px;">点击拆除整段</div>`;
  html += `</button>`;
  html += `<button class="start-btn" style="flex:1;min-width:80px;padding:10px;font-size:13px;${isPartial ? '' : 'background:var(--separator);color:var(--text-2);'}" onclick="setDemolishMode('partial')">`;
  html += `<div style="display:flex;align-items:center;gap:6px;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="12" y1="10" x2="12" y2="20" stroke-dasharray="2,2"/></svg>画笔</div>`;
  html += `<div style="font-size:10px;opacity:0.7;margin-top:2px;">拖拽逐格拆除</div>`;
  html += `</button>`;
  html += `<button class="start-btn" style="flex:1;min-width:80px;padding:10px;font-size:13px;${isRect ? '' : 'background:var(--separator);color:var(--text-2);'}" onclick="setDemolishMode('rect')">`;
  html += `<div style="display:flex;align-items:center;gap:6px;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="9" y2="9.01"/><line x1="15" y1="9" x2="15" y2="9.01"/></svg>框选</div>`;
  html += `<div style="font-size:10px;opacity:0.7;margin-top:2px;">拖拽矩形批量删除</div>`;
  html += `</button>`;
  html += `</div>`;
  if (isPartial) {
    html += `<div style="background:var(--card-bg);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--text-3);margin-top:4px;">`;
    html += `画笔模式：按住鼠标在地图上拖动，每经过一格自动拆除该格道路/线路。`;
    html += `</div>`;
  }
  if (isRect) {
    html += `<div style="background:var(--card-bg);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--text-3);margin-top:4px;">`;
    html += `框选模式：按住鼠标拖拽矩形区域，松开后批量删除区域内所有建筑/道路/区域/线路。`;
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function setDemolishMode(mode) {
  gameState.demolishMode = mode;
  gameState.isDemolishBrushing = false;
  gameState._demolishStartCell = null;
  gameState._demolishCells = [];
  // 同步 brushMode 以确保 updatePaint 走正确的分支
  if (mode === 'rect') gameState.brushMode = 'rect';
  else if (mode === 'partial') gameState.brushMode = 'free';
  else gameState.brushMode = 'free';
  updateToolUI();
}

function renderMenuTab() {
  let html = '';
  const lv = getCityLevel();
  const history = gameState.promotionHistory || [];
  if (history.length > 0) {
    html += `<div class="stats-section" style="margin-bottom:8px;">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:8px;">仕途履历</h3>`;
    for (const h of history) {
      const arrow = h.demoted ? '↓' : '↑';
      const color = h.demoted ? 'var(--red)' : 'var(--green)';
      html += `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:0.5px solid var(--separator-light);">
        <span style="color:${color};font-weight:600;">${arrow} ${h.from} → ${h.to}</span>
        <span style="color:var(--text-3);">第${h.turn}月 ${h.score !== undefined ? '评分'+h.score : ''}</span>
      </div>`;
    }
    html += '</div>';
  }
  html += `<div style="display:flex;flex-direction:column;gap:8px;">
    <div class="stats-section" style="padding:14px;">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:10px;">游戏设置</h3>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--separator-light);">
        <div>
          <div style="font-size:14px;font-weight:600;">宽裕财政模式</div>
          <div style="font-size:12px;color:var(--text-3);">开启后财政资金无限，适合自由建设${gameState.generousFinance ? '（已锁定）' : ''}</div>
        </div>
        <button class="start-btn" style="width:auto;padding:8px 16px;background:${gameState.generousFinance ? 'var(--green)' : 'var(--separator)'};color:${gameState.generousFinance ? '#fff' : 'var(--text-2)'};font-size:13px;${gameState.generousFinance ? 'opacity:0.7;cursor:not-allowed;' : ''}" onclick="toggleGenerousFinance()">
          ${gameState.generousFinance ? '已锁定' : '已关闭'}
        </button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--separator-light);">
        <div>
          <div style="font-size:14px;font-weight:600;">无尽仕途模式</div>
          <div style="font-size:12px;color:var(--text-3);">开启后无任期上限和退休限制，任期结束可自由选择去留${gameState.endlessMode ? '（已锁定）' : ''}</div>
        </div>
        <button class="start-btn" style="width:auto;padding:8px 16px;background:${gameState.endlessMode ? 'var(--green)' : 'var(--separator)'};color:${gameState.endlessMode ? '#fff' : 'var(--text-2)'};font-size:13px;${gameState.endlessMode ? 'opacity:0.7;cursor:not-allowed;' : ''}" onclick="toggleEndlessMode()">
          ${gameState.endlessMode ? '已锁定' : '已关闭'}
        </button>
      </div>
    </div>
    <button class="start-btn" onclick="saveGamePrompt()" style="width:100%;">
      <div class="btn-icon" style="background:var(--accent-light);">${ICON.save}</div>
      <div class="btn-text">保存游戏</div>
    </button>
    <button class="start-btn" onclick="showSaveScreen('load')" style="width:100%;">
      <div class="btn-icon" style="background:var(--green-light);">${ICON.folderOpen}</div>
      <div class="btn-text">读取存档</div>
    </button>
    <button class="start-btn" onclick="regenerateMap()" style="width:100%;">
      <div class="btn-icon" style="background:var(--orange-light);">${ICON.refresh}</div>
      <div class="btn-text">重新生成地形</div>
    </button>
    <button class="start-btn" onclick="confirmExit()" style="width:100%;">
      <div class="btn-icon" style="background:var(--red-light);">${ICON.logout}</div>
      <div class="btn-text">返回主菜单</div>
    </button>
  </div>`;
  return html;
}

