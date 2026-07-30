/* 源自《置身事内》单文件版 - 政策/投资/腐败 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 政策/投资/腐败 ==============
function applyPolicies() {
  for (const opt of POLICY_OPTIONS) {
    const el = document.getElementById(`policy-${opt.id}`);
    if (el) { const v = parseFloat(el.value); gameState.policies[opt.id] = v; if (opt.apply) opt.apply(v, gameState); }
  }
  showNotification('财政政策已更新', 'success');
  updateUI();
}

function doInvestment(id) {
  const inv = INVESTMENT_OPTIONS.find(i => i.id === id);
  if (!inv || gameState.treasury < inv.cost) { showNotification('资金不足', 'danger'); return; }
  const used = gameState.investUsage[id] || 0;
  if (inv.maxPerTerm && used >= inv.maxPerTerm) { showNotification(`${inv.name}本任期已达上限`, 'warn'); return; }
  gameState.treasury -= inv.cost;
  // 递减效果：每多执行一次，效果衰减20%
  const diminish = Math.pow(0.8, used);
  const scaledEffects = {};
  for (const k in inv.effects) {
    if (k === 'gdpMult') scaledEffects[k] = 1 + (inv.effects[k] - 1) * diminish;
    else scaledEffects[k] = Math.round(inv.effects[k] * diminish * 10) / 10;
  }
  applyEffects(scaledEffects);
  // gdpMult上限保护
  if (gameState.gdpMult > GDP_MULT_CAP) {
    const overflow = gameState.gdpMult - GDP_MULT_CAP;
    gameState.gdpMult = GDP_MULT_CAP;
    logEvent(`GDP增速达到上限，溢出${(overflow * 100).toFixed(0)}%`, 'warn');
  }
  gameState.investUsage[id] = used + 1;
  logEvent(`工商发展：${inv.name}（-¥${inv.cost}万，第${used + 1}次）`, 'success');
  showNotification(`${inv.name}已启动${used > 0 ? '（效果衰减）' : ''}`, 'success');
  updateUI();
  renderSheet('gov');
}

function doCorruptionAction(id) {
  const act = CORRUPTION_ACTIONS.find(a => a.id === id);
  if (!act) return;
  if (act.cost > 0 && gameState.treasury < act.cost) { showNotification('资金不足', 'danger'); return; }
  if (act.cost) gameState.treasury -= act.cost;
  // 非法所得进入私人账户而非财政
  if (act.gain) {
    gameState.privateAccount += act.gain;
    gameState.privateTotalGained += act.gain;
  }
  gameState.achievementStats.totalCorruptionActions++;
  if (act.cost > 0) { gameState.achievementStats.moneyOnBribes += act.cost; gameState.achievementStats.totalMoneySpent += act.cost; gameState.achievementStats.totalBribes++; }
  gameState.corruption = clamp(gameState.corruption + act.corruption, 0, 100);
  gameState.inspectionRisk = clamp(gameState.inspectionRisk + act.inspection, 0, 100);
  gameState.reputation = clamp(gameState.reputation + act.reputation, 0, 100);
  if (!corruptionCooldowns) corruptionCooldowns = {};
  corruptionCooldowns[id] = act.cooldown;
  if (act.gain > 0) { logEvent(`权力运作：${act.name}（私人账户+¥${act.gain}万，腐败+${act.corruption}）`, 'corruption'); showNotification(`${act.name}：私人账户获得¥${act.gain}万`, 'warn'); }
  else { logEvent(`权力运作：${act.name}`, 'corruption'); showNotification(`${act.name}完成`, 'info'); }
  // v2.3.7c: 纪委调查不再直接因腐败值高触发，改为由inspectionRisk（纪委关注度）触发
  // inspectionRisk通过事件、低忠诚度干部、个人企业等途径累积，更符合现实逻辑
  if ((gameState.inspectionRisk || 0) > 60 && Math.random() < 0.15) {
    setTimeout(() => triggerInspection(), 500);
  }
  updateUI();
  renderSheet('gov');
}

function triggerInspection() {
  // Show the inspection modal first (player decides how to respond)
  _showInspectionModal();
}

function _showInspectionModal() {
  // 用钱摆平的费用更高，但成功率也更高
  const bribeCost = Math.round(800 + gameState.corruption * 20 + gameState.privateTotalGained * 0.1);
  const successRate = gameState.privateAccount >= bribeCost ? 0.88 : 0.6;
  showModal('纪委注意', `<p>你的腐败行为引起了纪委的注意。纪委决定对你进行专项调查。</p>
    <p style="color:var(--red);">当前腐败指数：${gameState.corruption.toFixed(0)}　纪委关注度：${gameState.inspectionRisk.toFixed(0)}</p>
    <p style="color:var(--orange);">私人账户余额：¥${formatMoney(gameState.privateAccount * 10000)}</p>
    <p style="font-size:12px;color:var(--text-3);margin-top:8px;">你可以选择接受调查，或者"活动活动"试图摆平此事。</p>
    <p style="font-size:12px;color:var(--text-3);">摆平费用：¥${bribeCost}万（从私人账户扣除），成功率约${Math.round(successRate * 100)}%</p>`, [
    { text: `用钱摆平（¥${bribeCost}万）`, color: 'yellow', action: () => {
      closeModal();
      if (gameState.privateAccount < bribeCost) {
        showNotification('私人账户资金不足，无法摆平！', 'danger');
        logEvent('试图摆平纪委调查，但私人账户资金不足', 'warn');
        if (gameState.corruption > 75) {
          // 东窗事发 — show red-letter before game over
          showInspectionRedLetter(() => {
            showGameOver('corruption_caught', '东窗事发', `纪委调查发现严重违纪违法问题。你的腐败行为被曝光，涉案金额巨大。经XX省委决定，给予开除党籍、开除公职处分，并移送司法机关处理。`);
          });
        } else {
          // 警告处分 — show warning red-letter
          applyEffects({ reputation: -15, corruption: -5 });
          showWarningRedLetter(() => {
            showNotification('纪委给予警告处分', 'warn');
            logEvent('纪委调查：给予警告处分', 'warn');
            updateUI();
          });
        }
        return;
      }
      gameState.privateAccount -= bribeCost;
      // 摆平成功概率
      if (Math.random() < successRate) {
        gameState.corruption = clamp(gameState.corruption - 10, 0, 100);
        gameState.inspectionRisk = clamp(gameState.inspectionRisk - 25, 0, 100);
        gameState.reputation = clamp(gameState.reputation - 5, 0, 100);
        showNotification('纪委调查"暂未发现"重大问题', 'warn');
        logEvent(`私人账户花费¥${bribeCost}万摆平纪委调查，成功`, 'corruption');
        gameState.achievementStats.inspectionsDodged++;
        updateUI();
      } else {
        // 摆平失败
        showNotification('摆平失败！纪委掌握了更多证据！', 'danger');
        logEvent(`花费¥${bribeCost}万试图摆平，但失败了`, 'corruption');
        if (gameState.corruption > 60) {
          // 东窗事发 — show red-letter before game over
          showInspectionRedLetter(() => {
            showGameOver('corruption_caught', '东窗事发', `尽管你试图掩盖，纪委最终还是掌握了确凿证据。你的腐败行为被全面曝光，经XX省委决定，给予开除党籍、开除公职处分，并移送司法机关处理。`);
          });
        } else {
          // 严重警告 — show warning red-letter
          applyEffects({ reputation: -20, corruption: -5 });
          showWarningRedLetter(() => {
            showNotification('纪委给予严重警告处分', 'warn');
            updateUI();
          });
        }
      }
    }},
    { text: '接受调查', color: 'blue', action: () => {
      closeModal();
      if (gameState.corruption > 75) {
        // 东窗事发 — show red-letter before game over
        showInspectionRedLetter(() => {
          showGameOver('corruption_caught', '东窗事发', `纪委调查发现严重违纪违法问题。你的腐败行为被曝光，涉案金额巨大。经XX省委决定，给予开除党籍、开除公职处分，并移送司法机关处理。`);
        });
      } else {
        // 警告处分 — show warning red-letter
        applyEffects({ reputation: -15, corruption: -5 });
        showWarningRedLetter(() => {
          showNotification('纪委给予警告处分', 'warn');
          logEvent('纪委调查：给予警告处分', 'warn');
          updateUI();
        });
      }
    }},
  ], '纪委', 'danger');
}

