import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { findSummary, notePending, parseSummaryWrite, readySummary, recapAppearances, summaryFor } from "../../lib/character-summary.ts";
import { buildDemo } from "../../lib/demo-data.ts";
import { setMember } from "../../lib/model.ts";

const FIXTURE = {
  cid: "strahd",
  name: "Ichabod",
  text: "Ichabod carries the third gem from the Wizard of Wines and will not hand it over. He stands at the front when the road turns hostile, quieter since the vineyard burned. The Abbot's smile stayed with him longer than the smoke. The rest of the party has learned not to ask what the gem is for.",
  facts: { class: "Fighter", ancestry: "Human", role: "Holds the front, and the gem", moment: "Kept the gem when the vineyard burned" },
};

test("naming a character stores pending and does not write a summary", () => {
  const state = buildDemo("seth");
  const next = setMember(state, "strahd", "amy", { characterName: "Aurelia" });
  const pending = findSummary(next.characterSummaries?.strahd, "Aurelia");
  assert.equal(pending?.status, "pending");
  assert.equal(pending?.text, undefined);
  assert.equal(pending?.facts, undefined);
  const kept = setMember(next, "strahd", "sam", { characterName: "Ichabod" });
  const ready = findSummary(kept.characterSummaries?.strahd, "Ichabod");
  assert.equal(ready?.status, "ready");
  assert.match(ready?.text ?? "", /gem/);
  assert.equal(notePending(kept.characterSummaries?.strahd ?? [], "Ichabod"), kept.characterSummaries?.strahd);
});

test("a character with no stored doc still reads as pending", () => {
  const missing = summaryFor([], "Ryn");
  assert.equal(missing.status, "pending");
  assert.equal(missing.text, undefined);
});

test("the archivist write accepts three or four sentences and the facts", () => {
  const parsed = parseSummaryWrite(FIXTURE);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const saved = readySummary(parsed.value, new Date("2026-10-10T00:00:00.000Z"));
  assert.equal(saved.status, "ready");
  assert.equal(saved.facts?.ancestry, "Human");
  const short = parseSummaryWrite({ ...FIXTURE, text: "Only one sentence." });
  assert.equal(short.ok, false);
  const bare = parseSummaryWrite({ ...FIXTURE, facts: { class: "Fighter" } });
  assert.equal(bare.ok, false);
});

test("appears-in finds the recap that names the character", () => {
  const state = buildDemo("seth");
  const hits = recapAppearances(state.sessions, "strahd", "Ichabod");
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.title, "The Wizard of Wines");
  assert.equal(recapAppearances(state.sessions, "strahd", "Aralyth").length, 0);
});

test("clients cannot overwrite a summary, and the import route does not call a model", () => {
  const rules = readFileSync(new URL("../../firebase/firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /match \/characterSummaries\/\{id\}/);
  assert.match(rules, /allow update, delete: if false;/);
  const route = readFileSync(new URL("../../app/api/import/character-summary/route.ts", import.meta.url), "utf8");
  const lib = readFileSync(new URL("../../lib/character-summary.ts", import.meta.url), "utf8");
  assert.match(route, /secretOk/);
  assert.doesNotMatch(`${route}\n${lib}`, /openai|anthropic|gemini|generateContent|generativelanguage/i);
});
