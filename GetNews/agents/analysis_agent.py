"""Analysis Agent - 新闻分析核心模块

负责：去重、事件聚类、重要性评分、可信度判断、历史关联、摘要生成
"""

import json
import yaml
from datetime import datetime, date
from typing import Optional

from storage import NewsArticle, Event, Database
from .llm_client import LLMClient


class AnalysisAgent:
    """分析 Agent，负责理解和分析新闻"""

    def __init__(
        self,
        db: Database,
        llm: Optional[LLMClient] = None,
        config_path: str = "config/source.yaml",
        prompt_path: str = "config/prompt.yaml",
    ):
        self.db = db
        self.llm = llm or LLMClient(config_path)
        with open(prompt_path) as f:
            self.prompts = yaml.safe_load(f)

    def analyze(self, person_name: str, today: Optional[date] = None) -> list[Event]:
        """对指定人物的最新新闻执行完整分析流程"""
        today = today or date.today()
        today_str = today.isoformat()

        # 1. 获取待分析新闻
        articles = self.db.get_news_for_analysis(person_name, limit=50)
        if not articles:
            print(f"[Analysis] {person_name} 没有待分析的新闻")
            return []

        print(f"[Analysis] {person_name} 待分析新闻: {len(articles)} 篇")

        # 2. 去重（基于标题相似度）
        articles = self._dedup(articles)
        print(f"[Analysis] 去重后: {len(articles)} 篇")

        if not articles:
            return []

        # 3. 事件聚类
        clusters = self._cluster_events(articles)
        print(f"[Analysis] 聚类为 {len(clusters)} 个事件")

        # 4. 对每个聚类：评分 + 可信度 + 历史关联 + 摘要
        events = []
        for cluster in clusters:
            event = self._process_cluster(cluster, person_name, today_str)
            if event:
                events.append(event)

        return events

    def _dedup(self, articles: list[NewsArticle]) -> list[NewsArticle]:
        """去重：基于标题相似度"""
        if len(articles) <= 1:
            return articles

        # 如果没有 LLM，使用简单的标题关键词去重
        if not self.llm:
            return self._simple_dedup(articles)

        prompts = self.prompts.get("dedup", {})
        system_prompt = prompts.get("system", "")
        user_template = prompts.get("user", "")

        unique = [articles[0]]
        for article in articles[1:]:
            is_dup = False
            for existing in unique:
                prompt = user_template.format(
                    title_a=existing.title,
                    summary_a=existing.summary,
                    title_b=article.title,
                    summary_b=article.summary,
                )
                response = self.llm.chat(system_prompt, prompt)
                result = self.llm.extract_json(response)

                if result and result.get("same_event") and result.get("confidence", 0) > 0.7:
                    is_dup = True
                    break

            if not is_dup:
                unique.append(article)

        return unique

    def _simple_dedup(self, articles: list[NewsArticle]) -> list[NewsArticle]:
        """简单去重：基于标题关键词重叠"""
        def get_keywords(title: str) -> set:
            # 简单分词
            words = title.lower().split()
            return {w.strip(".,;:!?\"'()[]{}") for w in words if len(w) > 3}

        unique = [articles[0]]
        for article in articles[1:]:
            kws = get_keywords(article.title)
            is_dup = False
            for existing in unique:
                ekws = get_keywords(existing.title)
                if ekws and kws:
                    overlap = len(kws & ekws) / min(len(kws), len(ekws))
                    if overlap > 0.6:
                        is_dup = True
                        break
            if not is_dup:
                unique.append(article)

        return unique

    def _cluster_events(self, articles: list[NewsArticle]) -> list[list[NewsArticle]]:
        """事件聚类：将相关新闻聚合为一个事件"""
        if len(articles) <= 1:
            return [articles] if articles else []

        if not self.llm:
            return self._simple_cluster(articles)

        # 分批处理，每批最多 20 条
        if len(articles) <= 20:
            return self._llm_cluster(articles)

        # 分批聚类
        batch_size = 20
        all_clusters = []
        for i in range(0, len(articles), batch_size):
            batch = articles[i:i + batch_size]
            clusters = self._llm_cluster(batch)
            all_clusters.extend(clusters)

        return all_clusters

    def _llm_cluster(self, articles: list[NewsArticle]) -> list[list[NewsArticle]]:
        """使用 LLM 进行事件聚类"""
        prompts = self.prompts.get("event_clustering", {})
        system_prompt = prompts.get("system", "")

        news_list = "\n".join(
            f"[{i}] {a.title}\n    {a.summary[:200]}" for i, a in enumerate(articles)
        )
        user_prompt = prompts.get("user", "").format(news_list=news_list)

        response = self.llm.chat(system_prompt, user_prompt)
        result = self.llm.extract_json(response)

        if not result or not isinstance(result, list):
            # 降级：每个新闻独立成事件
            return [[a] for a in articles]

        clusters = []
        assigned = set()
        for cluster_info in result:
            if isinstance(cluster_info, dict):
                indices = cluster_info.get("news_indices", [])
                cluster_articles = []
                for idx in indices:
                    if isinstance(idx, int) and 0 <= idx < len(articles):
                        cluster_articles.append(articles[idx])
                        assigned.add(idx)
                if cluster_articles:
                    clusters.append(cluster_articles)

        # 未分配的新闻各自成事件
        for i, a in enumerate(articles):
            if i not in assigned:
                clusters.append([a])

        return clusters

    def _simple_cluster(self, articles: list[NewsArticle]) -> list[list[NewsArticle]]:
        """简单聚类：基于标题相似度"""
        def title_similarity(a: NewsArticle, b: NewsArticle) -> float:
            words_a = set(a.title.lower().split())
            words_b = set(b.title.lower().split())
            if not words_a or not words_b:
                return 0
            return len(words_a & words_b) / len(words_a | words_b)

        clusters = []
        used = set()
        for i, a in enumerate(articles):
            if i in used:
                continue
            cluster = [a]
            used.add(i)
            for j, b in enumerate(articles):
                if j in used:
                    continue
                if title_similarity(a, b) > 0.5:
                    cluster.append(b)
                    used.add(j)
            clusters.append(cluster)

        return clusters

    def _process_cluster(
        self, articles: list[NewsArticle], person_name: str, today_str: str
    ) -> Optional[Event]:
        """处理一个聚类：评分、可信度、历史关联、入库"""
        # 事件名称（用第一个标题）
        event_name = articles[0].title

        # 重要性评分
        importance = self._score_importance(articles, person_name)

        # 可信度判断
        credibility = self._check_credibility(articles)

        # 历史关联
        historical_context = self._find_historical_links(articles, person_name, today_str)

        # 生成摘要
        summary_data = self._generate_summary(event_name, articles, historical_context)

        # 创建事件
        event = Event(
            summary=summary_data.get("summary", event_name),
            importance=importance,
            credibility=credibility,
            person_name=person_name,
            first_seen=datetime.now(),
            last_seen=datetime.now(),
        )
        event_id = self.db.insert_event(event)
        event.id = event_id

        # 关联新闻
        news_ids = [a.id for a in articles if a.id]
        self.db.link_event_news(event_id, news_ids)

        # 保存历史关联
        if historical_context:
            for link in historical_context:
                if isinstance(link, dict) and link.get("past_event_id"):
                    self.db.insert_historical_link(
                        event_id, link["past_event_id"], link.get("relation", "")
                    )

        # 更新事件摘要（包含影响和背景）
        full_summary = summary_data.get("summary", event_name)
        if summary_data.get("impact"):
            full_summary += f"\n\n影响：{summary_data['impact']}"
        if summary_data.get("background"):
            full_summary += f"\n\n背景：{summary_data['background']}"
        event.summary = full_summary
        self.db.update_event(event)

        return event

    def _score_importance(self, articles: list[NewsArticle], person_name: str) -> int:
        """重要性评分"""
        if not self.llm:
            return self._simple_importance_score(articles)

        # 取第一条新闻进行评分
        article = articles[0]
        prompts = self.prompts.get("importance_scoring", {})
        system_prompt = prompts.get("system", "")
        user_prompt = prompts.get("user", "").format(
            person_name=person_name,
            title=article.title,
            summary=article.summary or article.content[:500],
        )

        response = self.llm.chat(system_prompt, user_prompt)
        result = self.llm.extract_json(response)

        if result and "score" in result:
            return max(0, min(100, int(result["score"])))

        # 降级
        return self._simple_importance_score(articles)

    def _simple_importance_score(self, articles: list[NewsArticle]) -> int:
        """简单重要性评分：基于来源数量和关键词"""
        score = 30  # 基线

        # 来源越多越重要
        sources = len(set(a.source for a in articles))
        score += min(sources * 10, 30)

        # 关键词判断
        high_importance_keywords = [
            "earnings", "revenue", "profit", "acquisition", "merger", "launch",
            "released", "announced", "ceo", "lawsuit", "regulation", "IPO",
            "财报", "收购", "合并", "发布", "上市", "CEO",
        ]
        for a in articles:
            title_lower = a.title.lower()
            for kw in high_importance_keywords:
                if kw.lower() in title_lower:
                    score += 15
                    break

        return min(100, score)

    def _check_credibility(self, articles: list[NewsArticle]) -> int:
        """可信度判断"""
        sources = list(set(a.source for a in articles))
        source_count = len(sources)

        if not self.llm:
            return self._simple_credibility(source_count, sources)

        article = articles[0]
        prompts = self.prompts.get("credibility_check", {})
        system_prompt = prompts.get("system", "")
        user_prompt = prompts.get("user", "").format(
            title=article.title,
            source_count=source_count,
            sources=", ".join(sources),
        )

        response = self.llm.chat(system_prompt, user_prompt)
        result = self.llm.extract_json(response)

        if result and "credibility" in result:
            return max(0, min(100, int(result["credibility"])))

        return self._simple_credibility(source_count, sources)

    def _simple_credibility(self, source_count: int, sources: list[str]) -> int:
        """简单可信度计算"""
        # 基于来源数量：1个来源=40%，2个=60%，3个=80%，4个+=90%
        base = {1: 40, 2: 60, 3: 80}.get(source_count, 90)

        # 已知权威来源加分
        authoritative = {"reuters", "bloomberg", "cnn", "bbc", "wsj", "financial times"}
        for s in sources:
            if s.lower() in authoritative:
                base += 10

        return min(100, base)

    def _find_historical_links(
        self, articles: list[NewsArticle], person_name: str, today_str: str
    ) -> list[dict]:
        """查找历史关联"""
        past_events = self.db.get_past_events(person_name, today_str, limit=10)
        if not past_events:
            return []

        if not self.llm:
            return self._simple_historical_links(articles, past_events)

        # 使用 LLM 判断历史关联
        article_titles = "\n".join(f"- {a.title}" for a in articles[:3])
        past_summaries = "\n".join(
            f"[Event {e.id}] {e.summary[:200]}" for e in past_events
        )

        prompt = f"""当前新闻:
{article_titles}

历史事件:
{past_summaries}

请判断当前新闻是否与历史事件相关。只回复 JSON 格式：
[{{"past_event_id": 事件ID, "relation": "关联描述"}}]
如果没有关联，回复 []。"""

        response = self.llm.chat(
            "你是一个新闻分析专家。判断当前新闻与历史事件的关联。",
            prompt,
        )
        result = self.llm.extract_json(response)

        if result and isinstance(result, list):
            return result

        return []

    def _simple_historical_links(
        self, articles: list[NewsArticle], past_events: list[Event]
    ) -> list[dict]:
        """简单历史关联：基于关键词"""
        links = []
        current_text = " ".join(a.title.lower() for a in articles)

        for past in past_events:
            past_text = past.summary.lower()
            # 计算关键词重叠
            past_words = set(past_text.split())
            current_words = set(current_text.split())
            if not past_words or not current_words:
                continue
            overlap = len(past_words & current_words) / min(len(past_words), len(current_words))
            if overlap > 0.3:
                links.append({
                    "past_event_id": past.id,
                    "relation": "可能存在关联",
                })

        return links[:3]

    def _generate_summary(
        self, event_name: str, articles: list[NewsArticle], historical_context: list[dict]
    ) -> dict:
        """生成事件摘要"""
        if not self.llm:
            return self._simple_summary(event_name, articles)

        prompts = self.prompts.get("summary_generation", {})
        system_prompt = prompts.get("system", "")

        news_articles = "\n\n---\n\n".join(
            f"标题: {a.title}\n来源: {a.source}\n内容: {a.content[:500]}"
            for a in articles[:3]
        )

        history_text = ""
        if historical_context:
            history_text = "\n".join(
                f"- {h.get('relation', '相关事件')}" for h in historical_context
            )

        user_prompt = prompts.get("user", "").format(
            event_name=event_name,
            news_articles=news_articles,
            historical_context=history_text or "无",
        )

        response = self.llm.chat(system_prompt, user_prompt)
        result = self.llm.extract_json(response)

        if result and isinstance(result, dict):
            return result

        return self._simple_summary(event_name, articles)

    def _simple_summary(self, event_name: str, articles: list[NewsArticle]) -> dict:
        """简单摘要生成"""
        sources = list(set(a.source for a in articles))
        summary = articles[0].summary or articles[0].content[:300] if articles else event_name

        return {
            "summary": summary,
            "impact": "待分析",
            "background": "无",
        }