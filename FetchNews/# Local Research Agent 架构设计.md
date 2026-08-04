# Local Research Agent 架构设计

> 版本：v1.1（方案完善稿）
>
> 状态：待实现
>
> 核心目标：在本地定时收集指定人物、公司或产品的相关新闻，经去重、聚类和分析后，输出**中文 Markdown 日报**。
>
> MVP 原则：先稳定产出可信、可追溯的中文 Markdown，再扩展推送、周报、RAG 和知识图谱。

---

## 1. 目标与边界

### 1.1 核心目标

系统每天自动完成以下流程：

1. 按监控对象和关键词发现新闻。
2. 抓取正文并转换为 Markdown 文本。
3. 规范化 URL、去除重复文章、聚合同一事件。
4. 生成中文标题、摘要、影响分析和背景信息。
5. 按重要性排序，生成一份 UTF-8 编码的中文 Markdown 日报。
6. 保存原始来源、处理状态和运行记录，支持追溯与重跑。

### 1.2 MVP 范围

| 能力 | MVP | 后续版本 |
| --- | --- | --- |
| 搜索来源 | Google News RSS，可选 NewsAPI/Tavily | 社交媒体、行业数据库 |
| 正文抓取 | Jina Reader + 直接网页抓取降级 | 浏览器渲染、站点专用适配器 |
| 分析 | 文章去重、事件聚类、评分、中文摘要 | 趋势分析、观点与情绪分析 |
| 存储 | SQLite | PostgreSQL、向量数据库 |
| 输出 | 中文 Markdown 日报 | HTML、PDF、邮件、Notion |
| 调度 | CLI + cron/launchd | 服务化任务队列、Web 管理台 |
| 告警 | 仅记录高重要性事件 | 飞书、企业微信、Telegram |

### 1.3 非目标

MVP 不承诺：

- 绕过登录、付费墙、验证码或网站反爬机制。
- 对新闻真实性作绝对判断；系统只给出基于来源证据的可信度等级。
- 自动转载完整版权正文；数据库保存正文仅用于本地分析，报告只输出摘要和来源链接。
- 完全离线运行。SQLite 和分析模型可在本地运行，但新闻搜索、网页抓取天然依赖网络。

---

## 2. 设计原则

1. **中文优先**：面向用户的标题、摘要、分析、标签和提示统一使用简体中文。
2. **Markdown 唯一主输出**：MVP 只定义 Markdown 报告契约，其他格式由 Markdown 派生。
3. **事实与分析分离**：明确区分已报道事实、模型推断和未知信息。
4. **来源可追溯**：每个事件至少关联一条来源链接，重要结论能回溯到原文。
5. **规则优先、模型增强**：URL 规范化、状态流转等确定性任务使用代码；语义聚类与摘要使用模型。
6. **幂等可恢复**：同一任务重复执行不重复入库，失败阶段可单独重试。
7. **渐进式本地化**：优先本地数据库和本地模型，同时允许配置兼容 API。
8. **配置与代码分离**：监控对象、来源、模型、评分权重和输出语言均由配置控制。

---

## 3. 总体架构

```text
Scheduler / CLI
      │
      ▼
Search Providers ──► Candidate Collector
      │                       │
      │                       ▼
      └──────────────► URL Normalizer / Deduplicator
                              │
                              ▼
                    Crawl Providers / Extractor
                              │
                              ▼
                  Quality Gate / Language Detector
                              │
                              ▼
              Event Cluster / Score / Chinese Writer
                              │
                              ▼
                           SQLite
                              │
                              ▼
                  Chinese Markdown Renderer
                              │
                              ▼
              reports/{target}/{date}.md
```

系统按职责划分为五层：

- **调度层**：创建运行批次，控制阶段顺序、重试和退出码。
- **采集层**：搜索候选新闻、规范化 URL、抓取正文。
- **分析层**：相关性判断、去重、事件聚类、评分和中文生成。
- **存储层**：保存新闻、监控对象、事件、关联关系和运行状态。
- **输出层**：按固定契约渲染中文 Markdown 日报。

“Agent”是逻辑职责，不要求每一步都调用大模型。MVP 建议采用一个 Python 进程中的模块化流水线，避免过早引入多 Agent 编排框架。

---

## 4. 端到端处理流程

```text
创建 run
  ↓
加载并校验配置
  ↓
逐个监控对象搜索候选新闻
  ↓
URL 规范化 + URL/标题指纹去重
  ↓
候选文章入库（discovered）
  ↓
抓取正文（crawled / crawl_failed）
  ↓
正文质量门禁 + 相关性判断
  ↓
跨来源文章去重 + 事件聚类
  ↓
生成中文事件信息并评分
  ↓
事件及证据关联入库
  ↓
渲染中文 Markdown 日报
  ↓
原子写入文件 + 记录 run 结果
```

### 4.1 文章状态

```text
discovered
   ├──► crawled ──► analyzed
   ├──► crawl_failed ──► crawled（重试成功）
   └──► ignored（无关、低质量或不支持）
```

每条记录保存 `status`、`attempt_count`、`last_error` 和 `updated_at`。失败不能阻断整个日报：可用摘要降级分析，并在报告元数据中记录采集不完整。

### 4.2 幂等规则

- `run` 使用 `run_date + target_id + pipeline_version` 作为逻辑唯一键。
- 新闻使用规范化后的 `canonical_url_hash` 做第一层去重。
- 对 URL 不同但正文相同的转载，使用 `content_hash` 做第二层去重。
- 一个新闻可关联多个监控对象，不能把 `target_name` 直接绑定为新闻唯一归属。
- 事件按 `event_fingerprint` 查找已有事件；同一事件的新报道更新 `last_seen_at`，不重复创建事件。
- 报告先写入同目录临时文件，再原子替换目标文件，避免生成半份报告。

---

## 5. 模块设计

### 5.1 Scheduler / CLI

职责：

- 校验配置和运行环境。
- 创建运行批次并按阶段调度。
- 限制并发、处理超时、退避重试。
- 支持完整运行及分阶段重跑。
- 输出结构化日志和明确退出码。

建议命令：

```bash
research-agent run
research-agent run --target "Elon Musk" --date 2026-08-04
research-agent search --target "Elon Musk"
research-agent crawl --retry-failed
research-agent analyze --target "Elon Musk" --date 2026-08-04
research-agent report --target "Elon Musk" --date 2026-08-04
research-agent doctor
```

`doctor` 用于检查配置、数据库写入权限、模型连接和各新闻源可用性。

### 5.2 Search Agent

职责是“尽量找全”，不负责写摘要或判断事件。

统一输入：

```yaml
target_id: elon_musk
target_name: Elon Musk
keywords:
  - Elon Musk
  - 马斯克
languages: [en, zh]
since: "2026-08-03T08:00:00+08:00"
until: "2026-08-04T08:00:00+08:00"
```

统一输出字段：

```json
{
  "provider": "google_news_rss",
  "query": "Elon Musk",
  "title": "原始标题",
  "url": "https://example.com/news/1",
  "snippet": "搜索结果摘要",
  "source_name": "Reuters",
  "published_at": "2026-08-04T01:20:00Z",
  "discovered_at": "2026-08-04T08:01:00+08:00",
  "raw_payload": {}
}
```

要求：

- 所有来源通过统一 Provider 接口接入。
- 保存查询词和原始响应，便于排错。
- 分页数量、时间窗口、单来源上限和超时均可配置。
- URL 进入数据库前移除常见跟踪参数，解析重定向并生成规范 URL。

### 5.3 Crawl Agent

抓取策略按优先级执行：

1. 直接请求并提取正文。
2. Jina Reader 等阅读器服务。
3. 可选的浏览器渲染或站点适配器。
4. 全部失败时使用搜索摘要降级，并标记 `content_quality=snippet_only`。

统一输出：

```json
{
  "canonical_url": "https://example.com/news/1",
  "title_original": "Original title",
  "content_markdown": "正文 Markdown",
  "author": "作者",
  "source_name": "媒体名称",
  "published_at": "2026-08-04T01:20:00Z",
  "language": "en",
  "word_count": 1234,
  "content_quality": "full",
  "extractor": "direct",
  "fetched_at": "2026-08-04T08:03:00+08:00"
}
```

质量门禁至少检查：正文非空、字符数、标题存在、错误页关键词、重复导航占比和发布时间合理性。

### 5.4 Analysis Agent

分析顺序不能颠倒：

1. **相关性判断**：新闻是否真正涉及监控对象，而非仅在推荐列表或模板中出现。
2. **文章去重**：合并同 URL、相同正文和高度相似转载，但保留全部来源证据。
3. **事件聚类**：将多篇报道归入同一现实事件。
4. **事件续接**：与近 30 天已有事件匹配，决定新建或更新。
5. **中文生成**：生成中文标题、事实摘要、影响和背景。
6. **评分**：根据规则和证据计算重要性、可信度。

模型必须返回可校验的结构化 JSON，校验失败时最多重试一次；再次失败则采用规则降级，禁止将未校验的自由文本直接写入数据库。

建议事件结构：

```json
{
  "title_zh": "特斯拉公布新一轮自动驾驶计划",
  "summary_zh": "特斯拉于……。目前已确认……。",
  "impact_zh": "该计划可能影响……",
  "background_zh": "此前公司曾……",
  "topics": ["特斯拉", "自动驾驶"],
  "importance": 82,
  "credibility": 88,
  "confidence_note_zh": "两家独立主流媒体报道，关键细节一致",
  "article_ids": [12, 18]
}
```

### 5.5 Report Agent

职责：读取已落库事件并按固定模板渲染，不在渲染阶段重新调用模型。

- 默认时区：`Asia/Shanghai`。
- 文件编码：UTF-8。
- 排序：`importance DESC, credibility DESC, published_at DESC`。
- 输出路径：`reports/{target_slug}/{YYYY-MM-DD}.md`。
- 同一天重复生成覆盖同一路径，并在 Front Matter 更新生成时间。
- 无有效新闻也要生成报告，明确写出“今日未发现符合条件的重要新闻”。

---

## 6. 中文 Markdown 输出契约

### 6.1 中文生成规则

- 标题、摘要、影响、背景、标签和状态说明必须使用简体中文。
- 人名、公司名、产品名首次出现时采用常见中文名；有歧义时写为“中文名（英文名）”。
- 不强行翻译品牌、股票代码、技术标准和没有公认译名的专有名词。
- 时间统一转换为北京时间，并在报告中标注时区。
- 数字、货币和单位保留原始含义，必要时补充中文解释，不擅自换算。
- 摘要只陈述来源支持的事实；推断必须使用“可能”“预计”“尚待确认”等限定词。
- 来源意见冲突时并列呈现，不得替用户裁决。
- 不把搜索摘要伪装成完整正文；降级来源应标注“仅检索摘要”。

### 6.2 文件规范

每份日报必须包含 YAML Front Matter：

```yaml
---
title: "Elon Musk 新闻日报｜2026-08-04"
date: "2026-08-04"
timezone: "Asia/Shanghai"
language: "zh-CN"
target: "Elon Musk"
generated_at: "2026-08-04T08:15:30+08:00"
pipeline_version: "1.1"
event_count: 3
source_count: 8
partial: false
---
```

正文固定结构：

```markdown
# Elon Musk 新闻日报｜2026-08-04

> 统计区间：2026-08-03 08:00 至 2026-08-04 08:00（北京时间）
>
> 共收录 3 个事件、8 个来源。

## 今日要点

- 特斯拉公布……
- SpaceX 完成……

## 重点事件

### 1. 特斯拉公布新一轮自动驾驶计划

**重要性：** 82/100（高）

**可信度：** 88/100（较高）

**发布时间：** 2026-08-04 07:20（北京时间）

**事件摘要**

特斯拉于……。目前已确认……。

**影响分析**

该计划可能影响……。

**背景关联**

此前公司曾……。

**来源**

- [Reuters：原始标题](https://example.com/1) — 2026-08-04 07:20
- [公司公告：原始标题](https://example.com/2) — 2026-08-04 06:55

## 其他动态

- ……

## 采集说明

- 本报告由自动化流程生成，重要信息请以原始来源为准。
- 2 个页面抓取失败，其中 1 条使用检索摘要分析。
```

### 6.3 重要性与可信度

重要性是“对监控目标的影响程度”，不是热度。建议由以下维度加权：

| 维度 | 权重 | 示例 |
| --- | ---: | --- |
| 事件影响 | 35% | 财报、融资、监管、重大产品发布 |
| 与目标相关性 | 25% | 目标是事件主体，而非顺带提及 |
| 新颖性 | 15% | 新进展高于重复报道 |
| 影响范围 | 15% | 跨行业、跨地区或长期影响 |
| 时效性 | 10% | 统计窗口内新发生或有实质更新 |

可信度反映证据质量，建议考虑：

- 官方一手来源或监管文件。
- 独立来源数量，而非转载数量。
- 来源历史可靠性。
- 多来源关键事实是否一致。
- 是否只有匿名消息、搜索摘要或未经证实的社交内容。

分档建议：`90–100 很高`、`75–89 较高`、`60–74 一般`、`0–59 待核实`。报告展示分数和等级，但不得使用“真实性 95%”这类暗示数学精确性的表述。

---

## 7. 数据模型

原设计把 `person_name` 直接放在 `news` 中，会导致同一篇文章无法自然关联多个对象；事件表也缺少稳定标题、状态和更新时间。MVP 建议使用以下实体：

### 7.1 核心表

```text
target
  id, slug, name, type, enabled, created_at, updated_at

target_keyword
  id, target_id, keyword, language, enabled

news
  id, canonical_url, canonical_url_hash, title_original,
  content_markdown, content_hash, source_name, author,
  language, published_at, discovered_at, fetched_at,
  content_quality, status, attempt_count, last_error, raw_payload

target_news
  target_id, news_id, query, relevance_score, is_relevant

event
  id, event_fingerprint, title_zh, summary_zh, impact_zh,
  background_zh, importance, credibility, confidence_note_zh,
  status, first_seen_at, last_seen_at, updated_at

event_news
  event_id, news_id, evidence_role

target_event
  target_id, event_id

run
  id, run_date, target_id, pipeline_version, status,
  started_at, finished_at, discovered_count, crawled_count,
  event_count, error_count, report_path
```

### 7.2 关键约束

- `target.slug` 唯一。
- `news.canonical_url_hash` 唯一。
- `target_news(target_id, news_id)` 联合唯一。
- `event.event_fingerprint` 建索引，但允许人工合并后的别名映射。
- `event_news(event_id, news_id)` 联合唯一并启用外键。
- 所有时间在数据库中保存带时区的 ISO 8601；展示时转换为北京时间。
- 数据库启用 `WAL`、`foreign_keys=ON` 和合理的 `busy_timeout`。
- 数据结构变更使用迁移脚本，不能只依赖启动时 `CREATE TABLE IF NOT EXISTS`。

---

## 8. 配置设计

建议合并为一份主配置，并通过环境变量保存密钥：

```yaml
app:
  timezone: Asia/Shanghai
  output_language: zh-CN
  report_dir: reports
  database_url: sqlite:///database/research.db

targets:
  - slug: elon_musk
    name: Elon Musk
    type: person
    enabled: true
    keywords:
      en: [Elon Musk, Tesla CEO, SpaceX CEO, xAI]
      zh: [马斯克, 特斯拉 CEO, SpaceX]

search:
  window_hours: 24
  per_query_limit: 20
  providers:
    google_news_rss:
      enabled: true
    newsapi:
      enabled: false

crawler:
  concurrency: 5
  timeout_seconds: 20
  max_retries: 2
  min_content_chars: 300

analysis:
  provider: ollama
  model: qwen2.5:7b
  output_language: zh-CN
  event_lookback_days: 30
  prompt_version: v1

report:
  importance_threshold: 40
  top_story_count: 5
  include_collection_notes: true
```

密钥只从 `NEWSAPI_KEY`、`TAVILY_API_KEY`、`OPENAI_API_KEY` 等环境变量读取，不能写入 YAML 或日志。

---

## 9. 目录结构

```text
fetch-news/
├── pyproject.toml
├── README.md
├── config/
│   ├── config.example.yaml
│   └── prompts/
│       ├── cluster_v1.yaml
│       └── summarize_zh_v1.yaml
├── src/fetch_news/
│   ├── cli.py
│   ├── scheduler.py
│   ├── domain/
│   │   ├── models.py
│   │   └── enums.py
│   ├── search/
│   │   ├── base.py
│   │   └── google_news.py
│   ├── crawl/
│   │   ├── base.py
│   │   ├── direct.py
│   │   └── jina.py
│   ├── analysis/
│   │   ├── relevance.py
│   │   ├── dedup.py
│   │   ├── clustering.py
│   │   ├── scoring.py
│   │   └── chinese_writer.py
│   ├── reports/
│   │   ├── renderer.py
│   │   └── templates/daily_zh.md.j2
│   └── storage/
│       ├── database.py
│       └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── database/
├── reports/
└── logs/
```

运行数据目录应加入 `.gitignore`，只提交示例配置、模板和匿名化测试样本。

---

## 10. 异常处理与可观测性

### 10.1 重试与降级

- HTTP `429`、`5xx`、连接超时：指数退避并加入随机抖动。
- `401/403`、配置错误：不盲目重试，记录明确错误。
- 单篇抓取失败：使用搜索摘要降级，不中断其他文章。
- 单个来源失败：继续其他来源并将报告标记为 `partial: true`。
- 模型不可用：允许只生成来源清单和抽取式中文/原文摘要，报告注明降级模式。
- 数据库或报告写入失败：整次运行标记失败并返回非零退出码。

### 10.2 日志与指标

日志至少包含 `run_id`、`target_id`、`stage`、`provider`、`news_id`、耗时和错误类型，禁止记录 API Key 与大段正文。

建议统计：

- 每个来源的发现数、成功率和延迟。
- 抓取成功率、正文质量分布、降级数量。
- 去重前后文章数、事件数、模型调用次数与失败率。
- 日报生成耗时、事件数、来源覆盖率。

---

## 11. 安全、合规与内容质量

- 遵守站点条款、robots 约束、请求频率限制和版权要求。
- 报告只保留必要引文、摘要和链接，不对外分发完整抓取正文。
- 所有外部正文都视为不可信输入；提示词必须防范网页中的指令注入。
- 模型无权执行网页中的命令、修改配置或访问密钥。
- 对 URL、文件名和 Markdown 内容进行清洗，防止路径穿越和恶意链接格式破坏报告。
- 对政治、金融、健康等高风险主题明确标注来源与不确定性。

---

## 12. 测试与验收标准

### 12.1 测试策略

- **单元测试**：URL 规范化、指纹、状态流转、评分、时间转换、Markdown 转义。
- **契约测试**：各搜索/抓取 Provider 输出满足统一 Schema。
- **集成测试**：使用固定网页样本完成搜索结果入库、抓取、分析和报告生成。
- **快照测试**：中文日报结构与模板变更可审查。
- **故障测试**：模拟超时、429、空正文、非法模型 JSON 和数据库锁。

### 12.2 MVP 验收

满足以下条件才视为可用：

1. 对至少 3 个监控对象连续运行 7 天，无需人工修复任务状态。
2. 同一日期和对象重复运行，不产生重复新闻、重复事件或重复报告。
3. 日报文件均为 UTF-8，标题、摘要、影响和背景为简体中文。
4. 每个纳入报告的事件至少有一条可点击来源链接。
5. 100 条人工标注样本中，相关新闻召回率目标不低于 80%，明显无关内容比例低于 10%。
6. 抓取失败或模型不可用时仍能生成结构合法、明确标注降级状态的报告。
7. 日报不出现模型返回的裸 JSON、提示词、堆栈信息或密钥。
8. 时间统一按 `Asia/Shanghai` 展示，统计窗口清晰可见。

---

## 13. 实施路线

### 阶段一：最小闭环

- 建立配置校验、SQLite 迁移和运行批次。
- 接入 Google News RSS。
- 实现 URL 规范化、直接抓取和 Jina 降级。
- 实现基础相关性判断、去重和中文 Markdown 模板。
- 用固定样本完成端到端测试。

### 阶段二：质量提升

- 增加事件聚类、事件续接、重要性和可信度评分。
- 增加结构化模型输出校验、提示词版本管理和降级策略。
- 建立人工标注集，测量召回率与无关内容比例。

### 阶段三：稳定运行

- 配置 cron/launchd、结构化日志和失败告警。
- 增加 NewsAPI/Tavily 等备用来源。
- 完成 7 天稳定性验收和数据备份策略。

### 阶段四：可选扩展

- 从 Markdown 派生 HTML、PDF、邮件和 Notion 页面。
- 增加周报、趋势、时间线、RAG 和向量检索。
- 在确有规模需求时再引入任务队列或服务化部署。

---

## 14. 架构决策摘要

| 决策 | 选择 | 原因 |
| --- | --- | --- |
| 主输出 | 中文 Markdown | 可读、可版本化、适配 Obsidian/静态站点，并可派生其他格式 |
| MVP 运行形态 | 单进程模块化流水线 | 部署简单，足以覆盖每日个人研究任务 |
| 主数据库 | SQLite | 本地零运维；通过 WAL、迁移和约束保证可靠性 |
| 模型职责 | 语义判断与中文写作 | 不让模型承担确定性的状态和数据一致性逻辑 |
| 新闻与对象关系 | 多对多 | 同一新闻可能同时涉及人物、公司和产品 |
| 事件处理 | 聚类后持续更新 | 同一事件可能跨日发展，不能每天重复创建 |
| 失败策略 | 局部重试、整体可降级 | 单一来源或文章失败不应阻断日报 |

这套方案的首要成功标准不是“接入多少 Agent”，而是每天稳定生成一份**中文清晰、来源可点、事实可查、失败可解释**的 Markdown 新闻日报。
