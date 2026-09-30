import type { RelevantMemory } from "./systemPrompt";

interface MemoryRow {
  category: string;
  key: string;
  value: string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "is", "are", "be",
  "that", "this", "it", "as", "at", "by", "from", "i", "me", "my", "you", "your", "want",
  "need", "please", "prompt", "write", "create", "build", "make", "generate", "can",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+.]+/i)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

// No vector search here, on purpose, most users will have a small memory
// store at this stage, so a cheap keyword-overlap heuristic gets most of
// the value without standing up embeddings and a similarity index. Always
// keeps identity-level memories (category "about") since those tend to be
// relevant regardless of the specific request, and otherwise ranks by how
// much the request's own words overlap with the memory's text.
export function selectRelevantMemories(
  allMemories: MemoryRow[],
  currentMessage: string,
  limit = 8
): RelevantMemory[] {
  if (allMemories.length === 0) return [];

  const queryWords = tokenize(currentMessage);
  const always = allMemories.filter((m) => m.category === "about");
  const rest = allMemories.filter((m) => m.category !== "about");

  const scored = rest
    .map((m) => {
      const memoryWords = tokenize(`${m.key} ${m.value}`);
      let overlap = 0;
      for (const w of memoryWords) if (queryWords.has(w)) overlap++;
      return { memory: m, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap)
    .filter((s) => s.overlap > 0)
    .map((s) => s.memory);

  const combined = [...always, ...scored].slice(0, limit);
  return combined.map((m) => ({ category: m.category, key: m.key, value: m.value }));
}
