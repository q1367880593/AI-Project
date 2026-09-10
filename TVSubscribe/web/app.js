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
        { value: "last_air_date", text: "最后更新时间" },
        { value: "first_air_date", text: "首季播出时间" },
        { value: "latest_season", text: "最新季播出时间" }
      ],
      networkLabel: "出品方",
      tagline: "追剧进度 · 完结状态 · 最新季播出时间",
      markFinished: "已追完",
      markDropped: "已弃剧",
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
  var networkSel = document.getElementById("filter-network");
  var networkLabel = document.getElementById("network-label");
  var originField = document.getElementById("origin-field");
  var originSel = document.getElementById("filter-origin");
  var sortSel = document.getElementById("sort-key");
  var sortDirBtn = document.getElementById("sort-dir");
  var resultCount = document.getElementById("result-count");
  var footerCount = document.getElementById("footer-count");

  var btnAdd = document.getElementById("btn-add");
  var btnRefresh = document.getElementById("btn-refresh");
  var btnEdit = document.getElementById("btn-edit");
  var btnGroup = document.getElementById("btn-group");
  var groupViewField = document.getElementById("group-view-field");
  var groupViewSel = document.getElementById("group-view");
  var groupOverlay = document.getElementById("group-overlay");
  var groupHint = document.getElementById("group-hint");
  var groupSelect = document.getElementById("group-select");
  var groupInput = document.getElementById("group-input");
  var btnGroupConfirm = document.getElementById("group-confirm");
  var btnGroupDismiss = document.getElementById("group-dismiss");
  var btnGroupCancel = document.getElementById("group-cancel");
  var markSel = document.getElementById("filter-mark");
  var markOptFinished = document.getElementById("mark-opt-finished");
  var markOptDropped = document.getElementById("mark-opt-dropped");
  var markFilterFinished = document.getElementById("mark-filter-finished");
  var markFilterDropped = document.getElementById("mark-filter-dropped");
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
  var selection = [];   // 已勾选电影的 _key（仅电影 Tab 编辑模式，内存态）

  var CHINESE_CODES = { CN: true, HK: true, TW: true };
  var JAPAN_CODES = { JP: true };
  var KOREA_CODES = { KR: true };
  var WEST_CODES = {
    US: true, CA: true, GB: true, IE: true, FR: true, DE: true, IT: true, ES: true,
    PT: true, NL: true, BE: true, LU: true, AT: true, CH: true, DK: true, SE: true,
    NO: true, FI: true, IS: true, PL: true, CZ: true, SK: true, HU: true, RO: true,
    GR: true, AU: true, NZ: true
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
    for (var k in codes) {
      if (set[k]) return true;
    }
    return false;
  }

  /* 地区归类：华语 > 日本 > 韩国 > 欧美 > 其他；无产地数据为未知 */
  function originTag(s) {
    var cs = s.countries || [];
    if (!cs.length) return "unknown";
    var set = isoSet(cs);
    if (hasAny(set, CHINESE_CODES)) return "chinese";
    if (hasAny(set, JAPAN_CODES)) return "japan";
    if (hasAny(set, KOREA_CODES)) return "korea";
    if (hasAny(set, WEST_CODES)) return "west";
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
    var text = mark === "" ? "＋ 标记" : (mark === "finished" ? cfg().markFinished : cfg().markDropped);
    var btn = el("button", "mark-btn", text);
    btn.type = "button";
    btn.title = cfg().markTitlePrefix + "（直接写入 " + cfg().fileName + "）";
    if (mark === "finished") btn.classList.add("mark-finished");
    if (mark === "dropped") btn.classList.add("mark-dropped");
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
      if (!window.confirm("确认移除「" + label + "」？\n将立即从 " + cfg().fileName + " 移除。")) return;
      persistEntries(allShows().filter(function (s) { return s._key !== show._key; }));
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

  function movieMeta(show) {
    var meta = el("div", "meta");
    if (!show.status) {
      meta.appendChild(el("div", "line muted", "尚未抓取数据，点击上方「更新数据」补齐"));
      return meta;
    }
    var cs = show.countries || [];
    var cnames = [];
    cs.forEach(function (c) {
      var n = countryName(c) || "";
      if (n) cnames.push(n);
    });
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
      meta.appendChild(el("div", "line muted", "尚未抓取数据，点击上方「更新数据」补齐"));
      return meta;
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
    if (editMode && kind === "movie") {
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
    titleRow.appendChild(link(detailUrl(show), "title", show.name || show.title));
    if (show.status) {
      titleRow.appendChild(el("span", "badge " + statusClass(show.status), show.status_zh || statusZh(show.status)));
    } else {
      titleRow.appendChild(el("span", "badge badge-other", "待抓取"));
    }
    if (editMode) {
      titleRow.appendChild(markBadge(show));
      titleRow.appendChild(deleteBtn(show));
    }
    info.appendChild(titleRow);

    var chips = chipRow(show.networks, kind === "movie" ? 6 : 2);
    if (chips) info.appendChild(chips);

    if (show.original_name && show.original_name !== show.name && show.original_name !== show.title) {
      info.appendChild(el("div", "original", show.original_name));
    }

    info.appendChild(kind === "movie" ? movieMeta(show) : tvMeta(show));
    c.appendChild(info);
    return c;
  }

  /* ---------- 筛选与排序 ---------- */
  function resetFilterOptions() {
    statusSel.innerHTML = "";
    networkSel.innerHTML = "";
    var so = el("option", null, "全部");
    so.value = "";
    statusSel.appendChild(so);
    var no = el("option", null, "全部");
    no.value = "";
    networkSel.appendChild(no);

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

    var status = statusSel.value;
    var network = networkSel.value;
    var markFilter = markSel.value;
    var originFilter = originSel.value;
    var key = sortSel.value;
    var asc = sortDirBtn.dataset.dir === "asc";

    var list = merged.filter(function (s) {
      if (status && s.status !== status) return false;
      if (network && (s.networks || []).indexOf(network) < 0) return false;
      var mark = s.mark || "";
      if (markFilter === "none" && mark) return false;
      if (markFilter === "finished" && mark !== "finished") return false;
      if (markFilter === "dropped" && mark !== "dropped") return false;
      if (originFilter && originTag(s) !== originFilter) return false;
      return true;
    });

    var sorted = sortShows(list, key, asc);

    if (status || network || markFilter || originFilter) {
      resultCount.innerHTML = "当前 <b>" + sorted.length + "</b> / " + merged.length + " 部";
    } else {
      resultCount.innerHTML = "共 <b>" + merged.length + "</b> 部";
    }

    grid.innerHTML = "";
    if (sorted.length === 0) {
      grid.appendChild(el("div", "empty", cfg().emptyFiltered));
      return;
    }
    if (kind === "movie" && groupViewSel.value === "grouped") {
      renderGrouped(sorted);
      return;
    }
    sorted.forEach(function (show, idx) {
      var node;
      if (!show.found) {
        node = el("div", "card", "未找到或抓取失败：" + (show.title || ""));
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

  /* 按分组聚合渲染（仅电影）：组内沿用全局排序，组间按组内最新上映日期降序，未分组放最后 */
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
        if (s.release_date && s.release_date > d) d = s.release_date;
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
          node = el("div", "card", "未找到或抓取失败：" + (show.title || ""));
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
    if (ungrouped.length) appendBlock("未分组", ungrouped);
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

  function openMarkDialog(show) {
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

  /* ---------- 电影分组（批量多选） ---------- */
  function openGroupDialog() {
    if (!selection.length) return;
    groupSelect.innerHTML = "";
    var opt0 = el("option", null, "（选择已有分组）");
    opt0.value = "";
    groupSelect.appendChild(opt0);
    // 候选：手动组名 ∪ 自动系列名
    var names = {};
    allShows().forEach(function (s) {
      var g = (s.group || "").trim();
      if (g) names[g] = true;
      var c = s.collection;
      var cn = c && ((c.name_zh || c.name || "") + "").trim();
      if (cn) names[cn] = true;
    });
    Object.keys(names).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (n) {
      var o = el("option", null, n);
      o.value = n;
      groupSelect.appendChild(o);
    });

    // 选中电影的自动系列（一致时展示提示并预选）
    var collName = null, collSame = true;
    allShows().forEach(function (s) {
      if (selection.indexOf(s._key) < 0) return;
      var c = s.collection;
      var cn = c && ((c.name_zh || c.name || "") + "").trim() || "";
      if (collName === null) collName = cn;
      else if (cn !== collName) collSame = false;
    });
    groupHint.textContent = "已选 " + selection.length + " 部电影"
      + (collSame && collName ? " · TMDB 系列：" + collName : "");

    // 预选：手动组相同优先；否则自动系列相同则预选系列名
    var common = null, same = true;
    allShows().forEach(function (s) {
      if (selection.indexOf(s._key) < 0) return;
      var g = (s.group || "").trim();
      if (common === null) common = g;
      else if (g !== common) same = false;
    });
    if (same && common) selectIfExists(groupSelect, common);
    else if (collSame && collName) selectIfExists(groupSelect, collName);
    groupInput.value = "";
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
    var name = groupInput.value.trim() || groupSelect.value;
    if (!name) {
      window.alert("请选择已有分组，或输入新组名。");
      return;
    }
    applyGroup(name);
  }

  function dismissGroup() {
    applyGroup(null);
  }

  /* ---------- 编辑模式 ---------- */
  function applyEditModeUI() {
    btnEdit.classList.toggle("tb-btn-active", editMode);
    btnEdit.textContent = editMode ? "✎ 编辑中" : "✎ 编辑";
    btnAdd.hidden = !editMode;
    var groupVisible = editMode && kind === "movie";
    btnGroup.hidden = !groupVisible;
    if (groupVisible) {
      btnGroup.textContent = selection.length ? "分组(" + selection.length + ")" : "分组";
      btnGroup.disabled = selection.length === 0;
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
    markOptFinished.textContent = c.markFinished;
    markOptDropped.textContent = c.markDropped;
    addTitleLabel.textContent = c.dialogTitle;
    inputTitle.placeholder = c.searchPlaceholder;
    mTitleLabel.textContent = c.manualTitleLabel;
    groupViewField.hidden = kind !== "movie";
    originField.hidden = kind !== "movie";
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
    origin: "origin",
    sort: "sort",
    dir: "dir",
    view: "view"
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
      origin: q.get(URL_PARAMS.origin) || "",
      sort: q.get(URL_PARAMS.sort) || "",
      dir: q.get(URL_PARAMS.dir) || "",
      view: q.get(URL_PARAMS.view) || ""
    };
  }

  /* 仅写入非默认值，地址栏保持干净；用 replaceState 不产生历史记录 */
  function syncURL() {
    var q = new URLSearchParams();
    if (kind === "movie") q.set(URL_PARAMS.tab, "movie");
    if (statusSel.value) q.set(URL_PARAMS.status, statusSel.value);
    if (markSel.value) q.set(URL_PARAMS.mark, markSel.value);
    if (networkSel.value) q.set(URL_PARAMS.net, networkSel.value);
    if (originSel.value) q.set(URL_PARAMS.origin, originSel.value);
    if (sortSel.value) q.set(URL_PARAMS.sort, sortSel.value);
    if (sortDirBtn.dataset.dir === "asc") q.set(URL_PARAMS.dir, "asc");
    if (kind === "movie" && groupViewSel.value === "grouped") q.set(URL_PARAMS.view, "grouped");
    var s = q.toString();
    history.replaceState(null, "", window.location.pathname + (s ? "?" + s : ""));
  }

  /* ---------- 全量抓取 ---------- */
  function refreshData() {
    if (!window.confirm(cfg().refreshConfirm)) return;
    btnRefresh.disabled = true;
    var oldText = btnRefresh.textContent;
    btnRefresh.textContent = "抓取中…";
    fetch("/api/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: kind })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        btnRefresh.disabled = false;
        btnRefresh.textContent = oldText;
        var tail = (res.log || "").split("\n").slice(-3).join("\n");
        if (res.ok) {
          window.alert("更新完成：\n" + tail);
          location.reload();
        } else {
          window.alert("抓取失败：\n" + (tail || res.error || "未知错误"));
        }
      })
      .catch(function (e) {
        btnRefresh.disabled = false;
        btnRefresh.textContent = oldText;
        window.alert("请求失败：" + e.message);
      });
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    tabs.querySelectorAll(".tab-btn").forEach(function (b) {
      b.addEventListener("click", function () { switchKind(b.dataset.kind); });
    });

    statusSel.addEventListener("change", render);
    networkSel.addEventListener("change", render);
    markSel.addEventListener("change", render);
    originSel.addEventListener("change", render);
    sortSel.addEventListener("change", render);
    groupViewSel.addEventListener("change", render);
    btnGroup.addEventListener("click", openGroupDialog);
    btnGroupConfirm.addEventListener("click", confirmGroup);
    btnGroupDismiss.addEventListener("click", dismissGroup);
    btnGroupCancel.addEventListener("click", closeGroupDialog);
    groupOverlay.addEventListener("click", function (ev) {
      if (ev.target === groupOverlay) closeGroupDialog();
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
        chooseMark(btn.dataset.mark);
      });
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        if (!markOverlay.hidden) closeMarkDialog();
        if (!groupOverlay.hidden) closeGroupDialog();
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
  if (urlState.status) selectIfExists(statusSel, urlState.status);
  if (urlState.mark) markSel.value = urlState.mark;
  if (urlState.net) selectIfExists(networkSel, urlState.net);
  if (urlState.sort) selectIfExists(sortSel, urlState.sort);
  if (urlState.dir === "asc") {
    sortDirBtn.dataset.dir = "asc";
    sortDirBtn.querySelector(".dir-text").textContent = "升序";
  }
  groupViewSel.value = (kind === "movie" && urlState.view === "grouped") ? "grouped" : "flat";
  if (kind === "movie" && urlState.origin) originSel.value = urlState.origin;

  bindEvents();
  applyEditModeUI();
  render();
})();