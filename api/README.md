# Prompt AI, API Service (`/api`)

This is the backend service for Prompt AI. It owns everything that is not model inference: authentication, authorization, email, business logic, rate limiting, and orchestration of calls to the `/data` service.

This service is deployed on Vercel, as its own project, separate from `/app`.

## Responsibilities

- User authentication with JWT (access and refresh token rotation)
- Email delivery via Nodemailer, for verification, password reset, and notifications
- Request validation on every route using Zod
- Rate limiting and abuse prevention, backed by Redis
- Database access through Prisma, against a Supabase PostgreSQL instance
- Orchestrating calls to the `/data` service for classification, scoring, and prompt generation
- Session history, user settings, and any user owned data

## What this service does NOT do

- No model inference. Anything involving an LLM call, a classifier, or a scoring model belongs in `/data`, and this service only calls it.
- No direct exposure of AI provider API keys to the frontend. All provider calls happen server side, either here or in `/data`.

## Tech Stack

- Node.js with Express
- TypeScript
- Prisma ORM
- Supabase (PostgreSQL)
- JWT for authentication
- Nodemailer for transactional email
- Zod for request and response validation, and for environment variable validation
- Redis for caching and rate limiting
- BullMQ for queuing outbound calls to `/data` and to email delivery

## Folder Structure (planned)

```
api/
├── src/
│   ├── routes/          Route handlers, grouped by resource
│   ├── middleware/       Auth, validation, rate limiting
│   ├── services/          Business logic, including the client for /data
│   ├── lib/                Prisma client, Redis client, mailer setup
│   ├── schemas/           Zod schemas shared across routes
│   └── config/             Environment validation and app config
├── prisma/
│   └── schema.prisma
├── tests/
├── .env.example
└── package.json
```

## Environment Variables

See `.env.example` once dependencies are installed. At minimum this service expects database credentials, JWT secrets, Redis connection details, SMTP credentials for Nodemailer, and the base URL of the `/data` service.

## Status

Scaffolding stage. No implementation yet.
