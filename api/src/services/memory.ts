/**
 * Automatic memory saving.
 *
 * /data proposes stable facts it noticed in a conversation. /api owns the
 * database, so it decides what is actually stored. Nothing here waits for
 * the user to approve, the interface only reports what was saved. Guards
 * keep it from storing secrets, from saving the same fact twice, and from
 * overwriting anything the user entered by hand.
 */

export interface MemoryCandidate {
  category?: string;
  key?: string;
  value?: string;
  confidence?: number | null;
}

export interface StoredMemory {
  id: string;
  category: string;
  key: string;
  value: string;
  source?: string | null;
}

export interface SavedMemory {
  category: string;
  key: string;
  value: string;
  action: "added" | "updated";
}

export const MIN_CONFIDENCE = 0.6;
export const MAX_SAVES_PER_TURN = 3;
const MAX_KEY_LENGTH = 60;
const MAX_VALUE_LENGTH = 300;
const CATEGORIES = new Set(["about", "preferences", "projects", "skills", "other"]);

// Never store these, even if the model proposes them: credentials, financial
// and identity numbers, and long digit runs that look like either.
const SENSITIVE = /\b(password|passcode|passphrase|pin|secret|token|api[ _-]?key|private key|ssn|social security|credit card|card number|cvv|iban|account number|routing number)\b|\d{6,}/i;

function clean(text: unknown): string {
  return typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
}

export interface MemoryPlan {
  inserts: { category: string; key: string; value: string; confidence: number }[];
  updates: { id: string; category: string; key: string; value: string; confidence: number }[];
  saved: SavedMemory[];
}

/** Decides what to write. Pure, so it is easy to test without a database. */
export function planMemorySaves(candidates: MemoryCandidate[], existing: StoredMemory[]): MemoryPlan {
  const plan: MemoryPlan = { inserts: [], updates: [], saved: [] };
  const seen = new Set<string>();

  for (const c of candidates) {
    if (plan.saved.length >= MAX_SAVES_PER_TURN) break;
    const key = clean(c.key);
    const value = clean(c.value);
    if (!key || !value || key.length > MAX_KEY_LENGTH || value.length > MAX_VALUE_LENGTH) continue;
    if (SENSITIVE.test(key) || SENSITIVE.test(value)) continue;

    const confidence = typeof c.confidence === "number" ? c.confidence : 0.7;
    if (confidence < MIN_CONFIDENCE) continue;

    const category = CATEGORIES.has(c.category ?? "") ? (c.category as string) : "other";
    const slot = `${category}|${key.toLowerCase()}`;
    if (seen.has(slot)) continue;
    seen.add(slot);

    const sameKey = existing.find((m) => m.category === category && m.key.trim().toLowerCase() === key.toLowerCase());
    if (sameKey) {
      if (sameKey.value.trim().toLowerCase() === value.toLowerCase()) continue;
      // The user wrote this one themselves, their word stands.
      if (sameKey.source === "manual") continue;
      plan.updates.push({ id: sameKey.id, category, key, value, confidence });
      plan.saved.push({ category, key, value, action: "updated" });
      continue;
    }
    if (existing.some((m) => m.value.trim().toLowerCase() === value.toLowerCase())) continue;

    plan.inserts.push({ category, key, value, confidence });
    plan.saved.push({ category, key, value, action: "added" });
  }
  return plan;
}
