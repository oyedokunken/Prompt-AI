# Prompt AI, Data Service (`/data`)

This is the machine learning and LLM layer of Prompt AI. It is strictly for model inference. It has no authentication, no email, no user accounts, and no direct exposure to end users. The only caller of this service is `/api`.

This service is deployed on Render, chosen because it suits long running Python processes and model inference better than a serverless platform.

## Responsibilities

- A stateless orchestration service. It has no database and no Supabase access. /api sends every request the user's profile, memory and conversation history, and /data builds a prompt from what it is given.
- Intent detection, the one-question-at-a-time clarifying flow, prompt construction, completeness scoring and the stated versus inferred diff.
- Title inference and audio transcription.
- The only place in the whole system that calls a model provider, behind `core/providers/base.py`.

## Endpoints

All except `/health` require `Authorization: Bearer <API_SHARED_SECRET>`.

| Route | Purpose |
|---|---|
| `GET /health` | Liveness, no auth |
| `POST /generate` | Streams stage events, then one clarifying question, a direct answer, a result or an error |
| `POST /title` | Short inferred conversation title |
| `POST /transcribe` | Audio to text |

Clarifying state travels in the request and response, /api stores it between a user's answers.

## Layout

`routers/` HTTP endpoints, `core/pipeline/` intent, clarify, construct and score, `core/prompts/` system prompt and versioned templates, `core/providers/` model provider abstraction, `schemas/` request and response models, `evaluation/` eval set and runner, `tests/` unit tests.

## Running

```
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
cp .env.example .env     # fill in OPENAI_API_KEY and API_SHARED_SECRET
uvicorn main:app --port 8000
pytest tests
python evaluation/run_eval.py     # real model calls, run before and after any template change
```

The service refuses to start if a required setting is missing or malformed.
