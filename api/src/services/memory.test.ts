import test from "node:test";
import assert from "node:assert/strict";
import { planMemorySaves, MAX_SAVES_PER_TURN, type StoredMemory } from "./memory";

const existing: StoredMemory[] = [
  { id: "1", category: "skills", key: "Stack", value: "Go and Postgres", source: "conversation" },
  { id: "2", category: "about", key: "Role", value: "Backend engineer", source: "manual" },
];

test("a new stable fact is added", () => {
  const plan = planMemorySaves([{ category: "projects", key: "Side project", value: "A log parsing CLI", confidence: 0.9 }], existing);
  assert.equal(plan.inserts.length, 1);
  assert.deepEqual(plan.saved, [{ category: "projects", key: "Side project", value: "A log parsing CLI", action: "added" }]);
});

test("a changed fact updates the existing item instead of duplicating it", () => {
  const plan = planMemorySaves([{ category: "skills", key: "stack", value: "Rust", confidence: 0.9 }], existing);
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.updates[0]?.id, "1");
  assert.equal(plan.saved[0]?.action, "updated");
});

test("something the user wrote by hand is never overwritten", () => {
  const plan = planMemorySaves([{ category: "about", key: "Role", value: "CTO", confidence: 0.95 }], existing);
  assert.equal(plan.saved.length, 0);
});

test("repeats are dropped, by key or by value", () => {
  const plan = planMemorySaves(
    [
      { category: "skills", key: "Stack", value: "go and postgres", confidence: 0.9 },
      { category: "other", key: "Different label", value: "Backend engineer", confidence: 0.9 },
    ],
    existing
  );
  assert.equal(plan.saved.length, 0);
});

test("secrets and long digit runs are never stored", () => {
  const plan = planMemorySaves(
    [
      { category: "other", key: "Bank pin", value: "4821", confidence: 0.99 },
      { category: "other", key: "Note", value: "my api key is sk-abc", confidence: 0.99 },
      { category: "other", key: "Account", value: "Card 4111111111111111", confidence: 0.99 },
    ],
    []
  );
  assert.equal(plan.saved.length, 0);
});

test("low confidence proposals are skipped and a missing confidence is treated as fairly sure", () => {
  const plan = planMemorySaves(
    [
      { category: "skills", key: "Maybe", value: "Might like Zig", confidence: 0.3 },
      { category: "skills", key: "Language", value: "Writes Rust", confidence: null },
    ],
    []
  );
  assert.deepEqual(plan.saved.map((s) => s.key), ["Language"]);
});

test("unknown categories become other, and at most a few facts are saved per turn", () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ category: "weird", key: `Fact ${i}`, value: `Value ${i}`, confidence: 0.9 }));
  const plan = planMemorySaves(many, []);
  assert.equal(plan.saved.length, MAX_SAVES_PER_TURN);
  assert.ok(plan.saved.every((s) => s.category === "other"));
});

test("empty and oversized entries are ignored", () => {
  const plan = planMemorySaves(
    [
      { category: "other", key: "", value: "x", confidence: 0.9 },
      { category: "other", key: "k", value: "y".repeat(400), confidence: 0.9 },
    ],
    []
  );
  assert.equal(plan.saved.length, 0);
});
