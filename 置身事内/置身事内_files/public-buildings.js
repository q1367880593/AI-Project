/* 源自《置身事内》单文件版 - 公共建筑升级体系 (v1.3.0.0) */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 公共建筑升级体系 (v1.3.0.0) ==============
// v2.4.8: 添加 runway 类型，移除 railwayStation/hsrStation（不可建设）
const PUBLIC_BUILDING_TYPES = ['elementarySchool', 'middleSchool', 'highSchool', 'university', 'hospital', 'police', 'fireStation', 'airport', 'runway', 'port'];

// 建筑等级配置：每级的效果倍率和升级条件
const BUILDING_LEVELS = {
  1: { name: '一级', effMult: 1.0, upgradeCost: 0, upgradeReqBuildings: [] },
  2: { name: '二级', effMult: 1.5, upgradeCost: 0.5, upgradeReqBuildings: ['road'] },
  3: { name: '三级', effMult: 2.2, upgradeCost: 1.0, upgradeReqBuildings: ['road', 'park'] },
  4: { name: '四级', effMult: 3.0, upgradeCost: 2.0, upgradeReqBuildings: ['road', 'park'] },
};

// 扩建配套建筑配置
const SCHOOL_FACILITIES = [
  { id: 'playground', name: '操场', cost: 100, desc: '扩建操场，提升学生体育活动空间', effBonus: { happiness: 2, edu: 5 } },
  { id: 'teachingArea', name: '教学区', cost: 200, desc: '扩建教学区，增加教室和实验室', effBonus: { edu: 10, jobs: 20 } },
  { id: 'library', name: '图书馆', cost: 150, desc: '建设图书馆，丰富学习资源', effBonus: { edu: 8, happiness: 1 } },
];
const BUILDING_FACILITIES = {
  elementarySchool: SCHOOL_FACILITIES,
  middleSchool: SCHOOL_FACILITIES,
  highSchool: SCHOOL_FACILITIES,
  hospital: [
    { id: 'ward', name: '住院病区', cost: 300, desc: '扩建住院病区，增加床位', effBonus: { health: 10, jobs: 30 } },
    { id: 'emergency', name: '急诊中心', cost: 250, desc: '建设急诊中心，提升急救能力', effBonus: { health: 8, safety: 3 } },
    { id: 'lab', name: '检验中心', cost: 200, desc: '建设医学检验中心', effBonus: { health: 5, gdp: 5 } },
  ],
  police: [
    { id: 'parking', name: '停车场', cost: 80, desc: '建设警车停车场，提升巡逻效率', effBonus: { safety: 5, jobs: 10 } },
    { id: 'helipad', name: '停机坪', cost: 500, desc: '建设直升机停机坪，大幅提升应急能力', effBonus: { safety: 15, happiness: 2 } },
    { id: 'training', name: '训练基地', cost: 150, desc: '建设警务训练基地', effBonus: { safety: 8, jobs: 15 } },
  ],
  fireStation: [
    { id: 'garage', name: '消防车库', cost: 100, desc: '扩建消防车库，增加消防车辆', effBonus: { safety: 8, jobs: 10 } },
    { id: 'drillTower', name: '训练塔', cost: 120, desc: '建设消防训练塔', effBonus: { safety: 5, jobs: 5 } },
    { id: 'rescue', name: '救援中心', cost: 300, desc: '建设综合救援中心', effBonus: { safety: 12, health: 3 } },
  ],
  university: [
    { id: 'dormitory', name: '学生宿舍', cost: 400, desc: '扩建学生宿舍，扩大招生规模', effBonus: { edu: 10, happiness: 3, jobs: 10 } },
    { id: 'labBuilding', name: '实验楼', cost: 600, desc: '建设科研实验楼，提升学术水平', effBonus: { edu: 15, gdp: 20 } },
    { id: 'stadium', name: '大学体育馆', cost: 500, desc: '建设大学体育场馆', effBonus: { happiness: 5, edu: 5 } },
    // v2.2.8c: 新增5个大学配套建筑（共8个）
    { id: 'library', name: '大学图书馆', cost: 350, desc: '建设大学图书馆，丰富学术资源', effBonus: { edu: 12, happiness: 2 } },
    { id: 'canteen', name: '学生食堂', cost: 200, desc: '建设学生食堂，改善就餐环境', effBonus: { happiness: 4, jobs: 5 } },
    { id: 'auditorium', name: '学术报告厅', cost: 300, desc: '建设学术报告厅，举办讲座与会议', effBonus: { edu: 8, happiness: 2 } },
    { id: 'innovationPark', name: '创新创业园', cost: 800, desc: '建设创新创业孵化园，产学研结合', effBonus: { edu: 10, gdp: 30, jobs: 20 } },
    { id: 'gateball', name: '教工活动中心', cost: 150, desc: '建设教职工活动中心，提升教职工满意度', effBonus: { happiness: 6, jobs: 3 } },
  ],
  // v2.4.7: 火车站配套
  railwayStation: [
    { id: 'waitingRoom', name: '候车室', cost: 300, desc: '扩建候车室，提升旅客容量和舒适度', effBonus: { happiness: 3, gdp: 10, jobs: 15 } },
    { id: 'parkingLot', name: '停车场', cost: 200, desc: '建设站前停车场，方便旅客换乘', effBonus: { happiness: 2, safety: 3, jobs: 5 } },
    { id: 'platform', name: '站台扩建', cost: 400, desc: '扩建站台，增加停靠车次和容量', effBonus: { gdp: 20, jobs: 10 } },
    { id: 'ticketHall', name: '售票大厅', cost: 250, desc: '扩建售票大厅，提升购票效率', effBonus: { happiness: 2, gdp: 5, jobs: 10 } },
    { id: 'freightYard', name: '货场', cost: 500, desc: '建设铁路货场，增加货运收入', effBonus: { gdp: 30, jobs: 20 } },
    { id: 'vipLounge', name: '商务候车室', cost: 350, desc: '建设商务候车室，提升高端旅客体验', effBonus: { happiness: 4, gdp: 15 } },
  ],
  // v2.4.7: 高铁站配套
  hsrStation: [
    { id: 'waitingRoom', name: '候车大厅', cost: 500, desc: '扩建高铁候车大厅，大幅提升旅客容量', effBonus: { happiness: 4, gdp: 15, jobs: 20 } },
    { id: 'parkingLot', name: '地下停车场', cost: 400, desc: '建设地下停车场，方便旅客换乘', effBonus: { happiness: 3, safety: 3, jobs: 10 } },
    { id: 'platform', name: '站台扩建', cost: 600, desc: '扩建高铁站台，增加停靠车次', effBonus: { gdp: 30, jobs: 15 } },
    { id: 'commercialArea', name: '站内商业区', cost: 450, desc: '建设站内商业餐饮区', effBonus: { gdp: 25, happiness: 3, jobs: 25 } },
    { id: 'transferHub', name: '综合换乘中心', cost: 800, desc: '建设公交地铁综合换乘中心', effBonus: { happiness: 5, gdp: 20, transit: 10 } },
    { id: 'vipLounge', name: '商务贵宾室', cost: 400, desc: '建设商务贵宾候车室', effBonus: { happiness: 5, gdp: 20 } },
  ],
  // v2.4.7: 机场配套（参考学校做法，配套齐全）
  airport: [
    { id: 'terminal', name: '航站楼', cost: 800, desc: '建设或扩建航站楼，提升旅客吞吐量', effBonus: { gdp: 30, happiness: 2, jobs: 50 }, maxCount: 3 }, // v2.4.8b: 航站楼最多扩建3次
    { id: 'controlTower', name: '塔台', cost: 500, desc: '建设空中交通管制塔台', effBonus: { safety: 8, gdp: 10 } },
    { id: 'cargoWarehouse', name: '货运仓库', cost: 600, desc: '建设航空货运仓库，增加贸易收入', effBonus: { gdp: 40, jobs: 30 } },
    { id: 'parkingApron', name: '停机坪', cost: 700, desc: '扩建停机坪，增加可停靠飞机数量', effBonus: { gdp: 25, jobs: 20 } },
    { id: 'fireStation', name: '机场消防站', cost: 300, desc: '建设机场专用消防站', effBonus: { safety: 10, health: 2 } },
    { id: 'fuelStation', name: '航油站', cost: 400, desc: '建设航空燃油补给站', effBonus: { gdp: 15, jobs: 10 } },
    { id: 'hotel', name: '机场酒店', cost: 600, desc: '建设机场酒店，服务中转旅客', effBonus: { gdp: 20, happiness: 3, jobs: 25 } },
    { id: 'parkingGarage', name: '停车楼', cost: 350, desc: '建设多层停车楼', effBonus: { happiness: 2, safety: 3, jobs: 10 } },
  ],
  // v2.4.7: 港口配套
  port: [
    { id: 'containerYard', name: '集装箱堆场', cost: 500, desc: '建设集装箱堆场，增加货运吞吐量', effBonus: { gdp: 25, jobs: 30 } },
    { id: 'warehouse', name: '仓储中心', cost: 400, desc: '建设港口仓储中心', effBonus: { gdp: 20, jobs: 20 } },
    { id: 'crane', name: '龙门吊', cost: 300, desc: '安装大型龙门吊，提升装卸效率', effBonus: { gdp: 15, jobs: 10 } },
    { id: 'passengerTerminal', name: '客运码头', cost: 350, desc: '建设客运候船大厅', effBonus: { happiness: 3, gdp: 10, jobs: 15 } },
  ],
};

// 自动命名规则
function generatePublicBuildingName(type, level, index, cityName, cityLevelId) {
  const baseName = cityName.replace(/[镇县城]+$/, '');
  // 汉字数字
  const cnNums = ['一','二','三','四','五','六','七','八','九','十'];
  const cnNum = cnNums[index] || (index + 1).toString();
  if (type === 'police') {
    if (cityLevelId === 0) return `${baseName}派出所`;
    if (cityLevelId === 1) return index === 0 ? `${baseName}县公安局` : `${baseName}${['城东','城西','城南','城北'][index-1]||('第'+(index))}派出所`;
    return index === 0 ? `${baseName}市公安局` : `${baseName}${['城东','城西','城南','城北','高新区'][index-1]||('第'+(index))}分局`;
  }
  if (type === 'elementarySchool') {
    return `${baseName}第${cnNum}小学`;
  }
  if (type === 'middleSchool') {
    return `${baseName}第${cnNum}初级中学`;
  }
  if (type === 'highSchool') {
    return `${baseName}第${cnNum}高级中学`;
  }
  if (type === 'hospital') {
    // 医院统一命名为第X人民医院，数字大写
    if (level <= 1) return `${baseName}第${cnNum}卫生院`;
    return `${baseName}第${cnNum}人民医院`;
  }
  if (type === 'fireStation') {
    if (cityLevelId === 0) return `${baseName}消防站`;
    if (cityLevelId === 1) return `${baseName}${['城东','城西','城南','城北'][index]||('第'+(index+1))}消防站`;
    return `${baseName}第${cnNum}消防中队`;
  }
  if (type === 'university') {
    // 第一所是师范高等专科学校，第二所是医学高等专科学校，之后按序号
    if (index === 0) return `${baseName}师范高等专科学校`;
    if (index === 1) return `${baseName}医学高等专科学校`;
    return `${baseName}第${cnNum}高等专科学校`;
  }
  return BUILDING_TYPES[type] ? BUILDING_TYPES[type].name : type;
}

// 从建筑名中提取简称（地图上显示）
function getBuildingAbbr(b) {
  if (!b.customName) return BUILDING_TYPES[b.type]?.shortName || '';
  const name = b.customName;
  // 提取数字部分+后缀（第X后缀 或 直接后缀）
  const m = name.match(/第(.+?)(小学|初级中学|高级中学|中学|人民医院|卫生院|消防中队|消防站|高等专科学校|师范学院|医学院)/);
  if (m) {
    const num = m[1];
    const suffix = m[2];
    if (suffix === '小学') return `${num}小`;
    if (suffix === '初级中学') return `${num}初`;
    if (suffix === '高级中学') return `${num}高`;
    if (suffix.includes('中学')) return `${num}中`;
    if (suffix === '人民医院') return `${num}人医`;
    if (suffix === '卫生院') return `${num}卫`;
    if (suffix.includes('消防')) return `${num}消`;
    if (suffix === '高等专科学校') return `${num}师专`;
    if (suffix === '师范学院') return `${num}师院`;
    if (suffix === '医学院') return `${num}医学院`;
  }
  // 大学名称没有"第"前缀的情况（如"XX师范高等专科学校"）
  if (name.includes('师范高等专科学校')) return '师专';
  if (name.includes('医学高等专科学校')) return '医专';
  if (name.includes('师范学院')) return '师院';
  if (name.includes('医学院')) return '医学院';
  if (name.includes('公安局')) return '公安';
  if (name.includes('派出所')) return '派出所';
  if (name.includes('分局')) {
    const dir = name.match(/(城东|城西|城南|城北|高新)/);
    return dir ? dir[1] : '分局';
  }
  // v2.4.7: 交通建筑简称
  if (name.includes('国际机场')) return name.replace(/国际机场$/, '') + '国际';
  if (name.includes('机场')) return name.replace(/机场$/, '');
  if (name.includes('高铁站')) return '高铁站';
  if (name.includes('火车站')) return '火车站';
  if (name.includes('港') && !name.includes('港湾')) return name.slice(-2);
  return name.slice(0, 3);
}

function getMapSizeForLevel(levelId) {
  if (levelId >= 4) return { w: 150, h: 96 }; // 直辖市: 150x96
  if (levelId >= 3) return { w: 128, h: 80 }; // 省会城市: 128x80
  if (levelId >= 2) return { w: 108, h: 66 }; // 地级市: 108x66
  if (levelId >= 1) return { w: 84, h: 52 };  // 县城: 84x52
  return { w: BASE_MAP_W, h: BASE_MAP_H };    // 乡镇: 72x44
}

// ============== v2.4.7: 交通建筑系统 ==============

// v2.4.7c: 跑道等级 — 根据单条跑道长度判定等级字母
const RUNWAY_CLASSES = [
  { minLen: 6,  letter: 'C', name: 'C级', desc: '可起降窄体客机（波音737等）' },
  { minLen: 10, letter: 'D', name: 'D级', desc: '可起降宽体客机（波音767、空客330）' },
  { minLen: 14, letter: 'E', name: 'E级', desc: '可起降大型客机（波音777、空客340）' },
  { minLen: 18, letter: 'F', name: 'F级', desc: '可起降超大型客机（空客380）' },
];

// v2.4.7c: 获取单条跑道的等级字母
function getRunwayClass(runwayLength) {
  let cls = RUNWAY_CLASSES[0];
  for (const c of RUNWAY_CLASSES) {
    if (runwayLength >= c.minLen) cls = c;
  }
  return cls;
}

// v2.4.7c: 机场等级 — 数字=跑道数量，字母=最低跑道等级
// 如 "4D" = 4条跑道，全部达到D级以上
function getAirportClass(runways) {
  // 兼容旧存档：传入数字时按旧逻辑处理
  if (typeof runways === 'number') {
    const cls = getRunwayClass(runways);
    return { code: '1' + cls.letter, name: '1' + cls.letter + '级', tradeMult: 0.5, letter: cls.letter, runwayCount: 1 };
  }
  // 新逻辑：从跑道数组计算
  if (!runways || !Array.isArray(runways) || runways.length === 0) {
    return { code: '1C', name: '1C级', tradeMult: 0.3, letter: 'C', runwayCount: 0 };
  }
  const runwayCount = runways.length;
  // 找最低跑道等级
  let lowestLetter = 'F';
  for (const r of runways) {
    const len = r.length || (r.cells ? r.cells.length : 0);
    const cls = getRunwayClass(len);
    if (RUNWAY_CLASSES.indexOf(cls) < RUNWAY_CLASSES.findIndex(c => c.letter === lowestLetter)) {
      lowestLetter = cls.letter;
    }
  }
  // 贸易倍率：跑道数量 × 等级系数
  const letterMult = { C: 0.5, D: 1.0, E: 1.8, F: 3.0 };
  const tradeMult = Math.min(6.0, runwayCount * (letterMult[lowestLetter] || 0.5));
  const code = runwayCount + lowestLetter;
  return { code, name: code + '级', tradeMult, letter: lowestLetter, runwayCount };
}

// v2.4.7c: 国际机场门槛 — 需要至少4条D级跑道
const INTERNATIONAL_AIRPORT_REQ = { runwayCount: 4, minLetter: 'D' };

// 旧版兼容：保留 AIRPORT_CLASSES 供旧代码引用
const AIRPORT_CLASSES = [
  { minRunway: 6,  code: '1C', name: '1C级', desc: '单跑道C级', tradeMult: 0.5 },
  { minRunway: 10, code: '1D', name: '1D级', desc: '单跑道D级', tradeMult: 1.0 },
  { minRunway: 14, code: '1E', name: '1E级', desc: '单跑道E级', tradeMult: 1.8 },
  { minRunway: 18, code: '1F', name: '1F级', desc: '单跑道F级', tradeMult: 3.0 },
];

// 机场命名：<城市名><随机两字>机场，国际前缀
const AIRPORT_NAME_CHARS = ['云飞', '翔宇', '天际', '鸿运', '鹏程', '龙腾', '凤舞', '银河', '星辰', '凌云', '九天', '宏图', '远航', '启航', '万丰', '汇通', '昌达', '永安', '顺达', '泰翔'];

// v2.4.8: 机场名称库与路名库共用 — 合并 AIRPORT_NAME_CHARS 与路名前缀，去重
const _AIRPORT_NAME_POOL = (() => {
  const pool = new Set(AIRPORT_NAME_CHARS);
  if (typeof ROAD_NAME_PARTS !== 'undefined') {
    for (const grade of ['street', 'avenue', 'path']) {
      const parts = ROAD_NAME_PARTS[grade];
      if (parts && parts.prefixes) {
        for (const p of parts.prefixes) {
          if (p.length === 2) pool.add(p); // 仅取2字前缀
        }
      }
    }
  }
  return Array.from(pool);
})();

let usedAirportNames = new Set();

function generateAirportName(cityName, isInternational) {
  const base = cityName.replace(/[镇县城市区]+$/, '');
  // v2.4.8: 使用合并后的名称库（机场名库 + 路名库前缀）
  for (let attempt = 0; attempt < 50; attempt++) {
    const chars = _AIRPORT_NAME_POOL[Math.floor(Math.random() * _AIRPORT_NAME_POOL.length)];
    const intlPrefix = isInternational ? '国际' : '';
    const name = `${base}${chars}${intlPrefix}机场`;
    if (!usedAirportNames.has(name)) {
      usedAirportNames.add(name);
      return name;
    }
  }
  // Fallback with counter
  const fallback = `${base}${isInternational ? '国际' : ''}机场${usedAirportNames.size + 1}`;
  usedAirportNames.add(fallback);
  return fallback;
}

// 火车站等级配置（参考铁路车站等级标准）
const STATION_GRADES = [
  { minPop: 0,      code: '五等站', name: '五等站', desc: '小型会让站，仅停靠少量慢车', capacity: 500,   gdpMult: 0.3 },
  { minPop: 10000,  code: '四等站', name: '四等站', desc: '乡镇级客运站，停靠普速列车', capacity: 2000,  gdpMult: 0.5 },
  { minPop: 50000,  code: '三等站', name: '三等站', desc: '县级客运站，停靠较多车次', capacity: 5000,   gdpMult: 1.0 },
  { minPop: 200000, code: '二等站', name: '二等站', desc: '地级市客运站，车次密集', capacity: 15000,  gdpMult: 1.5 },
  { minPop: 500000, code: '一等站', name: '一等站', desc: '重要枢纽站，车次频繁', capacity: 30000,  gdpMult: 2.5 },
  { minPop: 1000000, code: '特等站', name: '特等站', desc: '国家级枢纽站，始发终到列车众多', capacity: 60000, gdpMult: 4.0 },
];

// 根据人口获取车站等级
function getStationGrade(population) {
  let grade = STATION_GRADES[0];
  for (const g of STATION_GRADES) {
    if (population >= g.minPop) grade = g;
  }
  return grade;
}

// 获取建筑简称（交通建筑扩展）
function getTransportBuildingAbbr(b) {
  if (!b.customName) return BUILDING_TYPES[b.type]?.shortName || '';
  const name = b.customName;
  if (b.type === 'airport') {
    // 提取机场名前3-4字
    if (name.includes('国际机场')) return name.replace(/国际机场$/, '') + '国际';
    return name.replace(/机场$/, '');
  }
  if (b.type === 'railwayStation' || b.type === 'hsrStation') {
    if (b.stationGrade) {
      return b.stationGrade.replace('站', '') + '站';
    }
    return name.slice(0, 3);
  }
  if (b.type === 'port') {
    return name.replace(/港口码头$/, '港').slice(-3);
  }
  return name.slice(0, 3);
}

