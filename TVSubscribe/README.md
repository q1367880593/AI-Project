# TVSubscribe 美剧订阅

一个本地化的剧集订阅追踪工具：定期抓取订阅剧集的**完结状态**、**最新一季播出时间**与**上/下集信息**，并在本地网页上浏览、筛选、标记与增删。仅用 Python 标准库，无需安装第三方依赖。

## 快速开始

1. 在 [data/config.json](data/config.json) 填入 TMDB API Key（如需翻墙访问 TMDB 再填 `proxy`）；
2. 双击 [start.command](start.command) 启动本地服务，浏览器自动打开页面；
3. 点「✎ 编辑」进入编辑模式：搜索添加剧集、删除、标记已追完/已弃剧——所有操作即时写入 `shows.json`；
4. 点「更新数据」全量抓取（或在终端执行 `python3 app/fetch_tv.py`）。

## 功能特性

- **筛选**：按剧集状态（在播 / 已完结 / 已取消）、出品方（HBO、Netflix…）、观剧标记（未标记 / 已追完 / 已弃剧）筛选
- **排序**：最后更新时间（默认）、首季播出时间、最新季播出时间，支持升/降序
- **编辑**：搜索 TMDB 实时添加（带详情预览与去重）、删除、标记观剧状态，全部直接落盘
- **抓取**：IMDB 号优先匹配，文本兜底并自动回填 IMDB 号；自动回填中文名（主名无中文时从中文别名补取，如《女巫阿加莎》）；支持单部秒级更新；网络失败自动重试
- **展示**：中文名、原片名、状态徽章、出品方标签、最新季、上一集/下一集，点击跳转 TMDB 详情页

## 项目结构

```
TVSubscribe/
├── start.command            # 双击启动本地服务
├── data/
│   ├── config.json          # TMDB API Key / 代理配置
│   └── shows.json           # 订阅列表（标题 / IMDB 号 / 中文名 / 标记），由页面自动维护
├── app/
│   ├── fetch_tv.py          # 抓取脚本（全量 / 单部），输出 web/data.js
│   └── server.py            # 本地服务：页面、搜索中转、写盘接口、全量抓取接口
└── web/
    ├── index.html / style.css / app.js   # 前端页面
    ├── data.js              # 抓取结果缓存，自动生成
    └── favicon.svg / favicon.png / apple-touch-icon.png
```

## 命令行抓取（可选）

```bash
# 全量抓取
python3 app/fetch_tv.py

# 只更新单部剧（按剧名或 IMDB 号，秒级完成）
python3 app/fetch_tv.py "Dark"
python3 app/fetch_tv.py tt5753856
```

## 常见问题

- **端口被占用**：只有一个服务实例能占用 8765 端口，先关掉旧的 server 窗口。
- **搜索/抓取超时**：检查 [config.json](config.json) 的 `proxy`（改端口后需重启服务与代理软件）。
- **页面行为没更新**：server 会自动给 JS/CSS 加版本号，正常刷新即可；个别情况可用 Cmd+Shift+R 强制刷新。
- **剧集识别错误**：给该条目补上正确的 `imdb_id`，之后将走精确匹配（文本兜底可能把同名剧匹配错）。

## 数据来源

剧集数据来自 [TMDB](https://www.themoviedb.org/)（The Movie Database）。海报图片由 TMDB 提供。