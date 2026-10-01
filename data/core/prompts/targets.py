"""Output formatting for the generated prompt, chosen per destination.

The prompt a user copies is pasted somewhere else, and not every tool
renders markdown. Headers, asterisks and tables show up as literal symbols
in many of them. So the default is clean, lightweight structure, and
heavier formatting is used only where the destination is known to benefit.
"""

from __future__ import annotations

import re
from typing import Literal

FormatStyle = Literal["plain", "markdown", "xml"]

# The user named a destination that renders markdown, or asked for it.
_MARKDOWN_SIGNALS = re.compile(
    r"\bmarkdown\b|\.md\b|\breadme\b|\bnotion\b|\bobsidian\b|\bgithub (issue|pr|pull request|wiki)\b|\bdocs? site\b|\bmkdocs\b",
    re.IGNORECASE,
)

GUIDANCE: dict[FormatStyle, str] = {
    "plain": (
        "OUTPUT FORMATTING FOR THE PROMPT YOU WRITE\n"
        "The prompt will be copied and pasted into another tool that may not render markdown, so write it as clean plain text.\n"
        "- Label each section with a short plain heading on its own line, such as Role, Context, Task, Rules, Output format. No pound signs, no asterisks, no underscores for emphasis, no tables, no code fences, no horizontal rules.\n"
        "- Separate sections with one blank line.\n"
        "- Use simple hyphen lists or numbered lists where a list helps. Keep each item to one or two sentences.\n"
        "- Emphasis comes from wording, such as \"Never\" or \"Always\", not from symbols.\n"
        "- The only exception is a snippet of code or data the prompt must contain verbatim, keep that exactly as it is."
    ),
    "markdown": (
        "OUTPUT FORMATTING FOR THE PROMPT YOU WRITE\n"
        "The destination renders markdown, or the user asked for it, so markdown is appropriate. Use headers, bold labels and lists where they make the prompt clearer, and do not decorate beyond that."
    ),
    "xml": (
        "OUTPUT FORMATTING FOR THE PROMPT YOU WRITE\n"
        "The destination is a model that follows tagged sections well. Wrap each section in a simple tag on its own lines, for example <role>, <context>, <task>, <rules>, <output_format>. Inside the tags use plain text and simple hyphen lists. No markdown headers, no asterisks, no tables."
    ),
}


def choose_format(target_model: str, request_text: str) -> FormatStyle:
    """Pick the output style from what the user asked for and where it is going."""
    if _MARKDOWN_SIGNALS.search(request_text):
        return "markdown"
    if target_model.lower().startswith("claude"):
        return "xml"
    return "plain"
