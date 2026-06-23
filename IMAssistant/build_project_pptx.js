const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "IMAssistant";
pptx.subject = "AI留资窗口识别项目立项";
pptx.title = "AI留资窗口识别项目立项汇报";
pptx.company = "我爱我家";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "Microsoft YaHei",
  bodyFontFace: "Microsoft YaHei",
  lang: "zh-CN",
};

const C = {
  navy: "17324D",
  blue: "2D6CDF",
  lightBlue: "EAF2FF",
  cyan: "DDF7F6",
  green: "1D8A5A",
  amber: "A86700",
  red: "B42318",
  ink: "1D2733",
  muted: "667085",
  line: "D7DEE8",
  bg: "F6F8FB",
  white: "FFFFFF",
};

function addTitle(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.55, y: 0.35, w: 8.2, h: 0.38,
    fontFace: "Microsoft YaHei", fontSize: 20, bold: true, color: C.navy,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.58, y: 0.78, w: 10.8, h: 0.25,
      fontFace: "Microsoft YaHei", fontSize: 8.5, color: C.muted,
      margin: 0,
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: 0.55, y: 1.08, w: 12.2, h: 0,
    line: { color: C.line, width: 1 },
  });
}

function addFooter(slide, page) {
  slide.addText(`AI留资窗口识别项目立项  ·  ${page}`, {
    x: 0.55, y: 7.15, w: 12.2, h: 0.18,
    fontSize: 7, color: "98A2B3", margin: 0,
  });
}

function card(slide, x, y, w, h, title, body, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: opts.fill || C.white },
    line: { color: opts.line || C.line, width: 1 },
  });
  slide.addText(title, {
    x: x + 0.18, y: y + 0.16, w: w - 0.36, h: 0.28,
    fontSize: opts.titleSize || 11.5, bold: true, color: opts.titleColor || C.navy,
    margin: 0,
  });
  slide.addText(body, {
    x: x + 0.18, y: y + 0.52, w: w - 0.36, h: h - 0.64,
    fontSize: opts.bodySize || 8.8, color: opts.bodyColor || C.ink,
    breakLine: false, fit: "shrink", margin: 0.02,
    valign: "mid",
  });
}

function pill(slide, x, y, text, color, fill) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w: 1.4, h: 0.28,
    rectRadius: 0.12,
    fill: { color: fill },
    line: { color: fill },
  });
  slide.addText(text, {
    x, y: y + 0.055, w: 1.4, h: 0.13,
    align: "center", fontSize: 7.5, bold: true, color, margin: 0,
  });
}

function arrow(slide, x1, y1, x2, y2) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color: C.blue, width: 1.4, beginArrowType: "none", endArrowType: "triangle" },
  });
}

function bullets(slide, items, x, y, w, h, size = 10) {
  slide.addText(items.map(t => ({ text: t, options: { bullet: { type: "ul" } } })), {
    x, y, w, h,
    fontSize: size, color: C.ink,
    breakLine: true, fit: "shrink",
    paraSpaceAfterPt: 6,
    margin: 0,
  });
}

function addTable(slide, rows, x, y, w, h, colW) {
  const rowH = h / rows.length;
  rows.forEach((row, i) => {
    let cx = x;
    row.forEach((text, j) => {
      const cw = colW[j] * w;
      slide.addShape(pptx.ShapeType.rect, {
        x: cx, y: y + i * rowH, w: cw, h: rowH,
        fill: { color: i === 0 ? C.lightBlue : C.white },
        line: { color: C.line, width: 0.75 },
      });
      slide.addText(text, {
        x: cx + 0.08, y: y + i * rowH + 0.07, w: cw - 0.16, h: rowH - 0.14,
        fontSize: i === 0 ? 8.5 : 8,
        bold: i === 0,
        color: i === 0 ? C.navy : C.ink,
        margin: 0.01, fit: "shrink", valign: "mid",
      });
      cx += cw;
    });
  });
}

// 1 cover
{
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: C.bg }, line: { color: C.bg } });
  s.addText("AI 留资窗口识别项目立项", {
    x: 0.72, y: 1.15, w: 8.8, h: 0.62,
    fontSize: 30, bold: true, color: C.navy, margin: 0,
  });
  s.addText("基于用户画像、行为轨迹、房源上下文和 IM 对话的 Agent Workflow", {
    x: 0.76, y: 1.93, w: 9.4, h: 0.32,
    fontSize: 13, color: C.muted, margin: 0,
  });
  card(s, 0.78, 3.0, 3.45, 1.35, "当前状态", "App-服务端-LLM 链路已跑通，已能成功提示留资窗口", { fill: C.white });
  card(s, 4.55, 3.0, 3.45, 1.35, "立项目标", "将经纪人经验判断升级为实时、可解释、可沉淀的智能决策", { fill: C.white });
  card(s, 8.32, 3.0, 3.45, 1.35, "未来规划", "成功留资知识库、智能回复 API、留资卡片与物料推荐", { fill: C.white });
  s.addShape(pptx.ShapeType.arc, { x: 10.8, y: -0.2, w: 3.4, h: 3.4, line: { color: "BBD3FF", transparency: 30, width: 2 }, adjustPoint: 0.3 });
  s.addText("立项评审版", { x: 0.78, y: 6.7, w: 2.2, h: 0.22, fontSize: 9, color: C.muted, margin: 0 });
}

// 2 background
{
  const s = pptx.addSlide();
  addTitle(s, "为什么需要立项：IM 留资是关键转化节点", "留资不是一个简单话术问题，而是找房服务链路从线上兴趣进入线下服务的关键动作");
  card(s, 0.7, 1.45, 3.1, 1.55, "业务链路", "C端浏览房源 → IM咨询 → 经纪人沟通 → 用户留手机号 → 电话/约看/成交", { fill: C.lightBlue });
  card(s, 4.15, 1.45, 3.1, 1.55, "核心矛盾", "用户意向、信任和问题处理状态不断变化，经纪人需要判断何时开口最自然", { fill: "FFF7E8", titleColor: C.amber });
  card(s, 7.6, 1.45, 3.1, 1.55, "当前问题", "时机不稳定、机会易错过、上下文利用不足、话术质量不均", { fill: "FFF1F0", titleColor: C.red });
  arrow(s, 3.82, 2.22, 4.05, 2.22);
  arrow(s, 7.27, 2.22, 7.5, 2.22);
  addTable(s, [
    ["问题", "具体表现", "影响"],
    ["过早索要", "问题未回答、信任未建立就要手机号", "用户沉默或拒绝"],
    ["窗口错过", "用户已询问看房但未被及时承接", "高意向线索流失"],
    ["信息分散", "画像、轨迹、房源、对话散落多系统", "经纪人判断负担高"],
  ], 0.7, 3.55, 11.95, 2.45, [0.18, 0.47, 0.35]);
  addFooter(s, 2);
}

// 3 value logic
{
  const s = pptx.addSlide();
  addTitle(s, "完整逻辑链：从业务问题推导项目价值", "价值来自把经验型留资判断转化为可计算、可解释、可优化的 Agent Workflow");
  const steps = [
    ["1", "业务增长依赖 IM 留资", "手机号是电话沟通、约看和成交的入口"],
    ["2", "留资依赖合适窗口期", "过早打扰，过晚错过"],
    ["3", "窗口期依赖多源上下文", "画像 + 行为 + 房源 + 对话"],
    ["4", "上下文需要 Agent 记忆", "持续累计并实时分析"],
    ["5", "判断要转成可执行动作", "提示经纪人怎么说、何时说"],
    ["6", "反馈沉淀形成资产", "知识库、策略、模型持续优化"],
  ];
  steps.forEach((st, i) => {
    const x = 0.65 + (i % 3) * 4.15;
    const y = 1.45 + Math.floor(i / 3) * 2.1;
    card(s, x, y, 3.55, 1.28, st[1], st[2], { fill: C.white });
    pill(s, x + 0.16, y + 0.14, st[0], C.white, C.blue);
    if (i % 3 !== 2) arrow(s, x + 3.62, y + 0.64, x + 3.98, y + 0.64);
  });
  card(s, 1.2, 5.95, 10.9, 0.65, "价值结论", "将“凭经验判断要电话时机”升级为“基于多源上下文的实时智能决策”，提升留资转化并降低用户打扰。", { fill: C.lightBlue, titleSize: 10, bodySize: 9.2 });
  addFooter(s, 3);
}

// 4 value
{
  const s = pptx.addSlide();
  addTitle(s, "项目价值：对用户、经纪人、平台形成共同增益", "不是只做一个 AI 回复功能，而是建设 IM 转化链路中的智能决策能力");
  const values = [
    ["用户价值", "减少生硬索要手机号；在约看、确认、推荐等自然场景中被承接", "拒绝率、沉默率、投诉率"],
    ["经纪人价值", "实时获得阶段、留资分、风险点和建议策略，降低经验门槛", "采纳率、响应效率、留资成功率"],
    ["平台价值", "沉淀可复用的留资判断能力和数据资产", "IM留资率、提示后留资率、带看转化"],
    ["运营/算法价值", "可观察不同场景的转化规律，支持知识库和策略迭代", "策略命中率、标注效率、模型迭代周期"],
  ];
  values.forEach((v, i) => {
    const x = 0.75 + (i % 2) * 6.05;
    const y = 1.45 + Math.floor(i / 2) * 2.25;
    card(s, x, y, 5.55, 1.75, v[0], `${v[1]}\n\n衡量：${v[2]}`, { fill: i % 2 === 0 ? C.lightBlue : C.cyan, bodySize: 8.8 });
  });
  addFooter(s, 4);
}

// 5 current state
{
  const s = pptx.addSlide();
  addTitle(s, "当前建设现状：第一阶段链路已验证", "已通过 App-服务端-LLM 完成留资窗口识别，并具备实时监控能力");
  card(s, 0.7, 1.35, 2.45, 1.25, "1. 数据上传", "用户行为、画像、房源上下文、用户/经纪人消息累计上传", { fill: C.white });
  arrow(s, 3.18, 1.98, 3.58, 1.98);
  card(s, 3.65, 1.35, 2.45, 1.25, "2. Agent 记忆", "按 conversation_id 维护会话上下文", { fill: C.white });
  arrow(s, 6.12, 1.98, 6.52, 1.98);
  card(s, 6.6, 1.35, 2.45, 1.25, "3. LLM 分析", "识别阶段、留资分、置信度、风险标记", { fill: C.white });
  arrow(s, 9.08, 1.98, 9.48, 1.98);
  card(s, 9.55, 1.35, 2.45, 1.25, "4. B端提示", "SSE 推送窗口期结果，支持 H5 监控", { fill: C.white });
  addTable(s, [
    ["已具备能力", "说明"],
    ["累计上下文", "同一会话下持续合并画像、轨迹、房源和消息"],
    ["窗口识别", "已能成功提示留资窗口，并输出原因和建议策略"],
    ["实时推送", "B端通过流式订阅获取最新 analysis 事件"],
    ["可视化监控", "可查看画像、聊天记录、留资分和当前状态"],
  ], 0.75, 3.15, 11.75, 2.6, [0.25, 0.75]);
  addFooter(s, 5);
}

// 6 workflow
{
  const s = pptx.addSlide();
  addTitle(s, "工作流设计：增量上传 + Agent 记忆 + 流式推送", "每次会话上下文变化都会触发重新分析，并推送给正在订阅的 B 端");
  const nodes = [
    ["C端/IM", "画像、行为、消息"],
    ["Agent记忆", "合并上下文"],
    ["LLM分析", "阶段/意图/风险"],
    ["规则兜底", "留资分/风控/版本"],
    ["B端", "提示卡/轻提示/风险提醒"],
  ];
  nodes.forEach((n, i) => {
    const x = 0.65 + i * 2.5;
    card(s, x, 1.65, 2.0, 1.2, n[0], n[1], { fill: i === 4 ? C.lightBlue : C.white, bodySize: 8.2 });
    if (i < nodes.length - 1) arrow(s, x + 2.04, 2.24, x + 2.42, 2.24);
  });
  addTable(s, [
    ["前后端时序", "关键说明"],
    ["B端先订阅", "进入聊天页后建立 /agent/window/stream?conversation_id=xxx"],
    ["C端/IM持续上传", "每个行为或消息通过 /agent/conversation/update 增量写入"],
    ["Agent实时分析", "合并上下文后调用 LLM，再做规则兜底和风险拦截"],
    ["主动推送", "分析完成后通过 SSE 向 B端推送 analysis 事件"],
  ], 0.8, 3.65, 11.6, 2.35, [0.28, 0.72]);
  addFooter(s, 6);
}

// 7 current scope
{
  const s = pptx.addSlide();
  addTitle(s, "本期建设范围：把窗口识别闭环做稳", "一期重点是让判断稳定、可解释、可观测、可接入");
  const items = [
    ["Agent上下文记忆", "累计用户画像、浏览轨迹、房源上下文和对话历史"],
    ["留资窗口识别", "识别用户阶段、计算留资分、输出是否提示经纪人"],
    ["B端实时接收", "通过流式传输获取最新窗口期判断"],
    ["可视化监控", "按会话查看状态、画像、聊天记录和分析结果"],
    ["基础风控", "拒绝、费用顾虑未处理、流失风险场景不触发强提示"],
  ];
  items.forEach((it, i) => {
    const x = 0.75 + (i % 2) * 5.95;
    const y = 1.35 + Math.floor(i / 2) * 1.65;
    card(s, x, y, 5.45, 1.15, it[0], it[1], { fill: i === 4 ? "FFF7E8" : C.white, bodySize: 8.7 });
  });
  addFooter(s, 7);
}

// 8 future plan
{
  const s = pptx.addSlide();
  addTitle(s, "未来规划：从“识别窗口”升级为“推荐话术和动作”", "下一阶段重点是知识库、智能回复 API、卡片与物料动作推荐");
  card(s, 0.75, 1.35, 3.55, 3.9, "成功留资对话知识库", "沉淀成功留资前 3-5 轮对话、触发信号、成功话术、成功原因和禁忌表达。\n\n价值：让 AI 回复更接近优秀经纪人的真实成功表达。", { fill: C.lightBlue, bodySize: 8.6 });
  card(s, 4.9, 1.35, 3.55, 3.9, "智能回复 API 接入", "Agent 负责判断窗口期、提供策略和上下文；公司职能部门 API 负责生成最终话术。\n\n价值：复用公司已有规范能力，降低重复建设。", { fill: C.cyan, bodySize: 8.6 });
  card(s, 9.05, 1.35, 3.55, 3.9, "卡片/物料动作推荐", "让 AI 判断何时推荐留资卡片、约看卡片、房源报告、户型报告、相似房源。\n\n价值：从“说什么”升级为“做什么”。", { fill: "FFF7E8", bodySize: 8.6 });
  addFooter(s, 8);
}

// 9 roadmap
{
  const s = pptx.addSlide();
  addTitle(s, "里程碑：分阶段交付、持续数据闭环", "先完成窗口识别闭环，再扩展知识库和动作推荐");
  const phases = [
    ["阶段一", "留资窗口识别闭环", "上下文累计、LLM判断、B端订阅、H5监控"],
    ["阶段二", "知识库增强", "成功留资对话标注、向量检索、范例召回"],
    ["阶段三", "工具/物料推荐", "留资卡片、约看卡片、房源/户型报告推荐"],
    ["阶段四", "数据闭环优化", "采纳/修改/忽略/留资回流，优化策略和模型"],
  ];
  phases.forEach((p, i) => {
    const x = 0.8 + i * 3.05;
    card(s, x, 1.65, 2.55, 3.7, p[0], `${p[1]}\n\n${p[2]}`, { fill: i === 0 ? C.lightBlue : C.white, bodySize: 8.5 });
    if (i < phases.length - 1) arrow(s, x + 2.58, 3.45, x + 2.95, 3.45);
  });
  addFooter(s, 9);
}

// 10 conclusion
{
  const s = pptx.addSlide();
  addTitle(s, "结论：立项价值明确，具备继续产品化基础", "当前链路已验证，下一步应围绕效果提升和动作扩展继续建设");
  card(s, 0.85, 1.35, 11.5, 1.3, "立项判断", "本项目将 IM 留资这一高度依赖经纪人经验的关键转化动作，升级为基于多源上下文的 Agent Workflow，具备明确业务价值和可持续优化空间。", { fill: C.lightBlue, titleSize: 12, bodySize: 10 });
  bullets(s, [
    "短期：稳定识别留资窗口，帮助经纪人把握合适时机。",
    "中期：接入成功案例知识库和智能回复 API，提升回复质量和规范性。",
    "长期：结合留资卡片、房源报告、户型报告等物料，实现“话术 + 工具”的智能推荐。",
    "最终：形成可沉淀、可评估、可持续优化的 IM 转化能力。"
  ], 1.1, 3.05, 10.9, 2.5, 13);
  s.addText("建议进入小范围试点，围绕 IM 留资率、提示采纳率、用户拒绝率和提示后留资率进行评估。", {
    x: 1.1, y: 6.2, w: 10.5, h: 0.32,
    fontSize: 12, bold: true, color: C.navy, margin: 0,
  });
  addFooter(s, 10);
}

pptx.writeFile({ fileName: "AI留资窗口识别项目立项汇报.pptx" });
