(function () {
  "use strict";

  var KEY = "golden-road-lang";
  var currentLang = localStorage.getItem(KEY) || "en";
  var applying = false;

  var exact = {
    "How to Play": "玩法说明",
    "Glossary": "术语表",
    "About": "关于",
    "Contact": "联系",
    "Privacy": "隐私",
    "Terms": "条款",
    "Privacy Policy": "隐私政策",
    "Terms of Use": "使用条款",
    "Home": "首页",
    "About scoring": "关于评分",
    "About and scoring": "关于与评分",
    "Play Golden Road LoL": "开始 Golden Road LoL",
    "League Esports Glossary": "英雄联盟电竞术语表",
    "Not affiliated with Riot Games": "与 Riot Games 无官方关联",
    "Fan-made and unofficial. Player, team, region, and event names are used as factual references to public esports history.": "粉丝自制非官方项目。选手、队伍、赛区和赛事名称仅作为公开电竞历史事实引用。",

    "The League esports roster challenge": "英雄联盟电竞阵容挑战",
    "Spin a region, team & year for each role. Draft a 5-player roster from LoL esports history and chase the only perfect season: win": "为每个位置随机赛区、队伍和年份。从 LoL 电竞历史中选出五人阵容，追逐唯一完美赛季：赢下",
    "Start Run": "开始挑战",
    "▸ Start Run": "▸ 开始挑战",
    "MSI Challenge": "MSI 挑战",
    "🔥 MSI Challenge": "🔥 MSI 挑战",
    "NEW · LIMITED EVENT": "新模式 · 限时活动",
    "Tap": "点击",
    "to spin memorable": "来随机经典的",
    "draft one player per position, then run the bracket:": "每个位置选择一名选手，然后模拟赛程：",
    "One Team reroll and one Year reroll.": "拥有一次队伍重随和一次年份重随。",
    "About the challenge": "关于挑战",
    "Golden Road LoL is a strategy draft game for League esports fans. Each run asks you to balance nostalgia, roster knowledge and risk: the wheels pick the team-season, but you decide which player and role belongs on the final five.": "Golden Road LoL 是为英雄联盟电竞粉丝设计的策略选秀游戏。每一次挑战都需要你在情怀、阵容知识和风险之间取舍：轮盘决定队伍赛季，而你决定最终五人中的选手和位置。",
    "The main Golden Road mode follows a full fantasy season. Your drafted lineup plays Split 1, First Stand, Split 2, MSI, Split 3 and Worlds. A perfect run means finishing first at every stop, which is intentionally rare even for elite rosters.": "主 Golden Road 模式会模拟一个完整幻想赛季。你选出的阵容将参加 Split 1、First Stand、Split 2、MSI、Split 3 和 Worlds。完美挑战意味着每一站都拿第一，即使顶级阵容也很难做到。",
    "Strategy notes": "策略提示",
    "Save rerolls for weak team-years.": "把重随机会留给较弱的队伍年份。",
    "A Team reroll can rescue a difficult region-year, while a Year reroll is best when the organization had one legendary season nearby.": "队伍重随可以拯救困难的赛区年份；如果某支队伍附近年份有传奇赛季，年份重随最有价值。",
    "Draft scarce roles early.": "优先锁定稀缺位置。",
    "If a rolled team has a standout Support or Jungle and that position is open, locking it can make later rolls easier.": "如果随机到的队伍有出色的辅助或打野，而且该位置还空着，尽早锁下会让后续更轻松。",
    "Player history matters.": "选手具体年份很重要。",
    "Ratings are hidden and tied to the player in that specific year, so prime seasons are more valuable than name recognition alone.": "评分是隐藏的，并绑定到选手的具体年份，因此巅峰赛季比单纯名气更有价值。",
    "Game modes and scoring": "模式与评分",
    "Golden Road mode uses historical rosters from 2011 through 2025. MSI Challenge uses a curated set of memorable Mid-Season Invitational team-years from 2015 through 2026, excluding the cancelled 2020 event, and runs a shorter bracket simulation.": "Golden Road 模式使用 2011 到 2025 年的历史阵容。MSI 挑战使用 2015 到 2026 年间精选的季中冠军赛经典队伍年份，不包括取消的 2020 年赛事，并模拟更短的淘汰流程。",
    "After five picks, the game averages your hidden player ratings into one Team Rating, then simulates each stage with opponent strength and randomness. Strong rosters improve your odds, but no draft guarantees the Golden Road.": "完成五次选择后，游戏会把隐藏选手评分平均成队伍评分，再结合对手强度和随机性模拟各阶段。强阵容会提高胜率，但没有任何阵容能保证完成 Golden Road。",
    "Learn the rules": "了解规则",
    "New to the format or to League esports? Start with the full How to Play guide for draft rules, rerolls and scoring, then use the glossary to understand regions, events, roles and common competitive terms.": "如果你不熟悉赛制或英雄联盟电竞，可以先阅读完整玩法说明，了解选秀规则、重随和评分，再用术语表理解赛区、赛事、位置和常见比赛术语。",
    "Golden Road LoL is an unofficial fan game. It isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. Player and team names are factual references to public esports history; all ratings and results are fictional.": "Golden Road LoL 是非官方粉丝游戏。它未获得 Riot Games 背书，也不代表 Riot Games 或任何官方参与 Riot Games 作品制作、管理人员的观点。League of Legends 与 Riot Games 是 Riot Games, Inc. 的商标或注册商标。选手和队伍名称仅作为公开电竞历史事实引用；所有评分和结果均为虚构。",

    "For each role, spin": "每个位置依次随机",
    "then draft a player from that team-season.": "然后从该队伍赛季中选择一名选手。",
    "Fill all five positions": "填满五个位置",
    "Each real player can be drafted once.": "每名真实选手每局只能被选择一次。",
    "You get": "你拥有",
    "one reroll each": "各一次重随",
    "for Region, Team & Year. Then your season plays out — chase the Golden Road.": "用于赛区、队伍和年份。随后赛季开始，追逐 Golden Road。",

    "Top": "上路",
    "Jungle": "打野",
    "Mid": "中路",
    "ADC": "下路",
    "Support": "辅助",
    "Region": "赛区",
    "Team": "队伍",
    "Year": "年份",
    "MSI Team": "MSI 队伍",
    "Spinning…": "随机中...",
    "You": "你",
    "pick the player & position — final once chosen.": "选择选手和位置，选定后不可更改。",
    "pick one player from this team — final once chosen.": "从这支队伍中选择一名选手，选定后不可更改。",
    "Open:": "空位：",
    "Already drafted": "已选择",
    "filled": "已填",
    "DRAFT": "选择",
    "Team Rating": "队伍评分",
    "Share": "分享",
    "📲 Share": "📲 分享",
    "Image": "图片",
    "⬇ Image": "⬇ 图片",
    "Post": "发布",
    "𝕏 Post": "𝕏 发布",
    "Play Again": "再玩一次",
    "↻ Play Again": "↻ 再玩一次",
    "RESULTS": "结果",
    "SHARE": "分享",
    "Mid-Season Invitational Mode": "季中冠军赛模式",
    "GOLDEN ROAD COMPLETED": "GOLDEN ROAD 完成",
    "GOLDEN ROAD FAILED": "GOLDEN ROAD 失败",
    "MSI CHAMPION": "MSI 冠军",
    "MSI RUN ENDED": "MSI 挑战结束",
    "Champions": "冠军",
    "Advanced": "晋级",
    "Won bracket": "胜者组取胜",
    "Survived": "存活",
    "Won": "取胜",
    "Runner-up": "亚军",
    "Eliminated": "淘汰",
    "To loser's bracket": "掉入败者组",
    "Bye · won upper": "轮空 · 胜者组获胜",
    "Did not reach": "未到达",
    "Did not qualify": "未晋级",
    "Shared.": "已分享。",
    "Share text copied to clipboard!": "分享文案已复制到剪贴板！",
    "Sharing not supported here — use the Image button.": "这里不支持直接分享，请使用图片按钮。",
    "Choose Save Image to save it to your camera roll.": "选择保存图片即可存入相册。",
    "Image downloaded.": "图片已下载。",
    "X opened — paste the image into your post (⌘/Ctrl+V).": "X 已打开，请将图片粘贴到帖子中（⌘/Ctrl+V）。",
    "X opened — add your saved image to the post.": "X 已打开，请把保存的图片添加到帖子中。",
    "Leave this run and return to the home screen?": "离开本局并返回首页？",
    "No other option available for that reroll.": "这次重随没有其他可用选项。",
    "No other MSI year available for this team.": "这支队伍没有其他可用 MSI 年份。",
    "No other MSI team available for this year.": "这一年没有其他可用 MSI 队伍。",

    "Split 1": "第一赛段",
    "First Stand": "First Stand",
    "Split 2": "第二赛段",
    "Split 3": "第三赛段",
    "Worlds": "全球总决赛",
    "Play-In": "入围赛",
    "Main Stage": "正赛",
    "Upper Bracket": "胜者组",
    "Lower Bracket": "败者组",
    "Grand Final": "总决赛",

    "Split 1 · First Stand · Split 2 · MSI · Split 3 · Worlds — all won. Legendary.": "第一赛段、First Stand、第二赛段、MSI、第三赛段、全球总决赛全部夺冠。传奇。",
    "World champions — but the clean sweep slipped away.": "拿下世界冠军，但全胜之路擦肩而过。",
    "So close to the Worlds stage.": "离全球总决赛舞台只差一步。",
    "The road ends here. Build a stronger roster and run it back.": "道路到此为止。组一套更强阵容再来一次。",
    "Battled up from the loser's bracket and took the Grand Final. MSI Champions.": "从败者组一路杀回并赢下总决赛，成为 MSI 冠军。",
    "Play-In, Main Stage and Grand Final — ran the bracket clean. MSI Champions.": "入围赛、正赛和总决赛一路过关，MSI 冠军。",
    "The run ends here. Draft a stronger five and run it back.": "挑战到此结束。选出更强五人组再来一次。",
    "Knocked out in the Play-In — never reached the main stage.": "在入围赛被淘汰，未能进入正赛。",
    "Eliminated in the Main Stage loser's bracket.": "在正赛败者组被淘汰。",
    "Reached the Grand Final but finished runner-up.": "打进总决赛，但最终获得亚军。",

    "LCS · North America": "LCS · 北美",
    "LEC · Europe": "LEC · 欧洲",
    "LCK · Korea": "LCK · 韩国",
    "LPL · China": "LPL · 中国",
    "LMS · Taiwan": "LMS · 中国台湾",
    "PCS · Pacific": "PCS · 太平洋",
    "VCS · Vietnam": "VCS · 越南",
    "CBLOL · Brazil": "CBLOL · 巴西",
    "LCP · Asia-Pacific": "LCP · 亚太",
    "LJL · Japan": "LJL · 日本",
    "TCL · Türkiye": "TCL · 土耳其",
    "LLA · Latin America": "LLA · 拉丁美洲",
    "LCL · CIS": "LCL · 独联体",

    "About Golden Road LoL": "关于 Golden Road LoL",
    "Contact Golden Road LoL": "联系 Golden Road LoL",
    "Privacy Policy": "隐私政策",
    "League Esports Glossary & Golden Road Explained": "英雄联盟电竞术语表与 Golden Road 解释",
    "How to Play Golden Road LoL": "Golden Road LoL 玩法说明",
    "Back to Golden Road LoL": "返回 Golden Road LoL",
    "Last updated: June 16, 2026.": "最后更新：2026 年 6 月 16 日。",
    "Summary": "摘要",
    "Information stored on your device": "存储在你设备上的信息",
    "Analytics": "分析",
    "Cookies and advertising": "Cookie 与广告",
    "Consent (EEA, UK & Switzerland)": "同意设置（EEA、英国与瑞士）",
    "Your choices (California / CCPA)": "你的选择（加州 / CCPA）",
    "Children": "儿童",
    "Changes": "变更",
    "Email": "邮箱",
    "Discord": "Discord",
    "X": "X",
    "Corrections and feedback": "更正与反馈",
    "Privacy and advertising questions": "隐私与广告问题",
    "About this game": "关于本游戏",
    "Acceptable use": "可接受使用",
    "Advertising": "广告",
    "Intellectual property": "知识产权",
    "How the draft works": "选秀如何运作",
    "Scoring and simulation": "评分与模拟",
    "Data and editorial choices": "数据与编辑取舍",
    "What is Golden Road LoL?": "什么是 Golden Road LoL？",
    "The goal of the game": "游戏目标",
    "How the spin system works": "随机系统如何运作",
    "Building your roster": "组建你的阵容",
    "Rerolls": "重随",
    "Team Rating and results": "队伍评分与结果",
    "Strategy tips": "策略技巧",
    "Common mistakes": "常见错误",
    "FAQ": "常见问题",
    "What is the Golden Road?": "什么是 Golden Road？",
    "Why the Golden Road is so rare": "为什么 Golden Road 如此罕见",
    "Major regions": "主要赛区",
    "Major events": "主要赛事",
    "Player roles": "选手位置",
    "Common League esports terms": "常见英雄联盟电竞术语",
    "How this connects to Golden Road LoL": "这与 Golden Road LoL 的关系"
  };

  var regex = [
    [/^DRAFT · PICK (\d+)\/5$/, "选秀 · 第 $1/5 手"],
    [/^MSI CHALLENGE · PICK (\d+)\/5$/, "MSI 挑战 · 第 $1/5 手"],
    [/^MSI CHALLENGE · RESULTS$/, "MSI 挑战 · 结果"],
    [/^🎲 Reroll Region (\d+)$/, "🎲 重随赛区 $1"],
    [/^🎲 Reroll Team (\d+)$/, "🎲 重随队伍 $1"],
    [/^🎲 Reroll Year (\d+)$/, "🎲 重随年份 $1"],
    [/^Reroll Region (\d+)$/, "重随赛区 $1"],
    [/^Reroll Team (\d+)$/, "重随队伍 $1"],
    [/^Reroll Year (\d+)$/, "重随年份 $1"],
    [/^1 Region · 1 Team · 1 Year reroll per run$/, "每局各有 1 次赛区、队伍、年份重随"],
    [/^1 Team · 1 Year reroll per MSI Challenge run$/, "每局 MSI 挑战有 1 次队伍和 1 次年份重随"],
    [/^(\d+)(st|nd|rd|th) place$/, "第 $1 名"],
    [/^Reached Worlds and finished (\d+)(st|nd|rd|th)\.$/, "进入全球总决赛并获得第 $1 名。"],
    [/^Out at the (.+)\.$/, "止步于 $1。"],
    [/^I built a Team Rating (\d+) roster$/, "我组出了一套队伍评分 $1 的阵容"],
    [/^I built a Team Rating (\d+) MSI Challenge roster$/, "我组出了一套队伍评分 $1 的 MSI 挑战阵容"],
    [/^Worlds: (\d+)(st|nd|rd|th)$/, "全球总决赛：第 $1 名"]
  ];

  var titles = {
    "Golden Road LoL - Build the perfect League esports roster": "Golden Road LoL - 组建完美英雄联盟电竞阵容",
    "About Golden Road LoL": "关于 Golden Road LoL",
    "Contact — Golden Road LoL": "联系 - Golden Road LoL",
    "Privacy Policy — Golden Road LoL": "隐私政策 - Golden Road LoL",
    "Terms of Use — Golden Road LoL": "使用条款 - Golden Road LoL",
    "How to Play Golden Road LoL – Roster Builder Guide": "Golden Road LoL 玩法说明 - 阵容构建指南",
    "League Esports Glossary & Golden Road Explained": "英雄联盟电竞术语表与 Golden Road 解释"
  };

  function clean(s) {
    return String(s).replace(/\s+/g, " ").trim();
  }

  function zh(s) {
    var value = clean(s);
    if (!value) return s;
    if (exact[value]) return exact[value];
    for (var i = 0; i < regex.length; i++) {
      if (regex[i][0].test(value)) return value.replace(regex[i][0], regex[i][1]);
    }
    return s;
  }

  function rememberText(node) {
    if (node.nodeType === 3 && node.parentElement && !node.parentElement.closest("script,style")) {
      if (!node.parentElement.dataset.i18nOrigText) node.parentElement.dataset.i18nOrigText = node.parentElement.textContent;
      if (node._origText == null) node._origText = node.nodeValue;
    }
  }

  function applyText(node) {
    rememberText(node);
    var source = node._origText == null ? node.nodeValue : node._origText;
    if (currentLang !== "zh") {
      node.nodeValue = source;
      return;
    }
    var trimmed = clean(source);
    if (!trimmed) {
      node.nodeValue = source;
      return;
    }
    node.nodeValue = source.replace(trimmed, zh(trimmed));
  }

  function walk(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!clean(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && node.parentElement.closest("script,style,.lang-toggle")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(applyText);
  }

  function applyMeta() {
    document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
    var originalTitle = document.documentElement.dataset.i18nTitle || document.title;
    document.documentElement.dataset.i18nTitle = originalTitle;
    document.title = currentLang === "zh" ? (titles[originalTitle] || zh(originalTitle)) : originalTitle;
  }

  function applyLang() {
    if (applying) return;
    applying = true;
    applyMeta();
    walk(document.body);
    updateButton();
    applying = false;
  }

  function setLang(lang) {
    currentLang = lang;
    localStorage.setItem(KEY, lang);
    applyLang();
  }

  function updateButton() {
    var btn = document.querySelector(".lang-toggle");
    if (!btn) return;
    btn.setAttribute("aria-pressed", currentLang === "zh" ? "true" : "false");
    btn.innerHTML = '<span class="' + (currentLang === "en" ? "active" : "") + '">EN</span><span class="' + (currentLang === "zh" ? "active" : "") + '">中文</span>';
  }

  function installButton() {
    if (document.querySelector(".lang-toggle")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-toggle";
    btn.setAttribute("aria-label", "Switch language");
    btn.addEventListener("click", function () {
      setLang(currentLang === "zh" ? "en" : "zh");
    });
    document.body.appendChild(btn);
  }

  function observe() {
    var observer = new MutationObserver(function (mutations) {
      if (applying || currentLang !== "zh") return;
      var needsApply = mutations.some(function (m) {
        return m.addedNodes && m.addedNodes.length;
      });
      if (needsApply) setTimeout(applyLang, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    installButton();
    applyLang();
    observe();
  });
})();
