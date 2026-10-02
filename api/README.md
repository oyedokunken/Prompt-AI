# Prompt AI, API Service (`/api`)

This is the backend of Prompt AI. It owns everything that is not model inference: authentication, the database, email, rate limiting, and every piece of business logic. For each chat turn it gathers what the intelligence layer needs, hands it to `/data`, relays the streamed result, and stores the outcome.

This service is deployed on Vercel, as its own project, separate from `/app`.

## Responsibilities

- Verifying the user's Supabase access token on every chat request, and scoping every query to that user
- Email sign up and password reset with one time codes, delivered by Nodemailer using branded templates
- Loading the user's profile, stored memory and conversation history for each turn, and sending them to `/data`
- Relaying the stream of stage events and the final result from `/data` to the browser without changing them
- Storing messages, and keeping the clarifying question state between a user's answers, since `/data` holds no state
- Saving new memory automatically, with guards against secrets, repeats and overwriting what the user wrote by hand
- Fetching PDF attachments from storage for `/data`, and enforcing request and file size limits
- Request validation on every route using Zod, and rate limiting per user and per address

## What this service does NOT do

- No model calls. Anything that involves a model provider, prompts, scoring or transcription happens in `/data`, and this service only calls `/data`.
- No model provider keys. The provider key lives only in `/data`.

## Routes

| Route | Purpose |
|---|---|
| `GET /health` | Liveness |
| `POST /auth/otp/request-signup`, `/auth/otp/verify-signup` | Email sign up with a one time code |
| `POST /auth/otp/request-reset`, `/auth/otp/verify-reset` | Password reset with a one time code |
| `POST /auth/send-welcome` | Welcome email after OAuth sign in |
| `POST /chat/stream` | One chat turn, streamed |
| `POST /chat/transcribe` | Voice message to text, through `/data` |
| `POST /chat/transcribe/ticket` | A short lived, single use ticket and the address of the live transcription socket on `/data` |

## Tech Stack

- Node.js with Express, in TypeScript
- Supabase for authentication, Postgres and storage
- Prisma for the authentication tables
- Nodemailer for transactional email
- Zod for request validation and for environment validation
- Helmet and express-rate-limit for security headers and rate limits

## Folder Structure

```
api/
  src/
    routes/        auth and chat routes
    middleware/    token verification, validation, rate limiting
    services/      chat state, memory saving, attachment preparation, auth and email logic
    lib/           the /data client, Supabase and Prisma clients, mailer
    schemas/       Zod schemas for incoming requests
    templates/     email templates
    config/        environment validation
  prisma/          schema and row level security notes
  .env.example
  package.json
```

## Environment Variables

Copy `.env.example` to `.env`. This service expects database credentials, the Supabase URL and service key, the one time code pepper, SMTP credentials, the base URL of `/data`, and the shared secret that `/data` requires. The shared secret must be identical on both services. The service validates its environment at startup and exits with a clear message if something required is missing.

## Running

```bash
npm install
npm run dev
npm test
```
