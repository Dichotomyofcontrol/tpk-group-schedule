import { test } from "node:test";
import assert from "node:assert/strict";
import { brandedSignInLink, normalizeEmail, safeOrigin, signInEmailHtml, signInEmailText, SIGNIN_SUBJECT } from "../../lib/signin-email.ts";
import { hitMemory, resetMemoryLimits } from "../../lib/rate-limit.ts";
import { sendViaResend } from "../../lib/send-link.ts";

const FB = "https://tpk-group-8cdc8.firebaseapp.com/__/auth/action?apiKey=AIzaX&mode=signIn&oobCode=CODE123&continueUrl=https%3A%2F%2Fwww.sixinthetpk.com%2Fauth%2Ffinish%3Finvite%3Dabc&lang=en";

test("normalizeEmail validates and lowercases", () => {
  assert.equal(normalizeEmail("  Seth@Example.COM "), "seth@example.com");
  for (const bad of ["", "nope", "a@b", "a b@c.com", 42, null, "x@y.c", `${"a".repeat(260)}@x.com`]) assert.equal(normalizeEmail(bad), null);
});

test("safeOrigin only allows our hosts", () => {
  assert.equal(safeOrigin("https://www.sixinthetpk.com"), "https://www.sixinthetpk.com");
  assert.equal(safeOrigin("https://tpk-git-x.vercel.app"), "https://tpk-git-x.vercel.app");
  assert.equal(safeOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(safeOrigin("https://evil.com"), "https://www.sixinthetpk.com");
  assert.equal(safeOrigin("http://www.sixinthetpk.com"), "https://www.sixinthetpk.com");
  assert.equal(safeOrigin(null), "https://www.sixinthetpk.com");
});

test("brandedSignInLink keeps continue URL and action params on our domain", () => {
  const out = new URL(brandedSignInLink(FB, "https://www.sixinthetpk.com/auth/finish?invite=abc"));
  assert.equal(out.origin + out.pathname, "https://www.sixinthetpk.com/auth/finish");
  assert.equal(out.searchParams.get("invite"), "abc");
  assert.equal(out.searchParams.get("oobCode"), "CODE123");
  assert.equal(out.searchParams.get("apiKey"), "AIzaX");
  assert.equal(out.searchParams.get("mode"), "signIn");
});

test("brandedSignInLink falls back on unexpected links", () => {
  const odd = "https://tpk-group-8cdc8.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=x&apiKey=y";
  assert.equal(brandedSignInLink(odd, "https://www.sixinthetpk.com/auth/finish"), odd);
  assert.equal(brandedSignInLink("not a url", "https://www.sixinthetpk.com/auth/finish"), "not a url");
});

test("email html/text contain the link, button, copy and escape it", () => {
  const link = "https://www.sixinthetpk.com/auth/finish?a=1&b=\"2\"";
  const html = signInEmailHtml(link);
  assert.match(html, />Sign in</);
  assert.match(html, /a=1&amp;b=&quot;2&quot;/);
  assert.doesNotMatch(html, /b="2"/);
  assert.match(html, /ignore this email/);
  const text = signInEmailText(link);
  assert.ok(text.includes(link));
  assert.match(SIGNIN_SUBJECT, /Six in the TPK/);
});

test("memory rate limit windows", () => {
  resetMemoryLimits();
  assert.ok(hitMemory("k", 2, 1000, 0));
  assert.ok(hitMemory("k", 2, 1000, 1));
  assert.ok(!hitMemory("k", 2, 1000, 2));
  assert.ok(hitMemory("k", 2, 1000, 1001));
});

test("sendViaResend posts subject, from, html and text", async () => {
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "test-key";
  process.env.EMAIL_FROM = "Six in the TPK <noreply@mail.sixinthetpk.com>";
  let sent: { url: string; body: Record<string, unknown> } | null = null;
  const fake = (async (url: string, init: RequestInit) => { sent = { url, body: JSON.parse(String(init.body)) }; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  assert.ok(await sendViaResend("a@b.co", "https://www.sixinthetpk.com/auth/finish?x=1", fake));
  assert.equal(sent!.url, "https://api.resend.com/emails");
  assert.equal(sent!.body.subject, SIGNIN_SUBJECT);
  assert.equal(sent!.body.from, "Six in the TPK <noreply@mail.sixinthetpk.com>");
  assert.ok(sent!.body.text && sent!.body.html);
});
