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
  var btnRefresh = document.getElementById("btn-refresh");
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

  var editMode = false;

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

  function showKey(show) {
    if (show.imdb_id) return "imdb|" + show.imdb_id;
    return "title|" + (show.title || "");
  }

  function allShows() {
    return (data && data.shows ? data.shows : []).map(function (s) {
      s._key = showKey(s);
      return s;
    });
  }

  /* 把完整列表 POST 给 server.py 写盘；成功后更新内存数据并重渲染（不刷新页面） */
  function persistEntries(entries, onFail) {
    fetch("/api/save-shows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: entries })
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function () {
        data.shows = entries;
        render();
      })
      .catch(function (e) {
        if (onFail) onFail();
        window.alert("写入 shows.json 失败：" + e.message + "（请确认 server.py 正在运行）");
        render();
      });
  }

  /* ---------- 卡片 ---------- */
  function seasonLine(season) {
    if (!season) return null;
    return "最新季 S" + season.season_number + " · " + formatDate(season.air_date);
  }

  function episodeLink(show, ep) {
    if (!ep || show.tmdb_id == null || ep.season == null || ep.episode == null) return null;
    var text = "S" + ep.season + "E" + ep.episode + " · " + formatDate(ep.air_date);
    return link(episodeUrl(show.tmdb_id, ep.season, ep.episode), "ep-link", text);
  }

  function detailUrl(show) {
    if (show.tmdb_id != null) return showUrl(show.tmdb_id);
    return searchUrl(show.title || "");
  }

  function markBadge(show) {
    var mark = show.mark || "";
    var btn = el("button", "mark-btn", mark === "" ? "＋ 标记" : (mark === "finished" ? "已追完" : "已弃剧"));
    btn.type = "button";
    btn.title = "标记观剧状态（直接写入 shows.json）";
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
    btn.title = "移除该剧（直接写入 shows.json）";
    btn.setAttribute("aria-label", "移除 " + (show.name || show.title));
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      var label = show.name || show.title;
      if (!window.confirm("确认移除「" + label + "」？\n将立即从 shows.json 移除。")) return;
      persistEntries(allShows().filter(function (s) { return s._key !== show._key; }));
    });
    return btn;
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
    titleRow.appendChild(link(detailUrl(show), "title", show.name || show.title));
    if (show.status) {
      titleRow.appendChild(el("span", "badge " + statusClass(show.status), show.status_zh || show.status));
    } else {
      titleRow.appendChild(el("span", "badge badge-other", "待抓取"));
    }
    if (editMode) {
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

    if (!show.status) {
      meta.appendChild(el("div", "line muted", "尚未抓取数据，点击上方「更新数据」补齐"));
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
    var shows = allShows();
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
    var merged = allShows();
    if (merged.length === 0) {
      grid.innerHTML = "";
      grid.appendChild(el("div", "empty", "暂无数据：点击「✎ 编辑」→「＋ 添加」录入剧集，或点「更新数据」全量抓取。"));
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
      var mark = s.mark || "";
      if (markFilter === "none" && mark) return false;
      if (markFilter === "finished" && mark !== "finished") return false;
      if (markFilter === "dropped" && mark !== "dropped") return false;
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

  function doSearch() {
    var q = inputTitle.value.trim();
    if (!q) {
      searchHint.textContent = "请输入剧名";
      inputTitle.focus();
      return;
    }
    searchHint.textContent = "搜索中…";
    fetch("/api/search?q=" + encodeURIComponent(q))
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
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
        searchHint.textContent = "搜索失败：" + e.message + "（请确认代理可用且 server.py 运行中）";
        searchResultsBox.innerHTML = "";
      });
  }

  function renderSearchResults(list) {
    searchResultsBox.innerHTML = "";
    var existing = allShows().map(function (s) { return (s.title || "").trim().toLowerCase(); });
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
    fetch("/api/show?id=" + encodeURIComponent(r.id))
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
    var key = showKey(pendingDetail);
    var dup = allShows().some(function (s) { return s._key === key; });
    if (dup) {
      window.alert("该剧已在列表中，无需重复添加。");
      closeDialog();
      return;
    }
    persistEntries(allShows().concat([pendingDetail]));
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
    var key = showKey(entry);
    var dup = allShows().some(function (s) { return s._key === key; });
    if (dup) {
      window.alert("该剧已在列表中，无需重复添加。");
      closeDialog();
      return;
    }
    persistEntries(allShows().concat([entry]));
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

  /* ---------- 编辑模式 ---------- */
  function applyEditModeUI() {
    btnEdit.classList.toggle("tb-btn-active", editMode);
    btnEdit.textContent = editMode ? "✎ 编辑中" : "✎ 编辑";
    btnAdd.hidden = !editMode;
  }

  function toggleEditMode() {
    editMode = !editMode;
    applyEditModeUI();
    render();
  }

  /* ---------- 全量抓取 ---------- */
  function refreshData() {
    if (!window.confirm("将调用 fetch_tv.py 全量抓取所有剧集（需几分钟，需代理可用），继续？")) return;
    btnRefresh.disabled = true;
    var oldText = btnRefresh.textContent;
    btnRefresh.textContent = "抓取中…";
    fetch("/api/refresh", { method: "POST" })
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
        if (!overlay.hidden) closeDialog();
      }
      if (ev.key === "Enter" && !overlay.hidden) {
        if (!viewPreview.hidden) confirmAdd();
        else if (!viewManual.hidden) confirmManual();
        else doSearch();
      }
    });
  }

  initFilters();
  bindEvents();
  applyEditModeUI();
  render();
})();