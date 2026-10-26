import { test } from "node:test";
import assert from "node:assert/strict";
import { combinedLedger, floorHolders, recordedKey, campaignAwards } from "../../lib/almanac-stats";

test("combined ledger keeps every original stat across tables", () => {
  const row = combinedLedger(["frostmaiden", "strahd", "saltmarsh"])!;
  assert.equal(row.sessions > 57, true);
  assert.equal(row.deaths.length, 4);
  assert.ok(row.npcs.length > 0 && row.locations.length > 0);
  const floor = floorHolders(row);
  assert.ok(floor.length >= 18);
  const total = floor.reduce((s, h) => s + h.share, 0);
  assert.ok(total >= 95 && total <= 105);
  assert.equal(floor[0].width, 100);
});

test("recorded key matches by slug or name and per-campaign awards exist", () => {
  assert.equal(recordedKey({ id: "x1", slug: "curse-of-strahd", name: "Curse of Strahd" }), "strahd");
  assert.equal(recordedKey({ id: "zzz", slug: "other", name: "Homebrew" }), null);
  assert.ok(campaignAwards("frostmaiden").length >= 4);
});
