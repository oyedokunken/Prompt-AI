# Architecture

This document describes how Prompt AI is put together as it exists today, why it is split this way, and how a request moves through it.

## The three services

| | `app` | `api` | `data` |
|---|---|---|---|
| Responsibility | Interface | Identity, storage, business logic | Intelligence |
| Technology | Next.js | Express, TypeScript | FastAPI, Python |
| Hosted on | Vercel | Vercel | Render |
| Talks to | `api`, and Supabase for simple reads and writes | Supabase, `data`, SMTP | The model provider |
| Holds secrets for | Supabase anon key | Supabase service key, shared secret, mail | Model provider key, shared secret |
| Has a database | No | Yes | No |
| Knows who the user is | Via session | Verifies every token | Never |

Three rules keep the boundary honest.

1. **`data` is the only service that calls a model provider.** There is one provider implementation, behind an interface, and nothing else in the repository talks to one.
2. **`api` is the only caller of `data`.** `data` rejects any request without the shared secret.
3. **`data` is stateless.** It has no database and fetches nothing. `api` sends everything a request needs, the user's profile, stored memory, conversation history and any in progress question flow, and `data` works only with that. This is what makes it impossible for `data` to invent facts about a user it was never told about.

## Why this split

The boundary is drawn around what needs to change independently and what needs to scale independently. Authentication and storage change slowly and need to be reliable. Prompt wording, templates and providers change constantly as the pipeline is tuned. Keeping them apart means the intelligence layer can be redeployed, retuned or swapped out without touching authentication, and a spike in model load does not put sign in at risk.

`data` is intentionally ignorant of identity. It does not know who a user is, only that a request arrived with the shared secret. Even if it were compromised there would be no credentials, accounts or mail system to reach from there.

## System overview

```mermaid
graph TB
    subgraph Client
        Browser["Browser"]
    end
    subgraph app["app (Vercel)"]
        UI["Chat, dashboard, settings"]
    end
    subgraph api["api (Vercel)"]
        Auth["Token verification"]
        Chat["Chat route: context, relay, persistence"]
        Mem["Memory saving"]
        Mail["One time code email"]
    end
    subgraph data["data (Render)"]
        Pipeline["Pipeline: memory, files, intent, search, questions, construct, score"]
        Provider["Provider interface and implementation"]
    end
    DB[("Supabase: auth, Postgres, storage")]
    SMTP[("SMTP")]
    LLM[("Model provider")]

    Browser --> UI
    UI -->|bearer token| Auth
    Auth --> Chat
    Chat --> DB
    Chat --> Mem
    Mem --> DB
    Chat -->|shared secret, streamed| Pipeline
    Pipeline --> Provider
    Provider --> LLM
    Mail --> SMTP
    UI --> DB
```

## How a chat message flows

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant A as app
    participant P as api
    participant D as data
    participant M as Model provider
    participant S as Supabase

    U->>A: Send a message
    A->>P: POST /chat/stream, bearer token
    P->>S: Verify token, load session, history, memory
    P->>S: Store the user message
    P->>D: POST /generate with profile, memory, history, attachments, open question state
    D->>M: Embed memory, select what is relevant
    opt Attachments
        D->>M: Read images, extract PDF and Word text
    end
    D->>M: Classify intent
    opt A search is warranted
        D->>M: Web search
    end
    alt Something critical is missing
        D-->>P: One clarifying question, with the updated state
    else Casual or a question about the user
        D->>M: Conversational reply
        D-->>P: Reply, memory used, facts worth keeping
    else A prompt can be built
        D->>M: Construct the prompt
        D-->>P: Prompt, message, score, stated or found or inferred, sources, memory used
    end
    D-->>P: Stage events streamed throughout
    P-->>A: Events relayed unchanged
    P->>S: Store the reply, save new memory automatically
    P-->>A: Final event with the stored rows and what was saved
```

### Pattern retrieval

Before a prompt is constructed, the closest one or two entries in a library of known effective patterns are retrieved by meaning and handed to construction as craft guidance. The library is a file beside the code and its vectors are computed once per process, since `data` has no database. The retrieval sits behind one class, so a database backed vector store could replace it without touching the pipeline. Which patterns were used is returned with the result and shown to the user.

### Feedback

A thumbs up or down is written to the response it was given on, along with the request, the score and the template version. `data/evaluation/feedback_review.py` exports those ratings, summarizes them by template version and drafts eval cases from the thumbs down items. A person reviews the drafts and decides what changes. Nothing retrains or edits a template automatically.

### Stage events

`data` streams an event as each step actually begins, so the status a user sees describes real work. Stages are: reading attachments, understanding the request, searching, asking, answering, constructing, scoring and finalizing. Each stage has a pool of short and long phrasings, chosen at random. `api` relays every event without changing it and adds one final event of its own that carries the stored messages and anything saved to memory.

### The question flow

When a request is underspecified, `data` plans up to three questions and asks the first. Because `data` holds no state, the whole sequence, which questions exist, which are answered, any text read from attachments, travels in each response. `api` stores it on the assistant message and sends it back with the user's next message. A question is shown one at a time. A single choice question advances the moment an option is picked, and only multi select and free text answers need a confirm. A direct question asked mid sequence is answered without losing the pending question.

### Memory

- **Selection.** Every request, casual ones included, begins by embedding the message and the stored memory and keeping the items that bear on it. A message about the user themselves widens this to everything stored. What was used is returned with the reply and shown in the interface.
- **Saving.** While replying, `data` proposes stable facts it noticed. `api` decides what is stored: it skips low confidence proposals, secrets and long digit runs, repeats, and anything the user entered by hand, then saves automatically and reports it.
- **Control.** The settings memory page lets the user add, edit and delete anything.

### Attachments and search

Images arrive as data URLs and are read with vision. PDFs are fetched from storage by `api`, and Word documents are sent by the browser, both as bytes, and their text is extracted in `data`. What was read becomes part of the context before anything is constructed, and is listed back to the user. Web search is planned by the intent step only when a request depends on current information, and its findings and links are shown the same way.

## The data service

```
data/
  main.py            app entrypoint, startup validation
  config.py          settings, validated at startup
  routers/           generate, transcribe, transcribe_stream, title, health
  core/
    context.py       the one place memory, files and searches join the context
    events.py        stage events and their message pools
    providers/       provider interface and the OpenAI implementation
    prompts/         system prompts, versioned templates, output format targeting
    pipeline/        intent, clarify, ingest, research, construct, score
  schemas/           request and response models
  evaluation/        eval set and runner
  tests/             unit tests
```

Prompt templates are versioned in directories and one version is active at a time, so any result can be traced to the wording that produced it.

## The api service

| Route | Purpose |
|---|---|
| `GET /health` | Liveness |
| `POST /auth/otp/request-signup`, `/auth/otp/verify-signup` | Email sign up with a one time code |
| `POST /auth/otp/request-reset`, `/auth/otp/verify-reset` | Password reset with a one time code |
| `POST /auth/send-welcome` | Welcome email after OAuth sign in |
| `POST /chat/stream` | A chat turn, streamed |
| `POST /chat/transcribe` | Voice message to text, via `data`, used when live transcription is unavailable |
| `POST /chat/transcribe/ticket` | A short lived ticket and the address of the live transcription socket on `data` |
| `GET /chat/memory-summary` | A short prose description of what is stored about the signed in user, written by `data` |

## Questions about the world, and which model does what

The data service separates two kinds of question that look alike. A question about the user, such as who am I, is answered from stored memory, and says so plainly when nothing is stored. A question about the outside world, such as who a named person is, is looked up. Intent classifies it, and a deterministic check on a plain "who is" followed by a name is the net beneath it. The lookup runs its own stage, which the interface shows as "Looking this up on the web", then a deeper web search, then an answer written only from the findings. The answer event carries the search sources, `api` stores them on the message, and the interface opens them by default. A name that is the user's own or already stored goes to memory, and a failed search is reported to the answering model so it says so instead of guessing.

Memory, search and the conversation are inputs that combine, never alternatives. Memory is selected before anything else, and when a search is about to run the context is widened first: a request that refers to the user's own situation brings in everything stored, and any other keeps at least the four best stored items even when none matched its words. A question can be classified as needing both a lookup and memory, and then the answer is written from the findings, the stored details and the conversation together, with today's date in the context so current is judged against the real date.

Each step has its own model, set by configuration and defaulting to the following.

| Step | Model | Why |
|---|---|---|
| Intent | gpt-4.1 | Cheaper than gpt-4o and follows the classification rules better |
| Construction | gpt-5.1, low reasoning effort | Prompts with real decision rules and exact output shapes, at a lower token price than gpt-4o |
| Conversational reply | gpt-4.1 | Fast and grounded |
| Search | gpt-4o with the search tool | A lookup reads wider and reports more than a research note for a prompt |

A step that fails on its model is retried once on `OPENAI_FALLBACK_MODEL`. Reasoning models take `max_completion_tokens` and a reasoning effort instead of `max_tokens` and a temperature, and the provider handles that. The construction template is versioned (v6), its token budget is 8,000, and generated text has quotation marks, non breaking hyphens and spaces normalised in code.

## Pinned chats and password changes

Pinned chats live in `is_pinned` and `pinned_at` on `chat_sessions`, added by `api/prisma/pinned_chats.sql`. The dashboard falls back to the user's profile until the columns exist. Changing a password is `POST /auth/change-password` on `api`. It verifies the bearer token against Supabase on every call, proves the current password by signing in with it on a throwaway client, then sets the new one through the Supabase admin API. The Accounts tab appears only for accounts whose sign in methods include email.

## Live transcription

Voice input streams, and ends by itself on silence. The default model, gpt-realtime-whisper, decodes continuously so words arrive while the speaker is still talking. Models that work in phrases are still supported and are handled with the phrase closing described below. The browser captures microphone audio, resamples it to 24kHz mono PCM on the device, and sends it over a WebSocket to `data`, which relays it to OpenAI realtime transcription and returns text as each phrase is recognised. The text appears in the message box while the user is still speaking.

A WebSocket cannot be held open by the serverless `api`, and a browser cannot send an Authorization header on one, so the socket is on `data` and `api` only mints the way in. `POST /chat/transcribe/ticket` returns a ticket signed with the shared secret that names the user, expires in a minute and is accepted once. The browser presents it as the first message on the socket, so it never appears in a URL or a log. `data` remains the only service that talks to OpenAI.

```
browser  --ticket-->  api            mints a one use ticket
browser  --PCM----->  data  --PCM--> OpenAI realtime transcription
browser  <--text----  data  <--text--
```

Voice detection on its own only closes a phrase at a pause, so a long run of speech would show nothing until the speaker breathed. `data` therefore closes a phrase early at the next dip in volume once it has run past about a second and a half, and always by about three seconds, so text keeps arriving. A normal recording is made at the same time, so if the socket cannot connect or fails before any text arrives, the whole message is transcribed with the original upload route.

Cost follows audio sent, not how long the socket stays open. Silence that is sent is billed like speech, so each session is capped at 180 seconds, an idle socket is closed after 20 seconds, and the cheaper `gpt-4o-mini-transcribe` model is used, at half the per minute price of `whisper-1`. Each session logs its seconds and estimated cost.

## Data stores

- **Supabase Postgres** holds chat sessions, messages, saved prompts, shared links, exports and memory. `app` reads and writes simple records directly under row level security. `api` uses the service key for the chat route.
- **Supabase storage** holds image, video and PDF attachments.
- **Supabase auth** owns accounts and sessions.

## Failure handling

If `data` is slow, unreachable or returns something unusable, the user gets an honest error message with a retry action. Nothing is fabricated to cover for it. A failed search, an unreadable attachment or an embeddings outage degrades quietly: the reply is still produced, the unreadable file is reported as unreadable, and memory selection falls back to keyword matching. A failure to save memory never blocks a reply.

## Deployment

`app` and `api` are separate Vercel projects linked by environment variables. `data` runs on Render, which suits a long running Python process better than serverless functions. A scheduled workflow keeps the `data` service and the database awake on their free tiers. Each service validates its environment at startup and exits with a clear message if something required is missing.

## Planned routes

The interface grows in phases as the data model and user base justify it. Planned next: a models page and a rules page for user defined generation preferences, then community and feedback pages. Earlier phases are built on data models designed to support the later ones, so adding a route does not require a schema rewrite.
