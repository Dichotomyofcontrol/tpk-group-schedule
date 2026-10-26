import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openingParagraph, readAloudMinutes, storedReadAloud } from "../../lib/recap.ts";
import { parsePreviouslyOn, publishPreviouslyOn, type PreviouslyOnDeps } from "../../lib/previously-on.ts";
import type { StoredSession } from "../../lib/recap-import.ts";
import { zonedTimeToUtc } from "../../lib/time.ts";

const WIZARD = [
  "<h2>The Wizard of Wines</h2>",
  "<p>Recap by Lizbeth.</p>",
  "<p>The vineyard <strong>burned</strong>. Ichabod kept the gem, and the Abbot smiled far too widely.</p>",
].join("");

function session(id: string, ymd: string, status: StoredSession["status"] = "scheduled"): StoredSession {
  const startsAt = zonedTimeToUtc(ymd, "18:30", "America/Los_Angeles").toISOString();
  return { id, startsAt, endsAt: startsAt, tz: "America/Los_Angeles", title: id, status, location: "TPK" };
}

function memory(sessions: StoredSession[], campaign = true) {
  const docs = new Map(sessions.map((item) => [item.id, { ...item }]));
  let writes = 0;
  const deps: PreviouslyOnDeps = {
    async loadCampaign() { return campaign ? { name: "Icewind Dale" } : null; },
    async loadSessions() { return [...docs.values()].map((item) => ({ ...item })); },
    async mergeSession(_cid, sid, data) {
      writes += 1;
      const current = docs.get(sid);
      if (!current) return;
      if (data.previouslyOn === null) delete current.previouslyOn;
      else current.previouslyOn = data.previouslyOn;
    },
  };
  return { deps, docs, writes: () => writes };
}

test("opening paragraph skips a short byline", () => {
  const text = openingParagraph({ recapHtml: WIZARD });
  assert.equal(text, "The vineyard burned. Ichabod kept the gem, and the Abbot smiled far too widely.");
  assert.equal(openingParagraph({ recapMarkdown: "## Title\n\nRecap by Seth.\n\nThe beacon is lit and the hall is quiet enough to hear the snow." }), "The beacon is lit and the hall is quiet enough to hear the snow.");
  assert.equal(readAloudMinutes("word ".repeat(300)), 2);
});

test("up next reads a stored opener and stays hidden without one", () => {
  assert.equal(storedReadAloud({ previouslyOn: "  Session script.  " }, { previouslyOn: "Campaign line." }), "Session script.");
  assert.equal(storedReadAloud({ previouslyOn: "   " }, { previouslyOn: "  The whale opened an eye.  " }), "The whale opened an eye.");
  assert.equal(storedReadAloud({}, {}), "");
  assert.equal(storedReadAloud({ previouslyOn: "" }, { previouslyOn: " " }), "");
  const opener = "The Effigies Beneath Bremen. A flashback, set about four months before the campaign proper.";
  assert.equal(readAloudMinutes(storedReadAloud({}, { previouslyOn: opener })), readAloudMinutes(opener));
  const source = readFileSync(new URL("../../components/schedule.tsx", import.meta.url), "utf8");
  assert.match(source, /storedReadAloud/);
  assert.doesNotMatch(source, /openingParagraph/);
  assert.doesNotMatch(source, /prevon-from/);
});

test("previously on import sets, clears, and refuses a bad night", async () => {
  const bad = parsePreviouslyOn({ cid: "frostmaiden", date: "2026-02-31", previouslyOn: "Hello" });
  assert.equal(bad.ok, false);
  const missing = parsePreviouslyOn({ cid: "frostmaiden", date: "2026-10-26" });
  assert.equal(missing.ok, false);
  const parsed = parsePreviouslyOn({ cid: "Frostmaiden", date: "2026-10-26", previouslyOn: "  The whale blinked.  ", dryRun: true });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.cid, "frostmaiden");
  assert.equal(parsed.value.previouslyOn, "The whale blinked.");
  assert.equal(parsed.value.dryRun, true);

  const store = memory([session("frost-2026-10-26", "2026-10-26"), session("other", "2026-10-12")]);
  const dry = await publishPreviouslyOn(store.deps, parsed.value);
  assert.equal(dry.ok, true);
  assert.equal(store.writes(), 0);
  assert.equal(store.docs.get("frost-2026-10-26")?.previouslyOn, undefined);

  const saved = await publishPreviouslyOn(store.deps, { ...parsed.value, dryRun: false });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.body.previouslyOn, "The whale blinked.");
  assert.equal(store.docs.get("frost-2026-10-26")?.previouslyOn, "The whale blinked.");

  const cleared = await publishPreviouslyOn(store.deps, { cid: "frostmaiden", date: "2026-10-26", previouslyOn: "", dryRun: false });
  assert.equal(cleared.ok, true);
  if (!cleared.ok) return;
  assert.equal(cleared.body.cleared, true);
  assert.equal(store.docs.get("frost-2026-10-26")?.previouslyOn, undefined);

  const none = await publishPreviouslyOn(store.deps, { cid: "frostmaiden", date: "2026-11-02", previouslyOn: "Tonight.", dryRun: false });
  assert.equal(none.ok, false);
  if (none.ok) return;
  assert.equal(none.status, 409);

  const doubled = memory([session("a", "2026-10-26"), session("b", "2026-10-26")]);
  const ambiguous = await publishPreviouslyOn(doubled.deps, { cid: "frostmaiden", date: "2026-10-26", previouslyOn: "Tonight.", dryRun: false });
  assert.equal(ambiguous.ok, false);
  if (ambiguous.ok) return;
  assert.equal(ambiguous.status, 409);
  assert.equal(doubled.writes(), 0);

  const gone = memory([], false);
  const missingCampaign = await publishPreviouslyOn(gone.deps, parsed.value);
  assert.equal(missingCampaign.ok, false);
  if (missingCampaign.ok) return;
  assert.equal(missingCampaign.status, 404);
});

test("previously on route uses the recap import secret", () => {
  const route = readFileSync(new URL("../../app/api/import/previously-on/route.ts", import.meta.url), "utf8");
  assert.match(route, /secretOk/);
  assert.match(route, /parsePreviouslyOn/);
  assert.match(route, /publishPreviouslyOn/);
  const recap = readFileSync(new URL("../../app/api/import/recap/route.ts", import.meta.url), "utf8");
  assert.match(recap, /secretOk/);
  assert.match(recap, /parseRecapImport/);
  assert.match(recap, /publishRecap/);
});
