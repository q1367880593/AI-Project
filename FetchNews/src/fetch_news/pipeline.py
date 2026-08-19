from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from . import __version__
from .analysis import Analyzer
from .config import AppConfig
from .crawl import ArticleCrawler, CrawlError
from .domain import Target
from .llm import OllamaClient, OpenAIClient
from .report import MarkdownReporter
from .search import GoogleNewsRSS, SearchError, TavilySearch
from .storage import Database


@dataclass
class RunResult:
    target: str
    discovered: int = 0
    crawled: int = 0
    events: int = 0
    errors: int = 0
    report_path: str = ""
    warnings: list[str] = field(default_factory=list)


class Pipeline:
    def __init__(self, config: AppConfig):
        self.config = config
        self.database = Database(config.database_path)
        self.searcher = GoogleNewsRSS(
            timeout=int(config.search.get("timeout_seconds", 15)),
            user_agent=str(config.search.get("user_agent", "FetchNews/0.1")),
        )
        self.fallback_searchers = []
        if bool(config.search.get("tavily_enabled", False)):
            self.fallback_searchers.append(
                TavilySearch(
                    timeout=int(config.search.get("timeout_seconds", 15)),
                    api_key_env=str(config.search.get("tavily_api_key_env", "TAVILY_API_KEY")),
                    base_url=str(config.search.get("tavily_base_url", "https://api.tavily.com/search")),
                    user_agent=str(config.search.get("user_agent", "FetchNews/0.1")),
                )
            )
        self.crawler = ArticleCrawler(
            timeout=int(config.crawler.get("timeout_seconds", 20)),
            max_retries=int(config.crawler.get("max_retries", 2)),
            min_content_chars=int(config.crawler.get("min_content_chars", 300)),
            use_jina_fallback=bool(config.crawler.get("use_jina_fallback", True)),
            user_agent=str(config.search.get("user_agent", "FetchNews/0.1")),
        )
        provider = str(config.analysis.get("provider", "none")).lower()
        self.analysis_provider = provider
        llm = None
        if provider == "ollama":
            llm = OllamaClient(
                base_url=str(config.analysis.get("base_url", "http://localhost:11434")),
                model=str(config.analysis.get("model", "qwen2.5:7b")),
                timeout=int(config.analysis.get("timeout_seconds", 90)),
            )
        elif provider == "openai":
            llm = OpenAIClient(
                base_url=str(config.analysis.get("base_url", "https://api.openai.com/v1")),
                model=str(config.analysis.get("model", "gpt-5.6-sol")),
                timeout=int(config.analysis.get("timeout_seconds", 90)),
                api_key_env=str(config.analysis.get("api_key_env", "OPENAI_API_KEY")),
                reasoning_effort=str(config.analysis.get("reasoning_effort", "low")),
                max_output_tokens=int(config.analysis.get("max_output_tokens", 1600)),
            )
        elif provider != "none":
            raise ValueError(f"不支持的 analysis.provider：{provider}")
        self.analyzer = Analyzer(llm)
        self.reporter = MarkdownReporter(config.report_dir, config.timezone, __version__)

    def select_targets(self, selector: str | None = None) -> list[Target]:
        enabled = [target for target in self.config.targets if target.enabled]
        if selector is None:
            return enabled
        matched = [target for target in enabled if target.slug == selector or target.name == selector]
        if not matched:
            raise ValueError(f"未找到启用的监控对象：{selector}")
        return matched

    def run(self, day: date, selector: str | None = None, skip_search: bool = False) -> list[RunResult]:
        return [self.run_target(target, day, skip_search=skip_search) for target in self.select_targets(selector)]

    def run_target(self, target: Target, day: date, skip_search: bool = False) -> RunResult:
        result = RunResult(target=target.name)
        target_id = self.database.upsert_target(target)
        run_id = self.database.begin_run(target_id, day, __version__)
        try:
            if not skip_search:
                self._search(target, target_id, result)
            self._crawl(target_id, result)
            self._analyze(target, target_id, day, result)
            events = self.database.events_for_report(target_id, day)
            result.events = len(events)
            content = self.reporter.render(
                target,
                day,
                events,
                result.warnings,
                window_hours=int(self.config.search.get("window_hours", 24)),
            )
            path = self.reporter.write(target, day, content)
            result.report_path = str(path)
            status = "partial" if result.warnings else "completed"
            self.database.finish_run(
                run_id,
                status,
                result.discovered,
                result.crawled,
                result.events,
                result.errors,
                result.report_path,
            )
            return result
        except Exception:
            self.database.finish_run(
                run_id,
                "failed",
                result.discovered,
                result.crawled,
                result.events,
                result.errors + 1,
                result.report_path,
            )
            raise

    def _search(self, target: Target, target_id: int, result: RunResult) -> None:
        limit = int(self.config.search.get("per_query_limit", 20))
        providers = [self.searcher, *self.fallback_searchers]
        unavailable_providers: dict[str, str] = {}
        for query in target.keywords:
            language = "zh" if any("\u3400" <= char <= "\u9fff" for char in query) else "en"
            query_succeeded = False
            for provider in providers:
                provider_name = getattr(provider, "name", provider.__class__.__name__)
                if provider_name in unavailable_providers:
                    continue
                try:
                    found = provider.search(query, language=language, limit=limit)
                    query_succeeded = True
                    for item in found:
                        _, created = self.database.upsert_search_result(target_id, item)
                        result.discovered += int(created)
                except SearchError as error:
                    unavailable_providers[provider_name] = str(error)
                    result.errors += 1
            if not query_succeeded and not providers:
                result.errors += 1
        for provider_name, error in unavailable_providers.items():
            result.warnings.append(f"搜索源 {provider_name} 已停用：{error}")
        if unavailable_providers and len(unavailable_providers) == len(providers):
            result.warnings.append(
                "所有搜索源均不可用；如当前网络无法访问 Google News，请在 .env 配置 HTTPS_PROXY，"
                "或启用 Tavily 并设置 TAVILY_API_KEY。"
            )

    def _crawl(self, target_id: int, result: RunResult) -> None:
        for row in self.database.pending_news(target_id):
            try:
                crawled = self.crawler.crawl(
                    row["canonical_url"],
                    fallback_title=row["title_original"],
                    fallback_snippet=row["snippet"],
                )
                self.database.save_crawl(int(row["id"]), crawled)
                result.crawled += 1
                if crawled.content_quality == "snippet_only":
                    result.warnings.append(f"《{row['title_original']}》仅使用检索摘要")
            except CrawlError as error:
                self.database.mark_crawl_failed(int(row["id"]), str(error))
                result.errors += 1
                result.warnings.append(f"《{row['title_original']}》抓取失败：{error}")

    def _analyze(self, target: Target, target_id: int, day: date, result: RunResult) -> None:
        rows = self.database.news_for_analysis(target_id, day)
        events, relevance_updates, warnings = self.analyzer.analyze(target, rows)
        result.warnings.extend(warnings)
        for news_id, score, relevant in relevance_updates:
            self.database.set_relevance(target_id, news_id, score, relevant)
        for draft in events:
            self.database.insert_event(target_id, day, draft)
