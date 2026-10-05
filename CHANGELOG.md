# Changelog

All notable changes to this project are documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and versioning follows [Semantic Versioning](https://semver.org/).

## [0.8.0] - 2026-10-05

### Added

- Direct answers on the Usage tab. The count of prompts was correct but narrow, it counts only finished structured prompts, so a period made up of direct answers and web lookups read as zero activity beside real token spend. Prompts are now labelled Prompts built, Direct answers are counted on their own with how many came from a web search, and the summary sentence says both
- True streaming transcription. The default live model is gpt-realtime-whisper, which decodes continuously, so words appear while the speaker is still talking, where the earlier model released text only after a phrase closed. It costs about $0.017 a minute, and a session is still capped at 180 seconds
- Voice recording ends by itself after about two seconds of silence once the speaker has been heard, gives up if nothing is heard for ten seconds, and stops at two minutes
- Today's date in the context of intent, construction and answering, and in the web search request, so what is current is judged against the real date
- An eval case that needs both stored memory and a web search in one answer

### Changed

- Memory, web search and the conversation now combine. A search no longer leaves the user's own context behind: a request that refers to the user's situation brings in all stored memory, and any other search keeps at least the four best stored items even when none matched the request's words. A question can be marked as needing both a lookup and memory, and then uses both. The answer template (v7) says so explicitly
- The recording indicator sits inside the chat input, beside the text, and no longer pulses over the buttons next to it
- Loading and status colours use the amber accent or a neutral instead of purple, and the secondary tone in the palette is now neutral
- The role in settings can be written in the user's own words as well as chosen from the presets, and a failed save is reported
- The placeholder in the marketing preview of the chat input reads Start a new chat like the real one

## [0.7.0] - 2026-10-04

### Added

- Web lookup for questions about the outside world. A question such as who a named person is is classified separately from a question about the user, searched on the web in its own status stage, answered from what the search found, and shown with its sources open. A plain "who is" followed by a name is caught even when the intent model misses it. A name that is the user's own or already stored is answered from memory
- Support for the GPT-5 family in the model provider, with a configurable reasoning effort and a one time retry on a steadier model when a step fails
- A hand review tool for building the same requests with several models, and a live probe for running one message through the real pipeline
- Four eval cases for lookups, and a filler allowance that grows with the length of a prompt

### Changed

- Construction runs on gpt-5.1, and intent and conversational replies on gpt-4.1. Prompts are several times more specific, with decision rules, edge cases and exact output shapes, for about two cents more a turn
- The construction template (v6) asks for depth that fits the job, faithfulness to the situation the user described, and no new scope, instead of pushing for short. The construction token budget rose from 2,500 to 8,000 and direct answers from 600 to 1,200
- Quotation marks, non breaking hyphens and spaces are normalised to plain ones, and a numeric range keeps its hyphen instead of becoming a comma
- The assistant avatar in a chat is the Prompt AI logo mark on its own, and the logo mark switches between a dark badge on a light page and a light badge on a dark page

## [0.6.0] - 2026-10-02

### Added

- An Accounts tab in settings, last in the list and shown only to accounts that sign in with an email and password, for changing the password. It asks for the current password, validates with react-hook-form and Zod with no native validation, has the server verify the session and the current password before changing anything, updates the password through Supabase, and reports the result in a modal
- A pinned column on chats, with a migration in `api/prisma/pinned_chats.sql`. The dashboard uses it as soon as it exists and uses the user's profile until then
- A warm up call so the data service is awake before a voice message, a language hint for live transcription, and per phrase timing in the data service logs
- Live transcription. Speech is streamed to the data service over a WebSocket and relayed to OpenAI realtime transcription, so text appears while the user is speaking. The recording is also made normally and used as a fallback if the live connection fails
- A short lived, single use ticket for the live socket, minted by the api and checked by the data service
- Pinned chats, with their own group at the top of the chat list and a pin control in the chat header and in each chat's menu
- An Integrations tab in settings that previews planned integrations with their real brand icons, clearly marked as not yet available
- A header call to action on the public pages that reads Dashboard and links there for a visitor who is already signed in

### Changed

- Marketing copy about models now matches the product: GPT-4o is the only model available, the others are listed as coming soon, and generated prompts are plain text that can be pasted anywhere
- Live transcription closes phrases sooner, after about a second and a half of speech and by about three seconds at the latest, so text arrives every second or two
- Desktop sizing was raised to the same standard as mobile, with a wider sidebar, larger text and larger controls
- The Integrations tab no longer shows its preview explanation
- The dashboard header is one shared component and always shows the logo beside the theme switcher, in a new chat and inside a conversation, and never a chat title
- The marketing page previews are now built from the dashboard's own sidebar, header, message and composer components, so they match the product by construction, and the three bar completeness card shows the real score badges
- A mobile sizing pass over the dashboard, the drawer, the composer, messages, modals and settings, with larger text and tap targets, and message actions that no longer depend on hover

### Removed

- An unused hand drawn laptop mockup from the marketing sections

## [0.5.0] - 2026-10-01

### Added

- Retrieval of known effective prompt patterns for construction, with a library of 27 patterns, retrieval by meaning, and the patterns used shown on the result. Measured on the eval set, it raised judge scores on specificity, fit and value by about a quarter to a third of a point at about 6 percent more cost per prompt
- A summary modal for each conversation in All history, with a message count, what Prompt AI gathered, and any feedback, and a Go to chat button
- A saved prompt modal with the full content, a copy action and a link back to the chat, opened from every saved prompt
- Thumbs up and thumbs down on responses, stored with the request, score and template version, and a feedback review tool that summarizes ratings and drafts eval cases for a person to review
- Attachments render inside the message bubble with a thumbnail or type tile and a prominent type badge, in the composer, in sent messages and in the media library
- A memory page that describes what is stored in natural prose, with the individual details editable beneath it
- A Usage tab with a hoverable line graph, six tracked metrics and 1 day, 3 day, 7 day, 1 month and 3 month ranges
- Per-reply token and cost totals stored on messages, which feed the usage graph
- 15 harder eval cases covering ambiguity, contradiction, long multi constraint input, multi step workflows, a prompt injection attempt, non English input and history dependent requests, and a retrieval check that costs a fraction of a cent

### Changed

- The collapsed sidebar is a narrower version of the same sidebar: logo mark, expand and search icons, then the chat list as compact tiles
- The avatar shows either the remove control or the upload button, never both
- The service READMEs describe the system as it stands

### Removed

- The `docs` and `scripts` folders
- The bar charts on the usage page

## [0.4.1] - 2026-10-01

### Added

- Token and estimated cost logging for every model call, and a total per request
- Provider side prompt caching, by keeping everything static at the front of each prompt
- Hard limits on message length, history, attachments and reference text on the path to the model, enforced in `app`, `api` and `data`
- Per step model settings, so any step can move to a different model by configuration
- A free offline mock mode for the eval suite, now the default. A live run needs `--live`, a scope and `--yes`, and reports its real spend
- `data/COST_AUDIT.md` with the audit, the measurements and the decisions

### Changed

- Long conversations are bounded: a short recent window plus a condensed digest of older turns
- One web search per turn instead of up to two, with the tool's low context setting
- Output token caps tightened, with construction down from 6,000 to 2,500

### Removed

- The separate model call that only rephrased a message into a search query

## [0.4.0] - 2026-10-01

### Added

**Data service (`/data`) rebuilt as the intelligence layer**
- Stateless FastAPI pipeline: memory selection, attachment reading, intent detection, optional web search, one question at a time clarification, prompt construction and scoring
- Provider interface with a single OpenAI implementation, the only place in the system that calls a model provider
- Streamed stage events emitted as each step actually begins, with pools mixing single word and fuller phrasings
- Startup validation that refuses to run on a missing or malformed key or secret
- Versioned prompt templates, output format targeting, and an evaluation harness with a judged mode and a recorded baseline
- Title inference and audio transcription endpoints

**Chat relay (`/api`)**
- `POST /chat/stream` and `POST /chat/transcribe`, with Supabase token verification, profile, memory and history loading, clarifying question state persistence and unchanged stream relaying
- Automatic memory saving with guards against secrets, repeats and overwriting entries the user wrote by hand

**Interface (`/app`)**
- Attachments are read: PDF and Word text, images through vision, each shown as a source
- Web search findings shown with their links
- A stated, found and inferred breakdown on every prompt
- Rich text rendering of replies, and a separate card for the finished prompt with its own copy button
- Single select clarifying questions advance on selection
- Memory used for a reply is shown, new memory is announced by a passive notice, and the settings memory page supports adding, editing and removing items
- `story.txt` at the project root

### Changed

- All model calls moved out of the Next.js route handlers and into `/data`
- Generated prompts default to lightweight plain text, with markdown or tagged sections only when the destination calls for it
- Every message, casual ones included, consults relevant stored memory before a reply is produced
- Documentation rewritten to describe the system as it stands: README without version history, an accurate architecture document with diagrams, and an updated wiki

### Removed

- The silent heuristic fallback that fabricated a prompt and score when generation failed
- The manual approval step for saving memory
- Co-author trailers from commit history

## [0.3.0] - 2026-09-29

### Added

**SEO and social sharing**
- Open Graph image at `app/public/og-image.png` (1200x630) served on all pages via root layout metadata
- Twitter/X `summary_large_image` card metadata
- `metadataBase` canonical URL resolution driven by `NEXT_PUBLIC_SITE_URL` (defaults to https://prompt.ai)
- Title template (`%s | Prompt AI`) and keyword metadata
- `app/robots.ts` allowing all crawlers except `/dashboard`, `/settings`, and `/api/`, with sitemap reference
- `app/sitemap.ts` covering `/`, `/login`, and `/signup`
- App favicon (`icon.png`, 512px) and `apple-icon.png` (180px) generated from the brand icon tile
- `NEXT_PUBLIC_SITE_URL` documented in `/app/.env.local.example`

**Brand assets**
- `promptai-logo.png` high-resolution transparent logo export (black "Prompt", yellow "AI")
- `logo-export.html` and `icon-export.html` standalone render sources for regenerating brand assets

### Changed

- `/dashboard` and `/settings` routes now emit `noindex`/`nofollow` via `(chat)` layout metadata

## [0.2.0] - 2026-08-13

### Added

**Backend API (`/api`)**
- Complete Express backend service with TypeScript, Prisma ORM, and Zod validation
- Authentication system with JWT access tokens and refresh token rotation
- Email + OTP registration and verification flow using Nodemailer
- Dark-themed HTML OTP email template without emojis
- Password reset via OTP endpoint
- Supabase admin client integration for OAuth user mirroring
- Redis client for caching and rate limiting
- Rate limiting middleware: 10 req/15 min on auth mutations, 60 req/min general
- Helmet security headers and CORS configuration
- Health check endpoint at `/health`
- Auth routes: `/auth/register`, `/auth/login`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/forgot-password`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- Prisma schema with User, OtpToken, and RefreshToken models
- Environment validation with Zod schema that fails fast on missing config
- OTP security: HMAC-SHA256 with secret pepper, 10-minute expiry, single-use tokens
- Refresh token security: UUID hashed with SHA256, rotated on every use, revocation support

**Frontend (`/app`)**
- Supabase client helpers for browser and server (`@supabase/supabase-js`, `@supabase/ssr`)
- OAuth callback route at `/auth/callback` for Google and GitHub sign-in
- Middleware to refresh Supabase session on every request and protect `/dashboard` routes
- Login page wired to real API for email/password and Supabase OAuth
- Signup page wired to real API for email registration and Supabase OAuth
- OTP verification page wired to real `/auth/verify-otp` and `/auth/resend-otp` endpoints
- Forgot password page wired to real `/auth/forgot-password` endpoint
- Server error banners on auth pages with red styling
- Email parameter passing from signup to verify page via query string
- Verified success screen with redirect to `/dashboard`

**Landing page refinements**
- Removed Pricing section (open source, no pricing)
- Removed DeviceFrame section (redundant with Hero chat UI)
- Moved ClosingCTA to last position before Footer
- Added mobile CTA button to Header
- Expanded ModelMarquee from 14 to 20 models (added Grok 2, o1-mini, Claude 3 Haiku, Codestral, Llama 3.2 90B, o3-mini)
- Updated Footer to remove Pricing link, add Who it is for and FAQ anchors

**Documentation**
- WIKI.md updated with Authentication section linking to README
- CHANGELOG.md entry for v0.2.0
- README.md Authentication section added with flows, security, and setup details

### Changed

- Landing page section order: Hero, Problem, HowItWorks, Capabilities, ChatPreview, WhoItsFor, ModelMarquee, Testimonials, FAQ, Integrations, ClosingCTA, Footer
- All auth pages now call real API endpoints instead of simulated delays
- OAuth sign-in now redirects through Supabase and callback route

### Security

- OTP tokens are HMAC-SHA256 hashed with a secret pepper before storage
- Refresh tokens are UUID hashed with SHA256 and rotated on every use
- All credential error messages are generic to prevent email enumeration
- Password reset endpoint always returns success to prevent enumeration
- JWT access tokens expire in 15 minutes, refresh tokens in 30 days
- Rate limiting enforced on all auth mutation endpoints

## [0.1.0] - 2026-08-03

### Added

**Frontend**
- Complete marketing page with Hero, Problem, Capabilities, ChatPreview, DeviceFrame, ModelMarquee, Testimonials, ClosingCTA, and Integrations sections
- Chat-based Hero visualization showing user message bubble and AI structured prompt response with completeness score
- Problem section explaining the gap between vague input and unstated assumptions
- ChatPreview section with side-by-side chat exchange and inferred assumptions breakdown
- Two-row auto-scrolling testimonials marquee with real avatar images from i.pravatar.cc
- ModelMarquee with 14 AI models across two rows (Claude, GPT-4o, Gemini, Mistral, DeepSeek, Mixtral, Perplexity, Llama, Qwen, Command R+, Phi-3, etc.)
- Logo-only Integrations marquee showing compatible AI providers
- DeviceFrame section showing persistent workspace with prompt history
- Footer with large centered logo and centralized copyright block
- Header with mobile drawer navigation and CTA button
- ScrollToTop component for improved navigation
- Container component for universal section padding across all sections

**Documentation**
- System diagrams in README.md: architecture diagram, sequence diagram, data flow diagram, activity diagram, and component diagram using Mermaid syntax
- Updated WIKI.md to reference new system diagrams section
- Comprehensive CHANGELOG.md entry for initial release

**Styling**
- Dark theme with accent color (#F2A93B) and signal color (#8B7CF6)
- Tailwind CSS with custom color tokens
- Framer Motion animations for section reveals and interactive elements
- Responsive design with mobile-first approach
- Reduced motion support for accessibility

### Changed

- Hero section from CLI terminal to chat interface to align with chat-based product nature
- Testimonials from single-row dot navigation to two-row auto-scrolling marquee
- ModelMarquee expanded from 5+5 to 7+7 models with additional providers
- Footer layout to include large centered logo before copyright
- All sections now use shared Container component for consistent padding

### Notes

This is the initial release of Prompt AI, establishing the marketing site, documentation, and architectural foundation. The product is a chat-based tool that turns vague intent into structured prompts for AI models.
