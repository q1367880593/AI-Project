from __future__ import annotations

import shutil
import os
import re
import tomllib
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .domain import Target


class ConfigError(ValueError):
    pass


ENV_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


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


def ensure_env(path: Path, example_path: Path | None = None) -> bool:
    if path.exists():
        return False
    source = example_path or Path(".env.example")
    if not source.exists():
        raise ConfigError(f"环境变量样例不存在：{source}")
    path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, path)
    return True


def load_dotenv(path: str | Path = ".env", override: bool = False) -> bool:
    env_path = Path(path)
    if not env_path.exists():
        return False
    try:
        lines = env_path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError as error:
        raise ConfigError(f".env 必须使用 UTF-8 编码：{env_path}") from error

    for line_number, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            raise ConfigError(f"{env_path}:{line_number} 缺少等号")
        name, raw_value = line.split("=", 1)
        name = name.strip()
        if not ENV_NAME_PATTERN.fullmatch(name):
            raise ConfigError(f"{env_path}:{line_number} 环境变量名无效：{name}")
        value = _parse_env_value(raw_value.strip(), env_path, line_number)
        if override or name not in os.environ:
            os.environ[name] = value
    return True


def _parse_env_value(raw_value: str, path: Path, line_number: int) -> str:
    if not raw_value:
        return ""
    if raw_value[0] in {"'", '"'}:
        quote = raw_value[0]
        if len(raw_value) < 2 or raw_value[-1] != quote:
            raise ConfigError(f"{path}:{line_number} 引号未闭合")
        value = raw_value[1:-1]
        if quote == '"':
            value = (
                value.replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\t", "\t")
                .replace('\\"', '"')
                .replace("\\\\", "\\")
            )
        return value
    return raw_value.split(" #", 1)[0].rstrip()


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
