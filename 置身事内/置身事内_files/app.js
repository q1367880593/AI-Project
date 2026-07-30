/* 源自《置身事内》单文件版 - Disclaimer Timer */
/* 自动拆分生成，请勿手动调整章节归属 */

// ========== Disclaimer Timer ==========
let _disclaimerTimer = null;
function startDisclaimerTimer() {
  let remaining = 10;
  const countEl = document.getElementById('ds-count');
  const btn = document.getElementById('ds-agree-btn');
  if (!countEl || !btn) return;
  if (_disclaimerTimer) clearInterval(_disclaimerTimer);
  _disclaimerTimer = setInterval(() => {
    remaining--;
    countEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(_disclaimerTimer);
      _disclaimerTimer = null;
      btn.disabled = false;
      const timerEl = document.querySelector('.ds-timer');
      if (timerEl) timerEl.textContent = '已阅读，可以继续';
    }
  }, 1000);
}

function dismissDisclaimer() {
  const ds = document.getElementById('disclaimer-screen');
  if (ds) ds.classList.add('hidden');
  if (_disclaimerTimer) { clearInterval(_disclaimerTimer); _disclaimerTimer = null; }
}

window.addEventListener('DOMContentLoaded', () => {
  startDisclaimerTimer();
  // 初始化模组加载器（异步，不阻塞游戏启动）
  if (typeof ModLoader !== 'undefined') {
    ModLoader.init().catch(e => console.warn('[App] ModLoader init error:', e));
  }
});
