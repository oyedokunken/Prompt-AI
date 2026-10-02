import test from "node:test";
import assert from "node:assert/strict";
import { changePasswordSchema } from "./auth";

const good = { currentPassword: "OldPassw0rd!", newPassword: "NewPassw0rd!x" };

test("a valid password change passes", () => {
  assert.equal(changePasswordSchema.safeParse(good).success, true);
});

test("the new password must meet the signup rules", () => {
  for (const bad of ["Short1!", "alllowercase1!", "ALLUPPERCASE1!", "NoNumbersHere!", "NoSymbolsHere12"]) {
    assert.equal(changePasswordSchema.safeParse({ ...good, newPassword: bad }).success, false, bad);
  }
});

test("the current password is required and must differ from the new one", () => {
  assert.equal(changePasswordSchema.safeParse({ ...good, currentPassword: "" }).success, false);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: "SamePassw0rd!", newPassword: "SamePassw0rd!" }).success, false);
});
