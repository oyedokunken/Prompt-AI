"""The provider interface.

Pipeline code only ever talks to this interface. Adding or swapping a
model provider means writing one new class, nothing in core/pipeline or
routers changes.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal, Optional


@dataclass(frozen=True)
class ProviderMessage:
    """One provider neutral conversation turn."""

    role: Literal["user", "assistant"]
    text: str
    # Image data URLs sent alongside the text as real model context.
    images: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class SearchSource:
    title: str
    url: str


@dataclass(frozen=True)
class SearchOutcome:
    """What a web search found: the findings as text, and where they came from."""

    summary: str
    sources: list[SearchSource] = field(default_factory=list)


class ProviderError(Exception):
    """The provider call itself failed: auth, rate limit, network, timeout."""

    def __init__(self, message: str, *, status: Optional[int] = None, code: Optional[str] = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code


class ProviderResponseError(Exception):
    """The provider answered, but not with something usable."""


class ModelProvider(ABC):
    name: str

    @abstractmethod
    def resolve_model(self, requested: str, *, fast: bool = False) -> str:
        """Map the model a user selected onto one this provider can run."""

    @abstractmethod
    async def complete_json(
        self,
        *,
        model: str,
        system: str,
        messages: list[ProviderMessage],
        max_tokens: int,
        temperature: float,
    ) -> dict[str, Any]:
        """Run a completion that must return a single JSON object."""

    @abstractmethod
    async def complete_text(
        self,
        *,
        model: str,
        system: str,
        messages: list[ProviderMessage],
        max_tokens: int,
        temperature: float,
    ) -> str:
        """Run a completion that returns plain text."""

    @abstractmethod
    async def search(self, *, model: str, query: str) -> SearchOutcome:
        """Search the web for current information and report what was found."""

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Turn texts into vectors, one per text, for similarity comparison."""

    @abstractmethod
    async def transcribe(self, *, filename: str, content: bytes, content_type: str) -> str:
        """Transcribe recorded audio to text."""
