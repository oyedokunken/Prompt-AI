# Prompt AI, Data Service (`/data`)

This is the intelligence layer of Prompt AI. It takes a user's message and the context `/api` sends with it, works out what is missing, asks the right follow up questions, reads attachments, searches the web when current information is needed, and constructs a properly engineered prompt. It is stateless, with no database, no accounts and no direct exposure to end users. The only caller of this service is `/api`, and it is the only part of the system that calls a model provider.

This service is deployed on Render, chosen because it suits long running Python processes better than a serverless platform.

## Responsibilities

- Selecting, by meaning, the stored memory that bears on each message, before anything else happens
- Reading attachments: text from PDF and Word documents, and vision based reading of images
- Intent detection, and the one question at a time clarifying flow, with its state carried in each request and response
- Planning and running a web search when a request depends on current information
- Retrieving known effective prompt patterns that fit the request, and giving them to construction as craft guidance
- Constructing the prompt, scoring its completeness, and separating what the user stated from what was found and what was inferred
- Conversational replies to everything that is not a prompt request, and noticing stable facts worth remembering
- Writing a short prose description of a user from their stored details
- Short conversation titles, audio transcription, and live transcription over a streaming socket
- Logging the tokens and estimated cost of every model call

## What this service does NOT do

- No database and no fetching. Everything it knows about a user arrives in the request, so it cannot invent facts it was not told.
- No authentication of users. It accepts only requests that carry the shared secret `/api` holds, and never learns who the user is.
- No model calls outside the provider interface. Pipeline code never names a provider.

## Endpoints

All except `/health` require `Authorization: Bearer <API_SHARED_SECRET>`.

| Route | Purpose |
|---|---|
| `GET /health` | Liveness, no auth |
| `POST /generate` | Streams stage events, then one clarifying question, a direct answer, a finished prompt or an error |
| `POST /memory-summary` | A short prose description of what is stored about a user |
| `POST /title` | A short inferred conversation title |
| `POST /transcribe` | Audio to text, for a finished recording |
| `WS /transcribe/stream` | Live transcription. The first message carries a ticket minted by `/api`, then 24kHz PCM audio goes up and partial and final text comes back |

## How a request is processed

1. Memory selection by meaning, using embeddings. A message about the user themselves brings in everything stored
2. Attachment reading, if any were sent
3. Intent detection. A question about the user is answered from stored memory. A question about the outside world, such as who a named person is, is looked up on the web, in its own stage, and answered from what the search found with its sources shown, never from the model's recollection. An underspecified request gets one clarifying question, and anything else goes on
4. A web search to feed the prompt, only if intent planned one
5. Pattern retrieval, then construction, then scoring

Every step that calls a model records its token usage, and each reply carries the totals.

## Prompt pattern retrieval

`core/patterns_library.json` holds known effective patterns per task type: support agents, code review, extraction, summarization, research, tutoring, screening, agents with tools and more. Each entry is concrete craft, the decision rules, failure handling and output shapes a prompt for that kind of task needs. For each request the closest one or two are retrieved by meaning and given to construction as guidance to adapt, never to copy. Which patterns were used is shown to the user.

The index is an in-process vector index over that file, built with the same embedding model as memory selection, and its vectors are computed once and cached. The service has no database, so the library lives beside the code. `PatternIndex` in `core/patterns.py` is the seam where a database backed vector store could replace it. Set `PATTERNS_ENABLED=false` to turn retrieval off, which is how its effect is measured.

## Layout

```
data/
  main.py            entrypoint, startup validation
  config.py          settings, validated at startup
  routers/           generate, memory, title, transcribe, transcribe_stream, health
  core/
    context.py       the one place memory, files and searches join the context
    events.py        stage events and their message pools
    patterns.py      pattern retrieval
    patterns_library.json
    usage.py         token and cost accounting
    providers/       provider interface and the OpenAI implementation
    prompts/         system prompts, versioned templates, output format targeting
    pipeline/        intent, clarify, ingest, research, construct, score
  schemas/           request and response models, with hard size limits
  evaluation/        eval set, runner, feedback review tool
  tests/             unit tests
  COST_AUDIT.md      what a turn costs and how to read the logs
```

## Environment Variables

Copy `.env.example` to `.env`. The service requires `OPENAI_API_KEY` and `API_SHARED_SECRET`, and refuses to start if either is missing or malformed. Model names, the embeddings model, the request timeout and the pattern switch are optional, and each pipeline step's model can be set separately. The model provider key exists only here.

## Running

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # macOS and Linux: .venv/bin/pip
cp .env.example .env
uvicorn main:app --port 8000
pytest tests
```

## Evaluation

The eval set is a collection of requests, including harder ambiguous and multi step ones, each with a note on what a good result looks like.

```bash
python evaluation/run_eval.py                                   # free mock mode, no API key
python evaluation/run_eval.py --retrieval                       # does each request retrieve the right pattern, costs a fraction of a cent
python evaluation/run_eval.py --live --only <case ids> --yes    # a few real cases
python evaluation/run_eval.py --live --full --yes --judge       # a deliberate checkpoint
```

Mock mode checks the pipeline's wiring and says nothing about model quality. A live run prints its estimated cost first, needs `--yes`, and reports its real spend. Run live checkpoints before and after any change to templates, patterns or a step's model.

## Feedback review

Thumbs up and thumbs down ratings are stored on the responses they were given on, with the request, the score and the template version. `python evaluation/feedback_review.py --fetch --candidates` exports them, summarizes where ratings cluster by template version, and drafts eval cases from the thumbs down items for a person to review. This is a review loop, not automatic learning: nothing changes a template or the eval set without a person deciding.

The server refuses to start if a required setting is missing or malformed.
