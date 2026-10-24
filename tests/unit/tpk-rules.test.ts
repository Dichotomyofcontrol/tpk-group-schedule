import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RULES, bookingKey, durationOf, matchBooking, parseGm } from "../../lib/tpk-rules";

const camps = [
  { id: "frost", name: "Rime of the Frostmaiden" }, { id: "strahd", name: "Curse of Strahd" },
  { id: "salt", name: "Ghosts of Saltmarsh" }, { id: "bee", name: "Beerovia" },
  { id: "ley1", name: "Leyfarers: Maloren" }, { id: "ley2", name: "Leyfarers: Krenn" },
];
// 2026-10-28 is a Wednesday; 10-30 Friday; 10-31 Saturday; 11-01 Sunday.
const wed = "2026-10-28T18:00:00-07:00", fri = "2026-10-30T18:00:00-07:00", sat = "2026-10-31T12:00:00-07:00", sun = "2026-11-01T12:00:00-08:00";

test("parses GM and hours", () => {
  assert.equal(parseGm("Game Master: Max Hobbs (4 HR)"), "Max Hobbs");
  assert.equal(parseGm("Beerovia: The Shadowborn Sword"), null);
  assert.equal(durationOf("Game Master: Isaac Davies (2 HR)"), 2);
  assert.equal(durationOf("Beerovia"), 4);
  assert.equal(bookingKey("A  b", "2026-10-28T18:00:00-07:00"), bookingKey("a b", "2026-10-29T01:00:00Z"));
});
test("Max Wednesday is Frostmaiden, Friday a Strahd suggestion", () => {
  assert.deepEqual(matchBooking("Game Master: Max Hobbs (4 HR)", wed, DEFAULT_RULES, camps), { kind: "auto", cid: "frost", ruleId: "max-wed-frost" });
  const f = matchBooking("Game Master: Max Hobbs (4 HR)", fri, DEFAULT_RULES, camps);
  assert.equal(f.kind, "suggest"); assert.deepEqual(f.kind === "suggest" && f.cids, ["strahd"]);
});
test("Sage weekends are Saltmarsh, weekdays unassigned", () => {
  assert.equal(matchBooking("Game Master: Sage Ricci (4 HR)", sat, DEFAULT_RULES, camps).kind, "auto");
  assert.equal(matchBooking("Game Master: Sage Ricci (4 HR)", sun, DEFAULT_RULES, camps).kind, "auto");
  assert.equal(matchBooking("Game Master: Sage Ricci (4 HR)", wed, DEFAULT_RULES, camps).kind, "none");
});
test("Leyfarers with two tables suggests; with one auto", () => {
  const two = matchBooking("TLC: Ch. 13 Finale (Choose Your Own)", fri, DEFAULT_RULES, camps);
  assert.equal(two.kind, "suggest"); assert.equal(two.kind === "suggest" && two.cids.length, 2);
  assert.equal(matchBooking("The Leyfarer's Chronicle", fri, DEFAULT_RULES, camps.slice(0, 5)).kind, "auto");
});
test("Beerovia, the marker, and others", () => {
  assert.deepEqual(matchBooking("Beerovia: The Shadowborn Sword", sat, DEFAULT_RULES, camps), { kind: "auto", cid: "bee", ruleId: "beerovia" });
  assert.equal(matchBooking("Join the Leyfarers", sat, DEFAULT_RULES, camps).kind, "ignore");
  assert.equal(matchBooking("Game Master: Isaac Davies (2 HR)", sat, DEFAULT_RULES, camps).kind, "none");
});
test("a saved rule with a fixed campaign wins", () => {
  const rules = [{ id: "s", mode: "auto" as const, gm: "Max Hobbs", weekdays: [5], cid: "bee" }, ...DEFAULT_RULES];
  assert.deepEqual(matchBooking("Game Master: Max Hobbs (4 HR)", fri, rules, camps), { kind: "auto", cid: "bee", ruleId: "s" });
});
