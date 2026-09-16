"""把用户整理的 Oracle's Elixir 格式补充数据（数据补充.xlsx）转成受控修正文件。

输出: data/fixes/g1_2017_official.json（由 load.py 的 apply_data_fixes 消费）
用法: .venv/bin/python scripts/import_g1.py
"""

import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "数据补充.xlsx"
OUT = ROOT / "data" / "fixes" / "g1_2017_official.json"

# OE gameid → 本库 game_id_src（指向 wiki 现存行：其 GameId 序号整体 +1 错位，
# 行 _2 实为 G1、行 _3 实为 G2，故 OE 的 game 1 挂到 _2 行上）
# side 映射：OE Blue/Red → 源行列示边（源行 T1/T2 与 leaguepedia 原行一致）
GAME_MAP = {
    "2724-2815": {
        "game_id_src": "LPL/2017 Season/Summer Playoffs_Round 1_1_2",   # 真实 G1: IG 胜
        "side_of": {"Blue": 1, "Red": 2},   # 源行 T1=Suning(Blue), T2=IG(Red)
    },
    "2729-2817": {
        "game_id_src": "LPL/2017 Season/Summer Playoffs_Round 1_2_2",   # 真实 G1: Newbee 胜
        "side_of": {"Blue": 1, "Red": 2},   # 源行 T1=Newbee(Blue), T2=Snake(Red)
    },
}


def main() -> int:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb.active

    games: dict[str, dict] = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[0] in (None, ""):
            continue
        gameid = str(row[0])
        meta = GAME_MAP.get(gameid)
        if not meta:
            continue
        g = games.setdefault(gameid, {
            "game_id_src": meta["game_id_src"],
            "game_length_min": None,
            "game_length_text": None,
            "datetime_utc": None,
            "patch": None,
            "sides": {},
            "kills_by_side": {},
            "players": [],
            "_team_rows": {},
        })

        seconds = row[29]
        if seconds:
            g["game_length_min"] = round(float(seconds) / 60, 2)
            g["game_length_text"] = f"{int(seconds) // 60}:{int(seconds) % 60:02d}"
        g["datetime_utc"] = str(row[7])
        g["patch"] = str(row[9])

        participantid = int(row[10])
        side_text = str(row[11])
        side_no = meta["side_of"][side_text]
        teamname = str(row[15])

        if participantid >= 100:  # 队伍行：ban 列表 + 击杀
            g["_team_rows"][side_no] = {
                "team": teamname,
                "bans": [str(v) for v in row[19:24] if v not in (None, "")],
                "kills": int(row[31] or 0),
            }
        else:  # 选手行
            g["players"].append({
                "player": str(row[13]),
                "team": teamname,
                "side": side_no,
                "role": str(row[12]).lower(),
                "champion": str(row[18]) if row[18] else None,
                "kills": int(row[31] or 0),
                "deaths": int(row[32] or 0),
                "assists": int(row[33] or 0),
                "gold": int(row[79] or 0),
                "cs": int(row[99] or 0),
            })

    result = []
    for gameid, meta in GAME_MAP.items():
        g = games[gameid]
        for side_no, tr in g["_team_rows"].items():
            picks = []
            for p in g["players"]:
                if p["side"] == side_no and p["champion"] \
                        and p["champion"] not in picks:
                    picks.append(p["champion"])
            g["sides"][str(side_no)] = {
                "team": tr["team"],
                "bans": tr["bans"],
                "picks": picks,
            }
            g["kills_by_side"][str(side_no)] = tr["kills"]
        g["reason"] = (
            "数据来源: Oracle's Elixir 2017 LPL match data（用户整理的数据补充.xlsx）；"
            "ban 有顺序，pick 顺序源数据未收录（slot=NULL）"
        )
        result.append({k: v for k, v in g.items() if not k.startswith("_")})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"说明": "2017 季后赛两场缺局的整局补全（game_imports）", "game_imports": result},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"生成 {OUT}，共 {len(result)} 局")
    return 0


if __name__ == "__main__":
    sys.exit(main())