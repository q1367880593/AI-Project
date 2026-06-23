# 历史爱聊数据 AI 分析指导文档

## 1. 分析目标

本次分析的目标，是通过历史爱聊 IM 会话数据，找出：

1. 什么情况下用户留资率更高。
2. 什么情况下用户留资率更低。
3. 经纪人第几轮引导留资效果更好。
4. 哪些用户信号、经纪人动作、留资理由、工具物料会影响留资结果。
5. 哪些成功对话可以沉淀为知识库，供后续 AI 生成回复和推荐动作时参考。

最终要支撑的业务结论是：

> 留资窗口不是主观经验判断，而是可以基于历史会话数据，通过用户阶段、会话轮次、触发信号、经纪人动作和留资理由分析出来，并进一步产品化为实时 AI Agent 能力。

## 2. 数据范围建议

### 2.1 时间范围

建议优先使用最近完整 3 个月数据：

```text
2026-03-01 00:00:00 至 2026-05-31 23:59:59
```

如样本量不足，可扩展到：

```text
2026-01-01 00:00:00 至 2026-05-31 23:59:59
```

### 2.2 业务线范围

第一阶段优先分析：

```text
租房业务线
```

暂不纳入：

1. 二手买卖。
2. 新房。
3. 商办。
4. 客服、投诉、售后类会话。
5. 已留资后的后续服务会话。

### 2.3 入口范围

优先纳入用户从以下入口主动发起的爱聊会话：

```text
房源详情页经纪人展位
房源详情页咨询按钮
房源列表咨询按钮
```

暂不纳入：

1. 纯客服入口。
2. 活动页入口。
3. 系统消息触发会话。
4. 经纪人主动发起会话。

### 2.4 会话轮次范围

主样本建议满足：

```text
用户消息数 >= 2
经纪人消息数 >= 1
会话总轮次在 3-30 轮之间
```

轮次分桶建议：

| 会话轮次 | 用途 |
| --- | --- |
| 1-2 轮 | 极短会话，主要观察冷启动和流失，不作为主分析样本 |
| 3-5 轮 | 早期留资窗口 |
| 6-10 轮 | 常规沟通窗口 |
| 11-20 轮 | 多轮需求澄清和比较 |
| 21-30 轮 | 长沟通转化 |
| 30+ 轮 | 复杂会话，二期单独分析 |

## 3. 样本规模建议

第一阶段建议导出：

```text
成功留资会话：1 万组
未留资会话：2 万组
总计：3 万组
```

如果成本有限，最低可接受：

```text
成功留资会话：3000-5000 组
未留资会话：5000-10000 组
总计：8000-15000 组
```

建议比例：

```text
成功留资 : 未留资 = 1 : 2 或 1 : 3
```

未留资样本建议再细分：

```text
普通未留资
用户沉默流失
用户明确拒绝留资
```

## 4. 数据导出格式

建议导出为 JSONL：

```text
一行 = 一个完整会话
```

文件命名示例：

```text
ailiao_rent_conversation_20260301_20260531.jsonl
```

### 4.1 推荐完整结构

```json
{
  "conversation_id": "c_123456",
  "conversation_start_time": "2026-03-18 14:23:11",
  "conversation_end_time": "2026-03-18 14:42:08",
  "city": "北京",
  "business_line": "rent",

  "user": {
    "user_id": "u_123",
    "is_new_user": true,
    "historical_consult_count": 3,
    "historical_lead_count": 0,
    "historical_visit_count": 0
  },

  "agent": {
    "agent_id": "a_456",
    "agent_city": "北京",
    "agent_store_id": "store_001",
    "agent_level": "A",
    "historical_im_lead_rate": 0.23
  },

  "entry": {
    "entry_source": "property_detail_agent_booth",
    "entry_page": "property_detail",
    "entry_module": "agent_booth",
    "entry_property_id": "p_001",
    "is_user_initiated": true
  },

  "property": {
    "property_id": "p_001",
    "city": "北京",
    "district": "朝阳",
    "bizcircle": "望京",
    "community": "望京花园",
    "price": 5800,
    "layout": "一居室",
    "area": 52.3,
    "floor": "中楼层",
    "orientation": "南",
    "subway_distance_m": 680,
    "listing_status_at_start": "online",
    "can_visit_at_start": true
  },

  "user_profile": {
    "budget_min": 5000,
    "budget_max": 6500,
    "target_city": "北京",
    "target_districts": ["朝阳"],
    "target_bizcircles": ["望京"],
    "room_type_preference": "一居室",
    "rent_type": "整租",
    "move_in_time": "本月底",
    "preference_tags": ["近地铁", "整租"]
  },

  "behavior_trace": [
    {
      "event_id": "e_001",
      "event_type": "property_view",
      "event_time": "2026-03-18 14:18:01",
      "property_id": "p_001",
      "duration_seconds": 45,
      "extra": {}
    }
  ],

  "messages": [
    {
      "message_id": "m_001",
      "message_index": 1,
      "turn_index": 1,
      "sender": "user",
      "sender_id": "u_123",
      "message_type": "text",
      "content": "这套还在吗？",
      "send_time": "2026-03-18 14:23:11",
      "property_id": "p_001",
      "is_system_message": false,
      "is_auto_reply": false,
      "contains_phone": false
    }
  ],

  "lead_result": {
    "is_phone_left": true,
    "lead_time": "2026-03-18 14:27:30",
    "lead_source": "im_text",
    "lead_message_id": "m_005",
    "lead_turn_index": 5,
    "lead_message_index": 9,
    "minutes_to_lead": 4.3,
    "is_rejected_phone_request": false,
    "is_silent_churn": false,
    "has_visit_after_lead": true
  },

  "quality_flags": {
    "is_valid_sample": true,
    "message_count_total": 8,
    "message_count_user": 4,
    "message_count_agent": 4,
    "conversation_round_count": 4,
    "first_agent_response_seconds": 52,
    "avg_agent_response_seconds": 68,
    "has_property_card_sent": true,
    "has_lead_card_sent": false,
    "has_report_card_sent": false,
    "has_visit_card_sent": false
  }
}
```

### 4.2 最小必需结构

如果第一批导出字段有限，至少需要：

```json
{
  "conversation_id": "c_123",
  "conversation_start_time": "2026-03-18 14:23:11",
  "city": "北京",
  "business_line": "rent",
  "entry_source": "property_detail_agent_booth",
  "user_id": "u_123",
  "agent_id": "a_456",
  "property_id": "p_001",
  "property": {
    "district": "朝阳",
    "bizcircle": "望京",
    "community": "望京花园",
    "price": 5800,
    "layout": "一居室"
  },
  "user_profile": {},
  "behavior_trace": [],
  "messages": [
    {
      "sender": "user",
      "content": "这套还在吗？",
      "send_time": "2026-03-18 14:23:11",
      "message_type": "text"
    }
  ],
  "lead_result": {
    "is_phone_left": true,
    "lead_time": "2026-03-18 14:27:30",
    "lead_turn_index": 5,
    "minutes_to_lead": 4.3,
    "lead_source": "im_text"
  },
  "quality_flags": {
    "message_count_user": 4,
    "message_count_agent": 4,
    "conversation_round_count": 4,
    "is_valid_sample": true
  }
}
```

## 5. 脱敏要求

历史数据中如包含手机号，导出前必须脱敏。

建议：

```json
{
  "content": "我电话是 [PHONE]",
  "contains_phone": true,
  "phone_masked": true
}
```

不建议导出明文手机号。

## 6. 本地 LLM 需要标注什么

本地大模型不应直接输出泛泛总结，而应逐条会话输出结构化标注结果。

建议输出文件：

```text
conversation_features.jsonl
```

一行一个会话特征。

### 6.1 会话有效性

```json
{
  "conversation_id": "c_123",
  "business_detected": "rent",
  "is_valid_for_lead_analysis": true,
  "exclude_reason": null
}
```

`exclude_reason` 可选：

```text
not_rent
not_target_user
customer_service
test_account
missing_messages
missing_property
already_left_phone_before_conversation
unknown
```

### 6.2 用户意图

```json
{
  "user_intent": {
    "primary": "visit_intent",
    "secondary": ["property_detail", "move_in_time"]
  }
}
```

意图枚举：

```text
property_detail
price_negotiation
visit_intent
area_recommendation
fee_tax_loan
floor_layout
move_in_time
ownership_selling
low_intent
unknown
```

### 6.3 用户阶段

```json
{
  "user_stage": "visit_intent"
}
```

阶段枚举：

```text
cold_browse
need_clarification
property_interest
comparison
objection_handling
visit_intent
lead_capture_window
churn_risk
not_target_user
```

### 6.4 用户需求槽位

```json
{
  "need_slots": {
    "budget": "5000-6500",
    "area": "朝阳",
    "layout": "一居室",
    "rent_type": "整租",
    "move_in_time": "本月底",
    "visit_time": "周末",
    "concerns": ["中介费", "真实性"]
  },
  "need_completeness": "medium"
}
```

`need_completeness`：

```text
low
medium
high
```

### 6.5 经纪人响应质量

```json
{
  "broker_response_quality": {
    "answered_user_question": true,
    "asked_followup_question": true,
    "provided_property_value": true,
    "response_relevance": "high",
    "first_response_quality": "good",
    "premature_tool_push": false
  }
}
```

### 6.6 留资动作分析

```json
{
  "lead_attempt": {
    "has_lead_attempt": true,
    "first_lead_attempt_turn_index": 5,
    "first_lead_attempt_message_index": 9,
    "first_lead_attempt_text": "方便留个电话吗？",
    "lead_attempt_timing": "good",
    "lead_reason_type": "visit_arrangement",
    "lead_reason_naturalness": "high",
    "is_repeated_lead_attempt": false
  }
}
```

`lead_attempt_timing`：

```text
too_early
good
too_late
none
```

`lead_reason_type`：

```text
visit_arrangement
confirm_property
help_find_house
send_report
follow_up_contact
wechat_contact
no_clear_reason
none
```

### 6.7 工具和物料使用

```json
{
  "tool_usage": {
    "has_property_card": true,
    "has_lead_card": false,
    "has_report_card": true,
    "has_visit_card": false,
    "tool_push_timing": "too_early",
    "tool_push_result": "no_lead"
  }
}
```

### 6.8 会话轮次分析

```json
{
  "turn_analysis": {
    "conversation_round_count": 8,
    "message_count_total": 16,
    "conversation_round_bucket": "6-10",
    "first_lead_attempt_turn_index": 5,
    "first_lead_attempt_message_index": 9,
    "first_lead_attempt_bucket": "3-5",
    "lead_success_turn_index": 6,
    "lead_success_message_index": 11,
    "turns_from_attempt_to_lead": 1,
    "lead_attempt_timing_by_turn": "good",
    "user_stage_at_first_lead_attempt": "visit_intent"
  }
}
```

轮次分桶：

```text
1-2
3-5
6-10
11-20
21-30
30+
none
```

### 6.9 成败归因

```json
{
  "outcome_analysis": {
    "is_phone_left": true,
    "success_factors": [
      "用户明确表示周末想看房",
      "经纪人先回答问题后引导留资"
    ],
    "failure_factors": [],
    "main_failure_reason": null,
    "is_high_quality_success_case": true,
    "is_negative_case": false
  }
}
```

失败原因枚举：

```text
low_user_intent
not_target_user
unanswered_question
premature_lead_request
unresolved_concern
weak_lead_reason
slow_response
over_push_tool_or_card
user_price_mismatch
user_silent
business_mismatch
unknown
```

## 7. LLM 标注后的统计分析

LLM 标注完成后，不要直接靠模型总结，先用程序做聚合统计。

建议输出：

```text
aggregate_stats.md
aggregate_stats.csv
```

## 8. 必须统计的核心表

### 8.1 不同用户阶段留资率

| 用户阶段 | 会话数 | 留资数 | 留资率 |
| --- | ---: | ---: | ---: |
| cold_browse |  |  |  |
| need_clarification |  |  |  |
| property_interest |  |  |  |
| visit_intent |  |  |  |
| objection_handling |  |  |  |
| churn_risk |  |  |  |

### 8.2 不同用户意图留资率

| 用户意图 | 会话数 | 留资数 | 留资率 |
| --- | ---: | ---: | ---: |
| 问房源详情 |  |  |  |
| 问价格/议价 |  |  |  |
| 问能否看房 |  |  |  |
| 问费用/贷款 |  |  |  |
| 要推荐 |  |  |  |

### 8.3 会话总轮次留资率

| 会话总轮次 | 会话数 | 留资数 | 留资率 |
| --- | ---: | ---: | ---: |
| 1-2 轮 |  |  |  |
| 3-5 轮 |  |  |  |
| 6-10 轮 |  |  |  |
| 11-20 轮 |  |  |  |
| 21-30 轮 |  |  |  |
| 30+ 轮 |  |  |  |

分析目的：

```text
判断会话深度与最终留资率之间的关系。
```

### 8.4 首次索要手机号轮次留资率

| 首次索要手机号轮次 | 会话数 | 留资数 | 留资率 | 解释 |
| --- | ---: | ---: | ---: | --- |
| 未索要 |  |  |  | 可能漏机会 |
| 1-2 轮 |  |  |  | 可能过早 |
| 3-5 轮 |  |  |  | 早期可观察 |
| 6-10 轮 |  |  |  | 可能最佳窗口 |
| 11-20 轮 |  |  |  | 仍有机会 |
| 20+ 轮 |  |  |  | 可能过晚 |

分析目的：

```text
判断经纪人第几轮首次引导留资效果最好。
```

### 8.5 首次索要手机号轮次 × 用户阶段 留资率

| 首次索要轮次 | 用户阶段 | 会话数 | 留资数 | 留资率 |
| --- | --- | ---: | ---: | ---: |
| 1-2 轮 | cold_browse |  |  |  |
| 3-5 轮 | need_clarification |  |  |  |
| 6-10 轮 | visit_intent |  |  |  |
| 11-20 轮 | objection_handling |  |  |  |

分析目的：

```text
证明不是第几轮本身决定留资率，而是“轮次合适 + 用户阶段成熟 + 风险较低”共同决定窗口期。
```

### 8.6 首次索要手机号轮次 × 留资理由 留资率

| 首次索要轮次 | 留资理由 | 会话数 | 留资数 | 留资率 |
| --- | --- | ---: | ---: | ---: |
| 3-5 轮 | 约看安排 |  |  |  |
| 3-5 轮 | 帮找房 |  |  |  |
| 6-10 轮 | 确认房源状态 |  |  |  |
| 6-10 轮 | 查看报告 |  |  |  |
| 1-2 轮 | 无明确理由 |  |  |  |

### 8.7 经纪人是否先回答用户问题对留资率的影响

| 是否回答用户问题 | 会话数 | 留资数 | 留资率 |
| --- | ---: | ---: | ---: |
| 已回答 |  |  |  |
| 未回答 |  |  |  |

### 8.8 不同工具/物料使用情况下的留资率

| 工具/物料 | 会话数 | 留资数 | 留资率 |
| --- | ---: | ---: | ---: |
| 房源卡 |  |  |  |
| 留资卡 |  |  |  |
| 房源报告 |  |  |  |
| 户型报告 |  |  |  |
| 未使用工具 |  |  |  |

### 8.9 失败原因分布

| 失败原因 | 会话数 | 占比 |
| --- | ---: | ---: |
| 用户低意向 |  |  |
| 非目标用户 |  |  |
| 用户问题未回答 |  |  |
| 留资过早 |  |  |
| 用户顾虑未处理 |  |  |
| 留资理由弱 |  |  |
| 过早推卡片或报告 |  |  |
| 用户沉默 |  |  |

## 9. 知识库建设建议

知识库不要直接塞全部原始对话，应从成功样本中精选高质量案例。

### 9.1 成功案例库

建议规模：

```text
从 1 万条成功留资样本中初筛 3000 条
人工抽检后精选 1000-2000 条入库
```

每条知识库记录结构：

```json
{
  "case_id": "case_001",
  "scene": "visit_arrangement_lead",
  "user_stage": "visit_intent",
  "trigger_signal": ["用户询问周末能否看房"],
  "conversation_excerpt": [
    {"sender": "user", "content": "周末能看吗？"},
    {"sender": "agent", "content": "这套可以约看，我先帮您确认下房东时间。方便留个电话吗？"}
  ],
  "successful_reply": "这套可以约看，我先帮您确认下房东时间。方便留个电话吗？确认好后我第一时间同步您。",
  "why_it_worked": "先回应看房诉求，再给出留电话的合理用途，表达自然低压。",
  "do_not_say": ["不留电话不能看房", "先留电话再说"]
}
```

### 9.2 失败反例库

建议规模：

```text
精选 500-1000 条典型失败案例
```

用于提示 AI 避免：

1. 用户问题没回答就要电话。
2. 用户正在问费用时直接索要手机号。
3. 用户刚拒绝后继续催。
4. 留资理由不清晰。
5. 过早发送报告或卡片要求授权手机号。

## 10. 推荐整体处理流程

```text
原始爱聊会话 JSONL
-> 数据清洗和脱敏
-> 程序计算基础特征
-> 本地 LLM 逐条结构化标注
-> 生成 conversation_features.jsonl
-> 程序聚合统计留资率
-> 输出 aggregate_stats.md / csv
-> AI 根据统计结果总结高低留资率模式
-> 精选成功案例和失败案例
-> 建设成功话术知识库和失败反例库
```

## 11. 最终交付物

建议本次分析最终产出：

```text
1. raw_conversations.jsonl
2. conversation_features.jsonl
3. aggregate_stats.md
4. aggregate_stats.csv
5. success_cases_knowledge_base.jsonl
6. failure_cases_knowledge_base.jsonl
7. 留资窗口规律分析报告.md
```

## 12. 最终要回答的问题

本次分析完成后，需要能回答：

1. 什么用户阶段留资率最高？
2. 什么用户意图留资率最高？
3. 会话总轮次与留资率有什么关系？
4. 经纪人第几轮首次索要手机号成功率最高？
5. 用户阶段和索要手机号轮次之间是否存在最佳组合？
6. 哪种留资理由成功率最高？
7. 用户顾虑未处理时留资率是否明显降低？
8. 房源报告、户型报告、留资卡片等物料在什么场景下有效？
9. 失败会话主要失败在哪里？
10. 哪些成功案例可以沉淀为知识库？

## 13. 可用于立项材料的结论表达模板

后续可以将统计结果写成以下形式：

```text
我们先对历史爱聊会话进行 AI 结构化标注，再按用户阶段、会话轮次、首次索要手机号轮次、留资理由和工具使用情况进行分组统计。

分析发现，留资成功并不是随机发生的，而是集中出现在“用户阶段成熟、需求较明确、经纪人已回答关键问题、留资理由自然、首次索要手机号轮次适中”的场景中。

因此，AI 留资 Agent 的核心价值，是在实时会话中识别这些高成功率模式，并提醒经纪人在合适时机使用合适的话术或工具推进留资。
```
