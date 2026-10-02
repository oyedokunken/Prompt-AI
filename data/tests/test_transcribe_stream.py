"""Tests for the live transcription socket and its tickets. No network, the
OpenAI side is a scripted fake."""

from __future__ import annotations

import asyncio
import os
import struct
import sys
from pathlib import Path
from typing import Any

os.environ["OPENAI_API_KEY"] = "sk-test_aaaaaaaaaaaaaaaaaaaaaaaaaaaa"
os.environ["API_SHARED_SECRET"] = "unit-test-shared-secret"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

from core import ticket  # noqa: E402
from main import app  # noqa: E402
from routers import transcribe_stream as ts  # noqa: E402

SECRET = "unit-test-shared-secret"


def test_ticket_round_trip_and_single_use():
    t = ticket.mint(SECRET, "user-1", now=1000)
    assert ticket.redeem(SECRET, t, now=1001) == "user-1"
    assert ticket.redeem(SECRET, t, now=1002) is None


def test_ticket_expires_and_rejects_tampering():
    t = ticket.mint(SECRET, "user-2", now=1000)
    assert ticket.redeem(SECRET, t, now=1000 + ticket.TICKET_TTL_SECONDS + 5) is None
    fresh = ticket.mint(SECRET, "user-3", now=2000)
    forged = fresh.replace("user-3", "user-4", 1)
    assert ticket.redeem(SECRET, forged, now=2001) is None
    assert ticket.redeem("other-secret", ticket.mint(SECRET, "user-5", now=3000), now=3001) is None
    assert ticket.redeem(SECRET, "garbage", now=1) is None


def pcm(level: int, ms: int) -> bytes:
    n = 24 * ms
    return struct.pack("<" + "h" * n, *([level, -level] * (n // 2)))


def test_frame_level_separates_speech_from_silence():
    assert ts.frame_level(pcm(0, 50)) == 0
    assert ts.frame_level(pcm(4000, 50)) > ts.QUIET_LEVEL
    assert ts.frame_level(b"") == 0


def test_phrase_is_closed_at_a_dip_after_the_soft_limit_and_always_at_the_hard_limit():
    bps = ts.BYTES_PER_SECOND
    quiet = int(ts.QUIET_RUN_SECONDS * bps)
    assert not ts.should_close_phrase(False, 10 * bps, quiet)
    assert not ts.should_close_phrase(True, 1 * bps, quiet)
    assert not ts.should_close_phrase(True, 3 * bps, 0)
    assert ts.should_close_phrase(True, 3 * bps, quiet)
    assert ts.should_close_phrase(True, 6 * bps, 0)


class FakeUpstream(ts.Upstream):
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []
        self.inbox: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self.closed = False

    async def send(self, event: dict[str, Any]) -> None:
        self.sent.append(event)
        kind = event["type"]
        if kind == "session.update":
            await self.inbox.put({"type": "session.updated"})
        elif kind == "input_audio_buffer.append" and sum(1 for e in self.sent if e["type"] == "input_audio_buffer.append") == 1:
            await self.inbox.put({"type": "input_audio_buffer.speech_started"})
        elif kind == "input_audio_buffer.commit":
            await self.inbox.put({"type": "input_audio_buffer.committed", "item_id": "i1", "previous_item_id": None})
            await self.inbox.put({"type": "conversation.item.input_audio_transcription.delta", "item_id": "i1", "delta": "hello"})
            await self.inbox.put({"type": "conversation.item.input_audio_transcription.completed", "item_id": "i1", "transcript": "hello world"})

    async def recv(self) -> dict[str, Any]:
        return await self.inbox.get()

    async def close(self) -> None:
        self.closed = True


@pytest.fixture
def fake_upstream(monkeypatch):
    fake = FakeUpstream()

    async def factory() -> ts.Upstream:
        return fake

    monkeypatch.setattr(ts, "upstream_factory", factory)
    return fake


def test_socket_rejects_a_missing_or_bad_ticket(fake_upstream):
    client = TestClient(app)
    with client.websocket_connect("/transcribe/stream") as ws:
        ws.send_json({"type": "auth", "ticket": "nope"})
        assert ws.receive_json()["type"] == "error"
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()
    assert fake_upstream.sent == []


def test_socket_streams_audio_up_and_text_down_and_flushes_on_stop(fake_upstream):
    client = TestClient(app)
    with client.websocket_connect("/transcribe/stream") as ws:
        ws.send_json({"type": "auth", "ticket": ticket.mint(SECRET, "user-ws")})
        assert ws.receive_json()["type"] == "ready"
        ws.send_bytes(pcm(3000, 100))
        ws.send_json({"type": "stop"})
        seen = []
        while True:
            message = ws.receive_json()
            seen.append(message)
            if message["type"] == "done":
                break
    kinds = [m["type"] for m in seen]
    assert "delta" in kinds and "final" in kinds
    final = next(m for m in seen if m["type"] == "final")
    assert final["text"] == "hello world"
    assert seen[-1]["seconds"] == pytest.approx(0.1, abs=0.01)
    appends = [e for e in fake_upstream.sent if e["type"] == "input_audio_buffer.append"]
    assert len(appends) == 1
    assert fake_upstream.sent[0]["session"]["audio"]["input"]["transcription"]["model"] == "gpt-4o-mini-transcribe"
    assert fake_upstream.closed


def test_a_session_over_the_cap_is_cut_off(fake_upstream, monkeypatch):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "realtime_max_seconds", 1)
    client = TestClient(app)
    with client.websocket_connect("/transcribe/stream") as ws:
        ws.send_json({"type": "auth", "ticket": ticket.mint(SECRET, "user-cap")})
        assert ws.receive_json()["type"] == "ready"
        for _ in range(15):
            ws.send_bytes(pcm(3000, 100))
        messages = []
        while True:
            m = ws.receive_json()
            messages.append(m)
            if m["type"] == "done":
                break
    assert any(m["type"] == "error" and "limit" in m["message"] for m in messages)
    sent = [e for e in fake_upstream.sent if e["type"] == "input_audio_buffer.append"]
    assert len(sent) <= 11
