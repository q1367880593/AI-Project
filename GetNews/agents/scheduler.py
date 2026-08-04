"""Scheduler - 调度器，协调整个流程"""

import asyncio
import yaml
from datetime import date, datetime
from typing import Optional

from storage import Database, NewsArticle
from .search_agent import SearchAgent
from .crawl_agent import CrawlAgent
from .analysis_agent import AnalysisAgent
from .report_agent import ReportAgent
from .alert_agent import AlertAgent


class Scheduler:
    """主调度器"""

    def __init__(
        self,
        people_config: str = "config/people.yaml",
        source_config: str = "config/source.yaml",
    ):
        with open(people_config) as f:
            self.people_config = yaml.safe_load(f)
        self.db = Database()
        self.search_agent = SearchAgent(source_config)
        self.crawl_agent = CrawlAgent(source_config)
        self.analysis_agent = AnalysisAgent(self.db, config_path=source_config)
        self.report_agent = ReportAgent(self.db)
        self.alert_agent = AlertAgent(self.db)

    async def close(self):
        self.search_agent.close()
        await self.crawl_agent.close()

    async def run(self, person_name: Optional[str] = None, target_date: Optional[date] = None):
        """执行完整的日报流程"""
        target_date = target_date or date.today()
        print(f"\n{'='*60}")
        print(f"Scheduler 开始运行 - {target_date}")
        print(f"{'='*60}\n")

        people = self.people_config.get("people", [])
        if person_name:
            people = [p for p in people if p["name"] == person_name]
            if not people:
                print(f"未找到监控对象: {person_name}")
                return

        for person in people:
            name = person["name"]
            keywords = person.get("keywords", [name])

            print(f"\n--- 处理: {name} ---")

            # Phase 1: 搜索
            self._phase_search(name, keywords)

            # Phase 2: 抓取正文（可选）
            await self._phase_crawl(name)

            # Phase 3: 分析
            events = self._phase_analyze(name, target_date)

            # Phase 4: 生成报告
            self._phase_report(name, target_date)

            # Phase 5: 告警
            self._phase_alert(name, events)

            stats = self.db.get_stats(name)
            print(f"[{name}] 总新闻: {stats['total_news']}, 总事件: {stats['total_events']}")

        print(f"\n{'='*60}")
        print("Scheduler 运行完成")
        print(f"{'='*60}\n")

    def _phase_search(self, person_name: str, keywords: list[str]):
        """Phase 1: 搜索新闻"""
        print(f"[Phase 1] 搜索 {person_name}...")
        all_results = []

        for kw in keywords:
            results = self.search_agent.search(kw, person_name, max_results=10)
            if results:
                print(f"  关键词「{kw}」: 找到 {len(results)} 条")
            all_results.extend(results)

        # 入库，搜索结果的 summary 直接作为正文
        seen_urls = set()
        new_count = 0
        for result in all_results:
            if result.url in seen_urls:
                continue
            seen_urls.add(result.url)
            if not self.db.news_exists(result.url):
                article = NewsArticle(
                    url=result.url,
                    title=result.title,
                    summary=result.summary,
                    content=result.summary,
                    source=result.source,
                    published_at=result.published_at,
                    person_name=person_name,
                    keyword="",
                )
                self.db.insert_news(article)
                new_count += 1

        print(f"[Phase 1] 搜索到 {len(seen_urls)} 条去重结果，新增 {new_count} 条")

    async def _phase_crawl(self, person_name: str):
        """Phase 2: 抓取正文（补充没有正文的新闻）"""
        print(f"[Phase 2] 抓取 {person_name} 的新闻正文...")

        articles = self.db.get_news_for_analysis(person_name, limit=30)
        urls_to_crawl = [a.url for a in articles if not a.content]

        if not urls_to_crawl:
            print(f"[Phase 2] 没有需要抓取的 URL（已有 {len(articles)} 篇含正文）")
            return

        print(f"[Phase 2] 待抓取: {len(urls_to_crawl)} 个 URL")
        results = await self.crawl_agent.crawl_batch(urls_to_crawl, concurrency=5)

        crawled_count = 0
        for result in results:
            if result and result.markdown.strip():
                article = NewsArticle(
                    url=result.url,
                    title=result.title or "",
                    content=result.markdown,
                    source=result.source,
                )
                news_id = self.db.insert_news(article)
                self.db.update_news_content(news_id, result.markdown, "")
                crawled_count += 1

        # 对抓取失败的 URL，用 summary 作为正文回退
        for url in urls_to_crawl:
            article = self.db.get_news_by_url(url)
            if article and not article.content:
                self.db.update_news_content(article.id, article.summary, article.summary[:200])

        print(f"[Phase 2] 成功抓取 {crawled_count} 篇")

    def _phase_analyze(self, person_name: str, target_date: date) -> list:
        """Phase 3: 分析"""
        print(f"[Phase 3] 分析 {person_name} 的新闻...")
        events = self.analysis_agent.analyze(person_name, target_date)
        print(f"[Phase 3] 生成 {len(events)} 个事件")
        return events

    def _phase_report(self, person_name: str, target_date: date):
        """Phase 4: 生成报告"""
        print(f"[Phase 4] 生成 {person_name} 的日报...")
        self.report_agent.generate_daily_report(person_name, target_date)
        print(f"[Phase 4] 日报已生成")

    def _phase_alert(self, person_name: str, events: list):
        """Phase 5: 告警"""
        if events:
            self.alert_agent.check_and_alert(person_name, events)

    def run_search_only(self, person_name: Optional[str] = None):
        """仅运行搜索阶段"""
        people = self.people_config.get("people", [])
        if person_name:
            people = [p for p in people if p["name"] == person_name]
        for person in people:
            keywords = person.get("keywords", [person["name"]])
            self._phase_search(person["name"], keywords)

    async def run_crawl_only(self, person_name: Optional[str] = None):
        """仅运行抓取阶段"""
        people = self.people_config.get("people", [])
        if person_name:
            people = [p for p in people if p["name"] == person_name]
        for person in people:
            await self._phase_crawl(person["name"])

    def run_analyze_only(self, person_name: Optional[str] = None):
        """仅运行分析阶段"""
        people = self.people_config.get("people", [])
        if person_name:
            people = [p for p in people if p["name"] == person_name]
        for person in people:
            events = self._phase_analyze(person["name"], date.today())
            self._phase_alert(person["name"], events)

    def run_report_only(self, person_name: Optional[str] = None):
        """仅运行报告阶段"""
        people = self.people_config.get("people", [])
        if person_name:
            people = [p for p in people if p["name"] == person_name]
        for person in people:
            self._phase_report(person["name"], date.today())