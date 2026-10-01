import test from "node:test";
import assert from "node:assert/strict";
import { chatStreamSchema, MAX_INLINE_FILE_CHARS, MAX_MESSAGE_CHARS } from "./chat";

const session = "6f1c2b9e-3a47-4a8e-9d5b-1f2e3d4c5b6a";
const parse = (body: Record<string, unknown>) => chatStreamSchema.safeParse({ session_id: session, ...body });

test("a message at the limit is accepted and one character over is rejected with a clear message", () => {
  assert.equal(parse({ content: "x".repeat(MAX_MESSAGE_CHARS) }).success, true);
  const over = parse({ content: "x".repeat(MAX_MESSAGE_CHARS + 1) });
  assert.equal(over.success, false);
  assert.match(JSON.stringify(over.error?.issues), /characters/);
});

test("at most three attachments are accepted", () => {
  const file = (n: number) => ({ name: `f${n}.png`, type: "image/png", path: "", dataUrl: null });
  assert.equal(parse({ content: "hi", attachments: [file(1), file(2), file(3)] }).success, true);
  assert.equal(parse({ content: "hi", attachments: [file(1), file(2), file(3), file(4)] }).success, false);
});

test("an oversized inline file is rejected before it can be forwarded", () => {
  const big = "d".repeat(MAX_INLINE_FILE_CHARS + 1);
  assert.equal(parse({ content: "hi", attachments: [{ name: "a.png", type: "image/png", path: "", dataUrl: big }] }).success, false);
});

test("a message with neither text nor attachments is rejected", () => {
  assert.equal(parse({ content: "   " }).success, false);
});
