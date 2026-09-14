(function () {
  "use strict";

  /* ---------- 数据源与 Tab 配置 ---------- */
  var SOURCES = {
    tv: window.TV_DATA || { shows: [] },
    movie: window.MOVIE_DATA || { shows: [] }
  };
  var kind = "tv";       // 当前 Tab：tv | movie
  var data = SOURCES[kind];

  var KIND_CFG = {
    tv: {
      tmdbSlug: "tv",
      itemLabel: "剧集",
      fileName: "shows.json",
      sortOptions: [
        { value: "last_air_date", text: "最近更新" },
        { value: "first_air_date", text: "首播时间" },
        { value: "latest_season", text: "最新一季" }
      ],
      networkLabel: "出品方",
      tagline: "追剧进度 · 完结状态 · 最新季播出时间",
      markFinished: "已追完",
      markDropped: "已弃剧",
      markUnwatched: "未观看",
      searchPlaceholder: "输入剧名搜索，如 Westworld",
      manualTitleLabel: "剧名（英文 / 原文）",
      dialogTitle: "添加剧集",
      emptyHint: "暂无数据：点击「✎ 编辑」→「＋ 添加」录入剧集，或点「更新数据」全量抓取。",
      emptyFiltered: "没有符合条件的剧集。",
      markTitlePrefix: "标记观剧状态",
      deleteTitle: "移除该剧",
      refreshConfirm: "将调用 fetch_tv.py 全量抓取所有剧集（需几分钟，需代理可用），继续？"
    },
    movie: {
      tmdbSlug: "movie",
      itemLabel: "电影",
      fileName: "movies.json",
      sortOptions: [
        { value: "release_date", text: "上映日期" },
        { value: "vote_average", text: "评分" },
        { value: "runtime", text: "片长" }
      ],
      networkLabel: "类型",
      tagline: "观影记录 · 上映状态 · 上映日期",
      markFinished: "已看完",
      markDropped: "已放弃",
      markUnwatched: "未观看",
      searchPlaceholder: "输入电影名搜索，如 Inception",
      manualTitleLabel: "电影名（英文 / 原文）",
      dialogTitle: "添加电影",
      emptyHint: "暂无数据：点击「✎ 编辑」→「＋ 添加」录入电影，或点「更新数据」全量抓取。",
      emptyFiltered: "没有符合条件的电影。",
      markTitlePrefix: "标记观影状态",
      deleteTitle: "移除该电影",
      refreshConfirm: "将调用 fetch_tv.py --movies 全量抓取所有电影（需几分钟，需代理可用），继续？"
    }
  };

  function cfg() { return KIND_CFG[kind]; }

  /* ---------- DOM ---------- */
  var grid = document.getElementById("grid");
  var updatedAt = document.getElementById("updated-at");
  var tagline = document.getElementById("tagline");
  var tabs = document.getElementById("tabs");
  var statusSel = document.getElementById("filter-status");
  var statusField = document.getElementById("status-field");
  var networkSel = document.getElementById("filter-network");
  var networkLabel = document.getElementById("network-label");
  var genreField = document.getElementById("genre-field");
  var genreSel = document.getElementById("filter-genre");
  var originField = document.getElementById("origin-field");
  var originSel = document.getElementById("filter-origin");
  var sortSel = document.getElementById("sort-key");
  var sortDirBtn = document.getElementById("sort-dir");
  var resultCount = document.getElementById("result-count");
  var footerCount = document.getElementById("footer-count");

  var btnAdd = document.getElementById("btn-add");
  var btnRefresh = document.getElementById("btn-refresh");
  var btnEdit = document.getElementById("btn-edit");
  var editorRow = document.getElementById("editor-row");
  var btnGroup = document.getElementById("btn-group");
  var groupViewSel = document.getElementById("group-view");
  var groupOverlay = document.getElementById("group-overlay");
  var groupLabel = document.getElementById("group-label");
  var groupHint = document.getElementById("group-hint");
  var groupList = document.getElementById("group-list");
  var groupInput = document.getElementById("group-input");
  var btnGroupConfirm = document.getElementById("group-confirm");
  var btnGroupDismiss = document.getElementById("group-dismiss");
  var btnGroupCancel = document.getElementById("group-cancel");
  var confirmOverlay = document.getElementById("confirm-overlay");
  var confirmTitle = document.getElementById("confirm-title");
  var confirmMsg = document.getElementById("confirm-msg");
  var confirmActions = document.getElementById("confirm-actions");
  var btnImport = document.getElementById("btn-import");
  var importOverlay = document.getElementById("import-overlay");
  var importText = document.getElementById("import-text");
  var btnImportConfirm = document.getElementById("import-confirm");
  var btnImportCancel = document.getElementById("import-cancel");
  var btnSelectAll = document.getElementById("btn-select-all");
  var btnBatchMark = document.getElementById("btn-batch-mark");
  var searchInput = document.getElementById("search-input");
  var searchClear = document.getElementById("search-clear");
  var markSel = document.getElementById("filter-mark");
  var markOptFinished = document.getElementById("mark-opt-finished");
  var markOptDropped = document.getElementById("mark-opt-dropped");
  var markOptUnwatched = document.getElementById("mark-opt-unwatched");
  var markFilterFinished = document.getElementById("mark-filter-finished");
  var markFilterDropped = document.getElementById("mark-filter-dropped");
  var markFilterUnwatched = document.getElementById("mark-filter-unwatched");
  var btnSettings = document.getElementById("btn-settings");
  var settingsLogout = document.getElementById("settings-logout");
  var settingsUserName = document.getElementById("settings-user-name");
  var settingsRole = document.getElementById("settings-role");
  var settingsAvatar = document.getElementById("settings-avatar");
  var settingsUsersSection = document.getElementById("settings-users-section");
  var settingsUpdatedTv = document.getElementById("settings-updated-tv");
  var settingsUpdatedMovie = document.getElementById("settings-updated-movie");
  var settingsRefreshTv = document.getElementById("settings-refresh-tv");
  var settingsRefreshMovie = document.getElementById("settings-refresh-movie");
  var refreshStatusTv = document.getElementById("refresh-status-tv");
  var refreshStatusMovie = document.getElementById("refresh-status-movie");
  var settingsOverlay = document.getElementById("settings-overlay");
  var settingsAddName = document.getElementById("settings-add-name");
  var settingsAddPass = document.getElementById("settings-add-pass");
  var settingsAddBtn = document.getElementById("settings-add-btn");
  var settingsError = document.getElementById("settings-error");
  var settingsUserList = document.getElementById("settings-user-list");
  var settingsClose = document.getElementById("settings-close");
  var overlay = document.getElementById("add-overlay");
  var markOverlay = document.getElementById("mark-overlay");
  var markLabel = document.getElementById("mark-label");
  var addTitleLabel = document.getElementById("add-title-label");
  var inputTitle = document.getElementById("add-input-title");
  var searchResultsBox = document.getElementById("search-results");
  var searchHint = document.getElementById("search-hint");
  var viewSearch = document.getElementById("add-view-search");
  var viewPreview = document.getElementById("add-view-preview");
  var viewManual = document.getElementById("add-view-manual");
  var previewBox = document.getElementById("preview-box");
  var mTitleLabel = document.getElementById("add-m-title-label");
  var mTitle = document.getElementById("add-m-title");
  var mZh = document.getElementById("add-m-zh");
  var mImdb = document.getElementById("add-m-imdb");

  var TMDB_BASE = "https://www.themoviedb.org/";
  var TMDB_SEARCH = "https://www.themoviedb.org/search?query=";
  var TMDB_IMG = "https://image.tmdb.org/t/p/w200";
  var STATUS_ORDER = ["Returning Series", "Ended", "Canceled", "In Production", "Planned", "Pilot"];
  var STATUS_ZH = {
    "Returning Series": "在播",
    "Ended": "已完结",
    "Canceled": "已取消",
    "In Production": "制作中",
    "Planned": "计划中",
    "Pilot": "试播集"
  };
  var MOVIE_STATUS_ORDER = ["Released", "Post Production", "In Production", "Planned", "Rumored", "Canceled"];
  var MOVIE_STATUS_ZH = {
    "Released": "已上映",
    "Post Production": "后期制作",
    "In Production": "制作中",
    "Planned": "计划中",
    "Rumored": "传闻",
    "Canceled": "已取消"
  };

  var editMode = false;
  var selection = [];   // 已勾选条目的 _key（编辑模式，内存态）

  // 语言圈判定码：直接按 TMDB 原始语言 original_language 区分
  var ZH_LANGS = { zh: true, cn: true, yue: true };
  var WEST_LANGS = {
    en: true, fr: true, de: true, it: true, es: true, pt: true,
    nl: true, da: true, sv: true, no: true, fi: true, is: true,
    pl: true, cs: true, sk: true, hu: true, ro: true, el: true
  };

  function isoSet(countries) {
    var set = {};
    for (var i = 0; i < countries.length; i++) {
      var iso = ((countries[i].iso || countries[i].iso_3166_1 || "") + "").trim().toUpperCase();
      if (iso) set[iso] = true;
    }
    return set;
  }

  function hasAny(set, codes) {
    if (!set) return false;
    for (var k in codes) {
      if (set[k]) return true;
    }
    return false;
  }

  /* 语言分类：原始语言 zh/cn(yue) → 华语；ja → 日本；ko → 韩国；欧美语言 → 欧美；其余 → 其他；无数据 → 未知 */
  function originTag(s) {
    var l = ((s.original_language || "") + "").trim().toLowerCase();
    if (!l) return "unknown";
    if (ZH_LANGS[l]) return "chinese";
    if (l === "ja") return "japan";
    if (l === "ko") return "korea";
    if (WEST_LANGS[l]) return "west";
    return "other";
  }

  /* 常见产地 ISO 代码 → 中文短名（TMDB 返回的 name 常为英文长名，显示时优先用映射） */
  var COUNTRY_ZH = {
    US: "美国", GB: "英国", JP: "日本", KR: "韩国", FR: "法国", DE: "德国",
    CN: "中国大陆", HK: "中国香港", TW: "中国台湾", IN: "印度", CA: "加拿大",
    AU: "澳大利亚", ES: "西班牙", IT: "意大利", RU: "俄罗斯", MX: "墨西哥",
    BR: "巴西", NZ: "新西兰", TH: "泰国", SG: "新加坡", IE: "爱尔兰",
    SE: "瑞典", NO: "挪威", DK: "丹麦", NL: "荷兰", BE: "比利时",
    PT: "葡萄牙", PL: "波兰", CZ: "捷克", AT: "奥地利", CH: "瑞士",
    GR: "希腊", IS: "冰岛", FI: "芬兰", HU: "匈牙利", RO: "罗马尼亚",
    SK: "斯洛伐克", LU: "卢森堡"
  };

  function countryName(c) {
    var iso = ((c.iso || c.iso_3166_1 || "") + "").trim().toUpperCase();
    if (COUNTRY_ZH[iso]) return COUNTRY_ZH[iso];
    var n = ((c.name || "") + "").trim();
    return n || iso;
  }

  /* ---------- 工具函数 ---------- */
  function statusClass(status) {
    if (kind === "movie") {
      if (status === "Released") return "badge-returning";
      if (status === "Canceled") return "badge-canceled";
      return "badge-other";
    }
    switch (status) {
      case "Ended": return "badge-ended";
      case "Returning Series": return "badge-returning";
      case "Canceled": return "badge-canceled";
      default: return "badge-other";
    }
  }

  function statusZh(status) {
    if (kind === "movie") return MOVIE_STATUS_ZH[status] || status;
    return STATUS_ZH[status] || status;
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

  function detailUrl(show) {
    if (show.tmdb_id != null) return TMDB_BASE + cfg().tmdbSlug + "/" + show.tmdb_id;
    return TMDB_SEARCH + encodeURIComponent(show.title || "");
  }

  function episodeUrl(id, season, episode) { return TMDB_BASE + "tv/" + id + "/season/" + season + "/episode/" + episode; }

  function formatDate(d) { return d || "—"; }

  function showKey(show) {
    if (show.imdb_id) return "imdb|" + show.imdb_id;
    return "title|" + (show.title || "");
  }

  /* 重复检测：双方都有 IMDb 号时按 IMDb 精确比对（重名不误判）；否则回退标题比对 */
  function isDup(entry) {
    var candImdb = entry.imdb_id || null;
    var candTitle = (entry.title || "").trim().toLowerCase();
    return allShows().some(function (s) {
      var sImdb = s.imdb_id || null;
      if (candImdb && sImdb) return candImdb === sImdb;
      return (s.title || "").trim().toLowerCase() === candTitle;
    });
  }

  function allShows() {
    return (data && data.shows ? data.shows : []).map(function (s) {
      s._key = showKey(s);
      return s;
    });
  }

  /* 把完整列表 POST 给 server.py 写盘；成功后更新内存数据并重渲染（不刷新页面） */
  function persistEntries(entries, onFail, onSuccess) {
    fetch("/api/save-shows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: entries, kind: kind })
    })
      .then(function (r) {
        if (r.status === 401) {
          redirectToLogin();
          throw new Error("登录已失效");
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function () {
        data.shows = entries;
        render();
        if (onSuccess) onSuccess();
      })
      .catch(function (e) {
        if (onFail) onFail();
        window.alert("写入 " + cfg().fileName + " 失败：" + e.message + "（请确认 server.py 正在运行）");
        render();
      });
  }

  /* ---------- 卡片 ---------- */
  function episodeLink(show, ep) {
    if (!ep || show.tmdb_id == null || ep.season == null || ep.episode == null) return null;
    var text = "S" + ep.season + "E" + ep.episode + " · " + formatDate(ep.air_date);
    return link(episodeUrl(show.tmdb_id, ep.season, ep.episode), "ep-link", text);
  }

  function markBadge(show) {
    var mark = show.mark || "";
    var text = mark === "" ? "＋ 标记" : (
      mark === "finished" ? cfg().markFinished :
      mark === "dropped" ? cfg().markDropped : cfg().markUnwatched);
    var btn = el("button", "mark-btn", text);
    btn.type = "button";
    btn.title = cfg().markTitlePrefix + "（直接写入 " + cfg().fileName + "）";
    if (mark === "finished") btn.classList.add("mark-finished");
    if (mark === "dropped") btn.classList.add("mark-dropped");
    if (mark === "unwatched") btn.classList.add("mark-unwatched");
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      openMarkDialog(show);
    });
    return btn;
  }

  function deleteBtn(show) {
    var btn = el("button", "del-btn", "×");
    btn.type = "button";
    btn.title = cfg().deleteTitle + "（直接写入 " + cfg().fileName + "）";
    btn.setAttribute("aria-label", cfg().deleteTitle + ": " + (show.name || show.title));
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      var label = show.name || show.title;
      showDialog("确认移除", "确认移除「" + label + "」？\n将立即从 " + cfg().fileName + " 移除。", [
        { label: "取消", value: false },
        { label: "移除", value: true, primary: true }
      ]).then(function (ok) {
        if (!ok) return;
        persistEntries(allShows().filter(function (s) { return s._key !== show._key; }));
      });
    });
    return btn;
  }

  function chipRow(nets, max) {
    if (!nets || !nets.length) return null;
    var limit = max == null ? 2 : max;
    var row = el("div", "net-row");
    nets.slice(0, limit).forEach(function (n) {
      row.appendChild(el("span", "chip", n));
    });
    if (nets.length > limit) {
      row.appendChild(el("span", "chip chip-more", "+" + (nets.length - limit)));
    }
    return row;
  }

  /* 未抓取提示 + 单独抓取按钮（剧集 / 电影通用） */
  function unfetchedMeta(show) {
    var meta = el("div", "meta");
    meta.appendChild(el("div", "line muted", "尚未抓取数据"));
    var btn = el("button", "fetch-one-btn", "单独抓取");
    btn.type = "button";
    btn.title = "仅抓取该条目（几秒完成）";
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      fetchOne(show);
    });
    meta.appendChild(btn);
    return meta;
  }

  /* 展示用地区：优先主产地（origin_country），否则用制片国列表 */
  function displayCountryNames(show) {
    var oc = show.origin_country || [];
    if (oc.length) {
      return oc.map(function (isoStr) {
        var iso = (isoStr + "").trim().toUpperCase();
        return COUNTRY_ZH[iso] || isoStr;
      });
    }
    var names = [];
    (show.countries || []).forEach(function (c) {
      var n = countryName(c) || "";
      if (n) names.push(n);
    });
    return names;
  }

  function movieMeta(show) {
    var meta = el("div", "meta");
    if (!show.status) {
      return unfetchedMeta(show);
    }
    var cnames = displayCountryNames(show);
    var dateStr = show.release_date ? formatDate(show.release_date) : "";
    if (dateStr || cnames.length) {
      var rl = el("div", "line");
      rl.appendChild(el("span", "label", "上映"));
      var parts = [];
      if (dateStr) parts.push(dateStr);
      if (cnames.length) parts.push(cnames.join(" / "));
      rl.appendChild(el("span", null, parts.join(" · ")));
      meta.appendChild(rl);
    }
    if (show.runtime != null) {
      var tl = el("div", "line");
      tl.appendChild(el("span", "label", "片长"));
      tl.appendChild(el("span", null, show.runtime + " 分钟"));
      meta.appendChild(tl);
    }
    if (show.vote_average != null) {
      var vl = el("div", "line");
      vl.appendChild(el("span", "label", "评分"));
      var sb = el("span", "score-line");
      var stars = el("span", "stars");
      stars.appendChild(el("span", "stars-bg", "★★★★★"));
      var pct = Math.max(0, Math.min(100, show.vote_average * 10));
      var fg = el("span", "stars-fg", "★★★★★");
      fg.style.width = pct + "%";
      stars.appendChild(fg);
      sb.appendChild(stars);
      sb.appendChild(el("span", "score-num", (+show.vote_average).toFixed(1)));
      vl.appendChild(sb);
      meta.appendChild(vl);
    }
    return meta;
  }

  function tvMeta(show) {
    var meta = el("div", "meta");
    if (!show.status) {
      return unfetchedMeta(show);
    }
    var season = show.latest_season;
    if (season) {
      meta.appendChild(el("div", "line", "最新季 S" + season.season_number + " · " + formatDate(season.air_date)));
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
    return meta;
  }

  /* 「未找到或抓取失败」条目的简化卡片（编辑模式下支持删除；可一键重新添加） */
  function failedCard(show) {
    var c = el("div", "card");
    var info = el("div", "info");
    var titleRow = el("div", "title-row");
    titleRow.appendChild(el("div", "title", "未找到或抓取失败：" + (show.title || show.imdb_id || "")));
    if (editMode) {
      titleRow.appendChild(deleteBtn(show));
    }
    info.appendChild(titleRow);
    var kw = (show.title || "").trim();
    if (kw) {
      var fix = el("button", "fetch-one-btn", "重新添加");
      fix.type = "button";
      fix.title = "以「" + kw + "」为关键词进入添加流程";
      fix.addEventListener("click", function (ev) {
        ev.preventDefault();
        openAddWithKeyword(kw);
      });
      var meta = el("div", "meta");
      meta.appendChild(fix);
      info.appendChild(meta);
    }
    c.appendChild(info);
    return c;
  }

  function card(show) {
    var c = el("div", "card");
    var mark = show.mark || "";
    if (mark === "dropped") c.classList.add("dropped");
    if (mark === "finished") c.classList.add("finished-card");

    var posterLink = link(detailUrl(show), "poster-link");
    if (show.poster) {
      var img = el("img", "poster");
      img.src = show.poster;
      img.alt = show.name || show.title;
      img.loading = "lazy";
      posterLink.appendChild(img);
    } else {
      posterLink.appendChild(el("div", "poster-fallback", "无海报"));
    }
    c.appendChild(posterLink);

    var info = el("div", "info");

    var titleRow = el("div", "title-row");
    if (editMode) {
      var check = el("input", "card-check");
      check.type = "checkbox";
      check.checked = selection.indexOf(show._key) >= 0;
      check.title = "勾选后点击工具栏「分组」";
      check.setAttribute("aria-label", "选择 " + (show.name || show.title));
      check.addEventListener("change", function () {
        var i = selection.indexOf(show._key);
        if (i >= 0) selection.splice(i, 1);
        else selection.push(show._key);
        applyEditModeUI();
      });
      titleRow.appendChild(check);
    }
    var titleLink = link(detailUrl(show), "title", show.name || show.title);
    var shown = (show.name || show.title || "").trim();
    var orig = (show.original_name || show.title || "").trim();
    if (orig && orig !== shown) {
      // 中文名下不再常显英文名，悬浮标题时以毛玻璃浮窗展示英文名
      var tw = el("span", "title-wrap");
      tw.appendChild(titleLink);
      tw.appendChild(el("span", "title-tip", orig));
      titleRow.appendChild(tw);
    } else {
      titleRow.appendChild(titleLink);
    }
    if (kind !== "movie") {
      if (show.status) {
        titleRow.appendChild(el("span", "badge " + statusClass(show.status), show.status_zh || statusZh(show.status)));
      } else {
        titleRow.appendChild(el("span", "badge badge-other", "待抓取"));
      }
    }
    if (editMode) {
      titleRow.appendChild(markBadge(show));
      titleRow.appendChild(deleteBtn(show));
    }
    info.appendChild(titleRow);

    var chipSource = kind === "movie" ? show.networks : (show.genres && show.genres.length ? show.genres : show.networks);
    var chips = chipRow(chipSource, 6);
    if (chips) info.appendChild(chips);

    info.appendChild(kind === "movie" ? movieMeta(show) : tvMeta(show));
    c.appendChild(info);
    if (kind === "tv" && show.found && seasonTotal(show) > 0) {
      c.appendChild(progressRing(show));
    }
    return c;
  }

  /* ---------- 看剧进度圆环（卡片右下角，点击弹出快速标记「看到第几季」） ---------- */
  var openRingPop = null;   // 当前展开的圆环弹窗（同一时刻只开一个）

  function closeRingPop() {
    if (openRingPop) {
      openRingPop.classList.remove("ring-open");
      openRingPop = null;
    }
  }

  function seasonTotal(show) {
    if (show.number_of_seasons && show.number_of_seasons > 0) return show.number_of_seasons;
    if (show.latest_season && show.latest_season.season_number > 0) return show.latest_season.season_number;
    return 0;
  }

  function watchedSeasons(show) {
    var w = show.watched_seasons;
    return (typeof w === "number" && w >= 0) ? w : 0;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  function progressRing(show) {
    var total = seasonTotal(show);
    var watched = Math.min(watchedSeasons(show), total);
    var pct = Math.round(watched / total * 100);

    var wrap = el("div", "ring-wrap");
    wrap.title = "看剧进度 " + watched + "/" + total + " 季";

    var svg = svgEl("svg", { viewBox: "0 0 36 36", "class": "ring-svg" });
    svg.appendChild(svgEl("circle", { cx: 18, cy: 18, r: 15.5, "class": "ring-bg" }));
    var C = 2 * Math.PI * 15.5;
    var fg = svgEl("circle", { cx: 18, cy: 18, r: 15.5, "class": "ring-fg" });
    fg.setAttribute("stroke-dasharray", C.toFixed(2));
    fg.setAttribute("stroke-dashoffset", (C * (1 - pct / 100)).toFixed(2));
    svg.appendChild(fg);
    wrap.appendChild(svg);

    wrap.appendChild(seasonPopup(show, total, watched));

    wrap.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (wrap.classList.contains("ring-open")) {
        closeRingPop();
      } else {
        closeRingPop();
        wrap.classList.add("ring-open");
        openRingPop = wrap;
      }
    });
    return wrap;
  }

  function seasonPopup(show, total, watched) {
    var pop = el("div", "ring-pop");

    var head = el("div", "ring-pop-head");
    head.appendChild(el("span", "ring-pop-title", "标记看到第几季"));
    if (watched > 0) {
      var clear = el("button", "ring-clear", "清零");
      clear.type = "button";
      clear.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        setWatched(show, 0);
      });
      head.appendChild(clear);
    }
    pop.appendChild(head);

    var grid = el("div", "ring-grid");
    for (var n = 1; n <= total; n++) {
      (function (n) {
        var b = el("button", "season-dot" + (n <= watched ? " seen" : ""), "S" + n);
        b.type = "button";
        b.title = "标记看到第 " + n + " 季";
        b.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          setWatched(show, n);
        });
        grid.appendChild(b);
      })(n);
    }
    pop.appendChild(grid);
    return pop;
  }

  /* 写入 watched_seasons；失败回滚（成功后 persistEntries 自动重渲染） */
  function setWatched(show, value) {
    closeRingPop();
    var old = show.watched_seasons;
    show.watched_seasons = value > 0 ? value : null;
    persistEntries(allShows(), function () {
      show.watched_seasons = old;
    });
  }

  /* 点击圆环以外区域时关闭弹窗 */
  document.addEventListener("click", function (ev) {
    if (openRingPop && !openRingPop.contains(ev.target)) closeRingPop();
  });

  /* ---------- 登录用户与用户管理（仅管理员可管理） ---------- */
  var currentUser = null;

  function redirectToLogin() {
    window.location.href = "/login.html";
  }

  /* 统一 fetch：401 一律跳登录页；非 2xx 抛出后端 error 信息 */
  function requestJSON(url, opts) {
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) {
        redirectToLogin();
        throw new Error("登录已失效");
      }
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      });
    });
  }

  function applyUserUI() {
    if (!currentUser) return;
    settingsUserName.textContent = currentUser.username;
    settingsAvatar.textContent = (currentUser.username || "?").charAt(0).toUpperCase();
    settingsRole.textContent = currentUser.is_admin ? "管理员" : "用户";
    settingsUsersSection.hidden = !currentUser.is_admin;
  }

  function bootstrapUser() {
    fetch("/api/me").then(function (r) {
      if (r.status === 401) {
        redirectToLogin();
        return null;
      }
      return r.json();
    }).then(function (info) {
      if (!info) return;
      currentUser = info;
      applyUserUI();
    });
  }

  function doLogout() {
    fetch("/api/logout", { method: "POST" }).then(redirectToLogin).catch(redirectToLogin);
  }

  function settingsFlash(msg) {
    settingsError.textContent = msg;
    settingsError.hidden = false;
  }

  function loadSettingsUsers() {
    requestJSON("/api/users").then(function (j) {
      renderSettingsUsers(j.users || []);
    }).catch(function (e) {
      settingsFlash("加载用户失败：" + e.message);
    });
  }

  function renderSettingsUsers(users) {
    settingsUserList.innerHTML = "";
    users.forEach(function (u) {
      var row = el("div", "settings-user");
      row.appendChild(el("span", "settings-user-name", u.username));
      row.appendChild(el("span", "settings-user-role", u.role === "admin" ? "管理员" : "用户"));
      if (u.role !== "admin") {
        var del = el("button", "tb-btn settings-user-del", "删除");
        del.type = "button";
        del.addEventListener("click", function () {
          showDialog("确认删除", "确认删除用户「" + u.username + "」？\n该用户的订阅数据文件会保留在服务器上。", [
            { label: "取消", value: false },
            { label: "删除", value: true, primary: true }
          ]).then(function (ok) {
            if (!ok) return;
            requestJSON("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete", username: u.username })
            }).then(function () {
              settingsFlash("已删除用户「" + u.username + "」");
              loadSettingsUsers();
            }).catch(function (e) { settingsFlash(e.message); });
          });
        });
        row.appendChild(del);
      }
      var reset = el("button", "tb-btn settings-user-reset", "重置密码");
      reset.type = "button";
      reset.addEventListener("click", function () {
        var np = window.prompt("为「" + u.username + "」设置新密码（至少 6 位）");
        if (np == null) return;
        if (np.length < 6) {
          settingsFlash("密码至少 6 位");
          return;
        }
        requestJSON("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reset_password", username: u.username, password: np })
        }).then(function () {
          if (currentUser && u.username === currentUser.username) {
            window.alert("管理员密码已修改，请重新登录。");
            redirectToLogin();
            return;
          }
          settingsFlash("已重置「" + u.username + "」的密码");
        }).catch(function (e) { settingsFlash(e.message); });
      });
      row.appendChild(reset);
      settingsUserList.appendChild(row);
    });
  }

  function openSettings() {
    settingsError.hidden = true;
    settingsAddName.value = "";
    settingsAddPass.value = "";
    settingsUpdatedTv.textContent = SOURCES.tv.generated_at || "—";
    settingsUpdatedMovie.textContent = SOURCES.movie.generated_at || "—";
    if (currentUser && currentUser.is_admin) loadSettingsUsers();
    settingsOverlay.hidden = false;
  }

  function closeSettings() {
    settingsOverlay.hidden = true;
  }

  function addSettingsUser() {
    var name = settingsAddName.value.trim();
    var pass = settingsAddPass.value;
    if (!name || !pass) {
      settingsFlash("请填写用户名和密码");
      return;
    }
    requestJSON("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", username: name, password: pass })
    }).then(function () {
      settingsFlash("已添加用户「" + name + "」，对方即可登录使用（数据独立）");
      settingsAddName.value = "";
      settingsAddPass.value = "";
      loadSettingsUsers();
    }).catch(function (e) { settingsFlash(e.message); });
  }

  /* ---------- 筛选与排序 ---------- */
  function resetFilterOptions() {
    statusSel.innerHTML = "";
    networkSel.innerHTML = "";
    genreSel.innerHTML = "";
    var so = el("option", null, "全部");
    so.value = "";
    statusSel.appendChild(so);
    var no = el("option", null, "全部");
    no.value = "";
    networkSel.appendChild(no);
    var go = el("option", null, "全部");
    go.value = "";
    genreSel.appendChild(go);

    var shows = allShows();
    if (!shows.length) return;

    var statuses = {};
    shows.forEach(function (s) {
      if (s.found && s.status) statuses[s.status] = s.status_zh || statusZh(s.status);
    });
    var order = kind === "movie" ? MOVIE_STATUS_ORDER : STATUS_ORDER;
    Object.keys(statuses).sort(function (a, b) {
      var ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia < 0) ia = 999;
      if (ib < 0) ib = 999;
      return ia - ib;
    }).forEach(function (st) {
      var o = el("option", null, statuses[st]);
      o.value = st;
      statusSel.appendChild(o);
    });

    var nets = {};
    shows.forEach(function (s) {
      (s.networks || []).forEach(function (n) { if (n) nets[n] = true; });
    });
    Object.keys(nets).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (n) {
      var o = el("option", null, n);
      o.value = n;
      networkSel.appendChild(o);
    });

    var gens = {};
    shows.forEach(function (s) {
      (s.genres || []).forEach(function (g) { if (g) gens[g] = true; });
    });
    Object.keys(gens).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (g) {
      var o = el("option", null, g);
      o.value = g;
      genreSel.appendChild(o);
    });
  }

  function resetSortOptions() {
    sortSel.innerHTML = "";
    cfg().sortOptions.forEach(function (o) {
      var opt = el("option", null, o.text);
      opt.value = o.value;
      sortSel.appendChild(opt);
    });
  }

  function sortValue(show, key) {
    if (key === "latest_season") {
      return show.latest_season ? (show.latest_season.air_date || "") : "";
    }
    return show[key] || "";
  }

  function sortShows(shows, key, asc) {
    return shows.slice().sort(function (a, b) {
      var va = sortValue(a, key), vb = sortValue(b, key);
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
  }

  /* 按当前筛选条件过滤并排序后的列表（渲染与全选共用） */
  function filteredList() {
    var merged = allShows();
    var status = statusSel.value;
    var network = networkSel.value;
    var genreFilter = genreSel.value;
    var markFilter = markSel.value;
    var originFilter = originSel.value;
    var asc = sortDirBtn.dataset.dir === "asc";
    var q = searchInput.value.trim().toLowerCase();

    var list = merged.filter(function (s) {
      if (status && s.status !== status) return false;
      if (network && (s.networks || []).indexOf(network) < 0) return false;
      if (genreFilter && (s.genres || []).indexOf(genreFilter) < 0) return false;
      var mark = s.mark || "";
      if (markFilter === "none" && mark) return false;
      if (markFilter === "finished" && mark !== "finished") return false;
      if (markFilter === "dropped" && mark !== "dropped") return false;
      if (markFilter === "unwatched" && mark !== "unwatched") return false;
      if (originFilter && originTag(s) !== originFilter) return false;
      if (q) {
        // 中英文模糊匹配：中文名 / 原名 / 标题
        var hay = ((s.name || "") + " " + (s.title || "") + " " + (s.original_name || "")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    return sortShows(list, sortSel.value, asc);
  }

  /* ---------- 渲染 ---------- */
  function render() {
    syncURL();
    var merged = allShows();
    if (merged.length === 0) {
      grid.innerHTML = "";
      grid.appendChild(el("div", "empty", cfg().emptyHint));
      resultCount.textContent = "";
      if (data && data.generated_at) {
        updatedAt.textContent = "更新于 " + data.generated_at;
      }
      footerCount.textContent = "暂无" + cfg().itemLabel;
      return;
    }

    if (data && data.generated_at) {
      updatedAt.textContent = "更新于 " + data.generated_at;
    }
    footerCount.textContent = "共收录 " + merged.length + " 部" + cfg().itemLabel;

    var sorted = filteredList();
    var hasFilter = statusSel.value || networkSel.value || genreSel.value || markSel.value || originSel.value
      || searchInput.value.trim();

    if (hasFilter) {
      resultCount.innerHTML = "当前 <b>" + sorted.length + "</b> / " + merged.length + " 部";
    } else {
      resultCount.innerHTML = "共 <b>" + merged.length + "</b> 部";
    }

    grid.innerHTML = "";
    if (sorted.length === 0) {
      grid.appendChild(el("div", "empty", cfg().emptyFiltered));
      return;
    }
    if (groupViewSel.value === "grouped") {
      renderGrouped(sorted);
      return;
    }
    sorted.forEach(function (show, idx) {
      var node;
      if (!show.found) {
        node = failedCard(show);
      } else {
        node = card(show);
      }
      node.style.animationDelay = Math.min(idx, 24) * 14 + "ms";
      grid.appendChild(node);
    });
  }

  /* 分组名计算：手动 group 优先，无手动时使用 TMDB 系列名（中文优先）；都没有返回 "" */
  function groupNameOf(s) {
    var g = (s.group || "").trim();
    if (g) return g;
    var c = s.collection;
    if (c && typeof c === "object") {
      var n = ((c.name_zh || c.name || "") + "").trim();
      if (n) return n;
    }
    return "";
  }

  /* 按分组聚合渲染：组内沿用全局排序，组间按组内最新上映日期降序，未分组放最后 */
  function renderGrouped(list) {
    var byName = {};
    var ungrouped = [];
    list.forEach(function (s) {
      var g = groupNameOf(s);
      if (g) {
        if (!byName[g]) byName[g] = [];
        byName[g].push(s);
      } else {
        ungrouped.push(s);
      }
    });

    function latestOf(items) {
      var d = "";
      items.forEach(function (s) {
        var v = (kind === "tv" ? (s.last_air_date || s.first_air_date) : s.release_date) || "";
        if (v && v > d) d = v;
      });
      return d;
    }

    var names = Object.keys(byName).sort(function (a, b) {
      var da = latestOf(byName[a]), db = latestOf(byName[b]);
      if (da !== db) return da < db ? 1 : -1;
      return a.localeCompare(b);
    });

    var idx = 0;
    function appendBlock(title, items) {
      var block = el("div", "group-block");
      var head = el("h3", "group-title");
      head.appendChild(el("span", null, title));
      head.appendChild(el("span", "group-count", items.length + " 部"));
      block.appendChild(head);
      var sub = el("div", "group-grid");
      items.forEach(function (show) {
        var node;
        if (!show.found) {
          node = failedCard(show);
        } else {
          node = card(show);
        }
        node.style.animationDelay = Math.min(idx, 24) * 14 + "ms";
        idx++;
        sub.appendChild(node);
      });
      block.appendChild(sub);
      grid.appendChild(block);
    }

    names.forEach(function (n) { appendBlock(n, byName[n]); });
    if (ungrouped.length) appendBlock("默认分组", ungrouped);
  }

  /* ---------- 添加弹窗（搜索 → 预览 → 确认） ---------- */
  var pendingPick = null;
  var pendingDetail = null;

  function openDialog() {
    overlay.hidden = false;
    pendingPick = null;
    pendingDetail = null;
    inputTitle.value = "";
    searchHint.textContent = "输入" + cfg().itemLabel + "名后回车或点击搜索";
    searchResultsBox.innerHTML = "";
    showSearchView();
    inputTitle.focus();
  }

  function closeDialog() {
    overlay.hidden = true;
  }

  function showSearchView() {
    viewSearch.hidden = false;
    viewPreview.hidden = true;
    viewManual.hidden = true;
  }

  function showPreviewView() {
    viewSearch.hidden = true;
    viewPreview.hidden = false;
    viewManual.hidden = true;
  }

  function showManualView() {
    viewSearch.hidden = true;
    viewPreview.hidden = true;
    viewManual.hidden = false;
  }

  function doSearch() {
    var q = inputTitle.value.trim();
    if (!q) {
      searchHint.textContent = "请输入" + cfg().itemLabel + "名";
      inputTitle.focus();
      return;
    }
    searchHint.textContent = "搜索中…";
    fetch("/api/search?q=" + encodeURIComponent(q) + "&kind=" + kind)
      .then(function (r) {
        if (r.status === 401) {
          redirectToLogin();
          throw new Error("登录已失效");
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (res) {
        var list = res.results || [];
        if (!list.length) {
          searchHint.textContent = "未找到与「" + q + "」相关的" + cfg().itemLabel;
          searchResultsBox.innerHTML = "";
          return;
        }
        searchHint.textContent = "找到 " + list.length + " 个结果，点击选择";
        renderSearchResults(list);
      })
      .catch(function (e) {
        searchHint.textContent = "搜索失败：" + e.message + "（请确认代理可用且 server.py 运行中）";
        searchResultsBox.innerHTML = "";
      });
  }

  function renderSearchResults(list) {
    searchResultsBox.innerHTML = "";
    var tmdbIds = {};
    allShows().forEach(function (s) {
      if (s.tmdb_id != null) tmdbIds[String(s.tmdb_id)] = true;
    });
    list.forEach(function (r) {
      var item = el("button", "search-item");
      item.type = "button";
      if (r.poster_path) {
        var img = el("img", "s-thumb");
        img.src = TMDB_IMG + r.poster_path;
        img.alt = "";
        img.loading = "lazy";
        item.appendChild(img);
      } else {
        item.appendChild(el("div", "s-thumb s-thumb-fallback", "无海报"));
      }
      var body = el("div", "s-body");
      body.appendChild(el("div", "s-name", r.name || r.title || ""));
      // 已添加判定：按 TMDB ID（唯一标识），重名不误判
      var added = r.id != null && tmdbIds[String(r.id)] === true;
      if (added) {
        body.appendChild(el("span", "s-added", "已添加"));
      }
      var sub = "";
      if (r.original_name && r.original_name !== r.name) sub = r.original_name;
      else if (r.original_title && r.original_title !== r.title) sub = r.original_title;
      var year = (r.first_air_date || r.release_date || "").slice(0, 4);
      if (year) sub = sub ? sub + " · " + year : year;
      if (sub) body.appendChild(el("div", "s-sub", sub));
      if (r.overview) body.appendChild(el("div", "s-over", r.overview));
      item.appendChild(body);
      if (added) {
        item.classList.add("search-item-added");
        item.disabled = true;
        item.title = "该" + cfg().itemLabel + "已在列表中";
      } else {
        item.addEventListener("click", function () { pickResult(r); });
      }
      searchResultsBox.appendChild(item);
    });
  }

  function pickResult(r) {
    pendingPick = {
      title: r.original_name || r.original_title || r.name || r.title || "",
      name_zh: r.name || r.title || null,
      poster: r.poster_path ? TMDB_IMG + r.poster_path : null,
      first_air_date: r.first_air_date || r.release_date || ""
    };
    showPreviewView();
    previewBox.innerHTML = "";
    previewBox.appendChild(el("div", "preview-loading", "加载详情中…"));
    fetch("/api/show?id=" + encodeURIComponent(r.id) + "&kind=" + kind)
      .then(function (resp) {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.json();
      })
      .then(function (res) {
        pendingDetail = buildCustomEntry(res.detail, { imdb_id: res.imdb_id }, pendingPick);
        renderPreview(pendingDetail);
      })
      .catch(function (e) {
        previewBox.innerHTML = "";
        previewBox.appendChild(el("div", "preview-error", "加载失败：" + e.message));
      });
  }

  function buildCustomEntry(detail, ext, pick) {
    var poster = detail.poster_path ? TMDB_IMG + detail.poster_path : null;
    if (kind === "movie") {
      var coll = detail.belongs_to_collection;
      var collection = (coll && typeof coll === "object") ? {
        id: coll.id,
        name: coll.name || "",
        name_zh: coll.name_zh || coll.name || ""
      } : null;
      return {
        title: pick.title || detail.original_title || detail.title || "",
        name: detail.title || null,
        name_zh: detail.title || null,
        original_name: detail.original_title || detail.title || "",
        status: detail.status,
        status_zh: statusZh(detail.status),
        release_date: detail.release_date || "",
        runtime: detail.runtime,
        vote_average: detail.vote_average,
        poster: poster,
        networks: (detail.genres || []).map(function (g) { return g.name; }),
        collection: collection,
        countries: (detail.production_countries || []).map(function (c) {
          return { iso: c.iso_3166_1 || "", name: c.name || "" };
        }),
        origin_country: (detail.origin_country || []).slice(),
        original_language: detail.original_language || null,
        spoken_languages: (detail.spoken_languages || []).map(function (l) {
          return { iso: l.iso_639_1 || "", name: l.name || "" };
        }),
        imdb_id: (ext && ext.imdb_id) || null,
        tmdb_id: detail.id,
        found: true
      };
    }

    function ep(e) {
      if (!e) return null;
      return { season: e.season_number, episode: e.episode_number, name: e.name, air_date: e.air_date };
    }
    var latest = null;
    (detail.seasons || []).forEach(function (s) {
      var n = s.season_number;
      if (n > 0 && s.air_date && (!latest || n > latest.season_number)) {
        latest = { season_number: n, air_date: s.air_date, episode_count: s.episode_count };
      }
    });
    return {
      title: detail.original_name || pick.title || detail.name || "",
      name: detail.name || null,
      name_zh: detail.name || null,
      original_name: detail.original_name || detail.name || "",
      status: detail.status,
      status_zh: statusZh(detail.status),
      first_air_date: detail.first_air_date || "",
      last_air_date: detail.last_air_date || "",
      poster: poster,
      last_episode: ep(detail.last_episode_to_air),
      next_episode: ep(detail.next_episode_to_air),
      latest_season: latest,
      networks: (detail.networks || []).map(function (n) { return n.name; }),
      imdb_id: (ext && ext.imdb_id) || null,
      tmdb_id: detail.id,
      found: true
    };
  }

  function renderPreview(entry) {
    previewBox.innerHTML = "";
    var wrap = el("div", "preview-wrap");
    if (entry.poster) {
      var img = el("img", "preview-poster");
      img.src = entry.poster;
      img.alt = entry.name_zh || entry.title;
      wrap.appendChild(img);
    }
    var metaBox = el("div", "preview-meta");
    metaBox.appendChild(el("div", "preview-name", entry.name_zh || entry.title));
    if (entry.title && entry.title !== entry.name_zh) {
      metaBox.appendChild(el("div", "preview-orig", entry.title));
    }
    var year = (entry.first_air_date || entry.release_date || "").slice(0, 4);
    var sub = year + (entry.status_zh ? " · " + entry.status_zh : "");
    if ((entry.networks || []).length) sub += " · " + entry.networks.join(" / ");
    metaBox.appendChild(el("div", "preview-sub", sub));
    wrap.appendChild(metaBox);
    previewBox.appendChild(wrap);
  }

  function confirmAdd() {
    if (!pendingDetail) return;
    if (isDup(pendingDetail)) {
      window.alert("该" + cfg().itemLabel + "已在列表中，无需重复添加。");
      closeDialog();
      return;
    }
    persistEntries(allShows().concat([pendingDetail]), null, closeDialog);
  }

  function confirmManual() {
    var title = mTitle.value.trim();
    if (!title) {
      mTitle.focus();
      return;
    }
    var entry = {
      title: title,
      name: mZh.value.trim() || null,
      name_zh: mZh.value.trim() || null,
      imdb_id: mImdb.value.trim() || null,
      found: true
    };
    if (isDup(entry)) {
      window.alert("该" + cfg().itemLabel + "已在列表中，无需重复添加。");
      closeDialog();
      return;
    }
    persistEntries(allShows().concat([entry]), null, closeDialog);
  }

  /* ---------- 标记弹窗 ---------- */
  var pendingMark = null;
  var batchMarkMode = false;

  function openMarkDialog(show) {
    batchMarkMode = false;
    pendingMark = show;
    markLabel.textContent = "标记「" + (show.name || show.title) + "」";
    var current = show.mark || "";
    markOverlay.querySelectorAll(".mark-opt").forEach(function (btn) {
      btn.classList.toggle("selected", btn.dataset.mark === current);
    });
    markOverlay.hidden = false;
  }

  function closeMarkDialog() {
    markOverlay.hidden = true;
    pendingMark = null;
    batchMarkMode = false;
  }

  function chooseMark(value) {
    if (!pendingMark) return;
    var show = pendingMark;
    var oldMark = show.mark || null;
    show.mark = value || null;
    closeMarkDialog();
    persistEntries(allShows(), function () {
      show.mark = oldMark; // 写盘失败则回滚
    });
  }

  /* ---------- 批量标记（作用于勾选的条目） ---------- */
  function openBatchMarkDialog() {
    if (!selection.length) return;
    batchMarkMode = true;
    pendingMark = null;
    markLabel.textContent = "批量标记 " + selection.length + " 部" + cfg().itemLabel;
    markOverlay.querySelectorAll(".mark-opt").forEach(function (btn) {
      btn.classList.toggle("selected", false);
    });
    markOverlay.hidden = false;
  }

  function chooseBatchMark(value) {
    var sel = {};
    selection.forEach(function (k) { sel[k] = true; });
    var entries = allShows().map(function (s) {
      if (sel[s._key]) s.mark = value || null;
      return s;
    });
    selection.length = 0;
    closeMarkDialog();
    applyEditModeUI();
    persistEntries(entries);
  }

  /* ---------- 全选（当前筛选条件下可见的条目） ---------- */
  function toggleSelectAll() {
    var visible = filteredList().map(function (s) { return s._key; });
    if (!visible.length) return;
    var allSelected = visible.every(function (k) { return selection.indexOf(k) >= 0; });
    if (allSelected) {
      var drop = {};
      visible.forEach(function (k) { drop[k] = true; });
      selection = selection.filter(function (k) { return !drop[k]; });
    } else {
      var have = {};
      selection.forEach(function (k) { have[k] = true; });
      visible.forEach(function (k) {
        if (!have[k]) {
          have[k] = true;
          selection.push(k);
        }
      });
    }
    applyEditModeUI();
    render();
  }

  /* ---------- 批量分组（多选，可检索、系统/自定义标识） ---------- */
  var groupItems = [];   // {name, type: 'auto'=TMDB系列 | 'manual'=自定义分组}

  function buildGroupItems() {
    var map = {};
    allShows().forEach(function (s) {
      var g = (s.group || "").trim();
      if (g) map[g] = "manual";
    });
    allShows().forEach(function (s) {
      var c = s.collection;
      var cn = c && ((c.name_zh || c.name || "") + "").trim();
      if (cn && !(cn in map)) map[cn] = "auto";
    });
    return Object.keys(map).sort(function (a, b) { return a.localeCompare(b); }).map(function (n) {
      return { name: n, type: map[n] };
    });
  }

  function renderGroupList(filter) {
    groupList.innerHTML = "";
    var q = (filter || "").trim().toLowerCase();
    var items = groupItems.filter(function (g) {
      return !q || g.name.toLowerCase().indexOf(q) >= 0;
    });
    if (!items.length) {
      groupList.appendChild(el("div", "group-list-empty", q ? "没有匹配的分组" : "暂无分组：在上方输入新组名即可创建"));
      return;
    }
    items.forEach(function (g) {
      var item = el("button", "group-item" + (g.name === groupInput.value.trim() ? " selected" : ""));
      item.type = "button";
      item.appendChild(el("span", "group-item-name", g.name));
      item.appendChild(el("span", "group-tag tag-" + g.type, g.type === "auto" ? "系列" : "自定义"));
      item.addEventListener("click", function () {
        groupInput.value = g.name;
        renderGroupList(groupInput.value);
      });
      groupList.appendChild(item);
    });
  }

  function openGroupDialog() {
    if (!selection.length) return;
    groupItems = buildGroupItems();

    // 选中电影的自动系列（一致时展示提示并预选）
    var collName = null, collSame = true;
    allShows().forEach(function (s) {
      if (selection.indexOf(s._key) < 0) return;
      var c = s.collection;
      var cn = c && ((c.name_zh || c.name || "") + "").trim() || "";
      if (collName === null) collName = cn;
      else if (cn !== collName) collSame = false;
    });
    groupHint.textContent = "已选 " + selection.length + " 部" + cfg().itemLabel
      + (collSame && collName ? " · TMDB 系列：" + collName : "");

    // 预选：手动组相同优先；否则自动系列相同则预选系列名
    var common = null, same = true;
    allShows().forEach(function (s) {
      if (selection.indexOf(s._key) < 0) return;
      var g = (s.group || "").trim();
      if (common === null) common = g;
      else if (g !== common) same = false;
    });
    var preset = (same && common) ? common : (collSame && collName ? collName : "");
    groupInput.value = preset;
    renderGroupList(preset || "");
    groupOverlay.hidden = false;
    groupInput.focus();
  }

  function closeGroupDialog() {
    groupOverlay.hidden = true;
  }

  /* 把勾选电影统一写入分组；完成后清空选择、关闭弹窗 */
  function applyGroup(groupValue) {
    var sel = {};
    selection.forEach(function (k) { sel[k] = true; });
    var entries = allShows().map(function (s) {
      if (sel[s._key]) s.group = groupValue;
      return s;
    });
    persistEntries(entries, null, function () {
      selection.length = 0;
      applyEditModeUI();
      closeGroupDialog();
    });
  }

  function confirmGroup() {
    var name = groupInput.value.trim();
    if (!name) {
      showDialog(cfg().itemLabel + "分组", "请输入新组名，或从列表中选择已有分组。", [
        { label: "关闭", value: false, primary: true }
      ]);
      return;
    }
    applyGroup(name);
  }

  function dismissGroup() {
    applyGroup(null);
  }

  /* ---------- 批量导入（每行一条：片名 或 «片名,IMDb号»） ---------- */
  function normalizeTitle(t) {
    return (t || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function openImportDialog() {
    importText.value = "";
    importOverlay.hidden = false;
    importText.focus();
  }

  function closeImportDialog() {
    importOverlay.hidden = true;
  }

  function confirmImport() {
    var lines = importText.value.split(/\r?\n/);
    var known = {};
    var knownTitles = {};
    allShows().forEach(function (s) {
      known[s._key] = true;
      var nt = normalizeTitle(s.title);
      if (nt && !(nt in knownTitles)) knownTitles[nt] = s.imdb_id || "";
    });
    var newOnes = [];
    var dupCount = 0;
    lines.forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      var title = t, imdb = null;
      var m = t.match(/^(.*?)[,，\t]\s*(tt\d+)\s*$/i);
      if (m) {
        title = m[1].trim();
        imdb = m[2].trim();
      } else if (/^tt\d+$/i.test(t)) {
        title = "";
        imdb = t;
      }
      // Excel 年份列残留：«片名\t1994» → «片名 (1994)»
      title = title.replace(/\t\s*(\d{4})\s*$/, " ($1)");
      if (!title && !imdb) return;
      var entry = { title: title, imdb_id: imdb || null, name: null, name_zh: null, found: true };
      var key = showKey(entry);
      var nt = normalizeTitle(title);
      // 去重：IMDb 相同；或片名相同且任一方无 IMDb（双方 IMDb 不同视为重名不同片）
      var prevImdb = nt && (nt in knownTitles) ? knownTitles[nt] : null;
      var titleDup = !!nt && (nt in knownTitles)
        && !(imdb && prevImdb && imdb.toLowerCase() !== String(prevImdb).toLowerCase());
      if (known[key] || titleDup) { dupCount++; return; }
      known[key] = true;
      if (nt && !(nt in knownTitles)) knownTitles[nt] = imdb || "";
      newOnes.push(entry);
    });
    if (!newOnes.length) {
      showDialog("批量导入", dupCount ? ("导入的条目都已存在（跳过 " + dupCount + " 条重复）。") : "没有可导入的内容。", [
        { label: "关闭", value: false, primary: true }
      ]);
      return;
    }
    persistEntries(allShows().concat(newOnes), null, function () {
      closeImportDialog();
      var msg = "已导入 " + newOnes.length + " 条" + (dupCount ? "，跳过重复 " + dupCount + " 条" : "") + "。";
      showDialog("批量导入", msg + "\n是否立即仅更新未抓取的数据？", [
        { label: "稍后再说", value: false },
        { label: "立即更新", value: true, primary: true }
      ]).then(function (ok) {
        if (ok) runRefresh(true);
      });
    });
  }

  /* ---------- 编辑模式 ---------- */
  function applyEditModeUI() {
    btnEdit.classList.toggle("tb-btn-active", editMode);
    btnEdit.textContent = "✎";
    editorRow.hidden = !editMode;
    var extraVisible = editMode;
    btnGroup.hidden = !extraVisible;
    btnSelectAll.hidden = !extraVisible;
    btnBatchMark.hidden = !extraVisible;
    if (extraVisible) {
      btnGroup.textContent = selection.length ? "分组(" + selection.length + ")" : "分组";
      btnGroup.disabled = selection.length === 0;
      btnBatchMark.textContent = selection.length ? "标记(" + selection.length + ")" : "标记";
      btnBatchMark.disabled = selection.length === 0;
      var visible = filteredList();
      var allSelected = visible.length > 0
        && visible.every(function (s) { return selection.indexOf(s._key) >= 0; });
      btnSelectAll.textContent = allSelected ? "取消全选" : "全选";
    }
  }

  function toggleEditMode() {
    editMode = !editMode;
    selection.length = 0;
    applyEditModeUI();
    render();
  }

  /* ---------- Tab 切换 ---------- */
  function setTabActive(newKind) {
    tabs.querySelectorAll(".tab-btn").forEach(function (b) {
      var active = b.dataset.kind === newKind;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function applyKindTexts() {
    var c = cfg();
    tagline.textContent = c.tagline;
    networkLabel.textContent = c.networkLabel;
    markFilterFinished.textContent = c.markFinished;
    markFilterDropped.textContent = c.markDropped;
    markFilterUnwatched.textContent = c.markUnwatched;
    markOptFinished.textContent = c.markFinished;
    markOptDropped.textContent = c.markDropped;
    markOptUnwatched.textContent = c.markUnwatched;
    addTitleLabel.textContent = c.dialogTitle;
    inputTitle.placeholder = c.searchPlaceholder;
    mTitleLabel.textContent = c.manualTitleLabel;
    groupLabel.textContent = c.itemLabel + "分组";
    btnGroup.title = "勾选" + c.itemLabel + "后加入 / 移出分组";
    originField.hidden = kind !== "movie";
    genreField.hidden = kind !== "tv";
    statusField.hidden = kind !== "tv";
  }

  function switchKind(newKind) {
    if (newKind === kind) return;
    kind = newKind;
    data = SOURCES[kind];
    setTabActive(kind);
    applyKindTexts();

    // 筛选条件重置为新 Tab 的默认状态
    selection.length = 0;
    groupViewSel.value = "flat";
    originSel.value = "";
    markSel.value = "";
    genreSel.value = "";
    searchInput.value = "";
    searchClear.hidden = true;
    sortDirBtn.dataset.dir = "desc";
    sortDirBtn.querySelector(".dir-text").textContent = "降序";
    resetSortOptions();
    resetFilterOptions();

    if (!overlay.hidden) {
      pendingPick = null;
      pendingDetail = null;
      inputTitle.value = "";
      searchResultsBox.innerHTML = "";
      searchHint.textContent = "输入" + cfg().itemLabel + "名后回车或点击搜索";
      showSearchView();
    }
    render();
  }

  /* ---------- URL 状态（Tab / 筛选 / 排序同步到地址栏，刷新后恢复） ---------- */
  var URL_PARAMS = {
    tab: "tab",
    status: "status",
    mark: "mark",
    net: "net",
    genre: "genre",
    origin: "origin",
    sort: "sort",
    dir: "dir",
    view: "view",
    q: "q"
  };

  function selectIfExists(sel, value) {
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === value) {
        sel.value = value;
        return true;
      }
    }
    return false;
  }

  function readURLState() {
    var q = new URLSearchParams(window.location.search);
    return {
      tab: q.get(URL_PARAMS.tab) || "",
      status: q.get(URL_PARAMS.status) || "",
      mark: q.get(URL_PARAMS.mark) || "",
      net: q.get(URL_PARAMS.net) || "",
      genre: q.get(URL_PARAMS.genre) || "",
      origin: q.get(URL_PARAMS.origin) || "",
      sort: q.get(URL_PARAMS.sort) || "",
      dir: q.get(URL_PARAMS.dir) || "",
      view: q.get(URL_PARAMS.view) || "",
      q: q.get(URL_PARAMS.q) || ""
    };
  }

  /* 仅写入非默认值，地址栏保持干净；用 replaceState 不产生历史记录 */
  function syncURL() {
    var q = new URLSearchParams();
    if (kind === "movie") q.set(URL_PARAMS.tab, "movie");
    if (kind === "tv" && statusSel.value) q.set(URL_PARAMS.status, statusSel.value);
    if (markSel.value) q.set(URL_PARAMS.mark, markSel.value);
    if (networkSel.value) q.set(URL_PARAMS.net, networkSel.value);
    if (genreSel.value) q.set(URL_PARAMS.genre, genreSel.value);
    if (originSel.value) q.set(URL_PARAMS.origin, originSel.value);
    if (sortSel.value) q.set(URL_PARAMS.sort, sortSel.value);
    if (sortDirBtn.dataset.dir === "asc") q.set(URL_PARAMS.dir, "asc");
    if (groupViewSel.value === "grouped") q.set(URL_PARAMS.view, "grouped");
    if (searchInput.value.trim()) q.set(URL_PARAMS.q, searchInput.value.trim());
    var s = q.toString();
    history.replaceState(null, "", window.location.pathname + (s ? "?" + s : ""));
  }

  /* ---------- 通用确认 / 提示弹窗（Promise 风格） ---------- */
  var confirmResolve = null;

  function closeConfirmOverlay(value) {
    if (confirmResolve) {
      var r = confirmResolve;
      confirmResolve = null;
      r(value);
    }
    confirmOverlay.hidden = true;
  }

  function showDialog(title, message, buttons) {
    return new Promise(function (resolve) {
      confirmTitle.textContent = title;
      confirmMsg.textContent = message;
      confirmActions.innerHTML = "";
      confirmResolve = resolve;
      buttons.forEach(function (b) {
        var btn = el("button", "tb-btn" + (b.primary ? " tb-btn-primary" : ""), b.label);
        btn.type = "button";
        btn.addEventListener("click", function () { closeConfirmOverlay(b.value); });
        confirmActions.appendChild(btn);
      });
      confirmOverlay.hidden = false;
    });
  }

  /* 复制文本（兼容局域网 http 下不可用的 navigator.clipboard） */
  function copyText(text) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  /* 在失败弹窗里追加「复制完整日志」按钮，方便把日志提供出来排查 */
  function addCopyLogButton(log) {
    if (!log) return;
    var btn = el("button", "tb-btn", "复制完整日志");
    btn.type = "button";
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      copyText(log).then(function () {
        btn.textContent = "已复制";
        setTimeout(function () { btn.textContent = "复制完整日志"; }, 1500);
      });
    });
    confirmActions.insertBefore(btn, confirmActions.firstChild);
  }

  /* ---------- 全量抓取（服务端流式返回日志，onLine 逐行回调） ---------- */
  /* 结果弹窗只显示日志尾部一小段，防止超长日志撑出巨型对话框 */
  function shortTail(log) {
    var lines = (log || "").split("\n").filter(function (l) {
      return l && l.indexOf("[结果]") !== 0;
    });
    var t = lines.slice(-6).join("\n").trim();
    if (t.length > 500) t = t.slice(t.length - 500);
    return t;
  }

  function requestRefresh(body, onLine) {
    btnRefresh.disabled = true;
    var oldText = btnRefresh.textContent;
    btnRefresh.textContent = "抓取中…";
    var logs = [];
    function done() {
      btnRefresh.disabled = false;
      btnRefresh.textContent = oldText;
    }
    function feed(line) {
      if (line) {
        logs.push(line);
        if (onLine) onLine(line);
      }
    }
    return fetch("/api/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (resp) {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        var reader = resp.body.getReader();
        var dec = new TextDecoder("utf-8");
        var buf = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) {
              if (buf.trim()) feed(buf);
              return;
            }
            buf += dec.decode(r.value, { stream: true });
            var lines = buf.split("\n");
            buf = lines.pop();
            lines.forEach(feed);
            return pump();
          });
        }
        return pump();
      })
      .then(function () {
        done();
        var text = logs.join("\n");
        var t = text.trim();
        if (t.charAt(0) === "{") {
          /* 旧版服务端兼容：一次性返回 JSON（{"ok":..., "log":...}），
             避免把整段 JSON 当纯文本塞进弹窗撑出巨型对话框 */
          try {
            var j = JSON.parse(t);
            return { ok: !!j.ok, log: j.log || j.error || "" };
          } catch (err) { /* 解析失败则按流式文本处理 */ }
        }
        var last = logs[logs.length - 1] || "";
        return { ok: last.indexOf("[结果] ok") === 0, log: text };
      })
      .catch(function (e) {
        done();
        throw e;
      });
  }

  /* 单条抓取（未抓取卡片上的按钮） */
  function fetchOne(show) {
    var label = show.name || show.title || show.imdb_id || "";
    var item = (show.imdb_id || show.title || "").trim();
    if (!item) return;
    showDialog("单独抓取", "抓取「" + label + "」？\n（按" + (show.imdb_id ? "IMDb 号精确" : "片名") + "匹配，几秒完成）", [
      { label: "取消", value: false },
      { label: "抓取", value: true, primary: true }
    ]).then(function (ok) {
      if (!ok) return;
      requestRefresh({ kind: kind, item: item })
        .then(function (res) {
          var tail = shortTail(res.log);
          if (res.ok) {
            showDialog("抓取完成", tail, [
              { label: "刷新页面", value: true, primary: true }
            ]).then(function () { location.reload(); });
          } else {
            showDialog("抓取失败", tail || res.error || "未知错误", [
              { label: "关闭", value: false, primary: true }
            ]);
            addCopyLogButton(res.log || res.error || "");
          }
        })
        .catch(function (e) {
          showDialog("请求失败", String(e.message || e), [
            { label: "关闭", value: false, primary: true }
          ]);
        });
    });
  }

  /* 以关键词进入添加搜索流程（未识别卡片上的按钮） */
  function openAddWithKeyword(keyword) {
    openDialog();
    inputTitle.value = (keyword || "").trim();
    if (inputTitle.value) doSearch();
  }

  /* ---------- 更新按钮上的实时进度 ---------- */
  function setRefreshStatus(refKind, text, cls) {
    var el = refKind === "tv" ? refreshStatusTv : refreshStatusMovie;
    if (!el) return;
    el.textContent = text || "";
    el.className = "refresh-status" + (cls ? " " + cls : "");
  }

  function setUpdatingUI(refKind) {
    settingsRefreshTv.disabled = true;
    settingsRefreshMovie.disabled = true;
    setRefreshStatus("tv", refKind === "tv" ? "更新中…" : "", "updating");
    setRefreshStatus("movie", refKind === "movie" ? "更新中…" : "", "updating");
  }

  /* 进度显示在设置弹窗对应分类按钮下方的状态行（更新中 xx%），
     编辑区「更新数据」按钮同步显示百分比 */
  function updateBtnProgress(cur, total, refKind) {
    var pct = total > 0 ? Math.round(cur / total * 100) : 0;
    var label = "更新中 " + pct + "%";
    setRefreshStatus(refKind, label + "（" + cur + "/" + total + "）", "updating");
    if (refKind === kind) btnRefresh.textContent = label;
  }

  function setUpdatingDone(refKind, ok) {
    setRefreshStatus(refKind, ok ? "更新完成" : "更新失败", ok ? "done" : "failed");
    settingsRefreshTv.disabled = false;
    settingsRefreshMovie.disabled = false;
    settingsRefreshTv.textContent = "更新剧集数据";
    settingsRefreshMovie.textContent = "更新电影数据";
  }

  function runRefresh(onlyUnfetched, refKind) {
    var rk = refKind || kind;
    setUpdatingUI(rk);
    requestRefresh({ kind: rk, only_unfetched: onlyUnfetched }, function (line) {
      var m = line.match(/^\[进度\]\s+(\d+)\s*\/\s*(\d+)/);
      if (m) updateBtnProgress(parseInt(m[1], 10), parseInt(m[2], 10), rk);
    })
      .then(function (res) {
        setUpdatingDone(rk, res.ok);
        var tail = shortTail(res.log);
        if (res.ok) {
          showDialog("更新完成", tail, [
            { label: "刷新页面", value: true, primary: true }
          ]).then(function () { location.reload(); });
        } else {
          showDialog("抓取失败", tail || res.error || "未知错误", [
            { label: "关闭", value: false, primary: true }
          ]);
          addCopyLogButton(res.log || res.error || "");
        }
      })
      .catch(function (e) {
        setUpdatingDone(rk, false);
        showDialog("请求失败", String(e.message || e), [
          { label: "关闭", value: false, primary: true }
        ]);
      });
  }

  function refreshData() {
    showDialog("更新数据", cfg().refreshConfirm, [
      { label: "取消", value: false },
      { label: "开始更新", value: true, primary: true }
    ]).then(function (ok) {
      if (ok) runRefresh(false);
    });
  }

  /* 设置页：指定分类刷新（tv / movie） */
  function refreshKindConfirm(refKind) {
    var c = KIND_CFG[refKind];
    showDialog("更新" + c.itemLabel + "数据", c.refreshConfirm, [
      { label: "取消", value: false },
      { label: "开始更新", value: true, primary: true }
    ]).then(function (ok) {
      if (ok) runRefresh(false, refKind);
    });
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    tabs.querySelectorAll(".tab-btn").forEach(function (b) {
      b.addEventListener("click", function () { switchKind(b.dataset.kind); });
    });

    statusSel.addEventListener("change", render);
    networkSel.addEventListener("change", render);
    genreSel.addEventListener("change", render);
    markSel.addEventListener("change", render);
    originSel.addEventListener("change", render);
    sortSel.addEventListener("change", render);
    searchInput.addEventListener("input", function () {
      searchClear.hidden = !searchInput.value.trim();
      render();
    });
    searchClear.addEventListener("click", function () {
      searchInput.value = "";
      searchClear.hidden = true;
      render();
    });
    groupViewSel.addEventListener("change", render);
    btnGroup.addEventListener("click", openGroupDialog);
    btnSettings.addEventListener("click", openSettings);
    settingsLogout.addEventListener("click", doLogout);
    settingsClose.addEventListener("click", closeSettings);
    settingsAddBtn.addEventListener("click", addSettingsUser);
    settingsRefreshTv.addEventListener("click", function () { refreshKindConfirm("tv"); });
    settingsRefreshMovie.addEventListener("click", function () { refreshKindConfirm("movie"); });
    settingsOverlay.addEventListener("click", function (ev) {
      if (ev.target === settingsOverlay) closeSettings();
    });
    btnGroupConfirm.addEventListener("click", confirmGroup);
    btnGroupDismiss.addEventListener("click", dismissGroup);
    btnGroupCancel.addEventListener("click", closeGroupDialog);
    groupOverlay.addEventListener("click", function (ev) {
      if (ev.target === groupOverlay) closeGroupDialog();
    });
    groupInput.addEventListener("input", function () {
      renderGroupList(groupInput.value);
    });
    confirmOverlay.addEventListener("click", function (ev) {
      if (ev.target === confirmOverlay) closeConfirmOverlay(null);
    });
    btnSelectAll.addEventListener("click", toggleSelectAll);
    btnBatchMark.addEventListener("click", openBatchMarkDialog);
    btnImport.addEventListener("click", openImportDialog);
    btnImportConfirm.addEventListener("click", confirmImport);
    btnImportCancel.addEventListener("click", closeImportDialog);
    importOverlay.addEventListener("click", function (ev) {
      if (ev.target === importOverlay) closeImportDialog();
    });
    sortDirBtn.addEventListener("click", function () {
      var asc = sortDirBtn.dataset.dir !== "asc";
      sortDirBtn.dataset.dir = asc ? "asc" : "desc";
      sortDirBtn.querySelector(".dir-text").textContent = asc ? "升序" : "降序";
      render();
    });

    btnEdit.addEventListener("click", toggleEditMode);
    btnAdd.addEventListener("click", openDialog);
    btnRefresh.addEventListener("click", refreshData);
    document.getElementById("add-cancel").addEventListener("click", closeDialog);
    document.getElementById("add-search-btn").addEventListener("click", doSearch);
    document.getElementById("add-back").addEventListener("click", function () {
      pendingDetail = null;
      showSearchView();
    });
    document.getElementById("add-confirm").addEventListener("click", confirmAdd);
    document.getElementById("add-to-manual").addEventListener("click", function () {
      showManualView();
      mTitle.focus();
    });
    document.getElementById("add-m-back").addEventListener("click", function () {
      showSearchView();
      inputTitle.focus();
    });
    document.getElementById("add-m-confirm").addEventListener("click", confirmManual);
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) closeDialog();
    });
    markOverlay.addEventListener("click", function (ev) {
      if (ev.target === markOverlay) closeMarkDialog();
    });
    markOverlay.querySelectorAll(".mark-opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (batchMarkMode) chooseBatchMark(btn.dataset.mark);
        else chooseMark(btn.dataset.mark);
      });
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        if (!markOverlay.hidden) closeMarkDialog();
        if (!groupOverlay.hidden) closeGroupDialog();
        if (!settingsOverlay.hidden) closeSettings();
        if (!confirmOverlay.hidden) closeConfirmOverlay(null);
        if (!importOverlay.hidden) closeImportDialog();
        if (!overlay.hidden) closeDialog();
      }
      if (ev.key === "Enter" && !overlay.hidden) {
        if (!viewPreview.hidden) confirmAdd();
        else if (!viewManual.hidden) confirmManual();
        else doSearch();
      }
    });
  }

  /* ---------- 启动 ---------- */
  var urlState = readURLState();
  kind = urlState.tab === "movie" ? "movie" : "tv";
  data = SOURCES[kind];

  setTabActive(kind);
  applyKindTexts();
  resetSortOptions();
  resetFilterOptions();

  // 从地址栏恢复筛选 / 排序（当前数据集中存在的选项才生效）
  if (kind === "tv" && urlState.status) selectIfExists(statusSel, urlState.status);
  if (urlState.mark) markSel.value = urlState.mark;
  if (urlState.net) selectIfExists(networkSel, urlState.net);
  if (kind === "tv" && urlState.genre) selectIfExists(genreSel, urlState.genre);
  if (urlState.sort) selectIfExists(sortSel, urlState.sort);
  if (urlState.dir === "asc") {
    sortDirBtn.dataset.dir = "asc";
    sortDirBtn.querySelector(".dir-text").textContent = "升序";
  }
  groupViewSel.value = urlState.view === "grouped" ? "grouped" : "flat";
  if (kind === "movie" && urlState.origin) originSel.value = urlState.origin;
  searchInput.value = urlState.q || "";
  searchClear.hidden = !urlState.q;

  bindEvents();
  applyEditModeUI();
  render();
  bootstrapUser();
})();