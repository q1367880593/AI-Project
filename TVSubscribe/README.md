# TVSubscribe 影视订阅

一个多用户的影视订阅追踪工具：顶部 Tab 分离**剧集**与**电影**，通过 TMDB 抓取剧集的**完结状态**、**最新一季播出时间**、**上/下集信息**，以及电影的**上映状态**、**上映日期**、**片长**与**评分**，在网页上浏览、筛选、标记、分组与增删。账号体系带登录认证与**每用户数据隔离**，适合单机自用或家庭 / 小团队部署在 NAS 上共享。仅用 Python 标准库，无需安装第三方依赖。

## 功能特性

- **登录与多用户**：服务端会话认证（HttpOnly Cookie），每个用户的数据完全隔离；管理员可在设置页添加 / 删除用户、重置密码，不开放公开注册
- **双 Tab**：剧集 / 电影完全独立的数据源与配置，切换互不影响
- **筛选**：剧集按状态、出品方、观剧标记筛选；电影按上映状态、类型、语言（按 TMDB 原始语言自动归类：华语 / 日本 / 韩国 / 欧美 / 其他 / 未知）筛选
- **排序**：剧集按最后更新时间（默认）、首季播出时间、最新季播出时间；电影按上映日期、评分、片长，支持升/降序；筛选与排序状态写入地址栏，刷新后保留
- **观剧标记**：未观看 / 已追完（已看完）/ 已弃剧（已放弃），支持批量标记
- **看剧进度圆环**：剧集卡片右下角的细小圆环显示看剧进度（已看季数 / 总季数），点击圆环弹出面板快速标记「看到第几季」
- **分组**：剧集与电影都支持编辑模式批量勾选加入自定义分组；电影额外支持按 TMDB 系列自动归组（中文名优先）
- **编辑**：搜索 TMDB 实时添加（带详情预览与去重）、删除、标记、分组，全部直接落盘且不刷新页面
- **抓取**：IMDB 号优先匹配，文本兜底并自动回填 IMDB 号；自动回填中文名（主名无中文时从中文别名补取）；支持单部秒级更新；按 IMDb 去重；失败不覆盖已有数据

## 快速开始（本地）

1. 在 [data/config.json](data/config.json) 填入 TMDB API Key（无法直连 TMDB 时填 `proxy`，格式如 `http://127.0.0.1:1087`）；
2. 双击 [start.command](start.command) 启动本地服务（或 `python3 app/server.py`），浏览器打开 `http://127.0.0.1:38765/`；
3. 首次启动自动创建管理员账号 **xiaolongbao / 123456**，登录后**请立即在右上角齿轮设置里修改密码**；
4. 右上角齿轮：账号信息与退出登录、用户管理（仅管理员）、剧集 / 电影数据更新时间与全量抓取入口；
5. 点「✎ 编辑」进入编辑模式：搜索添加、删除、标记、分组——所有操作即时写入当前用户的数据文件。

## 账号与数据

- 账号存于 [data/users.json](data/users.json)：用户名 + PBKDF2 加盐哈希，密码不落明文；会话有效期 30 天，服务重启后需重新登录
- 每用户数据独立存放于 `data/users/<用户名>/`：
  - `shows.json` / `movies.json` 订阅配置（标题、IMDB 号、中文名、标记、分组、已看季数）
  - `data.js` / `movies_data.js` 抓取结果快照（自动生成，勿手改）
- 管理员删除用户后，其数据文件仍保留在服务器上（防误删，可手动清理）
- TMDB API Key 与代理为全局配置，所有用户共用

## Docker / NAS 部署

见 [docker-compose.yml](docker-compose.yml)：代码目录只读挂载，`data/` 目录读写挂载，容器重建数据不丢。

```
TVSubscribe/                  ← 整体拷贝到 NAS（如 /volume1/docker/tvsubscribe）
├── docker-compose.yml        ← 群晖 Container Manager「项目」导入
├── app/  web/                ← 只读挂载
└── data/                     ← 读写挂载（含 users.json、users/、config.json）
```

1. 群晖 Container Manager → 项目 → 新建：填项目名、选项目路径、上传 / 粘贴 compose 文件
2. 端口映射 `38765:38765`（如需改端号，同步改 server.py 的 `PORT` 与 compose 映射）
3. `data/config.json` 的 `proxy` 必须填**容器内可达**的代理（如 NAS 上的 Clash 容器：`http://<NAS局域网IP>:38768`），改配置后需重启容器生效
4. 浏览器访问 `http://<NAS局域网IP>:38765/`；公网访问走 NAS 自带反代 / 隧道，服务本身不提供鉴权外的东西，务必使用 HTTPS + 强密码

## 项目结构

```
TVSubscribe/
├── start.command            # 双击启动本地服务
├── docker-compose.yml       # Docker / 群晖部署配置
├── data/
│   ├── config.json          # TMDB API Key / 代理（全局）
│   ├── users.json           # 账号（含密码哈希）
│   └── users/<用户名>/       # 每用户数据：shows.json / movies.json / data.js / movies_data.js
├── app/
│   ├── fetch_tv.py          # 抓取脚本（全量 / 单部，--movies 抓电影），按用户目录读写
│   └── server.py            # 本地服务：登录会话、页面、搜索中转、写盘、抓取接口
└── web/
    ├── index.html / login.html / style.css / app.js   # 页面与登录页
    └── favicon.svg
```

## 命令行抓取（可选）

```bash
# 全量抓取剧集（默认归属用户目录，见 fetch_tv.py 的 DEFAULT_USER）
python3 app/fetch_tv.py

# 全量抓取电影
python3 app/fetch_tv.py --movies

# 只更新单部（按片名或 IMDB 号，秒级完成）
python3 app/fetch_tv.py "Dark"
python3 app/fetch_tv.py tt5753856
python3 app/fetch_tv.py --movies "Inception"
```

## 常见问题

- **搜索失败：HTTP 502**：检查 `config.json` 的 `proxy` 是否在服务所在环境可达（NAS 容器里 `127.0.0.1` 指向容器自身）；改完 config 必须重启服务 / 容器
- **端口被占用**：只有一个服务实例能占用 38765 端口，先关掉旧实例
- **忘记密码**：管理员可在设置页重置任意用户密码；若管理员密码也忘了，可用任意 Python 重新生成哈希或重建 `users.json`（数据不受影响）
- **页面行为没更新**：server 会自动给 JS/CSS 加版本号，正常刷新即可；个别情况用 Cmd+Shift+R 强制刷新
- **剧集识别错误**：给该条目补上正确的 `imdb_id`，之后走精确匹配（文本兜底可能把同名剧匹配错）
- **数据备份**：备份 `data/` 目录即可（含账号与全部用户数据）

## 数据来源

剧集与电影数据来自 [TMDB](https://www.themoviedb.org/)（The Movie Database）。海报图片由 TMDB 提供。