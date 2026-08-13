# Prompt AI Wiki

This file is the index for Prompt AI's documentation. As the project grows, deeper guides live here or in `/docs`, and this page just points to the right place.

## Start Here

- [README.md](./README.md) for what Prompt AI is and how to run it, including system diagrams (architecture, sequence, data flow, activity, component)
- [ARCHITECTURE.md](./ARCHITECTURE.md) for how `/app`, `/api`, and `/data` fit together
- [CONTRIBUTING.md](./CONTRIBUTING.md) for how to submit changes
- [SECURITY.md](./SECURITY.md) for how to report a vulnerability
- [CHANGELOG.md](./CHANGELOG.md) for release history

## Service Documentation

- [`/app/README.md`](./app/README.md) for the frontend
- [`/api/README.md`](./api/README.md) for the backend
- [`/data/README.md`](./data/README.md) for the AI and ML layer
- [`/docs/README.md`](./docs/README.md) for architecture notes and pattern library docs

## Authentication

Prompt AI uses a hybrid authentication system combining Supabase OAuth (Google, GitHub) with a custom email + OTP flow powered by the `/api` service. See the Authentication section in [README.md](./README.md#authentication) for details on flows, security, and setup.

## Planned Wiki Sections

These sections don't exist yet. They are listed here so contributors know what's coming and can help build them.

- **Prompt Engineering Pattern Library.** The actual patterns Prompt AI uses to construct prompts, documented with examples, so contributors can propose new ones.
- **Model Integration Guide.** How to add support for a new target AI model in `/data`, including what the routing layer expects.
- **Scoring Rubric Reference.** The full breakdown of how a generated prompt is scored, so users understand what the number means.
- **API Reference.** Full endpoint documentation for `/api`, once the surface area stabilizes.
- **FAQ.** Common questions from users and contributors, added as they come up.

## Where This Lives Long Term

Once the project has enough contributors, this index may move to a proper GitHub Wiki instead of a root file. Until then, this file and `/docs` are the source of truth.
