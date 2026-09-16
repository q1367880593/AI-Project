"""全局配置：路径、网络（代理）、限速参数、登录凭据。"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
DB_PATH = ROOT / "data" / "lol.db"
SCHEMA_PATH = ROOT / "storage" / "schema.sql"
AUTH_FILE = ROOT / ".auth.json"  # 本地凭据（不入库），也支持环境变量

# ---- 网络 ----
PROXY = "http://127.0.0.1:1087"  # fandom 直连超时，必须走本机代理
USER_AGENT = "LOLDB/0.1 (personal research project; python-requests)"

CARGO_API = "https://lol.fandom.com/api.php"
CDN_CHAMPIONS_URL = (
    "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/"
    "global/zh_cn/v1/champion-summary.json"
)

# ---- 限速（慢速采集 + 断点续传）----
PAGE_SIZE = 500            # Cargo 单次查询硬上限
BASE_INTERVAL = 2.0        # 正常请求基础间隔（秒）
JITTER = 1.0               # 随机抖动上限
RATELIMIT_BACKOFF = 60.0   # 触发限流后的首次等待
RATELIMIT_MAX_WAIT = 600.0 # 指数退避上限
MAX_ATTEMPTS = 15          # 单个请求最大重试次数

# ---- 采集范围 ----
LPL_LEAGUE = "LPL"
LPL_YEAR = "2025"


def load_auth() -> tuple[str, str] | None:
    """读取机器人密码登录凭据：优先环境变量，其次本地 .auth.json。

    .auth.json 格式: {"username": "你的用户名@bot名", "password": "机器人密码"}
    """
    user = os.environ.get("LOLDB_BOT_USER")
    password = os.environ.get("LOLDB_BOT_PASS")
    if user and password:
        return user, password
    if AUTH_FILE.exists():
        data = json.loads(AUTH_FILE.read_text(encoding="utf-8"))
        user = data.get("username")
        password = data.get("password")
        if user and password:
            return user, password
    return None

# 英雄页名（规范化后）→ CDN alias（规范化后）的特殊映射
CHAMP_OVERRIDES = {
    "wukong": "monkeyking",
    "nunuwillump": "nunu",
    "renataglasc": "renata",
}