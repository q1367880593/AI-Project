# IMAssistant 本地 Agent API 原型

这是一个用于“房产 IM 留资窗口期判断”的本地 Agent API 原型。

它提供两类能力：

1. `/agent/analyze`：结构化判断当前会话阶段、留资分、是否提示经纪人。
2. `/agent/reply/stream`：以 SSE 流式返回建议回复话术。
3. `/agent/conversation/update`：累计上传用户画像、行为轨迹和 IM 消息。
4. `/agent/window/stream`：B 端订阅当前是否进入留资窗口期。

服务前面面向 B 端客户端，后面可选接本地大模型服务，例如 Ollama。没有本地模型时，系统会使用规则兜底生成结果，方便先跑通产品交互。

## 目录结构

```text
agent_service/
  main.py          # FastAPI 入口
  schemas.py       # 请求/响应数据结构
  scoring.py       # 阶段判断、留资评分、规则兜底
  llm.py           # 本地 LLM/Ollama 调用封装
  prompts.py       # Prompt 构造
  service.py       # Agent 编排逻辑
demo_request.py    # 本地调用示例
requirements.txt   # API 服务依赖
```

## 启动方式

### 方式一：零依赖 Demo 服务

当前目录可以直接启动一个基于 Python 标准库的本地 HTTP 服务：

```bash
python3 local_server.py
```

这个方式不需要安装 FastAPI，适合先验证客户端交互。

### 方式二：FastAPI 服务

安装依赖：

```bash
python3 -m pip install -r requirements.txt
```

启动 API：

```bash
python3 -m uvicorn agent_service.main:app --reload --host 127.0.0.1 --port 8000
```

访问健康检查：

```bash
curl http://127.0.0.1:8000/health
```

## 可选：接入 Ollama

启动 Ollama：

```bash
ollama serve
```

拉取并运行模型，例如：

```bash
ollama pull qwen2.5:7b
```

配置环境变量：

```bash
export AGENT_LLM_PROVIDER=ollama
export OLLAMA_BASE_URL=http://127.0.0.1:11434
export OLLAMA_MODEL=qwen3:8b
```

如果不配置 `AGENT_LLM_PROVIDER=ollama`，服务默认只走本地规则。

### Qwen3 快速模式

Qwen3 支持 thinking / non-thinking 两种使用方式。当前 Agent 场景主要是实时阶段判断和话术生成，推荐默认使用快速模式。

默认配置：

```bash
export OLLAMA_FAST_MODE=true
export OLLAMA_NUM_PREDICT=512
export OLLAMA_TEMPERATURE=0.2
```

开启快速模式后，服务会在请求 Qwen3 时加入 `/no_think`，并限制最大输出长度，减少延迟。

如果你希望模型进行更充分的推理，可以关闭快速模式：

```bash
export OLLAMA_FAST_MODE=false
```

## 结构化分析接口

`POST /agent/analyze`

示例：

```bash
python3 demo_request.py
```

返回示例：

```json
{
  "conversation_id": "c_001",
  "stage": "visit_intent",
  "lead_score": 86,
  "confidence": 0.84,
  "should_prompt_agent": true,
  "prompt_level": "strong",
  "reason": "用户询问看房时间，存在明确行动意图。",
  "agent_strategy": "先回应用户看房诉求，再用确认看房安排作为理由引导留手机号。",
  "suggested_reply": "这套可以帮您约看，我先确认下房东和钥匙时间。方便留个电话吗？确认好后我第一时间同步您。",
  "next_best_question": null,
  "missing_info": [],
  "risk_flags": [],
  "do_not_say": [
    "不留电话不能看房",
    "先留电话再说",
    "反复催促用户留手机号"
  ],
  "source": "rules"
}
```

## 累计上传接口

`POST /agent/conversation/update`

C 端或 IM 服务每次产生新画像、新行为、新消息时调用该接口。服务会在内存中按 `conversation_id` 累计上下文，并立即返回最新窗口期判断。

请求示例：

```json
{
  "conversation_id": "c_001",
  "user_profile": {
    "budget_range": [5000, 6500],
    "target_area": "朝阳",
    "room_type_preference": "一居室"
  },
  "property_context": {
    "community": "望京花园",
    "district": "朝阳",
    "price": 5800,
    "layout": "一居室"
  },
  "behaviors": [
    {"type": "view_vr"},
    {"type": "favorite"}
  ],
  "messages": [
    {"sender": "user", "content": "周末能看吗？"}
  ]
}
```

## B 端窗口期订阅接口

`GET /agent/window/stream?conversation_id=c_001`

B 端进入聊天页后建立 SSE 连接。每当 C 端行为或 IM 消息累计上传后，该接口会推送最新分析结果。

SSE 事件格式：

```text
event: analysis
data: {"stage":"visit_intent","lead_score":86,"should_prompt_agent":true,...}
```

## 本地监控页面

启动服务后访问：

```text
http://127.0.0.1:8000/monitor
```

或在真机联调时访问：

```text
http://你的Mac局域网IP:8000/monitor
```

页面支持：

1. 输入或选择 `conversation_id`。
2. 实时订阅该会话的窗口期判断。
3. 查看用户画像、房源上下文、累计行为数、累计消息数。
4. 查看当前阶段、留资分、置信度、提示等级、建议话术。

## 流式话术接口

`GET /agent/reply/stream?conversation_id=c_001`

SSE 事件格式：

```text
event: delta
data: {"text":"这套可以帮您约看"}

event: done
data: {}
```

## 设计建议

客户端不要直接调用 Ollama/vLLM 等模型服务。客户端只调用本项目暴露的 Agent API，由 Agent API 统一处理业务上下文、规则评分、风控、频控、Prompt、模型切换和日志埋点。
