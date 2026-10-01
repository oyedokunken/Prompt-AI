"""Shared secret check. /api is the only caller this service accepts."""

from __future__ import annotations

import hmac

from fastapi import HTTPException, Request

from config import get_settings


def require_shared_secret(request: Request) -> None:
    header = request.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else ""
    expected = get_settings().api_shared_secret
    if not token or not hmac.compare_digest(token.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")
