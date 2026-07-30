/* 源自《置身事内》单文件版 - 人事系统 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ========== 人事系统 ==========
const BUREAUS = [
  { id: 'publicSecurity', name: '公安局', desc: '维护社会治安，影响安全度和犯罪率', effKey: 'safety' },
  { id: 'education', name: '教育局', desc: '管理学校和教育资源，影响教育水平', effKey: 'edu' },
  { id: 'finance', name: '财政局', desc: '管理财政收支，影响税收效率', effKey: 'tax' },
  { id: 'health', name: '卫健委', desc: '管理医疗卫生，影响健康水平', effKey: 'health' },
  { id: 'construction', name: '住建局', desc: '管理城市建设，影响建设速度', effKey: 'build' },
  { id: 'transport', name: '交通局', desc: '管理交通基础设施，影响交通效率', effKey: 'transport' },
  { id: 'resources', name: '自然资源局', desc: '管理土地和资源，影响土地收入', effKey: 'land' },
  { id: 'market', name: '市场监管局', desc: '管理市场秩序，影响商业环境', effKey: 'commerce' },
  { id: 'civil', name: '民政局', desc: '管理民政事务，影响民生满意度', effKey: 'civil' },
  { id: 'personnel', name: '人社局', desc: '管理人事和社保，影响就业', effKey: 'employ' },
  // v2.3.5: 新增国资委、发改委
  { id: 'sasac', name: '国资委', desc: '管理国有企业，影响公有企业效益', effKey: 'sasac' },
  { id: 'ndrc', name: '发改委', desc: '管理宏观经济，影响经济周期', effKey: 'economy' },
];

const FACTIONS = {
  local:    { name: '本地派', color: '#4a7a3a', desc: '熟悉基层，民意基础好，但容易形成利益集团' },
  airborne: { name: '空降派', color: '#3a5a8a', desc: '上级派来，清廉守规，但水土不服' },
  academic: { name: '学术派', color: '#7a5a3a', desc: '专业能力强，治理高效，但缺乏灵活性' },
  military: { name: '军转派', color: '#5a3a3a', desc: '纪律严明，执行力强，但过于刚硬', hidden: true },
};

// 可用派系列表（排除隐藏派系，如军转派为红线暂时禁用）
const VISIBLE_FACTION_KEYS = Object.keys(FACTIONS).filter(k => !FACTIONS[k].hidden);

const OFFICIAL_SURNAMES = ['王','李','张','刘','陈','杨','黄','赵','周','吴','徐','孙','马','胡','朱','郭','何','高','林','罗','郑','梁','谢','宋','唐','许','韩','冯','邓','曹','彭','曾','肖','田','董','袁','潘','于','蒋','蔡'];
const OFFICIAL_GIVEN_NAMES = ['建国','建华','国强','志明','文华','德昌','永康','海涛','俊杰','天明','晓东','立军','卫东','新民','耀祖','洪波','光明','振华','学军','永胜','伟杰','志刚','国栋','建平','德海','文彬','志远','国华','建民','永刚','立新','红星','卫民','志国','德明','文涛','海明','建军','志华','国平'];

function generateOfficialName() {
  const sn = OFFICIAL_SURNAMES[Math.floor(Math.random() * OFFICIAL_SURNAMES.length)];
  const gn = OFFICIAL_GIVEN_NAMES[Math.floor(Math.random() * OFFICIAL_GIVEN_NAMES.length)];
  return sn + gn;
}

function generateOfficial(opts) {
  // v2.2.4b: 新招录的干部不分配派系（faction: null），通过个人事件拉拢
  const faction = (opts && opts.faction !== undefined) ? opts.faction : null;
  return {
    id: 'off_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
    name: generateOfficialName(),
    faction: faction,
    competence: Math.floor(Math.random() * 4) + 4, // 4-7
    loyalty: Math.floor(Math.random() * 4) + 3,   // 3-6
    corruptionTendency: Math.floor(Math.random() * 5) + 1, // 1-5
    age: Math.floor(Math.random() * 15) + 38,     // 38-52
    tenureMonths: 0,   // v2.2.4b: 任职月数（用于能力增益计算）
    recruited: false,  // v2.2.4b: 是否已被玩家拉拢到本派系
  };
}

function generateOfficialPool(count, opts) {
  const pool = [];
  for (let i = 0; i < count; i++) pool.push(generateOfficial(opts));
  return pool;
}

// v2.4.1a: 常务委员会（原常务委员会）
const COMMITTEE_ROLES = [
  { id: 'secretary', name: '党委书记', desc: '即玩家本人，主持全面工作', isPlayer: true },
  { id: 'mayor', name: '行政主官', desc: '分管经济社会发展全面工作' },
  { id: 'deputy', name: '分管副书记', desc: '协助书记处理日常事务，分管党建政法' },
  { id: 'discipline', name: '纪委书记', desc: '主管党风廉政建设和反腐败工作' },
  { id: 'organization', name: '组织部长', desc: '主管干部人事和基层组织建设' },
];

// v2.4.1a: 根据地图等级获取行政主官职务名
function getMayorTitle(cityLevelId) {
  const titles = ['镇长', '县长', '市长', '市长', '市长'];
  return titles[cityLevelId] || '行政主官';
}

// v2.4.1a: 获取常委职务名（含行政主官等级化）
function getCommitteeRoleName(roleId, cityLevelId) {
  if (roleId === 'mayor') return getMayorTitle(cityLevelId || 0);
  const role = COMMITTEE_ROLES.find(r => r.id === roleId);
  return role ? role.name : '常委';
}

// v2.4.1a: 生成常务委员会成员
function generateCommittee(playerFactionKey) {
  const members = [];
  const cityLevelId = (typeof gameState !== 'undefined' && gameState.cityLevelId) || 0;
  // 党委书记即玩家
  members.push({
    id: 'cm_player',
    name: (typeof gameState !== 'undefined' && gameState.playerName) || '同志',
    role: 'secretary',
    roleName: '党委书记',
    faction: playerFactionKey,
    isPlayer: true,
    competence: 6,
    loyalty: 10,
    corruptionTendency: 1,
    age: 45,
    recruited: true,
    tenureMonths: (typeof gameState !== 'undefined' && gameState.termTurn) || 0,
  });
  // 其余4名成员由系统自动分配
  const otherRoles = COMMITTEE_ROLES.filter(r => !r.isPlayer);
  for (const role of otherRoles) {
    const off = generateOfficial({ faction: 'random' });
    off.id = 'cm_' + role.id + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    off.role = role.id;
    off.roleName = getCommitteeRoleName(role.id, cityLevelId);
    off.faction = VISIBLE_FACTION_KEYS[Math.floor(Math.random() * VISIBLE_FACTION_KEYS.length)];
    // 常委年龄偏大
    off.age = Math.floor(Math.random() * 12) + 42;
    // 常委能力偏高
    off.competence = Math.floor(Math.random() * 3) + 5; // 5-7
    off.isPlayer = false;
    off.isCommittee = true;
    members.push(off);
  }
  return members;
}

// v2.4.1: 计算常务委员会主导派系
function getCommitteeDominantFaction(members) {
  if (!members || members.length === 0) return null;
  const counts = {};
  for (const m of members) {
    if (!m.isPlayer && m.faction) {
      counts[m.faction] = (counts[m.faction] || 0) + 1;
    }
  }
  let maxCount = 0;
  let dominant = null;
  for (const fk of Object.keys(counts)) {
    if (counts[fk] > maxCount) {
      maxCount = counts[fk];
      dominant = fk;
    }
  }
  return dominant;
}

