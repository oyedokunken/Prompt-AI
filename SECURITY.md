# Security Policy

## Reporting a Vulnerability

If you find a security vulnerability in Prompt AI, please do not open a public issue. Report it privately by emailing **oyedokunken@gmail.com** with a clear description of the issue, steps to reproduce it, and its potential impact.

You should expect an initial response within a few days. Once a fix is confirmed, credit will be given to the reporter unless anonymity is requested.

## Supported Versions

This project is in early, active development. Until a stable 1.0 release, security fixes are applied to the latest version on `main` only.

| Version | Supported |
|---|---|
| main (unreleased) | Yes |

## Security Practices

- All environment variables are validated at startup using Zod, so the application fails fast on missing or malformed configuration instead of running with an unsafe default.
- Authentication uses short lived JWT access tokens with refresh token rotation.
- The `/data` service is not exposed to end users directly. It only accepts requests from `/api`, authenticated with a shared service level secret.
- AI provider API keys are never exposed to the frontend. All provider calls happen server side.
- Rate limiting is enforced at the `/api` layer to prevent abuse of both the platform and upstream AI provider costs.
- Uploaded files are validated for type and size before processing, and any extracted content is treated as untrusted input, never concatenated directly into a system level prompt without isolation.
- Secrets are never committed to the repository. `.env.example` files show required variable names only, never real values.

## Scope

This policy covers the code in this repository. It does not cover third party AI providers integrated with Prompt AI, vulnerabilities in those systems should be reported directly to the provider.
