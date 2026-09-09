# TVSubscribe 美剧订阅

一个本地化的剧集订阅追踪工具：定期抓取订阅剧集的**完结状态**、**最新一季播出时间**与**上/下集信息**，并用纯静态网页展示。双击 `index.html` 即可查看，**无需启动本地服务**，也无需安装任何第三方依赖。

## 功能特性

- **剧集抓取**（`fetch_tv.py`）
  - 按优先级匹配 TMDB 剧集：IMDB 号 → TMDB ID → 文本搜索
  - 文本匹配确认后自动回填 IMDB 号到 `shows.json`
  - 自动回填中文剧名到 `shows.json`
  - 支持全量抓取与单部增量更新（秒级完成）
  - 网络抖动自动重试，支持配置代理
- **网页展示**（`index.html` + `style.css` + `app.js`）
  - 按最后更新时间排序（默认），另有首季播出时间、最新季播出时间排序，支持升/降序切换
  - 按剧集状态筛选（在播 / 已完结 / 已取消）
  - 按出品方筛选（HBO、Netflix、AMC…）
  - 卡片展示：中文名、原片名、状态徽章、出品方标签、最新季、上一集/下一集
  - 点击海报/剧名跳转 TMDB 剧集页，点击单集跳转 TMDB 集详情页
  - 吸顶毛玻璃筛选条、卡片入场动效、响应式布局（移动端适配）
  - 更新时间与收录总数显示在页面底部

## 项目结构

| 文件 | 说明 |
| --- | --- |
| `fetch_tv.py` | 抓取脚本（仅用 Python 标准库），输出 `data.js` |
| `config.json` | 配置：TMDB API Key（必填）、代理（可选） |
| `shows.json` | 订阅剧集列表（含 IMDB 号、中文名，可手动编辑） |
| `data.js` | 抓取结果，由脚本自动生成，**请勿手动编辑** |
| `index.html` / `style.css` / `app.js` | 静态展示页（筛选、排序、渲染逻辑） |
| `favicon.svg` / `favicon.png` / `apple-touch-icon.png` | 浏览器标签栏图标 |

## 使用步骤

1. 在 [config.json](config.json) 中填入 TMDB API Key（`api_key`），如网络需代理则填 `proxy`；

   ```json
   {
     "api_key": "你的TMDB_API_KEY",
     "proxy": "http://127.0.0.1:1087"
   }
   ```

2. 在 [shows.json](shows.json) 中维护订阅列表，条目支持三个字段：

   - `title`：剧名（用于文本搜索兜底）
   - `imdb_id`：IMDB 号（优先使用，精确匹配）
   - `name_zh`：中文名（脚本会从 TMDB 自动回填）

3. 运行抓取脚本：

   ```bash
   # 全量抓取
   python3 fetch_tv.py

   # 只更新单部剧（按剧名或 IMDB 号，秒级完成）
   python3 fetch_tv.py "Dark"
   python3 fetch_tv.py tt5753856
   ```

4. 双击打开 `index.html` 即可浏览（或拖入浏览器）。

## 常见问题

- **页面显示「暂无数据」**：请先运行 `python3 fetch_tv.py` 生成 `data.js`。
- **请求超时/失败**：检查 `config.json` 的 `proxy` 配置，脚本会对每次请求自动重试 2 次。
- **剧集识别错误**：优先给该条目补上正确的 `imdb_id`，之后将走精确匹配。文本搜索兜底可能把同名剧匹配错（如 `Dark` 曾被误匹配为 `Dark Matter`）。
- **增删剧目后**：编辑完 `shows.json` 后需重新执行全量抓取。

## 数据来源

剧集数据来自 [TMDB](https://www.themoviedb.org/)（The Movie Database）。海报图片由 TMDB 提供。