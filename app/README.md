# Prompt AI, Web App (`/app`)

This is the frontend for Prompt AI. It is the chat interface and everything the user directly interacts with.

This service is deployed on Vercel, as its own project, separate from `/api`.

## Responsibilities

- The chat interface where users describe what they want
- Rendering generated prompts, scores, and the diff between what the user said and what was inferred
- Authentication UI (sign up, log in, password reset), talking to `/api`
- User settings (avatar, username, email, GitHub link)
- Session history view
- File upload UI and voice input, both sending data to `/api`

## What this service does NOT do

- No direct calls to `/data` or to any AI provider. Every request goes through `/api`.
- No secrets. Only `NEXT_PUBLIC_*` variables live here, nothing that grants write access to the database or AI providers.

## Tech Stack

- Next.js, App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zustand for client side state
- Zod for form and response validation

## Folder Structure (planned)

```
app/
├── src/
│   ├── app/                 App Router routes
│   ├── components/           Reusable UI components
│   ├── hooks/                 Custom React hooks
│   ├── lib/                    API client, utilities
│   ├── stores/                 Zustand stores
│   └── schemas/                Zod schemas shared with form components
├── public/
├── .env.local.example
└── package.json
```

## Current Scope

For now this is a single page application: a developer focused landing page with a live chat demo. Additional routes such as `/history`, `/settings`, `/models`, `/media`, `/community`, and `/feedback` are planned but not yet built. See the project level `ARCHITECTURE.md` for the phased rollout of these routes.

## Status

Scaffolding stage. No implementation yet.
