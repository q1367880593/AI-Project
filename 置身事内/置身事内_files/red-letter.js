/* 源自《置身事内》单文件版 - 红头文件系统 (GB/T 9704-2012) */
/* 自动拆分生成，请勿手动调整章节归属 */

// ============== 红头文件系统 (GB/T 9704-2012) ==============
// _rlCloseCallback: if set, closing the red-letter also runs this (e.g. game over)
window._rlForceCallback = null;

function showRedLetter(html, options) {
  // Always show close button — force only controls callback behavior, not visibility
  const closeBtn = '<button class="rl-close-btn" onclick="closeRedLetter()" aria-label="关闭"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
  window._rlForceCallback = (options && options.force) ? options.onClose : null;
  document.getElementById('red-letter-content').innerHTML = closeBtn + html;
  document.getElementById('red-letter-overlay').classList.add('active');
  document.getElementById('red-letter-overlay').scrollTop = 0;
}
function closeRedLetter() {
  document.getElementById('red-letter-overlay').classList.remove('active');
  // If there's a forced callback (e.g. game over), run it after closing
  if (window._rlForceCallback) {
    const cb = window._rlForceCallback;
    window._rlForceCallback = null;
    setTimeout(cb, 100);
  }
}

function getRedLetterDate() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
}

function getDocNumber(prefix) {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 80) + 10;
  return `${prefix}〔${year}〕${seq}号`;
}

// 通用版记HTML
function rlFooter(issuer, printer) {
  return `
    <div class="rl-footer-area">
      <div class="rl-footer-top"></div>
      <div class="rl-footer">
        <span class="rl-cc">抄送：XX省委办公厅，XX省人民政府办公厅</span>
      </div>
      <div class="rl-footer-mid"></div>
      <div class="rl-footer">
        <span>${printer || 'XX省委办公厅'}</span>
        <span>${getRedLetterDate()}印发</span>
      </div>
      <div class="rl-footer-bottom"></div>
    </div>`;
}

// 通用印章HTML
function rlSeal(orgName) {
  const parts = orgName.split('');
  return `<div class="rl-seal"><div class="rl-seal-inner">${parts.map(c => `<div>${c}</div>`).join('')}</div></div>`;
}

// 任职调令 — 游戏开始时显示
function showStartRedLetter() {
  const docNum = getDocNumber('XX组发');
  const html = `
  <div class="red-letter-doc">
    <div class="rl-page">
      <div class="rl-top-meta">
        <span>份号：0000${Math.floor(Math.random()*900)+100}</span>
        <span>秘密·保密期限：5年</span>
      </div>
      <div class="rl-issuer">XX省委组织部文件</div>
      <div class="rl-doc-number">${docNum}</div>
      <div class="rl-signer">
        <span class="rl-signer-label">签发人：<span class="rl-signer-name">李XX</span></span>
      </div>
      <div class="rl-red-line"></div>
      <div class="rl-title">关于同志任职的通知</div>
      <div class="rl-recipient">各市、县（市、区）党委和人民政府：</div>
      <div class="rl-body">
        <p>经省委研究决定：</p>
        <p class="lvl1">一、任命同志为乡镇党委书记，主持党委全面工作。</p>
        <p>（一）该同志应切实履行全面从严治党主体责任，统筹推进辖区经济社会发展、城乡建设、民生保障、生态环保等各项工作，认真贯彻新发展理念。</p>
        <p>（二）严格遵守党的政治纪律和政治规矩，自觉接受纪检监察监督，做到廉洁从政、为民用权。</p>
        <p class="lvl1">二、任职时间自文件下发之日起计算。</p>
        <p class="lvl1">三、请按有关规定办理任职手续，并于收到本通知之日起十日内到任。</p>
        <p>特此通知。</p>
      </div>
      <div class="rl-input-section">
        <div class="rl-input-prompt">请填写任职信息</div>
        <div class="rl-input-group">
          <label>被任命人姓名</label>
          <div class="rl-name-picker">
            <div class="rl-picker-label">姓氏</div>
            <div class="rl-chips" id="rl-surname-chips">
              ${SURNAMES.map((s,i) => `<span class="rl-chip${i===0?' rl-chip-active':''}" onclick="selectNameChip(this,'surname')">${s}</span>`).join('')}
            </div>
            <div class="rl-picker-label">名字</div>
            <div class="rl-chips" id="rl-given-chips">
              ${GIVEN_NAMES.map((g,i) => `<span class="rl-chip${i===0?' rl-chip-active':''}" onclick="selectNameChip(this,'given')">${g}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="rl-input-group">
          <label>拟任职地名</label>
          <input type="text" id="rl-city-name" placeholder="如：清水镇" maxlength="8" value="" />
        </div>
        <button class="rl-btn rl-btn-primary" onclick="confirmStartRedLetter()">接受任命</button>
      </div>
      <div class="rl-signature">
        <div class="rl-org">XX省委组织部</div>
        <div class="rl-date">${getRedLetterDate()}</div>
      </div>
      ${rlSeal('组织部')}
      <div class="rl-annotation">（此件公开发布）</div>
            ${rlFooter('XX省委组织部', 'XX省委办公厅')}
    </div>
  </div>`;
  showRedLetter(html);
}

function selectNameChip(el, type) {
  const container = document.getElementById(type === 'surname' ? 'rl-surname-chips' : 'rl-given-chips');
  if (!container) return;
  container.querySelectorAll('.rl-chip').forEach(c => c.classList.remove('rl-chip-active'));
  el.classList.add('rl-chip-active');
}

function confirmStartRedLetter() {
  const surnameEl = document.querySelector('#rl-surname-chips .rl-chip-active');
  const givenEl = document.querySelector('#rl-given-chips .rl-chip-active');
  const surname = surnameEl ? surnameEl.textContent.trim() : '';
  const given = givenEl ? givenEl.textContent.trim() : '';
  if (!surname || !given) { showNotification('请选择姓氏和名字', 'warn'); return; }
  // 禁止特定姓名组合
  if (surname === '李' && (given === '强' || given === '鹏')) {
    showNotification('该姓名组合已被占用，请重新选择', 'warn');
    return;
  }
  const cityInput = document.getElementById('rl-city-name');
  const city = cityInput ? cityInput.value.trim() : '';
  if (!city) { if (cityInput) { cityInput.style.borderColor = '#c00000'; cityInput.focus(); } return; }
  gameState.playerName = surname + given;
  gameState.cityName = city;
  closeRedLetter();
  startNewGame();
}

// 晋升调令 — 升迁时显示
function showPromotionRedLetter(nextLevel, onConfirm) {
  const levelNames = ['乡镇', '县级', '地级', '副省级', '直辖市级'];
  const currentLevel = levelNames[Math.max(0, nextLevel.id - 1)] || '乡镇';
  const newLevel = levelNames[nextLevel.id] || '县级';
  const pname = gameState.playerName || '同志';
  const docNum = getDocNumber('XX组发');
  const html = `
  <div class="red-letter-doc">
    <div class="rl-page">
      <div class="rl-top-meta">
        <span>份号：0000${Math.floor(Math.random()*900)+100}</span>
        <span>秘密·保密期限：5年</span>
      </div>
      <div class="rl-issuer">XX省委组织部文件</div>
      <div class="rl-doc-number">${docNum}</div>
      <div class="rl-signer">
        <span class="rl-signer-label">签发人：<span class="rl-signer-name">王XX</span></span>
      </div>
      <div class="rl-red-line"></div>
      <div class="rl-title">关于${pname}同志职务晋升的通知</div>
      <div class="rl-recipient">各市、县（市、区）党委和人民政府，省直各单位：</div>
      <div class="rl-body">
        <p>经省委研究决定：</p>
        <p class="lvl1">一、${pname}同志任${currentLevel}党委书记期间，认真贯彻落实党中央决策部署，履职尽责、担当作为，在推动经济社会发展、保障改善民生、加强党的建设等方面取得显著成效。经任期综合考核，评定为优秀等次。根据干部选拔任用工作有关规定，决定提拔使用，任${newLevel}党委书记。</p>
        <p>（一）任期主要工作实绩：</p>
        <p class="lvl2">1.辖区常住人口达到${formatPop(gameState.population)}人，城镇化水平稳步提升。</p>
        <p class="lvl2">2.地区生产总值达到¥${formatMoney(gameState.gdp * 10000)}，经济保持平稳健康发展。</p>
        <p class="lvl2">3.群众满意度指数${Math.round(gameState.happiness)}，民生福祉持续改善。</p>
        <p class="lvl2">4.城市建成区绿化覆盖率达到${gameState.greenCoverage.toFixed(1)}%，生态文明建设成效明显。</p>
        <p class="lvl1">二、以上同志职务任免按有关法律规定办理，请于收到本通知之日起十五日内办理工作交接并到任。</p>
        <p class="lvl1">三、以上同志原任职务自行免除。</p>
        <p>特此通知。</p>
      </div>
      <div class="rl-input-section">
        <div class="rl-input-prompt">请填写赴任信息</div>
        <div class="rl-input-group">
          <label>拟赴任地名</label>
          <input type="text" id="rl-new-city-name" placeholder="如：新兴市" maxlength="8" value="" />
        </div>
        <button class="rl-btn rl-btn-primary" onclick="confirmPromotionRedLetter()">接受调令，赴任新岗</button>
      </div>
      <div class="rl-signature">
        <div class="rl-org">XX省委组织部</div>
        <div class="rl-date">${getRedLetterDate()}</div>
      </div>
      ${rlSeal('组织部')}
      <div class="rl-annotation">（此件公开发布）</div>
            ${rlFooter('XX省委组织部', 'XX省委办公厅')}
    </div>
  </div>`;
  showRedLetter(html);
  window._promotionConfirmCallback = onConfirm;
}

function confirmPromotionRedLetter() {
  const cityInput = document.getElementById('rl-new-city-name');
  const city = cityInput ? cityInput.value.trim() : '';
  if (!city) { cityInput.style.borderColor = '#c00000'; cityInput.focus(); return; }
  gameState.cityName = city;
  closeRedLetter();
  if (window._promotionConfirmCallback) {
    const cb = window._promotionConfirmCallback;
    window._promotionConfirmCallback = null;
    cb();
  }
}

// v2.3.6: 兼任副职红头文件
function showDeputyRedLetter(targetLevel, onConfirm) {
  const levelNames = ['乡镇', '县级', '地级', '副省级', '直辖市级'];
  const currentLevel = levelNames[Math.max(0, targetLevel.id - 1)] || '乡镇';
  const targetLevelName = levelNames[targetLevel.id] || '县级';
  const deputyTitles = ['副镇长', '副县长', '副市长', '副省长', '副市长'];
  const deputyTitle = deputyTitles[targetLevel.id] || '副职';
  const pname = gameState.playerName || '同志';
  const docNum = getDocNumber('XX组发');
  const score = Math.round(gameState.livabilityScore * 0.3 + gameState.prosperityScore * 0.2 + gameState.happiness * 0.2 + (100 - gameState.corruption) * 0.15 + gameState.reputation * 0.15);
  const html = `
  <div class="red-letter-doc">
    <div class="rl-page">
      <div class="rl-top-meta">
        <span>份号：0000${Math.floor(Math.random()*900)+100}</span>
        <span>秘密·保密期限：5年</span>
      </div>
      <div class="rl-issuer">XX省委组织部文件</div>
      <div class="rl-doc-number">${docNum}</div>
      <div class="rl-signer">
        <span class="rl-signer-label">签发人：<span class="rl-signer-name">王XX</span></span>
      </div>
      <div class="rl-red-line"></div>
      <div class="rl-title">关于${pname}同志兼任${targetLevelName}${deputyTitle}的通知</div>
      <div class="rl-recipient">各市、县（市、区）党委和人民政府，省直各单位：</div>
      <div class="rl-body">
        <p>经省委研究决定：</p>
        <p class="lvl1">一、${pname}同志任${currentLevel}党委书记期间，认真贯彻落实党中央决策部署，履职尽责、担当作为，在推动经济社会发展、保障改善民生等方面取得较好成效。经任期综合考核，评定为优秀等次。根据干部培养锻炼有关规定，决定安排${pname}同志兼任${targetLevelName}${deputyTitle}，进行培养锻炼。</p>
        <p>（一）任期主要工作实绩：</p>
        <p class="lvl2">1.辖区常住人口达到${formatPop(gameState.population)}人，城镇化水平稳步提升。</p>
        <p class="lvl2">2.地区生产总值达到¥${formatMoney(gameState.gdp * 10000)}，经济保持平稳健康发展。</p>
        <p class="lvl2">3.群众满意度指数${Math.round(gameState.happiness)}，民生福祉持续改善。</p>
        <p class="lvl2">4.任期考核评分${score}分，政绩考核为优秀等次。</p>
        <p class="lvl1">二、${pname}同志兼任${targetLevelName}${deputyTitle}期间，继续主持${currentLevel}党委全面工作。兼任期间政绩考核达标后，可正式晋升${targetLevelName}党委书记。</p>
        <p class="lvl1">三、请于收到本通知之日起十五日内办理相关手续。</p>
        <p>特此通知。</p>
      </div>
      <div class="rl-input-section">
        <div class="rl-input-prompt">确认接受任命</div>
        <button class="rl-btn rl-btn-primary" onclick="confirmDeputyRedLetter()">接受任命，继续履职</button>
      </div>
      <div class="rl-signature">
        <div class="rl-org">XX省委组织部</div>
        <div class="rl-date">${getRedLetterDate()}</div>
      </div>
      ${rlSeal('组织部')}
      <div class="rl-annotation">（此件公开发布）</div>
            ${rlFooter('XX省委组织部', 'XX省委办公厅')}
    </div>
  </div>`;
  showRedLetter(html);
  window._deputyConfirmCallback = onConfirm;
}

function confirmDeputyRedLetter() {
  closeRedLetter();
  if (window._deputyConfirmCallback) {
    const cb = window._deputyConfirmCallback;
    window._deputyConfirmCallback = null;
    cb();
  }
}

// 平调红头文件
function showTransferRedLetter(onConfirm) {
  const lv = getCityLevel();
  const levelNames = ['乡镇', '县级', '地级', '副省级', '直辖市级'];
  const currentLevel = levelNames[lv.id] || '乡镇';
  const pname = gameState.playerName || '同志';
  const docNum = getDocNumber('XX组发');
  const html = `
  <div class="red-letter-doc">
    <div class="rl-page">
      <div class="rl-top-meta">
        <span>份号：0000${Math.floor(Math.random()*900)+100}</span>
        <span>秘密·保密期限：5年</span>
      </div>
      <div class="rl-issuer">XX省委组织部文件</div>
      <div class="rl-doc-number">${docNum}</div>
      <div class="rl-signer">
        <span class="rl-signer-label">签发人：<span class="rl-signer-name">王XX</span></span>
      </div>
      <div class="rl-red-line"></div>
      <div class="rl-title">关于${pname}同志交流任职的通知</div>
      <div class="rl-recipient">各市、县（市、区）党委和人民政府，省直各单位：</div>
      <div class="rl-body">
        <p>经省委研究决定：</p>
        <p class="lvl1">一、${pname}同志任${currentLevel}党委书记期间，认真贯彻落实党中央决策部署，履职尽责、担当作为。因在同一地区任职已满十年，根据《党政领导干部交流工作规定》，决定安排异地交流任职。</p>
        <p>（一）该同志任期工作实绩：</p>
        <p class="lvl2">1.辖区常住人口达到${formatPop(gameState.population)}人。</p>
        <p class="lvl2">2.地区生产总值达到¥${formatMoney(gameState.gdp * 10000)}。</p>
        <p class="lvl2">3.群众满意度指数${Math.round(gameState.happiness)}。</p>
        <p class="lvl2">4.累计政绩${gameState.merit || 0}分。</p>
        <p class="lvl1">二、${pname}同志调任新${currentLevel}党委书记，职级不变，继续主持党委全面工作。</p>
        <p class="lvl1">三、请于收到本通知之日起十五日内办理工作交接并到任。</p>
        <p class="lvl1">四、原任职务自行免除。</p>
        <p>特此通知。</p>
      </div>
      <div class="rl-input-section">
        <div class="rl-input-prompt">请填写赴任地名</div>
        <div class="rl-input-group">
          <label>拟赴任地名</label>
          <input type="text" id="rl-transfer-city-name" placeholder="如：新兴市" maxlength="8" value="" />
        </div>
        <button class="rl-btn rl-btn-primary" onclick="confirmTransferRedLetter()">接受调令，赴任新岗</button>
      </div>
      <div class="rl-signature">
        <div class="rl-org">XX省委组织部</div>
        <div class="rl-date">${getRedLetterDate()}</div>
      </div>
      ${rlSeal('组织部')}
      <div class="rl-annotation">（此件公开发布）</div>
      ${rlFooter('XX省委组织部', 'XX省委办公厅')}
    </div>
  </div>`;
  showRedLetter(html);
  window._promotionConfirmCallback = onConfirm;
}

function confirmTransferRedLetter() {
  const cityInput = document.getElementById('rl-transfer-city-name');
  const city = cityInput ? cityInput.value.trim() : '';
  if (!city) { cityInput.style.borderColor = '#c00000'; cityInput.focus(); return; }
  gameState.cityName = city;
  closeRedLetter();
  if (window._promotionConfirmCallback) {
    const cb = window._promotionConfirmCallback;
    window._promotionConfirmCallback = null;
    cb();
  }
}

// 纪委立案审查通知 — 东窗事发后显示
function showInspectionRedLetter(onConfirm) {
  const pname = gameState.playerName || '同志';
  const cname = gameState.cityName || '';
  const docNum = getDocNumber('XX纪发');
  const html = `
  <div class="red-letter-doc">
    <div class="rl-page">
      <div class="rl-top-meta">
        <span>份号：0000${Math.floor(Math.random()*900)+100}</span>
        <span style="color:#c00000;font-weight:700;">秘密·保密期限：长期</span>
        <span style="color:#c00000;font-weight:700;">紧急</span>
      </div>
      <div class="rl-issuer">XX省纪律检查委员会文件</div>
      <div class="rl-doc-number">${docNum}</div>
      <div class="rl-signer">
        <span class="rl-signer-label">签发人：<span class="rl-signer-name">张XX</span></span>
      </div>
      <div class="rl-red-line"></div>
      <div class="rl-title">关于对${pname}同志立案审查的决定</div>
      <div class="rl-recipient">${cname}人民政府、党委：</div>
      <div class="rl-body">
        <p>根据群众举报和有关线索反映，经XX省纪律检查委员会常委会研究，决定如下：</p>
        <p class="lvl1">一、对${pname}同志在担任${cname}主要领导期间涉嫌严重违纪违法问题立案审查。</p>
        <p>（一）经初步核实，该同志存在以下问题：</p>
        <p class="lvl2">1.腐败指数${Math.round(gameState.corruption)}，腐败行为严重。</p>
        <p class="lvl2">2.纪委关注度${Math.round(gameState.inspectionRisk)}，群众反映强烈。</p>
        <p class="lvl2">3.私人账户资金¥${formatMoney(gameState.privateAccount * 10000)}，来源不明。</p>
        <p class="lvl1">二、责令${pname}同志配合组织调查，如实交代问题，不得隐匿、销毁证据。</p>
        <p class="lvl1">三、暂停${pname}同志一切职务，配合调查期间不得离开所在地。</p>
        <p class="lvl1">四、如有抗拒审查、串供隐匿证据等行为，将从重处理。</p>
        <p>本决定自发出之日起生效。</p>
      </div>
      <div class="rl-signature">
        <div class="rl-org">XX省纪律检查委员会</div>
        <div class="rl-date">${getRedLetterDate()}</div>
      </div>
      ${rlSeal('纪委')}
      <div class="rl-annotation">（此件不公开）</div>
            ${rlFooter('XX省纪律检查委员会', 'XX省纪委办公厅')}
    </div>
  </div>`;
  // Force document: closing always triggers the callback (game over)
  showRedLetter(html, { force: true, onClose: onConfirm });
}

function confirmInspectionRedLetter() {
  // closeRedLetter will trigger the force callback (game over) via _rlForceCallback
  closeRedLetter();
}

// v2.3.6c: 设置处分期不能提拔（1年=12个月）
function applyPromotionBan(months) {
  const banUntil = gameState.turn + months;
  if (banUntil > (gameState.noPromotionUntil || 0)) {
    gameState.noPromotionUntil = banUntil;
  }
}

// 纪委警告处分通知 — 警告决定后出示
// v2.3.6c: 警告处分设置1年内不能提拔
function showWarningRedLetter(onConfirm) {
  const pname = gameState.playerName || '同志';
  const cname = gameState.cityName || '';
  const docNum = getDocNumber('XX纪发');
  const html = `
  <div class="red-letter-doc">
    <div class="rl-page">
      <div class="rl-top-meta">
        <span>份号：0000${Math.floor(Math.random()*900)+100}</span>
        <span>秘密·保密期限：5年</span>
      </div>
      <div class="rl-issuer">XX省纪律检查委员会文件</div>
      <div class="rl-doc-number">${docNum}</div>
      <div class="rl-signer">
        <span class="rl-signer-label">签发人：<span class="rl-signer-name">张XX</span></span>
      </div>
      <div class="rl-red-line"></div>
      <div class="rl-title">关于给予${pname}同志党内警告处分的决定</div>
      <div class="rl-recipient">${cname}党委、人民政府：</div>
      <div class="rl-body">
        <p>经XX省纪律检查委员会研究，作出如下决定：</p>
        <p class="lvl1">一、${pname}同志在担任${cname}主要领导期间，存在以下违纪行为：</p>
        <p>（一）腐败指数${Math.round(gameState.corruption)}，存在一定程度的违纪行为。</p>
        <p>（二）纪委关注度${Math.round(gameState.inspectionRisk)}，群众有反映。</p>
        <p class="lvl1">二、鉴于${pname}同志违纪行为尚不构成严重违法，但已违反党纪，决定给予党内警告处分。</p>
        <p>（一）警告处分期为一年，处分期内不得提拔任用。</p>
        <p>（二）责令${pname}同志深刻反省，认真整改。</p>
        <p class="lvl1">三、${pname}同志应引以为戒，严格要求自己，自觉接受组织和群众监督。</p>
        <p>本决定自发出之日起生效。</p>
      </div>
      <div class="rl-signature">
        <div class="rl-org">XX省纪律检查委员会</div>
        <div class="rl-date">${getRedLetterDate()}</div>
      </div>
      ${rlSeal('纪委')}
      <div class="rl-annotation">（此件不公开）</div>
            ${rlFooter('XX省纪律检查委员会', 'XX省纪委办公厅')}
    </div>
  </div>`;
  // v2.3.6c: 警告处分期内（1年=12个月）不得提拔
  applyPromotionBan(12);
  showRedLetter(html, { force: true, onClose: onConfirm });
}

function confirmWarningRedLetter() {
  closeRedLetter();
}

// v2.2.0 耕地红线违规警告处分（独立于纪委流程，复用 showRedLetter 基础设施）
// v2.3.6c: 修复缺口计算——farmlandArea和farmlandRedline都是格数，直接相减；面积单位改格
function showFarmlandWarningRedLetter(serious) {
  const pname = gameState.playerName || '同志';
  const cname = gameState.cityName || '';
  const as = gameState.agriStats || {};
  const lvTitle = (typeof getOfficialTitle === 'function') ? getOfficialTitle() : '同志';
  const docNum = getDocNumber('XX纪发');
  // v2.3.6c: farmlandArea和farmlandRedline都是格数，直接相减
  const deficitCells = Math.max(0, (as.farmlandRedline || 0) - (as.farmlandArea || 0));
  const title = serious
    ? `关于给予${pname}同志党内严重警告处分的决定`
    : `关于给予${pname}同志党内警告处分的决定`;
  const reason = serious
    ? `长期突破耕地红线，耕地面积持续低于应保红线，累计缺口约 ${deficitCells} 格，违反《土地管理法》第三十三条及基本农田保护条例，情节严重。`
    : `连续半年耕地面积低于应保红线，缺口约 ${deficitCells} 格，违反《土地管理法》及基本农田保护条例有关规定。`;
  const html = `
  <div class="red-letter-doc">
    <div class="rl-page">
      <div class="rl-top-meta">
        <span>份号：0000${Math.floor(Math.random()*900)+100}</span>
        <span>秘密·保密期限：5年</span>
      </div>
      <div class="rl-issuer">XX省纪律检查委员会文件</div>
      <div class="rl-doc-number">${docNum}</div>
      <div class="rl-signer">
        <span class="rl-signer-label">签发人：<span class="rl-signer-name">张XX</span></span>
      </div>
      <div class="rl-red-line"></div>
      <div class="rl-title">${title}</div>
      <div class="rl-recipient">${cname}党委、人民政府：</div>
      <div class="rl-body">
        <p>经XX省纪律检查委员会研究，作出如下决定：</p>
        <p class="lvl1">一、${pname}同志在担任${cname}${lvTitle}期间，存在以下违纪行为：</p>
        <p>（一）${reason}</p>
        <p>（二）纪委关注度${Math.round(gameState.inspectionRisk)}，群众有反映。</p>
        <p class="lvl1">二、鉴于${pname}同志违纪行为${serious ? '情节严重' : '尚不构成严重违法'}，但已违反党纪，决定给予${serious ? '党内严重警告' : '党内警告'}处分。</p>
        <p>（一）处分期为一年，处分期内不得提拔任用。</p>
        <p>（二）责令${pname}同志限期整改，恢复耕地面积至红线以上。</p>
        <p class="lvl1">三、${pname}同志应引以为鉴，严格守住耕地保护红线，自觉接受组织和群众监督。</p>
        <p>本决定自发出之日起生效。</p>
      </div>
      <div class="rl-signature">
        <div class="rl-org">XX省纪律检查委员会</div>
        <div class="rl-date">${getRedLetterDate()}</div>
      </div>
      ${rlSeal('纪委')}
      <div class="rl-annotation">（此件不公开）</div>
      ${rlFooter('XX省纪律检查委员会', 'XX省纪委办公厅')}
    </div>
  </div>`;
  // v2.3.6c: 耕地红线处分期内不得提拔（警告1年，严重警告1.5年）
  applyPromotionBan(serious ? 18 : 12);
  showRedLetter(html, { force: true, onClose: function(){} });
}

