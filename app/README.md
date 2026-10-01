# Prompt AI, Web App (`/app`)

This is the frontend of Prompt AI: the chat interface, the dashboard and settings, and everything else the user sees and touches.

This service is deployed on Vercel, as its own project, separate from `/api`.

## Responsibilities

- The chat, where users describe what they want. Clarifying questions arrive one at a time, and a single choice advances as soon as it is picked
- Live status while a reply is generated, taken from the real stage events the server streams
- Showing the finished prompt in its own card with a copy button, apart from the conversational reply, with the stated, found and inferred breakdown and the sources it drew on
- Attachments and voice input: attaching files and images, and recording a voice message to review before sending
- The library: history, saved prompts, favorites, media, exports and shareable read only links
- Settings: the profile, the memory page where stored details can be added, edited and removed, and the usage page
- Sign up, sign in and password reset screens
- Feedback on each response, with a thumbs up or thumbs down

## What this service does NOT do

- No calls to `/data` or to any model provider. Every chat request goes through `/api`.
- No secrets. Only `NEXT_PUBLIC_*` variables live here, and nothing that grants write access to the database beyond what row level security allows for the signed in user.

## Tech Stack

- Next.js with the App Router, in TypeScript
- Tailwind CSS
- Supabase for sessions and for simple reads and writes under row level security
- Framer Motion for transitions
- react-markdown and remark for rendering replies as formatted text
- Zod and React Hook Form for forms

## Folder Structure

```
app/
  app/             routes: marketing page, auth, chat, dashboard pages, settings, shared links
  components/      interface components, grouped by area (dashboard, settings, auth, sections)
  lib/             API client, hooks, shared types, Supabase clients, helpers
  public/          static assets
  .env.local.example
  package.json
```

## Environment Variables

Copy `.env.local.example` to `.env.local`. This service expects the Supabase URL and anon key, the base URL of `/api`, and the public site URL.

## Running

```bash
npm install
npm run dev
```
