# Jev 调研报告：租客聊天意图识别

> 日期：2026-09-24  
> 调研对象：TypeSafe AI Jev  
> 重点：Jev 能否用于公司现有 AI 决策类场景，尤其是租客聊天意图识别。  
> 范围：租客聊天意图识别；基线文件为《租客消息识别 Prompt V3.0.1》。

---

## 1. 一句话结论

**Jev 值得做 POC，且最优先验证的是"现有在线大模型调用的替代/降级"，而不是直接替换现有 LoRA。**

我们的 AI 需求大多不是"写一段话"，而是回答确定性问题：这条消息属于什么意图？是否需要升级人工？是否触发质检规则？Jev 专门为这种"软件里的智能判断"设计：输入 state，输出预先定义的 typed decision 并给出概率。 [1]

技术路线：

```text
当前轮租客消息 + 必要历史上下文
              ↓
    Jev：72 个 Noul，一次请求
              ↓
      72 个意图概率
              ↓
   业务规则后处理 / 阈值
              ↓
         最终 intents
```

**第一版不要做 72 次 HTTP 调用**：同一个 `state` 可携带多个 questions（72 个 Noul）在一个 request 中并行计算。 [2]

同时保留级联方案：

```text
Jev 高置信 → 直接采用
Jev 低置信 / 冲突 / 特殊 case → 现有 LoRA
仍不确定 → 在线大模型
```

---

## 2. Jev 是什么

TypeSafe 官方把 Jev 称为 **System One Model**，强调"面向软件自动化的结构化决策"，而非聊天或文本生成。Jev 于 2026-09-15 首次公开，目前仍是较新的产品。 [1]

与普通 LLM 的区别：

```text
普通大模型：输入问题 → 生成自然语言 → 程序再解析 JSON/文本
Jev：      输入 State → 定义要判断的问题 → 直接返回结构化判断+概率 → 代码直接执行后续逻辑
```

三类核心能力：

| 能力         | 含义         | 适合场景                 |
| ---------- | ---------- | -------------------- |
| **Noul**   | 判断"是不是"    | 意图是否成立、是否拒绝、是否命中质检规则 |
| **Choice** | 判断"是哪一个"   | 单标签分类、路由、客户类型        |
| **Score**  | 判断"处于哪个等级" | 质检分数、风险等级、意愿强弱       |

租房意图属于多标签任务，重点用 **Noul** 而非 Choice。

---

## 3. 为什么和我们的场景匹配

### 3.1 现状：72 个 intent、多标签、依赖历史上下文

V3.0.1 定义 72 个唯一 intent，同一轮允许同时输出多个意图（需去重、按首次出现顺序输出）。例如：

```text
"这个月租金多少钱？最低多少？" → RENT_PRICE_AND_PAYMENT + PRICE_NEGOTIATION
"还有三居吗？最好离国贸近一点。" → REQUEST_OTHER_PROPERTIES + STATE_RENTAL_NEEDS
```

历史上下文用于理解省略、指代、身份延续和"可以/是的/不行/哪个/我加你"等短回复，但历史消息本身不能直接作为当前轮意图输出。

因此不能做"72 选 1"，更适合：

```text
一个请求
 ├─ Noul：是不是 RENT_PRICE_AND_PAYMENT？
 ├─ Noul：是不是 PRICE_NEGOTIATION？
 ├─ ...（共 72 个）
 └─ 阈值/业务规则 → 最终 intents
```

72 个判断放在一次 Jev 请求中并行计算，而不是 72 次 HTTP 调用。 [2]

### 3.2 可扩展到其他场景

客户分类（Choice/Noul）、需求分类（Choice/Noul）、质检（Score+Noul）、风险检测（Noul）、升级人工（Noul）、路由（Choice）——Jev 有望成为统一的 **AI Decision Layer**，价值可能高于单个意图模型本身。

---

## 4. 正确建模方式

### 4.1 不建议：72-way Choice 直接替换

Choice 本质是"72 个候选选一个"，会丢失多意图能力（我们要的是 A=true、B=true、C=false…）。可选做一个 72-way Choice 作为 benchmark 对照组，目的不是上线，而是看"只保留一个主意图时 Jev 的表现"。

### 4.2 主方案：72 Noul 一次请求

```json
{
  "model": "jev-latest",
  "state": {"conversation_history": [], "current_round": {"tenant_messages": []}},
  "questions": {
    "PROPERTY_AVAILABILITY": {"type": "noul", "instructions": "当前轮租客消息是否表达当前房源是否仍在出租的询问？"},
    "RENT_PRICE_AND_PAYMENT": {"type": "noul", "instructions": "当前轮租客消息是否询问租金金额、付款方式、付款周期或交租时间？"},
    "...": {"type": "noul", "instructions": "..."},
    "UNKNOWN": {"type": "noul", "instructions": "当前轮消息是否为空、乱码、纯符号或无法结合上下文理解？"}
  }
}
```

返回示意：

```json
{
  "answers": {
    "PROPERTY_AVAILABILITY": {"type": "noul", "noul": 0.03},
    "RENT_PRICE_AND_PAYMENT": {"type": "noul", "noul": 0.92},
    "PRICE_NEGOTIATION": {"type": "noul", "noul": 0.88}
  },
  "usage": {"input_tokens": 8120, "output_tokens": 0}
}
```

实际字段以接入时官方 API/SDK 为准。

每个 intent 不要只写标签名，要写"判断契约"：

```text
当前轮租客消息是否表达以下意图：【INTENT_ID】
业务定义

只判断当前轮租客消息。
历史上下文只用于解决当前轮中的省略、指代和短回复。
当前轮没有足够证据时判断为 false。
```

### 4.3 当前 Prompt 不应该原样搬过去

| 类型        | 内容                                                        | 去向  |
| --------- | --------------------------------------------------------- | --- |
| A 类：语义问题  | "是不是在议价 / 看房 / 询问电梯"                                      | Jev |
| B 类：确定性规则 | 已有其他意图则删 GENERAL\_CONVERSATION；"最低多少"补 PRICE\_NEGOTIATION | 代码  |
| C 类：输出整理  | 去重、按首次出现排序、evidence 去重                                    | 代码  |

即：Jev = 语义决策引擎，代码 = 业务规则 / 后处理器。

---

## 5. 成本与延迟

### 5.1 成本

官方当前价格：**输入 $0.042 / 1M tokens，输出免费。** [1]

| 预估算 input tokens / 请求 |     单次美元成本 | 单次人民币成本（1 USD≈7 RMB） |
| --------------------: | ---------: | -------------------: |
|                 6,500 | $0.000273 |             ¥0.00191 |
|                 8,000 | $0.000336 |             ¥0.00235 |
|                10,000 | $0.000420 |             ¥0.00294 |
|                12,000 | $0.000504 |             ¥0.00353 |

会话维度对比（更直观）：

```text
在线大模型：单会话平均输入 40,701 tokens，费用约 0.0347 元
    Jev： 同等输入下费用约 0.00115 元
→ 约便宜 34 倍
```

结论：**若准确率达标，成本很可能不是 Jev 落地的主要阻力。**（以上均为预算模型，真实成本以 Jev API 返回的 `usage.input_tokens` 为准。）

### 5.2 延迟

| 口径                  | 数据                           |
| ------------------- | ---------------------------- |
| TypeSafe 官方端到端 [1] | 70ms～500ms                   |
| 独立实验实测 [5]         | P50 ≈ 0.44s，P95 ≈ 0.71s      |
| 线上意图识别现状            | 平均 3.75s，P50 3.58s，P95 5.09s |

按独立实验 P50 对比，预期意图识别约快 4.6 倍。两个外部数字都不能直接当作北京生产环境 SLA，需以本地压测为准。

---

## 6. 阈值与评估

### 6.1 阈值：不能取最大概率

Noul 返回的是 `P(intent = true)`，**不是 72-way softmax**（多个 Noul 可同时较高，不要求总和为 1），因此不能"取最大概率的 intent"，而应做阈值命中制：`P >= threshold → 命中`。 [2]

第一版对 0.50～0.95 做 sweep，每档统计 Precision/Recall/F1/Coverage/Fallback Rate，最终可按风险分级：

```text
高风险/高成本意图 → 0.90
普通意图       → 0.80
低风险辅助意图  → 0.70
```

具体阈值必须由人工标注数据决定，不建议拍脑袋。同时注意：Noul 的概率需要基于我们的真实数据重新标定。

### 6.2 评估指标

- 总体：Micro-F1、Macro-F1、Exact Match / Subset Accuracy、Hamming Loss
- 每类：Precision、Recall、F1、Support
- 重点混淆组：

| 组     | 涉及 intent                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 价格    | RENT\_PRICE\_AND\_PAYMENT / PRICE\_NEGOTIATION / AGENCY\_FEE\_QUERY / SERVICE\_FEE\_QUERY / DISCOUNT / DISCOUNT\_ELIGIBILITY\_QUERY / SUBSIDY\_REBATE\_QUERY |
| 房源结构  | PROPERTY\_LAYOUT / PROPERTY\_TYPE / PROPERTY\_RENT\_MODE / PRIVATE\_BATHROOM                                                                                 |
| 地理    | PROPERTY\_AREA\_LOCATION / PROPERTY\_BUILDING\_LOCATION / PROPERTY\_EXACT\_ADDRESS / NEARBY\_SURROUNDINGS\_QUERY / DISTANCE\_TO\_DESTINATION                 |
| 状态    | PROPERTY\_AVAILABILITY / REJECT\_CURRENT\_PROPERTY / STOP\_RENTAL\_SEARCH / GENERAL\_CONVERSATION / OTHER\_QUESTION / UNKNOWN                                |
| 推荐/需求 | REQUEST\_OTHER\_PROPERTIES / STATE\_RENTAL\_NEEDS                                                                                                            |

---

## 7. 重点 Case（进入 POC Hard Set）

| Case       | 输入                        | 期望输出                                              | 关键验证点                                      |
| ---------- | ------------------------- | ------------------------------------------------- | ------------------------------------------ |
| 双意图        | "这个月租金多少钱？最低多少？"          | RENT\_PRICE\_AND\_PAYMENT + PRICE\_NEGOTIATION    | 最重要的多标签 Case                               |
| 需求+推荐      | "还有三居吗？最好离国贸近一点。"         | REQUEST\_OTHER\_PROPERTIES + STATE\_RENTAL\_NEEDS | 筛选条件不要误识别成当前房源属性询问                         |
| 需求门槛 vs 拒绝 | "6楼已经是极限。"                | STATE\_RENTAL\_NEEDS                              | 不要误判 REJECT\_CURRENT\_PROPERTY             |
| 短回复+上下文    | 历史"明天下午3点带您看，可以吗？" 当前"可以" | VIEWING                                           | 利用 history 还原短句含义                          |
| 联系经纪人      | "你给我个电话，我加你。"             | REQUEST\_AGENT\_OR\_HUMAN                         | 不要误打 PROVIDE\_TENANT\_CONTACT（租客没提供自己联系方式） |

其他必测：单意图租金（"多少钱一个月？"，勿误判议价）、单意图议价（"还能便宜吗？"）、拒绝当前房源（"这个房子太小了，算了。"）、业务外问题（"物业公司是哪家？"→ OTHER\_QUESTION，勿强套相近标签）、纯聊天（"好的，谢谢。"→ GENERAL\_CONVERSATION，同轮有其他业务意图时应删除）、未知（"￥#@……" → UNKNOWN）、短租与电梯条件（显式业务规则双输出）。

Hard Set 建议至少 1,000 条，覆盖：价格边界、拒绝 vs 需求门槛、请求推荐 vs 房源属性查询、看房 vs 普通聊天、物业位置 vs 到目标距离、索要联系方式 vs 提供联系方式、GENERAL\_CONVERSATION vs OTHER\_QUESTION、UNKNOWN vs COMMUNICATION\_FAILURE。

---

## 8. 成熟度与风险

- Jev 是 2026-09-15 发布的新产品；TypeSafe 自己也明确价格可持续性未经长期验证。 [1]
- **API/SDK 开放 ≠ 模型权重开源**：未见官方公开权重支持本地自部署；社区 `open-jev` 项目是独立复刻/研究，不等价于 Jev 本体。 [6][7]
- 独立 benchmark 结果差异大：同为 BANKING77，一项实验 Accuracy 92.40%（Macro-F1 0.9235）[4]，另一项约 83.2%（P50 0.44s / P95 0.71s）[5]。说明效果高度依赖任务定义、标签说明、示例、阈值和测试方法，不能外推"我们能达到多少准确率"。

结论：**适合 POC 和灰度验证，不适合未经验证直接替换现网。** 生产验证用官方 API；技术储备持续跟踪 open-jev；不要把社区复刻当 Jev 本体上线。

---

## 9. POC 方案

### 9.1 四个实验组

| 组 | 方案                  | 目的            |
| - | ------------------- | ------------- |
| A | 现有在线 LLM            | 当前生产 baseline |
| B | 现有 LoRA             | baseline 参照   |
| C | Jev 72 Noul         | 验证 Jev 原始能力   |
| D | Jev → LoRA → LLM 级联 | 验证实际工程价值      |

核心问题不是"Jev 是否超过在线 LLM"，而是：**在达到同等业务准确率要求的前提下，Jev 能把多少流量从在线 LLM 中拿回来。**

### 9.2 数据与产出

- 数据：10,000 条真实历史会话做人工 Gold Set，分层采样（热门 + 冷门 + 多意图 + 短/强上下文 + 历史省略 + 规则 hard case）；冷门 intent 必须补采样。
- 产出对比表：

| 指标          |  LoRA | 在线 LLM |          Jev | Jev→LoRA→LLM |
| ----------- | ----: | -----: | -----------: | -----------: |
| Macro-F1    |    待测 |     待测 |           待测 |           待测 |
| Micro-F1    |    待测 |     待测 |           待测 |           待测 |
| Exact Match |    待测 |     待测 |           待测 |           待测 |
| Hard Set F1 |    待测 |     待测 |           待测 |           待测 |
| P50 / P95   |    待测 |     待测 |           待测 |           待测 |
| ¥ / 1K 请求   |    待测 |     待测 | ≈1.9～2.9 元\* |           待测 |
| 在线 LLM 调用率  | 100%? |   100% |           待定 |       目标显著下降 |

\* 按 6.5K～10K input tokens、1 USD≈7 RMB 预算估算，不能替代实际 API usage。

POC 只回答三个问题：**准确率能否达到现网要求？多少请求可以不再走在线大模型？实际单请求延迟和成本是多少？** 三项都成立再扩大范围。

---

## 10. 落地路线

```text
第一阶段 不改现网：真实流量 ├─ 现网结果 └─ Jev Shadow（只记录差异）
第二阶段 离线阈值校准：人工 Gold Set → threshold sweep → 确定分组阈值
第三阶段 小比例级联：Jev → 高置信直接采用 / 低置信 LoRA / 极少数在线 LLM
第四阶段 逐步替换在线 LLM：准确率、fallback、延迟、成本稳定，且错误样本可解释时才扩大流量
```

---

## 11. 最终一句话

> **Jev 不是"又一个大模型"，更像一个可以嵌进业务代码里的 AI 判断层。对我们而言，真正值得验证的不是"Jev 能不能分类"，而是"它能不能把大量原本必须调用在线大模型的判断，变成低成本、低延迟、可阈值控制的程序化决策"。**

---

# 参考资料

1. TypeSafe AI：Introducing System One Models & Jev
   <https://typesafe.ai/blog/introducing-system-one-models-and-jev>
2. Learn Jev：Three primitives（Noul / Choice / Score）
   <https://learnjev.com/tutorials/three-primitives>
3. Learn Jev：Your first Jev call
   <https://learnjev.com/tutorials/first-call>
4. Independent BANKING77 experiment
   <https://github.com/simonmesmith/jev-banking77-experiment>
5. Independent Jev baselines evaluation
   <https://github.com/ickma2311/jev-baselines-eval>
6. Community open-jev
   <https://github.com/JoshuaSP/open-jev>
7. Community open-jev implementation
   <https://github.com/daseinlabs/open-jev>
8. 业务基线：《租客消息识别 Prompt V3.0.1》（项目内部文件）

> 外部资料均按 2026-09-23 可见信息整理；Jev 产品迭代很快，具体价格、模型版本和服务限制应以正式接入当天官方资料为准。上线前需把线上最新 label dictionary 与 V3.0.1 的 72 个 intent 对齐。

