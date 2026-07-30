/* 源自《置身事内》单文件版 - 道路类型定义 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 道路类型定义 ==============
const ROAD_TYPES = {
  path:    { name: '小路',   width: 4,   color: '#c8c2b0', lineColor: '#a8a294', costPerCell: 5,  dashPattern: [] },
  street:  { name: '街道',   width: 7,   color: '#f0ebe0', lineColor: '#5a6a7a', costPerCell: 12, dashPattern: [] },
  avenue:  { name: '大道',   width: 11,  color: '#f2d870', lineColor: '#c89812', costPerCell: 25, dashPattern: [] },
  highway: { name: '高速公路', width: 15, color: '#e89058', lineColor: '#b85e20', costPerCell: 50, dashPattern: [4, 3] },
};

// v2.2.6: 公共交通类型定义（railmapgen风格单色线条）
// 地铁/轻轨颜色改为每条线路独立分配（参考郑州地铁色值）
// v2.2.7: 地铁/轻轨线路色值库（12色，用户指定HEX色值）
const TRANSIT_COLOR_LIBRARY = [
  '#D20200',
  '#D28F00',
  '#CB5100',
  '#3792D6',
  '#25AC74',
  '#852081',
  '#C0955A',
  '#E6E394',
  '#828C47',
  '#B15F56',
  '#225E9E',
  '#844F7C',
];

// v2.2.6: 从颜色库中随机分配一个未使用的颜色
function pickTransitColor(usedColors) {
  const available = TRANSIT_COLOR_LIBRARY.filter(c => !usedColors || !usedColors.includes(c));
  if (available.length === 0) return TRANSIT_COLOR_LIBRARY[Math.floor(Math.random() * TRANSIT_COLOR_LIBRARY.length)];
  return available[Math.floor(Math.random() * available.length)];
}

// v2.2.6: 收集当前已使用的线路颜色
function getUsedTransitColors() {
  const used = [];
  if (gameState.transits) {
    for (const t of gameState.transits) {
      if (t.color) used.push(t.color);
    }
  }
  return used;
}

// v2.2.6: 为新线路生成名称和颜色
function generateTransitNameAndColor(type) {
  let name, color;
  const usedColors = getUsedTransitColors();
  color = pickTransitColor(usedColors);
  if (type === 'subway') {
    const count = (gameState.transits || []).filter(t => t.type === 'subway').length + 1;
    name = count + '号线';
  } else if (type === 'lightRail') {
    const count = (gameState.transits || []).filter(t => t.type === 'lightRail').length + 1;
    name = 'S' + count;
  } else {
    name = TRANSIT_TYPES[type] ? TRANSIT_TYPES[type].name : '线路';
  }
  return { name, color };
}

const TRANSIT_TYPES = {
  // v2.2.7: 地铁线路 — 颜色每条独立分配（新色值库）
  // v2.2.7d: 调细线条
  subway: {
    name: '地铁', costPerCell: 80, color: '#D20200', layer: 'subway', buildingType: 'subwayLine',
    width: 4, lineColor: '#8A0100', dashPattern: [],
    requireApproval: 'subwayApproved',
  },
  // v2.2.7: 轻轨线路 — 颜色每条独立分配，与地铁共用色值库
  // v2.2.7d: 调细线条
  lightRail: {
    name: '轻轨', costPerCell: 40, color: '#25AC74', layer: 'elevated', buildingType: 'lightRail',
    width: 3.5, lineColor: '#1A7A52', dashPattern: [],
    requireApproval: 'lightRailApproved',
  },
  elevatedRoad: {
    name: '高架道路', costPerCell: 40, color: '#4a5158', layer: 'elevated', buildingType: 'elevatedRoad',
    width: 5, lineColor: '#3a4148', dashPattern: [],
  },
  utility: {
    name: '地下管廊', costPerCell: 30, color: '#4a463e', layer: 'underground', buildingType: 'utility',
    width: 2.5, lineColor: '#3a362e', dashPattern: [],
  },
  // v2.4.7c: 铁路线路 — 黑色描边+黑白间断，地图生成时自带
  railway: {
    name: '铁路', costPerCell: 60, color: '#222222', layer: 'ground', buildingType: 'railwayLine',
    width: 5, lineColor: '#222222', dashPattern: [5, 5],
    isRailway: true,
  },
  // v2.4.7c: 高铁线路 — 红色描边+红白间断，地图生成时自带
  hsr: {
    name: '高铁', costPerCell: 100, color: '#cc0000', layer: 'ground', buildingType: 'hsrLine',
    width: 5, lineColor: '#cc0000', dashPattern: [5, 5],
    isHSR: true,
  },
};
