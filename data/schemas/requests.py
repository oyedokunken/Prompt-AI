"""Request models for every /data endpoint.

/data has no database. Everything it knows about a user arrives here, in
the request body, sent by /api.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    """The stored profile fields /api reads from the user's account."""

    preferred_name: Optional[str] = None
    role: Optional[str] = None
    about: Optional[str] = None
    working_on: Optional[str] = None
    primary_use: Optional[str] = None


class Memory(BaseModel):
    category: str
    key: str
    value: str


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class Attachment(BaseModel):
    name: str
    type: str = ""
    # Images arrive as a data URL, and are read by the vision model.
    data_url: Optional[str] = None
    # PDF and Word documents arrive as base64 file bytes, and are read by
    # text extraction. /api fetches them, /data never touches storage.
    content_base64: Optional[str] = None


class ClarifyQuestion(BaseModel):
    id: str
    text: str
    # Omitted for open ended questions, which render as a text input.
    options: Optional[list[str]] = None
    multiple: bool = False


class ClarifyAnswer(BaseModel):
    question_id: str
    answer: str


class SourceLink(BaseModel):
    title: str = ""
    url: str


class SourceNote(BaseModel):
    """Something /data read or looked up to build the prompt.

    Attachments and web searches share this shape so they flow through the
    same context assembly, and are shown to the user the same way.
    """

    kind: Literal["attachment", "search"]
    # The file name, or the search query.
    label: str
    # What was found, in a sentence or two, shown to the user.
    summary: str = ""
    # The extracted text or findings handed to the model. Never sent back
    # to the browser, only carried in the clarify state between turns.
    content: str = ""
    links: list[SourceLink] = Field(default_factory=list)


class ClarifyState(BaseModel):
    """The whole clarifying sequence for one request.

    /data is stateless, so this travels out in a response, is persisted by
    /api, and comes back in with the user's next message.
    """

    original_message: str
    intro: str = ""
    questions: list[ClarifyQuestion] = Field(default_factory=list)
    answers: list[ClarifyAnswer] = Field(default_factory=list)
    # Attachment text read on the first turn and the searches planned then,
    # kept here so the rest of the sequence builds on the same material.
    sources: list[SourceNote] = Field(default_factory=list)
    search_queries: list[str] = Field(default_factory=list)


class GenerateRequest(BaseModel):
    message: str = Field(..., min_length=1)
    # The target model the user selected in the interface.
    model: str = "gpt-4o"
    profile: UserProfile = Field(default_factory=UserProfile)
    memories: list[Memory] = Field(default_factory=list)
    # Prior turns only, oldest first, not including `message`.
    history: list[HistoryMessage] = Field(default_factory=list)
    attachments: list[Attachment] = Field(default_factory=list)
    clarify_state: Optional[ClarifyState] = None
    # True when `message` was submitted through the question interface, so
    # it is known to be the answer to the pending question.
    is_clarify_answer: bool = False


class TitleRequest(BaseModel):
    # The first message or two of a conversation, oldest first.
    messages: list[str] = Field(..., min_length=1, max_length=4)
