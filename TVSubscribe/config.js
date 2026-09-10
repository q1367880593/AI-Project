// 页面内「搜索添加」使用的 TMDB 配置（请与 config.json 保持一致）
window.TV_CONFIG = {
  // TMDB API Key
  "api_key": "3dfda7bf9cf30e833251c644fb7c6073",

  // 可选：CORS 代理转发前缀（页面无法直接使用 127.0.0.1:1087 这类 HTTP 代理）
  // 留空 = 浏览器直连 api.themoviedb.org（需要浏览器能翻墙，如开启系统代理）
  // 示例："https://api.allorigins.win/raw?url="
  // 请求方式：cors_proxy + encodeURIComponent(完整API地址)
  "cors_proxy": ""
};