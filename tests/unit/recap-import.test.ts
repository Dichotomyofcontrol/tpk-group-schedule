import { test } from "node:test";
import assert from "node:assert/strict";
import { pastSessions } from "../../lib/model.ts";
import { hasRecap, markdownToHtml } from "../../lib/recap.ts";
import { stripHtml } from "../../lib/sanitize.ts";
import {
  addCalendarDays, legacySessionId, legacySessionRecord, parseRecapImport, publishRecap, sessionLocalDate,
  type CampaignRec, type RecapDeps, type RecapImportInput, type StoredSession,
} from "../../lib/recap-import.ts";
import { TPK_PLACE, TPK_TZ, localDate } from "../../lib/tpk-rules.ts";

const NOW = new Date("2026-10-25T18:00:00.000Z");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF");
const B64 = PDF.toString("base64");

function input(over: Partial<RecapImportInput> = {}): RecapImportInput {
  return {
    cid: "strahd",
    date: "2024-03-15",
    markdown: "## The vineyard\n\nThe gem **stayed**.",
    filename: "Session 15.pdf",
    pdf: PDF,
    overwrite: false,
    dryRun: false,
    createIfMissing: false,
    forceCreate: false,
    ...over,
  };
}

function memory(sessions: StoredSession[] = [], campaign: CampaignRec | null = { name: "Curse of Strahd", defaultLocation: "TPK Brewing" }) {
  const docs = new Map(sessions.map((session) => [session.id, { ...session }]));
  const pdfs = new Map<string, Buffer>();
  const deleted: string[] = [];
  let camp = campaign ? { ...campaign } : null;
  let campaignWrites = 0;
  const deps: RecapDeps = {
    now: NOW,
    async loadCampaign() { return camp ? { ...camp } : null; },
    async loadSessions() { return [...docs.values()].map((session) => ({ ...session })); },
    async createSession(_cid, sid, data) {
      if (docs.has(sid)) return false;
      docs.set(sid, { id: sid, ...(data as Omit<StoredSession, "id">) });
      return true;
    },
    async mergeSession(_cid, sid, data) {
      const prev = docs.get(sid) || { id: sid };
      const next = { ...prev, ...data };
      for (const [key, value] of Object.entries(data)) if (value === null) delete (next as Record<string, unknown>)[key];
      docs.set(sid, next as StoredSession);
    },
    async mergeCampaign(_cid, data) {
      campaignWrites += 1;
      camp = { ...(camp || { name: "Curse of Strahd", defaultLocation: "" }), ...data };
    },
    async savePdf(path, bytes) { pdfs.set(path, Buffer.from(bytes)); },
    async removePdf(path) { deleted.push(path); pdfs.delete(path); },
  };
  return { deps, docs, pdfs, deleted, campaignWrites, campaign: () => camp };
}

const night = (id: string, startsAt: string, over: Partial<StoredSession> = {}): StoredSession => ({
  id, startsAt, endsAt: new Date(new Date(startsAt).getTime() + 4 * 3600_000).toISOString(),
  tz: TPK_TZ, title: "Curse of Strahd", status: "scheduled", location: "TPK Brewing", ...over,
});

test("parser accepts the archivist payload and rejects a bad date", () => {
  const ok = parseRecapImport({ cid: "Strahd", date: "2024-03-15", recapMarkdown: "Hello", filename: "a.pdf", pdfBase64: B64, dryRun: true });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.cid, "strahd");
    assert.equal(ok.value.dryRun, true);
    assert.equal(ok.value.createIfMissing, false);
    assert.equal(ok.value.pdf.length, PDF.length);
  }
  const bad = parseRecapImport({ cid: "strahd", date: "2024-02-31", markdown: "Hello", filename: "a.pdf", pdfBase64: B64 });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.status, 400);
  const flags = parseRecapImport({ cid: "strahd", date: "2024-03-15", markdown: "Hello", filename: "a.pdf", pdfBase64: B64, createIfMissing: "yes" });
  assert.equal(flags.ok, false);
});

test("LA play date follows startsAt, not a moved occurrenceKey", () => {
  const winter = "2024-01-16T02:00:00.000Z"; // 6:00 PM PST on Jan 15
  const summer = "2024-07-16T01:00:00.000Z"; // 6:00 PM PDT on Jul 15
  assert.equal(sessionLocalDate({ startsAt: winter, occurrenceKey: "2024-01-16" }), "2024-01-15");
  assert.equal(sessionLocalDate({ startsAt: summer }), "2024-07-15");
  assert.equal(sessionLocalDate({ startsAt: "2024-03-15T00:00:00.000Z" }), "2024-03-14");
  assert.equal(sessionLocalDate({ occurrenceKey: "2024-03-15" }), "2024-03-15");
  assert.equal(addCalendarDays("2024-03-01", -1), "2024-02-29");
});

test("a single matching night gets the recap the editor would save", async () => {
  const store = memory([night("strahd-2024-03-15", "2024-03-16T01:00:00.000Z", { occurrenceKey: "2024-03-15", notes: "Bring dice" })]);
  const res = await publishRecap(store.deps, input());
  assert.equal(res.status, 200);
  assert.equal(res.body.created, false);
  const saved = store.docs.get("strahd-2024-03-15")!;
  assert.equal(saved.notes, "Bring dice");
  assert.equal(saved.recapMarkdown, input().markdown);
  assert.equal(saved.recapHtml, markdownToHtml(input().markdown));
  assert.match(String(saved.recapHtml), /<h2>The vineyard<\/h2><p>The gem <strong>stayed<\/strong>\.<\/p>/);
  assert.equal(saved.recapText, stripHtml(String(saved.recapHtml)));
  assert.equal(saved.pdfPath, "recaps/strahd/strahd-2024-03-15/Session_15.pdf");
  assert.equal(saved.pdfName, "Session 15.pdf");
  assert.equal(saved.pdfSize, PDF.length);
  assert.equal(saved.pdfPages, 1);
  assert.equal(saved.pdfUrl, undefined);
  assert.equal(store.pdfs.get(String(saved.pdfPath))?.equals(PDF), true);
  assert.equal(store.campaign()?.previouslyOn, saved.recapText);
  assert.equal(store.campaign()?.previouslyOnSessionId, "strahd-2024-03-15");
});

test("dry run writes nothing and returns the match", async () => {
  const store = memory([night("s1", "2024-03-16T01:00:00.000Z")]);
  const res = await publishRecap(store.deps, input({ dryRun: true }));
  assert.equal(res.status, 200);
  assert.equal(res.body.dryRun, true);
  assert.equal((res.body.session as { id: string }).id, "s1");
  assert.equal(store.docs.get("s1")?.recapText, undefined);
  assert.equal(store.pdfs.size, 0);
  assert.equal(store.campaignWrites, 0);
});

test("zero or several matches is 409 and includes the neighboring nights", async () => {
  const store = memory([
    night("before", "2024-03-15T02:00:00.000Z"), // Mar 14 LA
    night("after", "2024-03-16T07:00:00.000Z"), // Mar 16 LA
    night("far", "2024-03-20T02:00:00.000Z"),
  ]);
  const none = await publishRecap(store.deps, input());
  assert.equal(none.status, 409);
  assert.equal(none.body.reason, "none");
  const ids = (none.body.candidates as { id: string; offsetDays: number }[]).map((row) => `${row.id}:${row.offsetDays}`);
  assert.deepEqual(ids, ["before:-1", "after:1"]);
  assert.equal(store.pdfs.size, 0);

  const both = memory([
    night("a", "2024-03-16T01:00:00.000Z"),
    night("b", "2024-03-16T02:00:00.000Z", { status: "cancelled" }),
    night("side", "2024-03-15T02:00:00.000Z"),
  ]);
  const ambiguous = await publishRecap(both.deps, input({ createIfMissing: true, forceCreate: true }));
  assert.equal(ambiguous.status, 409);
  assert.equal(ambiguous.body.reason, "ambiguous");
  assert.deepEqual((ambiguous.body.matches as { id: string }[]).map((row) => row.id).sort(), ["a", "b"]);
  assert.ok((ambiguous.body.candidates as { id: string }[]).some((row) => row.id === "side"));
  assert.equal(both.docs.size, 3);
});

test("an existing recap or PDF is kept unless overwrite is set", async () => {
  const text = memory([night("s1", "2024-03-16T01:00:00.000Z", { recapText: "Already told." })]);
  const blocked = await publishRecap(text.deps, input());
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.reason, "exists");
  assert.equal(text.docs.get("s1")?.recapText, "Already told.");

  const handout = memory([night("s1", "2024-03-16T01:00:00.000Z", { extraPdfs: [{ path: "recaps/handout.pdf", name: "handout.pdf" }] })]);
  assert.equal((await publishRecap(handout.deps, input())).status, 409);

  const replaced = memory([night("s1", "2024-03-16T01:00:00.000Z", {
    pdfPath: "recaps/strahd/s1/old.pdf", pdfName: "old.pdf", pdfUrl: "https://example.invalid/secret",
    extraPdfs: [{ path: "recaps/handout.pdf", name: "handout.pdf" }], notes: "keep",
  })]);
  const ok = await publishRecap(replaced.deps, input({ overwrite: true, pdfPages: 8, filename: "fresh.pdf" }));
  assert.equal(ok.status, 200);
  const saved = replaced.docs.get("s1")!;
  assert.equal(saved.pdfPath, "recaps/strahd/s1/fresh.pdf");
  assert.equal(saved.pdfPages, 8);
  assert.equal(saved.pdfUrl, undefined);
  assert.equal(saved.notes, "keep");
  assert.equal(saved.extraPdfs?.[0]?.path, "recaps/handout.pdf");
  assert.deepEqual(replaced.deleted, ["recaps/strahd/s1/old.pdf"]);

  const legacy = memory([night("s1", "2024-03-16T01:00:00.000Z", { pdfPath: "recaps/2024-03-15_notes.pdf", pdfName: "notes.pdf" })]);
  await publishRecap(legacy.deps, input({ overwrite: true }));
  assert.deepEqual(legacy.deleted, []);
  assert.equal(legacy.docs.get("s1")?.pdfPath, "recaps/strahd/s1/Session_15.pdf");
});

test("createIfMissing backfills a past legacy night and refuses a neighbor", async () => {
  const empty = memory([]);
  const dry = await publishRecap(empty.deps, input({ createIfMissing: true, dryRun: true }));
  assert.equal(dry.status, 200);
  assert.equal(dry.body.created, true);
  assert.equal(empty.docs.size, 0);
  assert.equal(empty.pdfs.size, 0);

  const made = await publishRecap(empty.deps, input({ createIfMissing: true }));
  assert.equal(made.status, 200);
  const sid = legacySessionId("2024-03-15");
  const saved = empty.docs.get(sid)!;
  const shaped = legacySessionRecord("strahd", "2024-03-15", { name: "Curse of Strahd", defaultLocation: "TPK Brewing" });
  assert.equal(saved.occurrenceKey, "2024-03-15");
  assert.equal(saved.tz, "America/Los_Angeles");
  assert.equal(saved.status, "scheduled");
  assert.equal(saved.title, "Curse of Strahd");
  assert.equal(saved.location, TPK_PLACE);
  assert.equal(saved.seriesId, null);
  assert.equal(saved.seq, 0);
  assert.deepEqual(saved.attendance, {});
  assert.equal(saved.startsAt, shaped.startsAt);
  assert.equal(saved.endsAt, shaped.endsAt);
  assert.equal(localDate(String(saved.startsAt), TPK_TZ), "2024-03-15");
  assert.equal(new Date(String(saved.endsAt)).getTime() - new Date(String(saved.startsAt)).getTime(), 4 * 3600_000);
  assert.equal(saved.recapText, stripHtml(markdownToHtml(input().markdown)));
  assert.equal(saved.pdfPath, `recaps/strahd/${sid}/Session_15.pdf`);
  assert.ok(new Date(String(saved.endsAt)).getTime() < NOW.getTime());
  const visible = pastSessions({ campaigns: [{ id: "strahd" }], sessions: [{ ...saved, cid: "strahd", attendance: [], requireRsvps: null, seq: 0 }] } as never, "strahd", NOW);
  assert.equal(visible.filter((session) => session.status === "scheduled" && hasRecap(session)).length, 1);

  const again = await publishRecap(empty.deps, input({ createIfMissing: true }));
  assert.equal(again.status, 409);
  assert.equal(again.body.reason, "exists");
  assert.equal(empty.docs.size, 1);

  const neighbor = memory([night("near", "2024-03-15T02:00:00.000Z")]);
  const blocked = await publishRecap(neighbor.deps, input({ createIfMissing: true }));
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.reason, "neighbor");
  assert.deepEqual((blocked.body.candidates as { id: string }[]).map((row) => row.id), ["near"]);
  assert.equal(neighbor.docs.size, 1);

  const forced = await publishRecap(neighbor.deps, input({ createIfMissing: true, forceCreate: true }));
  assert.equal(forced.status, 200);
  assert.equal(forced.body.created, true);
  assert.ok(neighbor.docs.has(sid));
  assert.equal(neighbor.docs.size, 2);

  const ahead = memory([]);
  const future = await publishRecap(ahead.deps, input({ date: "2026-10-25", createIfMissing: true }));
  assert.equal(future.status, 400);
  assert.equal(ahead.docs.size, 0);
});

test("an older night does not replace Previously on, and a missing campaign is 404", async () => {
  const store = memory([
    night("old", "2024-03-16T01:00:00.000Z"),
    night("new", "2026-10-01T02:00:00.000Z", { recapText: "The newer night." }),
  ], { name: "Curse of Strahd", defaultLocation: "", previouslyOn: "The newer night.", previouslyOnSessionId: "new" });
  const res = await publishRecap(store.deps, input());
  assert.equal(res.status, 200);
  assert.equal(res.body.previouslyOn, undefined);
  assert.equal(store.campaignWrites, 0);
  assert.equal(store.campaign()?.previouslyOn, "The newer night.");

  const missing = memory([], null);
  const gone = await publishRecap(missing.deps, input({ createIfMissing: true }));
  assert.equal(gone.status, 404);
});

test("the route rejects a bad secret before it touches Firebase", async () => {
  const prev = process.env.TPK_IMPORT_SECRET;
  process.env.TPK_IMPORT_SECRET = "test-secret";
  try {
    const { POST } = await import("../../app/api/import/recap/route.ts");
    const res = await POST(new Request("http://local/api/import/recap", {
      method: "POST",
      headers: { authorization: "Bearer wrong", "content-type": "application/json" },
      body: "{}",
    }));
    assert.equal(res.status, 401);
    const open = await POST(new Request("http://local/api/import/recap", { method: "POST", body: "{}" }));
    assert.equal(open.status, 401);
  } finally {
    if (prev === undefined) delete process.env.TPK_IMPORT_SECRET;
    else process.env.TPK_IMPORT_SECRET = prev;
  }
});
