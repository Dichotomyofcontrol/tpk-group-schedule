import assert from "node:assert/strict";
import test from "node:test";
import { buildDemo } from "../../lib/demo-data.ts";
import { rankedOptions, toggleVote } from "../../lib/model.ts";
import { memberYesCount, applyGuestVote, toPublicPoll } from "../../lib/poll-public.ts";
import { bestIds, cyclePick, choiceOf, tallyText } from "../../lib/poll-choice.ts";

const TOKEN = "device-token-abcXYZ12";

test("a tap cycles Works, Best, then cleared, and an old yes is Works", () => {
  assert.equal(choiceOf(true), "works");
  assert.equal(choiceOf("best"), "best");
  assert.equal(choiceOf(false), null);
  assert.equal(choiceOf(undefined), null);
  assert.equal(cyclePick(undefined), true);
  assert.equal(cyclePick(true), "best");
  assert.equal(cyclePick("best"), undefined);

  const state = buildDemo("seth");
  const poll = state.polls.find((item) => item.id === "salt-dates")!;
  const id = poll.options[0]!.id;
  const works = toggleVote(state, poll.id, id, "seth");
  assert.equal(works.polls.find((item) => item.id === poll.id)?.votes.seth?.picks[id], true);
  const best = toggleVote(works, poll.id, id, "seth");
  assert.equal(best.polls.find((item) => item.id === poll.id)?.votes.seth?.picks[id], "best");
  const cleared = toggleVote(best, poll.id, id, "seth");
  assert.equal(choiceOf(cleared.polls.find((item) => item.id === poll.id)?.votes.seth?.picks[id]), null);
  assert.equal(tallyText(5, 3), "5 can · 3 best");
});

test("results rank by who can attend, then by Best, and highlight a date everyone can make", () => {
  const state = buildDemo("seth");
  const poll = state.polls.find((item) => item.id === "frost-dec")!;
  const ranked = rankedOptions(poll, state.campaigns.find((item) => item.id === "frostmaiden")?.cadence ?? null);
  assert.equal(ranked[0]?.option.id, "2026-12-07-18:00");
  assert.equal(ranked[0]?.yes, 5);
  assert.equal(ranked[0]?.best, 3);
  assert.equal(choiceOf(poll.votes.seth?.picks["2026-12-07-18:00"]), "best");
  assert.equal(choiceOf(poll.votes.giada?.picks["2026-12-07-18:00"]), "works");
  const members = state.members.frostmaiden.map((member) => ({ id: member.id, displayName: member.displayName }));
  assert.equal(memberYesCount(poll, members, "2026-12-07-18:00"), members.length);
  const tied = structuredClone(poll);
  tied.votes = {
    a: { picks: { one: true, two: "best" }, updatedAt: "t" },
    b: { picks: { one: true, two: "best" }, updatedAt: "t" },
  };
  tied.options = [
    { id: "one", startsAt: "2026-12-01T02:00:00.000Z", tz: "America/Los_Angeles" },
    { id: "two", startsAt: "2026-12-02T02:00:00.000Z", tz: "America/Los_Angeles" },
  ];
  const order = rankedOptions(tied, null).map((row) => row.option.id);
  assert.deepEqual(order, ["two", "one"]);
  assert.equal(rankedOptions(tied, null)[0]?.yes, 2);
  assert.equal(rankedOptions(tied, null)[0]?.best, 2);
});

test("a guest yes stays Works, and Best is stored and returned", async () => {
  const state = buildDemo("seth");
  const poll = structuredClone(state.polls.find((item) => item.id === "salt-dates")!);
  poll.votes = {};
  const members = state.members.saltmarsh.map((member) => ({ id: member.id, displayName: member.displayName }));
  const works = await applyGuestVote(poll, { token: TOKEN, name: "Mira", picks: ["2026-11-21-18:00"] }, members);
  assert.ok(!("error" in works));
  if ("error" in works) return;
  const key = Object.keys(works.poll.votes).find((id) => id.startsWith("guest:"))!;
  assert.equal(works.poll.votes[key]?.picks["2026-11-21-18:00"], true);
  const favorite = await applyGuestVote(works.poll, { token: TOKEN, name: "Mira", picks: ["2026-11-21-18:00", "2026-11-29-18:00"], best: ["2026-11-29-18:00"] }, members);
  assert.ok(!("error" in favorite));
  if ("error" in favorite) return;
  assert.equal(favorite.poll.votes[key]?.picks["2026-11-21-18:00"], true);
  assert.equal(favorite.poll.votes[key]?.picks["2026-11-29-18:00"], "best");
  assert.deepEqual(bestIds(favorite.poll.votes[key]), ["2026-11-29-18:00"]);
  const row = rankedOptions(favorite.poll, null).find((item) => item.option.id === "2026-11-29-18:00");
  assert.equal(row?.yes, 1);
  assert.equal(row?.best, 1);
  const view = await toPublicPoll({ poll: favorite.poll, campaignName: "Ghosts of Saltmarsh", campaignStatus: "active", members }, TOKEN);
  assert.deepEqual(view.mine?.picks.sort(), ["2026-11-21-18:00", "2026-11-29-18:00"]);
  assert.deepEqual(view.mine?.best, ["2026-11-29-18:00"]);
});
