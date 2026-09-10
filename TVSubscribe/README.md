# TVSubscribe 影视订阅

一个本地化的影视订阅追踪工具：顶部 Tab 分离**剧集**与**电影**，定期抓取剧集的**完结状态**、**最新一季播出时间**与**上/下集信息**，以及电影的**上映状态**、**上映日期**、**片长**与**评分**，并在本地网页上浏览、筛选、标记与增删。仅用 Python 标准库，无需安装第三方依赖。

## 快速开始

1. 在 [data/config.json](data/config.json) 填入 TMDB API Key（如需翻墙访问 TMDB 再填 `proxy`）；
2. 双击 [start.command](start.command) 启动本地服务，浏览器自动打开页面；
3. 顶部 Tab 切换剧集 / 电影，两类数据完全独立（列表文件、缓存文件互不干扰）；
4. 点「✎ 编辑」进入编辑模式：搜索添加、删除、标记——所有操作即时写入 `shows.json` / `movies.json`；
5. 点「更新数据」全量抓取当前 Tab 类型（或在终端执行 `python3 app/fetch_tv.py [--movies]`）。

## 功能特性

- **双 Tab**：剧集 / 电影完全独立的数据源与配置文件，切换互不影响
- **筛选**：剧集按状态（在播 / 已完结 / 已取消）、出品方、观剧标记筛选；电影按上映状态、类型筛选
- **排序**：剧集按最后更新时间（默认）、首季播出时间、最新季播出时间；电影按上映日期、评分、片长，支持升/降序
- **编辑**：搜索 TMDB 实时添加（带详情预览与去重）、删除、标记状态，全部直接落盘且不刷新页面
- **分组**：电影自动按 TMDB 系列归组（中文名优先）；编辑模式批量勾选可自定义分组、移出或覆盖自动系列
- **抓取**：IMDB 号优先匹配，文本兜底并自动回填 IMDB 号；自动回填中文名（主名无中文时从中文别名补取，如《女巫阿加莎》）；支持单部秒级更新；网络失败自动重试
- **展示**：中文名、原片名、状态徽章、类型标签、最新季、上一集/下一集（电影为上映日期 / 片长 / 评分），点击跳转 TMDB 详情页

## 项目结构

```
TVSubscribe/
├── start.command            # 双击启动本地服务
├── data/
│   ├── config.json          # TMDB API Key / 代理配置
│   ├── shows.json           # 剧集订阅列表（标题 / IMDB 号 / 中文名 / 标记），由页面自动维护
│   └── movies.json          # 电影订阅列表，格式同上，由页面自动维护
├── app/
│   ├── fetch_tv.py          # 抓取脚本（全量 / 单部，--movies 抓电影），输出 web/data.js 或 web/movies_data.js
│   └── server.py            # 本地服务：页面、搜索中转、写盘接口、全量抓取接口
└── web/
    ├── index.html / style.css / app.js   # 前端页面
    ├── data.js / movies_data.js          # 抓取结果缓存，自动生成
    └── favicon.svg / favicon.png / apple-touch-icon.png
```

## 命令行抓取（可选）

```bash
# 全量抓取剧集
python3 app/fetch_tv.py

# 全量抓取电影
python3 app/fetch_tv.py --movies

# 只更新单部（按片名或 IMDB 号，秒级完成）
python3 app/fetch_tv.py "Dark"
python3 app/fetch_tv.py tt5753856
python3 app/fetch_tv.py --movies "Inception"
```

## 常见问题

- **端口被占用**：只有一个服务实例能占用 8765 端口，先关掉旧的 server 窗口。
- **搜索/抓取超时**：检查 [config.json](config.json) 的 `proxy`（改端口后需重启服务与代理软件）。
- **页面行为没更新**：server 会自动给 JS/CSS 加版本号，正常刷新即可；个别情况可用 Cmd+Shift+R 强制刷新。
- **剧集识别错误**：给该条目补上正确的 `imdb_id`，之后将走精确匹配（文本兜底可能把同名剧匹配错）。

## 数据来源

剧集数据来自 [TMDB](https://www.themoviedb.org/)（The Movie Database）。海报图片由 TMDB 提供。