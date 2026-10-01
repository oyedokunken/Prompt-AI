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
    # Present only for images, which are sent to the model as real context.
    data_url: Optional[str] = None


class ClarifyQuestion(BaseModel):
    id: str
    text: str
    # Omitted for open ended questions, which render as a text input.
    options: Optional[list[str]] = None
    multiple: bool = False


class ClarifyAnswer(BaseModel):
    question_id: str
    answer: str


class ClarifyState(BaseModel):
    """The whole clarifying sequence for one request.

    /data is stateless, so this travels out in a response, is persisted by
    /api, and comes back in with the user's next message.
    """

    original_message: str
    intro: str = ""
    questions: list[ClarifyQuestion] = Field(default_factory=list)
    answers: list[ClarifyAnswer] = Field(default_factory=list)


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
