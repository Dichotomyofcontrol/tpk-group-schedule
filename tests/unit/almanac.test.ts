import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignBook, campaignsInAlmanac, characterSpotlights } from "../../lib/almanac.ts";
import { buildDemo } from "../../lib/demo-data.ts";

const NOW = new Date("2026-10-26T20:00:00.000Z");

test("a player only sees campaigns they have joined", () => {
  const seth = buildDemo("seth");
  const giada = buildDemo("giada");
  const sethIds = campaignsInAlmanac(seth, "seth").map((campaign) => campaign.id);
  const giadaIds = campaignsInAlmanac(giada, "giada").map((campaign) => campaign.id);
  assert.ok(sethIds.includes("saltmarsh"));
  assert.ok(sethIds.includes("beerovia"));
  assert.ok(sethIds.includes("special"));
  assert.equal(giadaIds.includes("saltmarsh"), false);
  assert.equal(giadaIds.includes("beerovia"), false);
  assert.equal(campaignBook(seth, "saltmarsh", "giada", NOW), null);
  assert.ok(campaignBook(seth, "strahd", "giada", NOW));
  assert.equal(campaignBook(seth, "missing", "seth", NOW), null);
});

test("an overview spread draws cover fields, the next night, played nights, and the latest recap", () => {
  const book = campaignBook(buildDemo("seth"), "strahd", "seth", NOW);
  assert.ok(book);
  assert.equal(book.spread.system, "Dungeons & Dragons");
  assert.equal(book.spread.worldPlace, "Barovia");
  assert.ok(book.spread.played > 0);
  assert.ok(book.spread.hours > 0);
  assert.equal(book.spread.next?.title, "Session 13");
  assert.match(book.spread.latest?.snippet ?? "", /vineyard burned/i);
  assert.equal(book.spread.latest?.title, "The Wizard of Wines");
  assert.ok(book.spread.party.some((spot) => spot.name === "Aralyth" && spot.detail === "Amy"));
  assert.equal(book.blanks.includes("npcs"), false);
  assert.equal(book.blanks.includes("factions"), true);
  assert.equal(book.blanks.includes("ledger"), true);
});

test("character sheets split into current and former, and a ledger fills quests", () => {
  const state = buildDemo("seth");
  const index = state.campaigns.findIndex((campaign) => campaign.id === "strahd");
  const strahd = state.campaigns[index];
  state.campaigns[index] = {
    ...strahd,
    characters: [...(strahd.characters ?? []), { name: "Ireena", charClass: "Noble", level: "1" }],
    ledger: [
      { id: "gem", at: "2026-10-09", kind: "loot", text: "The winery gem" },
      { id: "beacon", at: "2026-09-25", kind: "milestone", text: "The beacon is lit" },
    ],
  };
  const book = campaignBook(state, "strahd", "seth", NOW);
  assert.ok(book);
  assert.equal(book.current.some((spot) => spot.name === "Ireena"), false);
  assert.equal(book.former[0]?.name, "Ireena");
  assert.equal(book.former[0]?.line, "Noble · level 1");
  assert.equal(book.blanks.includes("ledger"), false);
  assert.deepEqual(book.ledger.map((entry) => entry.kind), ["milestone", "loot"]);
  const { current } = characterSpotlights(state.campaigns[index], state.members.strahd);
  assert.equal(current.find((spot) => spot.name === "Vloskev")?.player, "Ben");
  const backTable = book.places.find((place) => place.name === "TPK Brewing, back table");
  assert.ok(backTable && backTable.nights > 0);
});

test("frost sheets stay the party, and only a matching owner is named", () => {
  const book = campaignBook(buildDemo("seth"), "frostmaiden", "seth", NOW);
  assert.ok(book);
  assert.deepEqual(book.current.map((spot) => spot.name), ["Ryn", "Oli", "Cooter", "Rosie", "Gordo"]);
  assert.equal(book.current[0]?.player, "Seth");
  assert.equal(book.current[1]?.player, undefined);
  assert.equal(book.chronicle.length, 0);
  assert.ok(book.unwritten > 0);
  assert.match(book.spread.previouslyOn ?? "", /whale/i);
});
