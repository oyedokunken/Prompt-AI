import test from "node:test";
import assert from "node:assert/strict";
import { changePasswordSchema } from "./password";

const good = { currentPassword: "OldPassw0rd!", newPassword: "NewPassw0rd!x", confirmPassword: "NewPassw0rd!x" };

function messages(input: object): string[] {
  const r = changePasswordSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

test("a valid change passes", () => {
  assert.deepEqual(messages(good), []);
});

test("each signup rule is enforced with its own message", () => {
  assert.ok(messages({ ...good, newPassword: "Short1!", confirmPassword: "Short1!" }).some((m) => /at least 10/.test(m)));
  assert.ok(messages({ ...good, newPassword: "alllowercase1!", confirmPassword: "alllowercase1!" }).some((m) => /uppercase/.test(m)));
  assert.ok(messages({ ...good, newPassword: "ALLUPPERCASE1!", confirmPassword: "ALLUPPERCASE1!" }).some((m) => /lowercase/.test(m)));
  assert.ok(messages({ ...good, newPassword: "NoNumbersHere!", confirmPassword: "NoNumbersHere!" }).some((m) => /number/.test(m)));
  assert.ok(messages({ ...good, newPassword: "NoSymbolsHere12", confirmPassword: "NoSymbolsHere12" }).some((m) => /symbol/.test(m)));
});

test("the current password is required, the confirmation must match, the new one must differ", () => {
  assert.ok(messages({ ...good, currentPassword: "" }).some((m) => /current password/.test(m)));
  assert.ok(messages({ ...good, confirmPassword: "NewPassw0rd!y" }).some((m) => /do not match/.test(m)));
  assert.ok(messages({ currentPassword: "SamePassw0rd!", newPassword: "SamePassw0rd!", confirmPassword: "SamePassw0rd!" }).some((m) => /different/.test(m)));
});
