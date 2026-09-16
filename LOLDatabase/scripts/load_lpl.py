"""raw JSON → SQLite 入库（幂等，可重复执行）。

用法:
    .venv/bin/python scripts/load_lpl.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from collectors import load
from collectors import config


def main() -> int:
    print("== 入库开始 ==", flush=True)
    counts = load.run()
    print("\n== 各阶段计数 ==")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    with load.init_db() as conn:
        print("\n== 数据库汇总 ==")
        print(load.summary(conn))
    print(f"\n数据库: {config.DB_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())