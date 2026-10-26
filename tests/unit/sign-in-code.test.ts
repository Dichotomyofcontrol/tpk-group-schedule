import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MemorySignInCodes,
  SIGNIN_CODE_TTL_MS,
  generateSignInCode,
  hashSignInCode,
  parseSignInCode,
} from "../../lib/sign-in-code.ts";

test("a sign-in code is six digits and the parser rejects anything else", () => {
  assert.equal(generateSignInCode(() => 42), "000042");
  assert.equal(parseSignInCode(" 482 913 "), "482913");
  for (const bad of ["12345", "1234567", "12ab56", "", 482913, null]) assert.equal(parseSignInCode(bad), null);
});

test("a code is single-use, expires, and locks after repeated misses", () => {
  const store = new MemorySignInCodes();
  const email = "player@example.com";
  const now = 1_000_000;
  store.save({
    email,
    codeHash: hashSignInCode(email, "482913"),
    link: "https://taverning.com/auth/finish?oobCode=once",
    expiresAt: now + SIGNIN_CODE_TTL_MS,
    attempts: 0,
  });
  assert.deepEqual(store.redeem(email, "000000", now), { ok: false, error: "invalid" });
  assert.equal(store.has(email), true);
  for (let i = 0; i < 3; i++) assert.deepEqual(store.redeem(email, "111111", now), { ok: false, error: "invalid" });
  assert.deepEqual(store.redeem(email, "111111", now), { ok: false, error: "invalid" });
  assert.equal(store.has(email), false);

  store.save({
    email,
    codeHash: hashSignInCode(email, "482913"),
    link: "https://taverning.com/auth/finish?oobCode=once",
    expiresAt: now + SIGNIN_CODE_TTL_MS,
    attempts: 0,
  });
  assert.deepEqual(store.redeem(email, "482913", now + SIGNIN_CODE_TTL_MS), { ok: false, error: "expired" });
  assert.equal(store.has(email), false);

  store.save({
    email,
    codeHash: hashSignInCode(email, "482913"),
    link: "https://taverning.com/auth/finish?oobCode=once",
    expiresAt: now + SIGNIN_CODE_TTL_MS,
    attempts: 0,
  });
  assert.deepEqual(store.redeem(email, "482913", now), { ok: true, link: "https://taverning.com/auth/finish?oobCode=once" });
  assert.deepEqual(store.redeem(email, "482913", now), { ok: false, error: "invalid" });
  assert.equal(store.has(email), false);
});

test("the client never falls back to Firebase's default sign-in email, and codes stay server-only", () => {
  const client = readFileSync(new URL("../../lib/firebase-provider.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../app/api/auth/send-link/route.ts", import.meta.url), "utf8");
  const rules = readFileSync(new URL("../../firebase/firestore.rules", import.meta.url), "utf8");
  assert.doesNotMatch(client, /sendSignInLinkToEmail/);
  assert.match(route, /refusing Firebase fallback \(Resend/);
  assert.match(route, /RESEND_API_KEY is not set/);
  assert.doesNotMatch(route, /fallback:\s*true/);
  assert.match(rules, /match \/signInCodes\/\{id\} \{\s*allow read, write: if false;/);
});
