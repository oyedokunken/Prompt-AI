import { createBrowserClient } from "@supabase/ssr";

// Right after signing in, the database can briefly see a fresh token as issued
// a moment in the future, because its clock is a few seconds behind the auth
// server's. Every query in that window fails with a 401 naming the problem. It
// is transient and harmless, so every request waits it out and retries instead
// of each screen having to handle it.
const SKEW_PATTERN = /issued at future/i;
const SKEW_RETRIES = 3;
const SKEW_DELAY_MS = 1500;

async function fetchWithSkewRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response = await fetch(input, init);
  for (let attempt = 0; attempt < SKEW_RETRIES && response.status === 401; attempt++) {
    const body = await response.clone().text().catch(() => "");
    if (!SKEW_PATTERN.test(body)) break;
    await new Promise((resolve) => setTimeout(resolve, SKEW_DELAY_MS));
    response = await fetch(input, init);
  }
  return response;
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    { global: { fetch: fetchWithSkewRetry } }
  );
}
