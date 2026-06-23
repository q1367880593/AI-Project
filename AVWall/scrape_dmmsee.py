#!/usr/bin/env python3
"""
Fetch video metadata from dmmsee pages and generate media-library friendly
NFO files, poster images, and preview images.

Example:
    python3 scrape_dmmsee.py --input codes.txt --output output
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image

try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright
except ModuleNotFoundError:
    PlaywrightTimeoutError = TimeoutError
    sync_playwright = None


# DEFAULT_BASE_URL = "https://www.dmmsee.ink"
DEFAULT_BASE_URL = "https://www.javbus.com"

DEFAULT_TIMEOUT_MS = 90_000
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp")
POSTER_SIZE = (563, 800)
BAD_IMAGE_WORDS = ("logo", "icon", "avatar", "banner", "placeholder", "loading", "sprite", "favicon")
COVER_IMAGE_WORDS = ("cover", "poster", "jacket", "package", "bigimage", "pl.", "pl.jpg", "ps.jpg")
SAMPLE_IMAGE_WORDS = ("sample", "preview", "screenshot", "gallery", "jp-", "cap", "scene", "fanart")


@dataclass
class MovieInfo:
    code: str
    url: str
    title: str = ""
    original_title: str = ""
    release_date: str = ""
    runtime: str = ""
    studio: str = ""
    maker: str = ""
    label: str = ""
    series: str = ""
    director: str = ""
    plot: str = ""
    outline: str = ""
    country: str = "日本"
    genres: list[str] = field(default_factory=list)
    actors: list[str] = field(default_factory=list)
    poster_url: str = ""
    fanart_url: str = ""
    preview_urls: list[str] = field(default_factory=list)
    poster_file: str = ""
    cover_file: str = ""
    fanart_file: str = ""
    preview_files: list[str] = field(default_factory=list)


@dataclass
class ImageCandidate:
    url: str
    width: int = 0
    height: int = 0
    text: str = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape dmmsee metadata and generate NFO/poster/previews."
    )
    parser.add_argument("-i", "--input", default="codes.txt", help="Text file with one code per line.")
    parser.add_argument("-o", "--output", default="output", help="Output directory.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Site base URL.")
    parser.add_argument("--timeout-ms", type=int, default=DEFAULT_TIMEOUT_MS, help="Page load timeout.")
    parser.add_argument("--retries", type=int, default=6, help="Download retry count.")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between items, in seconds.")
    parser.add_argument("--headed", action="store_true", help="Run browser with a visible window.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing images and NFO files.")
    parser.add_argument("--debug-images", action="store_true", help="Print image candidates and chosen URLs.")
    return parser.parse_args()


def load_codes(path: Path) -> list[str]:
    codes: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        value = line.strip()
        if not value or value.startswith("#"):
            continue
        codes.append(value.upper())
    return codes


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def first_text(soup: BeautifulSoup, selectors: Iterable[str]) -> str:
    for selector in selectors:
        node = soup.select_one(selector)
        if node:
            text = normalize_space(node.get_text(" ", strip=True))
            if text:
                return text
    return ""


def meta_content(soup: BeautifulSoup, *names: str) -> str:
    for name in names:
        node = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if node and node.get("content"):
            return normalize_space(node["content"])
    return ""


def parse_json_ld(soup: BeautifulSoup) -> dict:
    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text()
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    return item
        if isinstance(data, dict):
            return data
    return {}


def absolute_image_url(value: str, page_url: str) -> str:
    if not value:
        return ""
    value = value.strip()
    if value.startswith("//"):
        return "https:" + value
    return urljoin(page_url, value)


def collect_image_candidates(soup: BeautifulSoup, page_url: str) -> list[ImageCandidate]:
    images: list[ImageCandidate] = []
    attrs = ("src", "data-src", "data-original", "data-lazy-src", "data-url", "href")
    for node in soup.find_all(["img", "a", "source"]):
        for attr in attrs:
            value = node.get(attr)
            if not value:
                continue
            url = absolute_image_url(value, page_url)
            lower = urlparse(url).path.lower()
            if lower.endswith(IMAGE_EXTS):
                text = " ".join(
                    normalize_space(str(node.get(name, "")))
                    for name in ("class", "id", "alt", "title")
                )
                images.append(ImageCandidate(url=url, text=text))
    return dedupe_images(images)


def dedupe_images(images: Iterable[ImageCandidate]) -> list[ImageCandidate]:
    seen: set[str] = set()
    result: list[ImageCandidate] = []
    for image in images:
        if image.url and image.url not in seen:
            seen.add(image.url)
            result.append(image)
    return result


def dedupe(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        key = value.strip()
        if key and key not in seen:
            seen.add(key)
            result.append(key)
    return result


def split_people(value: str) -> list[str]:
    chunks = re.split(r"[,/、，\n]+", value)
    return [normalize_space(chunk) for chunk in chunks if normalize_space(chunk)]


def split_values(value: str) -> list[str]:
    chunks = re.split(r"[,/、，\n]+", value)
    return dedupe(normalize_space(chunk) for chunk in chunks if normalize_space(chunk))


def clean_field_value(value: str, labels: Iterable[str]) -> str:
    cleaned = normalize_space(value)
    for label in sorted(labels, key=len, reverse=True):
        cleaned = re.sub(rf"^{re.escape(label)}\s*[:：]?\s*", "", cleaned, flags=re.I)
    return normalize_space(cleaned)


def text_without_nested_label(node, labels: Iterable[str]) -> str:
    text = normalize_space(node.get_text(" ", strip=True))
    return clean_field_value(text, labels)


def value_after_label(soup: BeautifulSoup, labels: Iterable[str]) -> str:
    label_pattern = "|".join(re.escape(label) for label in labels)
    pattern = re.compile(rf"^\s*({label_pattern})\s*[:：]?\s*$", re.I)
    for node in soup.find_all(string=pattern):
        parent = node.parent
        if not parent:
            continue
        inline = normalize_space(parent.get_text(" ", strip=True))
        inline = re.sub(rf"^({label_pattern})\s*[:：]?\s*", "", inline, flags=re.I)
        if inline and inline not in labels:
            return inline
        for sibling in parent.find_next_siblings(limit=1):
            text = normalize_space(sibling.get_text(" ", strip=True))
            if text:
                return text
    text = normalize_space(soup.get_text("\n", strip=True))
    match = re.search(rf"({label_pattern})\s*[:：]\s*(.+)", text, flags=re.I)
    return normalize_space(match.group(2).split("\n")[0]) if match else ""


def values_after_label(soup: BeautifulSoup, labels: Iterable[str]) -> list[str]:
    values: list[str] = []
    label_pattern = "|".join(re.escape(label) for label in labels)
    pattern = re.compile(rf"^\s*({label_pattern})\s*[:：]?\s*$", re.I)
    for node in soup.find_all(string=pattern):
        parent = node.parent
        if not parent:
            continue

        inline = text_without_nested_label(parent, labels)
        if inline:
            values.extend(split_values(inline))
            return dedupe(values)

        for sibling in parent.find_next_siblings(limit=1):
            for link in sibling.find_all("a"):
                text = clean_field_value(link.get_text(" ", strip=True), labels)
                if text:
                    values.append(text)
            if values:
                return dedupe(values)
            text = text_without_nested_label(sibling, labels)
            if text:
                values.extend(split_values(text))
                return dedupe(values)

    value = value_after_label(soup, labels)
    return split_values(value)


def normalize_date(value: str) -> str:
    match = re.search(r"(\d{4})[./年-](\d{1,2})[./月-](\d{1,2})", value or "")
    if not match:
        return ""
    year, month, day = match.groups()
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"


def normalize_runtime(value: str) -> str:
    match = re.search(r"\d+", value or "")
    return match.group(0) if match else ""


def clean_title(value: str, code: str) -> str:
    title = normalize_space(value)
    title = re.sub(r"\s*[-|_]\s*(DMMSee|DMMSEE).*$", "", title, flags=re.I)
    title = re.sub(r"\s+(无码流出|中文字幕|高清|在线观看|线上看|免費|免费).*$", "", title)
    if code.upper() in title.upper():
        match = re.search(re.escape(code), title, flags=re.I)
        if match:
            title = title[match.start() :]
    return normalize_space(title)


def choose_title(soup: BeautifulSoup, json_ld: dict, code: str) -> str:
    candidates = [
        first_text(soup, [".container > h3", "h1", ".title", ".movie-title", "[class*=title]"]),
        meta_content(soup, "og:title", "twitter:title"),
        normalize_space(json_ld.get("name", "")),
        soup.title.get_text(" ", strip=True) if soup.title else "",
    ]
    for candidate in candidates:
        title = clean_title(candidate, code)
        if code.upper() in title.upper():
            return title
    for candidate in candidates:
        title = clean_title(candidate, code)
        if title:
            return f"{code} {title}".strip()
    return code


def javbus_info_value(soup: BeautifulSoup, *labels: str) -> str:
    info = soup.select_one(".movie .info, .info")
    if not info:
        return ""
    label_set = {label.rstrip(":：") for label in labels}
    for paragraph in info.find_all("p", recursive=False):
        header = paragraph.find(class_="header")
        if not header:
            continue
        header_text = normalize_space(header.get_text(" ", strip=True)).rstrip(":：")
        if header_text not in label_set:
            continue
        link = paragraph.find("a")
        if link:
            return normalize_space(link.get_text(" ", strip=True))
        header.extract()
        return normalize_space(paragraph.get_text(" ", strip=True).lstrip(":："))
    return ""


def javbus_genres(soup: BeautifulSoup) -> list[str]:
    return dedupe(
        normalize_space(link.get_text(" ", strip=True))
        for link in soup.select(".movie .info span.genre a[href*='/genre/'], .info span.genre a[href*='/genre/']")
        if normalize_space(link.get_text(" ", strip=True))
    )


def javbus_actors(soup: BeautifulSoup) -> list[str]:
    actors = [
        normalize_space(link.get_text(" ", strip=True))
        for link in soup.select(".movie .info span.genre a[href*='/star/'], .info span.genre a[href*='/star/']")
    ]
    if not actors:
        actors = [
            normalize_space(link.get("title") or link.get_text(" ", strip=True))
            for link in soup.select(".movie .info .star-name a, .info .star-name a")
        ]
    return dedupe(actor for actor in actors if actor)


def javbus_big_image(soup: BeautifulSoup, page_url: str) -> str:
    node = soup.select_one("a.bigImage[href]")
    return absolute_image_url(node.get("href", ""), page_url) if node else ""


def javbus_sample_images(soup: BeautifulSoup, page_url: str) -> list[ImageCandidate]:
    images: list[ImageCandidate] = []
    for link in soup.select("#sample-waterfall a.sample-box[href], .sample-waterfall a.sample-box[href]"):
        url = absolute_image_url(link.get("href", ""), page_url)
        if urlparse(url).path.lower().endswith(IMAGE_EXTS):
            img = link.find("img")
            images.append(
                ImageCandidate(
                    url=url,
                    text=normalize_space((img.get("title", "") if img else "") or "sample-waterfall"),
                )
            )
    return dedupe_images(images)


def parse_page(
    code: str,
    page_url: str,
    html: str,
    loaded_images: list[ImageCandidate] | None = None,
    sample_images: list[ImageCandidate] | None = None,
) -> MovieInfo:
    soup = BeautifulSoup(html, "lxml")
    json_ld = parse_json_ld(soup)

    title = choose_title(soup, json_ld, code)

    description = (
        meta_content(soup, "description", "og:description")
        or normalize_space(json_ld.get("description", ""))
    )

    image_candidates = dedupe_images((loaded_images or []) + collect_image_candidates(soup, page_url))
    meta_image = (
        absolute_image_url(meta_content(soup, "og:image", "twitter:image"), page_url)
        or absolute_image_url(str(json_ld.get("image", "")), page_url)
    )
    if meta_image:
        image_candidates.insert(0, ImageCandidate(url=meta_image, text="meta image"))
        image_candidates = dedupe_images(image_candidates)

    html_sample_images = javbus_sample_images(soup, page_url)
    exact_sample_images = html_sample_images or (sample_images or [])
    fanart_url = javbus_big_image(soup, page_url) or choose_fanart_url(image_candidates, "")
    poster_url = fanart_url or choose_poster_url(image_candidates)
    preview_urls = [image.url for image in exact_sample_images]

    release_date = normalize_date(
        javbus_info_value(soup, "發行日期", "发行日期")
        or value_after_label(soup, ["發行日期", "发行日期", "発売日", "Release Date", "Released"])
    )
    runtime = normalize_runtime(
        javbus_info_value(soup, "長度", "时长", "時長")
        or value_after_label(soup, ["長度", "时长", "時長", "収録時間", "Runtime", "Length"])
    )
    actors = javbus_actors(soup) or values_after_label(
        soup, ["女優", "女优", "演員", "演员", "出演", "Actress", "Actor", "Cast", "出演者"]
    )
    genres = javbus_genres(soup) or values_after_label(
        soup, ["類別", "类别", "类型", "標籤", "标签", "ジャンル", "Genre", "Tags"]
    )

    info = MovieInfo(
        code=code,
        url=page_url,
        title=title,
        original_title=title,
        release_date=release_date,
        runtime=runtime,
        studio=javbus_info_value(soup, "製作商", "制作商") or value_after_label(soup, ["製作商", "制作商", "片商", "製作", "Studio", "Maker", "メーカー"]),
        maker=javbus_info_value(soup, "製作商", "制作商") or value_after_label(soup, ["製作商", "制作商", "Maker", "メーカー"]),
        label=javbus_info_value(soup, "發行商", "发行商") or value_after_label(soup, ["發行商", "发行商", "發行", "发行", "Label", "レーベル"]),
        series=javbus_info_value(soup, "系列") or value_after_label(soup, ["系列", "Series", "シリーズ"]),
        director=javbus_info_value(soup, "導演", "导演") or value_after_label(soup, ["導演", "导演", "Director", "監督"]),
        plot=description,
        outline=description,
        country=value_after_label(soup, ["國家", "国家", "Country"]) or "日本",
        genres=genres,
        actors=actors,
        poster_url=poster_url,
        fanart_url=fanart_url,
        preview_urls=preview_urls,
    )
    return info


def image_key(image: ImageCandidate) -> str:
    return f"{image.url} {image.text}".lower()


def is_bad_image(image: ImageCandidate) -> bool:
    key = image_key(image)
    if any(word in key for word in BAD_IMAGE_WORDS):
        return True
    if image.width and image.height and (image.width < 220 or image.height < 220):
        return True
    return False


def image_area(image: ImageCandidate) -> int:
    return max(image.width, 1) * max(image.height, 1)


def choose_poster_url(images: list[ImageCandidate]) -> str:
    usable = [image for image in images if not is_bad_image(image)]
    if not usable:
        return images[0].url if images else ""

    def score(image: ImageCandidate) -> tuple[int, int, str]:
        key = image_key(image)
        portrait = image.height >= image.width * 1.08 if image.width and image.height else False
        landscape = image.width > image.height if image.width and image.height else False
        cover_word = any(word in key for word in COVER_IMAGE_WORDS)
        sample_word = any(word in key for word in SAMPLE_IMAGE_WORDS)
        score_value = (
            (50 if portrait else 0)
            + (35 if cover_word else 0)
            - (45 if landscape else 0)
            - (10 if sample_word else 0)
        )
        return (score_value, image_area(image), image.url)

    return max(usable, key=score).url


def choose_fanart_url(images: list[ImageCandidate], poster_url: str) -> str:
    usable = [image for image in images if image.url != poster_url and not is_bad_image(image)]
    if not usable:
        return poster_url

    def score(image: ImageCandidate) -> tuple[int, int, str]:
        key = image_key(image)
        landscape = image.width > image.height if image.width and image.height else False
        sample_word = any(word in key for word in SAMPLE_IMAGE_WORDS)
        cover_word = any(word in key for word in COVER_IMAGE_WORDS)
        score_value = (60 if landscape else 0) + (20 if sample_word else 0) - (35 if cover_word else 0)
        return (score_value, image_area(image), image.url)

    return max(usable, key=score).url


def choose_preview_urls(images: list[ImageCandidate], poster_url: str, fanart_url: str) -> list[str]:
    usable = [
        image
        for image in images
        if image.url not in {poster_url, fanart_url} and not is_bad_image(image)
    ]

    def score(image: ImageCandidate) -> tuple[int, int, str]:
        key = image_key(image)
        sample_word = any(word in key for word in SAMPLE_IMAGE_WORDS)
        landscape = image.width > image.height if image.width and image.height else False
        cover_word = any(word in key for word in COVER_IMAGE_WORDS)
        score_value = (40 if sample_word else 0) + (15 if landscape else 0) - (20 if cover_word else 0)
        return (score_value, image_area(image), image.url)

    return [image.url for image in sorted(usable, key=score, reverse=True)]


def pass_age_verification(page, target_url: str, timeout_ms: int) -> None:
    current_url = page.url
    title = ""
    try:
        title = page.title()
    except Exception:
        pass
    is_verify_page = "driver-verify" in current_url or "Age Verification" in title
    if not is_verify_page:
        return

    try:
        checkbox = page.locator("#ageVerify input[type='checkbox']").first
        if checkbox.count():
            checkbox.check(timeout=5_000)
        submit = page.locator("#ageVerify input[type='submit'], #submit").first
        if submit.count():
            submit.click(timeout=5_000)
            page.wait_for_load_state("domcontentloaded", timeout=timeout_ms)
    except PlaywrightTimeoutError:
        pass

    if "driver-verify" in page.url:
        page.goto(target_url, wait_until="domcontentloaded", timeout=timeout_ms)


def fetch_html(page, url: str, timeout_ms: int) -> str:
    page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
    pass_age_verification(page, url, timeout_ms)
    try:
        page.wait_for_load_state("networkidle", timeout=timeout_ms)
    except PlaywrightTimeoutError:
        pass

    page.evaluate(
        """
        async () => {
            await new Promise(resolve => setTimeout(resolve, 1500));
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 1500));
            window.scrollTo(0, 0);
            await Promise.race([
                Promise.all(Array.from(document.images).map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(resolve => {
                        img.addEventListener('load', resolve, { once: true });
                        img.addEventListener('error', resolve, { once: true });
                    });
                })),
                new Promise(resolve => setTimeout(resolve, 8000))
            ]);
        }
        """
    )
    return page.content()


def collect_loaded_images(page, page_url: str) -> list[ImageCandidate]:
    raw_images = page.evaluate(
        """
        () => {
            const values = [];
            const add = (url, width, height, text) => {
                if (!url) return;
                values.push({ url, width: width || 0, height: height || 0, text: text || '' });
            };
            for (const img of Array.from(document.images)) {
                const text = [
                    img.className,
                    img.id,
                    img.alt,
                    img.title,
                    img.closest('a')?.className,
                    img.closest('a')?.id,
                    img.closest('figure')?.className,
                    img.closest('[class]')?.className
                ].filter(Boolean).join(' ');
                add(
                    img.currentSrc || img.src || img.dataset.src || img.dataset.original || img.dataset.lazySrc,
                    img.naturalWidth,
                    img.naturalHeight,
                    text
                );
            }
            for (const a of Array.from(document.querySelectorAll('a[href]'))) {
                add(a.href, 0, 0, [a.className, a.id, a.title, a.textContent].filter(Boolean).join(' '));
            }
            return values;
        }
        """
    )
    images: list[ImageCandidate] = []
    for item in raw_images:
        url = absolute_image_url(str(item.get("url", "")), page_url)
        lower = urlparse(url).path.lower()
        if lower.endswith(IMAGE_EXTS):
            images.append(
                ImageCandidate(
                    url=url,
                    width=int(item.get("width") or 0),
                    height=int(item.get("height") or 0),
                    text=normalize_space(str(item.get("text") or "")),
                )
            )
    return dedupe_images(images)


def collect_sample_images(page, page_url: str) -> list[ImageCandidate]:
    raw_images = page.evaluate(
        """
        () => {
            const imageFromElement = (element) => {
                if (!element) return null;
                const url = element.currentSrc || element.src || element.dataset?.src ||
                    element.dataset?.original || element.dataset?.lazySrc || element.href;
                if (!url) return null;
                return {
                    url,
                    width: element.naturalWidth || 0,
                    height: element.naturalHeight || 0,
                    text: [element.className, element.id, element.alt, element.title].filter(Boolean).join(' ')
                };
            };
            const collectFrom = (root) => {
                const values = [];
                for (const element of Array.from(root.querySelectorAll('img, a[href]'))) {
                    const item = imageFromElement(element);
                    if (item) values.push(item);
                }
                return values;
            };
            const root = document.querySelector('.sample-waterfall');
            return root ? collectFrom(root) : [];
        }
        """
    )
    images: list[ImageCandidate] = []
    for item in raw_images:
        url = absolute_image_url(str(item.get("url", "")), page_url)
        lower = urlparse(url).path.lower()
        if lower.endswith(IMAGE_EXTS):
            images.append(
                ImageCandidate(
                    url=url,
                    width=int(item.get("width") or 0),
                    height=int(item.get("height") or 0),
                    text=normalize_space(str(item.get("text") or "sample-waterfall")),
                )
            )
    return dedupe_images(images)


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        }
    )
    return session


def sync_browser_cookies(context, session: requests.Session) -> None:
    for cookie in context.cookies():
        session.cookies.set(
            cookie["name"],
            cookie["value"],
            domain=cookie.get("domain"),
            path=cookie.get("path", "/"),
        )


def remote_size(session: requests.Session, url: str, referer: str, timeout: int = 30) -> int | None:
    try:
        response = session.head(url, headers={"Referer": referer}, allow_redirects=True, timeout=timeout)
        if response.ok and response.headers.get("Content-Length"):
            return int(response.headers["Content-Length"])
    except requests.RequestException:
        return None
    return None


def download_with_resume(
    session: requests.Session,
    url: str,
    target: Path,
    referer: str,
    retries: int,
    overwrite: bool,
) -> bool:
    if not url:
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not overwrite:
        return True

    part = target.with_suffix(target.suffix + ".part")
    expected_size = remote_size(session, url, referer)
    if target.exists() and overwrite:
        target.unlink()

    for attempt in range(1, retries + 1):
        current_size = part.stat().st_size if part.exists() else 0
        headers = {"Referer": referer}
        if current_size:
            headers["Range"] = f"bytes={current_size}-"
        try:
            with session.get(url, headers=headers, stream=True, timeout=(20, 90)) as response:
                if current_size and response.status_code != 206:
                    part.unlink(missing_ok=True)
                    current_size = 0
                    with session.get(url, headers={"Referer": referer}, stream=True, timeout=(20, 90)) as retry_response:
                        retry_response.raise_for_status()
                        write_stream(retry_response, part, "wb")
                else:
                    response.raise_for_status()
                    write_stream(response, part, "ab" if current_size else "wb")

            final_size = part.stat().st_size if part.exists() else 0
            if expected_size is None or final_size >= expected_size:
                os.replace(part, target)
                return True
        except requests.RequestException as exc:
            print(f"  download retry {attempt}/{retries}: {url} ({exc})")
            time.sleep(min(2 ** attempt, 30))

    return False


def write_stream(response: requests.Response, path: Path, mode: str) -> None:
    with path.open(mode + ("" if "b" in mode else "b")) as handle:
        for chunk in response.iter_content(chunk_size=1024 * 256):
            if chunk:
                handle.write(chunk)


def image_suffix(url: str, fallback: str = ".jpg") -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix if suffix in IMAGE_EXTS else fallback


def image_filename(prefix: str, index: int | None, url: str) -> str:
    suffix = image_suffix(url)
    if index is None:
        return f"{prefix}{suffix}"
    return f"{prefix}-{index:02d}{suffix}"


def jpg_name(stem: str) -> str:
    return f"{stem}.jpg"


def copy_if_needed(source: Path, target: Path, overwrite: bool) -> None:
    if not source.exists():
        return
    if target.exists() and not overwrite:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def download_first_available(
    session: requests.Session,
    urls: Iterable[str],
    target: Path,
    referer: str,
    retries: int,
    overwrite: bool,
) -> tuple[bool, str]:
    for url in dedupe(urls):
        ok = download_with_resume(session, url, target, referer, retries, overwrite)
        if ok:
            return True, url
    return False, ""


def build_poster_from_fanart(fanart_path: Path, poster_path: Path, overwrite: bool) -> bool:
    if not fanart_path.exists():
        return False
    if poster_path.exists() and not overwrite:
        return True

    poster_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(fanart_path) as image:
        image = image.convert("RGB")
        width, height = image.size
        target_width, target_height = POSTER_SIZE
        target_ratio = target_width / target_height
        source_ratio = width / height
        if source_ratio > target_ratio:
            crop_width = max(1, int(height * target_ratio))
            left = max(0, width - crop_width)
            crop_box = (left, 0, width, height)
        else:
            crop_height = max(1, int(width / target_ratio))
            top = max(0, (height - crop_height) // 2)
            crop_box = (0, top, width, min(height, top + crop_height))
        cropped = image.crop(crop_box)
        resample = getattr(Image, "Resampling", Image).LANCZOS
        cropped = cropped.resize(POSTER_SIZE, resample)
        cropped.save(poster_path, quality=95)
    return True


def print_image_debug(
    info: MovieInfo,
    images: list[ImageCandidate],
    sample_images: list[ImageCandidate],
) -> None:
    print(f"  parsed title: {info.title or '(none)'}")
    print(f"  parsed release_date: {info.release_date or '(none)'}")
    print(f"  parsed runtime: {info.runtime or '(none)'}")
    print(f"  parsed director: {info.director or '(none)'}")
    print(f"  parsed studio: {info.studio or '(none)'}")
    print(f"  parsed label: {info.label or '(none)'}")
    print(f"  parsed set: {info.series or '(none)'}")
    print(f"  parsed actors: {', '.join(info.actors) or '(none)'}")
    print(f"  parsed genres: {', '.join(info.genres) or '(none)'}")
    print(f"  chosen poster: {info.poster_url or '(none)'}")
    print(f"  chosen fanart: {info.fanart_url or '(none)'}")
    print(f"  sample-waterfall images: {len(sample_images)}")
    for index, image in enumerate(sample_images, 1):
        size = f"{image.width}x{image.height}" if image.width and image.height else "unknown"
        print(f"  sample image {index:02d}: {size} {image.url}")
    for index, image in enumerate(images, 1):
        size = f"{image.width}x{image.height}" if image.width and image.height else "unknown"
        print(f"  image candidate {index:02d}: {size} {image.url}")


def write_nfo(info: MovieInfo, output_file: Path) -> None:
    movie = ET.Element("movie")
    add_text(movie, "title", info.title)
    add_text(movie, "originaltitle", info.original_title)
    add_text(movie, "sorttitle", info.code)
    add_text(movie, "num", info.code)
    add_text(movie, "outline", info.outline or info.plot)
    add_text(movie, "plot", info.plot)
    add_text(movie, "id", info.code)
    unique_id = ET.SubElement(movie, "uniqueid", {"type": "dmmsee", "default": "true"})
    unique_id.text = info.code
    add_text(movie, "premiered", info.release_date)
    add_text(movie, "releasedate", info.release_date)
    add_text(movie, "year", info.release_date[:4] if re.match(r"^\d{4}", info.release_date) else "")
    add_text(movie, "runtime", info.runtime)
    add_text(movie, "studio", info.studio or info.maker or info.label)
    add_text(movie, "maker", info.maker or info.studio)
    add_text(movie, "label", info.label)
    add_text(movie, "director", info.director)
    add_text(movie, "set", info.series)
    add_text(movie, "country", info.country)
    add_text(movie, "website", info.url)
    if info.poster_file:
        ET.SubElement(movie, "thumb", {"aspect": "poster"}).text = info.poster_file
    if info.fanart_file:
        ET.SubElement(movie, "fanart").text = info.fanart_file
    for preview_file in info.preview_files:
        ET.SubElement(movie, "thumb", {"aspect": "preview"}).text = preview_file
    for genre in info.genres:
        add_text(movie, "genre", genre)
        add_text(movie, "tag", genre)
    for actor in info.actors:
        actor_node = ET.SubElement(movie, "actor")
        add_text(actor_node, "name", actor)
        add_text(actor_node, "type", "Actor")

    indent_xml(movie)
    tree = ET.ElementTree(movie)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    tree.write(output_file, encoding="utf-8", xml_declaration=True)


def add_text(parent: ET.Element, tag: str, value: str) -> None:
    if value:
        ET.SubElement(parent, tag).text = normalize_space(value)


def extract_minutes(value: str) -> str:
    match = re.search(r"\d+", value or "")
    return match.group(0) if match else ""


def indent_xml(elem: ET.Element, level: int = 0) -> None:
    indent = "\n" + level * "  "
    if len(elem):
        if not elem.text or not elem.text.strip():
            elem.text = indent + "  "
        for child in elem:
            indent_xml(child, level + 1)
        if not child.tail or not child.tail.strip():
            child.tail = indent
    if level and (not elem.tail or not elem.tail.strip()):
        elem.tail = indent


def scrape_one(page, session: requests.Session, code: str, args: argparse.Namespace) -> None:
    page_url = f"{args.base_url.rstrip('/')}/{code}"
    item_dir = Path(args.output) / code
    nfo_path = item_dir / f"{code}.nfo"
    print(f"[{code}] loading {page_url}")

    html = fetch_html(page, page_url, args.timeout_ms)
    loaded_images = collect_loaded_images(page, page_url)
    sample_images = collect_sample_images(page, page_url)
    info = parse_page(code, page_url, html, loaded_images, sample_images)
    if args.debug_images:
        print_image_debug(info, loaded_images, sample_images)
    sync_browser_cookies(page.context, session)
    info.poster_file = jpg_name(f"{code}-poster") if info.poster_url else ""
    info.cover_file = jpg_name(code) if info.poster_url else ""
    info.fanart_file = jpg_name(f"{code}-fanart") if info.fanart_url else ""
    info.preview_files = [
        str(Path("extrafanart") / jpg_name(f"extrafanart-{index}"))
        for index, preview_url in enumerate(info.preview_urls, 1)
    ]
    write_nfo(info, nfo_path)
    print(f"  nfo: {nfo_path}")

    fanart_ok = False
    if info.fanart_url:
        fanart_ok = download_with_resume(
            session,
            info.fanart_url,
            item_dir / info.fanart_file,
            page_url,
            args.retries,
            args.overwrite,
        )
        print(f"  fanart: {'ok' if fanart_ok else 'failed'}")
    else:
        print("  fanart: not found")

    if info.poster_file:
        poster_target = item_dir / info.poster_file
        poster_ok = build_poster_from_fanart(item_dir / info.fanart_file, poster_target, args.overwrite)
        copy_if_needed(poster_target, item_dir / info.cover_file, args.overwrite)
        print(f"  poster: {'ok' if poster_ok else 'failed'}")

    for index, preview_url in enumerate(info.preview_urls, 1):
        target = item_dir / info.preview_files[index - 1]
        ok = download_with_resume(session, preview_url, target, page_url, args.retries, args.overwrite)
        print(f"  preview-{index:02d}: {'ok' if ok else 'failed'}")


def main() -> int:
    args = parse_args()
    if sync_playwright is None:
        print(
            "Missing dependency: playwright. Run `python3 -m pip install -r requirements.txt` "
            "and `python3 -m playwright install chromium`.",
            file=sys.stderr,
        )
        return 2

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 2

    codes = load_codes(input_path)
    if not codes:
        print(f"No codes found in {input_path}", file=sys.stderr)
        return 2

    session = build_session()
    Path(args.output).mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed)
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1440, "height": 1200},
            locale="zh-CN",
            ignore_https_errors=True,
        )
        page = context.new_page()
        for code in codes:
            try:
                scrape_one(page, session, code, args)
            except Exception as exc:
                print(f"[{code}] failed: {exc}", file=sys.stderr)
            time.sleep(args.delay)
        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
