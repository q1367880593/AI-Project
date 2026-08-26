#!/usr/bin/env bash
# XiaoHua 小说抓取与整理工具链：一键执行「抓取 → 去水印/重命名 → 合并」
# 用法：./run.sh [crawl|clean|merge|all]，默认 all

set -euo pipefail

# 切换到脚本所在目录，保证相对路径（config.json / xiaohua/ 等）正确
cd "$(dirname "$0")"

# 优先使用 venv 中的 python（jieba 等依赖安装于此），否则退回系统 python3
if [ -x ".venv/bin/python" ]; then
    PYTHON=".venv/bin/python"
else
    PYTHON="python3"
fi

# 关键：关闭 python 输出缓冲，保证 print 日志实时、完整输出
export PYTHONUNBUFFERED=1

step() {
    echo
    echo "=================================================="
    echo ">>> $1"
    echo "=================================================="
}

run_crawl() {
    step "1/3 抓取章节（xiaohua.py）"
    "$PYTHON" -u xiaohua.py
}

run_clean() {
    step "2/3 去水印与重命名（remove_watermark.py）"
    "$PYTHON" -u remove_watermark.py
}

run_merge() {
    step "3/3 合并章节（union.py）"
    "$PYTHON" -u union.py
}

case "${1:-all}" in
    crawl) run_crawl ;;
    clean) run_clean ;;
    merge) run_merge ;;
    all)
        run_crawl
        run_clean
        run_merge
        ;;
    *)
        echo "用法：$0 [crawl|clean|merge|all]"
        exit 1
        ;;
esac