# XiaoHua 小说抓取与整理工具

一个用于抓取小说网站章节、去除水印广告、合并成整本小说的 Python 工具链。项目由三个独立的脚本组成，各自负责一个环节，并提供 [run.sh](run.sh) 一键串联整套流程。

## 脚本概览

| 文件 | 功能 |
|------|------|
| [run.sh](run.sh) | 一键执行完整流程（抓取 → 去水印/重命名 → 合并），或单独执行某一步 |
| [xiaohua.py](xiaohua.py) | 抓取小说章节并保存为独立 txt 文件 |
| [remove_watermark.py](remove_watermark.py) | 批量去除底部网址水印、自动重命名章节 |
| [union.py](union.py) | 将分散的章节文件合并为单本小说 |
| [clean.py](clean.py) | 统一维护网址/水印/广告的清洗规则，供前两个脚本复用 |
| [config.json](config.json) | 抓取配置与进度（章节号与 herf 关联关系，运行时自动更新） |

## 依赖

- Python 3
- `requests`：发送 HTTP 请求、抓取网页
- `lxml`：解析 HTML（XPath 提取标题、正文、下一章链接）
- `jieba`（可选，推荐安装）：中文分词，用于生成更贴切的章节名；未安装时自动退回内置的简单提取

建议使用虚拟环境安装依赖，避免污染系统环境（[run.sh](run.sh) 会优先调用 `.venv/bin/python`）：

```bash
python3 -m venv .venv
.venv/bin/pip install requests lxml jieba
```

> 若系统 `pip` 受限制，可用阿里云镜像加速：`.venv/bin/pip install -i https://mirrors.aliyun.com/pypi/simple/ requests lxml jieba`

## 工作流程

整体流程为：**抓取 → 去水印/重命名 → 合并**。

### 1. 抓取章节（xiaohua.py）

- 通过 `requests` 请求小说页面，使用 `lxml` 的 XPath 定位正文（`//div[@id='content']/text()`）和下一章链接（`//div[@class='page_chapter']//a`）。
- 每抓取一章，调用 [clean.py](clean.py) 统一清理页面上携带的水印与广告文案。
- 章节标题统一命名为 `第N章 作者懒得起名`，正文前追加标题，保存为 `xiaohua/第N章 作者懒得起名.txt`。
- 章节号与链接的关联关系记录在 [config.json](config.json) 的 `herf` / `idx` 字段，每抓完一章自动写回（`idx` 自增、`herf` 更新为下一章链接）。

> 注意：抓取间隔、起始章节地址与章号均从 [config.json](config.json) 读取，换书时编辑 `base_url` / `herf` / `idx` 即可，无需改动代码。

[config.json](config.json) 主要字段说明：

| 字段 | 说明 |
|------|------|
| `base_url` | 小说站点根地址 |
| `herf` | 当前章节的路径（首次运行为起始章节地址） |
| `idx` | 当前章节号，每抓取一章自动 +1 |
| `sleep_seconds` | 每次请求之间的间隔秒数，避免被站点限流 |
| `max_retry` | 单章请求失败后的最大重试次数 |
| `max_chapters` | 单次抓取的章节数上限，`0` 表示不限制 |
| `output_dir` | 章节 txt 文件的输出目录 |
| `exclude_names` | 生成章节名时需要排除的人名/称谓名单 |

### 2. 去水印与重命名（remove_watermark.py）

- 批量处理 `xiaohua` 文件夹内所有 `.txt` 文件。
- 调用 [clean.py](clean.py) 删除网址链接行与水印文字行。
- 章节重命名：当标题含有"懒得起名"或"作者"时，从正文提取高频关键词替换原标题，支持按新章节名重命名文件。
  - 使用 jieba 词性标注，只保留实义词（名词/动词/形容词/成语/地名/机构名）。
  - 自动过滤词性为人名（`nr` 系列）的词，并叠加 [config.json](config.json) 的 `exclude_names` 手动排除名单，避免主角名、尊号等被提取为章节名。
  - 内置停用词表过滤无意义的虚词与高频弱词。
- 支持三种模式：去水印 + 重命名、仅重命名、仅去水印（见 `batch_remove_watermark` 参数）。

### 3. 合并（union.py）

- 读取 `xiaohua` 文件夹内所有 `.txt` 文件，按文件名排序依次拼接。
- 提取首/末章节编号，输出文件名格式为 `{起始章}-{结束章}.txt`。

## 使用方式

先在 [config.json](config.json) 中设置 `base_url` / `herf` / `idx`，然后一键运行完整流程：

```bash
# 一键：抓取 → 去水印/重命名 → 合并
./run.sh            # 或 ./run.sh all

# 也可单独执行某一步
./run.sh crawl      # 仅抓取
./run.sh clean      # 仅去水印/重命名
./run.sh merge      # 仅合并
```

[run.sh](run.sh) 通过 `PYTHONUNBUFFERED=1` 与 `python -u` 关闭 Python 输出缓冲，保证各脚本的 `print` 日志实时、完整地打印到终端。

若不想用 shell 脚本，也可手动依次执行：

```bash
.venv/bin/python xiaohua.py          # 1. 抓取
.venv/bin/python remove_watermark.py # 2. 清理水印、自动重命名章节与文件
.venv/bin/python union.py            # 3. 合并成整本
```

## 其他说明

- 目标站点与解析规则（XPath 路径、[clean.py](clean.py) 中的清洗规则）与具体小说网站绑定，站点改版后需同步调整。