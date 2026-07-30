/* 源自《置身事内》单文件版 - 事件池 */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 事件池 ==============
const EVENT_POOL = [
  { id: 'flood', type: 'danger', tag: '自然灾害', title: '洪涝灾害',
    desc: (s) => `连日暴雨导致${s.cityName}部分低洼地区发生洪涝灾害，多处住宅和基础设施严重受损。`,
    condition: (s) => s.month >= 6 && s.month <= 9, weight: 3,
    choices: [
      { text: '全力救灾（花费¥800万）', effects: { treasury: -800, happiness: 3, reputation: 5 }, color: 'green' },
      { text: '象征性慰问（花费¥100万）', effects: { treasury: -100, happiness: -10, reputation: -8 }, color: 'yellow' },
      { text: '隐瞒灾情', effects: { happiness: -15, reputation: -15, inspection: 15 }, color: 'red' },
    ],
    postEffect: (s, choiceIdx) => {
      // 洪水随机摧毁建筑和人口，救灾力度影响损失
      const buildingCount = s.buildings.length;
      const destroyRate = choiceIdx === 0 ? 0.05 : choiceIdx === 1 ? 0.15 : 0.25;
      const destroyCount = Math.floor(buildingCount * destroyRate);
      const popLoss = Math.floor(s.population * (choiceIdx === 0 ? 0.01 : choiceIdx === 1 ? 0.05 : 0.1));
      if (destroyCount > 0) {
        for (let i = 0; i < destroyCount; i++) {
          const idx = Math.floor(Math.random() * s.buildings.length);
          if (idx >= 0 && s.buildings.length > 0) s.buildings.splice(idx, 1);
        }
        s.buildingCount = s.buildings.length;
      }
      s.population = Math.max(100, s.population - popLoss);
      s.happiness = Math.max(0, s.happiness - (choiceIdx === 0 ? 2 : 8));
      return { title: '洪水损失报告', msg: `洪水摧毁了${destroyCount}栋建筑，人口损失${popLoss}人。${choiceIdx === 0 ? '全力救灾减少了损失。' : choiceIdx === 1 ? '救灾不力导致损失扩大。' : '隐瞒灾情导致严重后果！'}`, effects: {} };
    } },
  { id: 'earthquake', type: 'danger', tag: '自然灾害', title: '地震预警',
    desc: (s) => `地震局发布预警：${s.cityName}周边可能发生5.8级地震。`,
    condition: (s) => true, weight: 1,
    choices: [
      { text: '启动一级响应，全面疏散（¥2000万）', effects: { treasury: -2000, happiness: 5, reputation: 10, population: -50 }, color: 'green' },
      { text: '加强监测，暂不疏散', effects: { happiness: -5 }, color: 'yellow' },
      { text: '不公开信息', effects: { inspection: 20, happiness: -3 }, color: 'red' },
    ],
    postEffect: (s, choiceIdx) => {
      // 地震随机摧毁大量建筑和人口
      const buildingCount = s.buildings.length;
      const destroyRate = choiceIdx === 0 ? 0.1 : choiceIdx === 1 ? 0.3 : 0.4;
      const destroyCount = Math.floor(buildingCount * destroyRate);
      const popLoss = Math.floor(s.population * (choiceIdx === 0 ? 0.02 : choiceIdx === 1 ? 0.1 : 0.15));
      if (destroyCount > 0) {
        for (let i = 0; i < destroyCount; i++) {
          const idx = Math.floor(Math.random() * s.buildings.length);
          if (idx >= 0 && s.buildings.length > 0) s.buildings.splice(idx, 1);
        }
        s.buildingCount = s.buildings.length;
      }
      s.population = Math.max(100, s.population - popLoss);
      s.happiness = Math.max(0, s.happiness - (choiceIdx === 0 ? 3 : 15));
      s.gdpMult = Math.max(0.5, s.gdpMult * (1 - destroyRate * 0.3));
      return { title: '地震损失报告', msg: `地震摧毁了${destroyCount}栋建筑，人口损失${popLoss}人。${choiceIdx === 0 ? '及时疏散降低了伤亡。' : choiceIdx === 1 ? '未疏散导致较大伤亡。' : '隐瞒预警酿成惨重后果！'}`, effects: {} };
    } },
  { id: 'tofuProject', type: 'danger', tag: '豆腐渣工程', title: '豆腐渣工程曝光',
    desc: (s) => `媒体曝光${s.cityName}某在建项目使用劣质建材，存在严重安全隐患。经调查，该项目存在层层转包、偷工减料等问题。`,
    condition: (s) => s.corruption > 15 && s.buildingCount > 15, weight: (s) => Math.min(20, Math.floor(s.corruption / 3) + 2),
    choices: [
      { text: '立即停工整改，追究责任', effects: { treasury: -500, happiness: 3, reputation: 8, corruption: -5 }, color: 'green' },
      { text: '低调处理，仅罚款了事', effects: { treasury: -200, happiness: -5, reputation: -5, inspection: 10 }, color: 'yellow' },
      { text: '掩盖事实，封锁消息', effects: { corruption: 10, inspection: 20, happiness: -8 }, color: 'red' },
    ],
    postEffect: (s, choiceIdx) => {
      // 豆腐渣工程随机摧毁部分建筑
      const destroyCount = Math.floor(s.buildings.length * (choiceIdx === 0 ? 0.03 : 0.08));
      if (destroyCount > 0) {
        for (let i = 0; i < destroyCount; i++) {
          const idx = Math.floor(Math.random() * s.buildings.length);
          if (s.buildings.length > 0) s.buildings.splice(idx, 1);
        }
        s.buildingCount = s.buildings.length;
      }
      s.happiness = Math.max(0, s.happiness - (choiceIdx === 0 ? 2 : 10));
      return { title: '豆腐渣工程处理结果', msg: `${choiceIdx === 0 ? '主动整改挽回了一定声誉，但' : ''}共有${destroyCount}栋建筑被认定存在质量问题需拆除重建。${choiceIdx === 2 ? '封锁消息的行为已引起纪委注意！' : ''}`, effects: {} };
    } },
  { id: 'typhoon', type: 'danger', tag: '自然灾害', title: '台风过境',
    desc: (s) => `气象台发布台风红色预警：强台风将于近日正面登陆${s.cityName}沿海地区，预计带来狂风暴雨。`,
    condition: (s) => s.month >= 7 && s.month <= 10, weight: 2,
    choices: [
      { text: '紧急转移安置（¥1200万）', effects: { treasury: -1200, happiness: 5, reputation: 8 }, color: 'green' },
      { text: '仅发布预警通知', effects: { treasury: -100, happiness: -8, reputation: -5 }, color: 'yellow' },
      { text: '不以为意', effects: { happiness: -12, reputation: -10, inspection: 8 }, color: 'red' },
    ],
    postEffect: (s, choiceIdx) => {
      const buildingCount = s.buildings.length;
      const destroyRate = choiceIdx === 0 ? 0.04 : choiceIdx === 1 ? 0.12 : 0.2;
      const destroyCount = Math.floor(buildingCount * destroyRate);
      const popLoss = Math.floor(s.population * (choiceIdx === 0 ? 0.005 : choiceIdx === 1 ? 0.03 : 0.08));
      if (destroyCount > 0) { for (let i = 0; i < destroyCount; i++) { const idx = Math.floor(Math.random() * s.buildings.length); if (s.buildings.length > 0) s.buildings.splice(idx, 1); } s.buildingCount = s.buildings.length; }
      s.population = Math.max(100, s.population - popLoss);
      s.happiness = Math.max(0, s.happiness - (choiceIdx === 0 ? 2 : 6));
      return { title: '台风损失报告', msg: `台风过境摧毁了${destroyCount}栋建筑，转移安置${popLoss}人。${choiceIdx === 0 ? '提前转移有效降低了损失。' : choiceIdx === 1 ? '预警不足导致部分伤亡。' : '疏于防范酿成严重后果！'}`, effects: {} };
    } },
  { id: 'drought', type: 'danger', tag: '自然灾害', title: '严重旱灾',
    desc: (s) => `${s.cityName}遭遇罕见持续干旱，水库蓄水量急剧下降，农作物大面积绝收，居民饮水出现困难。`,
    condition: (s) => (s.month >= 1 && s.month <= 5) || (s.month >= 11 && s.month <= 12), weight: 2,
    choices: [
      { text: '调水救灾，保障民生（¥1500万）', effects: { treasury: -1500, happiness: 3, reputation: 6 }, color: 'green' },
      { text: '限制用水，等待降雨', effects: { happiness: -8, reputation: -3 }, color: 'yellow' },
      { text: '不管不问', effects: { happiness: -15, reputation: -10, inspection: 10 }, color: 'red' },
    ],
    postEffect: (s, choiceIdx) => {
      const gdpLoss = choiceIdx === 0 ? 0.05 : choiceIdx === 1 ? 0.15 : 0.25;
      s.gdpMult = Math.max(0.5, s.gdpMult * (1 - gdpLoss));
      const popLoss = Math.floor(s.population * (choiceIdx === 0 ? 0.002 : choiceIdx === 1 ? 0.01 : 0.03));
      s.population = Math.max(100, s.population - popLoss);
      s.happiness = Math.max(0, s.happiness - (choiceIdx === 0 ? 3 : 10));
      return { title: '旱灾损失报告', msg: `旱灾导致GDP下降${(gdpLoss*100).toFixed(0)}%，人口流失${popLoss}人。${choiceIdx === 0 ? '调水救灾缓解了旱情。' : choiceIdx === 1 ? '限水措施收效有限。' : '漠视旱情导致大量人口流失！'}`, effects: {} };
    } },
  { id: 'landslide', type: 'danger', tag: '自然灾害', title: '山体滑坡',
    desc: (s) => `受强降雨影响，${s.cityName}山区发生大规模山体滑坡，多处道路中断，部分建筑被掩埋。`,
    condition: (s) => s.month >= 5 && s.month <= 9, weight: 1,
    choices: [
      { text: '全力抢险救援（¥600万）', effects: { treasury: -600, happiness: 2, reputation: 4 }, color: 'green' },
      { text: '组织自救，暂不拨款', effects: { happiness: -5, reputation: -3 }, color: 'yellow' },
      { text: '压低灾情不上报', effects: { happiness: -10, reputation: -8, inspection: 12 }, color: 'red' },
    ],
    postEffect: (s, choiceIdx) => {
      const buildingCount = s.buildings.length;
      const destroyRate = choiceIdx === 0 ? 0.03 : choiceIdx === 1 ? 0.08 : 0.15;
      const destroyCount = Math.floor(buildingCount * destroyRate);
      if (destroyCount > 0) { for (let i = 0; i < destroyCount; i++) { const idx = Math.floor(Math.random() * s.buildings.length); if (s.buildings.length > 0) s.buildings.splice(idx, 1); } s.buildingCount = s.buildings.length; }
      s.happiness = Math.max(0, s.happiness - (choiceIdx === 0 ? 2 : 6));
      return { title: '滑坡损失报告', msg: `山体滑坡掩埋了${destroyCount}栋建筑。${choiceIdx === 0 ? '及时抢险减少了损失。' : choiceIdx === 1 ? '自救力量有限。' : '瞒报灾情将面临追责！'}`, effects: {} };
    } },
  { id: 'snowstorm', type: 'danger', tag: '自然灾害', title: '暴雪寒潮',
    desc: (s) => `中央气象台发布暴雪橙色预警：${s.cityName}将迎来大范围强降雪和寒潮天气，气温骤降至零下15度。`,
    condition: (s) => s.month >= 12 || s.month <= 2, weight: 2,
    choices: [
      { text: '启动防寒应急响应（¥800万）', effects: { treasury: -800, happiness: 4, reputation: 5 }, color: 'green' },
      { text: '提醒市民注意保暖', effects: { happiness: -3, reputation: -2 }, color: 'yellow' },
      { text: '未采取任何措施', effects: { happiness: -10, reputation: -6, inspection: 5 }, color: 'red' },
    ],
    postEffect: (s, choiceIdx) => {
      const popLoss = Math.floor(s.population * (choiceIdx === 0 ? 0.001 : choiceIdx === 1 ? 0.005 : 0.02));
      s.population = Math.max(100, s.population - popLoss);
      s.happiness = Math.max(0, s.happiness - (choiceIdx === 0 ? 1 : 8));
      if (choiceIdx === 2) s.gdpMult = Math.max(0.5, s.gdpMult * 0.95);
      return { title: '寒潮损失报告', msg: `暴雪寒潮导致${popLoss}人受影响。${choiceIdx === 0 ? '应急响应有效保障了民生。' : choiceIdx === 1 ? '提醒措施略显不足。' : '无作为导致部分弱势群体受灾！'}`, effects: {} };
    } },
  { id: 'bribe1', type: 'corruption', tag: '腐败诱惑', title: '开发商行贿',
    desc: (s) => `某房地产开发商想要以低价获取城东优质地块，通过中间人向你送来¥500万"好处费"。`,
    condition: (s) => s.turn > 3, weight: 12,
    choices: [
      { text: '拒绝受贿，依法办事', effects: { reputation: 8, happiness: 2 }, color: 'green' },
      { text: '收下好处费（+¥500万，腐败+15）', effects: { privateAccount: 500, corruption: 15, inspection: 5 }, color: 'red' },
      { text: '收下并上交纪委', effects: { reputation: 12, inspection: -10 }, color: 'blue' },
    ] },
  { id: 'bribe2', type: 'corruption', tag: '腐败诱惑', title: '工程招标暗箱操作',
    desc: (s) => `某建筑公司老板是你的老乡，希望你在市政工程招标中"照顾"一下。他承诺事后给你¥800万"感谢费"。`,
    condition: (s) => s.turn > 6 && s.buildingCount > 20, weight: 10,
    choices: [
      { text: '拒绝，公开招标', effects: { reputation: 6 }, color: 'green' },
      { text: '暗中帮忙（+¥800万，腐败+20）', effects: { privateAccount: 800, corruption: 20, inspection: 8 }, color: 'red' },
    ] },
  { id: 'inspection', type: 'warn', tag: '纪委巡查', title: '纪委专项巡查',
    desc: (s) => `省纪委派出巡查组，对${s.cityName}近期工程项目和财政状况进行专项巡查。`,
    // v2.3.7c: 纪委巡查改为由inspectionRisk触发，不再直接由corruption触发
    condition: (s) => (s.inspectionRisk || 0) > 30, weight: 12,
    choices: [{ text: '积极配合巡查', effects: {}, color: 'blue' }],
    postEffect: (s) => {
      // v2.3.7c: 提高game-over阈值，不再因腐败值中等就game over
      if (s.corruption > 70 && (s.inspectionRisk || 0) > 60) return { title: '巡查结果：严重违纪', msg: '纪委在巡查中发现严重违纪问题，你被立案调查。', gameOver: true, type: 'corruption_caught' };
      if (s.corruption > 45) return { title: '巡查结果：警告处分', msg: '纪委发现部分问题，给予党内警告处分。', effects: { reputation: -20, corruption: -10, happiness: -5, inspection: -15 } };
      return { title: '巡查结果：未发现问题', msg: '巡查组未发现明显违纪问题，你的廉洁形象得到肯定。', effects: { reputation: 10, inspection: -10 } };
    } },
  { id: 'investment', type: 'info', tag: '工商发展', title: '大型企业投资意向',
    desc: (s) => `某世界500强企业有意在${s.cityName}投资建设大型生产基地，预计投资¥5亿，年税收¥3000万，但需要提供200亩工业用地和税收优惠。`,
    condition: (s) => s.turn > 2, weight: 10,
    choices: [
      { text: '欢迎投资，给予税收优惠', effects: { gdpMult: 1.1, happiness: 5, reputation: 8, treasury: -500 }, color: 'green' },
      { text: '接受投资，但不给优惠', effects: { gdpMult: 1.05, happiness: 3, reputation: 3 }, color: 'blue' },
      { text: '拒绝（污染顾虑）', effects: { happiness: 2 }, color: 'yellow' },
    ] },
  // v2.3.5: 企业系统关联事件
  { id: 'soe_reform', type: 'info', tag: '国企改革', title: '国有企业改制争议',
    desc: (s) => `市国资委提出对部分效益低下的公有企业进行所有制改革，涉及${(s.enterprises||[]).filter(e=>e.ownership==='stateOwned').length}家公有企业。工会代表表示反对，担心职工安置问题。`,
    condition: (s) => s.turn > 3 && (s.enterprises||[]).some(e => e.ownership === 'stateOwned'), weight: 8,
    choices: [
      { text: '积极推进改制（GDP+5%，纪委风险+5）', effects: { gdpMult: 1.05, inspection: 5, happiness: -3 }, color: 'green' },
      { text: '暂缓改制，先做职工安置', effects: { happiness: 5, reputation: 3, treasury: -200 }, color: 'blue' },
      { text: '利用改制谋取私利（腐败+15）', effects: { corruption: 15, inspection: 20, privateAccount: 500 }, color: 'red',
        condition: (s) => s.corruption < 80 },
    ] },
  { id: 'enterprise_audit', type: 'warn', tag: '工商发展', title: '企业税务稽查',
    desc: (s) => `税务部门在对辖区企业进行专项稽查时，发现部分民营及混合所有制企业存在偷漏税行为。`,
    condition: (s) => s.turn > 4 && (s.enterprises||[]).length > 3, weight: 7,
    choices: [
      { text: '严格执法，追缴税款', effects: { treasury: 800, happiness: -2, reputation: 3 }, color: 'green' },
      { text: '从轻处理，优化营商环境', effects: { happiness: 3, gdpMult: 1.02 }, color: 'blue' },
      { text: '选择性执法（收好处）', effects: { corruption: 8, inspection: 10, privateAccount: 300 }, color: 'red',
        condition: (s) => s.corruption < 70 },
    ] },
  { id: 'ndrc_policy', type: 'info', tag: '经济周期', title: '发改委宏观调控',
    desc: (s) => `发改委建议根据当前经济形势调整宏观政策。当前GDP增长率${((s.gdpGrowth||0)*100).toFixed(1)}%，${(s.gdpGrowth||0) > 0.05 ? '经济过热风险' : '需要刺激增长'}。`,
    condition: (s) => s.turn > 5 && s.personnel && s.personnel.appointments.ndrc, weight: 6,
    choices: [
      { text: '紧缩政策（抑制过热）', effects: { gdpMult: 0.95, happiness: -2, corruption: -2 }, color: 'yellow',
        condition: (s) => (s.gdpGrowth||0) > 0.05 },
      { text: '刺激政策（促进增长）', effects: { gdpMult: 1.08, treasury: -300, happiness: 3 }, color: 'green',
        condition: (s) => (s.gdpGrowth||0) < 0.03 },
      { text: '维持现状', effects: {}, color: 'blue' },
    ] },
  { id: 'personal_company_risk', type: 'danger', tag: '利益冲突', title: '个人企业被曝光',
    desc: (s) => `有媒体曝光你名下持有${(s.personalCompanies||[]).length}家企业，质疑存在利益输送和权力寻租。纪委已介入调查。`,
    condition: (s) => s.turn > 6 && (s.personalCompanies||[]).length > 0 && s.inspectionRisk > 30, weight: 12,
    choices: [
      { text: '立即转让所有企业', effects: { inspection: -15, happiness: 2, reputation: 3 }, color: 'green',
        customAction: (s) => { // 转让所有个人企业
          let total = 0;
          for (const pc of (s.personalCompanies||[])) {
            total += Math.round((pc.purchasedPrice || pc.capital * 0.3 || 0) * 0.8);
            const ent = (s.enterprises||[]).find(e => e.id === pc.entId);
            if (ent) ent.ownedBy = null;
          }
          s.privateAccount += total;
          s.personalCompanies = [];
          logEvent(`转让所有个人企业，获得¥${total}万`, 'info');
        } },
      { text: '辩称是家人代持', effects: { inspection: 10, corruption: 5, reputation: -5 }, color: 'yellow' },
      { text: '动用权力压制媒体', effects: { inspection: 15, corruption: 10, reputation: -10, happiness: -5 }, color: 'red',
        condition: (s) => s.corruption < 70 },
    ] },
  { id: 'merger_opportunity', type: 'info', tag: '工商发展', title: '并购机会',
    desc: (s) => {
      const ent = (s.enterprises||[]).find(e=>e.ownership==='private'||e.ownership==='foreign');
      return `一家优质民营企业${ent ? (ent.shortName || ent.name) : '某公司'}出现经营困难，可由公有企业低价并购。`;
    },
    condition: (s) => s.turn > 4 && (s.enterprises||[]).some(e => e.ownership === 'stateOwned') && (s.enterprises||[]).some(e => e.ownership === 'private' || e.ownership === 'foreign'), weight: 6,
    choices: [
      { text: '指示公有企业并购（¥500万）', effects: { treasury: -500, gdpMult: 1.03, reputation: 2 }, color: 'green',
        condition: (s) => s.treasury >= 500,
        customAction: (s) => {
          // v2.3.6c: 将一家民营企业转为公有企业
          // v2.3.7b: 修复只匹配private不匹配foreign的bug
          const privateEnt = (s.enterprises||[]).find(e => (e.ownership === 'private' || e.ownership === 'foreign') && !e.ownedBy);
          if (privateEnt) {
            privateEnt.ownership = 'stateOwned';
            privateEnt.equity = { state: 100, private: 0, foreign: 0 };
            privateEnt.reformed = true;
            // 重新计算税收和财政扶持
            privateEnt.taxContribution = 0;
            privateEnt.fiscalSupport = Math.round(privateEnt.annualProfit * 0.3 * (0.8 + Math.random() * 0.4));
            logEvent(`公有企业并购「${privateEnt.shortName || privateEnt.name}」完成，转为公有企业`, 'success');
            showNotification(`并购成功，「${privateEnt.shortName || privateEnt.name}」已转为公有企业`, 'success');
          }
        } },
      { text: '让关系户低价收购', effects: { corruption: 12, inspection: 10, privateAccount: 300 }, color: 'red',
        condition: (s) => s.corruption < 75,
        customAction: (s) => {
          // v2.3.7b: 修复只匹配private不匹配foreign的bug
          const privateEnt = (s.enterprises||[]).find(e => (e.ownership === 'private' || e.ownership === 'foreign') && !e.ownedBy);
          if (privateEnt) {
            privateEnt.ownedBy = 'player';
            const monthlyProfit = Math.round(privateEnt.annualProfit * 0.3);
            s.personalCompanies = s.personalCompanies || [];
            s.personalCompanies.push({
              id: 'pc_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
              name: privateEnt.name,
              shortName: privateEnt.shortName,
              ownership: privateEnt.ownership,
              capital: privateEnt.capital,
              monthlyProfit: monthlyProfit,
              purchasedPrice: 300,
              x: privateEnt.x,
              y: privateEnt.y,
              status: '经营中',
              entId: privateEnt.id,
              injected: 0,
            });
            logEvent(`关系户低价收购「${privateEnt.shortName || privateEnt.name}」`, 'corruption');
          }
        } },
      { text: '不介入', effects: {}, color: 'gray' },
    ] },
  { id: 'protest', type: 'warn', tag: '群体事件', title: '市民集体上访',
    desc: (s) => `因${s.airQuality > 150 ? '空气质量恶化' : s.unemployment > 0.1 ? '失业率过高' : '拆迁补偿问题'}，数百名市民到市政府门前集体上访。`,
    condition: (s) => s.airQuality > 120 || s.unemployment > 0.1 || s.happiness < 40, weight: 10,
    choices: [
      { text: '亲自接访，承诺解决', effects: { happiness: 5, reputation: 5, treasury: -300 }, color: 'green' },
      { text: '出钱安抚上访群众（¥1000万）', effects: { happiness: 8, reputation: 3, treasury: -1000, corruption: 3 }, color: 'yellow',
        condition: (s) => s.treasury >= 1000 },
      { text: '派出信访部门处理', effects: { happiness: 0, reputation: -2 }, color: 'blue' },
      { text: '强制驱散', effects: { happiness: -15, reputation: -15, inspection: 10 }, color: 'red' },
    ] },
  { id: 'epidemic', type: 'danger', tag: '公共卫生', title: '传染病疫情',
    desc: (s) => `疾控中心报告：${s.cityName}出现聚集性传染病病例，疫情有扩散趋势。`,
    condition: (s) => s.healthcareIndex < 40 && s.population > 30000, weight: 6,
    choices: [
      { text: '立即启动应急预案（¥1500万）', effects: { treasury: -1500, happiness: 3, reputation: 8, population: -100 }, color: 'green' },
      { text: '花钱封锁消息（¥2000万）', effects: { treasury: -2000, happiness: -3, reputation: -5, corruption: 10, inspection: 15, population: -300 }, color: 'yellow',
        condition: (s) => s.treasury >= 2000 },
      { text: '常规处置', effects: { happiness: -5, population: -500, healthcareIndex: 5 }, color: 'blue' },
      { text: '隐瞒疫情', effects: { happiness: -10, reputation: -10, inspection: 25, population: -1000 }, color: 'red' },
    ] },
  { id: 'promotion', type: 'success', tag: '政治机遇', title: '上级考察',
    desc: (s) => `省委组织部派考察组来${s.cityName}考察干部，你的政绩受到关注。`,
    condition: (s) => s.livabilityScore > 70 && s.reputation > 60, weight: 8,
    choices: [
      { text: '如实汇报工作', effects: { reputation: 10, merit: 20 }, color: 'green' },
      { text: '请客送礼打点关系（¥800万）', effects: { reputation: 5, merit: 30, treasury: -800, corruption: 8, inspection: 5 }, color: 'yellow',
        condition: (s) => s.treasury >= 800 },
      { text: '豪掷千金拉关系（¥3000万）', effects: { reputation: 15, merit: 50, treasury: -3000, corruption: 15, inspection: 10 }, color: 'orange',
        condition: (s) => s.treasury >= 3000 },
    ],
    postEffect: (s) => {
      if (s.livabilityScore > 85 && s.reputation > 75 && s.corruption < 15) return { title: '上级好评', msg: '考察组对你的政绩和廉洁形象给予高度评价，建议在下次任期考核时重点考虑提拔。' };
      return null;
    } },
  { id: 'envAward', type: 'success', tag: '荣誉表彰', title: '环保模范城市评选',
    desc: (s) => `国家环保部开展环保模范城市评选，${s.cityName}初步入围。`,
    condition: (s) => s.airQuality < 60 && s.greenCoverage > 25, weight: 6,
    choices: [
      { text: '积极申报', effects: { reputation: 15, happiness: 8, merit: 15 }, color: 'green' },
      { text: '放弃申报', effects: {}, color: 'yellow' },
    ] },
  { id: 'economicBoom', type: 'success', tag: '经济机遇', title: '经济上行周期',
    desc: (s) => `宏观经济进入上行周期，${s.cityName}的工商业活动活跃度提升。`,
    condition: (s) => s.turn > 5, weight: 7,
    choices: [{ text: '顺势而为', effects: { gdpMult: 1.08, happiness: 3 }, color: 'green' }] },
  { id: 'economicCrisis', type: 'danger', tag: '经济风险', title: '经济下行压力',
    desc: (s) => `受国际经济形势影响，${s.cityName}面临经济下行压力，部分企业裁员。`,
    condition: (s) => s.turn > 8, weight: 6,
    choices: [
      { text: '出台刺激政策（¥2000万）', effects: { treasury: -2000, gdpMult: 1.03, happiness: 2, unemployment: -0.02 }, color: 'green' },
      { text: '让市场自行调整', effects: { gdpMult: 0.92, happiness: -5, unemployment: 0.03 }, color: 'yellow' },
    ] },
  { id: 'landDispute', type: 'warn', tag: '社会矛盾', title: '征地拆迁纠纷',
    desc: (s) => `城郊某村村民因征地补偿标准问题与开发商发生冲突，矛盾激化。`,
    condition: (s) => s.buildingCount > 30 && s.turn > 4, weight: 8,
    choices: [
      { text: '提高补偿标准（¥600万）', effects: { treasury: -600, happiness: 5, reputation: 5 }, color: 'green' },
      { text: '维持原补偿方案', effects: { happiness: -8, reputation: -5, inspection: 5 }, color: 'yellow' },
      { text: '接受开发商"赞助"后压低补偿', effects: { privateAccount: 300, corruption: 8, happiness: -12, inspection: 10 }, color: 'red' },
    ] },
  { id: 'fire', type: 'danger', tag: '安全事故', title: '重大火灾事故',
    desc: (s) => `${s.cityName}某工业区发生重大火灾事故，造成人员伤亡和财产损失。`,
    condition: (s) => { let hc=0; s.buildings.forEach(b=>{if(b.type==='hazInd')hc++;}); return hc > 2; }, weight: 8,
    choices: [
      { text: '全力救援，善后安抚（¥500万）', effects: { treasury: -500, happiness: -3, reputation: 3 }, color: 'green' },
      { text: '常规处置', effects: { happiness: -8, reputation: -5 }, color: 'yellow' },
    ] },
  { id: 'antiCorruption', type: 'warn', tag: '反腐风暴', title: '全国反腐专项行动',
    desc: (s) => `XX部署全国反腐专项行动，要求各地纪委加大查处力度。`,
    condition: (s) => s.corruption > 10, weight: 5,
    choices: [
      { text: '主动自查自纠', effects: { corruption: -5, reputation: 5, merit: 5 }, color: 'green' },
      { text: '观望形势', effects: { inspection: 15 }, color: 'yellow' },
    ] },
  { id: 'talentPlan', type: 'info', tag: '人才政策', title: '高层次人才引进',
    desc: (s) => `市委组织部建议出台高层次人才引进计划，提供住房补贴和创业扶持。`,
    condition: (s) => s.educationIndex > 30 && s.turn > 3, weight: 5,
    choices: [
      { text: '批准实施（¥800万/年）', effects: { treasury: -800, happiness: 3, educationIndex: 10, gdpMult: 1.03, reputation: 5 }, color: 'green' },
      { text: '暂缓实施', effects: {}, color: 'yellow' },
    ] },
  // === 新增事件 (v3.3) ===
  { id: 'constructionPetition', type: 'danger', tag: '群众上访', title: '拖欠工程款上访',
    desc: (s) => {
      const debt = (s.constructionProjects || []).reduce((a, p) => a + (p.accruedDebt || 0), 0);
      return `多名施工工人到市政府上访，反映工程款被长期拖欠。经核实，累计拖欠金额达¥${formatMoney(debt * 10000)}，工人们情绪激动，扬言要越级上访。`;
    },
    condition: (s) => {
      const debt = (s.constructionProjects || []).reduce((a, p) => a + (p.accruedDebt || 0), 0);
      return debt > 0;
    }, weight: 15,
    choices: [
      { text: '立即筹款结清欠款', effects: { happiness: 5, reputation: 8, corruption: -3 }, color: 'green',
        condition: (s) => {
          const debt = (s.constructionProjects || []).reduce((a, p) => a + (p.accruedDebt || 0), 0);
          return s.treasury >= debt;
        },
        // 动态计算cost在显示时注入
        _dynamicCost: true,
        customAction: (s) => {
          const debt = (s.constructionProjects || []).reduce((a, p) => a + (p.accruedDebt || 0), 0);
          s.treasury -= debt;
          for (const p of (s.constructionProjects || [])) p.accruedDebt = 0;
        }
      },
      { text: '承诺三个月内解决', effects: { happiness: -3, reputation: -5, inspection: 5 }, color: 'yellow' },
      { text: '推诿扯皮，让工人找开发商', effects: { happiness: -10, reputation: -10, inspection: 10, corruption: 3 }, color: 'red' },
    ] },
  { id: 'massPetition', type: 'warn', tag: '群众上访', title: '群众集体上访',
    desc: (s) => `${s.cityName}某社区居民因拆迁安置、子女入学等问题集体到市政府上访，人数约200人。`,
    condition: (s) => s.population > 5000 && s.turn > 6, weight: 10,
    choices: [
      { text: '亲自接访，承诺解决', effects: { happiness: 5, reputation: 5, merit: 5 }, color: 'green' },
      { text: '安排信访部门接待', effects: { happiness: -2 }, color: 'blue' },
      { text: '不予理睬', effects: { happiness: -8, reputation: -5, inspection: 5 }, color: 'yellow' },
    ] },
  { id: 'foodSafety', type: 'danger', tag: '公共安全', title: '食品安全事件',
    desc: (s) => `${s.cityName}某餐饮店被曝光使用过期食材，多名食客出现食物中毒症状。`,
    condition: (s) => s.businesses > 10 && s.turn > 4, weight: 8,
    choices: [
      { text: '严厉查处，吊销执照', effects: { happiness: 3, reputation: 3, treasury: -100 }, color: 'green' },
      { text: '低调处理，罚款了事', effects: { treasury: 50, happiness: -5, corruption: 3 }, color: 'yellow' },
      { text: '收受好处费后压下', effects: { privateAccount: 200, corruption: 10, inspection: 8, happiness: -10 }, color: 'red' },
    ] },
  { id: 'schoolOvercrowding', type: 'warn', tag: '民生问题', title: '学位紧张',
    desc: (s) => `随着人口增长，${s.cityName}多所中小学出现学位紧张，大班额现象严重。`,
    condition: (s) => s.population > 8000 && s.educationIndex < 60, weight: 8,
    choices: [
      { text: '紧急扩建学校（¥1200万）', effects: { treasury: -1200, happiness: 5, educationIndex: 8 }, color: 'green' },
      { text: '维持现状', effects: { happiness: -5, educationIndex: -3 }, color: 'yellow' },
    ] },
  { id: 'gangViolence', type: 'danger', tag: '治安事件', title: '黑恶势力火拼',
    desc: (s) => `${s.cityName}某商业街区发生黑恶势力火拼事件，造成多人受伤，社会影响恶劣。`,
    condition: (s) => s.underworld && s.underworld.crimeRate > 40, weight: 10,
    choices: [
      { text: '全面扫黑，严惩不贷（¥500万）', effects: { treasury: -500, reputation: 8, happiness: 5, corruption: -3 }, color: 'green' },
      { text: '常规治安处置', effects: { happiness: -3, reputation: -2 }, color: 'blue' },
      { text: '装作没看见', effects: { happiness: -8, reputation: -8, corruption: 5, inspection: 5 }, color: 'red' },
    ] },
  { id: 'waterPollution', type: 'warn', tag: '环境污染', title: '饮用水源地污染',
    desc: (s) => `${s.cityName}饮用水源地检测出重金属超标，疑似上游工业排污所致。`,
    condition: (s) => { let hi=0; s.buildings.forEach(b=>{if(b.type==='heavyInd'||b.type==='hazInd')hi++;}); return hi > 3; }, weight: 7,
    choices: [
      { text: '紧急处置，溯源追责（¥400万）', effects: { treasury: -400, happiness: 3, reputation: 3 }, color: 'green' },
      { text: '通知上游城市协调', effects: { happiness: -2, reputation: -2 }, color: 'blue' },
      { text: '隐瞒不报', effects: { corruption: 8, inspection: 15, happiness: -5 }, color: 'red' },
    ] },
  { id: 'trafficJam', type: 'info', tag: '城市治理', title: '交通拥堵加剧',
    desc: (s) => `${s.cityName}主干道早晚高峰严重拥堵，市民投诉不断。`,
    condition: (s) => s.population > 6000 && s.turn > 5, weight: 7,
    choices: [
      { text: '扩建道路（¥800万）', effects: { treasury: -800, happiness: 3, reputation: 3 }, color: 'green' },
      { text: '实施限行政策', effects: { happiness: -3, reputation: 1 }, color: 'blue' },
      { text: '暂不处理', effects: { happiness: -4 }, color: 'yellow' },
    ] },
  { id: 'corruptOfficial', type: 'warn', tag: '反腐警示', title: '下属干部落马',
    desc: (s) => `${s.cityName}某局副局长因严重违纪违法被纪委带走调查，牵涉多名商人。`,
    condition: (s) => s.corruption > 30 && s.turn > 6, weight: 6,
    choices: [
      { text: '积极配合调查，主动交代', effects: { corruption: -8, reputation: 3, inspection: -5 }, color: 'green' },
      { text: '切割关系，撇清责任', effects: { corruption: -2, inspection: 8, reputation: -3 }, color: 'yellow' },
      { text: '试图串供，阻挠调查', effects: { corruption: 5, inspection: 20, reputation: -8 }, color: 'red' },
    ] },
  { id: 'culturalEvent', type: 'info', tag: '文化建设', title: '民俗文化节',
    desc: (s) => `市文旅局建议举办${s.cityName}首届民俗文化节，提升城市形象和居民幸福感。`,
    condition: (s) => s.turn > 3, weight: 6,
    choices: [
      { text: '大力支持（¥300万）', effects: { treasury: -300, happiness: 8, reputation: 5, merit: 5 }, color: 'green' },
      { text: '小规模举办（¥100万）', effects: { treasury: -100, happiness: 3, reputation: 1 }, color: 'blue' },
      { text: '不予举办', effects: {}, color: 'yellow' },
    ] },
  { id: 'elderlyCare', type: 'warn', tag: '民生问题', title: '养老难题',
    desc: (s) => `${s.cityName}人口老龄化加剧，社区养老设施严重不足，多位老人反映养老困难。`,
    condition: (s) => s.turn > 10, weight: 5,
    choices: [
      { text: '建设社区养老中心（¥500万）', effects: { treasury: -500, happiness: 6, reputation: 4 }, color: 'green' },
      { text: '发放养老补贴（¥200万）', effects: { treasury: -200, happiness: 2 }, color: 'blue' },
      { text: '暂不处理', effects: { happiness: -5, reputation: -3 }, color: 'yellow' },
    ] },
  { id: 'educationReform', type: 'info', tag: '教育发展', title: '教育资源分配',
    desc: (s) => `教育局报告：${s.cityName}城乡教育资源差距明显，偏远地区学校师资匮乏。`,
    condition: (s) => s.turn > 8, weight: 4,
    choices: [
      { text: '推进教育均衡化（¥800万）', effects: { treasury: -800, happiness: 5, reputation: 6, merit: 3 }, color: 'green' },
      { text: '定向支教，控制成本（¥200万）', effects: { treasury: -200, happiness: 2, reputation: 1 }, color: 'blue' },
      { text: '维持现状', effects: { happiness: -3 }, color: 'yellow' },
    ] },
  { id: 'hospitalExpansion', type: 'info', tag: '医疗卫生', title: '医疗资源紧张',
    desc: (s) => `${s.cityName}人民医院反映床位严重不足，日均门诊量超负荷运转。`,
    condition: (s) => s.turn > 6 && s.population > 10000, weight: 4,
    choices: [
      { text: '扩建医院（¥1000万）', effects: { treasury: -1000, happiness: 5, reputation: 4 }, color: 'green' },
      { text: '增设社区诊所（¥300万）', effects: { treasury: -300, happiness: 2 }, color: 'blue' },
      { text: '暂缓扩建', effects: { happiness: -4 }, color: 'yellow' },
    ] },
  { id: 'envReport', type: 'warn', tag: '生态保护', title: '生态红线告急',
    desc: (s) => `环保督查组通报：${s.cityName}存在违规占用生态红线区域进行开发的问题。`,
    condition: (s) => s.turn > 12 && s.airQuality > 50, weight: 4,
    choices: [
      { text: '立即拆除违建，恢复生态（¥400万）', effects: { treasury: -400, happiness: 3, reputation: 5, airQuality: -10 }, color: 'green' },
      { text: '限期整改', effects: { reputation: -2, airQuality: -3 }, color: 'yellow' },
      { text: '找关系通融', effects: { corruption: 8, inspection: 10, airQuality: 3 }, color: 'red' },
    ] },
  { id: 'trafficAccident', type: 'danger', tag: '安全事故', title: '重大交通事故',
    desc: (s) => `${s.cityName}主干道发生多车连环追尾事故，造成多人受伤，交通严重拥堵。`,
    condition: (s) => s.turn > 5, weight: 5,
    choices: [
      { text: '全力救援，疏导交通', effects: { treasury: -100, happiness: 1, reputation: 2 }, color: 'green' },
      { text: '按常规流程处理', effects: { happiness: -2 }, color: 'yellow' },
    ] },
  { id: 'techInnovation', type: 'success', tag: '科技创新', title: '科技企业落户',
    desc: (s) => `一家知名科技企业有意将研发中心落户${s.cityName}，预计带来大量就业岗位。`,
    condition: (s) => s.turn > 8 && s.happiness > 50, weight: 3,
    choices: [
      { text: '给予税收优惠吸引落户（-¥300万）', effects: { treasury: -300, happiness: 4, reputation: 6, gdpMult: 1.02, merit: 5 }, color: 'green' },
      { text: '提供土地和政策支持（-¥500万）', effects: { treasury: -500, happiness: 3, reputation: 8, gdpMult: 1.03, merit: 3 }, color: 'blue' },
      { text: '按正常流程接洽', effects: { happiness: 1 }, color: 'yellow' },
    ] },
  { id: 'pensionGap', type: 'warn', tag: '财政压力', title: '社保资金缺口',
    desc: (s) => `财政局报告：${s.cityName}社保基金支出持续增长，预计下季度将出现资金缺口。`,
    condition: (s) => s.turn > 15 && s.treasury < 5000, weight: 3,
    choices: [
      { text: '财政补贴填补缺口（¥800万）', effects: { treasury: -800, happiness: 3, reputation: 2 }, color: 'green' },
      { text: '调整缴费比例', effects: { happiness: -4, reputation: -2 }, color: 'yellow' },
      { text: '暂缓处理', effects: { happiness: -6, reputation: -4 }, color: 'red' },
    ] },
  { id: 'culturalHeritage', type: 'info', tag: '文化建设', title: '文物保护与开发',
    desc: (s) => `${s.cityName}发现一处历史遗址，文旅部门建议保护性开发。`,
    condition: (s) => s.turn > 10, weight: 3,
    choices: [
      { text: '建设遗址公园（¥600万）', effects: { treasury: -600, happiness: 4, reputation: 5, merit: 3 }, color: 'green' },
      { text: '原址保护，暂不开发（¥100万）', effects: { treasury: -100, happiness: 1, reputation: 2 }, color: 'blue' },
      { text: '让商业开发让路', effects: { corruption: 5, happiness: -3, reputation: -4 }, color: 'red' },
    ] },
  { id: 'ruralRevival', type: 'info', tag: '乡村振兴', title: '乡村振兴计划',
    desc: (s) => `省里下发乡村振兴专项资金，${s.cityName}可申请配套项目。`,
    condition: (s) => s.turn > 12, weight: 4,
    choices: [
      { text: '配套资金全力申请（¥500万）', effects: { treasury: -500, happiness: 5, reputation: 4, gdpMult: 1.02, merit: 5 }, color: 'green' },
      { text: '小规模试点（¥200万）', effects: { treasury: -200, happiness: 2, reputation: 1 }, color: 'blue' },
      { text: '放弃申请', effects: { happiness: -2 }, color: 'yellow' },
    ] },
  { id: 'publicOpinion', type: 'warn', tag: '舆情事件', title: '网络舆情发酵',
    desc: (s) => `${s.cityName}一起民生事件在网络上引发热议，负面舆论持续发酵。`,
    condition: (s) => s.turn > 8, weight: 5,
    choices: [
      { text: '公开回应，迅速处置（¥150万）', effects: { treasury: -150, happiness: 2, reputation: 4 }, color: 'green' },
      { text: '删帖控评', effects: { happiness: -3, reputation: -5, inspection: 8 }, color: 'red' },
      { text: '不回应', effects: { happiness: -4, reputation: -6 }, color: 'yellow' },
    ] },
  { id: 'motherIllness', type: 'danger', tag: '个人事件', title: '母亲重病',
    desc: (s) => `老家来电：母亲突发脑溢血住院，需要紧急手术，预计医疗费用¥${formatMoney(15 * 10000)}。私人账户余额：¥${formatMoney(s.privateAccount * 10000)}。`,
    condition: (s) => s.turn > 15, weight: 2,
    choices: [
      { text: '倾尽所有救治母亲（-¥15万）', effects: { happiness: 3 }, color: 'green',
        customAction: () => { gameState.privateAccount = Math.max(0, gameState.privateAccount - 15); if (gameState.privateAccount < 15) { gameState.corruption = clamp(gameState.corruption + 5, 0, 100); } } },
      { text: '向开发商"借款"（腐败+10）', effects: { corruption: 10, inspection: 8, happiness: 1 }, color: 'red',
        customAction: () => { gameState.privateAccount += 15; gameState.privateTotalGained = (gameState.privateTotalGained || 0) + 15; } },
      { text: '放弃治疗', effects: { happiness: -15, reputation: -5 }, color: 'yellow' },
    ] },
  { id: 'childLuxury', type: 'warn', tag: '个人事件', title: '孩子想买豪车',
    desc: (s) => `孩子吵着要买一辆¥${formatMoney(8 * 10000)}的豪车，说同学都有。私人账户余额：¥${formatMoney(s.privateAccount * 10000)}。`,
    condition: (s) => s.turn > 20 && s.privateAccount > 3, weight: 3,
    choices: [
      { text: '满足孩子心愿（-¥8万）', effects: { happiness: 2 }, color: 'green',
        customAction: () => { if (gameState.privateAccount >= 8) { gameState.privateAccount -= 8; } else { showNotification('私人账户余额不足！', 'danger'); } } },
      { text: '找"朋友"赞助（腐败+8）', effects: { corruption: 8, inspection: 5 }, color: 'red',
        customAction: () => { gameState.privateAccount += 8; gameState.privateTotalGained = (gameState.privateTotalGained || 0) + 8; } },
      { text: '拒绝并教育孩子', effects: { happiness: -2, reputation: 2 }, color: 'blue' },
    ] },
  { id: 'spouseBusiness', type: 'warn', tag: '个人事件', title: '配偶创业请求',
    desc: (s) => `配偶提出想开办一家公司，需要启动资金¥${formatMoney(5 * 10000)}。但按规定，领导干部配偶不得经商办企业。`,
    condition: (s) => s.turn > 25, weight: 2,
    choices: [
      { text: '拒绝，遵守规定', effects: { reputation: 5, happiness: -3 }, color: 'green' },
      { text: '暗中支持（腐败+12）', effects: { corruption: 12, inspection: 10, happiness: 2 }, color: 'red',
        customAction: () => { gameState.privateAccount += 5; gameState.privateTotalGained = (gameState.privateTotalGained || 0) + 5; } },
      { text: '挂名亲友代持（腐败+6）', effects: { corruption: 6, inspection: 5 }, color: 'yellow' },
    ] },
  { id: 'gamblingDebt', type: 'danger', tag: '个人事件', title: '亲戚赌债',
    desc: (s) => `远房亲戚因赌博欠下¥${formatMoney(3 * 10000)}巨债，债主找上门来，希望你能帮忙。`,
    condition: (s) => s.turn > 30 && s.corruption > 10, weight: 2,
    choices: [
      { text: '帮忙还债（-¥3万）', effects: { happiness: 1 }, color: 'green',
        customAction: () => { if (gameState.privateAccount >= 3) { gameState.privateAccount -= 3; } else { showNotification('私人账户余额不足！', 'danger'); } } },
      { text: '动用公款帮还（腐败+15）', effects: { corruption: 15, inspection: 12, treasury: -100 }, color: 'red' },
      { text: '断绝关系不管', effects: { happiness: -5, reputation: -3 }, color: 'yellow' },
    ] },
  { id: 'oldFriend', type: 'corruption', tag: '个人事件', title: '老同学求助',
    desc: (s) => `多年未见的大学同学找上门来，希望你能帮他公司中标一个市政项目，承诺事后给你¥${formatMoney(5 * 10000)}"辛苦费"。`,
    condition: (s) => s.turn > 18, weight: 3,
    choices: [
      { text: '公事公办，拒绝请托', effects: { reputation: 5 }, color: 'green' },
      { text: '帮忙打声招呼（+¥5万私账，腐败+15）', effects: { corruption: 15, inspection: 8 }, color: 'red',
        customAction: () => { gameState.privateAccount += 5; gameState.privateTotalGained = (gameState.privateTotalGained || 0) + 5; } },
      { text: '含糊其辞，暂不表态', effects: { happiness: -1 }, color: 'yellow' },
    ] },
  // ---- 新增个人事件 v1.1.1.8 ----
  { id: 'childWedding', type: 'warn', tag: '个人事件', title: '子女婚事',
    desc: (s) => `孩子即将结婚，对方家庭条件不错，但婚礼花费预计¥${formatMoney(6 * 10000)}。私人账户余额：¥${formatMoney(s.privateAccount * 10000)}。`,
    condition: (s) => s.turn > 24 && s.privateAccount > 2, weight: 2,
    choices: [
      { text: '操办体面婚礼（-¥6万）', effects: { happiness: 4, reputation: 2 }, color: 'green',
        customAction: () => { if (gameState.privateAccount >= 6) { gameState.privateAccount -= 6; } else { showNotification('私人账户余额不足！', 'danger'); } } },
      { text: '收受礼金办婚礼（腐败+8）', effects: { corruption: 8, inspection: 6, happiness: 3 }, color: 'red',
        customAction: () => { gameState.privateAccount += 4; gameState.privateTotalGained = (gameState.privateTotalGained || 0) + 4; } },
      { text: '简办婚礼', effects: { happiness: -1, reputation: 1 }, color: 'blue' },
    ] },
  { id: 'houseRenovation', type: 'warn', tag: '个人事件', title: '房屋装修',
    desc: (s) => `自家房屋年久失修，需要装修。装修公司报价¥${formatMoney(4 * 10000)}。私人账户余额：¥${formatMoney(s.privateAccount * 10000)}。`,
    condition: (s) => s.turn > 12, weight: 2,
    choices: [
      { text: '自费装修（-¥4万）', effects: { happiness: 2 }, color: 'green',
        customAction: () => { if (gameState.privateAccount >= 4) { gameState.privateAccount -= 4; } else { showNotification('私人账户余额不足！', 'danger'); } } },
      { text: '让开发商"免费装修"（腐败+10）', effects: { corruption: 10, inspection: 7 }, color: 'red',
        customAction: () => { gameState.privateTotalGained = (gameState.privateTotalGained || 0) + 4; } },
      { text: '暂时不修', effects: { happiness: -1 }, color: 'yellow' },
    ] },
  { id: 'relativeJobEvent', type: 'corruption', tag: '个人事件', title: '亲属求职',
    desc: (s) => `小舅子大学毕业后一直找不到工作，岳母打电话让你帮忙安排个事业单位编制。`,
    condition: (s) => s.turn > 20, weight: 3,
    choices: [
      { text: '让他自己考公', effects: { happiness: -2, reputation: 3 }, color: 'green' },
      { text: '打招呼安排（腐败+12）', effects: { corruption: 12, inspection: 8, happiness: 2 }, color: 'red',
        customAction: () => { gameState.privateAccount += 2; gameState.privateTotalGained = (gameState.privateTotalGained || 0) + 2; } },
      { text: '推荐去企业上班', effects: { happiness: 1 }, color: 'blue' },
    ] },
  { id: 'medicalCheckup', type: 'warn', tag: '个人事件', title: '体检异常',
    desc: (s) => `年度体检发现血压偏高，医生建议住院调理一周，费用¥${formatMoney(2 * 10000)}。私人账户余额：¥${formatMoney(s.privateAccount * 10000)}。`,
    condition: (s) => s.turn > 30, weight: 2,
    choices: [
      { text: '自费住院调理（-¥2万）', effects: { happiness: 3 }, color: 'green',
        customAction: () => { if (gameState.privateAccount >= 2) { gameState.privateAccount -= 2; } else { showNotification('私人账户余额不足！', 'danger'); } } },
      { text: '用公费医疗（腐败+5）', effects: { corruption: 5, inspection: 4 }, color: 'red' },
      { text: '不管，继续工作', effects: { happiness: -3 }, color: 'yellow' },
    ] },
  { id: 'classmateReunion', type: 'corruption', tag: '个人事件', title: '同学聚会',
    desc: (s) => `老同学组织毕业周年聚会，aa制每人¥${formatMoney(5000)}。聚会上有人提议让大家合作投资一个项目，回报丰厚。`,
    condition: (s) => s.turn > 18 && s.privateAccount > 1, weight: 2,
    choices: [
      { text: '参加聚会，不投资（-¥0.5万）', effects: { happiness: 2, reputation: 1 }, color: 'green',
        customAction: () => { gameState.privateAccount = Math.max(0, gameState.privateAccount - 0.5); } },
      { text: '投资"项目"（腐败+8）', effects: { corruption: 8, inspection: 6 }, color: 'red',
        customAction: () => { gameState.privateAccount += 3; gameState.privateTotalGained = (gameState.privateTotalGained || 0) + 3; } },
      { text: '推辞不参加', effects: { happiness: -1 }, color: 'yellow' },
    ] },
  { id: 'childSchoolFee', type: 'warn', tag: '个人事件', title: '孩子择校费',
    desc: (s) => `孩子想转学到更好的学校，择校费和赞助费共需¥${formatMoney(3 * 10000)}。私人账户余额：¥${formatMoney(s.privateAccount * 10000)}。`,
    condition: (s) => s.turn > 10, weight: 2,
    choices: [
      { text: '自费择校（-¥3万）', effects: { happiness: 2 }, color: 'green',
        customAction: () => { if (gameState.privateAccount >= 3) { gameState.privateAccount -= 3; } else { showNotification('私人账户余额不足！', 'danger'); } } },
      { text: '找校长打招呼免赞助费（腐败+6）', effects: { corruption: 6, inspection: 4 }, color: 'red' },
      { text: '就近入学', effects: { happiness: -1 }, color: 'blue' },
    ] },
  { id: 'neighborDispute', type: 'warn', tag: '个人事件', title: '邻里纠纷',
    desc: (s) => `老家邻居因宅基地边界问题与你家发生纠纷，对方提出要¥${formatMoney(1 * 10000)}补偿才肯罢休。`,
    condition: (s) => s.turn > 14, weight: 2,
    choices: [
      { text: '花钱息事宁人（-¥1万）', effects: { happiness: 1 }, color: 'green',
        customAction: () => { if (gameState.privateAccount >= 1) { gameState.privateAccount -= 1; } else { showNotification('私人账户余额不足！', 'danger'); } } },
      { text: '动用关系施压（腐败+8）', effects: { corruption: 8, inspection: 6, reputation: -3 }, color: 'red' },
      { text: '走法律程序', effects: { happiness: -2, reputation: 1 }, color: 'blue' },
    ] },
  // ---- 干部落马事件 v1.2.0.0 ----
  { id: 'officialInvestigated', type: 'danger', tag: '人事事件', title: '下属干部被纪委调查',
    desc: (s) => {
      const off = s._eventOfficial;
      const b = s._eventBureau;
      return `${b ? b.name : '下属'}局长${off ? off.name : '某干部'}因涉嫌严重违纪违法，被纪委立案调查。据传涉及金额较大，上级要求你配合调查。`;
    },
    condition: (s) => {
      if (!s.personnel || s.cityLevelId < 1) return false;
      if (s.turn < 20) return false;
      // Only trigger if there's an appointed official with high corruption tendency
      const ps = s.personnel;
      for (const bId of Object.keys(ps.appointments)) {
        const off = ps.officials.find(o => o.id === ps.appointments[bId]);
        if (off && off.corruptionTendency >= 4) return true;
      }
      return false;
    },
    weight: 3,
    customAction: () => {
      // Pick the most corrupt appointed official
      const ps = gameState.personnel;
      let worstOff = null, worstBureau = null, worstKey = null;
      for (const bId of Object.keys(ps.appointments)) {
        const off = ps.officials.find(o => o.id === ps.appointments[bId]);
        const b = BUREAUS.find(x => x.id === bId);
        if (off && (!worstOff || off.corruptionTendency > worstOff.corruptionTendency)) {
          worstOff = off; worstBureau = b; worstKey = bId;
        }
      }
      gameState._eventOfficial = worstOff;
      gameState._eventBureau = worstBureau;
      gameState._eventBureauKey = worstKey;
    },
    choices: [
      { text: '积极配合调查，主动免职', effects: { reputation: 8, happiness: -2 }, color: 'green',
        customAction: () => {
          const ps = gameState.personnel;
          const off = gameState._eventOfficial;
          const b = gameState._eventBureau;
          if (off && b && ps.appointments[b.id]) { delete ps.appointments[b.id]; }
          if (off) ps.officials = ps.officials.filter(o => o.id !== off.id);
          showNotification(`${off ? off.name : '干部'}已被免职并移送纪委`, 'info');
          logEvent(`干部落马：${off ? off.name : '干部'}（${b ? b.name : ''}局长）被纪委调查免职`, 'danger');
        } },
      { text: '出面保人，拖延调查', effects: { corruption: 12, inspection: 15, reputation: -10, happiness: 1 }, color: 'red',
        customAction: () => {
          const off = gameState._eventOfficial;
          logEvent(`包庇下属：${off ? off.name : '干部'}被调查，你出面拖延`, 'warn');
        } },
      { text: '装作不知情', effects: { corruption: 5, inspection: 8, reputation: -5 }, color: 'yellow',
        customAction: () => {
          // 50% chance the official gets taken down anyway
          if (Math.random() < 0.5) {
            const ps = gameState.personnel;
            const off = gameState._eventOfficial;
            const b = gameState._eventBureau;
            if (off && b && ps.appointments[b.id]) { delete ps.appointments[b.id]; }
            if (off) ps.officials = ps.officials.filter(o => o.id !== off.id);
            showNotification(`${off ? off.name : '干部'}被纪委直接带走调查`, 'danger');
            logEvent(`干部落马：${off ? off.name : '干部'}被纪委直接带走`, 'danger');
          }
        } },
    ] },
  { id: 'officialScandal', type: 'warn', tag: '人事事件', title: '下属干部生活作风问题',
    desc: (s) => {
      const off = s._eventOfficial;
      const b = s._eventBureau;
      return `${b ? b.name : '下属'}局长${off ? off.name : '某干部'}被举报生活作风问题，有人在网络发帖曝光其出入高档场所、包养情妇。舆情持续发酵。`;
    },
    condition: (s) => {
      if (!s.personnel || s.cityLevelId < 1) return false;
      if (s.turn < 15) return false;
      const ps = s.personnel;
      for (const bId of Object.keys(ps.appointments)) {
        const off = ps.officials.find(o => o.id === ps.appointments[bId]);
        if (off) return true;
      }
      return false;
    },
    weight: 2,
    customAction: () => {
      const ps = gameState.personnel;
      let pickOff = null, pickBureau = null;
      const keys = Object.keys(ps.appointments);
      if (keys.length > 0) {
        const k = keys[Math.floor(Math.random() * keys.length)];
        pickOff = ps.officials.find(o => o.id === ps.appointments[k]);
        pickBureau = BUREAUS.find(x => x.id === k);
      }
      gameState._eventOfficial = pickOff;
      gameState._eventBureau = pickBureau;
    },
    choices: [
      { text: '立即免职，严肃处理', effects: { reputation: 5, happiness: 2 }, color: 'green',
        customAction: () => {
          const ps = gameState.personnel;
          const off = gameState._eventOfficial;
          const b = gameState._eventBureau;
          if (off && b && ps.appointments[b.id]) { delete ps.appointments[b.id]; }
          if (off) ps.officials = ps.officials.filter(o => o.id !== off.id);
          logEvent(`严肃处理：免去${off ? off.name : '干部'}职务`, 'info');
        } },
      { text: '内部警告，留任观察', effects: { corruption: 3, inspection: 4, happiness: -1 }, color: 'yellow',
        customAction: () => {
          const off = gameState._eventOfficial;
          if (off) off.loyalty = Math.max(1, off.loyalty - 1);
        } },
      { text: '帮忙删帖压舆论', effects: { corruption: 8, inspection: 10, reputation: -3 }, color: 'red' },
    ] },
  { id: 'officialBetrayal', type: 'danger', tag: '人事事件', title: '下属反水举报',
    desc: (s) => {
      const off = s._eventOfficial;
      return `${off ? off.name : '下属干部'}因不满你的某些决定，愤而向上级纪委实名举报你。举报信中提及多项问题，上级已收到并转交调查组。`;
    },
    condition: (s) => {
      if (!s.personnel || s.cityLevelId < 1) return false;
      if (s.turn < 30 || s.corruption < 15) return false;
      const ps = s.personnel;
      for (const bId of Object.keys(ps.appointments)) {
        const off = ps.officials.find(o => o.id === ps.appointments[bId]);
        if (off && off.loyalty <= 3) return true;
      }
      return false;
    },
    weight: 2,
    customAction: () => {
      const ps = gameState.personnel;
      let worstOff = null;
      for (const bId of Object.keys(ps.appointments)) {
        const off = ps.officials.find(o => o.id === ps.appointments[bId]);
        if (off && off.loyalty <= 3 && (!worstOff || off.loyalty < worstOff.loyalty)) worstOff = off;
      }
      gameState._eventOfficial = worstOff;
    },
    choices: [
      { text: '主动交代问题', effects: { corruption: -10, reputation: -5, happiness: -5 }, color: 'green',
        customAction: () => {
          const off = gameState._eventOfficial;
          const ps = gameState.personnel;
          if (off) {
            for (const bId of Object.keys(ps.appointments)) {
              if (ps.appointments[bId] === off.id) { delete ps.appointments[bId]; break; }
            }
            ps.officials = ps.officials.filter(o => o.id !== off.id);
          }
          logEvent(`下属反水：${off ? off.name : '干部'}举报，你主动交代问题`, 'danger');
        } },
      { text: '坚决否认，反告诬陷', effects: { corruption: 5, inspection: 20, reputation: -8 }, color: 'red',
        customAction: () => {
          const off = gameState._eventOfficial;
          if (off) off.loyalty = 1;
        } },
      { text: '找人从中斡旋（-¥3万）', effects: { corruption: 6, inspection: 10, happiness: 1 }, color: 'yellow',
        customAction: () => {
          if (gameState.privateAccount >= 3) { gameState.privateAccount -= 3; }
          const off = gameState._eventOfficial;
          const ps = gameState.personnel;
          if (off) {
            for (const bId of Object.keys(ps.appointments)) {
              if (ps.appointments[bId] === off.id) { delete ps.appointments[bId]; break; }
            }
            ps.officials = ps.officials.filter(o => o.id !== off.id);
          }
        } },
    ] },
  // v2.4.1a: 纪委书记包庇事件
  {
    id: 'disciplineCoverUp', type: 'danger', tag: '人事事件', title: '纪委书记涉嫌包庇',
    desc: (s) => {
      if (!s.committee) return '';
      const discHead = s.committee.find(m => m.role === 'discipline' && !m.isVacant);
      if (!discHead) return '';
      return `据群众反映，纪委书记${discHead.name}在调查某干部违纪问题时存在包庇行为，疑似因同派系关系而从轻处理。此事引发干部群众议论纷纷。`;
    },
    condition: (s) => {
      if (!s.committee || !s.personnel) return false;
      const discHead = s.committee.find(m => m.role === 'discipline' && !m.isVacant && !m.isPlayer);
      if (!discHead) return false;
      // 纪委书记腐败倾向高，且有同派系的被调查干部
      if ((discHead.corruptionTendency || 1) < 3) return false;
      const ps = s.personnel;
      for (const bId of Object.keys(ps.appointments)) {
        const off = ps.officials.find(o => o.id === ps.appointments[bId]);
        if (off && off.faction === discHead.faction && (off.corruptionTendency || 1) >= 3) return true;
      }
      return false;
    },
    weight: 8,
    customAction: (s) => {
      const discHead = s.committee.find(m => m.role === 'discipline' && !m.isVacant && !m.isPlayer);
      if (!discHead) return;
      const ps = s.personnel;
      // 找到同派系的高腐败干部
      const targets = [];
      for (const bId of Object.keys(ps.appointments)) {
        const off = ps.officials.find(o => o.id === ps.appointments[bId]);
        if (off && off.faction === discHead.faction && (off.corruptionTendency || 1) >= 3) {
          targets.push(off);
        }
      }
      if (targets.length > 0) s._coverUpTarget = targets[0];
    },
    choices: [
      { text: '责令纪委书记如实调查', effects: { reputation: 5, merit: 3 }, color: 'green',
        customAction: (s) => {
          const discHead = s.committee.find(m => m.role === 'discipline' && !m.isVacant && !m.isPlayer);
          if (discHead) {
            discHead.loyalty = Math.max(1, (discHead.loyalty || 5) - 3);
            s.committeeUnity = Math.min(100, (s.committeeUnity || 50) - 5);
          }
          // 正常调查被包庇干部
          const target = s._coverUpTarget;
          if (target && s.personnel) {
            for (const bId of Object.keys(s.personnel.appointments)) {
              if (s.personnel.appointments[bId] === target.id) { delete s.personnel.appointments[bId]; break; }
            }
            s.personnel.officials = s.personnel.officials.filter(o => o.id !== target.id);
            logEvent(`责令纪委如实调查，查实${target.name}违纪问题并免职`, 'success');
          }
          delete s._coverUpTarget;
        } },
      { text: '睁一只眼闭一只眼', effects: { corruption: 5, inspection: 8, reputation: -3 }, color: 'yellow' },
      { text: '配合纪委书记压下此事', effects: { corruption: 10, inspection: 15, reputation: -8 }, color: 'red',
        customAction: (s) => {
          const discHead = s.committee.find(m => m.role === 'discipline' && !m.isVacant && !m.isPlayer);
          if (discHead) {
            discHead.loyalty = Math.min(10, (discHead.loyalty || 5) + 2);
            discHead._isSpy = true;
          }
          s.committeeUnity = Math.min(100, (s.committeeUnity || 50) + 3);
          s._coverUpCommitted = true; // v2.4.1b: 标记已包庇，提级巡视时可能败露
          logEvent('与纪委书记达成默契，包庇同派系干部', 'corruption');
          delete s._coverUpTarget;
        } },
    ],
  },
  // v2.4.1b: 常委矛盾事件
  {
    id: 'committeeConflict', type: 'danger', tag: '人事事件', title: '常委矛盾',
    desc: (s) => {
      if (!s.committee) return '';
      const nonPlayer = s.committee.filter(m => !m.isPlayer && !m.isVacant);
      if (nonPlayer.length < 2) return '';
      const a = nonPlayer[0];
      const b = nonPlayer[1];
      return `${a.roleName}${a.name}与${b.roleName}${b.name}在工作思路上产生分歧，常委会内部气氛紧张。如何处理这一矛盾将影响班子团结。`;
    },
    condition: (s) => s.committee && s.committee.filter(m => !m.isPlayer && !m.isVacant).length >= 2 && (s.committeeUnity || 50) < 60,
    weight: 10,
    choices: [
      { text: '召开书记办公会调解', effects: { merit: 1 }, color: 'green',
        msg: '你主持调解，双方握手言和，班子团结度回升',
        customAction: (s) => { s.committeeUnity = Math.min(100, (s.committeeUnity || 50) + 8); } },
      { text: '各打五十大板', effects: {}, color: 'yellow',
        msg: '双方各受批评，但心有不甘',
        customAction: (s) => {
          s.committeeUnity = Math.min(100, (s.committeeUnity || 50) + 3);
          for (const m of s.committee) { if (!m.isPlayer && !m.isVacant) m.loyalty = Math.max(1, (m.loyalty || 5) - 1); }
        } },
      { text: '不予理会', effects: { reputation: -2 }, color: 'red',
        msg: '矛盾持续发酵，班子团结度下降',
        customAction: (s) => { s.committeeUnity = Math.max(0, (s.committeeUnity || 50) - 8); } },
    ],
  },
  // v2.4.1b: 组织部长推荐干部事件
  {
    id: 'orgHeadRecommend', type: 'info', tag: '人事事件', title: '组织部长推荐干部',
    desc: (s) => {
      if (!s.committee || !s.personnel) return '';
      const orgHead = s.committee.find(m => m.role === 'organization' && !m.isVacant && !m.isPlayer);
      if (!orgHead) return '';
      const factionless = s.personnel.officials.filter(o => !o.faction && !Object.values(s.personnel.appointments).includes(o.id));
      if (factionless.length === 0) return '';
      return `组织部长${orgHead.name}向你推荐一名干部，认为该同志政治素质过硬、工作能力突出，建议纳入重点培养对象。`;
    },
    condition: (s) => {
      if (!s.committee || !s.personnel) return false;
      const orgHead = s.committee.find(m => m.role === 'organization' && !m.isVacant && !m.isPlayer);
      if (!orgHead) return false;
      const factionless = s.personnel.officials.filter(o => !o.faction && !Object.values(s.personnel.appointments).includes(o.id));
      return factionless.length > 0;
    },
    weight: 6,
    choices: [
      { text: '采纳建议，重点培养', effects: { merit: 2 }, color: 'green',
        msg: '该同志被纳入重点培养名单，能力得到提升',
        customAction: (s) => {
          const factionless = s.personnel.officials.filter(o => !o.faction && !Object.values(s.personnel.appointments).includes(o.id));
          if (factionless.length > 0) {
            const target = factionless[Math.floor(Math.random() * factionless.length)];
            target.competence = Math.min(7, (target.competence || 4) + 1);
            target.loyalty = Math.min(10, (target.loyalty || 3) + 1);
            s.committeeUnity = Math.min(100, (s.committeeUnity || 50) + 3);
            logEvent(`组织部长推荐${target.name}，纳入重点培养`, 'info');
          }
        } },
      { text: '暂不考虑', effects: {}, color: 'gray',
        msg: '你谢绝了建议，组织部长有些失望',
        customAction: (s) => {
          const orgHead = s.committee.find(m => m.role === 'organization' && !m.isVacant && !m.isPlayer);
          if (orgHead) orgHead.loyalty = Math.max(1, (orgHead.loyalty || 5) - 1);
        } },
    ],
  },
  // v2.4.1b: 行政主官汇报经济工作
  {
    id: 'mayorReport', type: 'info', tag: '经济事件', title: '行政主官汇报经济工作',
    desc: (s) => {
      if (!s.committee) return '';
      const mayor = s.committee.find(m => m.role === 'mayor' && !m.isVacant && !m.isPlayer);
      if (!mayor) return '';
      return `${mayor.roleName}${mayor.name}就当前经济形势进行专题汇报，分析了财政收支、产业发展和项目建设情况，并提出了下阶段工作建议。`;
    },
    condition: (s) => s.committee && s.committee.find(m => m.role === 'mayor' && !m.isVacant && !m.isPlayer) !== undefined,
    weight: 7,
    choices: [
      { text: '肯定工作，要求抓好落实', effects: { merit: 1 }, color: 'green',
        msg: '行政主官受到鼓舞，工作积极性提升',
        customAction: (s) => {
          const mayor = s.committee.find(m => m.role === 'mayor' && !m.isVacant && !m.isPlayer);
          if (mayor) {
            mayor.loyalty = Math.min(10, (mayor.loyalty || 5) + 1);
            s.committeeUnity = Math.min(100, (s.committeeUnity || 50) + 2);
          }
        } },
      { text: '提出批评意见', effects: { reputation: -1 }, color: 'yellow',
        msg: '行政主官面露难色，但表示接受批评',
        customAction: (s) => {
          const mayor = s.committee.find(m => m.role === 'mayor' && !m.isVacant && !m.isPlayer);
          if (mayor) mayor.loyalty = Math.max(1, (mayor.loyalty || 5) - 2);
          s.committeeUnity = Math.max(0, (s.committeeUnity || 50) - 3);
        } },
      { text: '听取汇报即可', effects: {}, color: 'gray', msg: '汇报按程序进行' },
    ],
  },
// ====== v2.4.3: 探矿事件 — 可探明新矿产资源 ======
  {
    id: 'prospecting',
    type: 'info',
    tag: '资源勘探',
    title: '矿产资源勘探',
    desc: (s) => {
      const zones = s.mineralZones || [];
      const zoneNames = zones.length > 0 ? zones.map(z => z.name).join('、') : '暂无';
      return `地质勘探队在城区周边发现了多处疑似矿脉异常信号。组织一次系统勘探可能发现新的矿产资源，但也有可能空手而归。\n\n现有矿区：${zoneNames}（共${zones.length}处）`;
    },
    condition: (s) => s.isResourceCity && (s.mineralZones || []).length < 6 && !s._prospectingCooldown,
    weight: 40,
    choices: [
      {
        text: '投入¥200万组织勘探（成功率60%）',
        color: 'blue',
        effects: {},
        customAction: (s) => {
          if (s.treasury < 200) {
            showNotification('财政资金不足，无法组织勘探', 'warn');
            return;
          }
          s.treasury -= 200;
          s._prospectingCooldown = true;
          // 成功发现新矿
          if (Math.random() < 0.60) {
            const MINERAL_TYPES = [
              { type: 'coal', name: '煤炭', weight: 30 },
              { type: 'iron', name: '铁矿', weight: 25 },
              { type: 'copper', name: '铜矿', weight: 18 },
              { type: 'limestone', name: '石灰石', weight: 15 },
              { type: 'gold', name: '金矿', weight: 7 },
              { type: 'rare_earth', name: '稀土', weight: 5 },
            ];
            const total = MINERAL_TYPES.reduce((sum, m) => sum + m.weight, 0);
            let r = Math.random() * total;
            let picked = MINERAL_TYPES[0];
            for (const m of MINERAL_TYPES) { r -= m.weight; if (r <= 0) { picked = m; break; } }
            // 在现有矿区附近或新位置添加产量
            if (s.mineralZones && s.mineralZones.length > 0) {
              // 在现有矿区增加新矿脉
              const targetZone = s.mineralZones[Math.floor(Math.random() * s.mineralZones.length)];
              const boost = 20 + Math.floor(Math.random() * 30);
              targetZone.production = Math.min(targetZone.maxProduction, targetZone.production + boost);
              if (targetZone.depleted) {
                targetZone.depleted = false;
                targetZone.production = boost;
              }
              showNotification(`勘探成功！${targetZone.name}发现新${picked.name}矿脉，产量+${boost}`, 'success');
              logEvent(`地质勘探在${targetZone.name}发现新${picked.name}矿脉，预估新增产量${boost}%`, 'success');
            } else {
              showNotification('勘探未发现可开采矿区', 'warn');
              logEvent('地质勘探未发现可开采矿产资源', 'warn');
            }
          } else {
            showNotification('勘探未发现可开采矿产资源', 'warn');
            logEvent('地质勘探未发现有价值矿产资源', 'warn');
          }
        },
      },
      {
        text: '投入¥500万深度勘探（成功率85%，可能发现稀有矿）',
        color: 'green',
        effects: {},
        customAction: (s) => {
          if (s.treasury < 500) {
            showNotification('财政资金不足，无法组织深度勘探', 'warn');
            return;
          }
          s.treasury -= 500;
          s._prospectingCooldown = true;
          if (Math.random() < 0.85) {
            // 深度勘探有更高概率发现稀有矿
            const MINERAL_TYPES = [
              { type: 'coal', name: '煤炭', weight: 20 },
              { type: 'iron', name: '铁矿', weight: 20 },
              { type: 'copper', name: '铜矿', weight: 15 },
              { type: 'limestone', name: '石灰石', weight: 12 },
              { type: 'gold', name: '金矿', weight: 18 },
              { type: 'rare_earth', name: '稀土', weight: 15 },
            ];
            const total = MINERAL_TYPES.reduce((sum, m) => sum + m.weight, 0);
            let r = Math.random() * total;
            let picked = MINERAL_TYPES[0];
            for (const m of MINERAL_TYPES) { r -= m.weight; if (r <= 0) { picked = m; break; } }
            const boost = 30 + Math.floor(Math.random() * 40);
            if (s.mineralZones && s.mineralZones.length > 0) {
              const targetZone = s.mineralZones[Math.floor(Math.random() * s.mineralZones.length)];
              targetZone.production = Math.min(targetZone.maxProduction, targetZone.production + boost);
              if (targetZone.depleted) {
                targetZone.depleted = false;
                targetZone.production = boost;
              }
              showNotification(`深度勘探成功！${targetZone.name}发现大型${picked.name}矿脉，产量+${boost}`, 'success');
              logEvent(`深度勘探在${targetZone.name}发现大型${picked.name}矿脉，预估新增产量${boost}%`, 'success');
            } else {
              showNotification('深度勘探未发现可开采矿区', 'warn');
              logEvent('深度勘探未发现有价值矿产资源', 'warn');
            }
          } else {
            showNotification('深度勘探未发现可开采矿产资源', 'warn');
            logEvent('深度勘探未发现有价值矿产资源', 'warn');
          }
        },
      },
      {
        text: '暂不勘探',
        color: 'gray',
        effects: {},
        customAction: (s) => {
          s._prospectingCooldown = true;
          showNotification('暂不进行矿产勘探', 'info');
        },
      },
    ],
  },
  // ====== v2.4.3b: 矿难事件 ======
  {
    id: 'mineDisaster',
    type: 'danger',
    tag: '矿难事故',
    title: '矿区发生安全事故',
    desc: (s) => {
      const zones = s.mineralZones || [];
      const zone = zones.length > 0 ? zones[Math.floor(Math.random() * zones.length)] : null;
      const zoneName = zone ? zone.name : '某矿区';
      return `${zoneName}发生井下安全事故，初步统计有矿工被困。事故原因疑为违规开采导致巷道坍塌。救援队已赶赴现场，但事故可能引发舆论关注和上级追责。\n\n注意：此类事故将降低幸福度和声誉，并增加纪委风险。`;
    },
    condition: (s) => s.isResourceCity && (s.mineralZones || []).some(z => !z.depleted && z.production > 20),
    weight: 25,
    choices: [
      {
        text: '全力救援，追责矿企（¥300万救援费）',
        color: 'green',
        effects: { happiness: -8, reputation: -5 },
        customAction: (s) => {
          if (s.treasury >= 300) {
            s.treasury -= 300;
            s.happiness = clamp((s.happiness || 50) + 3, 0, 100);
            s.reputation = clamp((s.reputation || 50) + 3, 0, 100);
            showNotification('全力救援获群众认可，幸福度和声誉回升', 'success');
            logEvent('矿区安全事故全力救援，矿企被追责罚款', 'warn');
          } else {
            showNotification('财政不足，只能组织有限救援', 'warn');
            logEvent('矿区安全事故因财政不足救援不力', 'danger');
          }
        },
      },
      {
        text: '隐瞒不报，私下处理',
        color: 'red',
        effects: { corruption: 15, inspectionRisk: 20, happiness: -3 },
        customAction: (s) => {
          showNotification('事故被隐瞒，但纪委风险大幅上升', 'warn');
          logEvent('矿区安全事故被隐瞒不报，私下处理', 'danger');
        },
      },
      {
        text: '仅做赔偿，淡化处理',
        color: 'gray',
        effects: { happiness: -12, reputation: -8, treasury: -150 },
        customAction: (s) => {
          showNotification('赔偿了事，但舆论不满', 'warn');
          logEvent('矿区安全事故仅做赔偿，舆论不满', 'warn');
        },
      },
    ],
  },
  // ====== v2.4.3b: 环保抗议事件 ======
  {
    id: 'mineEnvProtest',
    type: 'warn',
    tag: '环保抗议',
    title: '矿区污染引发群众抗议',
    desc: (s) => {
      const zones = s.mineralZones || [];
      const zone = zones.length > 0 ? zones[Math.floor(Math.random() * zones.length)] : null;
      const zoneName = zone ? zone.name : '某矿区';
      return `${zoneName}周边村民集体到市政府上访，反映矿区开采导致地下水污染、扬尘严重，农作物减产。村民要求关停矿区或提供生态补偿。\n\n处理不当可能导致群体性事件，影响社会稳定。`;
    },
    condition: (s) => s.isResourceCity && (s.mineralZones || []).some(z => !z.depleted) && (s.airQuality || 35) > 100,
    weight: 30,
    choices: [
      {
        text: '投入生态补偿（¥400万）',
        color: 'green',
        effects: {},
        customAction: (s) => {
          if (s.treasury >= 400) {
            s.treasury -= 400;
            s.airQuality = clamp((s.airQuality || 50) + 15, 0, 200);
            s.happiness = clamp((s.happiness || 50) + 5, 0, 100);
            s.reputation = clamp((s.reputation || 50) + 3, 0, 100);
            showNotification('生态补偿到位，抗议平息，空气质量改善', 'success');
            logEvent('投入生态补偿解决矿区污染抗议，群众满意', 'success');
          } else {
            showNotification('财政不足，抗议持续发酵', 'warn');
            logEvent('因财政不足无法满足生态补偿要求，抗议持续', 'warn');
          }
        },
      },
      {
        text: '限制开采，责令整改',
        color: 'blue',
        effects: { happiness: 3, reputation: 2 },
        customAction: (s) => {
          const zones = s.mineralZones || [];
          for (const mz of zones) {
            if (!mz.depleted) mz.production = Math.max(10, mz.production - 15);
          }
          s.airQuality = clamp((s.airQuality || 50) + 8, 0, 200);
          showNotification('限制开采后污染有所缓解，但矿业产值下降', 'info');
          logEvent('限制矿区开采，责令企业整改，污染有所缓解', 'warn');
        },
      },
      {
        text: '强行驱散，不予理会',
        color: 'red',
        effects: { happiness: -15, reputation: -10, inspectionRisk: 10 },
        customAction: (s) => {
          showNotification('强行驱散引发更大不满，纪委风险上升', 'danger');
          logEvent('强行驱散矿区污染抗议群众，引发更大不满', 'danger');
        },
      },
    ],
  },
  // ====== v2.4.3b: 矿产繁荣事件 ======
  {
    id: 'miningBoom',
    type: 'info',
    tag: '矿业繁荣',
    title: '国际矿产品价格上涨',
    desc: (s) => {
      const zones = s.mineralZones || [];
      const zoneNames = zones.length > 0 ? zones.map(z => z.name).join('、') : '本辖区矿区';
      return `受国际大宗商品价格波动影响，矿产品价格大幅上涨。${zoneNames}的采矿企业利润激增，预计可带来额外财政收入。\n\n可选择加大开采获取暴利（加速枯竭），或保持稳定生产。`;
    },
    condition: (s) => s.isResourceCity && (s.mineralZones || []).some(z => !z.depleted && z.production > 40),
    weight: 20,
    choices: [
      {
        text: '加大开采，获取暴利（产值+50%，衰减加速）',
        color: 'orange',
        effects: { treasury: 500, happiness: -3 },
        customAction: (s) => {
          const zones = s.mineralZones || [];
          for (const mz of zones) {
            if (!mz.depleted) mz.production = Math.max(5, mz.production - 20);
          }
          showNotification('矿产品价格上涨，采矿暴利¥500万，但资源加速消耗', 'success');
          logEvent('国际矿产品价格上涨，加大开采获取暴利500万', 'success');
        },
      },
      {
        text: '保持稳定生产，额外增收¥200万',
        color: 'blue',
        effects: { treasury: 200 },
        customAction: (s) => {
          showNotification('保持稳定生产，增收¥200万', 'success');
          logEvent('国际矿产品价格上涨，保持稳定生产增收200万', 'success');
        },
      },
      {
        text: '趁势储备，减少开采',
        color: 'green',
        effects: { happiness: 2, reputation: 3 },
        customAction: (s) => {
          const zones = s.mineralZones || [];
          for (const mz of zones) {
            if (!mz.depleted) mz.production = Math.min(mz.maxProduction, mz.production + 5);
          }
          showNotification('减少开采储备资源，矿区寿命延长', 'info');
          logEvent('趁矿价上涨减少开采，储备资源延长矿区寿命', 'success');
        },
      },
    ],
  },
  // ====== v2.4.3: 资源枯竭型城市 — 产业转型规划事件 ======
  {
    id: 'transformationPlan',
    type: 'danger',
    tag: '产业转型',
    title: '产业转型规划',
    desc: (s) => {
      const zones = s.mineralZones || [];
      const avgProd = zones.length > 0 ? Math.round(zones.reduce((a, m) => a + m.production, 0) / zones.length) : 0;
      const depPct = s.resourceDependency || 0;
      return `${s.cityName}矿产资源产量已降至${avgProd}%，资源依赖度${depPct}%。城市正式进入资源枯竭阶段，产业结构单一、就业岗位锐减、财政收入大幅缩减。\n\n上级要求立即启动产业转型规划，通过连续投入财政资金培育替代产业。请选择转型方向：`;
    },
    condition: (s) => s.resourceDepleted && !s.transformationProject && !s._transformationEventShown,
    weight: 100,
    choices: [
      {
        text: '文旅转型（投入大、周期长、回报高）',
        color: 'green',
        effects: { happiness: -2 },
        customAction: (s) => {
          const monthlyCost = Math.max(50, Math.round((s.monthlyExpenditure || 200) * 0.15));
          s.transformationProject = {
            type: 'tourism',
            monthsRequired: 24 + Math.floor(Math.random() * 13),
            monthsCompleted: 0,
            monthlyCost: monthlyCost,
            totalInvested: 0,
            completed: false,
          };
          s._noTransformWarningMonths = 0;
          s._transformationEventShown = true;
          showNotification(`文旅产业转型规划启动，需连续投入${s.transformationProject.monthsRequired}个月，月均¥${formatMoney(monthlyCost * 10000)}`, 'info');
        },
      },
      {
        text: '物流转型（投入小、周期短、见效快）',
        color: 'blue',
        effects: {},
        customAction: (s) => {
          const monthlyCost = Math.max(30, Math.round((s.monthlyExpenditure || 200) * 0.10));
          s.transformationProject = {
            type: 'logistics',
            monthsRequired: 12 + Math.floor(Math.random() * 13),
            monthsCompleted: 0,
            monthlyCost: monthlyCost,
            totalInvested: 0,
            completed: false,
          };
          s._noTransformWarningMonths = 0;
          s._transformationEventShown = true;
          showNotification(`物流产业转型规划启动，需连续投入${s.transformationProject.monthsRequired}个月，月均¥${formatMoney(monthlyCost * 10000)}`, 'info');
        },
      },
      {
        text: '暂不转型（后果自负）',
        color: 'red',
        effects: { happiness: -5, reputation: -10 },
        customAction: (s) => {
          s._transformationEventShown = true;
          showNotification('推迟产业转型将导致班子问责、提级巡视等严重后果', 'warn');
        },
      },
    ],
    postEffect: (s, choiceIdx) => {
      if (choiceIdx === 2) {
        return { title: '转型推迟', msg: '推迟产业转型将导致上级问责和贫困锁定等严重后果，请尽快启动转型规划。', effects: {} };
      }
      return null;
    },
  },
  // ====== v2.4.3: 资源枯竭型城市 — 套现跑路事件 ======
  {
    id: 'resourceCashOut',
    type: 'warn',
    tag: '权力运作',
    title: '资源枯竭期的套现机会',
    desc: (s) => {
      const miningEnts = (s.enterprises || []).filter(e => e.subType === 'mining' && e.ownership === 'stateOwned');
      const totalValue = miningEnts.reduce((sum, e) => sum + (e.capital || 0), 0);
      return `资源枯竭期间，多家采矿国企面临停产困境。部分商人提出以低价收购矿区资产，您可以通过"权力运作"推动"企业改制"，将国有资产转为私有并从中套现。\n\n当前辖区内${miningEnts.length}家采矿国企，账面资产合计约¥${formatMoney(totalValue * 10000)}。\n\n注意：此操作属于严重腐败行为，将大幅增加纪委风险。`;
    },
    condition: (s) => s.resourceDepleted && !s._cashOutUsed && (s.enterprises || []).some(e => e.subType === 'mining' && e.ownership === 'stateOwned'),
    weight: 30,
    choices: [
      {
        text: '权力运作：低价转让采矿权（套现¥800万）',
        color: 'red',
        effects: { corruption: 20, inspectionRisk: 15, reputation: -10 },
        customAction: (s) => {
          const gain = 800;
          if (!s.privateAssets) s.privateAssets = { stocks: [], land: [], projects: [], villas: [], totalGained: 0, totalLost: 0 };
          s.privateAssets.totalGained = (s.privateAssets.totalGained || 0) + gain;
          s.privateTotalGained = (s.privateTotalGained || 0) + gain;
          const miningEnts = (s.enterprises || []).filter(e => e.subType === 'mining' && e.ownership === 'stateOwned');
          if (miningEnts.length > 0) {
            const target = miningEnts[0];
            target.ownership = 'private';
            target.acquired = true;
          }
          s._cashOutUsed = true;
          showNotification(`通过权力运作套现¥${formatMoney(gain * 10000)}，但腐败和纪委风险大幅上升`, 'warn');
          logEvent('利用资源枯竭期进行权力运作套现，将采矿国企低价转让', 'danger');
        },
      },
      {
        text: '企业改制：整体打包出售（套现¥1500万，风险极高）',
        color: 'red',
        effects: { corruption: 35, inspectionRisk: 25, reputation: -15 },
        customAction: (s) => {
          const gain = 1500;
          if (!s.privateAssets) s.privateAssets = { stocks: [], land: [], projects: [], villas: [], totalGained: 0, totalLost: 0 };
          s.privateAssets.totalGained = (s.privateAssets.totalGained || 0) + gain;
          s.privateTotalGained = (s.privateTotalGained || 0) + gain;
          let converted = 0;
          for (const ent of (s.enterprises || [])) {
            if (ent.subType === 'mining' && ent.ownership === 'stateOwned') {
              ent.ownership = 'private';
              ent.acquired = true;
              converted++;
            }
          }
          s._cashOutUsed = true;
          showNotification(`通过企业改制套现¥${formatMoney(gain * 10000)}，${converted}家国企被低价转让`, 'danger');
          logEvent('利用资源枯竭期进行大规模企业改制，将全部采矿国企打包出售', 'danger');
        },
      },
      {
        text: '拒绝诱惑，坚守底线',
        color: 'green',
        effects: { reputation: 5, happiness: 2 },
        customAction: (s) => {
          s._cashOutUsed = true;
          showNotification('拒绝了套现诱惑，坚守了干部底线', 'success');
          logEvent('拒绝资源枯竭期的套现诱惑，坚守廉洁底线', 'success');
        },
      },
    ],
  },
];

const POLICY_OPTIONS = [
  { id: 'propertyTax', name: '补充性房产税率', desc: '向住宅征收的年度房产税', min: 0, max: 3, step: 0.1, unit: '%', default: 0.5, apply: (v, s) => { s.policies.propertyTax = v; } },
  { id: 'businessTax', name: '补充性营业税率', desc: '向工商企业征收的营业税', min: 3, max: 25, step: 0.5, unit: '%', default: 13, apply: (v, s) => { s.policies.businessTax = v; } },
  { id: 'incomeTax', name: '补充性个人所得税率', desc: '向市民征收的个人所得税', min: 0, max: 45, step: 1, unit: '%', default: 10, apply: (v, s) => { s.policies.incomeTax = v; } },
  { id: 'eduBudget', name: '教育预算占比', desc: '财政中用于教育的比例', min: 5, max: 30, step: 1, unit: '%', default: 15, apply: (v, s) => { s.policies.eduBudget = v; } },
  { id: 'healthBudget', name: '医疗预算占比', desc: '财政中用于医疗的比例', min: 5, max: 30, step: 1, unit: '%', default: 12, apply: (v, s) => { s.policies.healthBudget = v; } },
  { id: 'infraBudget', name: '基建预算占比', desc: '财政中用于基础设施建设的比例', min: 5, max: 40, step: 1, unit: '%', default: 20, apply: (v, s) => { s.policies.infraBudget = v; } },
  { id: 'envRegulation', name: '环保监管力度', desc: '对污染企业的监管严格程度', min: 1, max: 10, step: 1, unit: '级', default: 5, apply: (v, s) => { s.policies.envRegulation = v; } },
  { id: 'landPrice', name: '土地出让金', desc: '商业用地出让价格倍率', min: 0.5, max: 3, step: 0.1, unit: 'x', default: 1, apply: (v, s) => { s.policies.landPrice = v; } },
];

const INVESTMENT_OPTIONS = [
  { id: 'promo', name: '工商推介会', cost: 300, desc: '举办大型工商推介会，吸引企业入驻。GDP增速+3%，市民满意度+2。每任期可执行3次，重复执行效果递减。', effects: { gdpMult: 1.03, happiness: 2, reputation: 3 }, minTurn: 0, maxPerTerm: 3 },
  { id: 'hightech', name: '高新技术产业园', cost: 2000, desc: '建设高新技术产业园区，吸引科技企业。GDP增速+6%，教育指数+5。每任期仅可执行1次。', effects: { gdpMult: 1.06, happiness: 3, reputation: 5, educationIndex: 5 }, minTurn: 3, maxPerTerm: 1 },
  { id: 'tourism', name: '旅游开发项目', cost: 1000, desc: '开发旅游资源，提升城市知名度。GDP增速+4%，满意度+5。每任期可执行2次，重复执行效果递减。', effects: { gdpMult: 1.04, happiness: 5, reputation: 4 }, minTurn: 2, maxPerTerm: 2 },
  { id: 'ftz', name: '自贸区申报', cost: 3000, desc: '申报自由贸易试验区，大幅提升经济活力。GDP增速+8%。每任期仅可执行1次。', effects: { gdpMult: 1.08, happiness: 4, reputation: 8 }, minTurn: 6, maxPerTerm: 1 },
];
const GDP_MULT_CAP = 1.5; // gdpMult总倍率上限，防止数值膨胀
const REVENUE_GDP_CAP_RATIO = 0.16; // 一般公共预算收入/GDP约16% (2024年实际数据)
const TRANSFER_PAYMENT_INTERVAL = 12; // 每年一次转移支付
const TRANSFER_PAYMENT_BASE = 150; // 基础转移支付（万）— 大幅压缩

const MACRO_POLICY_OPTIONS = [
  { id: 'housingSubsidy', name: '购房补贴', desc: '为市民提供购房补贴，刺激住房需求', min: 0, max: 500, step: 50, unit: '元/㎡', default: 0,
    apply: (v, s) => { s.policies.housingSubsidy = v; } },
  { id: 'bizSubsidy', name: '创业补贴', desc: '补贴新注册企业，降低创业门槛', min: 0, max: 100, step: 10, unit: '万/家', default: 0,
    apply: (v, s) => { s.policies.bizSubsidy = v; } },
  { id: 'interestRate', name: '基准利率', desc: '调整基准利率影响借贷和投资', min: 0, max: 10, step: 0.25, unit: '%', default: 3,
    apply: (v, s) => { s.policies.interestRate = v; } },
  { id: 'bankReserve', name: '存款准备金率', desc: '影响银行可贷资金规模', min: 5, max: 25, step: 0.5, unit: '%', default: 12,
    apply: (v, s) => { s.policies.bankReserve = v; } },
  { id: 'greenBond', name: '绿色债券', desc: '发行绿色债券用于环保投资', min: 0, max: 2000, step: 100, unit: '万', default: 0,
    apply: (v, s) => { s.policies.greenBond = v; } },
  { id: 'consumerVoucher', name: '消费券', desc: '发放市民消费券刺激消费', min: 0, max: 1000, step: 50, unit: '万', default: 0,
    apply: (v, s) => { s.policies.consumerVoucher = v; } },
  { id: 'talentIncentive', name: '人才引进激励', desc: '为高层次人才提供安家费和创业扶持', min: 0, max: 500, step: 50, unit: '万/人', default: 0,
    apply: (v, s) => { s.policies.talentIncentive = v; } },
  { id: 'mortgageRate', name: '首套房贷利率', desc: '降低房贷利率刺激购房需求', min: 2, max: 8, step: 0.1, unit: '%', default: 4,
    apply: (v, s) => { s.policies.mortgageRate = v; } },
  // v2.2.5c: 公共交通政策
  { id: 'transitFare', name: '公交票价倍率', desc: '调整地铁/公交票价倍率。低价吸引更多乘客分流路面车流，但减少票务收入；高价反之。基准1.0', min: 0, max: 3, step: 0.1, unit: 'x', default: 1,
    apply: (v, s) => { s.policies.transitFare = v; } },
  { id: 'transitInterval', name: '发车间隔', desc: '调整公共交通发车间隔（分钟）。间隔越短分流效果越好，但运营成本越高。基准5分钟', min: 1, max: 15, step: 1, unit: '分钟', default: 5,
    apply: (v, s) => { s.policies.transitInterval = v; } },
  { id: 'transitSubsidy', name: '公交补贴', desc: '向公共交通运营提供财政补贴，提升服务质量和分流效果', min: 0, max: 500, step: 50, unit: '万/月', default: 0,
    apply: (v, s) => { s.policies.transitSubsidy = v; } },
  // v2.4.3: 资源政策（仅资源型城市显示）
  { id: 'miningIntensity', name: '资源开发力度', desc: '调整矿产资源开采力度。力度越大产值越高，但资源衰减速度也越快', min: 0.5, max: 2.0, step: 0.1, unit: 'x', default: 1.0,
    apply: (v, s) => { s.policies.miningIntensity = v; } },
  { id: 'transformationFunding', name: '转型资金投入', desc: '调整产业转型月度资金投入倍率。投入越大转型越快，但财政压力也更大', min: 0.5, max: 2.0, step: 0.1, unit: 'x', default: 1.0,
    apply: (v, s) => { s.policies.transformationFunding = v; } },
  { id: 'envRestoration', name: '矿区生态修复', desc: '投入资金修复矿区生态环境，降低污染、提升幸福度，但增加财政支出', min: 0, max: 200, step: 20, unit: '万/月', default: 0,
    apply: (v, s) => { s.policies.envRestoration = v; } },
];

const CORRUPTION_ACTIONS = [
  { id: 'bribe', name: '主动索贿', desc: '向辖区内企业主动索取"赞助费"。所得进入私人账户。', gain: 400, corruption: 15, inspection: 5, reputation: 0, cooldown: 3 },
  { id: 'sellOffice', name: '卖官鬻爵', desc: '暗中出售政府职位，安插亲信。所得进入私人账户。', gain: 600, corruption: 20, inspection: 8, reputation: -5, cooldown: 4 },
  { id: 'powerTrade', name: '权钱交易', desc: '利用审批权为企业开绿灯换取利益。所得进入私人账户。', gain: 800, corruption: 25, inspection: 10, reputation: -3, cooldown: 5 },
  { id: 'donation', name: '政治献金', desc: '接受企业以"政治献金"名义的资助。所得进入私人账户。', gain: 500, corruption: 10, inspection: 3, reputation: 3, cooldown: 3 },
  { id: 'launder', name: '捐款洗白', desc: '通过慈善捐款洗白部分腐败行为，降低腐败指数。', cost: 300, gain: 0, corruption: -10, inspection: 0, reputation: 5, cooldown: 2 },
];

