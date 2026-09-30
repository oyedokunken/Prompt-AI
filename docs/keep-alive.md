# Keep Alive Workflow

The project's backend services run on free tiers, and two of them go idle without regular traffic:

- Render (`prompt-ai-data.onrender.com`) spins down the data service after about 15 minutes of no incoming requests. The next request after that wakes it back up, but can take 30 seconds or more, long enough that a first time visitor may assume the product is broken.
- Supabase pauses the whole project after 7 days with no API activity. This is a harder failure than Render's, a paused project stops serving requests entirely until it is manually resumed from the Supabase dashboard.

Vercel is not part of this. The frontend and the `/api` service both run as Vercel functions, which are invoked on demand and have no persistent process that can idle out on the free tier, so there is nothing for a keep-alive to prevent there.

## What the workflow does

`.github/workflows/keep-alive.yml` runs on a schedule, every 10 minutes, using GitHub Actions. This interval is deliberately tighter than Render's 15 minute idle threshold, since GitHub Actions scheduled runs are not guaranteed to fire at the exact minute and can be delayed on busy queues.

Each run does two things:

1. Sends a `GET` request to the Render data service's `/health` endpoint.
2. Sends an authenticated `GET` request against the `chat_sessions` table (`{SUPABASE_URL}/rest/v1/chat_sessions?select=id&limit=1`) using the project's anon key. A plain network request to Supabase does not count as project activity, it has to be a real authenticated API call, which is what this step makes. Row level security means this always returns an empty result for an unauthenticated anon request rather than real data, which is fine, the call only needs to register as activity. The bare `/rest/v1/` root endpoint was tried first but returned 401 with the anon key, Supabase restricts that particular introspection endpoint to the service role key, so a real table is used instead.

A failed ping (non 2xx response or a timeout) is logged and shown as a failed step in the Actions tab, but it does not fail the whole workflow run. Render in particular can briefly return a non 2xx response while it is still waking up from a previous cold start, so a single bad ping is expected occasionally and is not treated as an incident.

Every run prints a short summary, which service was pinged, its response status, and its response time, both to the job log and to the run's summary page. The Actions tab doubles as a lightweight uptime log without needing a separate monitoring tool.

## Required repository secrets

The workflow needs two repository secrets to ping Supabase. Without them, the Supabase step logs that the secrets are missing and skips itself rather than erroring out.

Set these under the repository's Settings, then Secrets and variables, then Actions:

- `SUPABASE_URL`, the project's Supabase URL
- `SUPABASE_ANON_KEY`, the project's public anon key

Both values already exist in the app's environment configuration (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`), so no new keys need to be generated, they just need to be copied into GitHub Actions secrets under these names.

This step has to be done once by hand. GitHub does not allow repository secrets to be set through a workflow file or from outside the GitHub UI or API with an authenticated account, so anyone forking or cloning this setup needs to add both secrets themselves before the Supabase ping will do anything.
