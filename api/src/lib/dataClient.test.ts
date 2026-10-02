import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "x";
process.env.DATABASE_DIRECT_URL = "x";
process.env.SUPABASE_URL = "https://x.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
process.env.OTP_PEPPER = "p".repeat(32);
process.env.DATA_SERVICE_URL = "https://data.example.com/";
process.env.API_SHARED_SECRET = "unit-test-shared-secret";

test("a transcription ticket names the user, expires in a minute and is signed", async () => {
  const { mintTranscribeTicket } = await import("./dataClient");
  const { ticket, url } = mintTranscribeTicket("user-1", 1_000_000);
  const [user, expires, signature] = ticket.split(".");
  assert.equal(user, "user-1");
  assert.equal(Number(expires), 1000 + 60);
  assert.match(signature as string, /^[0-9a-f]{64}$/);
  assert.equal(url, "wss://data.example.com/transcribe/stream");
});
