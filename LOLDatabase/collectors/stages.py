"""采集阶段编排：LPL 2025 赛段 → 赛程 → 小局 → 小局选手 → 选手档案。

数据流全部落盘 raw/lpl2025/**，支持任意时刻中断重跑（断点续传）。
"""

import json

from collectors import config
from collectors.cargo import CargoClient

client = CargoClient()

# ---- 各 Cargo 表的取数字段（按需精简，降低单页体积）----
TOURNAMENT_FIELDS = (
    "Name,OverviewPage,DateStart,Date,League,Region,Split,SplitNumber,"
    "IsPlayoffs,IsQualifier,IsOfficial,Year,TournamentLevel,EventType"
)
MATCH_FIELDS = (
    "Team1,Team2,Winner,Team1Score,Team2Score,FF,IsNullified,IsTiebreaker,"
    "DateTime_UTC,HasTime,OverviewPage,BestOf,Tab,Phase,Round,ShownRound,"
    "Patch,PatchPage,Venue,MVP,MVPPoints,DisabledChampions,UniqueMatch,MatchId,N_MatchInTab"
)
GAME_FIELDS = (
    "OverviewPage,Tournament,Team1,Team2,WinTeam,LossTeam,DateTime_UTC,"
    "Team1Score,Team2Score,Gamelength,Gamelength_Number,"
    "Team1Bans,Team2Bans,Team1Picks,Team2Picks,Team1Players,Team2Players,"
    "Team1Dragons,Team2Dragons,Team1Clouds,Team1Infernals,Team1Mountains,"
    "Team1Oceans,Team1Hextechs,Team1Chemtechs,Team1Elders,Team2Clouds,"
    "Team2Infernals,Team2Mountains,Team2Oceans,Team2Hextechs,Team2Chemtechs,"
    "Team2Elders,Team1Barons,Team2Barons,Team1Towers,Team2Towers,"
    "Team1Gold,Team2Gold,Team1Kills,Team2Kills,Team1RiftHeralds,Team2RiftHeralds,"
    "Team1VoidGrubs,Team2VoidGrubs,Team1Atakhans,Team2Atakhans,"
    "Team1Inhibitors,Team2Inhibitors,Patch,LegacyPatch,MatchHistory,VOD,"
    "N_GameInMatch,N_MatchInTab,Gamename,UniqueLine,GameId,MatchId,RiotPlatformGameId"
)
PLAYERGAME_FIELDS = (
    "OverviewPage,Name,Link,Champion,Kills,Deaths,Assists,Gold,CS,"
    "DamageToChampions,VisionScore,Items,Trinket,SummonerSpells,Pentakills,KeystoneRune,"
    "PrimaryTree,SecondaryTree,Team,TeamVs,DateTime_UTC,Tournament,Role,"
    "Role_Number,IngameRole,Side,UniqueLine,GameId,MatchId,PlayerWin,"
    "TeamKills,TeamGold"
)
PLAYER_FIELDS = (
    "OverviewPage,ID,Name,NativeName,NameFull,Country,NationalityPrimary,"
    "Birthdate,Residency,Role,TeamLast,RoleLast,IsRetired,Image,"
    "IsPersonality,IsSubstitute,IsTrainee,IsLowContent"
)
REDIRECT_FIELDS = "AllName,OverviewPage,ID"

# 批量 IN 查询的项数（控制 URL 长度与单查询耗时）
IN_BATCH = 80


def slug(page: str) -> str:
    """页面名 → 目录安全名。"""
    return page.replace("/", "_").replace(" ", "_")


def _esc(v: str) -> str:
    return v.replace("\\", "\\\\").replace("'", "\\'")


def stage_tournaments() -> list:
    """阶段 1：LPL 全部赛段（2013 至今）（Cargo: Tournaments）。

    注：Tournaments.League 字段存的是 'Tencent LoL Pro League' 而非 'LPL'，
    且存在 LPLOL（葡萄牙联赛）干扰，故用 OverviewPage 前缀过滤，
    恰好排除 'LPLOL/...' 行。
    """
    key = "lpl/tournaments/all"
    return client.fetch_all(
        key,
        {
            "action": "cargoquery",
            "tables": "Tournaments",
            "fields": TOURNAMENT_FIELDS,
            "where": "OverviewPage LIKE 'LPL/%'",
            "order_by": "DateStart",
        },
    )


def _stage_per_page(kind: str, page: str, fields: str):
    """按赛段页拉取 MatchSchedule / ScoreboardGames / ScoreboardPlayers。"""
    key = f"lpl/{kind}/{slug(page)}"
    return client.fetch_all(
        key,
        {
            "action": "cargoquery",
            "tables": {
                "matchschedule": "MatchSchedule",
                "scoreboardgames": "ScoreboardGames",
                "scoreboardplayers": "ScoreboardPlayers",
            }[kind],
            "fields": fields,
            "where": f"OverviewPage='{_esc(page)}'",
        },
    )


def stage_match_schedule(page: str):
    return _stage_per_page("matchschedule", page, MATCH_FIELDS)


def stage_scoreboard_games(page: str):
    return _stage_per_page("scoreboardgames", page, GAME_FIELDS)


def stage_scoreboard_players(page: str):
    return _stage_per_page("scoreboardplayers", page, PLAYERGAME_FIELDS)


def collect_links_from_raw() -> list:
    """从已拉取的小局选手数据中收集全部选手 Link（比赛当时所用 ID）。"""
    links = set()
    root = config.RAW_DIR / "lpl" / "scoreboardplayers"
    if not root.exists():
        return []
    for pf in sorted(root.rglob("page_*.json")):
        rows = json.loads(pf.read_text(encoding="utf-8"))
        for row in rows:
            if row.get("Link"):
                links.add(row["Link"])
    return sorted(links)


def stage_players(links: list):
    """阶段 5：选手档案。

    1) 用 PlayerRedirects 把 Link（可能是曾用名）解析到 OverviewPage；
    2) 按 OverviewPage 批量拉 Players 表。
    """
    if not links:
        print("  ! 没有选手 Link（请先跑小局选手阶段）", flush=True)
        return

    # 1) 重定向解析（分批 IN 查询）
    for i in range(0, len(links), IN_BATCH):
        chunk = links[i : i + IN_BATCH]
        key = f"lpl/players/redirects/batch_{i:04d}"
        client.fetch_all(
            key,
            {
                "action": "cargoquery",
                "tables": "PlayerRedirects",
                "fields": REDIRECT_FIELDS,
                "where": "AllName IN (" + ",".join(f"'{_esc(l)}'" for l in chunk) + ")",
            },
        )

    # 2) 汇总目标页面：有重定向的用其 OverviewPage，否则 Link 即为页面名
    redirects = {}
    root = config.RAW_DIR / "lpl" / "players" / "redirects"
    for pf in sorted(root.rglob("page_*.json")):
        for row in json.loads(pf.read_text(encoding="utf-8")):
            alias, page = row.get("AllName"), row.get("OverviewPage")
            if alias and page:
                redirects[alias] = page

    pages = sorted({redirects.get(l, l) for l in links})
    for i in range(0, len(pages), IN_BATCH):
        chunk = pages[i : i + IN_BATCH]
        key = f"lpl/players/players/batch_{i:04d}"
        client.fetch_all(
            key,
            {
                "action": "cargoquery",
                "tables": "Players",
                "fields": PLAYER_FIELDS,
                "where": "OverviewPage IN ("
                + ",".join(f"'{_esc(p)}'" for p in chunk)
                + ")",
            },
        )