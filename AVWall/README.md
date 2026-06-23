# DMMSee NFO Scraper

批量抓取 `https://www.dmmsee.ink/<番号>` 页面，生成媒体库可识别的 `.nfo`、`Codename-poster.jpg`、`Codename-fanart.jpg`、`Codename.jpg` 和 `extrafanart/` 预览图。

## 安装

```bash
python3 -m pip install -r requirements.txt
python3 -m playwright install chromium
```

## 使用

把番号写进 `codes.txt`，一行一个：

```text
START-415
ABCD-123
```

运行：

```bash
python3 scrape_dmmsee.py --input codes.txt --output output
```

输出结构：

```text
output/
  START-415/
    START-415.nfo
    START-415-fanart.jpg
    START-415-poster.jpg
    START-415.jpg
    extrafanart/
      extrafanart-1.jpg
      extrafanart-2.jpg
```

## 说明

- 脚本使用 Playwright 打开网页，等待 `networkidle`，滚动页面触发懒加载，再等待图片加载。
- 图片下载使用 `.part` 临时文件，连接中断后会通过 `Range` 请求续传；服务器不支持续传时会自动重下。
- 如果页面结构变化导致字段不完整，脚本仍会优先使用 `og:title`、`og:image`、JSON-LD 和页面文本标签兜底。
- 如需观察网页加载过程，可以加 `--headed`。
- 如需重新下载已有文件，可以加 `--overwrite`。
