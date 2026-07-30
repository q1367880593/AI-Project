/* 置身事内 - 菜单面板（成就+存档+设置） */

// ============== 模组图标 SVG ==============
const MOD_ICON_PUZZLE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M20 12a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-4 0v-2H9v-2a2 2 0 1 1 2-2V7h2v3a2 2 0 0 1 4 0v2h3a2 2 0 0 1 0 4Z"/></svg>';
const MOD_ICON_CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:2px;"><polyline points="20 6 9 17 4 12"/></svg>';
const MOD_ICON_CROSS = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:middle;margin-right:2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

// ============== 菜单面板 ==============
function toggleMenuPanel() {
  const panel = document.getElementById('menu-panel');
  const btn = document.getElementById('menu-btn');
  const isActive = panel.classList.toggle('active');
  btn.classList.toggle('active', isActive);
  if (isActive) {
    renderMenuPanel();
  }
  // 关闭 FAB 菜单
  const fabMenu = document.getElementById('fab-menu');
  if (fabMenu.classList.contains('active')) toggleFab();
  // 关闭建筑窗口
  const bw = document.getElementById('build-window');
  if (bw && bw.classList.contains('active')) bw.classList.remove('active');
}

function renderMenuPanel() {
  // 刷新宽裕财政/无尽仕途按钮状态
  const genBtn = document.getElementById('menu-generous-btn');
  const endBtn = document.getElementById('menu-endless-btn');
  if (genBtn) {
    genBtn.textContent = gameState.generousFinance ? '已开启' : '关闭';
    genBtn.style.background = gameState.generousFinance ? 'var(--green)' : 'var(--separator)';
    genBtn.style.color = gameState.generousFinance ? '#fff' : 'var(--text-2)';
  }
  if (endBtn) {
    endBtn.textContent = gameState.endlessMode ? '已开启' : '关闭';
    endBtn.style.background = gameState.endlessMode ? 'var(--green)' : 'var(--separator)';
    endBtn.style.color = gameState.endlessMode ? '#fff' : 'var(--text-2)';
  }

  // 渲染模组信息
  const modSection = document.getElementById('menu-mods-section');
  if (modSection) {
    let modHtml = '<h3>' + MOD_ICON_PUZZLE + '模组管理</h3>';
    const loaded = window.ModLoader ? ModLoader.loaded : [];
    const failed = window.ModLoader ? ModLoader.failed : [];

    if (loaded.length === 0 && failed.length === 0) {
      modHtml += '<div style="font-size:12px;color:var(--text-3);padding:8px;">未加载任何模组</div>';
    } else {
      // 成功加载的模组（精简显示，仅名称+版本）
      if (loaded.length > 0) {
        modHtml += '<div style="font-size:12px;color:var(--accent);margin-bottom:6px;">' + MOD_ICON_CHECK + '已加载 ' + loaded.length + ' 个模组</div>';
        for (const m of loaded) {
          modHtml += '<div class="mod-loaded-item">' +
            '<div style="font-size:12px;font-weight:600;color:var(--text);">' + m.info.name + '</div>' +
            '<div style="font-size:10px;color:var(--text-3);">v' + m.info.version + ' · ' + m.info.author + '</div>' +
          '</div>';
        }
      }
      // 加载失败的模组
      if (failed.length > 0) {
        modHtml += '<div style="font-size:12px;color:var(--red);margin-bottom:4px;margin-top:6px;">' + MOD_ICON_CROSS + failed.length + ' 个模组加载失败</div>';
        for (const f of failed) {
          modHtml += '<div class="mod-failed-item">' + f.id + ': ' + f.error + '</div>';
        }
      }
    }
    // 查看可用模组按钮
    modHtml += '<button class="menu-btn" onclick="showAvailMods()" style="margin-top:6px;">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 12a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-4 0v-2H9v-2a2 2 0 1 1 2-2V7h2v3a2 2 0 0 1 4 0v2h3a2 2 0 0 1 0 4Z"/></svg>' +
      '查看可用模组</button>';
    modSection.innerHTML = modHtml;
  }
}

// ============== 可用模组弹出面板 ==============

/** 扫描并显示所有可用模组（包括未启用的） */
async function showAvailMods() {
  const popup = document.getElementById('avail-mods-popup');
  const list = document.getElementById('avail-mods-list');
  if (!popup || !list) return;

  popup.classList.add('active');
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3);">正在扫描模组目录...</div>';

  // 获取可用模组列表
  let available = [];
  if (window.ModLoader && ModLoader._available) {
    available = ModLoader._available;
  } else {
    // 直接读取 index.json
    try {
      const resp = await fetch('mods/index.json');
      const index = await resp.json();
      available = index.available || index.mods || [];
    } catch (e) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red);">无法读取模组目录</div>';
      return;
    }
  }

  // v2.2.3: 从当前存档获取已启用的模组
  const enabledIds = new Set(gameState.enabledMods || []);
  // 已加载的模组（数据已在内存中）
  const loadedIds = new Set();
  if (window.ModLoader && ModLoader.loaded) {
    for (const m of ModLoader.loaded) loadedIds.add(m.id);
  }

  // 读取每个模组的 manifest.json
  let html = '';
  for (const dir of available) {
    try {
      const resp = await fetch('mods/' + dir + '/manifest.json');
      if (!resp.ok) {
        html += '<div class="avail-mod-item">' +
          '<div class="avail-mod-info"><div class="ami-name">' + dir + '</div>' +
          '<div class="ami-meta" style="color:var(--red);">manifest.json 读取失败 (HTTP ' + resp.status + ')</div></div></div>';
        continue;
      }
      const manifest = await resp.json();
      const info = manifest.modInfo || {};
      const id = info.id || dir;
      const enabled = enabledIds.has(id);
      const dataLoaded = loadedIds.has(id);

      let btnHtml;
      if (enabled) {
        btnHtml = '<button class="avail-enable-btn" disabled>已启用（不可关闭）</button>';
      } else if (dataLoaded) {
        btnHtml = '<button class="avail-enable-btn" onclick="enableMod(\'' + id + '\',\'' + dir + '\')">为当前存档启用</button>';
      } else {
        btnHtml = '<button class="avail-enable-btn" disabled title="该模组数据未加载，请将其加入 mods/index.json 的 mods 数组后刷新页面">未加载</button>';
      }

      html += '<div class="avail-mod-item">' +
        '<div class="avail-mod-info">' +
          '<div class="ami-name">' + (info.name || dir) + '</div>' +
          '<div class="ami-meta">v' + (info.version || '?') + ' · ' + (info.author || '未知') + ' · ' + (id || dir) + '</div>' +
          (info.description ? '<div class="ami-desc">' + info.description + '</div>' : '') +
        '</div>' +
        btnHtml +
      '</div>';
    } catch (e) {
      html += '<div class="avail-mod-item">' +
        '<div class="avail-mod-info"><div class="ami-name">' + dir + '</div>' +
        '<div class="ami-meta" style="color:var(--red);">读取失败: ' + e.message + '</div></div></div>';
    }
  }

  if (html === '') {
    html = '<div style="text-align:center;padding:20px;color:var(--text-3);">未发现任何模组</div>';
  }

  // 添加提示
  html += '<div style="font-size:10px;color:var(--text-3);margin-top:8px;text-align:center;">模组启用状态保存在当前存档中，单个存档一旦开启某个模组便无法关闭</div>';
  list.innerHTML = html;
}

/** 启用指定模组（v2.2.3：写入当前存档，不可关闭） */
function enableMod(id, dir) {
  // 检查是否在游戏中
  const inGame = document.getElementById('game-screen') && document.getElementById('game-screen').classList.contains('active');
  if (!inGame) {
    showNotification('请先开始新游戏或加载存档，再为当前存档启用模组', 'warn');
    return;
  }
  if (!gameState.enabledMods) gameState.enabledMods = [];
  if (gameState.enabledMods.includes(id)) {
    showAvailMods();
    return;
  }
  gameState.enabledMods.push(id);
  // 自动保存
  autoSave();
  // 刷新弹出面板
  showAvailMods();
  // 提示用户
  const list = document.getElementById('avail-mods-list');
  if (list) {
    const banner = document.createElement('div');
    banner.style.cssText = 'text-align:center;padding:8px;margin-top:8px;background:var(--accent-light);border-radius:var(--radius-xs);font-size:12px;color:var(--accent);font-weight:600;';
    banner.textContent = '模组 "' + id + '" 已为当前存档启用！开启后无法关闭。';
    list.appendChild(banner);
  }
}

/** 关闭可用模组面板 */
function closeAvailMods() {
  const popup = document.getElementById('avail-mods-popup');
  if (popup) popup.classList.remove('active');
}

// 覆盖 toggleGenerousFinance 和 toggleEndlessMode 以刷新菜单面板
const _origToggleGenerous = window.toggleGenerousFinance;
if (typeof _origToggleGenerous === 'function') {
  window.toggleGenerousFinance = function() {
    _origToggleGenerous();
    renderMenuPanel();
  };
}

const _origToggleEndless = window.toggleEndlessMode;
if (typeof _origToggleEndless === 'function') {
  window.toggleEndlessMode = function() {
    _origToggleEndless();
    renderMenuPanel();
  };
}
