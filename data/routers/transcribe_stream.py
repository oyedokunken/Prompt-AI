"""WS /transcribe/stream, live transcription while the user is still speaking.

The browser sends raw 24kHz mono 16 bit PCM frames. This service relays them
to OpenAI's realtime transcription socket and relays the partial and final
text back. It is the only place that talks to OpenAI, as with every other
model call, and the browser never sees the API key.

Wire format with the browser:
    client -> {"type": "auth", "ticket": "..."}   first message, a ticket minted by /api
    client -> binary frames of PCM16 audio
    client -> {"type": "stop"}                    finish and flush
    server -> {"type": "ready"}
    server -> {"type": "order", "itemId", "previousItemId"}
    server -> {"type": "delta", "itemId", "text"}  a piece of a phrase still being decoded
    server -> {"type": "final", "itemId", "text"}  the finished text of a phrase
    server -> {"type": "done", "seconds"}
    server -> {"type": "error", "message"}

Cost controls: audio is billed by how much is sent, not by how long the socket
stays open, so a hard cap on seconds per session, an idle timeout and the
cheaper transcription model are what keep this predictable.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import sys
import time
from array import array
from typing import Any, Awaitable, Callable, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import get_settings
from core import ticket as tickets
from core import usage

logger = logging.getLogger("data.transcribe_stream")

router = APIRouter()

SAMPLE_RATE = 24_000
BYTES_PER_SECOND = SAMPLE_RATE * 2
REALTIME_URL = "wss://api.openai.com/v1/realtime?intent=transcription"
AUTH_TIMEOUT_SECONDS = 10
IDLE_TIMEOUT_SECONDS = 20
FLUSH_TIMEOUT_SECONDS = 8
# A continuous model sends text a moment behind the audio, so after a stop the
# last words are waited for until nothing new has arrived for a short while.
SETTLE_QUIET_SECONDS = 0.6
SETTLE_MAX_SECONDS = 2.5

# Server side voice detection only closes a phrase at a pause, so a long run of
# speech would show nothing until the speaker breathes. These settings close a
# phrase early at the next small dip in volume, so text keeps arriving.
SEGMENT_SOFT_SECONDS = 1.5
SEGMENT_HARD_SECONDS = 3.2
QUIET_LEVEL = 350
QUIET_RUN_SECONDS = 0.12

# USD per minute of audio, from the list price of each transcription model.
PRICE_PER_MINUTE = {
    "gpt-realtime-whisper": 0.017,
    "gpt-live-transcribe": 0.017,
    "gpt-4o-mini-transcribe": 0.003,
    "gpt-4o-transcribe": 0.006,
    "whisper-1": 0.006,
}


class Upstream:
    """The socket to OpenAI. A small seam so tests can stand in for it."""

    async def send(self, event: dict[str, Any]) -> None:
        raise NotImplementedError

    async def recv(self) -> dict[str, Any]:
        raise NotImplementedError

    async def close(self) -> None:
        raise NotImplementedError


class OpenAIUpstream(Upstream):
    def __init__(self, ws: Any) -> None:
        self._ws = ws

    async def send(self, event: dict[str, Any]) -> None:
        await self._ws.send(json.dumps(event))

    async def recv(self) -> dict[str, Any]:
        return json.loads(await self._ws.recv())

    async def close(self) -> None:
        await self._ws.close()


async def open_openai_upstream() -> Upstream:
    from websockets.asyncio.client import connect

    settings = get_settings()
    ws = await connect(
        REALTIME_URL,
        additional_headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
        },
        open_timeout=10,
        max_size=2**22,
    )
    return OpenAIUpstream(ws)


# Replaced in tests.
UpstreamFactory = Callable[[], Awaitable[Upstream]]
upstream_factory: UpstreamFactory = open_openai_upstream


def is_continuous_model(model: str) -> bool:
    """Models that decode continuously as audio arrives, with no turn detection.

    They reject turn detection settings and send text while the speaker is
    still talking, instead of after each phrase closes.
    """
    return "live" in model or "realtime-whisper" in model


def session_config(model: str, language: Optional[str]) -> dict[str, Any]:
    transcription: dict[str, Any] = {"model": model}
    if language:
        transcription["language"] = language
    input_config: dict[str, Any] = {
        "format": {"type": "audio/pcm", "rate": SAMPLE_RATE},
        "transcription": transcription,
        "noise_reduction": {"type": "near_field"},
    }
    if not is_continuous_model(model):
        input_config["turn_detection"] = {
            "type": "server_vad",
            "threshold": 0.5,
            "prefix_padding_ms": 300,
            "silence_duration_ms": 250,
        }
    return {
        "type": "session.update",
        "session": {"type": "transcription", "audio": {"input": input_config}},
    }


def frame_level(data: bytes) -> int:
    """Rough loudness of a PCM16 frame, the mean absolute sample, sampling every 4th."""
    usable = len(data) - (len(data) % 2)
    if usable <= 0:
        return 0
    samples = array("h", data[:usable])
    if sys.byteorder == "big":
        samples.byteswap()
    picked = samples[::4]
    return sum(abs(v) for v in picked) // max(len(picked), 1)


def should_close_phrase(
    speaking: bool, segment_bytes: int, quiet_bytes: int,
) -> bool:
    """Whether a run of continuous speech should be closed now so its text can appear."""
    if not speaking:
        return False
    if segment_bytes >= SEGMENT_HARD_SECONDS * BYTES_PER_SECOND:
        return True
    return (
        segment_bytes >= SEGMENT_SOFT_SECONDS * BYTES_PER_SECOND
        and quiet_bytes >= QUIET_RUN_SECONDS * BYTES_PER_SECOND
    )


async def _send(ws: WebSocket, payload: dict[str, Any]) -> bool:
    try:
        await ws.send_text(json.dumps(payload))
        return True
    except Exception:
        return False


@router.websocket("/transcribe/stream")
async def transcribe_stream(ws: WebSocket) -> None:
    settings = get_settings()
    await ws.accept()

    try:
        first = await asyncio.wait_for(ws.receive_text(), timeout=AUTH_TIMEOUT_SECONDS)
        message = json.loads(first)
    except (asyncio.TimeoutError, WebSocketDisconnect, ValueError):
        await ws.close(code=4401)
        return
    user_id = (
        tickets.redeem(settings.api_shared_secret, str(message.get("ticket", "")))
        if message.get("type") == "auth"
        else None
    )
    if not user_id:
        await _send(ws, {"type": "error", "message": "Not authorised"})
        await ws.close(code=4401)
        return

    model = settings.openai_realtime_transcribe_model
    max_seconds = settings.realtime_max_seconds
    language = message.get("language") if isinstance(message.get("language"), str) else None

    try:
        upstream = await upstream_factory()
        await upstream.send(session_config(model, language))
    except Exception as exc:
        logger.error("could not open the transcription socket: %s", exc)
        await _send(ws, {"type": "error", "message": "Live transcription is unavailable"})
        await ws.close(code=1011)
        return

    state = {"bytes": 0, "speaking": False, "stopping": False, "segment_start": 0, "quiet": 0, "last_text": 0.0}
    continuous = is_continuous_model(model)
    pending: set[str] = set()
    committed_at: dict[str, float] = {}
    drained = asyncio.Event()
    drained.set()

    async def pump_upstream() -> None:
        try:
            while True:
                event = await upstream.recv()
                kind = event.get("type", "")
                if kind in ("session.created", "session.updated"):
                    await _send(ws, {"type": "ready"})
                elif kind == "input_audio_buffer.speech_started":
                    state["speaking"] = True
                    state["segment_start"] = state["bytes"]
                elif kind == "input_audio_buffer.speech_stopped":
                    state["speaking"] = False
                elif kind == "input_audio_buffer.committed":
                    item_id = event.get("item_id", "")
                    pending.add(item_id)
                    committed_at[item_id] = time.monotonic()
                    drained.clear()
                    state["segment_start"] = state["bytes"]
                    await _send(ws, {"type": "order", "itemId": item_id, "previousItemId": event.get("previous_item_id")})
                elif kind == "conversation.item.input_audio_transcription.delta":
                    state["last_text"] = time.monotonic()
                    await _send(ws, {"type": "delta", "itemId": event.get("item_id", ""), "text": event.get("delta", "")})
                elif kind == "conversation.item.input_audio_transcription.completed":
                    item_id = event.get("item_id", "")
                    pending.discard(item_id)
                    started = committed_at.pop(item_id, None)
                    if started is not None:
                        logger.info("phrase decoded in %.0f ms, %d chars", (time.monotonic() - started) * 1000, len(event.get("transcript") or ""))
                    await _send(ws, {"type": "final", "itemId": item_id, "text": (event.get("transcript") or "").strip()})
                    if not pending:
                        drained.set()
                elif kind == "conversation.item.input_audio_transcription.failed":
                    pending.discard(event.get("item_id", ""))
                    if not pending:
                        drained.set()
                elif kind == "error":
                    code = (event.get("error") or {}).get("code")
                    # An empty buffer on a final commit is expected, not a failure.
                    if code != "input_audio_buffer_commit_empty":
                        logger.error("realtime error code=%s message=%s", code, (event.get("error") or {}).get("message"))
                        await _send(ws, {"type": "error", "message": "Transcription failed"})
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # The upstream closed. If the client is finishing, that is fine.
            logger.warning("upstream socket closed: %s", exc)
            drained.set()

    async def pump_client() -> None:
        try:
            while True:
                incoming = await asyncio.wait_for(ws.receive(), timeout=IDLE_TIMEOUT_SECONDS)
                if incoming.get("type") == "websocket.disconnect":
                    break
                data = incoming.get("bytes")
                if data:
                    state["bytes"] += len(data)
                    if state["bytes"] / BYTES_PER_SECOND > max_seconds:
                        await _send(ws, {"type": "error", "message": "Recording limit reached"})
                        break
                    await upstream.send({"type": "input_audio_buffer.append", "audio": base64.b64encode(data).decode()})
                    state["quiet"] = state["quiet"] + len(data) if frame_level(data) < QUIET_LEVEL else 0
                    if not continuous and should_close_phrase(state["speaking"], state["bytes"] - state["segment_start"], state["quiet"]):
                        state["segment_start"] = state["bytes"]
                        state["quiet"] = 0
                        await upstream.send({"type": "input_audio_buffer.commit"})
                    continue
                text = incoming.get("text")
                if text and json.loads(text).get("type") == "stop":
                    break
        except (asyncio.TimeoutError, WebSocketDisconnect, ValueError):
            pass

    upstream_task = asyncio.create_task(pump_upstream())
    try:
        await pump_client()
        state["stopping"] = True
        if state["speaking"] and state["bytes"]:
            await upstream.send({"type": "input_audio_buffer.commit"})
            await asyncio.sleep(0.05)
        if continuous:
            # Text trails the audio by a moment. Give the last words time to
            # arrive, and stop waiting once nothing new has come for a beat.
            deadline = time.monotonic() + SETTLE_MAX_SECONDS
            while time.monotonic() < deadline and time.monotonic() - state["last_text"] < SETTLE_QUIET_SECONDS:
                await asyncio.sleep(0.1)
        try:
            await asyncio.wait_for(drained.wait(), timeout=FLUSH_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            logger.warning("transcription flush timed out with %d pending", len(pending))
    except Exception as exc:
        logger.error("transcription stream failed: %s", exc)
    finally:
        seconds = state["bytes"] / BYTES_PER_SECOND
        upstream_task.cancel()
        try:
            await upstream.close()
        except Exception:
            pass
        usage.record(
            "transcribe_stream",
            model,
            extra_cost_usd=seconds / 60 * PRICE_PER_MINUTE.get(model, 0.006),
        )
        logger.info("transcribe_stream user=%s seconds=%.1f model=%s", user_id, seconds, model)
        await _send(ws, {"type": "done", "seconds": round(seconds, 1)})
        try:
            await ws.close()
        except Exception:
            pass
