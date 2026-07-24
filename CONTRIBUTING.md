# Contributing to Prompt AI

Prompt AI is open source and built in public. Contributions of any size are welcome, from fixing a typo to designing a new part of the ML pipeline. This project is currently focused on developers as its primary audience, keep that in mind when proposing features.

## Before You Start

Read `ARCHITECTURE.md` first. It explains how `/app`, `/api`, and `/data` are separated and why, which will save you time deciding where a change belongs.

## Getting Set Up

Each folder is independently runnable and has its own README with setup instructions:

- `/app` for the frontend
- `/api` for the backend
- `/data` for the ML and LLM service

Copy each service's `.env.example` file and fill in the values before running it locally.

## Branching and Commits

1. Fork the repository.
2. Create a feature branch off `main`, named descriptively: `feature/prompt-scoring-rubric`, `fix/jwt-refresh-bug`, `docs/update-api-readme`.
3. Write clear, descriptive commit messages. Prefer several small, well described commits over one large unclear one.
4. Keep pull requests focused on a single change. Unrelated fixes should be separate pull requests.

## Pull Requests

1. Push your branch and open a pull request against `main`.
2. Reference any related issue in the description.
3. Describe what changed and why, not just what.
4. All pull requests run through CI, linting, type checks, and tests, before review.
5. Be responsive to review feedback. Discussion on technical direction is welcome and expected.

## Code Style

- TypeScript across `/app` and `/api`, following the project ESLint and Prettier configuration.
- Python in `/data`, following standard formatting conventions, type hints required on public functions.
- No unexplained magic numbers or unlabelled constants, especially anything related to rate limits, token limits, or scoring thresholds.

## What to Work On

Check open issues labeled `good first issue` for a starting point. If you want to propose a larger feature, especially anything touching `/data`, open an issue first to discuss the approach before writing code. This avoids wasted work on both sides.

## Reporting Bugs

Open an issue with steps to reproduce, expected behavior, and actual behavior. Include which service the bug is in if you know.

## Code of Conduct

Be direct, be respectful, and assume good intent. Disagreements about technical direction are welcome. Personal attacks are not.
