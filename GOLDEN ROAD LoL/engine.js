/* =============================================================================
   GOLDEN ROAD LoL — Engine (pure logic, no DOM)
   Shared by the browser game (game.js) and the Node test harness (test.js).
   ============================================================================= */
(function (global) {
  "use strict";

  const ROLES = ["TOP", "JNG", "MID", "ADC", "SUP"];
  const ROLE_NAMES = { TOP: "Top", JNG: "Jungle", MID: "Mid", ADC: "ADC", SUP: "Support" };
  const REGIONS = ["LCS", "LEC", "LCK", "LPL", "LMS", "PCS", "VCS", "CBLOL", "LJL", "TCL", "LLA", "LCL"];
  const REGION_NAMES = {
    LCS: "LCS · North America",
    LEC: "LEC · Europe",
    LCK: "LCK · Korea",
    LPL: "LPL · China",
    LMS: "LMS · Taiwan",
    PCS: "PCS · Pacific",
    VCS: "VCS · Vietnam",
    CBLOL: "CBLOL · Brazil",
    LCP: "LCP · Asia-Pacific",
    LJL: "LJL · Japan",
    TCL: "TCL · Türkiye",
    LLA: "LLA · Latin America",
    LCL: "LCL · CIS"
  };

  /* A player's identity for the "use once per run" rule. Same human spelled the
     same way always produces the same id. */
  function slugify(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  /* ----- Index --------------------------------------------------------------
     Flattens the team/year/role dataset into season records plus fast lookups. */
  function buildIndex(teams) {
    const seasons = [];
    const comboAll = {};              // "teamId|year" -> [seasonIdx] (every role on that roster)
    const allCombos = [];             // unique { region, teamId, year }
    const teamsById = {};
    const teamsByRegion = {};

    teams.forEach(function (team) {
      const years = Object.keys(team.rosters).map(Number).sort(function (a, b) { return a - b; });
      const tinfo = { id: team.id, name: team.name, region: team.region, years: years };
      teamsById[team.id] = tinfo;
      (teamsByRegion[team.region] = teamsByRegion[team.region] || []).push(tinfo);

      years.forEach(function (year) {
        const akey = team.id + "|" + year;
        allCombos.push({ region: team.region, teamId: team.id, year: year });
        const roster = team.rosters[year];
        // Push seasons in ROLES order so a roster always lists Top→Support.
        ROLES.forEach(function (role) {
          const entries = roster[role] || [];
          entries.forEach(function (entry) {
            const idx = seasons.length;
            seasons.push({
              playerId: slugify(entry[0]),
              name: entry[0],
              teamId: team.id,
              teamName: team.name,
              region: team.region,
              year: year,
              role: role,
              rating: entry[1]
            });
            (comboAll[akey] = comboAll[akey] || []).push(idx);
          });
        });
      });
    });

    return { seasons: seasons, comboAll: comboAll, allCombos: allCombos, teamsById: teamsById, teamsByRegion: teamsByRegion };
  }

  /* ----- Spin / reroll pool --------------------------------------------------
     A combo is usable for a role if it still contains an un-used player. Every
     spin/reroll is constrained to a usable combo, so the draft never dead-ends. */
  /* A roll is usable while drafting if it still contains at least one player
     whose role is OPEN (not yet filled) and who has not already been drafted. */
  function comboHasAvailable(index, c, openRoles, used) {
    const list = index.comboAll[c.teamId + "|" + c.year];
    for (let i = 0; i < list.length; i++) {
      const s = index.seasons[list[i]];
      if (openRoles.has(s.role) && !used.has(s.playerId)) return true;
    }
    return false;
  }

  function usableCombos(index, openRoles, used) {
    return index.allCombos.filter(function (c) {
      return comboHasAvailable(index, c, openRoles, used);
    });
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function spinInitial(index, openRoles, used) {
    const pool = usableCombos(index, openRoles, used);
    return pool.length ? pick(pool) : null;
  }

  /* Reroll option pools — each reroll changes exactly ONE wheel:
       Region -> a different region (keeps the year when another region has it).
       Team   -> same region AND same year, a different team.
       Year   -> same region AND team, a different year.
     If a pool is empty, that reroll is unavailable (the button is disabled). */
  function regionOptions(index, openRoles, used, cur) {
    const all = usableCombos(index, openRoles, used);
    const other = all.filter(function (c) { return c.region !== cur.region; });
    if (!other.length) return [];
    const sameYear = other.filter(function (c) { return c.year === cur.year; });
    return sameYear.length ? sameYear : other;
  }
  function teamOptions(index, openRoles, used, cur) {
    return usableCombos(index, openRoles, used).filter(function (c) {
      return c.region === cur.region && c.year === cur.year && c.teamId !== cur.teamId;
    });
  }
  function yearOptions(index, openRoles, used, cur) {
    return usableCombos(index, openRoles, used).filter(function (c) {
      return c.region === cur.region && c.teamId === cur.teamId && c.year !== cur.year;
    });
  }
  function rerollRegion(index, openRoles, used, cur) { const o = regionOptions(index, openRoles, used, cur); return o.length ? pick(o) : null; }
  function rerollTeam(index, openRoles, used, cur) { const o = teamOptions(index, openRoles, used, cur); return o.length ? pick(o) : null; }
  function rerollYear(index, openRoles, used, cur) { const o = yearOptions(index, openRoles, used, cur); return o.length ? pick(o) : null; }

  /* Whether a given reroll kind has any valid target for the current roll. */
  function canReroll(index, kind, openRoles, used, cur) {
    if (!cur) return false;
    if (kind === "region") return regionOptions(index, openRoles, used, cur).length > 0;
    if (kind === "team") return teamOptions(index, openRoles, used, cur).length > 0;
    if (kind === "year") return yearOptions(index, openRoles, used, cur).length > 0;
    return false;
  }

  /* The FULL roster for the rolled Region+Team+Year — every position. The
     player chooses which one to draft; game.js decides selectability from the
     open roles + used set. */
  function candidates(index, c, used) {
    const list = index.comboAll[c.teamId + "|" + c.year] || [];
    return list.map(function (i) {
      const s = index.seasons[i];
      return {
        playerId: s.playerId, name: s.name, teamName: s.teamName,
        region: s.region, year: s.year, role: s.role, rating: s.rating,
        used: used.has(s.playerId)
      };
    });
  }

  /* ----- Simulation ---------------------------------------------------------
     Outcome model: the team's performance for a stage is its Team Rating plus a
     little noise; opponents are sampled from a field distribution. Placement =
     1 + (number of opponents who outperform the team). Worlds has the toughest
     field and the most slots, so winning splits never guarantees a Worlds title. */
  function gauss(mean, sd) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const STAGE_CFG = {
    split:        { size: 8,  fieldMean: 78, fieldSd: 5.5, noise: 3.0 },
    international: { size: 8,  fieldMean: 84, fieldSd: 4.3, noise: 3.0 },
    worlds:       { size: 16, fieldMean: 86, fieldSd: 4.4, noise: 4.5 }
  };

  function placeIn(teamRating, cfg) {
    const my = teamRating + gauss(0, cfg.noise);
    let place = 1;
    for (let i = 0; i < cfg.size - 1; i++) {
      if (gauss(cfg.fieldMean, cfg.fieldSd) > my) place++;
    }
    return place;
  }

  function simulateRun(teamRating) {
    const s1 = placeIn(teamRating, STAGE_CFG.split);
    const fsQual = s1 <= 2;
    const fs = fsQual ? placeIn(teamRating, STAGE_CFG.international) : null;

    const s2 = placeIn(teamRating, STAGE_CFG.split);
    const msiQual = s2 <= 2;
    const msi = msiQual ? placeIn(teamRating, STAGE_CFG.international) : null;

    const s3 = placeIn(teamRating, STAGE_CFG.split);
    const worldsQual = s3 <= 4;
    const worlds = worldsQual ? placeIn(teamRating, STAGE_CFG.worlds) : null;

    const golden = s1 === 1 && fs === 1 && s2 === 1 && msi === 1 && s3 === 1 && worlds === 1;

    return {
      stages: [
        { key: "split1",     label: "Split 1",     place: s1,     size: 8,  qualNext: "First Stand", qualified: true,        advanced: fsQual,     gate: "Top 2 → First Stand" },
        { key: "firststand", label: "First Stand", place: fs,     size: 8,  international: true,      qualified: fsQual },
        { key: "split2",     label: "Split 2",     place: s2,     size: 8,  qualNext: "MSI",         qualified: true,        advanced: msiQual,    gate: "Top 2 → MSI" },
        { key: "msi",        label: "MSI",         place: msi,    size: 8,  international: true,      qualified: msiQual },
        { key: "split3",     label: "Split 3",     place: s3,     size: 8,  qualNext: "Worlds",      qualified: true,        advanced: worldsQual, gate: "Top 4 → Worlds" },
        { key: "worlds",     label: "Worlds",      place: worlds, size: 16, international: true,      qualified: worldsQual }
      ],
      golden: golden,
      worldsPlace: worlds
    };
  }

  function teamRating(ratings) {
    const sum = ratings.reduce(function (a, b) { return a + b; }, 0);
    return Math.round(sum / ratings.length);
  }

  /* ----- MSI 2026 simulation (temporary event mode) -------------------------
     The real MSI run, in three phases of best-of-5 series:
       1. Play-In     — the easiest field; a single life, win to reach the main
                        stage (lose and you're out).
       2. Main Stage  — DOUBLE ELIMINATION. Win the Upper Bracket and you advance
                        straight to the Grand Final. Lose it and you drop to the
                        Lower Bracket for a second chance — win there to still
                        reach the Final, lose and you're eliminated.
       3. Grand Final — the toughest opponent of all; win it to be MSI Champion.
     A win probability comes from the rating gap: one game is logistic in
     (myRating - oppRating), and the Bo5 series chance is P(win 3 before they do).
     Each stage carries an `outcome`: win | loss | drop | bye | skip. */
  /* Difficulty ramps hard into the Grand Final: the Play-In is a soft gate, the
     Main Stage lets most strong (88+) rosters through, and the Final is the wall
     where the title is actually decided. */
  const MSI_ROUNDS = [
    { key: "playin", label: "Play-In",       oppMean: 79, oppSd: 3.5 },
    { key: "upper",  label: "Upper Bracket", oppMean: 86, oppSd: 3.2 },
    { key: "lower",  label: "Lower Bracket", oppMean: 88, oppSd: 3.0 },
    { key: "final",  label: "Grand Final",   oppMean: 92, oppSd: 3.0 }
  ];

  /* Lower divisor => a steeper curve, so each rating point matters more (a
     stronger team wins noticeably more often, a weaker one noticeably less). */
  function gameWinProb(myRating, oppRating) {
    return 1 / (1 + Math.pow(10, (oppRating - myRating) / 9.5));
  }
  /* P(win a Bo5) given a per-game win probability p: p^3 (1 + 3q + 6q^2). */
  function bo5WinProb(p) {
    const q = 1 - p;
    return p * p * p * (1 + 3 * q + 6 * q * q);
  }

  function simulateMSI(rating) {
    const cfg = {};
    MSI_ROUNDS.forEach(function (rd) { cfg[rd.key] = rd; });
    const stages = [];
    function record(key, outcome) {
      const rd = cfg[key];
      stages.push({ key: key, label: rd.label, finale: key === "final", outcome: outcome });
    }
    function winSeries(rd) {
      return Math.random() < bo5WinProb(gameWinProb(rating + gauss(0, 1.2), gauss(rd.oppMean, rd.oppSd)));
    }

    // 1. Play-In (single life, easiest)
    if (!winSeries(cfg.playin)) {
      record("playin", "loss"); record("upper", "skip"); record("lower", "skip"); record("final", "skip");
      return { stages: stages, champion: false, viaLower: false };
    }
    record("playin", "win");

    // 2. Main Stage — double elimination
    let reachedFinal = false, viaLower = false;
    if (winSeries(cfg.upper)) {
      record("upper", "win");
      record("lower", "bye");        // won the upper bracket -> skip the lower bracket
      reachedFinal = true;
    } else {
      record("upper", "drop");       // lost the upper bracket -> down, but not out
      if (winSeries(cfg.lower)) {
        record("lower", "win");
        reachedFinal = true; viaLower = true;
      } else {
        record("lower", "loss");     // eliminated in the lower bracket
      }
    }

    // 3. Grand Final
    if (!reachedFinal) {
      record("final", "skip");
      return { stages: stages, champion: false, viaLower: viaLower };
    }
    if (winSeries(cfg.final)) {
      record("final", "win");
      return { stages: stages, champion: true, viaLower: viaLower };
    }
    record("final", "loss");
    return { stages: stages, champion: false, viaLower: viaLower };
  }

  const API = {
    ROLES: ROLES, ROLE_NAMES: ROLE_NAMES, REGIONS: REGIONS, REGION_NAMES: REGION_NAMES,
    slugify: slugify, buildIndex: buildIndex,
    usableCombos: usableCombos, spinInitial: spinInitial,
    rerollRegion: rerollRegion, rerollTeam: rerollTeam, rerollYear: rerollYear, canReroll: canReroll,
    candidates: candidates, simulateRun: simulateRun, placeIn: placeIn,
    teamRating: teamRating, STAGE_CFG: STAGE_CFG,
    simulateMSI: simulateMSI, MSI_ROUNDS: MSI_ROUNDS, gameWinProb: gameWinProb, bo5WinProb: bo5WinProb
  };

  if (typeof window !== "undefined") { window.GREngine = API; }
  if (typeof module !== "undefined") { module.exports = API; }

})(typeof window !== "undefined" ? window : this);
