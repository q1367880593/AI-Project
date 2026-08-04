from __future__ import annotations

import html
import re
import time
import urllib.request
from html.parser import HTMLParser

from .domain import CrawlResult
from .utils import normalize_space


class CrawlError(RuntimeError):
    pass


class ArticleHTMLParser(HTMLParser):
    BLOCK_TAGS = {"p", "h1", "h2", "h3", "h4", "li", "blockquote", "article"}
    SKIP_TAGS = {"script", "style", "nav", "footer", "form", "svg", "noscript"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip_depth = 0
        self.current: list[str] = []
        self.blocks: list[str] = []
        self.title = ""
        self.in_title = False
        self.title_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
        if tag == "title":
            self.in_title = True
        if tag in self.BLOCK_TAGS and not self.skip_depth:
            self._flush()

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self.BLOCK_TAGS and not self.skip_depth:
            self._flush()
        if tag == "title":
            self.in_title = False
            self.title = normalize_space(" ".join(self.title_parts))
        if tag in self.SKIP_TAGS and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        if not self.skip_depth:
            self.current.append(data)

    def _flush(self) -> None:
        text = normalize_space(" ".join(self.current))
        self.current.clear()
        if len(text) >= 20 and text not in self.blocks:
            self.blocks.append(text)

    def markdown(self) -> str:
        self._flush()
        return "\n\n".join(self.blocks)


class ArticleCrawler:
    def __init__(
        self,
        timeout: int = 20,
        max_retries: int = 2,
        min_content_chars: int = 300,
        use_jina_fallback: bool = True,
        user_agent: str = "FetchNews/0.1",
    ):
        self.timeout = timeout
        self.max_retries = max_retries
        self.min_content_chars = min_content_chars
        self.use_jina_fallback = use_jina_fallback
        self.user_agent = user_agent

    def crawl(self, url: str, fallback_title: str = "", fallback_snippet: str = "") -> CrawlResult:
        errors: list[str] = []
        try:
            return self._crawl_direct(url, fallback_title)
        except CrawlError as error:
            errors.append(str(error))
        if self.use_jina_fallback:
            try:
                return self._crawl_jina(url, fallback_title)
            except CrawlError as error:
                errors.append(str(error))
        if fallback_snippet.strip():
            return CrawlResult(
                canonical_url=url,
                title_original=fallback_title,
                content_markdown=fallback_snippet.strip(),
                content_quality="snippet_only",
                extractor="search_snippet",
            )
        raise CrawlError("；".join(errors) or "没有可用正文或检索摘要")

    def _request(self, url: str, accept: str) -> tuple[bytes, str, str]:
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            request = urllib.request.Request(
                url,
                headers={"User-Agent": self.user_agent, "Accept": accept},
            )
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    content_type = response.headers.get_content_type()
                    charset = response.headers.get_content_charset() or "utf-8"
                    return response.read(), charset, content_type
            except Exception as error:
                last_error = error
                if attempt < self.max_retries:
                    time.sleep(min(2**attempt, 4))
        raise CrawlError(f"请求失败：{last_error}")

    def _crawl_direct(self, url: str, fallback_title: str) -> CrawlResult:
        payload, charset, content_type = self._request(url, "text/html,application/xhtml+xml")
        if content_type not in {"text/html", "application/xhtml+xml", "text/plain"}:
            raise CrawlError(f"不支持的正文类型：{content_type}")
        decoded = payload.decode(charset, errors="replace")
        parser = ArticleHTMLParser()
        parser.feed(decoded)
        content = parser.markdown()
        if len(content) < self.min_content_chars:
            raise CrawlError(f"正文过短：{len(content)} 字符")
        return CrawlResult(
            canonical_url=url,
            title_original=parser.title or fallback_title,
            content_markdown=content,
            language=detect_language(content),
            content_quality="full",
            extractor="direct",
        )

    def _crawl_jina(self, url: str, fallback_title: str) -> CrawlResult:
        jina_url = f"https://r.jina.ai/{url}"
        payload, charset, _ = self._request(jina_url, "text/plain,text/markdown")
        content = payload.decode(charset, errors="replace").strip()
        if len(content) < self.min_content_chars:
            raise CrawlError(f"Jina 正文过短：{len(content)} 字符")
        title_match = re.search(r"(?m)^Title:\s*(.+)$", content)
        title = html.unescape(title_match.group(1).strip()) if title_match else fallback_title
        return CrawlResult(
            canonical_url=url,
            title_original=title,
            content_markdown=content,
            language=detect_language(content),
            content_quality="full",
            extractor="jina",
        )


def detect_language(text: str) -> str:
    cjk = len(re.findall(r"[\u3400-\u9fff]", text))
    latin = len(re.findall(r"[A-Za-z]", text))
    if cjk > max(10, latin // 4):
        return "zh"
    if latin > 20:
        return "en"
    return "unknown"

