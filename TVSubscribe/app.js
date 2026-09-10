(function () {
  "use strict";

  var data = window.TV_DATA;
  var grid = document.getElementById("grid");
  var updatedAt = document.getElementById("updated-at");
  var statusSel = document.getElementById("filter-status");
  var networkSel = document.getElementById("filter-network");
  var sortSel = document.getElementById("sort-key");
  var sortDirBtn = document.getElementById("sort-dir");
  var resultCount = document.getElementById("result-count");
  var footerCount = document.getElementById("footer-count");

  var btnAdd = document.getElementById("btn-add");
  var btnExport = document.getElementById("btn-export");
  var btnEdit = document.getElementById("btn-edit");
  var markSel = document.getElementById("filter-mark");
  var overlay = document.getElementById("add-overlay");
  var markOverlay = document.getElementById("mark-overlay");
  var markLabel = document.getElementById("mark-label");
  var inputTitle = document.getElementById("add-input-title");
  var searchResultsBox = document.getElementById("search-results");
  var searchHint = document.getElementById("search-hint");
  var viewSearch = document.getElementById("add-view-search");
  var viewPreview = document.getElementById("add-view-preview");
  var viewManual = document.getElementById("add-view-manual");
  var previewBox = document.getElementById("preview-box");
  var mTitle = document.getElementById("add-m-title");
  var mZh = document.getElementById("add-m-zh");
  var mImdb = document.getElementById("add-m-imdb");

  var TMDB_BASE = "https://www.themoviedb.org/tv/";
  var TMDB_SEARCH = "https://www.themoviedb.org/search?query=";
  var TMDB_API = "https://api.themoviedb.org/3";
  var TMDB_IMG = "https://image.tmdb.org/t/p/w200";
  var API_KEY = (window.TV_CONFIG && window.TV_CONFIG.api_key) ? window.TV_CONFIG.api_key : "";
  var CORS_PROXY = (window.TV_CONFIG && window.TV_CONFIG.cors_proxy) ? window.TV_CONFIG.cors_proxy : "";
  var STATUS_ORDER = ["Returning Series", "Ended", "Canceled", "In Production", "Planned", "Pilot"];
  var STATUS_ZH = {
    "Returning Series": "在播",
    "Ended": "已完结",
    "Canceled": "已取消",
    "In Production": "制作中",
    "Planned": "计划中",
    "Pilot": "试播集"
  };

  /* ---------- 本地持久化（localStorage） ---------- */
  var LS_PREFIX = "tvsub.";
  var state = { marks: {}, custom: [], hidden: [], editMode: false };

  function lsGet(key, fallback) {
    try {
      var v = localStorage.getItem(LS_PREFIX + key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    } catch (e) { /* 忽略存储失败（如隐私模式） */ }
  }

  function loadState() {
    state.marks = lsGet("marks", {});
    state.custom = lsGet("custom", []);
    state.hidden = lsGet("hidden", []);
    state.editMode = !!lsGet("editMode", false);
  }

  function saveMarks() { lsSet("marks", state.marks); }
  function saveCustom() { lsSet("custom", state.custom); }
  function saveHidden() { lsSet("hidden", state.hidden); }

  function showKey(show) {
    if (show.imdb_id) return "imdb|" + show.imdb_id;
    return "title|" + (show.title || "");
  }

  function customKey(c) {
    return showKey({ imdb_id: c.imdb_id || null, title: c.title });
  }

  function baseShows() {
    return (data && data.shows) ? data.shows : [];
  }

  function mergedShows() {
    var builtin = baseShows().map(function (s) {
      s._key = showKey(s);
      return s;
    });
    var customs = state.custom.map(function (c) {
      return {
        title: c.title,
        name: c.name_zh || c.title,
        original_name: c.original_name || "",
        status: c.status || null,
        status_zh: c.status_zh || "",
        in_production: null,
        first_air_date: c.first_air_date || "",
        last_air_date: c.last_air_date || "",
        poster: c.poster || null,
        last_episode: c.last_episode || null,
        next_episode: c.next_episode || null,
        latest_season: c.latest_season || null,
        networks: c.networks || [],
        imdb_id: c.imdb_id || null,
        tmdb_id: c.tmdb_id || null,
        found: true,
        custom: true,
        _key: customKey(c)
      };
    });
    return builtin.concat(customs).filter(function (s) {
      return state.hidden.indexOf(s._key) < 0;
    });
  }

  /* ---------- 工具函数 ---------- */
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
  function searchUrl(title) { return TMDB_SEARCH + encodeURIComponent(title); }
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

  /* ---------- 卡片 ---------- */
  function detailUrl(show) {
    if (show.tmdb_id != null) return showUrl(show.tmdb_id);
    if (show.custom) return searchUrl(show.title);
    return "#";
  }

  function markBadge(show) {
    var mark = state.marks[show._key] || "";
    var btn = el("button", "mark-btn", mark === "" ? "＋ 标记" : (mark === "finished" ? "已追完" : "已弃剧"));
    btn.type = "button";
    btn.title = "选择观剧状态（存于本浏览器）";
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
    btn.title = "移除该剧（仅本浏览器隐藏）";
    btn.setAttribute("aria-label", "移除 " + (show.name || show.title));
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      var label = show.name || show.title;
      if (!window.confirm("确认移除「" + label + "」？\n仅在本浏览器隐藏，导出的 shows.json 将不再包含它。")) return;
      if (show.custom) {
        state.custom = state.custom.filter(function (c) { return customKey(c) !== show._key; });
        saveCustom();
      } else {
        state.hidden.push(show._key);
        saveHidden();
      }
      render();
    });
    return btn;
  }

  function card(show) {
    var c = el("div", "card");
    if (state.marks[show._key] === "dropped") c.classList.add("dropped");

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
    titleRow.appendChild(link(detailUrl(show), "title", show.name || show.title));
    if (show.custom && !show.status) {
      titleRow.appendChild(el("span", "badge badge-custom", "本地添加"));
    } else {
      titleRow.appendChild(el("span", "badge " + statusClass(show.status), show.status_zh));
    }
    if (state.editMode) {
      titleRow.appendChild(markBadge(show));
      titleRow.appendChild(deleteBtn(show));
    }
    info.appendChild(titleRow);

    var nets = show.networks || [];
    if (nets.length) {
      var chipRow = el("div", "net-row");
      nets.slice(0, 2).forEach(function (n) {
        chipRow.appendChild(el("span", "chip", n));
      });
      if (nets.length > 2) {
        chipRow.appendChild(el("span", "chip chip-more", "+" + (nets.length - 2)));
      }
      info.appendChild(chipRow);
    }

    if (show.original_name && show.original_name !== show.name) {
      info.appendChild(el("div", "original", show.original_name));
    }

    var meta = el("div", "meta");

    if (show.custom && !show.status) {
      meta.appendChild(el("div", "line muted", "尚未抓取数据，运行 fetch_tv.py 后可获取完整信息"));
    } else {
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
    }

    info.appendChild(meta);
    c.appendChild(info);
    return c;
  }

  /* ---------- 筛选与排序 ---------- */
  function initFilters() {
    var shows = baseShows();
    if (!shows.length) return;

    var statuses = {};
    shows.forEach(function (s) {
      if (s.found && s.status) statuses[s.status] = s.status_zh || s.status;
    });
    Object.keys(statuses).sort(function (a, b) {
      var ia = STATUS_ORDER.indexOf(a), ib = STATUS_ORDER.indexOf(b);
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
    var merged = mergedShows();
    if (merged.length === 0) {
      grid.innerHTML = "";
      grid.appendChild(el("div", "empty", "暂无数据：请先运行 python3 fetch_tv.py 生成 data.js，或点击工具栏「＋ 添加」。"));
      resultCount.textContent = "";
      return;
    }

    if (data && data.generated_at) {
      updatedAt.textContent = "更新于 " + data.generated_at;
    }
    footerCount.textContent = "共收录 " + merged.length + " 部剧集";

    var status = statusSel.value;
    var network = networkSel.value;
    var markFilter = markSel.value;
    var key = sortSel.value;
    var asc = sortDirBtn.dataset.dir === "asc";

    var list = merged.filter(function (s) {
      if (status && s.status !== status) return false;
      if (network && (s.networks || []).indexOf(network) < 0) return false;
      if (markFilter === "none" && state.marks[s._key]) return false;
      if (markFilter === "finished" && state.marks[s._key] !== "finished") return false;
      if (markFilter === "dropped" && state.marks[s._key] !== "dropped") return false;
      return true;
    });

    var sorted = sortShows(list, key, asc);

    if (status || network || markFilter) {
      resultCount.innerHTML = "当前 <b>" + sorted.length + "</b> / " + merged.length + " 部";
    } else {
      resultCount.innerHTML = "共 <b>" + merged.length + "</b> 部";
    }

    grid.innerHTML = "";
    if (sorted.length === 0) {
      grid.appendChild(el("div", "empty", "没有符合条件的剧集。"));
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

  /* ---------- 添加弹窗（搜索 → 预览 → 确认） ---------- */
  var pendingPick = null;
  var pendingDetail = null;

  function apiUrl(path) {
    var u = TMDB_API + path;
    return CORS_PROXY ? CORS_PROXY + encodeURIComponent(u) : u;
  }

  function apiFetch(path, timeoutMs) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || 10000);
    return fetch(apiUrl(path), { signal: ctrl.signal })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("接口返回 " + r.status);
        return r.json();
      })
      .catch(function (e) {
        clearTimeout(timer);
        throw e;
      });
  }

  function openDialog() {
    overlay.hidden = false;
    pendingPick = null;
    pendingDetail = null;
    inputTitle.value = "";
    searchHint.textContent = "输入剧名后回车或点击搜索";
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

  function confirmManual() {
    var title = mTitle.value.trim();
    if (!title) {
      mTitle.focus();
      return;
    }
    var entry = {
      title: title,
      name_zh: mZh.value.trim() || null,
      imdb_id: mImdb.value.trim() || null
    };
    var key = customKey(entry);
    var dup = mergedShows().some(function (s) { return s._key === key; });
    if (dup) {
      window.alert("该剧已在列表中，无需重复添加。");
      closeDialog();
      return;
    }
    state.custom.push(entry);
    saveCustom();
    closeDialog();
    render();
  }

  function doSearch() {
    var q = inputTitle.value.trim();
    if (!q) {
      searchHint.textContent = "请输入剧名";
      inputTitle.focus();
      return;
    }
    if (!API_KEY) {
      searchHint.textContent = "未配置 TMDB API Key，请检查 config.js";
      return;
    }
    searchHint.textContent = "搜索中…";
    apiFetch("/search/tv?api_key=" + encodeURIComponent(API_KEY) + "&language=zh-CN&query=" + encodeURIComponent(q))
      .then(function (res) {
        var list = res.results || [];
        if (!list.length) {
          searchHint.textContent = "未找到与「" + q + "」相关的剧集";
          searchResultsBox.innerHTML = "";
          return;
        }
        searchHint.textContent = "找到 " + list.length + " 个结果，点击选择";
        renderSearchResults(list);
      })
      .catch(function (e) {
        searchHint.textContent = "搜索失败：" + (e.name === "AbortError" ? "请求超时" : e.message) + "（需能访问 api.themoviedb.org；可开启系统代理或配置 cors_proxy，或使用下方手动输入）";
        searchResultsBox.innerHTML = "";
      });
  }

  function renderSearchResults(list) {
    searchResultsBox.innerHTML = "";
    var existing = mergedShows().map(function (s) { return (s.title || "").trim().toLowerCase(); });
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
      body.appendChild(el("div", "s-name", r.name || ""));
      var cand = (r.original_name || r.name || "").trim().toLowerCase();
      var added = existing.indexOf(cand) >= 0;
      if (added) {
        body.appendChild(el("span", "s-added", "已添加"));
      }
      var sub = "";
      if (r.original_name && r.original_name !== r.name) sub = r.original_name;
      if (r.first_air_date) sub = sub ? sub + " · " + r.first_air_date.slice(0, 4) : r.first_air_date.slice(0, 4);
      if (sub) body.appendChild(el("div", "s-sub", sub));
      if (r.overview) body.appendChild(el("div", "s-over", r.overview));
      item.appendChild(body);
      if (added) {
        item.classList.add("search-item-added");
        item.disabled = true;
        item.title = "该剧已在列表中";
      } else {
        item.addEventListener("click", function () { pickResult(r); });
      }
      searchResultsBox.appendChild(item);
    });
  }

  function pickResult(r) {
    pendingPick = {
      title: r.original_name || r.name || "",
      name_zh: r.name || null,
      poster: r.poster_path ? TMDB_IMG + r.poster_path : null,
      first_air_date: r.first_air_date || ""
    };
    showPreviewView();
    previewBox.innerHTML = "";
    previewBox.appendChild(el("div", "preview-loading", "加载详情中…"));
    Promise.all([
      apiFetch("/tv/" + r.id + "?api_key=" + encodeURIComponent(API_KEY) + "&language=zh-CN"),
      apiFetch("/tv/" + r.id + "/external_ids?api_key=" + encodeURIComponent(API_KEY))
    ]).then(function (arr) {
      pendingDetail = buildCustomEntry(arr[0], arr[1], pendingPick);
      renderPreview(pendingDetail);
    }).catch(function (e) {
      previewBox.innerHTML = "";
      previewBox.appendChild(el("div", "preview-error", "加载失败：" + (e.name === "AbortError" ? "请求超时" : e.message)));
    });
  }

  function buildCustomEntry(detail, ext, pick) {
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
      name_zh: detail.name || null,
      original_name: detail.original_name || detail.name || "",
      status: detail.status,
      status_zh: STATUS_ZH[detail.status] || detail.status,
      first_air_date: detail.first_air_date || "",
      last_air_date: detail.last_air_date || "",
      poster: detail.poster_path ? TMDB_IMG + detail.poster_path : null,
      last_episode: ep(detail.last_episode_to_air),
      next_episode: ep(detail.next_episode_to_air),
      latest_season: latest,
      networks: (detail.networks || []).map(function (n) { return n.name; }),
      imdb_id: (ext && ext.imdb_id) || null,
      tmdb_id: detail.id
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
    var year = (entry.first_air_date || "").slice(0, 4);
    var sub = year + (entry.status_zh ? " · " + entry.status_zh : "");
    if ((entry.networks || []).length) sub += " · " + entry.networks.join(" / ");
    metaBox.appendChild(el("div", "preview-sub", sub));
    wrap.appendChild(metaBox);
    previewBox.appendChild(wrap);
  }

  function confirmAdd() {
    if (!pendingDetail) return;
    var key = customKey(pendingDetail);
    var dup = mergedShows().some(function (s) { return s._key === key; });
    if (dup) {
      window.alert("该剧已在列表中，无需重复添加。");
      closeDialog();
      return;
    }
    state.custom.push(pendingDetail);
    saveCustom();
    closeDialog();
    render();
  }

  /* ---------- 标记弹窗 ---------- */
  var pendingMark = null;

  function openMarkDialog(show) {
    pendingMark = show;
    markLabel.textContent = "标记「" + (show.name || show.title) + "」";
    var current = state.marks[show._key] || "";
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
    if (value) state.marks[pendingMark._key] = value;
    else delete state.marks[pendingMark._key];
    saveMarks();
    closeMarkDialog();
    render();
  }

  /* ---------- 导出 shows.json ---------- */
  function exportShows() {
    var list = mergedShows().map(function (s) {
      var o = { title: s.title };
      if (s.imdb_id) o.imdb_id = s.imdb_id;
      if (s.name && s.name !== s.title) o.name_zh = s.name;
      return o;
    });
    var blob = new Blob([JSON.stringify({ shows: list }, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "shows.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- 编辑模式 ---------- */
  function applyEditModeUI() {
    btnEdit.classList.toggle("tb-btn-active", state.editMode);
    btnEdit.textContent = state.editMode ? "✎ 编辑中" : "✎ 编辑";
    btnAdd.hidden = !state.editMode;
  }

  function toggleEditMode() {
    state.editMode = !state.editMode;
    lsSet("editMode", state.editMode);
    applyEditModeUI();
    render();
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    statusSel.addEventListener("change", render);
    networkSel.addEventListener("change", render);
    markSel.addEventListener("change", render);
    sortSel.addEventListener("change", render);
    sortDirBtn.addEventListener("click", function () {
      var asc = sortDirBtn.dataset.dir !== "asc";
      sortDirBtn.dataset.dir = asc ? "asc" : "desc";
      sortDirBtn.querySelector(".dir-text").textContent = asc ? "升序" : "降序";
      render();
    });

    btnEdit.addEventListener("click", toggleEditMode);
    btnAdd.addEventListener("click", openDialog);
    btnExport.addEventListener("click", exportShows);
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
        if (!overlay.hidden) closeDialog();
      }
      if (ev.key === "Enter" && !overlay.hidden) {
        if (!viewPreview.hidden) confirmAdd();
        else if (!viewManual.hidden) confirmManual();
        else doSearch();
      }
    });
  }

  loadState();
  initFilters();
  bindEvents();
  applyEditModeUI();
  render();
})();