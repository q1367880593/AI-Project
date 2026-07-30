/* 源自《置身事内》单文件版 - 道路命名系统 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 道路命名系统 ==============
// 按道路等级分开命名：小路→巷/弄/径/坊；街道→街/路；大道→大道/大街；高速→高速/快速路
const ROAD_NAME_PARTS = {
  // 小路：巷、弄、径、坊
  path: {
    prefixes: ['翠竹', '梧桐', '银杏', '紫荆', '丹桂', '茉莉', '蔷薇', '丁香', '海棠', '玉兰', '芙蓉', '樱花', '桃花', '杏花', '梨花', '红梅', '金桂', '冬梅', '春晖', '夏荷', '秋实', '松柏', '杨柳', '樟树', '榕荫', '枫林', '竹园', '栖霞', '映月', '碧波', '清河', '听涛', '观澜', '沐阳', '临风', '望江', '凌云', '白云', '青山', '永乐'],
    middles: ['', '东', '西', '南', '北'],
    suffixes: ['巷', '弄', '径', '坊'],
  },
  // 街道：街、路
  street: {
    prefixes: ['人民', '解放', '建设', '中山', '和平', '文化', '科技', '长安', '迎宾', '新华', '青年', '光明', '友谊', '复兴', '锦绣', '振兴', '团结', '幸福', '文明', '和谐', '爱国', '敬业', '诚信', '友善', '富强', '民主', '自由', '平等', '公正', '法治', '永乐', '安康', '泰安', '昌盛', '繁华', '滨江', '环城', '工业', '商业', '春晖', '望江', '听涛', '观澜', '清河', '碧波', '青山', '白云', '凌云', '临风', '沐阳', '栖霞', '映月', '翠竹', '梧桐', '银杏', '紫荆', '丹桂', '红梅', '金桂', '玉兰', '海棠', '丁香', '茉莉', '蔷薇', '牡丹', '芙蓉', '樱花', '桃花', '杏花', '梨花', '松柏', '杨柳', '樟树', '榕荫', '枫林', '竹园', '朝阳', '夕阳', '明月', '清风', '流云', '飞鸿', '翔宇', '鹏程', '锦程', '前程', '康宁', '永宁', '安宁', '德仁', '仁义', '礼智', '信义', '忠孝', '廉洁', '勤政', '为民', '求是', '创新', '卓越', '腾飞', '启航', '扬帆', '远航', '领航'],
    middles: ['', '东', '西', '南', '北', '中'],
    suffixes: ['街', '路'],
  },
  // 大道：大道、大街
  avenue: {
    prefixes: ['人民', '解放', '建设', '中山', '和平', '文化', '科技', '滨江', '环城', '长安', '迎宾', '新华', '青年', '复兴', '振兴', '富强', '民主', '昌盛', '繁华', '光明', '友谊', '锦绣', '团结', '文明', '和谐', '朝阳', '腾飞', '启航', '扬帆', '远航', '领航', '鹏程', '锦程', '前程', '康宁', '永宁', '德仁', '求是', '创新', '卓越', '翔宇', '飞鸿', '流云', '清风', '明月', '夕阳', '望江', '观澜', '青山', '碧波'],
    middles: ['', '东', '西', '南', '北', '中'],
    suffixes: ['大道', '大街'],
  },
  // 高速公路：高速、快速路
  highway: {
    prefixes: ['京港澳', '沪昆', '连霍', '沈海', '京沪', '京台', '广深', '成渝', '杭瑞', '宁洛', '武黄', '机场', '环城', '城际', '都市', '滨河', '沿江', '滨海', '环湖', '通港', '保税', '经开', '高新', '科创', '智慧', '空港', '海港', '物流', '产业'],
    middles: ['', '东', '西', '南', '北', '环'],
    suffixes: ['高速', '快速路', '高等级公路'],
  },
};
let roadNameCounter = 0;
let usedRoadNames = new Set(); // 已使用的道路名，避免重复

function generateRoadName(grade) {
  const parts = ROAD_NAME_PARTS[grade] || ROAD_NAME_PARTS.street;
  // 尝试生成不重复的名称（最多尝试50次）
  for (let attempt = 0; attempt < 50; attempt++) {
    const prefix = parts.prefixes[Math.floor(Math.random() * parts.prefixes.length)];
    const mid = parts.middles[Math.floor(Math.random() * parts.middles.length)];
    const suffix = parts.suffixes[Math.floor(Math.random() * parts.suffixes.length)];
    const name = prefix + mid + suffix;
    if (!usedRoadNames.has(name)) {
      usedRoadNames.add(name);
      roadNameCounter++;
      return name;
    }
  }
  // 如果50次都重复，加序号
  roadNameCounter++;
  const fallback = `无名${grade === 'path' ? '巷' : grade === 'highway' ? '高速' : '路'}${roadNameCounter}`;
  usedRoadNames.add(fallback);
  return fallback;
}

// ============== 商业店面名称生成器 ==============
// 商铺模板 — 按城市等级分层
// 乡镇/县级: 接地气的本地品牌+下沉市场品牌; 地级以上: 大连锁品牌
const SHOP_TEMPLATES_SMALL = {
  tea: [
    { name: '甜蜜蜜奶茶', type: '饮品' }, { name: '阿芳茶铺', type: '饮品' },
    { name: '一口甜奶茶', type: '饮品' }, { name: '老街茶坊', type: '饮品' },
    { name: '蜜雪冰城', type: '饮品' }, { name: '益禾堂', type: '饮品' },
    { name: '甜啦啦', type: '饮品' }, { name: '古茗茶饮', type: '饮品' },
    { name: '好再来奶茶', type: '饮品' }, { name: '快乐柠檬', type: '饮品' },
    { name: '茶与花', type: '饮品' }, { name: '甜甜圈奶茶', type: '饮品' },
    { name: '小茶大人', type: '饮品' }, { name: '一口柠檬茶', type: '饮品' },
    { name: '鲜果时光', type: '饮品' }, { name: '爽爽甜品', type: '饮品' },
    { name: '茶主张', type: '饮品' }, { name: '一芳水果茶', type: '饮品' },
  ],
  coffee: [
    { name: '老张咖啡馆', type: '咖啡' }, { name: '幸运咖', type: '咖啡' },
    { name: '街角咖啡', type: '咖啡' }, { name: '库迪咖啡', type: '咖啡' },
    { name: '迷你咖', type: '咖啡' }, { name: '上岛咖啡', type: '咖啡' },
    { name: '漫咖啡', type: '咖啡' }, { name: '猫屎咖啡', type: '咖啡' },
    { name: '小镇咖啡', type: '咖啡' }, { name: '咖啡陪你', type: '咖啡' },
  ],
  food: [
    { name: '沙县美食', type: '餐饮' }, { name: '兰州牛肉面', type: '餐饮' },
    { name: '黄焖鸡米饭', type: '餐饮' }, { name: '重庆小面', type: '餐饮' },
    { name: '四川麻辣烫', type: '餐饮' }, { name: '东北饺子馆', type: '餐饮' },
    { name: '湖南米粉', type: '餐饮' }, { name: '广东肠粉', type: '餐饮' },
    { name: '正新鸡排', type: '快餐' }, { name: '华莱仕', type: '快餐' },
    { name: '老乡鸡', type: '快餐' }, { name: '杨铭宇黄焖鸡', type: '餐饮' },
    { name: '张亮麻辣烫', type: '餐饮' }, { name: '杨国福麻辣烫', type: '餐饮' },
    { name: '老王烧烤', type: '烧烤' }, { name: '胖子肉蟹煲', type: '餐饮' },
    { name: '老成都串串香', type: '餐饮' }, { name: '云南过桥米线', type: '餐饮' },
    { name: '新疆大盘鸡', type: '餐饮' }, { name: '北京烤鸭店', type: '餐饮' },
    { name: '杭州小笼包', type: '餐饮' }, { name: '武汉热干面', type: '餐饮' },
    { name: '西安肉夹馍', type: '餐饮' }, { name: '柳州螺蛳粉', type: '餐饮' },
    { name: '隆江猪脚饭', type: '餐饮' }, { name: '淮南牛肉汤', type: '餐饮' },
  ],
  retail: [
    { name: '鑫鑫超市', type: '超市' }, { name: '福万家超市', type: '超市' },
    { name: '汪哥折扣超市', type: '折扣' }, { name: '好又多超市', type: '超市' },
    { name: '家家乐百货', type: '百货' }, { name: '大拇指文具', type: '文具' },
    { name: '天天平价', type: '零售' }, { name: '惠民杂货', type: '杂货' },
    { name: '好邻居五金', type: '五金' }, { name: '大众服装', type: '服装' },
    { name: '旺旺百货', type: '百货' }, { name: '阳光水果店', type: '水果' },
    { name: '鲜又鲜蔬菜', type: '蔬菜' }, { name: '胖子烟酒', type: '烟酒' },
    { name: '四季花卉', type: '花店' }, { name: '实惠手机店', type: '手机' },
    { name: '飞达电器', type: '电器' }, { name: '老李家纺', type: '家纺' },
    { name: '潮人服饰', type: '服装' }, { name: '文具大王', type: '文具' },
    { name: '金大福珠宝', type: '珠宝' }, { name: '安安母婴', type: '母婴' },
  ],
  convenience: [
    { name: '鑫鑫便利', type: '便利店' }, { name: '美宜佳', type: '便利店' },
    { name: '天福', type: '便利店' }, { name: '好邻居', type: '便利店' },
    { name: '全家福', type: '便利店' }, { name: '万家便利', type: '便利店' },
    { name: '天天便利', type: '便利店' }, { name: '来吧便利', type: '便利店' },
    { name: '悦来悦好', type: '便利店' }, { name: '红旗连锁', type: '便利店' },
  ],
  service: [
    { name: 'XX邮政', type: '邮政' }, { name: 'XX农商银行', type: '银行' },
    { name: '顺丰快递', type: '快递' }, { name: '菜鸟驿站', type: '快递' },
    { name: '天天发物流', type: '物流' }, { name: '老李理发', type: '理发' },
    { name: '便民打印', type: '服务' }, { name: 'XX移动代理', type: '服务' },
    { name: '张师傅修车', type: '维修' }, { name: '通达房产', type: '房产' },
    { name: '安心药房', type: '药店' }, { name: '康健大药房', type: '药店' },
    { name: '小美美容院', type: '美容' }, { name: '达人健身', type: '健身' },
    { name: '宝宝乐幼儿园', type: '教育' }, { name: '新希望培训', type: '教育' },
    { name: '老周修鞋', type: '服务' }, { name: '快修手机', type: '维修' },
    { name: '百世快递', type: '快递' }, { name: '中通快递', type: '快递' },
    { name: '韵达快递', type: '快递' }, { name: '申通快递', type: '快递' },
    { name: '圆通速递', type: '快递' }, { name: '极兔速递', type: '快递' },
    { name: '爱宠之家', type: '宠物' }, { name: '靓车坊洗车', type: '服务' },
  ],
};
const SHOP_TEMPLATES_LARGE = {
  tea: [
    { name: '茶颜悦色', type: '饮品' }, { name: '喜茶多多', type: '饮品' },
    { name: '奈雪的茶', type: '饮品' }, { name: '书亦烧仙草', type: '饮品' },
    { name: '茶百道', type: '饮品' }, { name: '冰雪蜜城', type: '饮品' },
    { name: '蜜雪冰城', type: '饮品' }, { name: '古茗茶饮', type: '饮品' },
    { name: '益禾堂', type: '饮品' }, { name: 'Coco都可', type: '饮品' },
  ],
  coffee: [
    { name: '星巴客', type: '咖啡' }, { name: '瑞幸咖啡', type: '咖啡' },
    { name: '库迪咖啡', type: '咖啡' }, { name: '幸运咖', type: '咖啡' },
    { name: '蓝瓶咖啡', type: '咖啡' }, { name: '太平洋咖啡', type: '咖啡' },
    { name: 'Manner咖啡', type: '咖啡' }, { name: 'Tim Hortons', type: '咖啡' },
  ],
  food: [
    { name: '肯德基', type: '快餐' }, { name: '麦当劳', type: '快餐' },
    { name: '海底捞火锅', type: '火锅' }, { name: '呷哺呷哺', type: '火锅' },
    { name: '西贝莜面村', type: '餐饮' }, { name: '外婆家', type: '餐饮' },
    { name: '必胜客', type: '快餐' }, { name: '汉堡王', type: '快餐' },
    { name: '味千拉面', type: '餐饮' }, { name: '绿茶餐厅', type: '餐饮' },
    { name: '太二酸菜鱼', type: '餐饮' }, { name: '老乡鸡', type: '快餐' },
  ],
  retail: [
    { name: '名创优品', type: '零售' }, { name: '优衣库', type: '服装' },
    { name: '海澜之家', type: '服装' }, { name: '李宁', type: '运动' },
    { name: '安踏', type: '运动' }, { name: '华为体验店', type: '电子' },
    { name: '小米之家', type: '电子' }, { name: 'OPPO体验店', type: '电子' },
    { name: '屈臣氏', type: '美妆' }, { name: '沃尔玛', type: '超市' },
    { name: '大润发', type: '超市' }, { name: '苏宁易购', type: '电子' },
  ],
  convenience: [
    { name: '7-11便利店', type: '便利店' }, { name: '罗森', type: '便利店' },
    { name: '便利蜂', type: '便利店' }, { name: '美宜佳', type: '便利店' },
    { name: '全佳', type: '便利店' }, { name: '天福', type: '便利店' },
  ],
  service: [
    { name: 'XX银行', type: '银行' }, { name: '工商银行', type: '银行' },
    { name: '建设银行', type: '银行' }, { name: '农业银行', type: '银行' },
    { name: '招商银行', type: '银行' }, { name: 'XX电信', type: '服务' },
    { name: 'XX联通', type: '服务' }, { name: 'XX移动', type: '服务' },
    { name: '顺丰快递', type: '快递' }, { name: '菜鸟驿站', type: '快递' },
  ],
};
const SHOP_TEMPLATES = SHOP_TEMPLATES_SMALL;
const SHOP_CATEGORY_KEYS = Object.keys(SHOP_TEMPLATES_SMALL);

function generateShopName() {
  const lvId = gameState.cityLevelId || 0;
  const pool = lvId >= 2 ? SHOP_TEMPLATES_LARGE : SHOP_TEMPLATES_SMALL;
  const cat = SHOP_CATEGORY_KEYS[Math.floor(Math.random() * SHOP_CATEGORY_KEYS.length)];
  const catList = pool[cat] || SHOP_TEMPLATES_SMALL[cat];
  const shop = catList[Math.floor(Math.random() * catList.length)];
  return { name: shop.name, type: shop.type };
}

// ============== v2.2.6b: 轨道交通站点命名 ==============
const STATION_NAME_PARTS = {
  prefixes: ['人民', '解放', '中山', '文化', '科技', '滨江', '环城', '迎宾', '新华', '青年',
    '望江', '观澜', '青山', '碧波', '凌云', '清风', '明月', '朝阳', '夕阳', '听涛',
    '翠竹', '梧桐', '银杏', '紫荆', '丹桂', '红梅', '玉兰', '海棠', '丁香', '茉莉',
    '春晖', '夏荷', '秋实', '冬雪', '鹏程', '锦程', '康宁', '永宁', '德仁', '仁义',
    '永乐', '泰安', '昌盛', '繁华', '光明', '友谊', '振兴', '复兴', '团结', '幸福',
    '机场', '高铁', '火车', '汽车', '港口', '大学', '医院', '公园', '体育', '会展',
    '商业', '金融', '软件', '创新', '创业', '经开', '高新', '空港', '物流', '保税'],
  suffixes: ['广场', '公园', '大道', '路', '街', '桥', '门', '口', '湾', '湖', '河', '山', '岗', '坡', '坪', '村', '镇', '城', '园', '苑', '里', '坊'],
};

let usedStationNames = new Set();

// v2.2.8: 站点名联动附近道路名 — 从道路名提取前缀用于站名
function _extractRoadPrefix(roadName) {
  if (!roadName) return null;
  // 道路名格式: prefix + middle(方位词) + suffix(街/路/大道等)
  // 尝试去掉常见方位词和后缀
  const directions = ['东', '西', '南', '北', '中'];
  const roadSuffixes = ['大道', '大街', '高速', '快速路', '高等级公路', '街', '路', '巷', '弄', '径', '坊'];
  let name = roadName;
  // 去后缀（从长到短）
  for (const suf of roadSuffixes.sort((a, b) => b.length - a.length)) {
    if (name.endsWith(suf)) { name = name.slice(0, -suf.length); break; }
  }
  // 去方位词
  for (const d of directions) {
    if (name.endsWith(d)) { name = name.slice(0, -1); break; }
  }
  // 如果去掉后缀和方位词后仍有内容，且长度>=2，则作为前缀
  if (name.length >= 2) return name;
  return null;
}

// v2.2.8: 站点名联动附近道路名 — 可选传入坐标
function generateStationName(x, y) {
  // v2.2.8: 优先从附近道路名提取前缀
  if (typeof x === 'number' && typeof y === 'number' && typeof getNearbyRoadName === 'function') {
    const nearbyRoadName = getNearbyRoadName(x, y, 2);
    if (nearbyRoadName) {
      const roadPrefix = _extractRoadPrefix(nearbyRoadName);
      if (roadPrefix) {
        // 用道路前缀 + 随机站名后缀
        for (let attempt = 0; attempt < 10; attempt++) {
          const suffix = STATION_NAME_PARTS.suffixes[Math.floor(Math.random() * STATION_NAME_PARTS.suffixes.length)];
          const name = roadPrefix + suffix + '站';
          if (!usedStationNames.has(name)) {
            usedStationNames.add(name);
            return name;
          }
        }
      }
    }
  }
  // 无附近道路或重名，回退到随机生成
  for (let attempt = 0; attempt < 50; attempt++) {
    const prefix = STATION_NAME_PARTS.prefixes[Math.floor(Math.random() * STATION_NAME_PARTS.prefixes.length)];
    const suffix = STATION_NAME_PARTS.suffixes[Math.floor(Math.random() * STATION_NAME_PARTS.suffixes.length)];
    const name = prefix + suffix + '站';
    if (!usedStationNames.has(name)) {
      usedStationNames.add(name);
      return name;
    }
  }
  // Fallback with counter
  const fallback = '轨道站' + (usedStationNames.size + 1);
  usedStationNames.add(fallback);
  return fallback;
}

