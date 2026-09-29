"""
Prompt AI — /data service
FastAPI inference layer. Called only by /api.
Receives raw user input and returns a structured, scored prompt.

Auth: shared secret via Authorization: Bearer <DATA_SERVICE_API_KEY>
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import httpx

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Prompt AI — Data Service",
    description="Internal LLM orchestration layer. Not for public access.",
    version="0.1.0",
    docs_url=None,   # disable public docs in production
    redoc_url=None,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_SECRET = os.getenv("DATA_SERVICE_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
PORT = int(os.getenv("PORT", "8000"))

SYSTEM_PROMPT = """You are Prompt AI — an expert at transforming vague user requests \
into detailed, structured prompts optimised for AI tools.

Given any user input, analyse their intent and respond with a JSON object:
{
  "content": "The complete structured prompt as ready-to-use markdown",
  "score": 82,
  "assumptions": ["What you inferred that the user did not state"],
  "structured": {
    "role": "The role / persona the target AI should adopt",
    "context": "Background and relevant context",
    "constraints": ["Hard requirement 1", "Hard requirement 2"],
    "format": "Expected output format and structure"
  }
}

Scoring guide (0–100):
- 20–40  Vague, single phrase — many assumptions needed
- 41–60  Some context but key specifics are missing
- 61–80  Good detail with minor gaps filled by reasonable assumptions
- 81–100 Highly specific — little to no inferencing required

Rules:
- "content" must be a complete, production-ready prompt the user can paste into any AI tool.
- Use markdown headers, bold labels, and bullet lists inside "content".
- Always list every assumption you made, however small.
- Respond ONLY with valid JSON — no prose outside the object."""

# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
def verify_secret(request: Request) -> None:
    if not API_SECRET:
        return  # no secret configured — open (dev only)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    input: str
    model: str = "gpt-4o"


class GenerateResponse(BaseModel):
    content: str
    score: int
    assumptions: list[str]
    structured: dict[str, Any]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "prompt-ai-data"}


@app.post("/generate", response_model=GenerateResponse)
async def generate(
    body: GenerateRequest,
    _: None = Depends(verify_secret),
) -> GenerateResponse:
    """Transform raw user input into a structured, scored prompt."""
    if not body.input.strip():
        raise HTTPException(status_code=400, detail="Input must not be empty")

    if OPENAI_API_KEY:
        result = await _call_openai(body.input)
        if result:
            return GenerateResponse(**result)

    # Fallback: local heuristic builder
    return GenerateResponse(**_build_local(body.input))


# ---------------------------------------------------------------------------
# OpenAI integration
# ---------------------------------------------------------------------------
async def _call_openai(user_input: str) -> dict[str, Any] | None:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_input},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                    "max_tokens": 1500,
                },
            )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
        result = json.loads(raw)
        if result.get("content") and isinstance(result.get("score"), int):
            return result
    except Exception as exc:
        print(f"[data] OpenAI error: {exc}")
    return None


# ---------------------------------------------------------------------------
# Local heuristic fallback
# ---------------------------------------------------------------------------
def _build_local(user_input: str) -> dict[str, Any]:
    words = user_input.split()
    has_target = bool(re.search(r"\b(for|using|with|in|to)\b", user_input, re.I))
    has_format = bool(re.search(r"\b(format|markdown|json|list|table|bullet|step)\b", user_input, re.I))
    has_role = bool(re.search(r"\b(senior|junior|expert|developer|designer|engineer|manager)\b", user_input, re.I))
    has_constraint = bool(re.search(r"\b(must|should|need|require|only|never|always)\b", user_input, re.I))

    score = 35
    if len(words) > 8: score += 10
    if len(words) > 20: score += 10
    if has_target: score += 10
    if has_format: score += 10
    if has_role: score += 10
    if has_constraint: score += 10
    score = min(score, 95)

    assumptions: list[str] = []
    if not has_role: assumptions.append("Role and expertise level inferred from context")
    if not has_target: assumptions.append("Target tool assumed from common usage patterns")
    if not has_format: assumptions.append("Output format defaulted to structured text")
    if not has_constraint: assumptions.append("No explicit constraints — sensible defaults applied")

    role = "Domain expert (as referenced in input)" if has_role else "Expert assistant in the relevant domain"
    constraints = (
        ["Follow explicit requirements in the input", "Be precise and production-ready"]
        if has_constraint
        else ["Be precise and specific", "Provide actionable output", "State any remaining assumptions"]
    )
    fmt = "As specified in input" if has_format else "Structured text with clear sections"

    content = f"""## Structured Prompt

**Role:** {role}

**Context:** {user_input}

**Task:** Complete the objective described above with precision and depth. Where intent is ambiguous, choose the most professional interpretation and state the assumption explicitly.

**Constraints:**
{chr(10).join(f"- {c}" for c in constraints)}

**Output format:** {fmt}

---

**Completeness score: {score}/100**

{"**What was inferred:**" + chr(10) + chr(10).join(f"- {a}" for a in assumptions) + chr(10) + chr(10) + "Refine your input with more specifics to push this score above 80." if assumptions else "Your input is well-specified. The prompt above is ready to use."}"""

    return {
        "content": content,
        "score": score,
        "assumptions": assumptions,
        "structured": {"role": role, "context": user_input, "constraints": constraints, "format": fmt},
    }


# ---------------------------------------------------------------------------
# Entry point (local dev)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
