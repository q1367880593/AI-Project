from __future__ import annotations

import argparse
import shutil
import sys
from datetime import date
from pathlib import Path

from .config import ConfigError, ensure_config, load_config
from .pipeline import Pipeline


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("日期必须是 YYYY-MM-DD") from error


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="新闻抓取与中文 Markdown 日报工具")
    parser.add_argument("--config", default="config/config.toml", help="TOML 配置文件")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init", help="从示例创建配置")
    init_parser.add_argument("--force", action="store_true", help="覆盖已有配置")

    run_parser = subparsers.add_parser("run", help="执行搜索、抓取、分析和报告")
    run_parser.add_argument("--target", help="target slug 或名称")
    run_parser.add_argument("--date", type=parse_date, default=date.today())
    run_parser.add_argument("--skip-search", action="store_true", help="仅处理数据库现有新闻")

    report_parser = subparsers.add_parser("report", help="根据数据库重新生成报告")
    report_parser.add_argument("--target", help="target slug 或名称")
    report_parser.add_argument("--date", type=parse_date, default=date.today())

    subparsers.add_parser("doctor", help="检查配置、数据库和模型")
    subparsers.add_parser("stats", help="显示数据库统计")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    config_path = Path(args.config)
    try:
        if args.command == "init":
            if config_path.exists() and not args.force:
                print(f"配置已存在：{config_path}")
                return 0
            if args.force and config_path.exists():
                shutil.copyfile("config/config.example.toml", config_path)
            else:
                ensure_config(config_path)
            print(f"配置已创建：{config_path}")
            return 0

        config = load_config(config_path)
        pipeline = Pipeline(config)
        if args.command == "run":
            results = pipeline.run(args.date, args.target, skip_search=args.skip_search)
            for result in results:
                print(
                    f"[{result.target}] 新增 {result.discovered}，抓取 {result.crawled}，"
                    f"事件 {result.events}，错误 {result.errors}，报告：{result.report_path}"
                )
            return 0
        if args.command == "report":
            for target in pipeline.select_targets(args.target):
                target_id = pipeline.database.upsert_target(target)
                events = pipeline.database.events_for_report(target_id, args.date)
                content = pipeline.reporter.render(target, args.date, events, [])
                print(pipeline.reporter.write(target, args.date, content))
            return 0
        if args.command == "stats":
            for key, value in pipeline.database.stats().items():
                print(f"{key}: {value}")
            return 0
        if args.command == "doctor":
            print(f"配置：正常（{config.path}）")
            print(f"数据库：正常（{config.database_path}）")
            print(f"监控对象：{len(config.targets)} 个")
            if pipeline.analyzer.llm:
                status = "正常" if pipeline.analyzer.llm.healthcheck() else "不可用，将使用规则降级"
                print(f"Ollama：{status}")
            else:
                print("中文模型：未启用，将使用规则降级")
            return 0
    except (ConfigError, ValueError, OSError, RuntimeError) as error:
        print(f"错误：{error}", file=sys.stderr)
        return 2
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
