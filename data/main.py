"""Prompt AI /data service.

A stateless orchestration layer. It has no database and no user accounts.
/api sends it a user's message, profile and conversation history, and it
builds the prompt, calls the model provider, runs the clarifying question
flow, scores the result and streams it back. /api is its only caller.
"""

from __future__ import annotations

import logging
import sys

from fastapi import Depends, FastAPI
from pydantic import ValidationError

from config import get_settings
from core.prompts.loader import validate_templates
from core.security import require_shared_secret
from routers import generate, health, title, transcribe
from routers.health import SERVICE_VERSION

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("data")

# Fail fast. A missing or malformed setting stops the process here, before
# the server ever accepts a request.
try:
    settings = get_settings()
except ValidationError as exc:
    problems = "; ".join(
        f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}" for error in exc.errors()
    )
    logger.critical("Invalid environment, refusing to start: %s", problems)
    sys.exit(1)

validate_templates()

app = FastAPI(
    title="Prompt AI Data Service",
    description="Internal prompt orchestration layer. Not for public access.",
    version=SERVICE_VERSION,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.include_router(health.router)

protected = [Depends(require_shared_secret)]
app.include_router(generate.router, dependencies=protected)
app.include_router(transcribe.router, dependencies=protected)
app.include_router(title.router, dependencies=protected)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
