import { test } from "node:test";
import assert from "node:assert/strict";
import { floorHolders, recordedKey, campaignAwards, recordedCampaign } from "../../lib/almanac-stats";

test("who holds the floor stays per campaign with percent shares", () => {
  for (const cid of ["frostmaiden", "strahd", "saltmarsh"]) {
    const floor = floorHolders(recordedCampaign(cid)!);
    assert.ok(floor.length >= 5);
    const total = floor.reduce((s, h) => s + h.share, 0);
    assert.ok(total >= 95 && total <= 105);
    assert.equal(floor[0].width, 100);
  }
});

test("recorded key matches by slug or name and per-campaign awards exist", () => {
  assert.equal(recordedKey({ id: "x1", slug: "curse-of-strahd", name: "Curse of Strahd" }), "strahd");
  assert.equal(recordedKey({ id: "zzz", slug: "other", name: "Homebrew" }), null);
  assert.ok(campaignAwards("frostmaiden").length >= 4);
});

import { buildDemo } from "../../lib/demo-data.ts";
import { forYou } from "../../lib/almanac-me.ts";

test("for you finds Seth's characters, talk share, deaths and awards from real data", () => {
  const me = forYou(buildDemo("seth"), new Date("2026-10-25T12:00:00Z"));
  assert.equal(me.totals?.sessions, 70);
  const ryn = me.seats.find((seat) => seat.cid === "frostmaiden")!;
  assert.equal(ryn.character, "Ryn");
  assert.equal(ryn.share, 16);
  assert.equal(me.seats.find((seat) => seat.cid === "strahd")?.character, "Vloskev");
  // Seats rank by play time, include tables without recordings, and shares add to ~100%.
  const hours = me.seats.map((seat) => seat.hours);
  assert.deepEqual(hours, [...hours].sort((a, b) => b - a));
  assert.equal(me.seats[0]?.width, 100);
  assert.ok(me.seats.some((seat) => seat.cid === "leyfarers" && seat.hours > 0));
  const total = me.seats.reduce((sum, seat) => sum + seat.playShare, 0);
  assert.ok(total >= 97 && total <= 103, `play shares sum to ${total}`);
  assert.deepEqual(me.deaths.map((d) => d.name), ["Ryn"]);
  assert.ok(me.awards.some((a) => a.title === "Bedside Manner"));
  assert.ok(me.next && me.longest && me.mostActive);
});

test("for you leaves out what a player has no data for", () => {
  const me = forYou(buildDemo("newcomer"));
  assert.equal(me.deaths.length, 0);
  assert.equal(me.awards.length, 0);
});
