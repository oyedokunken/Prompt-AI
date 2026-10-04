"""Loads versioned prompt templates.

Templates live in templates/<version>/<name>.md. A change to prompt
wording is made by adding a new version directory and moving
ACTIVE_VERSION, so every result can be traced back to the exact wording
that produced it. Run evaluation/run_eval.py before and after any change.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

TEMPLATES_DIR = Path(__file__).parent / "templates"
ACTIVE_VERSION = "v6"
TEMPLATE_NAMES = ("intent", "construct", "answer", "title")


class TemplateNotFoundError(Exception):
    pass


@lru_cache
def load_template(name: str, version: str = ACTIVE_VERSION) -> str:
    path = TEMPLATES_DIR / version / f"{name}.md"
    if not path.is_file():
        raise TemplateNotFoundError(f"No template named '{name}' in version '{version}'")
    return path.read_text(encoding="utf-8").strip()


def available_versions() -> list[str]:
    return sorted(p.name for p in TEMPLATES_DIR.iterdir() if p.is_dir())


def validate_templates(version: str = ACTIVE_VERSION) -> None:
    """Called at startup so a missing template fails the deploy, not a request."""
    for name in TEMPLATE_NAMES:
        load_template(name, version)
