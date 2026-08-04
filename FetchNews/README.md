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

