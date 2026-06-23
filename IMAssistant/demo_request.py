from __future__ import annotations

import json
import urllib.request


payload = {
    "conversation_id": "c_001",
    "user_profile": {
        "budget_range": [5000, 6500],
        "target_area": "朝阳",
        "room_type_preference": "一居室",
    },
    "property_context": {
        "community": "望京花园",
        "district": "朝阳",
        "price": 5800,
        "layout": "一居室",
    },
    "recent_behaviors": [
        {"type": "im_start"},
        {"type": "view_vr"},
        {"type": "favorite"},
        {"type": "property_view", "duration_seconds": 45},
    ],
    "conversation_history": [
        {"sender": "user", "content": "这套还在吗？"},
        {"sender": "agent", "content": "这套目前还在，价格是5800，离地铁也比较近。"},
    ],
    "latest_message": {
        "sender": "user",
        "content": "周末能看吗？",
    },
}


request = urllib.request.Request(
    "http://10.1.7.128:8000/agent/analyze",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)

with urllib.request.urlopen(request) as response:
    print(json.dumps(json.loads(response.read().decode("utf-8")), ensure_ascii=False, indent=2))
