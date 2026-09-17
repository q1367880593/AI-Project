/* LPL 数据档案馆 — 前端逻辑（无构建依赖，兼容旧版 WebView） */

var $ = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

var state = {
  scope: "", year: "", tournament: "", team: "", playerId: null,
  page: 1, pageSize: 20, total: 0,
  activeSeries: null, activeGame: 0,
};

function showError(msg) {
  var el = $("#errBanner");
  if (!el) return;
  el.textContent = "⚠ " + msg;
  el.hidden = false;
  setTimeout(function () { el.hidden = true; }, 8000);
}
window.onerror = function (msg) { showError("页面脚本出错: " + msg); };

var esc = function (s) {
  return String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
};

function val(v, d) { return (v === undefined || v === null) ? d : v; }

/* UTC → 北京时间显示 */
function fmtTime(utc) {
  if (!utc) return "—";
  var d = new Date(String(utc).replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return String(utc).slice(5, 16);
  var bj = new Date(d.getTime() + 8 * 3600 * 1000);
  var p = function (n) { return String(n).padStart ? String(n).padStart(2, "0") : (n < 10 ? "0" : "") + n; };
  return bj.getUTCFullYear() + "-" + p(bj.getUTCMonth() + 1) + "-" + p(bj.getUTCDate()) +
    " " + p(bj.getUTCHours()) + ":" + p(bj.getUTCMinutes());
}

function teamBadge(team, cls) {
  cls = cls || "";
  if (!team) {
    return '<span class="team-cell ' + cls + '"><span class="tlogo-fallback"><span>?</span></span><span class="tname">未知</span></span>';
  }
  var name = esc(team.short_name || team.name);
  var initial = esc((team.short_name || team.name || "?").charAt(0));
  if (team.logo) {
    return '<span class="team-cell ' + cls + '"><img class="tlogo" src="' + esc(team.logo) + '" alt="' + name +
      '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
      '<span class="tlogo-fallback" style="display:none"><span>' + initial + '</span></span>' +
      '<span class="tname">' + name + '</span></span>';
  }
  return '<span class="team-cell ' + cls + '"><span class="tlogo-fallback"><span>' + initial + '</span></span>' +
    '<span class="tname">' + name + '</span></span>';
}

function api(url) {
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error(url + " → HTTP " + r.status);
    return r.json();
  });
}

/* ---------- 概览与筛选 ---------- */

function loadOverview() {
  return api("/api/overview").then(function (o) {
    var chips = [["赛段", o.tournaments], ["系列", o.series], ["小局", o.games], ["选手", o.players]];
    $("#statsChips").innerHTML = chips.map(function (c) {
      return '<span class="chip">' + c[0] + ' <b>' + c[1].toLocaleString() + "</b></span>";
    }).join("");

    var sel = $("#selYear");
    sel.innerHTML = '<option value="">全部年份</option>' + (o.years || []).map(function (y) {
      return '<option value="' + y + '">' + y + " 赛季</option>";
    }).join("");
  });
}

function loadTournaments() {
  var params = new URLSearchParams();
  if (state.year) params.set("year", state.year);
  if (state.scope) params.set("scope", state.scope);
  var qs = params.toString();
  return api("/api/tournaments" + (qs ? "?" + qs : "")).then(function (list) {
    var sel = $("#selTournament");
    var keep = state.tournament;
    // 只展示有比赛的赛段（Worlds 系列母页等无比赛行隐藏）
    var opts = list.filter(function (t) { return t.series_count > 0 || t.games_count > 0; });
    function optsHtml(arr) {
      return arr.map(function (t) {
        return '<option value="' + t.id + '">' +
          (t.is_international
            ? "[" + esc(t.league_short) + "][" + t.year + "] "
            : "[" + t.year + "] ") + esc(t.name_cn || t.name) + "（" + t.series_count + " 场）</option>";
      }).join("");
    }
    // 分组：LPL / LCK / LEC / LCS / 国际赛
    var groups = [];
    ["LPL", "LCK", "LEC", "LCS"].forEach(function (lg) {
      var arr = opts.filter(function (t) { return !t.is_international && t.league_short === lg; });
      if (arr.length) groups.push('<optgroup label="' + lg + '">' + optsHtml(arr) + "</optgroup>");
    });
    var intlArr = opts.filter(function (t) { return !!t.is_international; });
    if (intlArr.length) groups.push('<optgroup label="国际赛">' + optsHtml(intlArr) + "</optgroup>");
    sel.innerHTML = '<option value="">全部赛段</option>' + groups.join("");
    if (opts.some(function (t) { return String(t.id) === keep; })) sel.value = keep;
  });
}

function loadTeams() {
  return api("/api/teams").then(function (list) {
    $("#selTeam").innerHTML = '<option value="">全部队伍</option>' + list.map(function (t) {
      return '<option value="' + t.id + '">' + esc(t.short_name || t.name) + "</option>";
    }).join("");
  });
}

/* 选手搜索 */
var searchTimer = null;
$("#playerInput").addEventListener("input", function () {
  clearTimeout(searchTimer);
  var q = $("#playerInput").value.trim();
  if (!q) { hidePlayerDrop(); return; }
  searchTimer = setTimeout(function () {
    api("/api/players?q=" + encodeURIComponent(q) + "&limit=12").then(function (list) {
      var drop = $("#playerDrop");
      drop.innerHTML = list.map(function (p) {
        return '<div class="opt" data-id="' + p.id + '">' +
          "<span>" + esc(p.native_name || p.name || p.player_id) + " <small>" + esc(p.player_id || "") + "</small></span>" +
          "<small>" + p.games_count + " 局</small></div>";
      }).join("");
      drop.hidden = false;
      $$(".opt", drop).forEach(function (el) {
        el.addEventListener("click", function () {
          state.playerId = el.getAttribute("data-id");
          $("#playerInput").value = el.querySelector("span").textContent.split(" ")[0];
          hidePlayerDrop();
          fetchSeries(1);
        });
      });
    });
  }, 260);
});
$("#playerInput").addEventListener("blur", function () { setTimeout(hidePlayerDrop, 150); });
function hidePlayerDrop() { $("#playerDrop").hidden = true; }

/* 联赛标签：国际赛金色、其它赛区蓝色；LPL 不显示 */
function leagueBadge(s) {
  if (!s.league_short || s.league_short === "LPL") return "";
  return '<span class="lg-badge' + (s.league_intl ? "" : " rgn") + '">' +
    esc(s.league_short) + "</span> ";
}

/* ---------- 系列列表 ---------- */

function fetchSeries(page) {
  state.page = page || 1;
  var params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("page_size", String(state.pageSize));
  if (state.tournament) params.set("tournament_id", state.tournament);
  if (state.team) params.set("team_id", state.team);
  if (state.playerId) params.set("player_id", state.playerId);
  if (state.scope) params.set("scope", state.scope);
  if (state.year && !state.tournament) params.set("year", state.year);

  var listEl = $("#seriesList");
  listEl.innerHTML = '<div class="empty">加载中…</div>';
  api("/api/series?" + params.toString()).then(function (data) {
    state.total = data.total;
    $("#resultCount").textContent = "共 " + data.total.toLocaleString() + " 场";

    if (!data.items.length) {
      listEl.innerHTML = '<div class="empty">没有符合条件的系列赛</div>';
      $("#pager").hidden = true;
      return;
    }

    listEl.innerHTML = data.items.map(function (s, i) {
      var w1 = s.winner_id && s.team1 && String(s.winner_id) === String(s.team1.id);
      var w2 = s.winner_id && s.team2 && String(s.winner_id) === String(s.team2.id);
      var score = '<span class="' + (w1 ? "w" : "") + '">' + val(s.score1, "-") + "</span>" +
        '<span class="sep">:</span>' +
        '<span class="' + (w2 ? "w" : "") + '">' + val(s.score2, "-") + "</span>";
      return '<div class="series-row" data-id="' + s.id + '" style="--i:' + i + '" role="button" tabindex="0">' +
        '<div class="series-date">' + fmtTime(s.start_time_utc) +
          '<span class="bo">BO' + val(s.best_of, "?") + " · " + s.game_count + " 局</span></div>" +
        '<div class="teams-line">' + teamBadge(s.team1, w1 ? "win" : "loser") + teamBadge(s.team2, w2 ? "win" : "loser") + "</div>" +
        '<div class="score-line">' + score + "</div>" +
        '<div class="series-meta">' + leagueBadge(s) +
        (s.patch ? esc(s.patch) + " · " : "") + esc(s.tournament_name_cn || s.tournament_name || "") + "</div></div>";
    }).join("");

    $$(".series-row", listEl).forEach(function (el) {
      function open() { openSeries(el.getAttribute("data-id")); }
      el.addEventListener("click", open);
      el.addEventListener("keydown", function (e) { if (e.key === "Enter") open(); });
    });

    var pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    $("#pageInfo").textContent = "第 " + state.page + " / " + pages + " 页";
    $("#pager").hidden = false;
    $("#btnPrev").disabled = state.page <= 1;
    $("#btnNext").disabled = state.page >= pages;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }).catch(function (err) { showError(err.message); });
}

function openSeries(sid) {
  state.activeSeries = sid;
  state.activeGame = 0;
  $$(".series-row").forEach(function (el) {
    el.classList.toggle("active", el.getAttribute("data-id") === String(sid));
  });
  var panel = $("#detailPanel");
  panel.innerHTML = '<div class="empty">加载中…</div>';
  api("/api/series/" + sid).then(renderDetail).catch(function (err) {
    panel.innerHTML = '<div class="empty">加载失败</div>';
    showError(err.message);
  });
}

/* ---------- 明细渲染 ---------- */

function renderDetail(s) {
  var w1 = s.winner_id && s.team1 && String(s.winner_id) === String(s.team1.id);
  var w2 = s.winner_id && s.team2 && String(s.winner_id) === String(s.team2.id);
  var panel = $("#detailPanel");

  var tabs = s.games.map(function (g, i) {
    return '<button class="game-tab ' + (i === state.activeGame ? "active" : "") +
      (g.completeness ? "" : " no-bp") + '" data-i="' + i + '">G' + val(g.game_no, i + 1) +
      (g.completeness ? "" : " △") + "</button>";
  }).join("");

  panel.innerHTML =
    '<div class="detail-head">' +
      '<div class="tour">' + leagueBadge(s) +
        esc(s.tournament_name_cn || s.tournament_name) +
        ((s.phase_cn || s.shown_round || s.phase)
          ? " · " + esc(s.phase_cn || s.shown_round || s.phase || "") : "") +
        (s.start_time_utc ? " · " + fmtTime(s.start_time_utc) : "") + "</div>" +
      '<div class="versus">' +
        '<span class="t ' + (w1 ? "win" : "") + '">' + esc(s.team1 ? s.team1.name : "?") + "</span>" +
        '<span class="score"><span class="' + (w1 ? "w" : "") + '">' + val(s.score1, "-") + "</span> : " +
          '<span class="' + (w2 ? "w" : "") + '">' + val(s.score2, "-") + "</span></span>" +
        '<span class="t ' + (w2 ? "win" : "") + '">' + esc(s.team2 ? s.team2.name : "?") + "</span></div>" +
      '<div class="flags">BO' + val(s.best_of, "?") + " · 版本 " + esc(s.patch || "—") + " · " + s.game_count + " 局</div>" +
    "</div>" +
    '<div class="game-tabs">' + tabs + "</div>" +
    '<div class="game-body" id="gameBody"></div>';

  $$(".game-tab", panel).forEach(function (tab) {
    tab.addEventListener("click", function () {
      state.activeGame = Number(tab.getAttribute("data-i"));
      renderGameBody(s);
      $$(".game-tab", panel).forEach(function (t) { t.classList.toggle("active", t === tab); });
    });
  });

  renderGameBody(s);
}

function bpCells(list, big) {
  return list.map(function (b) {
    return '<span class="champ-box ' + (big ? "big" : "") + (b.champion ? "" : " ban") + '">' +
      (b.champion ? '<img src="' + esc(b.champion.icon) + '" alt="' + esc(b.champion.name_cn || b.champion.name) + '" loading="lazy">' : "") +
      (b.slot ? '<span class="order">' + b.slot + "</span>" : "") + "</span>";
  }).join("");
}

function renderGameBody(s) {
  var body = $("#gameBody");
  var g = s.games[state.activeGame];
  if (!g) { body.innerHTML = '<div class="empty">该局无数据</div>'; return; }

  var side1 = g.sides["1"];
  var side2 = g.sides["2"];

  var mins = g.game_length_min;
  var lengthText = "—";
  if (mins !== null && mins !== undefined) {
    var mm = Math.floor(mins), ss = Math.round((mins - mm) * 60);
    lengthText = mm + ":" + (ss < 10 ? "0" : "") + ss;
  }
  var meta = ["时长 " + lengthText, "版本 " + esc(g.patch || "—")].concat(
    g.completeness ? [] : ["△ 数据不完整"]
  ).join(" · ");

  function sideBlock(side, sideNo) {
    if (!side || !side.team) return '<div class="bp-side"></div>';
    var isWin = Number(g.win_team_side) === Number(sideNo);
    var st = side.stats || {};
    return '<div class="bp-side">' +
      "<h4>" + teamBadge(side.team, isWin ? "" : "loser") +
        '<span class="' + (isWin ? "win-dot" : "lose-dot") + '"></span></h4>' +
      '<div class="bp-row"><span class="label">BAN</span>' + bpCells(side.bans, false) + "</div>" +
      '<div class="bp-row"><span class="label">PICK</span>' + bpCells(side.picks, true) + "</div>" +
      '<div class="team-stats">' +
        '<span class="tstat">击杀 <b>' + val(st.kills, "—") + "</b></span>" +
        '<span class="tstat">经济 <b>' + (st.gold != null ? (st.gold / 1000).toFixed(1) + "k" : "—") + "</b></span>" +
        '<span class="tstat">推塔 <b>' + val(st.towers, "—") + "</b></span>" +
        '<span class="tstat">大龙 <b>' + val(st.barons, "—") + "</b></span>" +
      "</div></div>";
  }

  var roleCn = { 1: "上单", 2: "打野", 3: "中单", 4: "ADC", 5: "辅助" };

  // 单侧 6 格（参照官方赛事中心样式）：出装 / KDA / 金钱 / 补刀 / 召唤师技能+英雄 / 选手
  // rev=true 为右侧：列顺序镜像（选手…出装），技能格内部 hero 靠左
  function muSideCells(p, isWin, rev) {
    var rv = rev ? " rev" : "";
    var wn = isWin ? " win" : "";
    if (!p) {
      return '<div class="mc"></div><div class="mc"></div><div class="mc"></div>' +
        '<div class="mc"></div><div class="mc"></div><div class="mc"></div>';
    }
    var spellList = p.spells && p.spells.length
      ? p.spells
      : String(p.summoner_spells || "").split(",")
          .filter(function (s) { return s.trim() !== ""; })
          .map(function (s) { return { name: s.trim(), icon: null }; });
    var itemList = p.items_icons && p.items_icons.length
      ? p.items_icons
      : String(p.items || "").split(";")
          .filter(function (s) { return s.trim() !== ""; })
          .map(function (s) { return { name: s.trim(), icon: null }; });
    var tiles = "";
    for (var it = 0; it < 6; it++) {
      var itm = itemList[it];
      if (itm) {
        tiles += '<span class="it" title="' + esc(itm.name) + '">' +
          (itm.icon
            ? '<img src="' + esc(itm.icon) + '" alt="" loading="lazy">'
            : esc(itm.name.split(",")[0])) +
          "</span>";
      } else {
        tiles += '<span class="it no"></span>';
      }
    }
    var triIcon = p.trinket_icon && p.trinket_icon.name ? p.trinket_icon : null;
    var tri = triIcon
      ? '<span class="it tri" title="' + esc(triIcon.name) + '">' +
          (triIcon.icon
            ? '<img src="' + esc(triIcon.icon) + '" alt="" loading="lazy">'
            : esc(triIcon.name)) +
        "</span>"
      : "";
    var sums = spellList.map(function (sp) {
      if (sp.icon) {
        return '<span class="sm" title="' + esc(sp.name) + '"><img src="' + esc(sp.icon) + '" alt="" loading="lazy"></span>';
      }
      return '<span class="sm txt" title="' + esc(sp.name) + '">' + esc(sp.name) + "</span>";
    }).join("");
    var rname = p.native_name || p.name || "";
    // 显示用比赛 ID；弹窗用数字档案主键（避免同名不同人如 Viper 串档）
    var pidText = p.pkey || p.link_used || "?";
    var pidKey = p.player_id !== null && p.player_id !== undefined ? String(p.player_id) : "";
    // 出装区：6 装备格 + 1 饰品格，饰品放外侧（左半区在格子左边、右半区在格子右边）
    var equipInner = rev
      ? '<div class="grid">' + tiles + "</div>" + tri
      : tri + '<div class="grid">' + tiles + "</div>";
    var cells = [];
    cells.push(
      '<div class="mc equip' + wn + '">' + equipInner + "</div>",
      '<div class="mc kda' + wn + '"><span class="k">' + val(p.kills, 0) + "</span>/" +
        '<span class="d">' + val(p.deaths, 0) + "</span>/" +
        '<span class="a">' + val(p.assists, 0) + "</span></div>",
      '<div class="mc num' + wn + '">' + (p.gold != null ? (p.gold / 1000).toFixed(1) + "k" : "—") + "</div>",
      '<div class="mc num' + wn + '">' + val(p.cs, "—") + "</div>",
      '<div class="mc skill' + wn + rv + '">' +
        '<span class="sums">' + sums + "</span>" +
        (p.champion
          ? '<span class="hero"><img src="' + esc(p.champion.icon) + '" alt="" ' +
            'title="' + esc(p.champion.name_cn || p.champion.name) + '" loading="lazy"></span>'
          : "") +
      "</div>",
      '<div class="mc player' + wn + '" data-key="' + esc(pidKey) + '" title="' + esc(rname) + '" role="button" tabindex="0">' +
        (p.photo
          ? '<img class="pp" src="' + esc(p.photo) + '" alt="" loading="lazy">'
          : '<span class="pp no">' + esc(pidText.charAt(0)) + "</span>") +
        '<span class="pid">' + esc(pidText) + "</span>" +
        '<span class="prole">' + (roleCn[p.role_number] || esc(p.role || "")) + "</span></div>"
    );
    if (rev) cells.reverse();
    return cells.join("");
  }

  var bySide = { "1": [], "2": [] };
  g.players.forEach(function (p) {
    var k = String(p.side);
    if (!bySide[k]) bySide[k] = [];
    bySide[k].push(p);
  });
  "12".split("").forEach(function (k) {
    bySide[k] = bySide[k].sort(function (a, b) {
      return (a.role_number || 99) - (b.role_number || 99);
    });
  });
  var winSide = Number(g.win_team_side);

  var muHead =
    '<div class="mc h">出装</div><div class="mc h">击杀/死亡/助攻</div><div class="mc h">金钱</div>' +
    '<div class="mc h">补刀</div><div class="mc h">召唤师技能/英雄</div><div class="mc h">选手</div>' +
    '<div class="mc h role">对位</div>' +
    '<div class="mc h">选手</div><div class="mc h">召唤师技能/英雄</div><div class="mc h">补刀</div>' +
    '<div class="mc h">金钱</div><div class="mc h">击杀/死亡/助攻</div><div class="mc h">出装</div>';

  var muRows = "";
  for (var i = 0; i < 5; i++) {
    var left = bySide["1"][i];
    var right = bySide["2"][i];
    if (!left && !right) continue;
    var rn = (left && left.role_number) || (right && right.role_number);
    muRows += '<div class="mu-row">' +
      muSideCells(left, winSide === 1, false) +
      '<div class="mc role">' + (roleCn[rn] || "?") + "</div>" +
      muSideCells(right, winSide === 2, true) +
      "</div>";
  }

  body.innerHTML =
    '<div class="game-meta">' + meta + "</div>" +
    '<div class="bp-board">' + sideBlock(side1, 1) +
      '<div class="versus-divider"><span>VS</span></div>' + sideBlock(side2, 2) + "</div>" +
    '<div class="matchup"><h4>对局详情</h4>' +
      '<div class="mu-scroll"><div class="mu-table">' +
        '<div class="mu-head">' + muHead + "</div>" +
        muRows +
      "</div></div>" +
    "</div>";

  $$(".mc.player", body).forEach(function (el) {
    var pid = el.getAttribute("data-key");
    function open() { if (pid) openPlayerModalByKey(pid); }
    el.addEventListener("click", open);
    el.addEventListener("keydown", function (e) { if (e.key === "Enter") open(); });
  });
}

/* ---------- 选手弹窗 ---------- */

function openPlayerModalByKey(key) {
  openPlayerModal(encodeURIComponent(key));
}

function openPlayerModal(pid) {
  $("#modalBackdrop").hidden = false;
  $("#modalBox").innerHTML = '<div class="empty">加载中…</div>';
  api("/api/players/" + pid).then(function (p) {
    var a = p.agg || {};
    var kda = a.deaths ? ((a.kills + a.assists) / a.deaths).toFixed(2) : "∞";
    $("#modalBox").innerHTML =
      '<button class="close" data-close>✕</button>' +
      '<div class="m-head">' +
        (p.photo ? '<img class="m-photo" src="' + esc(p.photo) + '" alt="">' : "") +
        "<div><h3>" + esc(p.native_name || p.name || p.player_id) + "</h3>" +
        "<p>" + esc(p.player_id || "") + " · " + esc(p.role || "") + " · " + esc(p.country || "") +
        (p.is_retired ? " · 已退役" : "") + "</p></div></div>" +
      (p.aliases.length ? '<div class="aliases">' + p.aliases.map(function (x) {
        return "<span>" + esc(x) + "</span>";
      }).join("") + "</div>" : "") +
      '<div class="kda-grid">' +
        '<div class="kda-cell"><b>' + val(a.games, 0) + "</b><span>出场局数</span></div>" +
        '<div class="kda-cell"><b>' + val(a.wins, 0) + "</b><span>胜局</span></div>" +
        '<div class="kda-cell"><b>' + val(a.kills, 0) + "/" + val(a.deaths, 0) + "/" + val(a.assists, 0) + "</b><span>K / D / A</span></div>" +
        '<div class="kda-cell"><b>' + kda + "</b><span>KDA</span></div></div>" +
      '<h4 style="font-size:12px;color:var(--text-faint);letter-spacing:2px;margin-bottom:8px">常用英雄</h4>' +
      '<div class="champ-pool">' + p.champions.map(function (c) {
        return '<span class="cp" title="' + esc(c.name_cn || c.name) + '">' +
          '<img src="' + esc(c.icon) + '" alt="" loading="lazy"><span>' + c.cnt + "局</span></span>";
      }).join("") + "</div>" +
      '<div class="yearly"><table>' + p.yearly.map(function (y) {
        return "<tr><td>" + y.year + "</td><td>" + y.games + " 局</td><td>" + y.wins + " 胜</td></tr>";
      }).join("") + "</table></div>";
    $$("#modalBox [data-close]").forEach(function (b) { b.addEventListener("click", closeModal); });
  }).catch(function (err) { showError(err.message); });
}

function closeModal() { $("#modalBackdrop").hidden = true; }
$("#modalBackdrop").addEventListener("click", function (e) {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

/* ---------- 事件绑定与启动 ---------- */

$("#selScope").addEventListener("change", function (e) {
  state.scope = e.target.value;
  state.tournament = "";
  loadTournaments().then(function () { fetchSeries(1); });
});

$("#selYear").addEventListener("change", function (e) {
  state.year = e.target.value;
  state.tournament = "";
  loadTournaments().then(function () { fetchSeries(1); });
});

$("#selTournament").addEventListener("change", function (e) {
  state.tournament = e.target.value;
  fetchSeries(1);
});

$("#selTeam").addEventListener("change", function (e) {
  state.team = e.target.value;
  fetchSeries(1);
});

$("#btnReset").addEventListener("click", function () {
  state.scope = ""; state.year = ""; state.tournament = ""; state.team = ""; state.playerId = null;
  $("#selScope").value = ""; $("#selYear").value = ""; $("#selTeam").value = ""; $("#playerInput").value = "";
  loadTournaments().then(function () { fetchSeries(1); });
});

$("#btnPrev").addEventListener("click", function () { fetchSeries(state.page - 1); });
$("#btnNext").addEventListener("click", function () { fetchSeries(state.page + 1); });

(function init() {
  var step = Promise.resolve();
  step = step.then(loadOverview);
  step = step.then(loadTournaments);
  step = step.then(loadTeams);
  step = step.then(function () { fetchSeries(1); });
  step.catch(function (err) {
    showError("初始化失败: " + err.message + "（请确认服务已在 8765 端口运行）");
    $("#seriesList").innerHTML = '<div class="empty">加载失败：' + esc(err.message) + "</div>";
  });
})();