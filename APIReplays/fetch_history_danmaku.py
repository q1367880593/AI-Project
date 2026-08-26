# -*- coding: utf-8 -*-
"""抓取 B 站历史弹幕（按日期归档），与现有即时弹幕合并去重后导出完整 CSV / JSON"""
import csv
import json
import time
from datetime import datetime

import requests
from google.protobuf import descriptor_pb2, descriptor_pool, message_factory

OID = 1233709097     # cid（原版）
PID = 231997779      # aid（原版）
EP_ID = "ep767230"

with open("cookies.json", encoding="utf-8") as _f:
    COOKIES = json.load(_f)

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"),
    "Referer": f"https://www.bilibili.com/bangumi/play/{EP_ID}",
}

MODE_TEXT = {1: "滚动", 4: "底部", 5: "顶部", 6: "逆向", 7: "高级", 8: "代码", 9: "BAS弹幕"}


def build_reply_cls():
    pool = descriptor_pool.DescriptorPool()
    fdp = descriptor_pb2.FileDescriptorProto()
    fdp.name = "dm.proto"
    fdp.package = "dm"
    fdp.syntax = "proto3"

    elem = fdp.message_type.add()
    elem.name = "DanmakuElem"
    defs = [
        (1, "id", 3, 1), (2, "progress", 5, 1), (3, "mode", 5, 1),
        (4, "fontsize", 5, 1), (5, "color", 13, 1), (6, "midHash", 9, 1),
        (7, "content", 9, 1), (8, "ctime", 3, 1), (9, "weight", 5, 1),
        (10, "action", 9, 1), (11, "pool", 5, 1), (12, "idStr", 9, 1),
        (13, "attr", 5, 1),
    ]
    for num, name, typ, label in defs:
        f = elem.field.add()
        f.number, f.name, f.type, f.label, f.json_name = num, name, typ, label, name

    reply = fdp.message_type.add()
    reply.name = "DmSegMobileReply"
    f = reply.field.add()
    f.number, f.name, f.label, f.type, f.type_name, f.json_name = 1, "elems", 3, 11, ".dm.DanmakuElem", "elems"

    pool.Add(fdp)
    factory = message_factory.MessageFactory(pool)
    return factory.GetPrototype(pool.FindMessageTypeByName("dm.DmSegMobileReply"))


def to_item(e):
    return {
        "id": e.idStr or str(e.id),
        "progress": e.progress,
        "time_sec": round(e.progress / 1000, 3),
        "mode": e.mode,
        "mode_text": MODE_TEXT.get(e.mode, str(e.mode)),
        "fontsize": e.fontsize,
        "color": e.color,
        "mid_hash": e.midHash,
        "content": e.content,
        "ctime": e.ctime,
        "send_time": datetime.fromtimestamp(e.ctime).strftime("%Y-%m-%d %H:%M:%S") if e.ctime else "",
    }


def fetch_history_seg(date, seg_index, ReplyCls):
    url = "https://api.bilibili.com/x/v2/dm/web/history/seg.so"
    params = {"type": 1, "oid": OID, "date": date, "segment_index": seg_index}
    items = []
    for _ in range(4):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, cookies=COOKIES, timeout=15)
        except requests.RequestException:
            time.sleep(1.5)
            continue
        if resp.status_code != 200 or not resp.content:
            time.sleep(1.5)
            continue
        if resp.content[:1] == b"{":
            time.sleep(15)
            continue
        reply = ReplyCls()
        try:
            reply.ParseFromString(resp.content)
            break
        except Exception:
            time.sleep(1.5)
            continue
    else:
        return -1, []
    for e in reply.elems:
        items.append(to_item(e))
    return resp.status_code, items


def months_range():
    out = []
    y, m = 2023, 6
    while (y, m) <= (2026, 8):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def collect_dates():
    dates = []
    for month in months_range():
        url = "https://api.bilibili.com/x/v2/dm/history/index"
        params = {"type": 1, "oid": OID, "month": month}
        try:
            resp = requests.get(url, params=params, headers=HEADERS, cookies=COOKIES, timeout=15)
            data = resp.json()
        except Exception:
            continue
        if data.get("code") == 0 and isinstance(data.get("data"), list):
            dates.extend(data["data"])
        elif data.get("code") != 0:
            pass
    return sorted(set(dates))


def main():
    ReplyCls = build_reply_cls()

    # 载入已抓取的即时弹幕作为基底
    with open("弹幕_纵横宇宙.json", encoding="utf-8") as f:
        base = json.load(f)
    print(f"基底即时弹幕 {len(base)} 条")

    dates = collect_dates()
    print(f"历史弹幕日期共 {len(dates)} 天")

    hist = []
    total_dates = len(dates)
    for di, date in enumerate(dates, 1):
        day_count = 0
        seg = 1
        empty_streak = 0
        while seg <= 30:
            code, items = fetch_history_seg(date, seg, ReplyCls)
            if code == 200 and items:
                hist.extend(items)
                day_count += len(items)
                empty_streak = 0
            else:
                empty_streak += 1
                if empty_streak >= 3:
                    break
            seg += 1
            time.sleep(0.15)
        print(f"[{di}/{total_dates}] {date} 本日 {day_count} 条", flush=True)

    merged = base + hist
    seen, unique = set(), []
    for d in merged:
        if d["id"] not in seen:
            seen.add(d["id"])
            unique.append(d)
    print(f"\n合并去重后共 {len(unique)} 条（即时 {len(base)} + 历史 {len(hist)}）")

    write_result(unique)


def write_result(items):
    fields = ["id", "time_sec", "mode", "mode_text", "fontsize", "color", "send_time", "content"]
    csv_path = "弹幕_纵横宇宙.csv"
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for it in sorted(items, key=lambda x: x["time_sec"]):
            w.writerow({k: it.get(k, "") for k in fields})

    json_path = "弹幕_纵横宇宙.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=1)

    print(f"已导出：{csv_path} / {json_path}")


if __name__ == "__main__":
    main()