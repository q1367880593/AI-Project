/* 源自《置身事内》单文件版 - 学历系统 (v1.3.0.5) */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 学历系统 (v1.3.0.5) ==============

const DEGREE_LEVELS = ['大专', '本科', '硕士', '博士'];
const DEGREE_REQUIREMENTS = { 0: null, 1: '大专', 2: '本科', 3: '硕士', 4: '博士' }; // 各城市等级晋升所需学历

// 随机开局学历
function randomStartingDegree() {
  const r = Math.random();
  if (r < 0.35) return null;       // 35% 无学历
  if (r < 0.65) return '大专';     // 30% 大专
  if (r < 0.88) return '本科';     // 23% 本科
  if (r < 0.97) return '硕士';     //  9% 硕士
  return '博士';                    //  3% 博士
}

// 行测题库（2题随机抽）
const XINGCE_QUESTIONS = [
  { q: '一个数列：1, 3, 6, 10, 15, ...，下一项是？', options: ['18', '20', '21', '22'], answer: 2, exp: '相邻两项差为2,3,4,5,6，10+6=16≠，实际为1,3,6,10,15,21，差为2,3,4,5,6' },
  { q: '某商品原价200元，先涨价10%再降价10%，最终价格是？', options: ['200元', '198元', '202元', '196元'], answer: 1, exp: '200×1.1×0.9=198元' },
  { q: '甲乙两人从A、B两地相向而行，甲速3km/h，乙速4km/h，AB相距21km，多久后相遇？', options: ['2小时', '3小时', '4小时', '5小时'], answer: 1, exp: '21÷(3+4)=3小时' },
  { q: '一个水池有进水管和出水管，进水管每小时注水5吨，出水管每小时放水3吨，空池多久能注满20吨？', options: ['5小时', '8小时', '10小时', '20小时'], answer: 2, exp: '20÷(5-3)=10小时' },
  { q: '某单位有职工120人，其中党员占60%，党员中女性占25%，该单位女性党员有多少人？', options: ['15人', '18人', '20人', '30人'], answer: 1, exp: '120×60%×25%=18人' },
  { q: '一列火车长150米，以72km/h的速度通过一座300米的桥，需要多少秒？', options: ['15秒', '20秒', '22.5秒', '30秒'], answer: 2, exp: '(150+300)÷(72000÷3600)=450÷20=22.5秒' },
  { q: '某公司去年利润500万，今年比去年增长20%，明年计划比今年增长10%，明年利润预计多少？', options: ['640万', '650万', '660万', '700万'], answer: 2, exp: '500×1.2×1.1=660万' },
  { q: '某班40人考试，平均分80分，及格率75%，不及格同学的平均分是多少？', options: ['50分', '55分', '60分', '65分'], answer: 2, exp: '总分3200，及格30人×假设平均90=2700，不及格10人总分500，平均50分。实际：3200-及格总分需重新算，不及格平均=(3200-30×80/0.75)/10=60分' },
  { q: '一个正方形边长增加20%，面积增加多少？', options: ['20%', '40%', '44%', '48%'], answer: 2, exp: '1.2²-1=0.44=44%' },
  { q: '某商品打八折后比原价便宜了40元，原价是多少？', options: ['150元', '180元', '200元', '220元'], answer: 2, exp: '40÷(1-0.8)=200元' },
  { q: '小明从家到学校要花30分钟，从学校回家只花了20分钟。已知去时速度为4km/h，回时速度是多少？', options: ['5km/h', '6km/h', '7km/h', '8km/h'], answer: 1, exp: '距离=4×0.5=2km，回时速度=2÷(20/60)=6km/h' },
  { q: '一个袋子里有5个红球和3个白球，随机摸出一个球是红球的概率是多少？', options: ['3/8', '5/8', '1/2', '5/3'], answer: 1, exp: '5÷(5+3)=5/8' },
  { q: '某公司年度利润分配方案为：先提取10%公积金，再按出资比例分配。若利润100万，甲出资60%，乙出资40%，甲可分多少？', options: ['54万', '60万', '50万', '56万'], answer: 0, exp: '100×90%×60%=54万' },
  { q: '时钟显示3点整时，时针和分针的夹角是多少度？', options: ['60度', '90度', '120度', '45度'], answer: 1, exp: '3点整时针指3，分针指12，夹角90度' },
  { q: '小明买了一套房，首付30%，其余贷款。若房价200万，贷款利率4.9%，等额本息30年。以下哪项描述正确？', options: ['首付60万', '贷款140万', '月供约7400元', '以上都对'], answer: 3, exp: '首付=200×30%=60万，贷款=140万，月供约7430元' },
];

// 公基题库（3题随机抽）
const GONGJI_QUESTIONS = [
  { q: '我国宪法规定，中华人民共和国的根本制度是？', options: ['社会主义制度', '人民代表大会制度', '民主集中制', '多党合作制'], answer: 0, exp: '宪法第一条：社会主义制度是中华人民共和国的根本制度' },
  { q: '我国国家机构实行的原则是？', options: ['三权分立', '民主集中制', '议行合一', '联邦制'], answer: 1, exp: '宪法第三条：中华人民共和国的国家机构实行民主集中制的原则' },
  { q: '下列哪项不是公务员应当履行的义务？', options: ['忠于宪法', '为人民服务', '参与商业活动', '保守国家秘密'], answer: 2, exp: '公务员不得从事或者参与营利性活动' },
  { q: '党的群众路线是？', options: ['一切从实际出发', '一切为了群众，一切依靠群众，从群众中来，到群众中去', '实事求是', '独立自主'], answer: 1, exp: '群众路线是党的根本工作路线' },
  { q: '下列哪项属于行政许可？', options: ['行政处罚', '工商登记', '行政强制', '行政指导'], answer: 1, exp: '工商登记属于行政许可行为' },
  { q: '我国《民法典》规定，限制民事行为能力人的年龄是？', options: ['6周岁', '8周岁', '10周岁', '14周岁'], answer: 1, exp: '民法典规定8周岁以上为限制民事行为能力人' },
  { q: '下列哪个不是我国的基本经济制度？', options: ['公有制为主体', '多种所有制经济共同发展', '按劳分配为主体', '计划经济'], answer: 3, exp: '我国实行社会主义市场经济，非计划经济' },
  { q: '党的思想路线的核心是？', options: ['解放思想', '实事求是', '与时俱进', '求真务实'], answer: 1, exp: '实事求是是党的思想路线的核心' },
  { q: '下列哪项不是行政机关？', options: ['公安局', '教育局', '人民法院', '市场监督管理局'], answer: 2, exp: '人民法院是审判机关，非行政机关' },
  { q: '我国国家主席的任期是？', options: ['3年', '4年', '5年', '6年'], answer: 2, exp: '宪法规定国家主席每届任期五年' },
  { q: '下列哪项属于行政处罚？', options: ['罚金', '罚款', '拘役', '没收财产'], answer: 1, exp: '罚款属于行政处罚，罚金、拘役、没收财产属于刑事处罚' },
  { q: '公务员法规定，公务员的考核分为？', options: ['优秀、良好、合格、不合格', '优秀、称职、基本称职、不称职', 'A、B、C、D', '一等、二等、三等、四等'], answer: 1, exp: '公务员考核分为优秀、称职、基本称职、不称职四个档次' },
  { q: '我国《劳动法》规定，劳动者每日工作时间不超过多少小时？', options: ['6小时', '8小时', '10小时', '12小时'], answer: 1, exp: '劳动法规定每日工作不超过8小时，平均每周不超过44小时' },
  { q: '下列哪项不属于公民的基本权利？', options: ['选举权', '言论自由', '纳税义务', '人身自由'], answer: 2, exp: '纳税是公民的基本义务而非权利' },
  { q: '我国宪法规定，全国人民代表大会每届任期几年？', options: ['3年', '4年', '5年', '6年'], answer: 2, exp: '宪法规定全国人民代表大会每届任期五年' },
  { q: '下列哪种行为构成受贿罪？', options: ['正常收受礼物', '利用职务便利收受财物为他人谋利', '朋友间借贷', '接受正常商务馈赠'], answer: 1, exp: '受贿罪要求利用职务便利收受财物并为他人谋取利益' },
  { q: '我国《行政诉讼法》规定，公民可以对哪种行为提起行政诉讼？', options: ['抽象行政行为', '具体行政行为', '立法行为', '司法行为'], answer: 1, exp: '行政诉讼针对的是具体行政行为' },
  { q: '下列哪个不是我国的国家象征？', options: ['国旗', '国歌', '国徽', '国花'], answer: 3, exp: '我国宪法规定的国家象征是国旗、国歌、国徽，国花尚未法定' },
];

// 渲染学历选项卡
function renderDegreeTab() {
  const s = gameState;
  let html = '';
  const degree = s.playerDegree;
  const reqDegree = DEGREE_REQUIREMENTS[s.cityLevelId] || null;
  const nextLevelId = Math.min(s.cityLevelId + 1, 4);
  const nextReqDegree = DEGREE_REQUIREMENTS[nextLevelId] || null;

  // 学历展示
  html += `<div class="stats-section"><h3>${ICON.schoolStat}当前学历</h3>`;
  if (degree) {
    const fakeTag = s.degreeFake ? `<span class="inline-icon" style="color:var(--red);font-size:12px;margin-left:6px;display:inline-flex;align-items:center;gap:2px;">${ICON.alert} 伪造</span>` : '';
    html += `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:${s.degreeFake ? 'var(--red-light)' : 'var(--green-light)'};border-radius:10px;">
      <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:${s.degreeFake ? 'var(--red)' : 'var(--green)'};">${ICON.schoolStat}</div>
      <div><div style="font-size:16px;font-weight:600;">${degree}${fakeTag}</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${s.degreeFake ? '此学历系伪造，存在被查风险' : '正规学历，组织认可'}</div></div></div>`;
  } else {
    html += `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--separator-light);border-radius:10px;">
      <div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:var(--text-3);">${ICON.book}</div>
      <div><div style="font-size:16px;font-weight:600;">暂无学历</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">需通过党校学习获得学历</div></div></div>`;
  }
  html += '</div>';

  // 晋升学历要求
  if (nextReqDegree) {
    const hasReq = !nextReqDegree || degree === nextReqDegree || (degree && DEGREE_LEVELS.indexOf(degree) >= DEGREE_LEVELS.indexOf(nextReqDegree));
    html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.gauge}晋升要求</h3>`;
    html += `<div style="font-size:13px;padding:8px 12px;background:${hasReq ? 'var(--green-light)' : 'var(--red-light)'};border-radius:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      <span>晋升到${CITY_LEVELS[nextLevelId].name}需要学历：<strong>${nextReqDegree}</strong></span>
      <span class="inline-icon" style="color:${hasReq ? 'var(--green)' : 'var(--red)'};display:inline-flex;align-items:center;gap:2px;">${hasReq ? ICON.check : ICON.alert} ${hasReq ? '已满足' : '未满足'}</span>
    </div></div>`;
  }

  // 党校学习
  html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.book}党校学习</h3>`;
  const cooldown = s.partySchoolCooldown || 0;
  const currentDegreeIdx = degree ? DEGREE_LEVELS.indexOf(degree) : -1;
  const nextDegree = currentDegreeIdx >= 0 && currentDegreeIdx < DEGREE_LEVELS.length - 1 ? DEGREE_LEVELS[currentDegreeIdx + 1] : (degree ? null : '大专');
  if (cooldown > 0) {
    html += `<div style="padding:10px;background:var(--separator-light);border-radius:8px;font-size:13px;color:var(--text-2);">
      党校学习中，剩余 ${cooldown} 个月完成学业</div>`;
  } else if (nextDegree) {
    const cost = nextDegree === '大专' ? 1 : nextDegree === '本科' ? 2 : nextDegree === '硕士' ? 3 : 5;
    html += `<div style="padding:10px;background:var(--bg-card);border-radius:8px;font-size:13px;">
      <div>下一学历目标：<strong>${nextDegree}</strong></div>
      <div style="font-size:11px;color:var(--text-3);margin-top:4px;">学费 ¥${cost}万（个人支付），学习周期12个月，完成后参加考试</div>
      <div style="font-size:11px;color:var(--text-3);margin-top:2px;">考试内容：2道行测 + 3道公基，答对3题即通过</div>
      <button class="start-btn primary" style="width:100%;margin-top:8px;" onclick="enrollPartySchool('${nextDegree}', ${cost})">${ICON.book}报名学习（¥${cost}万·个人）</button>
    </div>`;
  } else {
    html += `<div style="padding:10px;background:var(--green-light);border-radius:8px;font-size:13px;color:var(--green);">
      已获得最高学历（博士），无需继续学习</div>`;
  }
  html += '</div>';

  // 伪造学历
  if (!degree || (degree && DEGREE_LEVELS.indexOf(degree) < DEGREE_LEVELS.length - 1)) {
    const fakeDegree = degree ? DEGREE_LEVELS[Math.min(DEGREE_LEVELS.indexOf(degree) + 1, DEGREE_LEVELS.length - 1)] : '本科';
    const fakeCost = 10;
    html += `<div class="stats-section" style="margin-top:12px;"><h3>${ICON.alert}旁门左道</h3>`;
    html += `<div style="padding:10px;background:var(--red-light);border-radius:8px;font-size:13px;">
      <div class="inline-icon" style="color:var(--red);font-weight:600;display:flex;align-items:center;gap:4px;">${ICON.alert}伪造学历</div>
      <div style="font-size:11px;color:var(--text-2);margin-top:4px;">花费 ¥${fakeCost}万（个人支付） 伪造${fakeDegree}学历</div>
      <div style="font-size:11px;color:var(--text-2);margin-top:2px;">风险：教育局长忠诚度低时可能举报；纪委检查时罪加一等</div>
      <button class="start-btn" style="width:100%;margin-top:8px;background:var(--red);color:white;" onclick="fakeDegree('${fakeDegree}', ${fakeCost})">${ICON.alert}伪造${fakeDegree}学历（¥${fakeCost}万·个人）</button>
    </div></div>`;
  }

  html += '</div>';
  return html;
}

// 报名党校
function enrollPartySchool(degree, cost) {
  if (gameState.partySchoolCooldown > 0) { showNotification('正在学习中', 'info'); return; }
  if (gameState.privateAccount < cost) { showNotification(`个人账户不足，需¥${cost}万`, 'warn'); return; }
  gameState.privateAccount -= cost;
  gameState.partySchoolCooldown = 12;
  gameState._pendingDegree = degree;
  showNotification(`已报名党校学习，12个月后参加${degree}考试`, 'success');
  logEvent(`报名党校学习${degree}，个人支付学费¥${cost}万`, 'info');
  updateUI();
  renderSheet('personal');
}

// 党校毕业考试
function startDegreeExam() {
  if (!gameState._pendingDegree) return;
  // 随机抽2道行测+3道公基
  const xingce = [...XINGCE_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 2);
  const gongji = [...GONGJI_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
  const allQuestions = [...xingce, ...gongji];

  let html = '';
  html += `<div style="font-size:12px;color:var(--text-2);margin-bottom:12px;">共5题，答对3题即通过</div>`;
  html += `<div id="exam-questions">`;
  allQuestions.forEach((q, i) => {
    html += `<div style="margin-bottom:10px;padding:10px;background:var(--bg-card);border-radius:8px;">`;
    html += `<div style="font-size:13px;font-weight:500;margin-bottom:6px;color:var(--text-1);">${i+1}. ${q.q}</div>`;
    q.options.forEach((opt, j) => {
      html += `<label style="display:block;padding:4px 8px;font-size:12px;cursor:pointer;color:var(--text-2);"><input type="radio" name="q${i}" value="${j}" style="margin-right:6px;">${String.fromCharCode(65+j)}. ${opt}</label>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  showModal(`${gameState._pendingDegree}学历考试`, html, [
    { text: '关闭', color: 'gray', action: () => { closeModal(); } },
    { text: '交卷', color: 'blue', action: () => { submitDegreeExam(); } }
  ], '党校考试', 'info');
  // 存储题目供判卷
  gameState._examQuestions = allQuestions;
}

// 交卷判分
function submitDegreeExam() {
  const questions = gameState._examQuestions;
  if (!questions) return;
  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    if (selected && parseInt(selected.value) === questions[i].answer) correct++;
  }
  const passed = correct >= 3;
  closeModal();
  if (passed) {
    gameState.playerDegree = gameState._pendingDegree;
    gameState.degreeFake = false;
    showNotification(`考试通过！获得${gameState._pendingDegree}学历`, 'success');
    logEvent(`通过党校考试，获得${gameState._pendingDegree}学历`, 'success');
  } else {
    showNotification(`考试未通过（答对${correct}题/5题），需重新学习`, 'danger');
    logEvent(`党校${gameState._pendingDegree}考试未通过（答对${correct}/5题）`, 'warn');
  }
  gameState._pendingDegree = null;
  gameState._examQuestions = null;
  updateUI();
  renderSheet('personal');
}

// 伪造学历
function fakeDegree(degree, cost) {
  if (gameState.privateAccount < cost) { showNotification(`个人账户不足，需¥${cost}万`, 'warn'); return; }
  gameState.privateAccount -= cost;
  gameState.playerDegree = degree;
  gameState.degreeFake = true;
  showNotification(`已伪造${degree}学历`, 'warn');
  logEvent(`伪造${degree}学历，个人支付¥${cost}万`, 'warn');
  updateUI();
  renderSheet('personal');
}

