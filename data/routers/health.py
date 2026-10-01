"""GET /health, unauthenticated, used by Render and the keep alive workflow."""

from __future__ import annotations

from fastapi import APIRouter

from core.prompts.loader import ACTIVE_VERSION
from schemas.responses import HealthResponse

router = APIRouter()

SERVICE_VERSION = "1.0.0"


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(version=SERVICE_VERSION, template_version=ACTIVE_VERSION)
