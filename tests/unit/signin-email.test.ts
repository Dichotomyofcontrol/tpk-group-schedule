import { test } from "node:test";
import assert from "node:assert/strict";
import { brandedSignInLink, normalizeEmail, safeOrigin, signInEmailHtml, signInEmailText, SIGNIN_SUBJECT } from "../../lib/signin-email.ts";
import { hitMemory, resetMemoryLimits } from "../../lib/rate-limit.ts";
import { DEFAULT_EMAIL_FROM, sendViaResend } from "../../lib/send-link.ts";

const FB = "https://tpk-group-8cdc8.firebaseapp.com/__/auth/action?apiKey=AIzaX&mode=signIn&oobCode=CODE123&continueUrl=https%3A%2F%2Ftaverning.com%2Fauth%2Ffinish%3Finvite%3Dabc&lang=en";

test("normalizeEmail validates and lowercases", () => {
  assert.equal(normalizeEmail("  Seth@Example.COM "), "seth@example.com");
  for (const bad of ["", "nope", "a@b", "a b@c.com", 42, null, "x@y.c", `${"a".repeat(260)}@x.com`]) assert.equal(normalizeEmail(bad), null);
});

test("safeOrigin only allows our hosts", () => {
  assert.equal(safeOrigin("https://taverning.com"), "https://taverning.com");
  assert.equal(safeOrigin("https://www.taverning.com"), "https://taverning.com");
  assert.equal(safeOrigin("https://sixinthetpk.com"), "https://taverning.com");
  assert.equal(safeOrigin("https://www.sixinthetpk.com"), "https://taverning.com");
  assert.equal(safeOrigin("https://tpk-git-x.vercel.app"), "https://tpk-git-x.vercel.app");
  assert.equal(safeOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(safeOrigin("https://evil.com"), "https://taverning.com");
  assert.equal(safeOrigin("http://www.sixinthetpk.com"), "https://taverning.com");
  assert.equal(safeOrigin(null), "https://taverning.com");
});

test("brandedSignInLink keeps continue URL and action params on our domain", () => {
  const out = new URL(brandedSignInLink(FB, "https://taverning.com/auth/finish?invite=abc"));
  assert.equal(out.origin + out.pathname, "https://taverning.com/auth/finish");
  assert.equal(out.searchParams.get("invite"), "abc");
  assert.equal(out.searchParams.get("oobCode"), "CODE123");
  assert.equal(out.searchParams.get("apiKey"), "AIzaX");
  assert.equal(out.searchParams.get("mode"), "signIn");
});

test("brandedSignInLink falls back on unexpected links", () => {
  const odd = "https://tpk-group-8cdc8.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=x&apiKey=y";
  assert.equal(brandedSignInLink(odd, "https://taverning.com/auth/finish"), odd);
  assert.equal(brandedSignInLink("not a url", "https://taverning.com/auth/finish"), "not a url");
});

test("email html/text contain the code, the link, and escape it", () => {
  const link = "https://taverning.com/auth/finish?a=1&b=\"2\"";
  const html = signInEmailHtml(link, "482913");
  assert.match(html, />Sign in</);
  assert.match(html, /482913|4<\/td>.*9<\/td>/s);
  assert.match(html, />4<\/td>/);
  assert.match(html, /a=1&amp;b=&quot;2&quot;/);
  assert.doesNotMatch(html, /b="2"/);
  assert.match(html, /ignore this email/);
  assert.match(html, /https:\/\/taverning\.com/);
  assert.match(html, /Home Screen app/);
  assert.doesNotMatch(html, /sixinthetpk/);
  const text = signInEmailText(link, "482913");
  assert.ok(text.includes(link));
  assert.match(text, /482913/);
  assert.match(text, /15 minutes/);
  assert.match(text, /Taverning/);
  assert.match(SIGNIN_SUBJECT, /Taverning/);
  assert.match(SIGNIN_SUBJECT, /code/);
  assert.doesNotMatch(SIGNIN_SUBJECT, /Six in the TPK/);
});

test("memory rate limit windows", () => {
  resetMemoryLimits();
  assert.ok(hitMemory("k", 2, 1000, 0));
  assert.ok(hitMemory("k", 2, 1000, 1));
  assert.ok(!hitMemory("k", 2, 1000, 2));
  assert.ok(hitMemory("k", 2, 1000, 1001));
});

test("sendViaResend posts the code and reports a rejected from-domain", async () => {
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "test-key";
  const previous = process.env.EMAIL_FROM;
  delete process.env.EMAIL_FROM;
  let sent: { url: string; body: Record<string, unknown> } | null = null;
  const fake = (async (url: string, init: RequestInit) => { sent = { url, body: JSON.parse(String(init.body)) }; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  const ok = await sendViaResend("a@b.co", "https://taverning.com/auth/finish?x=1", "482913", fake);
  assert.deepEqual(ok, { ok: true });
  assert.equal(sent!.url, "https://api.resend.com/emails");
  assert.equal(sent!.body.subject, SIGNIN_SUBJECT);
  assert.equal(sent!.body.from, DEFAULT_EMAIL_FROM);
  assert.match(String(sent!.body.text), /482913/);
  assert.match(String(sent!.body.html), />4</);
  const denied = (async () => new Response(JSON.stringify({ message: "The mail.taverning.com domain is not verified." }), { status: 403, statusText: "Forbidden" })) as unknown as typeof fetch;
  const bad = await sendViaResend("a@b.co", "https://taverning.com/auth/finish?x=1", "482913", denied);
  assert.deepEqual(bad, { ok: false, status: 403, reason: "The mail.taverning.com domain is not verified." });
  if (previous === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = previous;
});
