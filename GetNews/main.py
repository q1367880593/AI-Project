"""Research Agent - 主入口"""

import asyncio
import argparse
from datetime import date

from agents.scheduler import Scheduler


async def main():
    parser = argparse.ArgumentParser(
        description="Local Research Agent - 本地新闻研究助手",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 main.py run                          # 运行完整流程（所有监控对象）
  python3 main.py run -p "Elon Musk"           # 仅处理指定人物
  python3 main.py search -p "Elon Musk"        # 仅搜索
  python3 main.py crawl                        # 仅抓取
  python3 main.py analyze -p "Elon Musk"       # 仅分析
  python3 main.py report -p "Elon Musk"        # 仅生成报告
  python3 main.py weekly -p "Elon Musk"        # 生成周报
  python3 main.py stats                        # 查看统计
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="子命令")

    run_parser = subparsers.add_parser("run", help="运行完整流程")
    run_parser.add_argument("-p", "--person", type=str, help="指定人物")

    search_parser = subparsers.add_parser("search", help="仅搜索")
    search_parser.add_argument("-p", "--person", type=str, help="指定人物")

    crawl_parser = subparsers.add_parser("crawl", help="仅抓取")
    crawl_parser.add_argument("-p", "--person", type=str, help="指定人物")

    analyze_parser = subparsers.add_parser("analyze", help="仅分析")
    analyze_parser.add_argument("-p", "--person", type=str, help="指定人物")

    report_parser = subparsers.add_parser("report", help="仅生成报告")
    report_parser.add_argument("-p", "--person", type=str, help="指定人物")

    weekly_parser = subparsers.add_parser("weekly", help="生成周报")
    weekly_parser.add_argument("-p", "--person", type=str, help="指定人物")

    subparsers.add_parser("stats", help="查看统计")

    args = parser.parse_args()
    scheduler = Scheduler()

    try:
        if args.command == "run":
            await scheduler.run(person_name=args.person)

        elif args.command == "search":
            scheduler.run_search_only(person_name=args.person)

        elif args.command == "crawl":
            await scheduler.run_crawl_only(person_name=args.person)

        elif args.command == "analyze":
            scheduler.run_analyze_only(person_name=args.person)

        elif args.command == "report":
            scheduler.run_report_only(person_name=args.person)

        elif args.command == "weekly":
            person_name = args.person
            if person_name:
                scheduler.report_agent.generate_weekly_report(person_name)
            else:
                for person in scheduler.people_config.get("people", []):
                    scheduler.report_agent.generate_weekly_report(person["name"])

        elif args.command == "stats":
            stats = scheduler.db.get_stats()
            print(f"\n总新闻数: {stats['total_news']}")
            print(f"总事件数: {stats['total_events']}")
            print()
            for person in scheduler.people_config.get("people", []):
                ps = scheduler.db.get_stats(person["name"])
                print(f"  {person['name']}: {ps['total_news']} 新闻, {ps['total_events']} 事件")
            print()

        else:
            parser.print_help()

    finally:
        await scheduler.close()


if __name__ == "__main__":
    asyncio.run(main())