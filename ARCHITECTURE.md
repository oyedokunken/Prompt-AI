# Architecture

This document describes how Prompt AI is put together, why it is split the way it is, and how a request moves through the system.

## Services

Prompt AI is a monorepo made up of four parts, each with a single responsibility and its own deployment target.

| Folder | Responsibility | Deployed On |
|---|---|---|
| `/app` | Chat interface and user facing UI | Vercel |
| `/api` | Auth, email, business logic, orchestration | Vercel |
| `/data` | LLM and ML inference, strictly | Render |
| `/docs` | Documentation, not deployed | N/A |

`/app` and `/api` are separate Vercel projects linked by environment variables, not a shared deployment. `/data` runs on Render because it suits long running Python processes and model inference better than a serverless platform, and it avoids the cold start and execution time constraints that come with running inference behind serverless functions.

## Why this split

The boundary is drawn around what needs to change independently and what needs to scale independently. Auth and email logic change slowly and need to be reliable. Model logic changes constantly as prompts, rubrics, and providers are tuned. Keeping them as separate services means the ML layer can be redeployed, retrained, or swapped out without touching authentication, and a spike in inference load does not put user login at risk.

`/data` is intentionally kept dumb about identity. It does not know who a user is, only that a request came from an authenticated call from `/api`, verified with a shared service secret. This keeps the attack surface small: even if the inference layer were compromised, there is no user data, no credentials, and no email system to reach from there.

## Request Flow

A typical chat message moves through the system like this:

1. The user sends a message from `/app`.
2. `/app` calls `/api`, authenticated with a JWT access token.
3. `/api` validates the request, checks rate limits against Redis, and persists the message.
4. `/api` calls `/data` with the message and relevant context, authenticated with a shared service secret.
5. `/data` classifies intent, retrieves relevant prompt patterns from the vector store, constructs the prompt, and scores it.
6. `/data` returns the structured prompt and score to `/api`.
7. `/api` persists the result and returns it to `/app`.
8. `/app` renders the prompt, the score, and the diff between what the user said and what was inferred.

Responses are streamed where possible, so the user sees output as it is generated rather than waiting for the full round trip to complete.

## Data Storage

- **Supabase PostgreSQL** is the primary database for user accounts, sessions, prompt history, and settings, accessed through Prisma from `/api`.
- **Supabase pgvector** stores embeddings for the prompt pattern retrieval system, accessed from `/data`.
- **Redis** handles caching and rate limiting from `/api`.

## Failure Handling

If `/data` is slow or unavailable, `/api` should degrade gracefully rather than fail the whole request. A generated prompt without a completeness score is still useful to the user. A missing prompt with a hard error is not. Timeouts and fallbacks around the `/data` call are treated as a required part of the integration, not an edge case to handle later.

## Planned Route Expansion

The frontend currently ships as a single page. Additional routes are planned in phases as the underlying data model and user base justify them.

**Phase 1**: `/history`, `/settings`
**Phase 2**: `/models`, `/media`
**Phase 3**: `/community`, `/feedback`, `/rules`

Earlier phases are built on data models designed to support later phases, so building `/history` now does not require a schema rewrite to support `/media` later.
