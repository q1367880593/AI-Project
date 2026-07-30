/* 源自《置身事内》单文件版 - 游戏状态 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 游戏状态 ==============
const gameState = {
  playerName: '', cityName: '新安镇', year: 2026, month: 1, turn: 0,
  playerDegree: null, // 学历：null/大专/本科/硕士/博士
  degreeFake: false, // 学历是否伪造
  degreeExamInProgress: false, // 是否正在考试
  partySchoolCooldown: 0, // 党校冷却
  cityLevelId: 0, termTurn: 0, termEnd: 60, promotionHistory: [],
  regionTermTurn: 0, // 当前地区已任期月数（最多120月=10年）
  careerStartTurn: 0, // 仕途起始回合
  maxCareerYears: 0, // 最大仕途年限（35-45随机，0=未初始化）
  retirementAge: 60, // 退休年龄
  deputyPosition: null, // v2.3.6: 兼任副职等级（null=无副职, 数字=目标等级ID）
  treasury: 3000, monthlyRevenue: 0, monthlyExpenditure: 0,
  population: 8000, populationGrowth: 0,
  gdp: 0, gdpGrowth: 0, gdpMult: 1, unemployment: 0.05, businesses: 0,
  airQuality: 35, waterQuality: 90, greenCoverage: 0, noiseLevel: 45,
  educationIndex: 20, healthcareIndex: 15, publicSafety: 30, happiness: 55,
  corruption: 0, reputation: 50, inspectionRisk: 0, merit: 0,
  livabilityScore: 50, prosperityScore: 30,
  noPromotionUntil: 0, // v2.3.6c: 处分期不能提拔的截止回合（0=无限制）
  inspectionLockdown: 0, // v2.4.0: 提级巡视锁定回合数（>0时锁定政务和个人事务页面）
  // v2.4.6: 行政区划申报系统
  cityStatus: {    // 当前城市行政身份（申报成功后更新）
    isCountyCity: false,   // 是否已撤县设市（县级市）
    isSeparatelyPlanned: false, // 是否为计划单列市
    hasNationalNewArea: false,   // 是否拥有国家级新区
    newAreaExpanded: false,      // 新区是否已扩展地图
  },
  fiscalRemitRate: 1.0,   // v2.4.6: 财政上缴比例系数（1.0=标准，<1.0=上缴减少）
  fiscalSupportMonthly: 0, // v2.4.6: 每月获得的上级财政扶持资金（万）
  adminApplication: null,  // v2.4.6: 当前正在审批的申报 { type, turnSubmitted, reviewMonths, status }
  // v2.4.6b: 城市荣誉系统
  cityHonors: {
    civilizedCity: false,    // 是否获评文明城市
    sanitaryCity: false,     // 是否获评卫生城市
    civilizedApplying: false, // 正在申报文明城市
    sanitaryApplying: false,  // 正在申报卫生城市
    civilizedReviewTurn: 0,   // 文明城市考察剩余月数
    sanitaryReviewTurn: 0,    // 卫生城市考察剩余月数
  },
  investUsage: {}, // 工商每任期使用次数 { promo: 0, hightech: 1, ... }
  privateAccount: 0, // 私人账户余额（万）
  externalPower: 0, // 外部购电（县城专用）
  privateAssets: { stocks: [], land: [], projects: [], villas: [] },
  personalEvents: [], // 个人事件日志
  personalEventCooldowns: {}, // 各事件独立冷却
  eventCooldowns: {}, // 随机事件冷却（已处理事件一段时间内不重复）
  stockMarket: { index: 3000, trend: 0 },
  privateTotalGained: 0, // 累计非法所得
  loans: [], // 财政贷款列表
  constructionProjects: [], // 在建工程列表
  underworld: { thugs: 0, crimeRate: 5, crackdownLevel: 0, thugMonthlyCost: 0, thugActionsUsed: 0, crackdownsDone: 0 }, // 黑社会系统
  policies: { propertyTax: 0.5, businessTax: 13, incomeTax: 10, eduBudget: 15, healthBudget: 12, infraBudget: 20, envRegulation: 5, landPrice: 1,
    housingSubsidy: 0, bizSubsidy: 0, interestRate: 3, bankReserve: 12, greenBond: 0, consumerVoucher: 0, talentIncentive: 0, mortgageRate: 4,
    // v2.2.5c: 公共交通政策
    transitFare: 1, transitInterval: 5, transitSubsidy: 0 },
  buildings: [], buildingCount: 0,
  zones: [], // 区域: { id, type, subType, cells: [{x,y}], name, shops: [{name,type,x,y}] }
  roads: [], // 道路: { id, grade, cells: [{x,y}], name }
  transits: [], // 交通线路: { id, type, cells: [{x,y}], name }
  brushMode: 'free', // free, rect, line, fill
  selectedZone: null, // zone type key: residential, commercial, etc.
  selectedZoneSub: null, // sub-type key
  selectedRoadType: null, // road type key: path, street, avenue, highway
  selectedTransitType: null, // transit type key: subway, lightRail, elevatedRoad, utility
  isPainting: false, paintCells: [], paintStartCell: null,
  skyscrapers: [],
  subwayApproved: false,
  lightRailApproved: false, // v2.2.6: 轻轨审批（人口达150万可申报）
  universityApproved: false,
  airportApproved: false, // v2.4.7: 机场建设审批（地级市以上可申报）
  airportCooldown: 0, // v2.5.0b: 机场申请驳回后的冷却期（gameState.turn值，到期前不可再申请）
  intlAirportCooldown: 0, // v2.5.0b: 国际机场申请驳回后的冷却期
  activeLayers: { ground: true, underground: true, subway: true, elevated: true, traffic: false },
  selectedBuilding: null, selectedTool: 'build', hoverCell: null,
  demolishMode: 'whole', // 拆除模式: 'whole'(整段) 或 'partial'(单格画笔) 或 'rect'(框选)
  demolishTarget: null, // 单点拆除时的高亮目标
  isDemolishBrushing: false, // 是否正在画笔拆除
  personnel: null, // { officials: [], appointments: {} } 人事系统，县级解锁
  generousFinance: false, // 宽裕财政模式：资源无限
  endlessMode: false, // 无尽仕途模式：无任期上限和退休限制
  deficitMonths: 0, // 连续财政赤字月数（用于触发贫困地区机制）
  povertyStatus: 'normal', // 贫困状态: 'normal' | 'poverty'(贫困地区) | 'extreme'(特困地区)
  povertyGrantReceived: false, // 是否已领取首次专项拨款
  postGrantDeficitMonths: 0, // 领取拨款后连续赤字月数（用于触发特困升级）
  alleviationMonths: 0, // 连续非赤字月数（用于脱贫摘帽）
  // v2.4.3: 资源枯竭型城市机制
  isResourceCity: false,          // 是否为资源型城市（开局随机判定）
  mineralZones: [],               // 矿产资源区: [{ id, name, resourceType, cells, mineBuildings, production, maxProduction, depleted }]
  resourceDependency: 0,           // 资源依赖度 (0-100)，采矿产值占GDP比例
  resourceDepleted: false,        // 是否进入资源枯竭阶段
  resourceDepletionMonths: 0,     // 枯竭后经过的月数
  transformationProject: null,    // 产业转型项目: { type, monthsRequired, monthsCompleted, monthlyCost, totalInvested, completed }
  transformationBonus: null,      // 转型完成的增益: { type: 'tourism'|'logistics', gdpMult, happinessBonus, commerceBonus }
  _noTransformWarningMonths: 0,  // 枯竭后未启动转型的月数（用于触发惩罚）
  _cashOutUsed: false,           // 是否已使用套现跑路手段
  mapSeed: 0, pendingEvent: null, pendingEvents: [], gameOver: false,
  eventLog: [], // 事件日志，用于晚报系统
  achievements: [], achievementStats: {
    totalBribes: 0, totalCorruptionActions: 0, maxTreasury: 0, minHappiness: 55,
    monthsHappy80: 0, monthsCorrupt0: 0, totalBuildingsBuilt: 0, totalMoneySpent: 0,
    eventsResolved: 0, promotions: 0, demotions: 0, monthsLowAir: 0, maxDebt: 0,
    moneyOnBribes: 0, buildingsDemolished: 0, everBankrupt: false,
    maxPrivateAssets: 0, stockTrades: 0, landPurchases: 0, villaPurchases: 0,
    transfersDone: 0, inspectionsDodged: 0, maxStockProfit: 0, petitionsResolved: 0,
    // v2.2.0 农业系统统计
    farmlandCellsBuilt: 0, agriCellsBuilt: 0, redlineViolations: 0, maxUrbanizationRatio: 0,
  },
  // v2.2.3 模组管理：当前存档已启用的模组ID列表
  enabledMods: [],
  // v2.2.4 派系系统：玩家所属派系 + 当前地图主导派系
  playerFaction: null,    // 玩家所属派系 key（新游戏/晋升时随机分配）
  mapFaction: null,       // 当前地图主导派系 key（新地图随机分配）
  // v2.4.1: 常务委员会（常委机制）
  committee: null,        // 常务委员会成员列表（含玩家）
  committeeUnity: 50,     // 班子团结程度（0-100）
  // v2.2.4 车流系统：每月更新的拥堵指标
  trafficStats: { congestionLevel: 0, congestedCells: [], avgSpeed: 1.0 },
  // v2.2.4c: 车流层显示模式：'congestion'=拥堵色带 / 'heatmap'=需求热力图
  trafficLayerMode: 'congestion',
  // v2.3.0: 不规则地块测试开关（在地图图层中切换）
  mergeZones: false,
  // v2.3.0d: 主导风向（城市生成时确定，用于工业/住宅区布局参考）
  windDirection: null,
  // v2.3.5: 企业系统
  enterprises: [], // 企业列表: { id, name, type, ownership, capital, gdpContribution, annualProfit, fiscalSupport, equity, x, y, lvId, capitalInjected, profitBonus, reformed, acquired, ownedBy }
  enterpriseFacilities: [], // 住宅区附属设施: { id, name, type, category, x, y, capital, gdpContribution }
  // v2.3.5: 个人收购的企业
  personalCompanies: [], // { id, name, ownership, capital, monthlyProfit, purchasedPrice, x, y, status }
  // v2.2.0 农业系统状态
  agriStats: {
    primaryGdp: 0, secondaryGdp: 0, tertiaryGdp: 0, otherGdp: 0,
    primaryRatio: 0, secondaryRatio: 0, tertiaryRatio: 0,
    agriJobs: 0, totalJobs: 0, urbanizationRatio: 0, urbanizationLevelId: 0,
    farmlandArea: 0, buildableArea: 0, farmlandRedline: 0, farmlandRedlineRatio: 0.30,
    belowRedlineMonths: 0, redlinePenaltyTriggered: [],
    miningGdp: 0, manufacturingGdp: 0, miningRatio: 0, manufacturingRatio: 0, // v2.4.3: 第二产业细分
  },
};

let mapCells = [], riverPaths = [], contourSegments = [];
let corruptionCooldowns = {};
let canvas, ctx, offscreenCanvas, offscreenCtx;
let currentTab = 'demand';
let saveMode = 'load';
let viewState = { zoom: 1, offsetX: 0, offsetY: 0 };
let panState = { isPanning: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0, hasMoved: false };
let pinchState = null;

