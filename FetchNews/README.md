# FetchNews

FetchNews 是一个本地运行的新闻研究工具：按人物、公司或主题搜索新闻，抓取正文、去重聚类，并输出简体中文 Markdown 日报。

## 当前能力

- Google News RSS 多关键词搜索。
- URL 规范化与 SQLite 幂等入库。
- 直接网页正文抽取，失败时使用 Jina Reader，再降级为检索摘要。
- 基础相关性过滤与同事件标题聚类。
- 可选 Ollama 结构化中文摘要；模型不可用时仍生成中文降级报告。
- UTF-8 Markdown 日报、YAML Front Matter、来源链接和失败说明。
- 运行批次、处理状态、错误记录及原子文件写入。

## 快速开始

要求 Python 3.11 或更高版本，无强制第三方依赖。

```bash
python3 -m fetch_news --config config/config.toml init
```

未安装项目时，在仓库中使用：

```bash
PYTHONPATH=src python3 -m fetch_news --config config/config.toml init
PYTHONPATH=src python3 -m fetch_news --config config/config.toml doctor
PYTHONPATH=src python3 -m fetch_news --config config/config.toml run
```

也可以安装为本地命令：

```bash
python3 -m pip install -e .
fetch-news --config config/config.toml run --target elon_musk
```

日报生成在：

```text
reports/{target_slug}/{YYYY-MM-DD}.md
```

## 配置中文分析模型

默认 `analysis.provider = "none"`，程序使用规则降级，报告仍为中文，但不会可靠翻译外文新闻。安装并启动 Ollama 后修改：

```toml
[analysis]
provider = "ollama"
base_url = "http://localhost:11434"
model = "qwen2.5:7b"
```

模型返回必须是结构化 JSON；调用失败时自动回退规则模式，并在日报标记 `partial: true`。

### 使用 OpenAI API

执行 `init` 会同时创建被 Git 忽略的 `.env`。在其中填写 API Key，不要把密钥写进 TOML：

```dotenv
OPENAI_API_KEY=你的_API_Key
```

然后修改 `config/config.toml`：

```toml
[analysis]
provider = "openai"
base_url = "https://api.openai.com/v1"
model = "gpt-5.6-sol"
api_key_env = "OPENAI_API_KEY"
reasoning_effort = "low"
max_output_tokens = 1600
timeout_seconds = 90
```

OpenAI provider 使用 Responses API 和严格 JSON Schema。可按账户权限或成本需求覆盖 `model`；新闻归纳默认使用 `low` 推理强度以控制延迟与成本。运行 `doctor` 可检查密钥和 API 连通性：

```bash
PYTHONPATH=src python3 -m fetch_news --config config/config.toml doctor
```

程序默认从当前工作目录读取 `.env`。也可以显式指定其他路径：

```bash
PYTHONPATH=src python3 -m fetch_news \
  --env-file /安全目录/fetch-news.env \
  --config config/config.toml run
```

操作系统中已经存在的同名环境变量优先于 `.env`，适合生产环境和定时任务覆盖本地设置。

### 搜索超时处理

如果报告出现 `Google News RSS 请求失败：timed out`，说明当前网络不能直连 Google News，并非 OpenAI 调用错误。可以在 `.env` 配置本机 HTTP 代理：

```dotenv
HTTPS_PROXY=http://127.0.0.1:7890
HTTP_PROXY=http://127.0.0.1:7890
```

端口需要与本机代理软件一致。也可以申请 Tavily Key，在 `.env` 中设置：

```dotenv
TAVILY_API_KEY=你的_Tavily_Key
```

并在 `config/config.toml` 的 `[search]` 中启用备用源：

```toml
tavily_enabled = true
tavily_api_key_env = "TAVILY_API_KEY"
```

当某个搜索源首次发生连接错误时，本轮任务会熔断该来源，避免每个关键词重复等待超时。

第三方 OpenAI 兼容服务不一定实现 Responses API 或 `/models` 端点。若使用非 `api.openai.com` 地址，请确认服务明确支持 `/v1/responses`；否则应使用官方地址或后续增加对应服务的 Chat Completions 适配器。

## 常用命令

```bash
fetch-news run --target elon_musk --date 2026-08-04
fetch-news run --skip-search
fetch-news report --target elon_musk --date 2026-08-04
fetch-news doctor
fetch-news stats
```

## 定时运行

先手动验证 `run` 成功，再使用 cron 或 macOS launchd 每日调用。配置文件路径和工作目录应使用绝对路径。

## 测试

```bash
PYTHONPATH=src python3 -m unittest discover -s tests -v
```

架构与后续路线见 [架构设计文档](%23%20Local%20Research%20Agent%20架构设计.md)。
