/* =============================================================================
   GOLDEN ROAD LoL — Game controller (browser)
   Depends on: data.js (GAME_TEAMS) and engine.js (GREngine)
   ============================================================================= */
(function () {
  "use strict";

  var E = window.GREngine;
  var ROLES = E.ROLES;
  var ROLE_NAMES = E.ROLE_NAMES;
  var REGION_NAMES = E.REGION_NAMES;
  /* Role icons. Uses the image files in /icons when present; if a file is
     missing the <img> onerror swaps in a built-in SVG so nothing ever breaks.
     Drop your own art in as: icons/top.png, icons/jungle.png, icons/mid.png,
     icons/adc.png, icons/support.png  (PNG or SVG — see ROLE_FILE ext below). */
  var ROLE_SVG = {
    TOP: '<svg class="role-svg" viewBox="0 0 100 100" aria-hidden="true"><rect x="33" y="33" width="46" height="46" rx="7" fill="none" stroke="#8a7752" stroke-width="13"/><rect x="21" y="21" width="46" height="46" rx="7" fill="none" stroke="#c8aa6e" stroke-width="13"/></svg>',
    JNG: '<svg class="role-svg" viewBox="0 0 100 100" aria-hidden="true"><g fill="#c8aa6e"><path d="M50 92 C47 62 47 40 50 16 C53 40 53 62 50 92 Z"/><path d="M50 92 C45 64 39 50 33 38 C42 52 48 68 50 92 Z"/><path d="M50 92 C55 64 61 50 67 38 C58 52 52 68 50 92 Z"/><path d="M50 92 C40 66 30 54 21 44 C34 56 46 70 50 92 Z"/><path d="M50 92 C60 66 70 54 79 44 C66 56 54 70 50 92 Z"/></g></svg>',
    MID: '<svg class="role-svg" viewBox="0 0 100 100" aria-hidden="true"><rect x="27" y="27" width="46" height="46" rx="7" fill="none" stroke="#8a7752" stroke-width="12"/><circle cx="67" cy="33" r="7.5" fill="#c8aa6e"/><circle cx="33" cy="67" r="7.5" fill="#c8aa6e"/><line x1="34" y1="66" x2="66" y2="34" stroke="#c8aa6e" stroke-width="15" stroke-linecap="round"/></svg>',
    ADC: '<svg class="role-svg" viewBox="0 0 100 100" aria-hidden="true"><rect x="21" y="21" width="46" height="46" rx="7" fill="none" stroke="#8a7752" stroke-width="13"/><rect x="33" y="33" width="46" height="46" rx="7" fill="none" stroke="#c8aa6e" stroke-width="13"/><rect x="43" y="43" width="14" height="14" rx="2" fill="#c8aa6e"/></svg>',
    SUP: '<svg class="role-svg" viewBox="0 0 100 100" aria-hidden="true"><g fill="#c8aa6e"><circle cx="50" cy="20" r="9"/><path d="M50 31 L78 26 L70 42 L54 45 Z"/><path d="M50 31 L22 26 L30 42 L46 45 Z"/><path d="M42 35 L58 35 L54 66 L50 90 L46 66 Z"/></g></svg>'
  };
  var ROLE_FILE = { TOP: "top.png", JNG: "jungle.png", MID: "mid.png", ADC: "adc.png", SUP: "support.png" };
  // Set to false to use the built-in original SVG icons instead of the image
  // files in /icons. Recommended if you monetize: it avoids shipping Riot's
  // copyrighted role-icon artwork (Riot's fan policy restricts commercial use).
  var USE_OFFICIAL_ICONS = true;
  window.GRIconFallback = function (img) {
    var r = img.getAttribute("data-role");
    if (ROLE_SVG[r]) img.insertAdjacentHTML("afterend", ROLE_SVG[r]);
    img.remove();
  };
  var ROLE_ICON = {};
  ROLES.forEach(function (r) {
    ROLE_ICON[r] = USE_OFFICIAL_ICONS
      ? '<img class="role-img" data-role="' + r + '" alt="' + ROLE_NAMES[r] + '" src="icons/' + ROLE_FILE[r] + '" onerror="GRIconFallback(this)">'
      : ROLE_SVG[r];
  });

  var app = document.getElementById("app");

  var state = {
    phase: "start",
    mode: "golden",                                  // "golden" | "msi"
    index: E.buildIndex(window.GAME_TEAMS),
    msiIndex: E.buildIndex(window.MSI_TEAMS || []),
    roster: [null, null, null, null, null],
    used: new Set(),
    rerolls: { region: 1, team: 1, year: 1 },
    spin: null,
    spinning: false,
    result: null,
    teamRating: null
  };
  function isMSI() { return state.mode === "msi"; }
  function activeIndex() { return isMSI() ? state.msiIndex : state.index; }

  /* ----------------------------- helpers ---------------------------------- */
  function ordinal(n) {
    if (n == null) return "—";
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function teamName(id) { return activeIndex().teamsById[id].name; }
  function regionName(code) { return REGION_NAMES[code] || code || ""; }
  /* Roster is indexed in ROLES order; a null slot is an open position. */
  function openRolesArr() { return ROLES.filter(function (r, i) { return !state.roster[i]; }); }
  function openRolesSet() { return new Set(openRolesArr()); }
  function picksMade() { return state.roster.filter(Boolean).length; }

  function fitWheelValue(el) {
    if (!el) return;
    var wheel = el.closest(".wheel");
    var base = wheel && wheel.classList.contains("spinning") ? 16 : 22;
    var min = wheel && wheel.id === "wheel-team" ? 9 : 12;
    el.style.fontSize = "";
    el.style.removeProperty("--wheel-fit-scale");
    base = Math.min(base, parseFloat(getComputedStyle(el).fontSize) || base);

    var available = el.parentElement.clientWidth - 8;
    if (available <= 0) return;

    var size = base;
    el.style.fontSize = size + "px";
    while (el.scrollWidth > available && size > min) {
      size -= .5;
      el.style.fontSize = size + "px";
    }
    if (el.scrollWidth > available) {
      el.style.setProperty("--wheel-fit-scale", Math.min(1, available / el.scrollWidth).toFixed(3));
    }
  }

  function fitWheelValues() {
    document.querySelectorAll(".wheel-value").forEach(fitWheelValue);
  }

  /* ----------------------------- draft flow ------------------------------- */
  function startRun(mode) {
    state.mode = (mode === "msi") ? "msi" : "golden";
    state.roster = [null, null, null, null, null];
    state.used = new Set();
    state.rerolls = isMSI() ? { team: 1, year: 1 } : { region: 1, team: 1, year: 1 };
    state.result = null;
    state.teamRating = null;
    state.phase = "draft";
    spinNext();
  }

  function spinNext() {
    state.spin = E.spinInitial(activeIndex(), openRolesSet(), state.used);
    state.spinning = true;
    renderDraft();
    if (isMSI()) runSpinAnimationMSI(["team", "year"]);
    else runSpinAnimation(["region", "team", "year"]);
  }

  /* MSI mode has two wheels:
       Team reroll -> any other MSI team from the same year.
       Year reroll -> the same MSI organization in another year. */
  function msiRerollOptions(kind, open, cur) {
    if (!cur) return [];
    return E.usableCombos(activeIndex(), open, state.used).filter(function (c) {
      if (kind === "team") return c.year === cur.year && c.teamId !== cur.teamId;
      if (kind === "year") return c.teamId === cur.teamId && c.year !== cur.year;
      return false;
    });
  }
  function rerollMSI(kind, open, cur) {
    var pool = msiRerollOptions(kind, open, cur);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  function doReroll(kind) {
    if (state.spinning) return;
    if (state.rerolls[kind] <= 0) return;
    var open = openRolesSet();
    var cur = state.spin;

    if (isMSI()) {
      var nextMSI = rerollMSI(kind, open, cur);
      if (!nextMSI) { flash(kind === "year" ? "No other MSI year available for this team." : "No other MSI team available for this year."); return; }
      state.rerolls[kind]--;
      state.spin = nextMSI;
      state.spinning = true;
      renderDraft();
      runSpinAnimationMSI(kind === "year" ? ["year"] : ["team"]);
      return;
    }

    var next = null;
    if (kind === "region") next = E.rerollRegion(state.index, open, state.used, cur);
    else if (kind === "team") next = E.rerollTeam(state.index, open, state.used, cur);
    else if (kind === "year") next = E.rerollYear(state.index, open, state.used, cur);
    if (!next) { flash("No other option available for that reroll."); return; }
    // Spin only the wheels that actually changed (a Region reroll keeps the year).
    var wheels = [];
    if (next.region !== cur.region) wheels.push("region");
    if (next.teamId !== cur.teamId) wheels.push("team");
    if (next.year !== cur.year) wheels.push("year");
    if (!wheels.length) wheels = ["team"];
    state.rerolls[kind]--;
    state.spin = next;
    state.spinning = true;
    renderDraft();
    runSpinAnimation(wheels);
  }

  function selectPlayer(playerId) {
    if (state.spinning) return;
    var open = openRolesSet();
    var cands = E.candidates(activeIndex(), state.spin, state.used);
    var chosen = null;
    for (var i = 0; i < cands.length; i++) {
      if (cands[i].playerId === playerId && !cands[i].used && open.has(cands[i].role)) { chosen = cands[i]; break; }
    }
    if (!chosen) return; // role already filled or player already used
    state.roster[ROLES.indexOf(chosen.role)] = {
      role: chosen.role, playerId: chosen.playerId, name: chosen.name,
      teamName: chosen.teamName, region: chosen.region, year: chosen.year, rating: chosen.rating
    };
    state.used.add(chosen.playerId);
    if (picksMade() < 5) spinNext();
    else finishDraft();
  }

  function finishDraft() {
    var ratings = state.roster.map(function (r) { return r.rating; });
    state.teamRating = E.teamRating(ratings);
    state.result = isMSI() ? E.simulateMSI(state.teamRating) : E.simulateRun(state.teamRating);
    state.phase = "result";
    renderResult();
  }

  /* --------------------------- spin animation ----------------------------- */
  function runSpinAnimation(wheels) {
    var target = state.spin;
    var regionPool = E.REGIONS;
    var teamPool = state.index.teamsByRegion[target.region].map(function (t) { return t.name; });
    var yearPool = []; for (var y = 2011; y <= 2025; y++) yearPool.push(y);

    var els = {
      region: document.querySelector('#wheel-region .wheel-value'),
      team: document.querySelector('#wheel-team .wheel-value'),
      year: document.querySelector('#wheel-year .wheel-value')
    };
    wheels.forEach(function (w) { if (els[w]) els[w].parentElement.classList.add("spinning"); });

    var stopAt = { region: 460, team: 620, year: 780 };
    var t0 = Date.now();
    var rnd = function (a) { return a[Math.floor(Math.random() * a.length)]; };

    var timer = setInterval(function () {
      var elapsed = Date.now() - t0;
      var allDone = true;
      wheels.forEach(function (w) {
        if (!els[w]) return;
        if (elapsed < stopAt[w]) {
          allDone = false;
          els[w].textContent = w === "region" ? rnd(regionPool) : (w === "team" ? rnd(teamPool) : rnd(yearPool));
          fitWheelValue(els[w]);
        } else if (els[w].parentElement.classList.contains("spinning")) {
          els[w].textContent = w === "region" ? target.region : (w === "team" ? teamName(target.teamId) : target.year);
          els[w].parentElement.classList.remove("spinning");
          els[w].parentElement.classList.add("landed");
          fitWheelValue(els[w]);
          setTimeout((function (el) { return function () { el.classList.remove("landed"); }; })(els[w].parentElement), 280);
        }
      });
      if (allDone) {
        clearInterval(timer);
        state.spinning = false;
        renderDraft();
      }
    }, 55);
  }

  /* MSI mode spins Team and/or Year wheels through historical MSI team-years. */
  function runSpinAnimationMSI(wheels) {
    var target = state.spin;
    wheels = wheels || ["team", "year"];
    var teamPool = state.msiIndex.allCombos
      .filter(function (c) { return c.year === target.year; })
      .map(function (c) { return state.msiIndex.teamsById[c.teamId].name; });
    var yearPool = (state.msiIndex.teamsById[target.teamId] || { years: [] }).years;
    if (!yearPool.length) yearPool = state.msiIndex.allCombos.map(function (c) { return c.year; });
    var els = {
      team: document.querySelector('#wheel-team .wheel-value'),
      year: document.querySelector('#wheel-year .wheel-value')
    };
    wheels.forEach(function (w) { if (els[w]) els[w].parentElement.classList.add("spinning"); });

    var stopAt = { team: 640, year: 780 }, t0 = Date.now();
    var rnd = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    var timer = setInterval(function () {
      var elapsed = Date.now() - t0;
      var allDone = true;
      wheels.forEach(function (w) {
        if (!els[w]) return;
        if (elapsed < stopAt[w]) {
          allDone = false;
          els[w].textContent = w === "team" ? rnd(teamPool) : rnd(yearPool);
          fitWheelValue(els[w]);
        } else if (els[w].parentElement.classList.contains("spinning")) {
          els[w].textContent = w === "team" ? teamName(target.teamId) : target.year;
          els[w].parentElement.classList.remove("spinning");
          els[w].parentElement.classList.add("landed");
          fitWheelValue(els[w]);
          setTimeout((function (el) { return function () { el.classList.remove("landed"); }; })(els[w].parentElement), 280);
        }
      });
      if (allDone) {
        clearInterval(timer);
        state.spinning = false;
        renderDraft();
      }
    }, 55);
  }

  /* ------------------------------ rendering ------------------------------- */
  function rosterBar() {
    var html = '<div class="roster-bar">';
    for (var i = 0; i < 5; i++) {
      var role = ROLES[i];
      var filled = state.roster[i];
      var cls = "rb-slot" + (filled ? " filled" : (state.phase === "draft" ? " open" : ""));
      html += '<div class="' + cls + '">' +
        '<div class="rb-icon">' + ROLE_ICON[role] + '</div>' +
        '<div class="rb-role">' + ROLE_NAMES[role] + '</div>' +
        '<div class="rb-player">' + (filled ? esc(filled.name) : "—") + '</div>' +
        (filled ? '<div class="rb-meta">' + esc(filled.teamName) + " · " + filled.year + '</div>' : '<div class="rb-meta">&nbsp;</div>') +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderDraft() {
    if (isMSI()) return renderDraftMSI();
    var spin = state.spin;
    var spinning = state.spinning;
    var open = openRolesSet();
    var cands = spinning ? [] : E.candidates(state.index, spin, state.used);

    var rr = state.rerolls;
    function rrBtn(kind, label) {
      var n = rr[kind];
      var noOption = !spinning && !E.canReroll(state.index, kind, open, state.used, spin);
      var dis = (n <= 0 || spinning || noOption) ? " disabled" : "";
      return '<button class="reroll-btn" data-action="reroll" data-kind="' + kind + '"' + dis + '>' +
        '🎲 Reroll ' + label + ' <span class="rr-count">' + n + '</span></button>';
    }

    var wheelsHtml =
      '<div class="wheels">' +
        wheel("region", "Region", spin ? spin.region : "—") +
        wheel("team", "Team", spin ? teamName(spin.teamId) : "—") +
        wheel("year", "Year", spin ? spin.year : "—") +
      '</div>';

    var openLabel = openRolesArr().map(function (r) { return ROLE_NAMES[r]; }).join(" · ");

    var candHtml;
    if (spinning) {
      candHtml = '<div class="cand-hint">Spinning…</div>';
    } else {
      candHtml = '<div class="cand-hint"><b>You</b> pick the player &amp; position — final once chosen.' +
        '<br><span class="cand-open">Open: ' + openLabel + '</span></div><div class="cand-grid">';
      cands.forEach(function (c) {
        var roleFilled = !open.has(c.role);
        var disabled = c.used || roleFilled;
        var note = c.used ? "✓ Already drafted" : (roleFilled ? "✓ " + ROLE_NAMES[c.role] + " filled" : "DRAFT ▸");
        candHtml += '<button class="cand-card' + (disabled ? " used" : "") + '"' +
          (disabled ? " disabled" : ' data-action="select" data-player="' + esc(c.playerId) + '"') + '>' +
          '<div class="cc-name">' + esc(c.name) + '</div>' +
          '<div class="cc-role">' + ROLE_ICON[c.role] + ' ' + ROLE_NAMES[c.role] + '</div>' +
          '<div class="' + (disabled ? "cc-used" : "cc-pick") + '">' + note + '</div>' +
          '</button>';
      });
      candHtml += '</div>';
    }

    app.innerHTML =
      '<div class="screen draft">' +
        topbar("DRAFT · PICK " + (picksMade() + 1) + "/5") +
        rosterBar() +
        '<div class="region-label">' + (spin ? regionName(spin.region) : "") + '</div>' +
        wheelsHtml +
        '<div class="rerolls">' + rrBtn("region", "Region") + rrBtn("team", "Team") + rrBtn("year", "Year") + '</div>' +
        '<div class="reroll-note">1 Region · 1 Team · 1 Year reroll per run</div>' +
        candHtml +
      '</div>';
    fitWheelValues();
  }

  /* MSI mode draft: Team and Year wheels over curated MSI participant rosters. */
  function renderDraftMSI() {
    var spin = state.spin;
    var spinning = state.spinning;
    var open = openRolesSet();
    var cands = spinning ? [] : E.candidates(state.msiIndex, spin, state.used);

    function rrBtn(kind, label) {
      var n = state.rerolls[kind];
      var noOption = !spinning && !msiRerollOptions(kind, open, spin).length;
      var dis = (n <= 0 || spinning || noOption) ? " disabled" : "";
      return '<button class="reroll-btn" data-action="reroll" data-kind="' + kind + '"' + dis + '>' +
        '🎲 Reroll ' + label + ' <span class="rr-count">' + n + '</span></button>';
    }

    var openLabel = openRolesArr().map(function (r) { return ROLE_NAMES[r]; }).join(" · ");

    var candHtml;
    if (spinning) {
      candHtml = '<div class="cand-hint">Spinning…</div>';
    } else {
      candHtml = '<div class="cand-hint"><b>You</b> pick one player from this team — final once chosen.' +
        '<br><span class="cand-open">Open: ' + openLabel + '</span></div><div class="cand-grid">';
      cands.forEach(function (c) {
        var roleFilled = !open.has(c.role);
        var disabled = c.used || roleFilled;
        var note = c.used ? "✓ Already drafted" : (roleFilled ? "✓ " + ROLE_NAMES[c.role] + " filled" : "DRAFT ▸");
        candHtml += '<button class="cand-card' + (disabled ? " used" : "") + '"' +
          (disabled ? " disabled" : ' data-action="select" data-player="' + esc(c.playerId) + '"') + '>' +
          '<div class="cc-name">' + esc(c.name) + '</div>' +
          '<div class="cc-role">' + ROLE_ICON[c.role] + ' ' + ROLE_NAMES[c.role] + '</div>' +
          '<div class="' + (disabled ? "cc-used" : "cc-pick") + '">' + note + '</div>' +
          '</button>';
      });
      candHtml += '</div>';
    }

    app.innerHTML =
      '<div class="screen draft msi">' +
        topbar("MSI CHALLENGE · PICK " + (picksMade() + 1) + "/5") +
        rosterBar() +
        '<div class="region-label msi-region">' + (spin ? regionName(spin.region) : "") + '</div>' +
        '<div class="wheels wheels-msi">' +
          wheel("team", "MSI Team", spin ? teamName(spin.teamId) : "—") +
          wheel("year", "Year", spin ? spin.year : "—") +
        '</div>' +
        '<div class="rerolls rerolls-msi">' + rrBtn("team", "Team") + rrBtn("year", "Year") + '</div>' +
        '<div class="reroll-note">1 Team · 1 Year reroll per MSI Challenge run</div>' +
        candHtml +
      '</div>';
    fitWheelValues();
  }

  function wheel(id, label, value) {
    return '<div class="wheel" id="wheel-' + id + '">' +
      '<div class="wheel-label">' + label + '</div>' +
      '<div class="wheel-window"><div class="wheel-value">' + esc(value) + '</div></div>' +
      '</div>';
  }

  /* ------------------------------- result --------------------------------- */
  function renderResult() {
    var r = state.result, tr = state.teamRating;

    app.innerHTML =
      '<div class="screen result">' +
        topbar(isMSI() ? "MSI CHALLENGE · RESULTS" : "RESULTS") +
        '<div class="tr-wrap"><div class="tr-label">Team Rating</div>' +
          '<div class="tr-value" id="tr-value">' + tr + '</div></div>' +
        rosterSummary() +
        '<div class="road" id="road"></div>' +
        '<div id="verdict"></div>' +
        '<div class="actions" id="result-actions"></div>' +
      '</div>';

    revealPath(r);
  }

  function rosterSummary() {
    var html = '<div class="roster-summary">';
    state.roster.forEach(function (p) {
      html += '<div class="rs-row"><span class="rs-ico">' + ROLE_ICON[p.role] + '</span>' +
        '<span class="rs-name">' + esc(p.name) + '</span>' +
        '<span class="rs-team">' + esc(p.teamName) + ' · ' + p.region + ' ' + p.year + '</span></div>';
    });
    html += '</div>';
    return html;
  }

  /* Build the whole zig-zag road at once: odd stops on the top row, even stops
     on the bottom row, joined by a golden line. Worlds is the larger "finale". */
  function buildRoadInner(stages) {
    var N = stages.length, colW = 100 / N, pts = [], nodes = "";
    stages.forEach(function (st, i) {
      var isTop = i % 2 === 0;
      var x = (i + 0.5) * colW;
      var y = isTop ? 32 : 68;
      pts.push(x.toFixed(2) + "," + y);
      var champ = st.place === 1;
      var miss = st.international && !st.qualified;
      var finale = st.key === "worlds";
      var caption = miss ? "Did not qualify" : ordinal(st.place) + " place";
      var accent = champ ? '<span class="rn-acc">👑</span>' : (finale && !miss ? '<span class="rn-acc">🏆</span>' : "");
      var bcls = "rn-badge" + (champ ? " champ" : (miss ? " miss" : "")) + (finale ? " finale" : "");
      var ncls = "road-node " + (isTop ? "top" : "bottom") + (champ ? " champ" : "") + (miss ? " miss" : "") + (finale ? " finale" : "");
      nodes +=
        '<div class="' + ncls + '" style="left:' + x + '%;top:' + y + '%;animation-delay:' + (i * 0.16).toFixed(2) + 's"' +
          ' title="' + esc(st.label + " — " + caption) + '">' +
          '<div class="' + bcls + '">' + accent + (miss ? "✕" : st.place) + '</div>' +
          '<div class="rn-text"><span class="rn-stage">' + st.label + '</span><span class="rn-place">' + caption + '</span></div>' +
        '</div>';
    });
    return '<svg class="road-track" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
             '<defs><linearGradient id="roadgrad" x1="0" y1="0" x2="1" y2="0">' +
               '<stop offset="0" stop-color="#5a4f38"/><stop offset="1" stop-color="#c8aa6e"/></linearGradient></defs>' +
             '<polyline class="road-line" points="' + pts.join(" ") + '" pathLength="100" fill="none" stroke="url(#roadgrad)" vector-effect="non-scaling-stroke"/>' +
           '</svg>' + nodes;
  }

  function revealPath(r) {
    document.getElementById("road").innerHTML = isMSI() ? buildMSIRoadInner(r.stages) : buildRoadInner(r.stages);
    setTimeout(function () { showVerdict(r); }, 1500);
  }

  function showVerdict(r) {
    var won = isMSI() ? r.champion : r.golden;
    var title = isMSI()
      ? (won ? "🏆 MSI CHAMPION 🏆" : "MSI RUN ENDED")
      : (won ? "🏆 GOLDEN ROAD COMPLETED 🏆" : "GOLDEN ROAD FAILED");
    var v = document.getElementById("verdict");
    v.innerHTML = '<div class="verdict ' + (won ? "win" : "fail") + ' reveal">' +
      title +
      '<div class="verdict-sub">' + verdictSub(r) + '</div></div>';

    document.getElementById("result-actions").innerHTML =
      '<div class="action-row">' +
        '<button class="btn primary" data-action="toShare">Share</button>' +
        '<button class="btn replay" data-action="restart">↻ Play Again</button>' +
      '</div>';
  }

  function verdictSub(r) {
    if (isMSI()) return msiVerdictSub(r);
    if (r.golden) return "Split 1 · First Stand · Split 2 · MSI · Split 3 · Worlds — all won. Legendary.";
    var w = r.stages[5];
    if (w.qualified && w.place === 1) return "World champions — but the clean sweep slipped away.";
    if (w.qualified) return "Reached Worlds and finished " + ordinal(w.place) + ".";
    var s3 = r.stages[4];
    if (s3.place <= 4) return "So close to the Worlds stage.";
    return "The road ends here. Build a stronger roster and run it back.";
  }

  /* The series the run was eliminated in (null when champion). */
  function msiLossStage(r) {
    for (var i = 0; i < r.stages.length; i++) {
      if (r.stages[i].outcome === "loss") return r.stages[i];
    }
    return null;
  }
  function msiExitLabel(r) { var L = msiLossStage(r); return L ? L.label : null; }
  function msiVerdictSub(r) {
    if (r.champion) {
      return r.viaLower
        ? "Battled up from the loser's bracket and took the Grand Final. MSI Champions."
        : "Play-In, Main Stage and Grand Final — ran the bracket clean. MSI Champions.";
    }
    var L = msiLossStage(r);
    if (!L) return "The run ends here. Draft a stronger five and run it back.";
    if (L.key === "playin") return "Knocked out in the Play-In — never reached the main stage.";
    if (L.key === "lower")  return "Eliminated in the Main Stage loser's bracket.";
    if (L.key === "final")  return "Reached the Grand Final but finished runner-up.";
    return "The run ends here. Draft a stronger five and run it back.";
  }

  /* Per-stage presentation from its outcome. kind drives colour:
     champ (gold) · miss (red) · drop (amber, dropped but alive) · bye · dim. */
  function msiNodeView(st) {
    var o = st.outcome, key = st.key, finale = st.finale;
    if (o === "win") {
      if (finale)          return { badge: "✓", caption: "Champions",   kind: "champ", accent: "🏆" };
      if (key === "playin") return { badge: "✓", caption: "Advanced",    kind: "champ" };
      if (key === "upper")  return { badge: "✓", caption: "Won bracket", kind: "champ" };
      if (key === "lower")  return { badge: "✓", caption: "Survived",    kind: "champ" };
      return { badge: "✓", caption: "Won", kind: "champ" };
    }
    if (o === "loss") {
      if (finale) return { badge: "✕", caption: "Runner-up", kind: "miss" };
      return { badge: "✕", caption: "Eliminated", kind: "miss" };
    }
    if (o === "drop") return { badge: "↓", caption: "To loser's bracket", kind: "drop" };
    if (o === "bye")  return { badge: "—", caption: "Bye · won upper", kind: "bye" };
    return { badge: "·", caption: "Did not reach", kind: "dim" };
  }
  function msiShareBadge(o) {
    return o === "win" ? "✓" : o === "loss" ? "✕" : o === "drop" ? "↓" : o === "bye" ? "—" : "·";
  }

  /* The MSI run as a zig-zag of four series (Play-In → Upper → Lower → Final),
     mirroring the Golden Road's road visual. */
  function buildMSIRoadInner(stages) {
    var N = stages.length, colW = 100 / N, pts = [], nodes = "";
    stages.forEach(function (st, i) {
      var isTop = i % 2 === 0;
      var x = (i + 0.5) * colW;
      var y = isTop ? 32 : 68;
      pts.push(x.toFixed(2) + "," + y);
      var finale = st.finale;
      var v = msiNodeView(st);
      var kc = (v.kind === "champ" ? " champ" : v.kind === "miss" ? " miss" : v.kind === "drop" ? " drop" : v.kind === "bye" ? " bye" : "");
      var accent = v.accent ? '<span class="rn-acc">' + v.accent + '</span>' : "";
      var bcls = "rn-badge" + kc + (finale ? " finale" : "");
      var ncls = "road-node " + (isTop ? "top" : "bottom") + kc + (finale ? " finale" : "");
      nodes +=
        '<div class="' + ncls + '" style="left:' + x + '%;top:' + y + '%;animation-delay:' + (i * 0.16).toFixed(2) + 's"' +
          ' title="' + esc(st.label + " — " + v.caption) + '">' +
          '<div class="' + bcls + '">' + accent + v.badge + '</div>' +
          '<div class="rn-text"><span class="rn-stage">' + st.label + '</span><span class="rn-place">' + v.caption + '</span></div>' +
        '</div>';
    });
    return '<svg class="road-track" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
             '<defs><linearGradient id="roadgrad" x1="0" y1="0" x2="1" y2="0">' +
               '<stop offset="0" stop-color="#5a4f38"/><stop offset="1" stop-color="#c8aa6e"/></linearGradient></defs>' +
             '<polyline class="road-line" points="' + pts.join(" ") + '" pathLength="100" fill="none" stroke="url(#roadgrad)" vector-effect="non-scaling-stroke"/>' +
           '</svg>' + nodes;
  }

  /* ------------------------------- share screen --------------------------- */
  function renderShare() {
    state.phase = "share";
    var r = state.result;
    var msi = isMSI();
    var won = msi ? r.champion : r.golden;
    var statusTxt = msi
      ? (won ? "MSI CHAMPION" : "MSI RUN ENDED")
      : (won ? "GOLDEN ROAD COMPLETED" : "GOLDEN ROAD FAILED");
    var titleHtml = msi ? 'MSI <span>Challenge</span>' : 'GOLDEN ROAD <span>LoL</span>';
    var pathHtml = msi
      ? r.stages.map(function (s) {
          return '<span class="scp"><i>' + s.label + '</i>' + msiShareBadge(s.outcome) + '</span>';
        }).join("")
      : r.stages.map(function (s) {
          var txt = s.international && !s.qualified ? "✕" : ordinal(s.place);
          return '<span class="scp"><i>' + s.label + '</i>' + txt + '</span>';
        }).join("");
    app.innerHTML =
      '<div class="screen share">' +
        topbar("SHARE") +
        '<div class="share-card" id="share-card">' +
          '<div class="sc-title">' + titleHtml + '</div>' +
          (msi ? '<div class="sc-sub">Mid-Season Invitational Mode</div>' : '') +
          '<div class="sc-status ' + (won ? "win" : "fail") + '">' + statusTxt + '</div>' +
          '<div class="sc-tr">Team Rating <b>' + state.teamRating + '</b></div>' +
          rosterSummary() +
          '<div class="sc-path">' + pathHtml + '</div>' +
          '<div class="sc-watermark">goldenroadlol.com</div>' +
        '</div>' +
        '<div class="share-row">' +
          '<button class="btn share" data-action="share">📲 Share</button>' +
          '<button class="btn share" data-action="download">⬇ Image</button>' +
          '<button class="btn share" data-action="tweet">𝕏 Post</button>' +
        '</div>' +
        '<div id="share-msg" class="save-msg"></div>' +
        '<div class="actions"><button class="btn replay big" data-action="restart">↻ Play Again</button></div>' +
      '</div>';
  }

  function showShareMsg(m) { var el = document.getElementById("share-msg"); if (el) el.textContent = m; }

  /* ------------------------------- sharing -------------------------------- */
  function shareText() {
    var r = state.result;
    if (isMSI()) {
      var head = r.champion
        ? "I won the MSI Challenge 🏆"
        : "I built a Team Rating " + state.teamRating + " MSI Challenge roster";
      var tail = r.champion ? "Swept the bracket." : ("Out at the " + msiExitLabel(r) + ".");
      return head + " on Golden Road LoL. " + tail + " Can you do better? goldenroadlol.com";
    }
    var ghead = r.golden ? "I completed the GOLDEN ROAD 🏆" : "I built a Team Rating " + state.teamRating + " roster";
    var w = r.stages[5];
    var worlds = w.qualified ? ("Worlds: " + ordinal(w.place)) : "Didn't reach Worlds";
    return ghead + " on Golden Road LoL — " + worlds + ". Can you do better? goldenroadlol.com";
  }

  function roundRectPath(x, rx, ry, w, h, r) {
    x.beginPath();
    x.moveTo(rx + r, ry);
    x.arcTo(rx + w, ry, rx + w, ry + h, r);
    x.arcTo(rx + w, ry + h, rx, ry + h, r);
    x.arcTo(rx, ry + h, rx, ry, r);
    x.arcTo(rx, ry, rx + w, ry, r);
    x.closePath();
  }

  function buildShareCanvas() {
    var W = 1080, H = 1080, c = document.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");
    var r = state.result, tr = state.teamRating;
    var msi = isMSI();
    var won = msi ? r.champion : r.golden;
    var lx = 96, rx = W - 96;

    var g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0a0e1a"); g.addColorStop(1, "#141b2e");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = "#c8aa6e"; x.lineWidth = 6; x.strokeRect(28, 28, W - 56, H - 44);

    /* ---- header (centered) ---- */
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.fillStyle = "#c8aa6e"; x.font = "bold 76px Georgia, serif";
    x.fillText(msi ? "MSI CHALLENGE" : "GOLDEN ROAD", W / 2, 150);
    x.fillStyle = "#f0e6d2"; x.font = "bold 40px Georgia, serif";
    x.fillText(msi ? "Mid-Season Invitational" : "L o L", W / 2, 206);

    x.fillStyle = won ? "#f0d28a" : "#8a93a8";
    x.font = "bold 44px Arial";
    x.fillText(msi
      ? (won ? "★ MSI CHAMPION ★" : "MSI RUN ENDED")
      : (won ? "★ GOLDEN ROAD COMPLETED ★" : "GOLDEN ROAD FAILED"), W / 2, 286);

    x.fillStyle = "#8a93a8"; x.font = "bold 23px Arial";
    x.fillText("TEAM RATING", W / 2, 344);
    x.fillStyle = "#5bc0de"; x.font = "bold 104px Arial";
    x.fillText(String(tr), W / 2, 450);

    /* ---- roster panel (full width, one line per player) ---- */
    var ry = 524, rowH = 70;
    x.fillStyle = "rgba(255,255,255,0.03)";
    roundRectPath(x, lx - 18, ry - 4, (rx - lx) + 36, rowH * 5 + 8, 18); x.fill();
    x.textBaseline = "middle";
    state.roster.forEach(function (p, i) {
      var cy = ry + rowH * i + rowH / 2 + 2;
      if (i > 0) {
        x.strokeStyle = "rgba(255,255,255,0.07)"; x.lineWidth = 1;
        x.beginPath(); x.moveTo(lx, ry + rowH * i + 2); x.lineTo(rx, ry + rowH * i + 2); x.stroke();
      }
      x.textAlign = "left";
      x.fillStyle = "#7e8aa3"; x.font = "bold 22px Arial";
      x.fillText(ROLE_NAMES[p.role].toUpperCase(), lx + 4, cy);
      x.fillStyle = "#f0e6d2"; x.font = "bold 34px Arial";
      x.fillText(p.name, lx + 200, cy);
      x.textAlign = "right";
      x.fillStyle = "#aab2c5"; x.font = "24px Arial";
      x.fillText(p.teamName + " · " + p.region + " " + p.year, rx - 4, cy);
    });

    /* ---- the road: a row of medallions ---- */
    var py = 940, n = r.stages.length, pw = (rx - lx) / n, rad = 30;
    r.stages.forEach(function (s, i) {
      var cx = lx + pw * i + pw / 2;
      var champ = msi ? (s.outcome === "win") : (s.place === 1);
      var miss = msi ? (s.outcome === "loss") : (s.international && !s.qualified);
      var drop = msi && s.outcome === "drop";
      x.textAlign = "center"; x.textBaseline = "alphabetic";
      x.fillStyle = "#7e8aa3"; x.font = "bold 15px Arial";
      x.fillText(s.label, cx, py - rad - 16);
      x.beginPath(); x.arc(cx, py, rad, 0, Math.PI * 2);
      x.fillStyle = champ ? "#d8b878" : (miss ? "rgba(224,85,107,0.12)" : (drop ? "rgba(216,162,74,0.12)" : "#1c2740"));
      x.fill();
      x.lineWidth = 3; x.strokeStyle = champ ? "#f0d28a" : (miss ? "#e0556b" : (drop ? "#d8a24a" : "#33436a")); x.stroke();
      x.textBaseline = "middle";
      x.fillStyle = champ ? "#20170a" : (miss ? "#e0556b" : (drop ? "#d8a24a" : "#f0e6d2"));
      x.font = "bold 30px Arial";
      var badge = msi ? msiShareBadge(s.outcome) : (miss ? "✕" : String(s.place));
      x.fillText(badge, cx, py + 1);
      x.textBaseline = "alphabetic";
      x.fillStyle = champ ? "#f0d28a" : (miss ? "#e0556b" : (drop ? "#d8a24a" : "#cdd4e2"));
      x.font = "bold 17px Arial";
      var msiSub = { win: s.finale ? "TITLE" : "WON", loss: "OUT", drop: "DROP", bye: "BYE", skip: "—" };
      var sub = msi ? (msiSub[s.outcome] || "—") : (miss ? "DNQ" : ordinal(s.place));
      x.fillText(sub, cx, py + rad + 26);
    });

    x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.fillStyle = "#c8aa6e"; x.font = "bold 28px Arial";
    x.fillText("goldenroadlol.com", W / 2, 1046);
    return c;
  }

  var SHARE_FILE_NAME = "golden-road-lol.png";

  function canvasToPngBlob(c) {
    var dataUrl = c.toDataURL("image/png");
    var comma = dataUrl.indexOf(",");
    var binary = atob(dataUrl.slice(comma + 1));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }

  function buildShareFile() {
    var blob = canvasToPngBlob(buildShareCanvas());
    if (typeof File === "function") return new File([blob], SHARE_FILE_NAME, { type: "image/png" });
    return blob;
  }

  function canNativeShareFile(file) {
    return !!(navigator.share && navigator.canShare && typeof File === "function" &&
      navigator.canShare({ files: [file] }));
  }

  function shareCancelled(e) {
    return e && e.name === "AbortError";
  }

  function isPhoneOrTablet() {
    return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function downloadBlob(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = SHARE_FILE_NAME;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  async function nativeShareFile(file, text) {
    var payload = { files: [file], title: "Golden Road LoL" };
    if (text) payload.text = text;
    await navigator.share(payload);
  }

  async function shareScore() {
    var file = buildShareFile();
    if (canNativeShareFile(file)) {
      try { await nativeShareFile(file, shareText()); showShareMsg("Shared."); return; }
      catch (e) { if (shareCancelled(e)) { showShareMsg(""); return; } }
    }
    try { await navigator.clipboard.writeText(shareText()); showShareMsg("Share text copied to clipboard!"); }
    catch (e) { showShareMsg("Sharing not supported here — use the Image button."); }
  }

  async function downloadImage() {
    var file = buildShareFile();
    if (isPhoneOrTablet() && canNativeShareFile(file)) {
      showShareMsg("Choose Save Image to save it to your camera roll.");
      try { await nativeShareFile(file); return; }
      catch (e) { if (shareCancelled(e)) { showShareMsg(""); return; } }
    }
    downloadBlob(file);
    showShareMsg("Image downloaded.");
  }

  /* X (Twitter) can't pre-attach an image via its compose link, so we copy the
     result image to the clipboard and open the composer immediately — a one-tap
     paste drops it into the post. */
  function tweet() {
    var text = shareText();
    var copyPromise = null;
    try {
      if (navigator.clipboard && typeof window.ClipboardItem === "function") {
        var blob = canvasToPngBlob(buildShareCanvas());
        copyPromise = navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      }
    } catch (e) { copyPromise = null; }

    // Open the composer within the click gesture so it isn't popup-blocked.
    window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text), "_blank", "noopener");

    if (copyPromise) {
      copyPromise
        .then(function () { showShareMsg("X opened — paste the image into your post (⌘/Ctrl+V)."); })
        .catch(function () { showShareMsg("X opened — add your saved image to the post."); });
    } else {
      showShareMsg("X opened — add your saved image to the post.");
    }
  }

  /* ------------------------------ start screen ---------------------------- */
  function renderStart() {
    state.phase = "start";
    app.innerHTML =
      '<div class="screen start">' +
        '<div class="hero">' +
          '<div class="hero-kicker">The League esports roster challenge</div>' +
          '<h1 class="hero-title">GOLDEN ROAD <span>LoL</span></h1>' +
          '<p class="hero-sub">Spin a region, team & year for each role. Draft a 5-player roster from LoL esports history and chase the only perfect season: win <b>Split 1, First Stand, Split 2, MSI, Split 3 &amp; Worlds.</b></p>' +
          '<div class="trophies">' +
            ["Split 1", "First Stand", "Split 2", "MSI", "Split 3", "Worlds"].map(function (t) {
              return '<span class="trophy">' + t + '</span>';
            }).join("<span class='trophy-arrow'>›</span>") +
          '</div>' +
          '<div class="hero-cta">' +
            '<button class="btn primary big" data-action="start" data-mode="golden">▸ Start Run</button>' +
            '<button class="btn msi big" data-action="start" data-mode="msi">🔥 MSI Challenge</button>' +
          '</div>' +
        '</div>' +
        '<div class="howto">' +
          '<div class="howto-title">How to Play</div>' +
          '<ol class="howto-steps">' +
            '<li>For each role, spin <b>Region → Team → Year</b>, then draft a player from that team-season.</li>' +
            '<li>Fill all five positions — <b>Top, Jungle, Mid, ADC, Support</b>. Each real player can be drafted once.</li>' +
            '<li>You get <b>one reroll each</b> for Region, Team &amp; Year. Then your season plays out — chase the Golden Road.</li>' +
          '</ol>' +
        '</div>' +
        '<div class="event-banner">' +
          '<span class="eb-badge">NEW · LIMITED EVENT</span>' +
          '<span class="eb-title">🔥 MSI Challenge</span>' +
          '<span class="eb-sub">Tap <b>MSI Challenge</b> to spin memorable <b>Mid-Season Invitational team-years</b>, draft one player per position, then run the bracket: <b>Play-In → Main Stage → Grand Final.</b> One Team reroll and one Year reroll.</span>' +
        '</div>' +
        '<section class="publisher-content" aria-label="Golden Road LoL guide">' +
          '<div class="content-section">' +
            '<h2>About the challenge</h2>' +
            '<p>Golden Road LoL is a strategy draft game for League esports fans. Each run asks you to balance nostalgia, roster knowledge and risk: the wheels pick the team-season, but you decide which player and role belongs on the final five.</p>' +
            '<p>The main Golden Road mode follows a full fantasy season. Your drafted lineup plays Split 1, First Stand, Split 2, MSI, Split 3 and Worlds. A perfect run means finishing first at every stop, which is intentionally rare even for elite rosters.</p>' +
          '</div>' +
          '<div class="content-section">' +
            '<h2>Strategy notes</h2>' +
            '<ul class="content-list">' +
              '<li><b>Save rerolls for weak team-years.</b> A Team reroll can rescue a difficult region-year, while a Year reroll is best when the organization had one legendary season nearby.</li>' +
              '<li><b>Draft scarce roles early.</b> If a rolled team has a standout Support or Jungle and that position is open, locking it can make later rolls easier.</li>' +
              '<li><b>Player history matters.</b> Ratings are hidden and tied to the player in that specific year, so prime seasons are more valuable than name recognition alone.</li>' +
            '</ul>' +
          '</div>' +
          '<div class="content-section">' +
            '<h2>Game modes and scoring</h2>' +
            '<p>Golden Road mode uses historical rosters from 2011 through 2025. MSI Challenge uses a curated set of memorable Mid-Season Invitational team-years from 2015 through 2026, excluding the cancelled 2020 event, and runs a shorter bracket simulation.</p>' +
            '<p>After five picks, the game averages your hidden player ratings into one Team Rating, then simulates each stage with opponent strength and randomness. Strong rosters improve your odds, but no draft guarantees the Golden Road.</p>' +
          '</div>' +
          '<div class="content-section">' +
            '<h2>Learn the rules</h2>' +
            '<p>New to the format or to League esports? Start with the full How to Play guide for draft rules, rerolls and scoring, then use the glossary to understand regions, events, roles and common competitive terms.</p>' +
          '</div>' +
          '<nav class="content-links" aria-label="Site information">' +
            '<a href="how-to-play/">How to Play</a>' +
            '<a href="glossary/">Glossary</a>' +
            '<a href="about.html">About and scoring</a>' +
            '<a href="contact.html">Contact</a>' +
            '<a href="privacy.html">Privacy</a>' +
            '<a href="terms.html">Terms</a>' +
          '</nav>' +
        '</section>' +
        '<div class="start-legal">' +
          '<p>Golden Road LoL is an unofficial fan game. It isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. Player and team names are factual references to public esports history; all ratings and results are fictional.</p>' +
          '<p class="start-legal-links"><a href="how-to-play/">How to Play</a> · <a href="glossary/">Glossary</a> · <a href="about.html">About</a> · <a href="contact.html">Contact</a> · <a href="privacy.html">Privacy Policy</a> · <a href="terms.html">Terms of Use</a></p>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------ chrome ---------------------------------- */
  function topbar(title) {
    return '<div class="topbar"><span class="tb-logo" data-action="home">GOLDEN ROAD <b>LoL</b></span><span class="tb-title">' + title + '</span></div>';
  }
  function flash(msg) {
    var f = document.createElement("div");
    f.className = "toast"; f.textContent = msg;
    document.body.appendChild(f);
    setTimeout(function () { f.classList.add("show"); }, 10);
    setTimeout(function () { f.classList.remove("show"); }, 1800);
    setTimeout(function () { f.remove(); }, 2200);
  }

  /* --------------------------- event delegation --------------------------- */
  app.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var a = el.dataset.action;
    if (a === "start") startRun(el.dataset.mode);
    else if (a === "restart") renderStart();
    else if (a === "reroll") doReroll(el.dataset.kind);
    else if (a === "select") selectPlayer(el.dataset.player);
    else if (a === "toShare") renderShare();
    else if (a === "share") shareScore();
    else if (a === "download") downloadImage();
    else if (a === "tweet") tweet();
    else if (a === "home") { if (confirm("Leave this run and return to the home screen?")) renderStart(); }
  });

  renderStart();
})();
