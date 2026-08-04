from __future__ import annotations

import shutil
import tomllib
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .domain import Target


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class AppConfig:
    path: Path
    timezone: str
    report_dir: Path
    database_path: Path
    search: dict
    crawler: dict
    analysis: dict
    report: dict
    targets: tuple[Target, ...]


def ensure_config(path: Path, example_path: Path | None = None) -> None:
    if path.exists():
        return
    source = example_path or Path("config/config.example.toml")
    if not source.exists():
        raise ConfigError(f"配置不存在：{path}，且找不到示例配置：{source}")
    path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, path)


def load_config(path: str | Path = "config/config.toml") -> AppConfig:
    config_path = Path(path)
    if not config_path.exists():
        raise ConfigError(
            f"配置文件不存在：{config_path}。请复制 config/config.example.toml 后修改。"
        )
    with config_path.open("rb") as config_file:
        data = tomllib.load(config_file)

    app = data.get("app", {})
    timezone = str(app.get("timezone", "Asia/Shanghai"))
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError as error:
        raise ConfigError(f"无效时区：{timezone}") from error

    raw_targets = data.get("targets", [])
    targets: list[Target] = []
    slugs: set[str] = set()
    for raw in raw_targets:
        slug = str(raw.get("slug", "")).strip()
        name = str(raw.get("name", "")).strip()
        if not slug or not name:
            raise ConfigError("每个 target 必须包含非空 slug 和 name")
        if slug in slugs:
            raise ConfigError(f"target slug 重复：{slug}")
        slugs.add(slug)
        keywords = tuple(
            dict.fromkeys(
                [name]
                + [str(item).strip() for item in raw.get("keywords_en", [])]
                + [str(item).strip() for item in raw.get("keywords_zh", [])]
            )
        )
        targets.append(
            Target(
                slug=slug,
                name=name,
                type=str(raw.get("type", "topic")),
                enabled=bool(raw.get("enabled", True)),
                keywords=tuple(item for item in keywords if item),
            )
        )
    if not targets:
        raise ConfigError("至少需要配置一个 target")

    return AppConfig(
        path=config_path,
        timezone=timezone,
        report_dir=Path(app.get("report_dir", "reports")),
        database_path=Path(app.get("database_path", "database/research.db")),
        search=data.get("search", {}),
        crawler=data.get("crawler", {}),
        analysis=data.get("analysis", {}),
        report=data.get("report", {}),
        targets=tuple(targets),
    )

