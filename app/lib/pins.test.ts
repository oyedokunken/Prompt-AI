import test from "node:test";
import assert from "node:assert/strict";
import { readPinned, togglePinned, partitionPinned, MAX_PINS } from "./pins";
import type { ChatSession } from "./types/chat";

const chat = (id: string) => ({ id, title: id, updated_at: "2026-01-01" }) as unknown as ChatSession;

test("pins are read defensively from profile metadata", () => {
  assert.deepEqual(readPinned({ pinned_chats: ["a", 3, "b"] }), ["a", "b"]);
  assert.deepEqual(readPinned({}), []);
  assert.deepEqual(readPinned(null), []);
  assert.deepEqual(readPinned({ pinned_chats: "a" }), []);
});

test("toggling pins adds to the front and unpins in place", () => {
  assert.deepEqual(togglePinned(["a"], "b"), ["b", "a"]);
  assert.deepEqual(togglePinned(["b", "a"], "b"), ["a"]);
  const many = Array.from({ length: MAX_PINS }, (_, i) => `p${i}`);
  assert.equal(togglePinned(many, "new").length, MAX_PINS);
});

test("pinned chats come out first in pin order and are removed from the rest", () => {
  const sessions = [chat("a"), chat("b"), chat("c"), chat("d")];
  const { pinned, rest } = partitionPinned(sessions, ["c", "gone", "a"]);
  assert.deepEqual(pinned.map((s) => s.id), ["c", "a"]);
  assert.deepEqual(rest.map((s) => s.id), ["b", "d"]);
});
