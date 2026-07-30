/* 源自《置身事内》单文件版 - 游戏配置 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 游戏配置 ==============
const BASE_MAP_W = 72, BASE_MAP_H = 44, CELL = 14;
const WATER_LEVEL = 55;
let MAP_W = BASE_MAP_W, MAP_H = BASE_MAP_H;
const CONTOUR_INTERVAL = 40;

const LAYERS = {
  ground: { name: '地面层', z: 0 },
  underground: { name: '地下层', z: 1 },
  subway: { name: '地铁层', z: 2 },
  elevated: { name: '高架层', z: 3 },
  traffic: { name: '车流层', z: 4 },
};

const TERRAIN_COLORS = {
  // v2.3.0 手机地图风格配色：浅色基底 + 柔和过渡
  deepWater: [170, 200, 220], water: [190, 214, 228], shallow: [210, 226, 235],
  sand: [245, 240, 228], grass: [235, 238, 228], forest: [215, 228, 210],
  hill: [228, 222, 210], mountain: [218, 212, 200], highMountain: [208, 202, 192],
  snow: [245, 244, 240], river: [178, 204, 220],
};
function getTerrainColor(elev, isWater) {
  if (isWater) {
    if (elev < 30) return TERRAIN_COLORS.deepWater;
    if (elev < 45) return TERRAIN_COLORS.water;
    return TERRAIN_COLORS.shallow;
  }
  if (elev < 70) return TERRAIN_COLORS.sand;
  if (elev < 150) return TERRAIN_COLORS.grass;
  if (elev < 250) return TERRAIN_COLORS.forest;
  if (elev < 400) return TERRAIN_COLORS.hill;
  if (elev < 550) return TERRAIN_COLORS.mountain;
  if (elev < 700) return TERRAIN_COLORS.highMountain;
  return TERRAIN_COLORS.snow;
}

