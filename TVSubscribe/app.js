(function () {
  "use strict";

  var data = window.TV_DATA;
  var grid = document.getElementById("grid");
  var updatedAt = document.getElementById("updated-at");

  var TMDB_BASE = "https://www.themoviedb.org/tv/";

  function statusClass(status) {
    switch (status) {
      case "Ended": return "badge-ended";
      case "Returning Series": return "badge-returning";
      case "Canceled": return "badge-canceled";
      default: return "badge-other";
    }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function link(href, className, text) {
    var a = el("a", className, text);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function showUrl(id) { return TMDB_BASE + id; }
  function episodeUrl(id, season, episode) { return TMDB_BASE + id + "/season/" + season + "/episode/" + episode; }

  function formatDate(d) { return d || "—"; }

  function seasonLine(season) {
    if (!season) return null;
    return "最新季 S" + season.season_number + " · " + formatDate(season.air_date);
  }

  function episodeLink(show, ep) {
    if (!ep || show.tmdb_id == null || ep.season == null || ep.episode == null) return null;
    var text = "S" + ep.season + "E" + ep.episode + " · " + formatDate(ep.air_date);
    return link(episodeUrl(show.tmdb_id, ep.season, ep.episode), "ep-link", text);
  }

  function card(show) {
    var c = el("div", "card");

    var hasId = show.tmdb_id != null;
    var posterLink = link(hasId ? showUrl(show.tmdb_id) : "#", "poster-link");
    if (show.poster) {
      var img = el("img", "poster");
      img.src = show.poster;
      img.alt = show.name;
      img.loading = "lazy";
      posterLink.appendChild(img);
    } else {
      posterLink.appendChild(el("div", "poster-fallback", "无海报"));
    }
    c.appendChild(posterLink);

    var info = el("div", "info");

    var titleRow = el("div", "title-row");
    titleRow.appendChild(link(hasId ? showUrl(show.tmdb_id) : "#", "title", show.name || show.title));
    titleRow.appendChild(el("span", "badge " + statusClass(show.status), show.status_zh));
    info.appendChild(titleRow);

    if (show.original_name && show.original_name !== show.name) {
      info.appendChild(el("div", "original", show.original_name));
    }

    var meta = el("div", "meta");

    var lineSeason = seasonLine(show.latest_season);
    if (lineSeason) {
      meta.appendChild(el("div", "line", lineSeason));
    }

    if (show.status === "Returning Series" && show.next_episode) {
      var nextLink = episodeLink(show, show.next_episode);
      if (nextLink) {
        var n = el("div", "line");
        n.appendChild(el("span", "label", "下一集"));
        n.appendChild(nextLink);
        meta.appendChild(n);
      }
    } else if (show.last_episode) {
      var lastLink = episodeLink(show, show.last_episode);
      if (lastLink) {
        var l = el("div", "line");
        l.appendChild(el("span", "label", "上一集"));
        l.appendChild(lastLink);
        meta.appendChild(l);
      }
    }

    info.appendChild(meta);
    c.appendChild(info);
    return c;
  }

  function sortShows(shows) {
    return shows.slice().sort(function (a, b) {
      var da = a.last_air_date || "";
      var db = b.last_air_date || "";
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      if (da < db) return 1;
      if (da > db) return -1;
      return 0;
    });
  }

  function render() {
    if (!data || !data.shows || data.shows.length === 0) {
      grid.innerHTML = "";
      grid.appendChild(el("div", "empty", "暂无数据：请先运行 python3 fetch_tv.py 生成 data.js。"));
      return;
    }

    if (data.generated_at) {
      updatedAt.textContent = "更新于 " + data.generated_at;
    }

    grid.innerHTML = "";
    sortShows(data.shows).forEach(function (show) {
      if (!show.found) {
        grid.appendChild(el("div", "card", "未找到或抓取失败：" + (show.title || "")));
      } else {
        grid.appendChild(card(show));
      }
    });
  }

  render();
})();