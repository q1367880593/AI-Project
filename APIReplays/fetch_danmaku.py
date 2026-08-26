# -*- coding: utf-8 -*-
"""抓取 B 站视频全量弹幕（分段 protobuf 接口）并导出 CSV / JSON"""
import csv
import json
import time
from datetime import datetime

import requests
from google.protobuf import descriptor_pb2, descriptor_pool, message_factory

OID = 1233709097     # cid（原版）
PID = 231997779      # aid（原版）
BVID = "ep767230"

# 从 cookies.json 读取登录 Cookie（含 SESSDATA），保证全量、稳定抓取
with open("cookies.json", encoding="utf-8") as _f:
    COOKIES = json.load(_f)

HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"),
    "Referer": "https://www.bilibili.com/bangumi/play/ep767230",
}

MODE_TEXT = {
    1: "滚动", 4: "底部", 5: "顶部", 6: "逆向",
    7: "高级", 8: "代码", 9: "BAS弹幕",
}


def build_messages():
    """动态构建 DmSegMobileReply / DanmakuElem 的 protobuf 描述，无需 protoc"""
    pool = descriptor_pool.DescriptorPool()
    fdp = descriptor_pb2.FileDescriptorProto()
    fdp.name = "dm.proto"
    fdp.package = "dm"
    fdp.syntax = "proto3"

    elem = fdp.message_type.add()
    elem.name = "DanmakuElem"
    # (number, name, type, label)  type: 3=int64 5=int32 9=string 13=uint32
    defs = [
        (1, "id", 3, 1),
        (2, "progress", 5, 1),
        (3, "mode", 5, 1),
        (4, "fontsize", 5, 1),
        (5, "color", 13, 1),
        (6, "midHash", 9, 1),
        (7, "content", 9, 1),
        (8, "ctime", 3, 1),
        (9, "weight", 5, 1),
        (10, "action", 9, 1),
        (11, "pool", 5, 1),
        (12, "idStr", 9, 1),
        (13, "attr", 5, 1),
    ]
    for num, name, typ, label in defs:
        f = elem.field.add()
        f.number = num
        f.name = name
        f.type = typ
        f.label = label
        f.json_name = name

    reply = fdp.message_type.add()
    reply.name = "DmSegMobileReply"
    f = reply.field.add()
    f.number = 1
    f.name = "elems"
    f.label = 3  # repeated
    f.type = 11  # message
    f.type_name = ".dm.DanmakuElem"
    f.json_name = "elems"

    pool.Add(fdp)
    factory = message_factory.MessageFactory(pool)
    ReplyCls = factory.GetPrototype(pool.FindMessageTypeByName("dm.DmSegMobileReply"))
    return ReplyCls


def fetch_segment(seg_index, ReplyCls):
    url = "https://api.bilibili.com/x/v2/dm/web/seg.so"
    params = {"type": 1, "oid": OID, "pid": PID, "segment_index": seg_index}
    items = []
    for _attempt in range(4):
        resp = requests.get(url, params=params, headers=HEADERS, cookies=COOKIES, timeout=15)
        if resp.status_code != 200 or not resp.content:
            time.sleep(1.5)
            continue
        # 风控/未登录等会返回 JSON（以 '{' 开头），而非 protobuf 二进制
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
        items.append({
            "id": e.idStr or str(e.id),
            "progress": e.progress,          # 毫秒
            "time_sec": round(e.progress / 1000, 3),
            "mode": e.mode,
            "mode_text": MODE_TEXT.get(e.mode, str(e.mode)),
            "fontsize": e.fontsize,
            "color": e.color,
            "mid_hash": e.midHash,
            "content": e.content,
            "ctime": e.ctime,
            "send_time": datetime.fromtimestamp(e.ctime).strftime("%Y-%m-%d %H:%M:%S") if e.ctime else "",
        })
    return resp.status_code, items


def main():
    ReplyCls = build_messages()
    all_danmu = []
    seg = 1
    empty_streak = 0
    while seg <= 200:
        code, items = fetch_segment(seg, ReplyCls)
        print(f"segment_index={seg:<3} HTTP={code} 本段条数={len(items)}", flush=True)
        if code == 200 and items:
            all_danmu.extend(items)
            empty_streak = 0
        else:
            empty_streak += 1
            if empty_streak >= 3:  # 连续3段为空即结束
                break
        seg += 1
        time.sleep(1.0)

    print(f"\n共抓取弹幕 {len(all_danmu)} 条")

    # 去重（按 id）
    seen, unique = set(), []
    for d in all_danmu:
        if d["id"] not in seen:
            seen.add(d["id"])
            unique.append(d)
    print(f"去重后 {len(unique)} 条")

    _write(unique)


def _write(items):
    fields = ["id", "time_sec", "mode", "mode_text", "fontsize", "color",
              "send_time", "content"]
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