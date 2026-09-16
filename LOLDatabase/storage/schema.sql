-- ============================================================
-- LOL 职业联赛数据库 — SQLite 建库脚本（v1）
-- 字段与 Leaguepedia Cargo 表的映射见各表注释；
-- Cargo 表结构探查快照位于 data/cargo_schema/*.schema.json（2026-09）
-- ============================================================

PRAGMA journal_mode = WAL;    -- 采集器写、查询层读可并发
PRAGMA foreign_keys = ON;

-- 管道元信息
CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- ============================ 基础实体 ============================

-- 联赛（Cargo: Leagues）
CREATE TABLE leagues (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,  -- League，如 "LPL" / "LCK"
    short_name  TEXT,                  -- League_Short
    region      TEXT,                  -- Region
    level       TEXT,                  -- Level：Primary 等
    is_official TEXT                   -- IsOfficial
);

-- 赛事/赛段（Cargo: Tournaments）
CREATE TABLE tournaments (
    id                 INTEGER PRIMARY KEY,
    overview_page      TEXT UNIQUE,    -- OverviewPage，如 "LPL/2026 Season/Split 1"
    name               TEXT NOT NULL,  -- Name
    standard_name      TEXT,           -- StandardName
    league_id          INTEGER NOT NULL REFERENCES leagues(id),
    date_start         TEXT,           -- 优先 DateStart，无则 DateStartFuzzy
    date_end           TEXT,           -- Date（页面上解析的结束日期，采集中推导）
    year               TEXT,           -- Year
    split_number       INTEGER,        -- SplitNumber
    split              TEXT,           -- Split："Split 1" 等
    is_playoffs        INTEGER,        -- IsPlayoffs
    is_qualifier       INTEGER,        -- IsQualifier
    is_official        INTEGER,        -- IsOfficial
    event_type         TEXT,           -- EventType
    tournament_level   TEXT,           -- TournamentLevel
    prizepool          TEXT,
    currency           TEXT,
    alternative_names  TEXT,           -- AlternativeNames（|分隔原文）
    tags               TEXT
);

-- 战队（Cargo: Teams）
CREATE TABLE teams (
    id            INTEGER PRIMARY KEY,
    overview_page TEXT UNIQUE,         -- OverviewPage
    name          TEXT NOT NULL,       -- Name
    short_name    TEXT,                -- Short：如 BLG
    region        TEXT,                -- Region
    location      TEXT,                -- TeamLocation/Location
    image         TEXT,                -- Image：wiki 文件名，本地缓存见 media_assets
    roster_photo  TEXT,                -- RosterPhoto
    renamed_to    TEXT,                -- RenamedTo：更名线索
    is_disbanded  INTEGER              -- IsDisbanded
);

-- 战队别名（Cargo: TeamRedirects + Teams.RenamedTo）
CREATE TABLE team_aliases (
    id      INTEGER PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id),
    alias   TEXT NOT NULL,
    source  TEXT NOT NULL DEFAULT 'TeamRedirects'
);
CREATE INDEX idx_team_aliases_alias ON team_aliases(alias);

-- 英雄（Cargo: Champions；中文名/图标后续由 communitydragon 补全）
CREATE TABLE champions (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,  -- Name：英文名，如 "Ahri"
    name_cn     TEXT,                  -- 补自 communitydragon zh_cn（采集中填充）
    title       TEXT,                  -- Title
    key_ddragon TEXT,                  -- KeyDdragon：如 "Ahri"
    key_integer INTEGER,               -- KeyInteger
    release_date TEXT,
    resource    TEXT,
    attributes  TEXT
);

-- 选手（Cargo: Players）—— id 为稳定主键，不随改名变化
CREATE TABLE players (
    id                 INTEGER PRIMARY KEY,
    overview_page      TEXT UNIQUE,    -- OverviewPage
    player_id          TEXT NOT NULL,  -- Cargo ID：现役主 ID
    name               TEXT,           -- Name：真名
    native_name        TEXT,           -- NativeName：母语姓名（中文名）
    name_full          TEXT,           -- NameFull
    country            TEXT,           -- Country
    primary_nationality TEXT,          -- NationalityPrimary
    birthdate          TEXT,
    age                INTEGER,
    residency          TEXT,           -- Residency
    role               TEXT,           -- Role：主位置
    team_last          TEXT,           -- TeamLast
    role_last          TEXT,           -- RoleLast
    is_retired         INTEGER,        -- IsRetired
    image              TEXT,           -- Image
    is_personality     INTEGER,        -- IsPersonality
    is_substitute      INTEGER,
    is_trainee         INTEGER,
    is_low_content     INTEGER         -- IsLowContent
);

-- 选手别名（曾用 ID 等；来源见 source 列）
CREATE TABLE player_aliases (
    id        INTEGER PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players(id),
    alias     TEXT NOT NULL,
    source    TEXT NOT NULL DEFAULT 'PlayerRedirects'
);
CREATE INDEX idx_player_aliases_alias ON player_aliases(alias);

-- 选手任期（Cargo: Tenures）
CREATE TABLE tenures (
    id            INTEGER PRIMARY KEY,
    player_id     INTEGER NOT NULL REFERENCES players(id),
    team_id       INTEGER NOT NULL REFERENCES teams(id),
    date_join     TEXT,                -- DateJoin
    date_leave    TEXT,                -- DateLeave
    duration_days INTEGER,             -- Duration
    next_team     TEXT,                -- NextTeam：原文，解析后关联 teams
    is_current    INTEGER,             -- IsCurrent
    UNIQUE(player_id, team_id, date_join)
);
CREATE INDEX idx_tenures_team ON tenures(team_id);

-- 赛事名次/参赛（Cargo: TournamentResults）
CREATE TABLE tournament_results (
    id            INTEGER PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
    team_id       INTEGER REFERENCES teams(id),
    place_number  INTEGER,             -- Place_Number
    place         TEXT,                -- Place：如 "1","3-4"
    phase         TEXT,                -- Phase
    qualified     INTEGER,             -- Qualified
    prize_usd     REAL,                -- Prize_USD
    overview_page TEXT,
    unique_line   TEXT
);

-- ============================ 比赛 ============================

-- 系列赛/场次（Cargo: MatchSchedule）
CREATE TABLE series (
    id                 INTEGER PRIMARY KEY,
    match_id_src       TEXT UNIQUE,    -- Cargo MatchId：首选幂等键
    unique_match       TEXT,           -- UniqueMatch
    tournament_id      INTEGER NOT NULL REFERENCES tournaments(id),
    overview_page      TEXT,
    tab                TEXT,           -- Tab
    phase              TEXT,           -- Phase
    round              TEXT,           -- Round
    shown_round        TEXT,           -- ShownRound
    best_of            INTEGER,        -- BestOf
    team1_id           INTEGER REFERENCES teams(id),
    team2_id           INTEGER REFERENCES teams(id),
    score1             INTEGER,        -- Team1Score：系列最终局分
    score2             INTEGER,        -- Team2Score
    winner_id          INTEGER REFERENCES teams(id),  -- 由 Cargo Winner 解析
    ff                 INTEGER,        -- FF
    is_nullified       INTEGER,        -- IsNullified
    is_tiebreaker      INTEGER,        -- IsTiebreaker
    start_time_utc     TEXT,           -- DateTime_UTC
    has_time           INTEGER,        -- HasTime
    patch              TEXT,           -- Patch
    patch_page         TEXT,           -- PatchPage
    venue              TEXT,           -- Venue
    mvp_player_id      INTEGER REFERENCES players(id),  -- 由 MVP 解析
    mvp_points         INTEGER,        -- MVPPoints
    disabled_champions TEXT,           -- DisabledChampions（|分隔原文）
    extra_json         TEXT            -- 未建模字段兜底（直播/解说/外部ID等原文）
);
CREATE INDEX idx_series_tournament ON series(tournament_id);
CREATE INDEX idx_series_teams ON series(team1_id, team2_id);

-- 小局（Cargo: ScoreboardGames）
-- 按源表列示布局忠实落库：Team1/Team2 即源行所写（各年代行列语义不一，
-- 不可假设为固定边或胜者列），胜负与比分关系见 win_team_side 与 game_results 视图
CREATE TABLE games (
    id                   INTEGER PRIMARY KEY,
    game_id_src          TEXT UNIQUE,  -- Cargo GameId：幂等键
    series_id            INTEGER REFERENCES series(id),
    match_id_src         TEXT,         -- 冗余 MatchId，系列对齐用
    tournament_id        INTEGER NOT NULL REFERENCES tournaments(id),
    overview_page        TEXT,
    game_no              INTEGER,      -- N_GameInMatch 或 Gamename 兜底（1..N）
    gamename             TEXT,         -- Gamename："Game 1" 等
    team1_id             INTEGER REFERENCES teams(id),  -- 源行列示 Team1
    team2_id             INTEGER REFERENCES teams(id),  -- 源行列示 Team2
    win_team_side        INTEGER,      -- 1=Team1 胜, 2=Team2 胜, NULL=源未提供
    score1_after         INTEGER,      -- 源行 Team1Score（列示比分，胜者视角以 game_results 为准）
    score2_after         INTEGER,      -- 源行 Team2Score
    datetime_utc         TEXT,         -- DateTime_UTC
    game_length_min      REAL,         -- Gamelength_Number（分钟）
    game_length_text     TEXT,         -- Gamelength 原文
    patch                TEXT,         -- Patch
    legacy_patch         TEXT,         -- LegacyPatch
    match_history        TEXT,         -- MatchHistory：对局历史链接
    vod_url              TEXT,         -- 由 VOD wikitext 解析
    riot_platform_game_id TEXT,        -- RiotPlatformGameId
    completeness         INTEGER DEFAULT 1,  -- 0=缺 BP/明细的早期对局
    extra_json           TEXT
);
CREATE INDEX idx_games_tournament ON games(tournament_id);
CREATE INDEX idx_games_series ON games(series_id);

-- 小局队伍统计（Cargo: ScoreboardGames 的团队统计字段）
CREATE TABLE game_team_stats (
    id            INTEGER PRIMARY KEY,
    game_id       INTEGER NOT NULL REFERENCES games(id),
    team_id       INTEGER NOT NULL REFERENCES teams(id),
    side          INTEGER NOT NULL,    -- 与源行列示一致：1=Team1, 2=Team2
    kills         INTEGER,             -- TeamXKills
    gold          REAL,                -- TeamXGold
    towers        INTEGER,             -- TeamXTowers
    inhibitors    INTEGER,             -- TeamXInhibitors
    barons        INTEGER,             -- TeamXBarons
    rift_heralds  INTEGER,             -- TeamXRiftHeralds
    void_grubs    INTEGER,             -- TeamXVoidGrubs
    atakhans      INTEGER,             -- TeamXAtakhans
    dragons_total INTEGER,             -- TeamXDragons
    clouds        INTEGER, infernals INTEGER, mountains INTEGER,
    oceans        INTEGER, hextechs INTEGER, chemtechs INTEGER, elders INTEGER,
    UNIQUE(game_id, side)
);

-- 胜者视角视图：每小局的胜方/负方/胜者比分（便于查询）
CREATE VIEW game_results AS
SELECT
    g.id, g.game_id_src, g.series_id, g.match_id_src, g.tournament_id,
    g.overview_page, g.game_no, g.gamename,
    CASE g.win_team_side WHEN 1 THEN g.team1_id WHEN 2 THEN g.team2_id END AS winner_id,
    CASE g.win_team_side WHEN 1 THEN g.team2_id WHEN 2 THEN g.team1_id END AS loser_id,
    CASE g.win_team_side WHEN 1 THEN g.score1_after WHEN 2 THEN g.score2_after END AS winner_score,
    CASE g.win_team_side WHEN 1 THEN g.score2_after WHEN 2 THEN g.score1_after END AS loser_score,
    g.win_team_side, g.datetime_utc, g.game_length_min, g.patch, g.completeness
FROM games g;

-- BP（Cargo: ScoreboardGames 的 TeamXBans / TeamXPicks，按出现顺序记 slot；
-- 个别补录数据无顺序信息时 slot 为 NULL）
CREATE TABLE picks_bans (
    id          INTEGER PRIMARY KEY,
    game_id     INTEGER NOT NULL REFERENCES games(id),
    team_id     INTEGER REFERENCES teams(id),
    side        INTEGER NOT NULL,      -- 1/2
    phase       TEXT NOT NULL,         -- 'ban' | 'pick'
    slot        INTEGER,               -- 列表内顺序，NULL=顺序未知
    champion_id INTEGER REFERENCES champions(id)
);
CREATE INDEX idx_pb_game ON picks_bans(game_id);

-- 小局选手统计（Cargo: ScoreboardPlayers）
CREATE TABLE game_player_stats (
    id                    INTEGER PRIMARY KEY,
    unique_line           TEXT UNIQUE, -- Cargo UniqueLine：幂等键
    game_id               INTEGER NOT NULL REFERENCES games(id),
    player_id             INTEGER REFERENCES players(id),
    link_used             TEXT NOT NULL,  -- Cargo Link：比赛当时所用 ID（改名不追溯覆盖）
    team_id               INTEGER REFERENCES teams(id),
    side                  INTEGER,     -- Cargo Side
    role                  TEXT,        -- Cargo Role：Top/Jungle/Mid/Bot/Support
    ingest_role           TEXT,        -- Cargo IngameRole
    role_number           INTEGER,     -- Role_Number
    champion_id           INTEGER REFERENCES champions(id),
    kills INTEGER, deaths INTEGER, assists INTEGER,
    gold INTEGER, cs INTEGER,
    damage_to_champions   INTEGER,
    vision_score          INTEGER,
    pentakills            INTEGER,
    player_win            INTEGER,     -- PlayerWin："Yes"/"No"
    team_kills            INTEGER,     -- TeamKills
    team_gold             INTEGER,     -- TeamGold
    summoner_spells       TEXT,        -- SummonerSpells（原文）
    items                 TEXT,        -- Items
    trinket               TEXT,        -- Trinket
    keystone_rune         TEXT,        -- KeystoneRune
    primary_tree          TEXT,        -- PrimaryTree
    secondary_tree        TEXT,        -- SecondaryTree
    stats_page            TEXT         -- StatsPage
);
CREATE INDEX idx_gps_game ON game_player_stats(game_id);
CREATE INDEX idx_gps_player ON game_player_stats(player_id);
CREATE INDEX idx_gps_link ON game_player_stats(link_used);

-- ============================ 媒体缓存 ============================

-- 英雄/战队/选手图片的本地缓存登记
CREATE TABLE media_assets (
    id          INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,         -- team | player | champion
    entity_id   INTEGER NOT NULL,
    kind        TEXT NOT NULL,         -- logo | photo | roster | icon | splash
    source      TEXT NOT NULL,         -- leaguepedia | communitydragon | lolesports
    source_url  TEXT,
    local_path  TEXT,                  -- 相对项目根的本地路径
    sha256      TEXT,
    fetched_at  TEXT,
    is_active   INTEGER DEFAULT 1
);
CREATE INDEX idx_media_entity ON media_assets(entity_type, entity_id);

-- ============================ 溯源 ============================

-- 本库记录与源数据行的对应关系（幂等 upsert 依据）
CREATE TABLE source_refs (
    id          INTEGER PRIMARY KEY,
    record_type TEXT NOT NULL,         -- 业务表名，如 "games"
    record_id   INTEGER NOT NULL,      -- 本库主键
    source      TEXT NOT NULL,         -- 如 "Leaguepedia_Cargo"
    source_key  TEXT,                  -- 源内唯一键（OverviewPage/GameId/UniqueLine/MatchId）
    fetched_at  TEXT,
    raw_json    TEXT,                  -- 原始行 JSON
    UNIQUE(record_type, source, source_key)
);

-- ============================ 源数据修正 ============================

-- 人工/受控修正登记：对源数据瑕疵的既定修正（更新与补行），入库后由加载器应用。
-- data/fixes/manual.json 是修正内容的唯一来源（可审计、可回滚）。
CREATE TABLE data_fixes (
    id          INTEGER PRIMARY KEY,
    target_type TEXT NOT NULL,         -- game(目前仅 games 支持)
    target_key  TEXT NOT NULL,         -- games.game_id_src（INSERT 时为新增源键）
    action      TEXT NOT NULL,         -- update | insert
    field       TEXT,                  -- update 时的目标列
    fixed_value TEXT,                  -- update 时的修正值（JSON 标量文本）
    reason      TEXT,
    applied_at  TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_data_fixes_key
    ON data_fixes(target_key, action, COALESCE(field, ''));

INSERT INTO meta(key, value) VALUES ('schema_version', '1');