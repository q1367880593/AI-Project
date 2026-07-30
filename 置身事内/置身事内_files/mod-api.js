/* ============================================================
   置身事内 v2.4.7 — 模组 API 核心层 (Mod API)
   ============================================================
   提供模组开发者使用的完整接口：
   - HookRegistry: 钩子注册与调用系统
   - EventBus:     游戏事件总线
   - ModDataAPI:   数据查询与操作接口

   使用方式（模组 init.js 中）：
   ```js
   // 注册钩子
   ModAPI.hooks.on('cityGen:afterRoads', (ctx) => {
     ctx.roads.push(...); // 添加自定义道路
   });

   // 订阅事件
   ModAPI.events.on('monthEnd', (state) => {
     console.log('月末人口:', state.population);
   });

   // 查询数据
   const count = ModAPI.data.countBuildings('lowRes');
   ```
   ============================================================ */

const ModAPI = (() => {
  /* ==========================================================
     HookRegistry — 钩子注册与调用
     支持 before / after / instead 三种钩子类型
     ========================================================== */
  const HookRegistry = {
    _hooks: {},

    /**
     * 注册钩子
     * @param {string} hookName 钩子名称，如 'cityGen:afterRoads'
     * @param {Function} fn      回调函数 (ctx) => void
     * @param {object}  opts     { priority: number, once: boolean }
     * @returns {string} hookId  用于取消注册
     */
    on(hookName, fn, opts = {}) {
      if (!this._hooks[hookName]) this._hooks[hookName] = [];
      const id = 'hook_' + Math.random().toString(36).slice(2, 10);
      this._hooks[hookName].push({ id, fn, priority: opts.priority || 0, once: !!opts.once });
      this._hooks[hookName].sort((a, b) => b.priority - a.priority);
      return id;
    },

    /**
     * 注册一次性钩子
     */
    once(hookName, fn, opts = {}) {
      return this.on(hookName, fn, { ...opts, once: true });
    },

    /**
     * 取消注册
     */
    off(hookName, hookId) {
      const list = this._hooks[hookName];
      if (!list) return;
      this._hooks[hookName] = list.filter(h => h.id !== hookId);
    },

    /**
     * 触发钩子（顺序调用，支持异步）
     * @param {string} hookName
     * @param {object} ctx       上下文对象（钩子可修改）
     * @returns {Promise<object>} 修改后的 ctx
     */
    async call(hookName, ctx = {}) {
      const list = this._hooks[hookName];
      if (!list || list.length === 0) return ctx;

      const toRemove = [];
      for (const h of list) {
        try {
          await h.fn(ctx);
        } catch (e) {
          console.warn(`[ModAPI] Hook "${hookName}" 执行失败:`, e.message);
        }
        if (h.once) toRemove.push(h.id);
      }
      // 清理一次性钩子
      for (const id of toRemove) this.off(hookName, id);
      return ctx;
    },

    /**
     * 同步触发（不等待异步）
     */
    callSync(hookName, ctx = {}) {
      const list = this._hooks[hookName];
      if (!list || list.length === 0) return ctx;

      const toRemove = [];
      for (const h of list) {
        try { h.fn(ctx); } catch (e) {
          console.warn(`[ModAPI] Hook "${hookName}" 执行失败:`, e.message);
        }
        if (h.once) toRemove.push(h.id);
      }
      for (const id of toRemove) this.off(hookName, id);
      return ctx;
    },

    /**
     * 列出已注册的钩子
     */
    list(hookName) {
      if (hookName) return (this._hooks[hookName] || []).map(h => ({ id: h.id, priority: h.priority }));
      const result = {};
      for (const [name, list] of Object.entries(this._hooks)) {
        result[name] = list.length;
      }
      return result;
    },

    /**
     * 清除某个钩子的所有注册
     */
    clear(hookName) {
      if (hookName) delete this._hooks[hookName];
      else this._hooks = {};
    }
  };

  /* ==========================================================
     EventBus — 游戏事件总线
     支持通配符订阅 'month:*' 匹配所有 month 前缀事件
     ========================================================== */
  const EventBus = {
    _listeners: {},

    /**
     * 订阅事件
     * @param {string}   event  事件名，如 'monthEnd', 'building:placed'
     * @param {Function} fn     回调 (payload) => void
     * @returns {Function}      取消订阅函数
     */
    on(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(fn);
      return () => this.off(event, fn);
    },

    /**
     * 取消订阅
     */
    off(event, fn) {
      const list = this._listeners[event];
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },

    /**
     * 发送事件
     */
    emit(event, payload = {}) {
      // 精确匹配
      const list = this._listeners[event];
      if (list) {
        for (const fn of list) {
          try { fn(payload); } catch (e) {
            console.warn(`[ModAPI] Event "${event}" 处理失败:`, e.message);
          }
        }
      }
      // 通配符匹配 'xxx:*'
      const wildcard = event.replace(/:.*$/, ':*');
      if (wildcard !== event) {
        const wcList = this._listeners[wildcard];
        if (wcList) {
          for (const fn of wcList) {
            try { fn(payload); } catch (e) {
              console.warn(`[ModAPI] Event "${wildcard}" 处理失败:`, e.message);
            }
          }
        }
      }
    },

    /**
     * 清除所有监听
     */
    clear(event) {
      if (event) delete this._listeners[event];
      else this._listeners = {};
    }
  };

  /* ==========================================================
     ModDataAPI — 数据查询与操作接口
     只读查询 + 受控写入，保护游戏状态完整性
     ========================================================== */
  const DataAPI = {
    /** 获取当前游戏状态（直接引用，修改需谨慎） */
    getState() {
      return gameState;
    },

    /** 获取地图数据 */
    getMap() {
      return { cells: mapCells, w: MAP_W, h: MAP_H, cellSize: CELL };
    },

    /** 查询指定类型的建筑数量 */
    countBuildings(type) {
      if (!type) return gameState.buildings.length;
      return gameState.buildings.filter(b => b.type === type).length;
    },

    /** 查询指定坐标的建筑 */
    getBuildingAt(x, y) {
      return gameState.buildings.filter(b => b.x === x && b.y === y);
    },

    /** 查询指定坐标的道路 */
    getRoadAt(x, y) {
      for (const r of gameState.roads) {
        if (r.cells.some(c => c.x === x && c.y === y)) return r;
      }
      return null;
    },

    /** 获取所有建筑类型定义 */
    getBuildingTypes() {
      return BUILDING_TYPES;
    },

    /** 获取所有区域类型定义 */
    getZoneTypes() {
      return ZONE_TYPES;
    },

    /** 获取道路类型定义 */
    getRoadTypes() {
      return ROAD_TYPES;
    },

    /** 获取交通类型定义 */
    getTransitTypes() {
      return TRANSIT_TYPES;
    },

    /** 获取当前城市等级 */
    getCityLevel() {
      return getCityLevel ? getCityLevel() : CITY_LEVELS[gameState.cityLevelId];
    },

    /** 获取企业列表 */
    getEnterprises() {
      return gameState.enterprises || [];
    },

    /** 获取当前政策值 */
    getPolicies() {
      return gameState.policies || {};
    },

    /** 获取游戏时间信息 */
    getGameTime() {
      return { year: gameState.year, month: gameState.month, turn: gameState.turn };
    },

    /** 获取事件日志 */
    getEventLog(turns) {
      const logs = gameState.eventLog || [];
      if (!turns) return logs;
      return logs.filter(e => e.turn >= gameState.turn - turns);
    },

    /** 安全地向 buildings 添加建筑（会检查冲突） */
    addBuilding(building) {
      if (!building || !building.type) return false;
      const def = BUILDING_TYPES[building.type];
      if (!def) return false;
      // 检查位置是否已被占用
      for (const b of gameState.buildings) {
        if (b.x === building.x && b.y === building.y && b.layer === (building.layer || def.layer)) return false;
      }
      const newB = {
        x: building.x, y: building.y,
        type: building.type,
        layer: building.layer || def.layer || 'ground',
        age: building.age || 0,
      };
      // v2.4.7b: 公共建筑初始化 level/facilities
      const isPublic = typeof PUBLIC_BUILDING_TYPES !== 'undefined' && PUBLIC_BUILDING_TYPES.includes(building.type);
      if (isPublic) {
        newB.level = building.level || 1;
        newB.facilities = building.facilities || [];
        newB.branchOf = building.branchOf || null;
      }
      // v2.4.7b: 交通建筑特有属性初始化
      if (building.type === 'airport') {
        const runwayLen = building.runwayLength || 6;
        const cls = typeof getAirportClass === 'function' ? getAirportClass(runwayLen) : { code: '2C', tradeMult: 0.5 };
        newB.runwayLength = runwayLen;
        newB.runwayCells = building.runwayCells || [];
        newB.airportClass = cls.code;
        newB.isInternational = building.isInternational || false;
        newB.passengerFlow = building.passengerFlow || Math.floor(runwayLen * 100 * (0.5 + Math.random() * 0.5));
        newB.tradeIncome = building.tradeIncome || cls.tradeMult * 10;
        newB.customName = building.customName || (typeof generateAirportName === 'function' ? generateAirportName(gameState.cityName, false) : '机场');
      } else if (building.type === 'railwayStation' || building.type === 'hsrStation') {
        const grade = typeof getStationGrade === 'function' ? getStationGrade(gameState.population) : { code: '三等站', capacity: 5000 };
        newB.stationGrade = building.stationGrade || grade.code;
        newB.passengerFlow = building.passengerFlow || Math.floor(grade.capacity * (0.5 + Math.random() * 0.5));
        newB.customName = building.customName || `${(gameState.cityName || '').replace(/[镇县城市区]+$/, '')}${building.type === 'hsrStation' ? '高铁' : '火车'}站`;
      } else if (building.type === 'port') {
        newB.passengerFlow = building.passengerFlow || Math.floor(500 * (0.5 + Math.random() * 0.5));
        newB.customName = building.customName || `${(gameState.cityName || '').replace(/[镇县城市区]+$/, '')}港`;
      }
      gameState.buildings.push(newB);
      return true;
    },

    /** 添加道路 */
    addRoad(road) {
      if (!road || !road.cells || road.cells.length < 2) return false;
      const grade = road.grade || 'street';
      const name = road.name || (typeof generateRoadName === 'function' ? generateRoadName(grade) : '无名路');
      const r = { id: 'road_' + (++paintIdCounter), grade, cells: road.cells, name };
      gameState.roads.push(r);
      return r;
    },

    /** 添加区域 */
    addZone(zone) {
      if (!zone || !zone.cells || zone.cells.length < 2) return false;
      const z = {
        id: 'zone_' + (++paintIdCounter),
        type: zone.type,
        subType: zone.subType || 'low',
        cells: zone.cells,
        name: zone.name || '新区',
        shops: [],
      };
      if (typeof generateZoneBuildings === 'function') {
        generateZoneBuildings(z);
      }
      gameState.zones.push(z);
      return z;
    },

    /** 获取财政数据 */
    getFinance() {
      return {
        treasury: gameState.treasury,
        monthlyRevenue: gameState.monthlyRevenue,
        monthlyExpenditure: gameState.monthlyExpenditure,
        loans: gameState.loans,
      };
    },

    /** 获取人口数据 */
    getDemographics() {
      return {
        population: gameState.population,
        populationGrowth: gameState.populationGrowth,
        happiness: gameState.happiness,
        unemployment: gameState.unemployment,
      };
    },

    /** 写入事件日志（供模组记录自定义事件） */
    logEvent(text, type) {
      if (typeof logEvent === 'function') logEvent(text, type);
    },

    /** 显示通知（供模组向玩家提示） */
    notify(text, type) {
      if (typeof showNotification === 'function') showNotification(text, type);
    },

    // v2.4.7b: 交通系统数据查询接口
    /** 获取所有交通建筑（火车站、高铁站、机场、港口） */
    getTransportBuildings() {
      return gameState.buildings.filter(b =>
        ['railwayStation', 'hsrStation', 'airport', 'port'].includes(b.type) && !b.underConstruction
      );
    },

    /** 查询审批状态: 'subway'/'lightRail'/'airport'/'university' */
    getApprovalState(type) {
      const map = { subway: 'subwayApproved', lightRail: 'lightRailApproved', airport: 'airportApproved', university: 'universityApproved' };
      const key = map[type];
      return key ? !!gameState[key] : false;
    },

    /** 获取交通建筑汇总统计 */
    getTransportStats() {
      const tbs = this.getTransportBuildings();
      let totalFlow = 0, totalTrade = 0;
      for (const b of tbs) {
        totalFlow += b.passengerFlow || 0;
        if (b.tradeIncome) totalTrade += b.tradeIncome;
      }
      return { count: tbs.length, totalFlow, totalTrade, buildings: tbs };
    },
  };

  /* ==========================================================
     内置钩子列表（文档用）
     ========================================================== */
  const BUILTIN_HOOKS = [
    // 城市生成阶段
    { name: 'cityGen:before',       desc: '城市生成开始前',                     ctx: '{ level, mapSize }' },
    { name: 'cityGen:afterTerrain', desc: '地形生成后',                          ctx: '{ cells, mapW, mapH }' },
    { name: 'cityGen:afterRoads',   desc: '道路网络生成后（可添加/修改道路）',   ctx: '{ roads, placedRoads }' },
    { name: 'cityGen:afterZones',   desc: '区域划分后（可添加/修改区域）',       ctx: '{ zones, occupied }' },
    { name: 'cityGen:afterBuildings', desc: '建筑放置后',                        ctx: '{ buildings, housingCapacity, jobCapacity }' },
    { name: 'cityGen:after',        desc: '城市生成完成后',                      ctx: '{ state }' },

    // 模拟阶段
    { name: 'sim:beforeMonth',      desc: '每月模拟开始前',                      ctx: '{ state, month, year }' },
    { name: 'sim:afterMonth',       desc: '每月模拟完成后',                      ctx: '{ state, month, year }' },
    { name: 'sim:beforeYear',       desc: '每年模拟开始前',                      ctx: '{ state, year }' },
    { name: 'sim:afterYear',        desc: '每年模拟完成后',                      ctx: '{ state, year }' },
    { name: 'sim:population',       desc: '人口计算时（可修改增长参数）',        ctx: '{ baseGrowth, growth, capacity }' },

    // 建筑事件
    { name: 'building:placed',      desc: '建筑放置后',                          ctx: '{ building, cell }' },
    { name: 'building:demolished',  desc: '建筑拆除后',                          ctx: '{ building, cell }' },
    { name: 'building:upgraded',    desc: '建筑升级后',                          ctx: '{ building, oldLevel, newLevel }' },

    // 渲染阶段
    { name: 'render:before',        desc: '渲染开始前',                          ctx: '{ canvas, ctx }' },
    { name: 'render:afterTerrain',  desc: '地形渲染后（可叠加自定义图层）',      ctx: '{ canvas, ctx, offscreenCanvas }' },
    { name: 'render:afterRoads',    desc: '道路渲染后',                          ctx: '{ canvas, ctx }' },
    { name: 'render:afterBuildings', desc: '建筑渲染后',                         ctx: '{ canvas, ctx }' },
    { name: 'render:afterUI',       desc: 'UI 渲染后',                           ctx: '{ canvas, ctx }' },

    // 存档
    { name: 'save:before',          desc: '存档前（可注入额外数据）',            ctx: '{ slot, gameState }' },
    { name: 'save:after',           desc: '存档后',                              ctx: '{ slot, gameState }' },
    { name: 'load:before',          desc: '读档前',                              ctx: '{ slot, data }' },
    { name: 'load:after',           desc: '读档后（可恢复模组状态）',            ctx: '{ slot, gameState }' },

    // 事件系统
    { name: 'event:trigger',        desc: '随机事件触发时',                      ctx: '{ event }' },
    { name: 'event:resolved',       desc: '随机事件处理后',                      ctx: '{ event, choiceIndex, choice }' },

    // v2.4.7b: 交通系统钩子
    { name: 'transport:approved',            desc: '交通建设获批时（地铁/轻轨/机场）',     ctx: '{ type, approved }' },
    { name: 'transport:internationalUpgraded', desc: '机场升格为国际机场后',                 ctx: '{ building, buildingIdx }' },
    { name: 'transport:stationGradeChanged',  desc: '车站等级随人口变化时',                 ctx: '{ building, oldGrade, newGrade }' },
    { name: 'transport:springFestival',      desc: '春运客流激增时',                       ctx: '{ stations, totalFlow, gdpBonus }' },
  ];

  /* ==========================================================
     公共 API
     ========================================================== */
  return {
    hooks: HookRegistry,
    events: EventBus,
    data: DataAPI,
    BUILTIN_HOOKS,

    /** 获取 API 版本 */
    version: '2.4.7',

    /**
     * 检查 API 版本兼容性
     * @param {string} required 模组要求的最低版本
     * @returns {boolean}
     */
    checkVersion(required) {
      if (!required) return true;
      const curr = this.version.split('.').map(Number);
      const req = required.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((curr[i] || 0) > (req[i] || 0)) return true;
        if ((curr[i] || 0) < (req[i] || 0)) return false;
      }
      return true;
    },

    /** 重置所有模组注册（用于新游戏/读档清理） */
    reset() {
      HookRegistry.clear();
      EventBus.clear();
    },
  };
})();

// 挂载到全局作用域
if (typeof window !== 'undefined') window.ModAPI = ModAPI;
