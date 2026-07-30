/* 《置身事内》v2.2.0 - 农业系统数据模块
 * 提供：5 类农业建筑、农业画笔分区、地形增益表、城市化等级、耕地红线配置
 * 设计原则：最小耦合，通过 Object.assign 合并到全局 BUILDING_TYPES/ZONE_TYPES/PALETTE_CATEGORIES
 * 数值依据：每格 2500 ㎡ = 0.25 公顷 = 3.75 亩；参考 2024 年中国三产占比 6.8% / 36.5% / 56.7%、城镇化率 67%
 */

// 每格地块面积（平方米）—— 2500 ㎡ = 0.25 公顷 = 3.75 亩
const AGRI_LAND_AREA_PER_CELL = 2500;

// 农业建筑定义（合并到 BUILDING_TYPES）
// farmland/forest/pasture/fishpond：可用画笔涂抹（农业区 subType）
// ruralHouse：单点建筑，不进画笔分区
const AGRI_BUILDING_TYPES = {
  farmland: {
    name: '农田', cat: 'agriculture', shortName: '田', layer: 'ground',
    cost: 8, color: '#b5d478', size: 1,
    desc: '种植粮食作物，提供基础农业就业与GDP。地形敏感：草地+20%、河畔+15%、沙地-40%、山地-70%。靠天吃饭，维护极低',
    // v2.2.8c: 大幅调低需水量（农田靠天吃饭，基本不需要供给）
    eff: { pop: 0, jobs: 3, gdp: 5, airPol: 0, waterPol: 0.3, green: 1, water: -1, happiness: 0.5 },
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 17c3-2 6-2 9 0s6 2 9 0M3 13c3-2 6-2 9 0s6 2 9 0M5 9c2-1 4-1 6 0M14 9c2-1 4-1 4 0"/></svg>',
  },
  forest: {
    name: '林地', cat: 'agriculture', shortName: '林', layer: 'ground',
    cost: 12, color: '#3a7d44', size: 1,
    desc: '经济林与生态林，固碳释氧净化空气。森林地形+50%产能，山地+30%',
    // v2.2.8c: 调低需水量
    eff: { pop: 0, jobs: 1, gdp: 4, airPol: -2, waterPol: -0.3, green: 3, water: -1, happiness: 1 },
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L7 9h3l-4 6h5v7h2v-7h5l-4-6h3z"/></svg>',
  },
  pasture: {
    name: '牧业地块', cat: 'agriculture', shortName: '牧', layer: 'ground',
    cost: 10, color: '#8fbf6a', size: 1,
    desc: '畜牧养殖，提供肉蛋奶。草地+30%产能，坡地+10%，伴有水污染',
    // v2.2.8c: 调低需水量
    eff: { pop: 0, jobs: 2, gdp: 6, airPol: 0.5, waterPol: 0.8, green: 0.5, water: -2, happiness: 0.5 },
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18c0-3 2-5 4-5s2 2 4 2 2-2 4-2 4 2 4 5M6 13c0-4 2-7 6-7s6 3 6 7M9 8V5M15 8V5"/></svg>',
  },
  fishpond: {
    name: '鱼塘', cat: 'agriculture', shortName: '鱼', layer: 'ground',
    cost: 15, color: '#4a9eb8', size: 1,
    desc: '水产养殖，需近水源。浅滩/河畔+30%产能，耗水量较大',
    // v2.2.8c: 调低需水量（原-10，现-4）
    eff: { pop: 0, jobs: 2, gdp: 7, airPol: 0, waterPol: 0.5, green: 0.5, water: -4, happiness: 1 },
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14c3-2 6-2 9 0s6 2 9 0M2 18c3-2 6-2 9 0s6 2 9 0M9 8c0-2 2-4 4-4M14 7c1 0 2 1 2 2"/></svg>',
  },
  ruralHouse: {
    name: '农村民居', cat: 'residential', shortName: '农', layer: 'ground',
    cost: 30, color: '#c9a877', size: 1,
    desc: '农村自建房，提供人口与少量GDP，单点建造，附带农业人口',
    // v2.2.8c: 调低需水量
    eff: { pop: 100, jobs: 0, gdp: 1, airPol: 0, waterPol: 0, green: 0.3, water: -1, power: -3, happiness: 1 },
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V11l8-6 8 6v10M9 21v-6h6v6M9 11h0M15 11h0"/></svg>',
  },
};

// 农业画笔分区（合并到 ZONE_TYPES）
const AGRI_ZONE_TYPES = {
  agriculture: {
    name: '农业区', color: 'rgba(165, 200, 100, 0.35)', borderColor: 'rgba(120, 160, 70, 0.8)',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 17c3-2 6-2 9 0s6 2 9 0M5 13c2-1 4-1 6 0M14 13c2-1 4-1 4 0"/></svg>',
    subTypes: {
      farmland: { name: '农田', buildingType: 'farmland', costPerCell: 8 },
      forest: { name: '林地', buildingType: 'forest', costPerCell: 12 },
      pasture: { name: '牧业', buildingType: 'pasture', costPerCell: 10 },
      fishpond: { name: '鱼塘', buildingType: 'fishpond', costPerCell: 15 },
    },
  },
};

// 农业地块在地形上的产能增益系数（乘到 eff.gdp / eff.jobs）
// 键为 BUILDING_TYPES 的 type，值为 { terrainKey: multiplier }
// terrain 取自 mapCells[y*MAP_W+x].terrain，见 terrain.js getTerrainType()
const AGRI_TERRAIN_BONUS = {
  farmland: {
    grass: 1.20, river: 1.15, shallow: 0.60, sand: 0.60,
    forest: 0.80, hill: 0.80, mountain: 0.30, highMountain: 0.20,
    snow: 0.10, deepWater: 0, water: 0,
  },
  forest: {
    forest: 1.50, mountain: 1.30, hill: 1.20, grass: 1.00,
    river: 0.90, shallow: 0.50, sand: 0.40, highMountain: 0.60, snow: 0.30,
    deepWater: 0, water: 0,
  },
  pasture: {
    grass: 1.30, hill: 1.10, forest: 0.80, river: 1.00,
    sand: 0.50, mountain: 0.40, shallow: 0.60, highMountain: 0.30, snow: 0.20,
    deepWater: 0, water: 0,
  },
  fishpond: {
    shallow: 1.30, river: 1.25, grass: 0.90, forest: 0.70,
    hill: 0.50, mountain: 0.30, sand: 0.60, highMountain: 0.20, snow: 0.10,
    deepWater: 0, water: 0,
  },
  ruralHouse: {
    grass: 1.10, river: 1.00, forest: 0.90, hill: 0.90,
    sand: 0.80, mountain: 0.60, shallow: 0.50, highMountain: 0.40, snow: 0.30,
    deepWater: 0, water: 0,
  },
};

// 城市化等级分档（按非农就业占比 = 1 - 农业就业/总就业）
// 参考：中国 2024 年城镇化率 67%；乡镇级初始多在 30% 以下
const URBANIZATION_LEVELS = [
  { id: 0, key: 'rural', name: '农业主导', min: 0, max: 0.30,
    desc: '<30%',
    farmlandRedlineRatio: 0.30,
  },
  { id: 1, key: 'transition', name: '城镇化中', min: 0.30, max: 0.60,
    desc: '30-60%',
    farmlandRedlineRatio: 0.22,
  },
  { id: 2, key: 'urban', name: '高度城镇化', min: 0.60, max: 1.01,
    desc: '>60%',
    farmlandRedlineRatio: 0.15,
  },
];

// 初始地图生成时按城市等级抽取目标城市化等级
// 城市等级越高，抽取的城市化等级越高（与初始人口/产业规模相匹配）
// 返回 { levelId, minRatio, maxRatio } 供 city-gen 控制农田与城市建筑配比
function pickInitialUrbanizationLevel(cityLevelId) {
  // 权重表：行=城市等级，列=城市化等级 id（0/1/2）
  // 乡镇(0) 偏向农业主导；县城(1) 偏向城镇化发展；地级市+(2+) 偏向高度城镇化
  const weights = [
    [0.70, 0.25, 0.05], // 乡镇
    [0.25, 0.55, 0.20], // 县城
    [0.10, 0.40, 0.50], // 地级市
    [0.05, 0.20, 0.75], // 省会
    [0.02, 0.08, 0.90], // 直辖市
  ];
  const w = weights[Math.max(0, Math.min(cityLevelId, 4))];
  const r = Math.random();
  let acc = 0, levelId = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    if (r < acc) { levelId = i; break; }
  }
  const lv = URBANIZATION_LEVELS[levelId];
  // 在等级区间内取一个偏中位的目标值，保证生成的农田数量落在合理区间
  const targetRatio = (lv.min + lv.max) / 2 * (0.85 + Math.random() * 0.3);
  return { levelId, targetUrbanRatio: Math.min(lv.max - 0.01, Math.max(lv.min, targetRatio)) };
}

// 耕地红线违规处分梯度（按连续违规月数触发，每档只触发一次）
// 参考：党纪处分条例——警告、严重警告、撤销党内职务、留党察看、开除党籍
const FARMLAND_REDLINE_PENALTY = [
  { months: 1,  inspect: 2,  merit: -1,  reputation: -1, msg: '耕地面积低于红线，自然资源局下发整改通知' },
  { months: 3,  inspect: 5,  merit: -3,  reputation: -2, msg: '连续3月耕地不足，纪委关注上升' },
  { months: 6,  inspect: 10, merit: -6,  reputation: -4, msg: '连续半年耕地违规，受到党内警告处分', redLetter: 'warning' },
  { months: 12, inspect: 20, merit: -12, reputation: -8, msg: '长期突破耕地红线，受到严重警告处分', redLetter: 'warning' },
];

// ===== 合并到全局对象（最小侵入，复用现有数据结构） =====
Object.assign(BUILDING_TYPES, AGRI_BUILDING_TYPES);
Object.assign(ZONE_TYPES, AGRI_ZONE_TYPES);
PALETTE_CATEGORIES.push({
  id: 'agriculture', name: '农业地块', icon: ICON.tree,
  items: ['farmland', 'forest', 'pasture', 'fishpond'],
});
PALETTE_CATEGORIES.push({
  id: 'rural', name: '农村建筑', icon: ICON.home,
  items: ['ruralHouse'],
});

// ===== 工具函数（供 simulation/city-gen/UI 调用） =====

// 查询农业建筑的地形增益系数（非农业建筑返回 1）
function getAgriTerrainBonus(type, terrain) {
  const bonus = AGRI_TERRAIN_BONUS[type];
  if (!bonus) return 1;
  return bonus[terrain] !== undefined ? bonus[terrain] : 1;
}

// 判断建筑是否为农业地块（不含农村民居）
function isAgriPlot(type) {
  return type === 'farmland' || type === 'forest' || type === 'pasture' || type === 'fishpond';
}

// 判断建筑是否属于第一产业（农业，含农村民居附带产值）
function isPrimarySector(type) {
  return !!AGRI_BUILDING_TYPES[type];
}

// 根据非农就业比返回城市化等级对象
function getUrbanizationLevel(ratio) {
  ratio = clamp(ratio || 0, 0, 1);
  for (const lv of URBANIZATION_LEVELS) {
    if (ratio >= lv.min && ratio < lv.max) return lv;
  }
  return URBANIZATION_LEVELS[URBANIZATION_LEVELS.length - 1];
}

// 计算当前农业就业总数（供 simulation 复用）
function calcAgriJobs(buildings) {
  let jobs = 0;
  for (const b of buildings) {
    if (b.underConstruction) continue;
    if (!isPrimarySector(b.type)) continue;
    const def = BUILDING_TYPES[b.type];
    if (!def) continue;
    jobs += (def.eff.jobs || 0);
  }
  return jobs;
}

// 计算当前耕地格数（仅 farmland 计入耕地红线）
function calcFarmlandArea(buildings) {
  let cells = 0;
  for (const b of buildings) {
    if (b.underConstruction) continue;
    if (b.type === 'farmland') cells++;
  }
  return cells;
}

// 计算总可建格数（剔除水域与高山）
function calcBuildableArea(mapCellsArr) {
  if (!mapCellsArr || !mapCellsArr.length) return 0;
  let cells = 0;
  for (const c of mapCellsArr) {
    if (c.isWater) continue;
    if (c.elevation > 500) continue; // 高山/雪山不计
    cells++;
  }
  return cells;
}

// 面积格式化（保留用于地块面积提示；耕地红线按格显示）
function formatArea(m2) {
  if (!m2 || m2 <= 0) return '0 ㎡';
  if (m2 < 10000) return Math.round(m2) + ' ㎡';
  if (m2 < 1000000) return Math.round(m2 / 666.67) + ' 亩';
  return (m2 / 6666667).toFixed(2) + ' 万亩';
}
