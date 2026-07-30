/* 源自《置身事内》单文件版 - 城市等级体系 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 城市等级体系 ==============
// v2.3.6: 每届任期统一改为5年（60个月）
const CITY_LEVELS = [
  { id: 0, name: '乡镇', title: '乡镇党委书记', minPop: 0,     maxPop: 50000,    initPop: 6000,   treasury: 3000,  termMonths: 60, promoPop: 20000,  promoScore: 60, salary: 1,   desc: '一个正在发展的乡镇' },
  { id: 1, name: '县城', title: '县委书记',     minPop: 50000,  maxPop: 200000,   initPop: 40000,  treasury: 6000,  termMonths: 60, promoPop: 100000, promoScore: 65, salary: 1.5, desc: '一座正在崛起的县城' },
  { id: 2, name: '地级市', title: '市委书记',   minPop: 200000, maxPop: 1000000,  initPop: 150000, treasury: 12000, termMonths: 60, promoPop: 400000, promoScore: 70, salary: 2.5, desc: '一座充满活力的地级市' },
  { id: 3, name: '省会城市', title: '省会市委书记', minPop: 1000000, maxPop: 5000000, initPop: 400000, treasury: 25000, termMonths: 60, promoPop: 800000, promoScore: 75, salary: 3,   desc: '一座繁华的省会城市' },
  { id: 4, name: '直辖市', title: '直辖市委书记', minPop: 5000000, maxPop: 99999999, initPop: 800000, treasury: 50000, termMonths: 60, promoPop: 99999999, promoScore: 100, salary: 4,   desc: '一座国家级直辖市' },
];

function getCityLevel() {
  for (let i = CITY_LEVELS.length - 1; i >= 0; i--) {
    if (gameState.cityLevelId >= CITY_LEVELS[i].id) return CITY_LEVELS[i];
  }
  return CITY_LEVELS[0];
}

