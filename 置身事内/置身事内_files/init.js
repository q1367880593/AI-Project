/* 源自《置身事内》单文件版 - 游戏初始化 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 游戏初始化 ==============
// ============== 正向引导 ==============
let _lastGuidanceTurn = -1;

// 正向引导文案池（30条）
const POSITIVE_GUIDANCE = [
  { text: '清正廉洁是为政之本，勤政为民是公仆之责。', icon: 'success' },
  { text: '法纪红线不可逾越，廉洁底线不容试探。', icon: 'warn' },
  { text: '权为民所用、情为民所系、利为民所谋。', icon: 'success' },
  { text: '贪欲之门一开，覆水难收。请珍视您的政治生命。', icon: 'warn' },
  { text: '正风肃纪，反腐倡廉，永远在路上。', icon: 'info' },
  { text: '为官一任，造福一方；清白做人，干净做事。', icon: 'success' },
  { text: '莫伸手，伸手必被捉。党纪国法面前没有例外。', icon: 'warn' },
  { text: '群众利益无小事，一枝一叶总关情。', icon: 'success' },
  { text: '打铁还需自身硬，正人必先正己。', icon: 'info' },
  { text: '标本兼治、综合治理、惩防并举、注重预防。', icon: 'info' },
  { text: '信念坚定、为民服务、勤政务实、敢于担当、清正廉洁。', icon: 'success' },
  { text: '以零容忍态度惩治腐败，始终保持高压态势。', icon: 'warn' },
  { text: '人民对美好生活的向往，就是我们的奋斗目标。', icon: 'success' },
  { text: '勿以恶小而为之，勿以善小而不为。', icon: 'info' },
  { text: '心中有党、心中有民、心中有责、心中有戒。', icon: 'success' },
  { text: '慎独慎微，防微杜渐，方能行稳致远。', icon: 'info' },
  { text: '公生明，廉生威；以公心用权，以廉洁立身。', icon: 'success' },
  { text: '其身正，不令而行；其身不正，虽令不从。', icon: 'warn' },
  { text: '先天下之忧而忧，后天下之乐而乐。', icon: 'success' },
  { text: '贪如火，不遏则燎原；欲如水，不遏则滔天。', icon: 'warn' },
  { text: '一丝一粟，我之名节；一厘一毫，民之脂膏。', icon: 'info' },
  { text: '清如秋菊何妨瘦，廉似梅花不畏寒。', icon: 'success' },
  { text: '以铜为镜，可以正衣冠；以史为镜，可以知兴替。', icon: 'info' },
  { text: '历览前贤国与家，成由勤俭破由奢。', icon: 'warn' },
  { text: '不要人夸好颜色，只留清气满乾坤。', icon: 'success' },
  { text: '粉骨碎身浑不怕，要留清白在人间。', icon: 'success' },
  { text: '出淤泥而不染，濯清涟而不妖。', icon: 'success' },
  { text: '只畏法律，畏民言，畏清议，则自不敢苟且。', icon: 'warn' },
  { text: '一身报国有万死，双鬓向人无再青。', icon: 'info' },
  { text: '天下兴亡，匹夫有责；廉洁从政，人人有份。', icon: 'success' },
];

function checkPositiveGuidance() {
  // 每4个回合（约一个季度）推送一次正向引导
  if (gameState.turn > 0 && gameState.turn % 4 === 0 && gameState.turn !== _lastGuidanceTurn) {
    _lastGuidanceTurn = gameState.turn;
    const idx = Math.floor(Math.random() * POSITIVE_GUIDANCE.length);
    const g = POSITIVE_GUIDANCE[idx];
    showNotification(g.text, g.icon);
  }
}

function startNewGame() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-screen').classList.add('active');
  initCanvas();
  // [v2.3.0] 模组钩子：新游戏开始前
  if (typeof ModAPI !== 'undefined') ModAPI.reset();
  gameState.cityLevelId = 0;
  // cityName and playerName are already set by showStartRedLetter
  if (!gameState.cityName) gameState.cityName = '新安镇';
  if (!gameState.playerName) gameState.playerName = '同志';
  // v2.2.3: 新游戏初始化模组启用状态为默认模组
  gameState.enabledMods = ModLoader.loaded.map(m => m.id);
  // v2.2.4: 随机分配玩家派系和地图派系
  gameState.playerFaction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
  gameState.mapFaction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
  gameState.mapSeed = randomInt(1, 999999);
  gameState.buildings = [];
  gameState.buildingCount = 0;
  gameState.zones = [];
  gameState.roads = [];
  gameState.transits = [];
  gameState.skyscrapers = [];
  usedRoadNames = new Set();
  roadNameCounter = 0;
  gameState.subwayApproved = false;
  gameState.lightRailApproved = false; // v2.2.6: 轻轨审批
  gameState.universityApproved = false;
  gameState.playerDegree = randomStartingDegree();
  gameState.degreeFake = false;
  gameState.partySchoolCooldown = 0;
  gameState._pendingDegree = null;
  gameState.pendingEvents = [];
  gameState.pendingEvent = null;
  // 按城市等级设定地图尺寸
  const ms = getMapSizeForLevel(gameState.cityLevelId);
  MAP_W = ms.w; MAP_H = ms.h;
  offscreenCanvas.width = MAP_W * CELL;
  offscreenCanvas.height = MAP_H * CELL;
  mapCells = generateTerrain(gameState.mapSeed);
  contourSegments = generateContours(mapCells);
  renderTerrainToOffscreen();
  // [v2.3.0] 模组钩子：城市生成前
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('cityGen:before', { level: getCityLevel(), mapSize: { w: MAP_W, h: MAP_H } });
  generateStarterCity();
  // [v2.3.0] 模组钩子：城市生成后
  if (typeof ModAPI !== 'undefined') ModAPI.hooks.callSync('cityGen:after', { state: gameState });
  renderMap();
  updateUI();
  setupInput();
  if (gameState.cityLevelId >= 1) initPersonnelSystem();
  else gameState.personnel = null; // 乡镇级别不初始化，晋升时自动初始化
  logEvent(`${gameState.playerName}同志赴${gameState.cityName}就任${getOfficialTitle()}`, 'success');
  logEvent(`初始人口：${formatPop(gameState.population)}，财政：¥${formatMoney(gameState.treasury * 10000)}`, 'info');
  setTimeout(() => showNotification('点击右上角按钮打开菜单', 'info'), 500);
}

function initGameScreen() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('save-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
  initCanvas();
  setupInput();
}

function setupInput() {
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleCanvasLeave);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  document.addEventListener('keydown', handleKeyPress);
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
}

function handleKeyPress(e) {
  // 如果焦点在输入框/文本域中，不拦截快捷键
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
  // 有模态框打开时只响应 Escape
  const modalOpen = document.querySelector('.modal-overlay.active, #newspaper-overlay.active, #red-letter-overlay.active');
  if (modalOpen && e.key !== 'Escape') return;

  const k = e.key.toLowerCase();
  if (e.key === ' ') { e.preventDefault(); nextMonth(); }
  // 工具切换
  else if (k === 'b') setTool('build');
  else if (k === 'd') setTool('demolish');
  else if (k === 'i') setTool('inspect');
  else if (k === 'p') setTool('paint');
  // 视图控制
  else if (k === '+' || k === '=') { e.preventDefault(); zoomBy(1.2); }
  else if (k === '-' || k === '_') { e.preventDefault(); zoomBy(1 / 1.2); }
  else if (k === 'r') resetView();
  // 存档
  else if (k === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveGamePrompt(); }
  else if (k === 'l' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); loadGame(0); }
  // 面板与标签页
  else if (k === 'm') toggleFab();
  else if (k === 'n') showNewspaper();
  // 数字键快速切换标签页（需先打开面板）
  else if (k === '1') openTab('demand');
  else if (k === '2') openTab('stats');
  else if (k === '3') openTab('policy');
  else if (k === '4') openTab('events');
  else if (k === '5') openTab('gov');
  else if (k === '6') openTab('personal');
  else if (k === '9') toggleMenuPanel();
  else if (k === '0') toggleMenuPanel();
  // Escape 关闭一切
  else if (e.key === 'Escape') { closeModal(); closeNewspaper(); const rl = document.getElementById('red-letter-overlay'); if (rl) rl.classList.remove('active'); if (document.getElementById('fab-menu').classList.contains('active')) toggleFab(); const mp = document.getElementById('menu-panel'); if (mp && mp.classList.contains('active')) toggleMenuPanel(); const bw = document.getElementById('build-window'); if (bw && bw.classList.contains('active')) bw.classList.remove('active'); const dw = document.getElementById('demolish-window'); if (dw && dw.classList.contains('active')) dw.classList.remove('active'); const lp = document.getElementById('layers-popup'); if (lp && lp.classList.contains('active')) lp.classList.remove('active'); }
}

// 快速打开某个标签页（自动展开面板）
function openTab(tab) {
  if (gameState.gameOver) return;
  const menu = document.getElementById('fab-menu');
  if (!menu.classList.contains('active')) toggleFab();
  switchTab(tab);
}

function resizeCanvas() {
  const wrapper = document.getElementById('map-wrapper');
  if (!wrapper || !canvas) return;
  canvas.style.width = wrapper.clientWidth + 'px';
  canvas.style.height = wrapper.clientHeight + 'px';
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  fitMapToView();
}

