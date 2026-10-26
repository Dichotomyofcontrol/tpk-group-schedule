import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignBook } from "../../lib/almanac.ts";
import { floorHolders, groupTotals, recordedCampaign, tpkAwards } from "../../lib/almanac-stats.ts";
import { buildDemo } from "../../lib/demo-data.ts";

const NOW = new Date("2026-10-26T20:00:00.000Z");

test("each recorded campaign keeps the mined counts, deaths, and top lists", () => {
  const rime = recordedCampaign("frostmaiden");
  assert.ok(rime);
  assert.equal(rime.sessions, 57);
  assert.equal(rime.hours, 230);
  assert.equal(rime.words, 1502042);
  assert.equal(rime.nat20, 55);
  assert.equal(rime.nat1, 28);
  assert.equal(rime.sessionsList.length, 57);
  assert.equal(rime.longest.title, "33- Nildar's Demise & Everyone's King");
  assert.equal(rime.longest.hours, 5.73);
  assert.equal(rime.npcs[0]?.name, "Garrett");
  assert.equal(rime.npcs[0]?.count, 769);
  assert.equal(rime.npcs[1]?.name, "Auril");
  assert.equal(rime.locations[0]?.name, "Targos");
  assert.equal(rime.locations[0]?.count, 271);
  assert.equal(rime.deaths.find((death) => death.name === "Theo")?.returned, false);
  assert.equal(rime.deaths.find((death) => death.name === "Cooter")?.returned, true);
  assert.deepEqual(floorHolders(rime).map((holder) => [holder.name, holder.share]), [
    ["Cooter", 30],
    ["Rosie", 27],
    ["Oli", 20],
    ["Ryn", 16],
    ["Gordo", 4],
    ["Theo", 3],
  ]);

  const strahd = recordedCampaign("strahd");
  assert.ok(strahd);
  assert.equal(strahd.sessions, 7);
  assert.equal(strahd.hours, 26.6);
  assert.equal(strahd.deaths.length, 0);
  assert.equal(strahd.npcs[0]?.name, "Ireena Kolyana");
  assert.equal(strahd.longest.title, "Storm of Shadows");

  const salt = recordedCampaign("saltmarsh");
  assert.ok(salt);
  assert.equal(salt.sessions, 6);
  assert.equal(salt.words, 178180);
  assert.equal(salt.nat20, 7);
  assert.equal(salt.nat1, 1);
  assert.equal(floorHolders(salt)[0]?.name, "Giago");
  assert.equal(floorHolders(salt)[0]?.share, 43);
  assert.equal(recordedCampaign("drawsteel"), null);
});

test("the ceremony totals every joined recording and hides awards from other tables", () => {
  const seth = groupTotals(["frostmaiden", "strahd", "saltmarsh", "beerovia"]);
  assert.ok(seth);
  assert.equal(seth.sessions, 70);
  assert.equal(seth.hours, 279);
  assert.equal(seth.wordsLabel, "1.85M");
  assert.equal(seth.full, true);
  const awards = tpkAwards(["frostmaiden", "strahd", "saltmarsh"]);
  assert.deepEqual(awards.map((award) => award.title), [
    "The Revolving Door",
    "Iron Bladder",
    "Most Wanted",
    "Coup de Grâce",
    "Bedside Manner",
    "Nosebleed Seats",
    "Hostile Takeover",
    "The Lucky Table",
    "Open Mic Night",
  ]);
  assert.equal(awards[1]?.who, "Nildar's Demise & Everyone's King");
  assert.match(awards[1]?.body ?? "", /5\.73 hours/);
  assert.match(awards[1]?.body ?? "", /Aug 6, 2025/);
  assert.match(awards[2]?.body ?? "", /769 mentions/);
  assert.match(awards[2]?.body ?? "", /Auril herself \(702\)/);
  assert.match(awards[7]?.body ?? "", /55 "nat 20" call-outs to 28 "nat 1"s/);
  assert.equal(awards[8]?.who, "Giago (Ross)");
  assert.equal(awards[8]?.evidence, "Speaker-labeled transcripts (2)");

  const giadaIds = ["frostmaiden", "strahd", "drawsteel", "leyfarers"];
  const giada = groupTotals(giadaIds);
  assert.ok(giada);
  assert.equal(giada.sessions, 64);
  assert.equal(giada.hours, 257);
  assert.equal(giada.wordsLabel, "1.67M");
  assert.equal(giada.full, false);
  const giadaAwards = tpkAwards(giadaIds).map((award) => award.title);
  assert.equal(giadaAwards.includes("Hostile Takeover"), false);
  assert.equal(giadaAwards.includes("Open Mic Night"), false);
  assert.equal(giadaAwards.includes("Bedside Manner"), true);
  assert.equal(groupTotals(["drawsteel"]), null);
});

test("a table without recordings still says NPCs are not written down", () => {
  const book = campaignBook(buildDemo("seth"), "drawsteel", "seth", NOW);
  assert.ok(book);
  assert.equal(book.blanks.includes("npcs"), true);
  const strahd = campaignBook(buildDemo("seth"), "strahd", "seth", NOW);
  assert.equal(strahd?.blanks.includes("npcs"), false);
  assert.equal(strahd?.blanks.includes("factions"), true);
});
