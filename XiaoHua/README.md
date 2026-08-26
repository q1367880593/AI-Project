# XiaoHua 小说抓取与整理工具

一个用于抓取小说网站章节、去除水印广告、合并成整本小说的 Python 工具链。项目由三个独立的脚本组成，各自负责一个环节。

## 脚本概览

| 文件 | 功能 |
|------|------|
| [xiaohua.py](xiaohua.py) | 抓取小说章节并保存为独立 txt 文件 |
| [remove_watermark.py](remove_watermark.py) | 批量去除底部网址水印、自动重命名章节 |
| [union.py](union.py) | 将分散的章节文件合并为单本小说 |

## 依赖

- Python 3
- `requests`：发送 HTTP 请求、抓取网页
- `lxml`：解析 HTML（XPath 提取标题、正文、下一章链接）

```bash
pip install requests lxml
```

## 工作流程

整体流程为：**抓取 → 去水印/重命名 → 合并**。

### 1. 抓取章节（xiaohua.py）

- 通过 `requests` 请求小说页面，使用 `lxml` 的 XPath 定位正文（`//div[@id='content']/text()`）和下一章链接（`//div[@class='page_chapter']//a`）。
- 每抓取一章，通过 `str.replace()` 清理页面上携带的水印与广告文案（如"1秒记住千千小说"、"推荐都市大神老施新书"等）。
- 章节标题统一命名为 `第N章 作者懒得起名`，正文前追加标题，保存为 `xiaohua/第N章 作者懒得起名.txt`。
- 循环跟随"下一章"链接继续下载，章数由脚本顶部的 `herf`（起始链接）与 `idx`（起始章号）控制。

> 注意：脚本每章之间 `time.sleep(66)`，且起始 `herf` 为硬编码，需手动更新目标章节地址后运行。

### 2. 去水印与重命名（remove_watermark.py）

- 批量处理 `xiaohua` 文件夹内所有 `.txt` 文件。
- 通过正则匹配并删除两类冗余行：网址链接行（`(https://...)`）和水印文字行（"1秒记住"、"手机版阅读网址"等）。
- 章节重命名：当标题含有"懒得起名"或"作者"时，从正文提取 2-4 字高频中文词组（内置停用词表过滤），用第一个关键词替换原标题；支持按新章节名重命名文件。
- 支持三种模式：去水印 + 重命名、仅重命名、仅去水印（见 `batch_remove_watermark` 参数）。

### 3. 合并（union.py）

- 读取 `xiaohua` 文件夹内所有 `.txt` 文件，按文件名排序依次拼接。
- 提取首/末章节编号，输出文件名格式为 `{起始章}-{结束章}.txt`。

## 使用方式

```bash
# 1. 修改 xiaohua.py 顶部 herf / idx 后抓取
python xiaohua.py

# 2. 清理水印、自动重命名章节与文件
python remove_watermark.py

# 3. 合并成整本
python union.py
```

## 其他说明

- [xiaohua.py](xiaohua.py) 中保留了较多注释掉的历史代码（Python 2 的 `reload`、`setdefaultencoding` 等），可作为历史抓取逻辑的参考，不影响当前运行。
- 目标站点与解析规则（XPath 路径、`replace` 清洗文案）与具体小说网站绑定，站点改版后需同步调整。