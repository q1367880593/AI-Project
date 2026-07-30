/* v2.3.5b: 企业系统 — 数据模型与名称生成器（模板化命名） */
/* 三类企业：公有企业、民营及外商投资企业、混合所有制企业 */
/* 命名模板：地名 + 专名 + 行业 + 公司类型 */

// ============== 企业所有制类型 ==============
// v2.3.6c: 民营拆分为纯民营和纯外资
const ENTERPRISE_TYPES = {
  stateOwned: {
    name: '公有企业',
    shortName: '公有',
    color: '#b03a2e',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h6"/></svg>',
    desc: '国有或集体所有制企业，对财政有直接贡献，可注资和进行所有制改革',
  },
  private: {
    name: '民营企业',
    shortName: '民营',
    color: '#3e7a55',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M3 21h18M6 21V8l6-4 6 4v13M10 21v-5h4v5M8 12h8"/></svg>',
    desc: '纯民营企业，市场活力强，税收贡献高',
  },
  foreign: {
    name: '外商投资企业',
    shortName: '外资',
    color: '#2d6a8c',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M3 21h18M6 21V8l6-4 6 4v13M10 21v-5h4v5M8 12h8"/><circle cx="12" cy="3" r="1"/></svg>',
    desc: '外商独资或外资控股企业，技术和管理先进',
  },
  mixed: {
    name: '混合所有制企业',
    shortName: '混合',
    color: '#6d5a8c',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M8 13h8"/></svg>',
    desc: '国资与民资混合所有制，兼顾财政贡献与税收贡献',
  },
};

const ENTERPRISE_TYPE_KEYS = ['stateOwned', 'private', 'foreign', 'mixed'];

// ============== 专名库（虚构名称，不使用真实企业名） ==============
// v2.3.6b: 大幅扩充专名库，避免名称耗尽后出现数字后缀
const PROPER_NAMES = [
  // 原有100个
  '隆鑫', '旺达', '永发', '金泰', '宏远', '德昌', '聚丰', '鸿运', '祥瑞', '恒泰',
  '嘉禾', '瑞丰', '锦程', '兴盛', '同辉', '万通', '泰昌', '福源', '广宇', '安泰',
  '新业', '合信', '利民', '正大', '华润', '通达', '汇丰', '长安', '东方', '明珠',
  '金鼎', '银丰', '宝源', '天马', '龙腾', '凤翔', '麒麟', '鹏程', '雁鸣', '鹿鸣',
  '青山', '绿水', '红日', '晨星', '明月', '春风', '秋实', '冬梅', '夏荷', '松柏',
  '长江', '黄河', '昆仑', '泰山', '华山', '衡山', '嵩山', '恒山', '峨眉', '武夷',
  '汇通', '源昌', '茂源', '生辉', '凯旋', '欣荣', '腾飞', '跃进', '前进', '光明',
  '友谊', '团结', '建设', '发展', '创新', '创业', '立业', '兴业', '富民', '强市',
  '协鑫', '悦达', '康隆', '远大', '卓越', '先锋', '领航', '启航', '扬帆', '破浪',
  '德信', '仁义', '礼智', '信达', '忠恕', '孝悌', '廉节', '勤勉', '精诚', '至善',
  // v2.3.6b 新增100个
  '鼎盛', '昌隆', '丰泰', '广发', '厚德', '载物', '明德', '格物', '致知', '诚意',
  '正心', '修身', '齐家', '治国', '平治', '仁爱', '忠义', '礼让', '智勇', '信誉',
  '金辉', '银鼎', '铜山', '铁岭', '锡业', '钢城', '铝材', '镍都', '钨矿', '煤都',
  '海天', '江城', '河洲', '湖畔', '溪谷', '泉城', '潭水', '渊博', '深源', '清流',
  '云端', '山峰', '岭上', '峡谷', '平原', '盆地', '高原', '丘陵', '沙漠', '绿洲',
  '晨光', '朝阳', '夕阳', '暮云', '星辰', '月华', '日光', '霞光', '彩虹', '雷电',
  '春华', '夏雨', '秋叶', '冬雪', '松风', '竹影', '梅香', '兰馨', '菊韵', '荷塘',
  '盛世', '太平', '安康', '吉庆', '如意', '祥和', '福满', '寿安', '康宁', '喜乐',
  '宏图', '伟业', '大展', '鸿图', '远志', '凌云', '登高', '望远', '探海', '寻天',
  '聚宝', '汇金', '源远', '流长', '根深', '叶茂', '本固', '枝荣', '花繁', '果硕',
];

// ============== 行业类型（按等级分层） ==============
// v2.3.6c: 工业区按子类型区分行业（轻工业/重工业/高新技术），不同子类型性质不同
// 小微企业比例按现实：乡镇60%以上小微，县城40%小微，地级市20%小微
const INDUSTRY_TYPES = {
  // 乡镇级：基础产业，合作社为主
  township: {
    commercial: ['商贸', '供销', '百货', '杂货', '粮油', '副食', '农资', '餐饮', '理发', '修理'],
    // 轻工业为主
    industrial_light: ['农机', '建材', '食品', '饲料', '砖瓦', '竹木', '粮油加工', '农具', '缝纫', '木器'],
    // 重工业少且小
    industrial_heavy: ['采石', '水泥', '砖厂', '小型炼铁'],
    // 乡镇基本没有高新技术，偶尔有农产品加工
    industrial_hightech: ['农产品加工', '土特产加工'],
    // v2.4.3: 乡镇级采矿
    industrial_mining: ['砂石矿', '黏土矿', '石灰石', '小煤窑'],
  },
  // 县城级：中等规模产业
  county: {
    commercial: ['商贸', '物流', '百货', '家电', '建材', '医药', '餐饮', '服装', '汽配', '五金'],
    industrial_light: ['机械', '化工', '纺织', '食品', '建材', '造纸', '化肥', '塑料', '印刷', '服装加工'],
    industrial_heavy: ['钢铁', '水泥', '化工', '电力', '煤炭', '铸造', '冶金', '机械制造'],
    industrial_hightech: ['电子', '新材料', '节能设备', '自动化设备'],
    // v2.4.3: 县级采矿
    industrial_mining: ['煤矿', '铁矿', '铜矿', '金矿', '石灰石', '石英砂', '磷矿', '铝土矿'],
  },
  // 地级市及以上：大型产业，高科技
  city: {
    commercial: ['商贸', '物流', '供应链', '商业广场', '科技', '金融', '电子商务', '保险', '会展', '跨境电商'],
    industrial_light: ['机械', '电子', '纺织', '食品', '造纸', '塑料', '家具', '家电', '玩具', '工艺品'],
    industrial_heavy: ['钢铁', '化工', '汽车', '船舶', '石油化工', '装备制造', '有色金属', '建材', '核电装备', '轨道交通'],
    industrial_hightech: ['电子', '汽车', '新能源', '新材料', '航空部件', '智能制造', '生物医药', '芯片', '机器人', '量子科技', '航天', '软件开发'],
    // v2.4.3: 采矿行业（资源型城市专用）
    industrial_mining: ['煤炭', '铁矿', '铜矿', '金矿', '稀土', '铝土矿', '钨矿', '锡矿', '磷矿', '石灰石', '石英砂', '石墨矿'],
  },
};

// v2.3.6c: 根据工业区子类型选择行业列表
function _getIndustryList(levelKey, subType) {
  const levelData = INDUSTRY_TYPES[levelKey];
  if (!levelData) return ['制造'];
  if (subType === 'heavy') return levelData.industrial_heavy || levelData.industrial_light;
  if (subType === 'hightech') return levelData.industrial_hightech || levelData.industrial_light;
  // v2.4.3: 采矿行业
  if (subType === 'mining') return levelData.industrial_mining || levelData.industrial_heavy || ['采矿'];
  // 默认轻工业
  return levelData.industrial_light || levelData.industrial;
}

// ============== 公司类型（按所有制） ==============
const COMPANY_SUFFIXES = {
  // 公有企业前缀+后缀
  stateOwned: {
    township: ['合作社', '联社', '总站', '站'],
    county: ['有限公司', '集团', '总公司'],
    city: ['集团', '总公司', '股份有限公司', '控股集团'],
  },
  // 民营企业后缀
  private: {
    township: ['店', '行', '铺', '厂'],
    county: ['有限公司', '股份有限公司', '科技有限公司'],
    city: ['有限公司', '股份有限公司', '控股集团', '科技有限公司'],
  },
  // v2.3.6c: 外资企业后缀
  foreign: {
    township: [], // 乡镇不生成外资企业
    county: ['外资有限公司', '独资有限公司'],
    city: ['外资有限公司', '独资有限公司', '投资有限公司', '控股集团'],
  },
  // 混合所有制后缀
  mixed: {
    township: ['合作社', '联合社'],
    county: ['合营有限公司', '合资有限公司', '股份有限公司'],
    city: ['控股集团', '合资有限公司', '股份有限公司', '混合所有制集团'],
  },
};

// ============== 住宅区附属设施名称 ==============
const RESIDENTIAL_FACILITY_NAMES = {
  tutoring: [
    { prefix: '启航', type: '补习班' },
    { prefix: '领航', type: '补习班' },
    { prefix: '名师', type: '补习班' },
    { prefix: '卓越', type: '补习班' },
    { prefix: '求知', type: '补习班' },
    { prefix: '成才', type: '补习班' },
    { prefix: '智慧', type: '补习班' },
    { prefix: '未来', type: '补习班' },
  ],
  club: [
    { prefix: '盛世', type: '会所' },
    { prefix: '名流', type: '会所' },
    { prefix: '华庭', type: '会所' },
    { prefix: '御景', type: '会所' },
    { prefix: '翡翠', type: '会所' },
    { prefix: '金鼎', type: '会所' },
    { prefix: '紫禁', type: '会所' },
    { prefix: '云顶', type: '会所' },
  ],
  fitness: [
    { prefix: '力量', type: '健身房' },
    { prefix: '活力', type: '健身房' },
    { prefix: '动感', type: '健身房' },
    { prefix: '燃烧', type: '健身房' },
    { prefix: '健美', type: '健身房' },
  ],
};

// ============== 企业名称生成器 ==============
let usedEnterpriseNames = new Set();

function _getLevelKey(lvId) {
  if (lvId <= 0) return 'township';
  if (lvId === 1) return 'county';
  return 'city';
}

function _pickName(arr) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const name = arr[Math.floor(Math.random() * arr.length)];
    if (!usedEnterpriseNames.has(name)) {
      usedEnterpriseNames.add(name);
      return name;
    }
  }
  // v2.3.7: 生成2字专名，从两个专名各取一字组合
  const base = arr[Math.floor(Math.random() * arr.length)];
  const other = arr[Math.floor(Math.random() * arr.length)];
  // 从base取第一字，从other取第二字，确保不同
  const c1 = base[0];
  const c2 = other === base ? other[1] : other[Math.random() < 0.5 ? 0 : 1];
  let fallback = (c1 + c2);
  // 如果重名，换第二字
  if (usedEnterpriseNames.has(fallback)) {
    for (const candidate of arr) {
      if (!usedEnterpriseNames.has(c1 + candidate[1])) {
        fallback = c1 + candidate[1];
        break;
      }
    }
  }
  usedEnterpriseNames.add(fallback);
  return fallback;
}

// 按城市等级决定所有制概率分布
// v2.3.6c: 民营拆分为纯民营和纯外资，外资企业城市等级越高占比越大
function _pickOwnershipType(lvId) {
  // 乡镇：公有和合作社多，无外商投资
  if (lvId <= 0) {
    const r = Math.random();
    if (r < 0.45) return 'stateOwned';
    if (r < 0.80) return 'private';
    return 'mixed';
  }
  // 县城：少量外资开始出现
  if (lvId === 1) {
    const r = Math.random();
    if (r < 0.25) return 'stateOwned';
    if (r < 0.60) return 'private';
    if (r < 0.75) return 'foreign';
    return 'mixed';
  }
  // 地级市+：民企和外企占比大
  const r = Math.random();
  if (r < 0.15) return 'stateOwned';
  if (r < 0.50) return 'private';
  if (r < 0.75) return 'foreign';
  return 'mixed';
}

// 生成注册资本（万）— 按等级和所有制
// v2.3.6c: 按工业区子类型调整资本规模
function _generateCapital(lvId, ownership, zoneType, subType) {
  let base, mult;
  if (zoneType === 'commercial') {
    base = lvId <= 0 ? 50 : lvId === 1 ? 500 : 5000;
  } else {
    base = lvId <= 0 ? 100 : lvId === 1 ? 1000 : 10000;
    // v2.3.6c: 重工业资本更大，高新技术资本中等
    if (subType === 'heavy') base *= 1.5;
    if (subType === 'hightech') base *= 0.8;
  }
  if (ownership === 'stateOwned') mult = 1.5;
  else if (ownership === 'foreign') mult = 1.3;
  else if (ownership === 'mixed') mult = 1.2;
  else mult = 1.0;
  return Math.round(base * mult * (0.5 + Math.random()));
}

// 生成股权结构
// v2.3.6c: 纯民营=100%民资，纯外资=100%外资，不再混合
function _generateEquity(ownership, lvId) {
  if (ownership === 'stateOwned') {
    return { state: 100, private: 0, foreign: 0 };
  }
  if (ownership === 'private') {
    // 纯民营企业：100%民资
    return { state: 0, private: 100, foreign: 0 };
  }
  if (ownership === 'foreign') {
    // 纯外资企业：100%外资（乡镇不生成外资企业，此处兜底）
    return { state: 0, private: 0, foreign: 100 };
  }
  // mixed
  const state = Math.floor(Math.random() * 30) + 20;
  const foreign = lvId <= 0 ? 0 : Math.floor(Math.random() * 20);
  return { state, private: 100 - state - foreign, foreign };
}

// v2.3.5b: 生成企业全称（地名+专名+行业+公司类型）
// v2.3.6c: 工业区按子类型选择行业列表
function _generateEnterpriseName(zoneType, subType, lvId, ownership, placeName) {
  const levelKey = _getLevelKey(lvId);
  // v2.3.6c: 工业区按子类型区分行业
  const industryList = zoneType === 'commercial'
    ? (INDUSTRY_TYPES[levelKey].commercial || ['商贸'])
    : _getIndustryList(levelKey, subType);
  let suffixList = COMPANY_SUFFIXES[ownership][levelKey];
  // v2.3.6c: 外资企业在乡镇没有后缀，降级用民营后缀
  if (!suffixList || suffixList.length === 0) {
    suffixList = COMPANY_SUFFIXES.private[levelKey];
  }
  const properName = _pickName(PROPER_NAMES);
  const industry = industryList[Math.floor(Math.random() * industryList.length)];
  const suffix = suffixList[Math.floor(Math.random() * suffixList.length)];

  // 公有企业加"国有"或"集体"前缀（乡镇级用"集体"）；外资企业加"外资"前缀
  let prefix = '';
  if (ownership === 'stateOwned') {
    prefix = lvId <= 0 ? '集体' : '国有';
  } else if (ownership === 'foreign') {
    prefix = '外资';
  }

  // 全称：[前缀]地名+专名+行业+后缀（如：清水镇集体隆鑫农机合作社）
  // 简称（地图显示）：专名+行业（如：隆鑫农机）
  const fullName = `${prefix}${placeName}${properName}${industry}${suffix}`;
  const shortName = `${properName}${industry}`;

  return { fullName, shortName, properName, industry };
}

// 生成企业对象
// v2.3.6c: 新增 subType 参数用于区分工业区子类型；新增小微企业机制
function generateEnterprise(zoneType, lvId, x, y, placeName, subType) {
  let ownership = _pickOwnershipType(lvId);
  // v2.3.6c: 高新技术区偏向外资和混合所有制
  if (subType === 'hightech' && lvId >= 1) {
    const r = Math.random();
    if (r < 0.35) return generateEnterprise(zoneType, lvId, x, y, placeName, subType); // 重选
    // 高新区：外资占比更高
    if (r < 0.50) {
      // 重新选择为外资或混合
    }
  }
  // v2.3.6c: 重工业区偏向公有和混合（需要大资本）
  if (subType === 'heavy' && lvId >= 1) {
    const r = Math.random();
    if (r < 0.40) {
      // 公有占比更高
    }
  }
  // v2.4.3: 采矿企业强制公有（国企），极少数混合所有制
  if (subType === 'mining') {
    ownership = Math.random() < 0.80 ? 'stateOwned' : 'mixed';
  }
  const nameInfo = _generateEnterpriseName(zoneType, subType, lvId, ownership, placeName || '本市');
  const capital = _generateCapital(lvId, ownership, zoneType, subType);

  // v2.3.6c: 小微企业判定（按城市等级比例）
  // 乡镇60%小微，县城40%小微，地级市20%小微
  const microThreshold = lvId <= 0 ? 0.60 : lvId === 1 ? 0.40 : 0.20;
  const isMicro = Math.random() < microThreshold;

  // 基础GDP贡献（万/月）— 小微企业GDP贡献大幅降低
  let baseGdp = zoneType === 'commercial'
    ? (lvId <= 0 ? 5 : lvId === 1 ? 30 : 200)
    : (lvId <= 0 ? 10 : lvId === 1 ? 60 : 400);
  // v2.3.6c: 重工业GDP更高，高新技术GDP更高但需要高学历
  if (subType === 'heavy') baseGdp *= 1.3;
  if (subType === 'hightech') baseGdp *= 1.5;
  if (subType === 'mining') baseGdp *= 2.0; // v2.4.3: 采矿产值大幅提高
  if (isMicro) baseGdp *= 0.2; // 小微企业GDP只有20%
  const ownMult = ownership === 'stateOwned' ? 0.8 : ownership === 'foreign' ? 1.2 : ownership === 'mixed' ? 1.1 : 1.3;
  const gdpContribution = Math.round(baseGdp * ownMult * (0.7 + Math.random() * 0.6));

  // v2.3.6: 基础利润（万/年）— 压低经营利润，资本回报率2%-8%
  const returnRate = 0.02 + Math.random() * 0.06; // 2%-8%
  const baseProfit = capital * returnRate;
  // 所有制影响：公有利润偏低但稳定，民营利润高但波动大
  const ownProfitMult = ownership === 'stateOwned' ? 0.8 : ownership === 'mixed' ? 1.0 : 1.2;
  const volatility = ownership === 'stateOwned' ? 0.9 : ownership === 'mixed' ? 0.8 : 0.7; // 波动系数
  const annualProfit = Math.max(1, Math.round(baseProfit * ownProfitMult * (volatility + Math.random() * 0.3)));

  // v2.3.5b: 税收贡献（民营和混合所有制显示税收，公有显示财政扶持）
  // 税收 = 利润 × 企业所得税率(25%) + 营业额 × 营业税率
  // v2.3.6c: 民营和外资都纳税
  const businessTaxRate = (gameState.policies && gameState.policies.businessTax) || 13;
  const taxContribution = ownership !== 'stateOwned'
    ? Math.round(annualProfit * 0.25 + gdpContribution * 12 * businessTaxRate / 100)
    : 0;

  // 财政扶持（公有和混合所有制对财政有直接贡献；民营和外资不享受）
  const fiscalSupport = (ownership === 'stateOwned' || ownership === 'mixed')
    ? Math.round(annualProfit * 0.3 * (0.8 + Math.random() * 0.4))
    : 0;

  return {
    id: 'ent_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
    name: nameInfo.fullName,
    shortName: nameInfo.shortName,
    properName: nameInfo.properName,
    industry: nameInfo.industry,
    type: zoneType, // 'commercial' or 'industrial'
    ownership: ownership,
    capital: capital,
    gdpContribution: gdpContribution,
    annualProfit: annualProfit,
    taxContribution: taxContribution, // v2.3.5b: 税收贡献（万/年）
    fiscalSupport: fiscalSupport,
    equity: _generateEquity(ownership, lvId),
    x: x,
    y: y,
    lvId: lvId,
    placeName: placeName || '本市',
    isMicro: isMicro, // v2.3.6c: 小微企业标记
    subType: subType, // v2.3.6c: 工业区子类型
    // v2.3.5: 注资/改革/并购状态
    capitalInjected: 0,
    profitBonus: 0,
    reformed: false,
    acquired: false,
    ownedBy: null,
    canRename: true, // v2.3.5b: 可改名
  };
}

// 生成住宅区附属设施
function generateResidentialFacility(lvId, x, y, placeName) {
  const categories = ['tutoring', 'club', 'fitness'];
  const cat = categories[Math.floor(Math.random() * categories.length)];
  const list = RESIDENTIAL_FACILITY_NAMES[cat];
  const item = list[Math.floor(Math.random() * list.length)];
  const properName = item.prefix;
  return {
    id: 'fac_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
    name: `${placeName || '本市'}${properName}${item.type}`,
    shortName: `${properName}${item.type}`,
    type: item.type,
    category: cat,
    x: x,
    y: y,
    capital: lvId <= 0 ? 20 : lvId === 1 ? 200 : 2000,
    gdpContribution: lvId <= 0 ? 2 : lvId === 1 ? 15 : 100,
  };
}

// v2.3.5b: 企业改名
function renameEnterprise(entId, newName) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  if (!newName || newName.trim().length < 2) { showNotification('名称至少2个字', 'warn'); return; }
  const oldName = ent.name;
  ent.name = newName.trim();
  // 提取简称（取后4个字或全部）
  ent.shortName = newName.trim().slice(-4);
  logEvent(`企业改名：${oldName} → ${ent.name}`, 'info');
  showNotification(`改名成功：${ent.name}`, 'success');
  updateUI();
}

// ============== 企业统计函数 ==============
function getEnterpriseStats() {
  const enterprises = gameState.enterprises || [];
  const businessTaxRate = (gameState.policies && gameState.policies.businessTax) || 13;
  const stats = {
    total: enterprises.length,
    stateOwned: 0,
    private: 0,
    mixed: 0,
    totalGdp: 0,
    totalProfit: 0,
    totalFiscal: 0,
    totalTax: 0,
    totalCapital: 0,
    foreign: 0, // v2.3.6c: 外资企业计数
  };
  for (const ent of enterprises) {
    if (ent.ownership === 'stateOwned') stats.stateOwned++;
    else if (ent.ownership === 'private') stats.private++;
    else if (ent.ownership === 'foreign') stats.foreign++;
    else stats.mixed++;
    stats.totalGdp += Math.round((ent.gdpContribution || 0) * (1 + (ent.profitBonus || 0)));
    stats.totalProfit += ent.annualProfit || 0;
    stats.totalFiscal += ent.fiscalSupport || 0;
    // v2.3.5b: 实时计算税收（关联税率）
    if (ent.ownership !== 'stateOwned') {
      const tax = Math.round((ent.annualProfit * 0.25 + ent.gdpContribution * 12 * businessTaxRate / 100) * (1 + (ent.profitBonus || 0)));
      stats.totalTax += tax;
    }
    stats.totalCapital += ent.capital || 0;
  }
  return stats;
}

// 按所有制分类获取企业列表
function getEnterprisesByOwnership() {
  const enterprises = gameState.enterprises || [];
  const result = { stateOwned: [], private: [], foreign: [], mixed: [] };
  for (const ent of enterprises) {
    if (result[ent.ownership]) result[ent.ownership].push(ent);
  }
  return result;
}

// v2.3.5b: 获取企业实际税收（关联税率政策）
function getEnterpriseTax(ent) {
  if (ent.ownership === 'stateOwned') return 0;
  const businessTaxRate = (gameState.policies && gameState.policies.businessTax) || 13;
  const profitMultiplier = getEnterpriseProfitMultiplier(ent);
  return Math.round((ent.annualProfit * 0.25 + ent.gdpContribution * 12 * businessTaxRate / 100)
    * (1 + (ent.profitBonus || 0)) * profitMultiplier);
}

// v2.3.5b: 获取企业利润乘数（关联各项政策）
function getEnterpriseProfitMultiplier(ent) {
  let mult = 1.0;
  const p = gameState.policies || {};
  // 营业税率影响：税率越高，利润越低（民营和外资更敏感）
  const bizTax = p.businessTax || 13;
  if (ent.ownership === 'private' || ent.ownership === 'foreign') {
    mult *= 1 - (bizTax - 13) * 0.015;
  } else if (ent.ownership === 'mixed') {
    mult *= 1 - (bizTax - 13) * 0.008;
  }
  // 创业补贴：提升利润（外资不享受创业补贴）
  if (p.bizSubsidy > 0 && ent.ownership !== 'foreign') {
    mult += p.bizSubsidy * 0.0008;
  }
  // 利率：影响民营企业的融资成本（外资对利率不敏感）
  const interestRate = p.interestRate || 3;
  if (ent.ownership === 'private') {
    mult *= 1 - (interestRate - 3) * 0.008;
  }
  // 消费券：刺激商业区企业
  if (ent.type === 'commercial' && p.consumerVoucher > 0) {
    mult += p.consumerVoucher * 0.0004;
  }
  // 环保法规：影响工业企业
  const envReg = p.envRegulation || 1;
  if (ent.type === 'industrial') {
    mult *= 1 - (envReg - 1) * 0.025;
  }
  // 土地价格：影响所有企业成本
  const landPrice = p.landPrice || 1;
  mult *= 1 - (landPrice - 1) * 0.015;
  // 人才激励：高科技企业受益
  if (p.talentIncentive > 0 && ent.type === 'industrial' && ent.lvId >= 2) {
    mult += p.talentIncentive * 0.0015;
  }
  // 住房补贴：间接刺激商业
  if (ent.type === 'commercial' && p.housingSubsidy > 0) {
    mult += p.housingSubsidy * 0.0002;
  }
  // v2.3.5c: 确保利润乘数不低于0.3，默认政策下基本为1.0
  return Math.max(0.3, mult);
}

// v2.3.5b: 获取企业实际利润（关联政策）
function getEnterpriseProfit(ent) {
  return Math.round(ent.annualProfit * (1 + (ent.profitBonus || 0)) * getEnterpriseProfitMultiplier(ent));
}

// 获取国资委增益效果
function getSasacEffect() {
  if (!gameState.personnel) return 0;
  const sasacOfficial = gameState.personnel.appointments.sasac;
  if (!sasacOfficial) return 0;
  const off = gameState.personnel.officials.find(o => o.id === sasacOfficial);
  if (!off) return 0;
  const bonus = (off.competence - 5) * 0.05;
  const loyaltyBonus = (off.loyalty - 3) * 0.02;
  return bonus + loyaltyBonus;
}

// 获取发改委增益效果
function getNdrcEffect() {
  if (!gameState.personnel) return 0;
  const ndrcOfficial = gameState.personnel.appointments.ndrc;
  if (!ndrcOfficial) return 0;
  const off = gameState.personnel.officials.find(o => o.id === ndrcOfficial);
  if (!off) return 0;
  const bonus = (off.competence - 5) * 0.03;
  const loyaltyBonus = (off.loyalty - 3) * 0.01;
  return bonus + loyaltyBonus;
}

// ============== v2.3.5b: 权力触发事件 ==============
// 点击企业时触发权力相关事件（白送/施压等）
// v2.3.6: 国资委主任低忠诚度会举报权力运作行为
function checkSasacReport() {
  if (!gameState.personnel || !gameState.personnel.appointments) return;
  const sasacOfficialId = gameState.personnel.appointments.sasac;
  if (!sasacOfficialId) return;
  const off = gameState.personnel.officials.find(o => o.id === sasacOfficialId);
  if (!off) return;
  // 忠诚度3以下有较高概率举报
  if (off.loyalty <= 3 && Math.random() < 0.7) {
    gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + 15);
    gameState.pendingEvents = gameState.pendingEvents || [];
    gameState.pendingEvents.push({
      id: 'sasac_report_' + Date.now(), title: '国资委主任举报', tag: '纪委调查', type: 'danger',
      desc: `国资委主任${off.name}向纪委举报你在企业运作中存在权力寻租行为，纪委已介入调查。`,
      choices: [
        { text: '否认（纪委+8）', effects: { inspection: 8 }, color: 'red' },
        { text: '贿赂封口（-¥200万，纪委+3）', effects: { treasury: -200, inspection: 3, corruption: 5 }, color: 'yellow' },
        { text: '接受调查', effects: { inspection: 5 }, color: 'gray' },
      ],
      deadline: gameState.turn + 2,
      issuedTurn: gameState.turn,
      issuedDate: `${gameState.year}.${String(gameState.month).padStart(2,'0')}`,
    });
    gameState.pendingEvent = gameState.pendingEvents[gameState.pendingEvents.length - 1];
    showNotification(`国资委主任${off.name}向纪委举报了你的行为！`, 'danger');
    logEvent(`国资委主任${off.name}举报权力运作行为`, 'danger');
  } else if (off.loyalty <= 4 && Math.random() < 0.3) {
    gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + 5);
    showNotification(`国资委主任${off.name}对你的行为有所察觉`, 'warn');
  }
}

function triggerPowerEvent(entId) {
  const ent = (gameState.enterprises || []).find(e => e.id === entId);
  if (!ent) return;
  if (ent.ownedBy === 'player') { showNotification('该企业已由你持有', 'info'); return; }
  if (ent.ownership === 'stateOwned') {
    // 公有企业：可以直接划转（需要高权力）
    showModal('权力运作', `<p>你打算利用职权将公有企业「${ent.name}」划转为个人资产。</p><p style="color:var(--red);">这是严重的贪污行为，纪委风险大幅增加。</p>`, [
      { text: '直接划转（纪委+20，腐败+15）', color: 'red', action: () => {
        closeModal();
        ent.ownedBy = 'player';
        const monthlyProfit = Math.round(ent.annualProfit * 0.3);
        gameState.personalCompanies = gameState.personalCompanies || [];
        gameState.personalCompanies.push({
          id: 'pc_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
          name: ent.name,
          shortName: ent.shortName,
          ownership: ent.ownership,
          capital: ent.capital,
          monthlyProfit: monthlyProfit,
          purchasedPrice: 0,
          x: ent.x,
          y: ent.y,
          status: '经营中',
          entId: ent.id,
          injected: 0,
        });
        gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + 20);
        gameState.corruption = Math.min(100, (gameState.corruption || 0) + 15);
        logEvent(`利用职权将公有企业「${ent.name}」划转为个人资产`, 'corruption');
        showNotification('企业已划转，但风险极大', 'warn');
        checkSasacReport();
        updateUI();
      }},
      { text: '取消', color: 'gray', action: closeModal },
    ], '权力运作', 'danger');
  } else {
    // 民营/混合：原经营者可能白送或拒绝
    const roll = Math.random();
    if (roll < 0.3) {
      // 原经营者愿意白送（感恩/依附权力）
      showModal('经营者示好', `<p>「${ent.name}」的经营者主动表示愿意将企业"赠予"你，以示交好。</p><p style="color:var(--orange);">接受赠送虽不花资金，但会增加纪委风险。</p>`, [
        { text: '接受赠送（纪委+12，腐败+8）', color: 'yellow', action: () => {
          closeModal();
          ent.ownedBy = 'player';
          const monthlyProfit = Math.round(ent.annualProfit * 0.3);
          gameState.personalCompanies = gameState.personalCompanies || [];
          gameState.personalCompanies.push({
            id: 'pc_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            name: ent.name,
            shortName: ent.shortName,
            ownership: ent.ownership,
            capital: ent.capital,
            monthlyProfit: monthlyProfit,
            purchasedPrice: 0,
            x: ent.x,
            y: ent.y,
            status: '经营中',
            entId: ent.id,
            injected: 0,
          });
          gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + 12);
          gameState.corruption = Math.min(100, (gameState.corruption || 0) + 8);
          logEvent(`「${ent.name}」经营者白送企业`, 'corruption');
          showNotification('接受企业赠送', 'success');
          checkSasacReport();
          updateUI();
        }},
        { text: '婉拒', color: 'blue', action: closeModal },
      ], '经营者示好', 'warn');
    } else if (roll < 0.7) {
      // 原经营者不卖，但可以施压
      showModal('经营者拒绝', `<p>「${ent.name}」的经营者拒绝了你的收购意向。</p><p>你可以利用权力施压，但风险较大。</p>`, [
        { text: '施压逼迫出售（纪委+18，腐败+12）', color: 'red', action: () => {
          closeModal();
          if (Math.random() < 0.6) {
            // 施压成功
            const cost = Math.round(ent.capital * 0.3);
            if (gameState.privateAccount >= cost) {
              gameState.privateAccount -= cost;
              ent.ownedBy = 'player';
              const monthlyProfit = Math.round(ent.annualProfit * 0.3);
              gameState.personalCompanies = gameState.personalCompanies || [];
              gameState.personalCompanies.push({
                id: 'pc_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
                name: ent.name,
                shortName: ent.shortName,
                ownership: ent.ownership,
                capital: ent.capital,
                monthlyProfit: monthlyProfit,
                purchasedPrice: cost,
                x: ent.x,
                y: ent.y,
                status: '经营中',
                entId: ent.id,
                injected: 0,
              });
              gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + 18);
              gameState.corruption = Math.min(100, (gameState.corruption || 0) + 12);
              logEvent(`施压成功，收购「${ent.name}」花费¥${cost}万`, 'corruption');
              showNotification(`施压成功，收购价¥${cost}万`, 'warn');
              checkSasacReport();
            } else {
              showNotification('私人账户资金不足', 'warn');
            }
          } else {
            // 施压失败
            gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + 15);
            gameState.reputation = Math.max(0, (gameState.reputation || 0) - 10);
            logEvent(`施压失败，「${ent.name}」经营者向上级举报`, 'warn');
            showNotification('施压失败，经营者举报了你', 'danger');
          }
          updateUI();
        }},
        { text: '放弃', color: 'gray', action: closeModal },
      ], '经营者拒绝', 'warn');
    } else {
      // 原经营者愿意正常交易
      const cost = Math.round(ent.capital * 0.5);
      showModal('正常收购', `<p>「${ent.name}」的经营者愿意以正常价格出售企业。</p><p>收购价：¥${cost}万</p><p>月利润预估：¥${Math.round(ent.annualProfit * 0.3)}万</p><p style="color:var(--text-3);font-size:13px;">当前私人账户：¥${gameState.privateAccount}万</p>`, [
        { text: '确认收购（纪委+8）', color: 'blue', action: () => {
          closeModal();
          if (gameState.privateAccount < cost) { showNotification('私人账户资金不足', 'warn'); return; }
          gameState.privateAccount -= cost;
          ent.ownedBy = 'player';
          const monthlyProfit = Math.round(ent.annualProfit * 0.3);
          gameState.personalCompanies = gameState.personalCompanies || [];
          gameState.personalCompanies.push({
            id: 'pc_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            name: ent.name,
            shortName: ent.shortName,
            ownership: ent.ownership,
            capital: ent.capital,
            monthlyProfit: monthlyProfit,
            purchasedPrice: cost,
            x: ent.x,
            y: ent.y,
            status: '经营中',
            entId: ent.id,
            injected: 0,
          });
          gameState.inspectionRisk = Math.min(100, (gameState.inspectionRisk || 0) + 8);
          logEvent(`正常收购「${ent.name}」花费¥${cost}万`, 'info');
          showNotification(`收购成功`, 'success');
          updateUI();
        }},
        { text: '取消', color: 'gray', action: closeModal },
      ], '正常收购', 'info');
    }
  }
}
