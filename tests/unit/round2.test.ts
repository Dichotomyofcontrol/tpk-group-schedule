import test from "node:test";
import assert from "node:assert/strict";
import { dedupeMembers, sessionFiles } from "../../lib/model";
import type { Member, Session } from "../../lib/types";

const m = (over: Partial<Member>): Member => ({ id: "x", uid: "x", displayName: "Seth", email: "s@x.com", role: "organizer", ...over } as Member);

test("dedupeMembers keeps one row per email, preferring the signed-in uid", () => {
  const out = dedupeMembers([m({ id: "old", uid: "old" }), m({ id: "live", uid: "live" }), m({ id: "b", uid: "b", email: "b@x.com" })], "live");
  assert.equal(out.length, 2);
  assert.ok(out.some((x) => x.id === "live"));
  assert.ok(!out.some((x) => x.id === "old"));
});

test("sessionFiles lists the legacy PDF once plus nested files", () => {
  const s = { id: "s1", pdfPath: "recaps/s1_a.pdf", pdfName: "a.pdf", extraPdfs: [{ path: "recaps/s1_a.pdf", name: "a.pdf" }, { path: "recaps/c/s1/1-b.pdf", name: "b.pdf" }] } as unknown as Session;
  const files = sessionFiles(s);
  assert.deepEqual(files.map((f) => f.name), ["a.pdf", "b.pdf"]);
});

test("countPdfPages reads page objects", async () => {
  const { countPdfPages } = await import("../../lib/recap");
  const pdf = new Blob(["%PDF-1.4 1 0 obj <</Type /Pages /Count 2>> 2 0 obj <</Type /Page>> 3 0 obj <</Type/Page>>"]);
  assert.equal(await countPdfPages(pdf), 2);
  assert.equal(await countPdfPages(new Blob(["nothing"])), undefined);
});

test("untitled sessions read as Session N, never the campaign name twice", async () => {
  const { sessionTitle, ownTitle } = await import("../../lib/model");
  const c = { id: "c", name: "ZZ Camp" };
  const s = (id: string, at: string, title = "") => ({ id, cid: "c", startsAt: at, status: "scheduled", title });
  const state = { campaigns: [c], sessions: [s("a", "2026-01-01", "ZZ Camp"), s("b", "2026-01-08"), s("x", "2026-01-15", "The Heist")] } as never;
  assert.equal(sessionTitle(state, (state as { sessions: never[] }).sessions[0]), "Session 1");
  assert.equal(sessionTitle(state, (state as { sessions: never[] }).sessions[1]), "Session 2");
  assert.equal(sessionTitle(state, (state as { sessions: never[] }).sessions[2]), "The Heist");
  assert.equal(ownTitle({ title: "zz camp" }, "ZZ Camp"), "");
});
