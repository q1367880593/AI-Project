# Local Research Agent 架构设计

> Version: v1.0
>
> Goal：构建一个本地运行的 Research Agent，每日自动收集指定人物/公司/产品相关新闻，并生成高质量日报。

---

# 一、目标

系统应具备以下能力：

- 自动搜索相关新闻
- 自动抓取正文
- 自动去重
- 自动识别是否属于同一事件
- 自动关联历史新闻
- 自动评估重要程度
- 自动生成日报
- 自动推送通知

整个系统全部可以本地运行。

---

# 二、总体架构

```text
                     Master Agent
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
 Search Agent      Crawl Agent      Analysis Agent
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                    Knowledge Base
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    Daily Report    Weekly Report    Alert Agent
```

整个系统分为四层：

```
采集层

↓

分析层

↓

知识库

↓

输出层
```

---

# 三、整体执行流程

```text
Scheduler

↓

读取配置

↓

Search Agent

↓

Crawler

↓

Analysis Agent

↓

SQLite

↓

Report Agent

↓

Markdown / HTML / Notion / Email
```

---

# 四、各模块职责

---

## Scheduler

负责：

- 每天定时运行
- 遍历所有监控对象
- 调度整个流程

推荐：

- macOS：launchd
- Linux：cron

例如：

每天

08:00

执行：

```
research-agent run
```

---

## Search Agent

职责：

尽可能多地收集相关新闻。

输入：

```
人物：

Elon Musk
```

配置：

```yaml
keywords:
  - Elon Musk
  - Tesla CEO
  - SpaceX CEO
```

搜索来源：

- Google News RSS
- Tavily
- NewsAPI
- Twitter(X)
- Reddit（可选）

输出：

```json
{
  "title":"",
  "url":"",
  "summary":"",
  "published_at":"",
  "source":""
}
```

Search Agent 不负责理解新闻。

---

## Crawl Agent

职责：

抓取正文。

推荐：

- Crawl4AI（本地）
- Firecrawl（云端）
- Jina Reader

输出：

```json
{
    "url":"",
    "markdown":"",
    "title":"",
    "source":"",
    "publish_time":""
}
```

正文统一转换为 Markdown。

---

## Analysis Agent

这是整个系统最重要的模块。

负责：

### 1. 去重

例如：

Reuters：

Tesla launches Robotaxi

CNN：

Tesla unveils Robotaxi

Bloomberg：

Tesla Robotaxi released

↓

识别为：

同一事件。

---

### 2. 事件聚类

多个新闻

↓

一个事件

例如：

```
Tesla Robotaxi正式发布
```

---

### 3. 重要性评分

例如：

```
点赞推文

↓

20分
```

```
财报发布

↓

95分
```

日报按重要程度排序。

---

### 4. 真实性判断

例如：

多个来源均报道：

可信度：

95%

仅一家媒体：

可信度：

40%

---

### 5. 历史关联

例如：

数据库发现：

```
六月：

Robotaxi延期
```

今天：

```
Robotaxi正式上线
```

自动生成：

> 这是延期后的首次正式发布。

---

### 6. 摘要生成

统一输出：

```markdown
## Tesla Robotaxi

摘要：

......

影响：

......

背景：

......

来源：

Reuters

CNN
```

---

# 五、Knowledge Base

推荐：

SQLite

结构：

## news

```sql
id

url

title

content

source

published_at

created_at
```

---

## event

```sql
id

summary

importance

first_seen

last_seen
```

---

## event_news

```sql
event_id

news_id
```

一条事件可以关联多个新闻。

---

## entity（后续）

```sql
id

name

type
```

例如：

```
Elon Musk

Tesla

SpaceX

xAI
```

未来可以扩展知识图谱。

---

# 六、Report Agent

负责：

根据数据库生成日报。

输出：

```markdown
# Daily Report

## ⭐⭐⭐⭐⭐

Tesla Robotaxi正式上线

摘要：

......

来源：

Reuters

CNN

Bloomberg

---

## ⭐⭐⭐⭐

SpaceX完成测试

......

---

## ⭐⭐

X上线新功能

......
```

支持：

- Markdown
- HTML
- PDF
- Email
- Notion
- Obsidian

---

# 七、Alert Agent

监听：

```
importance > 90
```

立即推送：

- 邮件
- Telegram
- 企业微信
- 飞书
- Discord

例如：

```
【重大新闻】

Tesla CEO宣布……

点击查看详情
```

---

# 八、目录结构

```
research-agent/

├── config/
│   ├── people.yaml
│   ├── source.yaml
│   └── prompt.yaml
│
├── agents/
│   ├── scheduler.py
│   ├── search_agent.py
│   ├── crawl_agent.py
│   ├── analysis_agent.py
│   ├── report_agent.py
│   └── alert_agent.py
│
├── crawler/
│   ├── crawl4ai.py
│   └── firecrawl.py
│
├── storage/
│   ├── sqlite.py
│   └── models.py
│
├── reports/
│
├── prompts/
│
├── logs/
│
├── database/
│
├── main.py
│
└── README.md
```

---

# 九、执行流程

```
Scheduler

↓

读取 people.yaml

↓

Search Agent

↓

Google RSS

↓

NewsAPI

↓

Tavily

↓

URL 去重

↓

Crawler

↓

Markdown

↓

Analysis Agent

↓

事件聚类

↓

重要性评分

↓

历史关联

↓

SQLite

↓

Report Agent

↓

日报

↓

Alert Agent（可选）
```

---

# 十、未来可扩展能力

## 多人物监控

例如：

```yaml
people:

- Elon Musk

- Jensen Huang

- Sam Altman

- Faker
```

无需修改代码。

---

## 多语言新闻

增加：

```
language:

- en

- zh

- ja

- ko
```

即可。

---

## RAG

将所有新闻向量化。

支持：

```
过去半年：

马斯克所有关于Robotaxi的新闻
```

Agent 自动回答。

---

## 时间线生成

例如：

```
Robotaxi

2025

↓

2026

↓

2027
```

自动生成 Timeline。

---

## 趋势分析

例如：

```
过去一年：

NVIDIA 新闻热度变化
```

自动绘图。

---

## 自动写公众号

输入：

日报

↓

输出：

公众号文章

---

## 自动生成视频脚本

输入：

日报

↓

输出：

一分钟新闻解说稿。

---

# 十一、设计原则

整个系统遵循以下原则：

1. 搜索与分析分离，避免大模型直接承担搜索任务。
2. Search Agent 负责“找全”，Analysis Agent 负责“看懂”。
3. 所有新闻先入库，再进行分析，保证可追溯性。
4. Agent 之间职责单一，便于独立扩展与测试。
5. 所有输出（日报、周报、告警）均基于统一知识库生成。
6. 优先采用本地可运行组件，降低外部依赖与长期成本。