// ============================================================
// 置身事内 - City Governance Simulator v4.0
// ============================================================

// ============== 工具函数 ==============
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const formatMoney = (v) => {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 100000000) return sign + (abs / 100000000).toFixed(2) + '亿';
  if (abs >= 10000) return sign + (abs / 10000).toFixed(1) + '万';
  return sign + abs.toFixed(0);
};
const formatPop = (v) => {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万';
  return v.toFixed(0);
};

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2d(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const v00 = hash2d(xi, yi, seed);
  const v10 = hash2d(xi + 1, yi, seed);
  const v01 = hash2d(xi, yi + 1, seed);
  const v11 = hash2d(xi + 1, yi + 1, seed);
  const u = smoothstep(xf), v = smoothstep(yf);
  return lerp(lerp(v00, v10, u), lerp(v01, v11, u), v);
}
function fbm(x, y, octaves, persistence, lacunarity, seed) {
  let total = 0, freq = 1, amp = 1, maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x * freq, y * freq, seed + i * 7919) * amp;
    maxVal += amp; amp *= persistence; freq *= lacunarity;
  }
  return total / maxVal;
}
function ridgeNoise(x, y, seed) {
  return 1 - Math.abs(valueNoise(x, y, seed) * 2 - 1);
}

