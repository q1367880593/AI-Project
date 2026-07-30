/* ============================================================
   置身事内 v2.4.7 — 模组加载器 (Mod Loader) v5
   ============================================================
   模组文件夹架构：
   - mods/index.json 定义要加载的模组文件夹列表
   - mods/ 下每个子文件夹是一个独立模组
   - 每个模组文件夹包含 manifest.json + 数据文件

   目录结构：
   mods/
   ├── index.json               ← 模组目录索引 { "mods": ["mod_a", "mod_b"] }
   ├── mod_a/                   ← 模组文件夹
   │   ├── manifest.json         ← 模组清单
   │   ├── init.js               ← [v2.3.0 新增] 模组初始化脚本
   │   ├── data.json             ← 模组数据（JSON 格式）
   │   └── assets/               ← 可选资源目录
   └── mod_b/
       ├── manifest.json
       └── ...

   支持的数据模块（JSON）：
   - buildings / palette / events / personalEvents / achievements
   - cityLevels / policies / investments / corruptionActions
   - zones / roads / transits / guidance / names

   [v2.3.0 新增] init.js 脚本支持：
   - 通过 ModAPI.hooks.on() 注册游戏钩子
   - 通过 ModAPI.events.on() 订阅游戏事件
   - 通过 ModAPI.data.* 查询和操作游戏数据
   - 动态创建自定义建筑/区域/道路/事件

   JSON 规范见 模组开发指南.md
   ============================================================ */

const ModLoader = {
  /** 已加载模组列表 */
  loaded: [],
  /** 加载失败的模组列表 */
  failed: [],
  /** 模组基础目录（相对于 index.html） */
  basePath: 'mods/',
  /** 每个模组注册的建筑 ID 映射 { modId: [id1, id2, ...] } */
  modBuildings: {},
  /** [v2.3.0] 模组 init.js 脚本执行上下文 */
  _modScripts: {},

  /**
   * 初始化：扫描 mods/ 下所有子文件夹，加载已启用的模组
   */
  async init() {
    this.loaded = [];
    this.failed = [];
    this.modBuildings = {};
    this._modScripts = {};

    // 重置 ModAPI 状态
    if (typeof ModAPI !== 'undefined') ModAPI.reset();

    try {
      const modDirs = await this._discoverMods();
      if (modDirs.length === 0) {
        console.log('[ModLoader] 未发现任何模组文件夹，跳过加载');
        return;
      }
      console.log(`[ModLoader] 发现 ${modDirs.length} 个模组文件夹，开始扫描...`);

      for (const dir of modDirs) {
        await this._loadModDir(dir);
      }

      this._printSummary();
    } catch (e) {
      console.warn('[ModLoader] 初始化失败:', e.message);
    }
  },

  /**
   * 发现模组：读取 mods/index.json 获取模组列表
   */
  async _discoverMods() {
    try {
      const index = await this._fetchJSON(this.basePath + 'index.json');
      if (index && Array.isArray(index.mods)) {
        this._available = index.available || [...index.mods];
        console.log(`[ModLoader] 从 index.json 读取到 ${index.mods.length} 个模组`);
        return index.mods;
      }
    } catch (e) {
      console.warn('[ModLoader] index.json 不存在或读取失败:', e.message);
    }
    console.log('[ModLoader] 未发现模组，跳过加载');
    return [];
  },

  /**
   * 加载单个模组文件夹
   */
  async _loadModDir(dirName) {
    const modPath = this.basePath + dirName + '/';
    try {
      const manifest = await this._fetchJSON(modPath + 'manifest.json');
      if (!manifest || !manifest.modInfo) {
        this.failed.push({ id: dirName, error: 'manifest.json 缺少 modInfo 字段' });
        return;
      }

      const info = manifest.modInfo;
      if (info.enabled === false) {
        console.log(`[ModLoader] 模组已禁用，跳过: ${info.name || dirName}`);
        return;
      }

      // v2.4.4: API 版本兼容性检查
      if (info.apiVersion && typeof ModAPI !== 'undefined' && !ModAPI.checkVersion(info.apiVersion)) {
        console.warn(`[ModLoader] 模组 "${info.name}" 要求 API >= ${info.apiVersion}，当前为 ${ModAPI.version}，跳过加载`);
        this.failed.push({ id: dirName, error: `API 版本不兼容 (要求 ${info.apiVersion}, 当前 ${ModAPI.version})` });
        return;
      }

      // v2.4.4: 依赖检查
      if (info.dependencies && Array.isArray(info.dependencies)) {
        for (const dep of info.dependencies) {
          if (!this.loaded.find(m => m.id === dep)) {
            console.warn(`[ModLoader] 模组 "${info.name}" 依赖 "${dep}"，但该模组尚未加载，跳过`);
            this.failed.push({ id: dirName, error: `缺少依赖模组: ${dep}` });
            return;
          }
        }
      }

      console.log(`[ModLoader] 加载模组: ${info.name} v${info.version} by ${info.author}`);

      // ===== 加载数据文件 =====
      let data = {};
      const dataFile = manifest.data || (info.id || dirName) + '.json';

      if (typeof dataFile === 'string') {
        data = await this._fetchJSON(modPath + dataFile).catch(() => ({}));
      } else if (Array.isArray(dataFile)) {
        for (const file of dataFile) {
          try {
            const part = await this._fetchJSON(modPath + file);
            data = { ...data, ...part };
          } catch (e) {
            console.warn(`[ModLoader] ${dirName}: 加载子文件 ${file} 失败: ${e.message}`);
          }
        }
      }

      // 内联数据兼容
      if ((!data || Object.keys(data).length === 0) && !manifest.data) {
        const hasInlineData = ['buildings','palette','events','personalEvents','achievements',
          'cityLevels','policies','investments','corruptionActions','zones','roads',
          'transits','guidance','names'].some(k => manifest[k]);
        if (hasInlineData) data = manifest;
      }

      // ===== 注册数据模块 =====
      let stats = {};
      if (data.buildings)       { this._registerBuildings(data.buildings, info.id || dirName); stats.buildings = data.buildings.length; }
      if (data.palette)         { this._registerPalette(data.palette, info.id || dirName); stats.palette = data.palette.length; }
      if (data.events)          { this._registerEvents(data.events, info.id || dirName); stats.events = data.events.length; }
      if (data.personalEvents)  { this._registerPersonalEvents(data.personalEvents, info.id || dirName); stats.personalEvents = data.personalEvents.length; }
      if (data.achievements)    { this._registerAchievements(data.achievements, info.id || dirName); stats.achievements = data.achievements.length; }
      if (data.cityLevels)      { this._registerCityLevels(data.cityLevels, info.id || dirName); stats.cityLevels = data.cityLevels.length; }
      if (data.policies)        { this._registerPolicies(data.policies, info.id || dirName); stats.policies = data.policies.length; }
      if (data.investments)     { this._registerInvestments(data.investments, info.id || dirName); stats.investments = data.investments.length; }
      if (data.corruptionActions) { this._registerCorruptionActions(data.corruptionActions, info.id || dirName); stats.corruptionActions = data.corruptionActions.length; }
      if (data.zones)           { this._registerZones(data.zones, info.id || dirName); stats.zones = Object.keys(data.zones).length; }
      if (data.roads)           { this._registerRoads(data.roads, info.id || dirName); stats.roads = Object.keys(data.roads).length; }
      if (data.transits)        { this._registerTransits(data.transits, info.id || dirName); stats.transits = Object.keys(data.transits).length; }
      if (data.guidance)        { this._registerGuidance(data.guidance, info.id || dirName); stats.guidance = data.guidance.length; }
      if (data.names)           { this._registerNames(data.names, info.id || dirName); stats.names = 1; }

      // ===== [v2.3.0] 加载模组初始化脚本 =====
      let initResult = null;
      if (manifest.init || info.init) {
        const initFile = manifest.init || info.init || 'init.js';
        try {
          const scriptCode = await this._fetchText(modPath + initFile);
          initResult = this._executeModScript(scriptCode, info.id || dirName, info);
        } catch (e) {
          console.warn(`[ModLoader] ${dirName}: init.js 加载失败: ${e.message}`);
        }
      }

      // ===== [v2.3.0] 内联钩子注册（manifest 中的 hooks 字段） =====
      if (manifest.hooks && Array.isArray(manifest.hooks)) {
        this._registerInlineHooks(manifest.hooks, info.id || dirName);
        stats.hooks = manifest.hooks.length;
      }

      this.loaded.push({
        id: info.id || dirName,
        dir: dirName,
        info,
        stats,
        hasInit: !!initResult,
      });

    } catch (e) {
      console.error(`[ModLoader] 加载模组文件夹失败 [${dirName}]:`, e.message);
      this.failed.push({ id: dirName, error: e.message });
    }
  },

  // ========== 注册函数 ==========

  _registerBuildings(buildings, modId) {
    if (!this.modBuildings[modId]) this.modBuildings[modId] = [];
    for (const b of buildings) {
      if (!b.id || !b.def) {
        console.warn(`[ModLoader] ${modId}: 建筑缺少 id 或 def，跳过`);
        continue;
      }
      if (BUILDING_TYPES[b.id]) {
        console.warn(`[ModLoader] ${modId}: 建筑 '${b.id}' 已存在，跳过`);
        continue;
      }
      BUILDING_TYPES[b.id] = b.def;
      if (b.icon && typeof BUILDING_ICONS !== 'undefined') BUILDING_ICONS[b.id] = b.icon;
      this.modBuildings[modId].push(b.id);
    }
  },

  _registerPalette(categories, modId) {
    for (const cat of categories) {
      if (!cat.name || !cat.items) continue;
      const existing = PALETTE_CATEGORIES.find(c => c.name === cat.name);
      if (existing) {
        for (const item of cat.items) {
          if (!existing.items.includes(item)) existing.items.push(item);
        }
      } else {
        PALETTE_CATEGORIES.push(cat);
      }
    }
  },

  _registerEvents(events, modId) {
    for (const ev of events) {
      if (!ev.id) { console.warn(`[ModLoader] ${modId}: 事件缺少 id`); continue; }
      if (!ev.title || !ev.choices || !ev.choices.length) {
        console.warn(`[ModLoader] ${modId}: 事件 '${ev.id}' 缺少 title 或 choices`);
        continue;
      }
      if (typeof ev.desc === 'string' && ev.desc.startsWith('function')) {
        ev.desc = eval('(' + ev.desc + ')');
      }
      if (typeof ev.condition === 'string' && ev.condition.startsWith('function')) {
        ev.condition = eval('(' + ev.condition + ')');
      }
      if (typeof ev.weight === 'string' && ev.weight.startsWith('function')) {
        ev.weight = eval('(' + ev.weight + ')');
      }
      if (typeof ev.postEffect === 'string' && ev.postEffect.startsWith('function')) {
        ev.postEffect = eval('(' + ev.postEffect + ')');
      }
      ev._modId = modId;
      // v2.3.0: 去重 — 同 id 事件替换而非追加，避免 reloadMods 后重复
      const existIdx = EVENT_POOL.findIndex(e => e.id === ev.id);
      if (existIdx >= 0) EVENT_POOL[existIdx] = ev;
      else EVENT_POOL.push(ev);
    }
  },

  _registerPersonalEvents(events, modId) {
    for (const ev of events) {
      if (!ev.id) { console.warn(`[ModLoader] ${modId}: 个人事件缺少 id`); continue; }
      if (typeof ev.desc === 'string' && ev.desc.startsWith('function')) {
        ev.desc = eval('(' + ev.desc + ')');
      }
      ev._modId = modId;
      // v2.3.0: 去重 — 同 id 事件替换而非追加
      const existIdx = PERSONAL_EVENTS.findIndex(e => e.id === ev.id);
      if (existIdx >= 0) PERSONAL_EVENTS[existIdx] = ev;
      else PERSONAL_EVENTS.push(ev);
    }
  },

  _registerAchievements(achievements, modId) {
    for (const ach of achievements) {
      if (!ach.id) { console.warn(`[ModLoader] ${modId}: 成就缺少 id`); continue; }
      if (typeof ach.check === 'string' && ach.check.startsWith('function')) {
        ach.check = eval('(' + ach.check + ')');
      }
      ach._modId = modId;
      // v2.3.0: 去重 — 同 id 成就替换而非追加
      const existIdx = ACHIEVEMENTS.findIndex(a => a.id === ach.id);
      if (existIdx >= 0) ACHIEVEMENTS[existIdx] = ach;
      else ACHIEVEMENTS.push(ach);
    }
  },

  _registerCityLevels(levels, modId) {
    for (const lv of levels) {
      if (lv.id === undefined) { console.warn(`[ModLoader] ${modId}: 城市等级缺少 id`); continue; }
      const idx = CITY_LEVELS.findIndex(c => c.id === lv.id);
      if (idx >= 0) {
        CITY_LEVELS[idx] = Object.assign(CITY_LEVELS[idx], lv);
      } else {
        CITY_LEVELS.push(lv);
        CITY_LEVELS.sort((a, b) => a.id - b.id);
      }
    }
  },

  _registerPolicies(policies, modId) {
    for (const p of policies) {
      if (!p.id) continue;
      // v2.4.4: 通过 macro 标志判断是否为宏观政策，而非硬编码 ID 列表
      const isMacro = p.macro === true;
      const target = isMacro ? MACRO_POLICY_OPTIONS : POLICY_OPTIONS;
      const exists = target.find(o => o.id === p.id);
      if (exists) {
        Object.assign(exists, p);
      } else {
        p._modId = modId;
        target.push(p);
      }
      if (gameState.policies && gameState.policies[p.id] === undefined && p.default !== undefined) {
        gameState.policies[p.id] = p.default;
      }
    }
  },

  _registerInvestments(investments, modId) {
    for (const inv of investments) {
      if (!inv.id) continue;
      if (!INVESTMENT_OPTIONS.find(i => i.id === inv.id)) {
        inv._modId = modId;
        INVESTMENT_OPTIONS.push(inv);
      }
    }
  },

  _registerCorruptionActions(actions, modId) {
    for (const act of actions) {
      if (!act.id) continue;
      if (!CORRUPTION_ACTIONS.find(a => a.id === act.id)) {
        act._modId = modId;
        CORRUPTION_ACTIONS.push(act);
      }
    }
  },

  _registerZones(zones, modId) {
    for (const [key, def] of Object.entries(zones)) {
      if (ZONE_TYPES[key]) {
        if (def.subTypes) {
          if (!ZONE_TYPES[key].subTypes) ZONE_TYPES[key].subTypes = {};
          for (const [subKey, sub] of Object.entries(def.subTypes)) {
            if (!ZONE_TYPES[key].subTypes[subKey]) {
              ZONE_TYPES[key].subTypes[subKey] = sub;
            }
          }
        }
      } else {
        ZONE_TYPES[key] = def;
      }
    }
  },

  _registerRoads(roads, modId) {
    for (const [key, def] of Object.entries(roads)) {
      if (!ROAD_TYPES[key]) ROAD_TYPES[key] = def;
    }
  },

  _registerTransits(transits, modId) {
    for (const [key, def] of Object.entries(transits)) {
      if (!TRANSIT_TYPES[key]) TRANSIT_TYPES[key] = def;
    }
  },

  _registerGuidance(guidance, modId) {
    for (const g of guidance) {
      if (g.text && g.icon) {
        g._modId = modId;
        POSITIVE_GUIDANCE.push(g);
      }
    }
  },

  _registerNames(names, modId) {
    if (names.surnames) {
      for (const n of names.surnames) {
        if (!SURNAMES.includes(n)) SURNAMES.push(n);
      }
    }
    if (names.givenNames) {
      for (const n of names.givenNames) {
        if (!GIVEN_NAMES.includes(n)) GIVEN_NAMES.push(n);
      }
    }
    if (names.cityPrefixes) {
      for (const n of names.cityPrefixes) {
        if (!CITY_PREFIXES.includes(n)) CITY_PREFIXES.push(n);
      }
    }
    if (names.citySuffixes) {
      for (const n of names.citySuffixes) {
        if (!CITY_SUFFIXES.includes(n)) CITY_SUFFIXES.push(n);
      }
    }
  },

  // ===== [v2.3.0] init.js 脚本执行 =====

  /**
   * 在受控沙箱中执行模组初始化脚本
   * v2.4.4: 扩展注入的全局变量，使模组能访问更多游戏数据
   */
  _executeModScript(code, modId, modInfo) {
    try {
      const wrappedCode = `
        (function(ModAPI, BUILDING_TYPES, ZONE_TYPES, ROAD_TYPES, TRANSIT_TYPES,
                   EVENT_POOL, INVESTMENT_OPTIONS, CORRUPTION_ACTIONS, POSITIVE_GUIDANCE,
                   SURNAMES, GIVEN_NAMES, CITY_PREFIXES, CITY_SUFFIXES,
                   ACHIEVEMENTS, PERSONAL_EVENTS, CITY_LEVELS, PALETTE_CATEGORIES,
                   AIRPORT_CLASSES, STATION_GRADES, BUILDING_FACILITIES, PUBLIC_BUILDING_TYPES,
                   getAirportClass, getStationGrade, generateAirportName,
                   gameState, console) {
          "use strict";
          ${code}
        })
      `;
      const fn = eval(wrappedCode);
      fn(ModAPI, BUILDING_TYPES, ZONE_TYPES, ROAD_TYPES, TRANSIT_TYPES,
         EVENT_POOL, INVESTMENT_OPTIONS, CORRUPTION_ACTIONS, POSITIVE_GUIDANCE,
         SURNAMES, GIVEN_NAMES, CITY_PREFIXES, CITY_SUFFIXES,
         ACHIEVEMENTS, PERSONAL_EVENTS, CITY_LEVELS, PALETTE_CATEGORIES,
         AIRPORT_CLASSES, STATION_GRADES, BUILDING_FACILITIES, PUBLIC_BUILDING_TYPES,
         getAirportClass, getStationGrade, generateAirportName,
         gameState, console);
      this._modScripts[modId] = true;
      console.log(`[ModLoader] ${modId}: init.js 执行成功`);
      return true;
    } catch (e) {
      console.error(`[ModLoader] ${modId}: init.js 执行失败:`, e.message);
      return false;
    }
  },

  /**
   * 注册 manifest 中内联声明的钩子
   * hooks: [{ hook: 'cityGen:afterRoads', fn: 'function(ctx) { ... }' }, ...]
   */
  _registerInlineHooks(hooks, modId) {
    for (const h of hooks) {
      if (!h.hook || !h.fn) continue;
      try {
        const fn = typeof h.fn === 'function' ? h.fn : eval('(' + h.fn + ')');
        ModAPI.hooks.on(h.hook, fn, { priority: h.priority || 0 });
      } catch (e) {
        console.warn(`[ModLoader] ${modId}: 钩子 "${h.hook}" 注册失败:`, e.message);
      }
    }
  },

  // ========== 工具函数 ==========

  async _fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    return await resp.json();
  },

  async _fetchText(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    return await resp.text();
  },

  _printSummary() {
    if (this.loaded.length === 0 && this.failed.length === 0) return;
    if (this.loaded.length > 0) {
      console.log(`[ModLoader] ✅ 成功加载 ${this.loaded.length} 个模组:`);
      for (const m of this.loaded) {
        const parts = [];
        for (const [k, v] of Object.entries(m.stats || {})) {
          if (v > 0) parts.push(`${k}:${v}`);
        }
        if (m.hasInit) parts.push('init.js');
        console.log(`  📦 ${m.info.name} v${m.info.version}${parts.length ? ' (' + parts.join(', ') + ')' : ''}`);
      }
    }
    if (this.failed.length > 0) {
      console.warn(`[ModLoader] ❌ ${this.failed.length} 个模组加载失败:`);
      for (const f of this.failed) {
        console.warn(`  - ${f.id}: ${f.error}`);
      }
    }
  }
};

// 兼容旧代码的全局快捷函数
function reloadMods() {
  return ModLoader.init();
}
