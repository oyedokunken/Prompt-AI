# Changelog

All notable changes to this project are documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and versioning follows [Semantic Versioning](https://semver.org/).

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
