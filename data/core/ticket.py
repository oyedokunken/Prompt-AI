"""Short lived tickets that let a browser open the live transcription socket.

A WebSocket cannot be proxied through the serverless /api, so the browser
connects to this service directly. It still must not be an open door, so /api,
which knows who the user is, mints a ticket signed with the shared secret.
A ticket carries a user id and an expiry, is valid for under a minute and can
be used once.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from typing import Optional

TICKET_TTL_SECONDS = 60
_PURPOSE = "transcribe-stream"

# Tickets already redeemed, kept until they would have expired anyway.
_used: dict[str, float] = {}


def _sign(secret: str, payload: str) -> str:
    return hmac.new(secret.encode(), f"{_PURPOSE}:{payload}".encode(), hashlib.sha256).hexdigest()


def mint(secret: str, user_id: str, now: Optional[float] = None) -> str:
    expires = int((now if now is not None else time.time()) + TICKET_TTL_SECONDS)
    payload = f"{user_id}.{expires}"
    return f"{payload}.{_sign(secret, payload)}"


def redeem(secret: str, ticket: str, now: Optional[float] = None) -> Optional[str]:
    """Return the user id if the ticket is genuine, fresh and unused, else None."""
    current = now if now is not None else time.time()
    for key in [k for k, exp in _used.items() if exp < current]:
        del _used[key]

    parts = ticket.split(".")
    if len(parts) != 3:
        return None
    user_id, expires, signature = parts
    if not hmac.compare_digest(signature, _sign(secret, f"{user_id}.{expires}")):
        return None
    try:
        expires_at = int(expires)
    except ValueError:
        return None
    if expires_at < current or ticket in _used:
        return None
    _used[ticket] = float(expires_at)
    return user_id
