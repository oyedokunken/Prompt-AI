import OpenAI from "openai";

// A real-world corruption of this env var turned out to be the key text
// followed by literal garbage characters, not real whitespace, so a plain
// .trim() silently did nothing. A valid OpenAI secret key is only letters,
// digits, hyphens and underscores, so extracting the longest leading run of
// that character set recovers the real key regardless of what junk, real
// newline, literal backslash-n text, or anything else, got appended after
// it when the value was pasted into Vercel.
export function cleanOpenAiKey(raw: string): string {
  return raw.match(/^[A-Za-z0-9_-]+/)?.[0] ?? raw.trim();
}

const rawKey = process.env.OPENAI_API_KEY;

// Single shared client, this is the only place in the app that reads
// OPENAI_API_KEY, so there is exactly one place to check if it ever needs
// fixing again.
export const openai = rawKey ? new OpenAI({ apiKey: cleanOpenAiKey(rawKey) }) : null;
