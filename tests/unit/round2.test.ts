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
