import assert from "node:assert/strict";
import test from "node:test";
import { buildDemo } from "../../lib/demo-data.ts";
import { rankedOptions, toggleVote } from "../../lib/model.ts";
import { memberYesCount, applyGuestVote, parseGuestBallot, toPublicPoll, namesForOption } from "../../lib/poll-public.ts";
import { calendarOrder, choiceOf, cyclePick, leaderId, maybeIds, tallyText } from "../../lib/poll-choice.ts";

const TOKEN = "device-token-abcXYZ12";

test("a tap cycles Yes, Maybe, then cleared; old Works and Best ballots both read as Yes", () => {
  assert.equal(choiceOf(true), "yes");
  assert.equal(choiceOf("best"), "yes");
  assert.equal(choiceOf("maybe"), "maybe");
  assert.equal(choiceOf(false), null);
  assert.equal(choiceOf(undefined), null);
  assert.equal(cyclePick(undefined), true);
  assert.equal(cyclePick(true), "maybe");
  assert.equal(cyclePick("best"), "maybe");
  assert.equal(cyclePick("maybe"), undefined);

  const state = buildDemo("seth");
  const poll = state.polls.find((item) => item.id === "salt-dates")!;
  const id = poll.options[0]!.id;
  const yes = toggleVote(state, poll.id, id, "seth");
  assert.equal(yes.polls.find((item) => item.id === poll.id)?.votes.seth?.picks[id], true);
  const maybe = toggleVote(yes, poll.id, id, "seth");
  assert.equal(maybe.polls.find((item) => item.id === poll.id)?.votes.seth?.picks[id], "maybe");
  const cleared = toggleVote(maybe, poll.id, id, "seth");
  assert.equal(choiceOf(cleared.polls.find((item) => item.id === poll.id)?.votes.seth?.picks[id]), null);
  assert.equal(tallyText(5, 2), "5 yes · 2 maybe");
  assert.equal(tallyText(3, 0), "3 yes");
});

test("existing votes migrate without loss: legacy Best counts as Yes, Maybe does not count as Yes", () => {
  const state = buildDemo("seth");
  const poll = state.polls.find((item) => item.id === "frost-dec")!;
  const ranked = rankedOptions(poll, state.campaigns.find((item) => item.id === "frostmaiden")?.cadence ?? null);
  assert.equal(ranked[0]?.option.id, "2026-12-07-18:00");
  assert.equal(ranked[0]?.yes, 5);
  assert.equal(choiceOf(poll.votes.seth?.picks["2026-12-07-18:00"]), "yes");
  const members = state.members.frostmaiden.map((member) => ({ id: member.id, displayName: member.displayName }));
  assert.equal(memberYesCount(poll, members, "2026-12-07-18:00"), members.length);
  const mixed = structuredClone(poll);
  mixed.options = [
    { id: "one", startsAt: "2026-12-01T02:00:00.000Z", tz: "America/Los_Angeles" },
    { id: "two", startsAt: "2026-12-02T02:00:00.000Z", tz: "America/Los_Angeles" },
  ];
  mixed.votes = {
    a: { picks: { one: "maybe", two: "best" }, updatedAt: "t" },
    b: { picks: { one: true, two: true }, updatedAt: "t" },
  };
  const rows = rankedOptions(mixed, null);
  assert.deepEqual(rows.map((r) => [r.option.id, r.yes, r.maybe]), [["two", 2, 0], ["one", 1, 1]]);
  assert.deepEqual(namesForOption(mixed, [], "one"), ["Guest?", "Guest"]);
});

test("dates stay in calendar order as votes arrive; the leader is marked, not moved", async () => {
  const rows = [
    { option: { id: "a", startsAt: "2026-12-01T02:00:00.000Z" }, yes: 1, maybe: 0 },
    { option: { id: "b", startsAt: "2026-12-02T02:00:00.000Z" }, yes: 3, maybe: 0 },
    { option: { id: "c", startsAt: "2026-12-03T02:00:00.000Z" }, yes: 3, maybe: 1 },
  ];
  assert.deepEqual(calendarOrder([rows[2]!, rows[0]!, rows[1]!]).map((r) => r.option.id), ["a", "b", "c"]);
  assert.equal(leaderId(rows), "c");
  assert.equal(leaderId(rows.slice(0, 2)), "b");
  assert.equal(leaderId([{ option: { id: "x", startsAt: "z" }, yes: 0, maybe: 4 }]), null);

  const state = buildDemo("seth");
  const poll = structuredClone(state.polls.find((item) => item.id === "salt-dates")!);
  const last = [...poll.options].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).at(-1)!.id;
  poll.votes = { seth: { picks: { [last]: true }, updatedAt: "t" } };
  const members = state.members.saltmarsh.map((member) => ({ id: member.id, displayName: member.displayName }));
  const view = await toPublicPoll({ poll, campaignName: "Ghosts of Saltmarsh", campaignStatus: "active", members }, null);
  const starts = view.options.map((o) => poll.options.find((p) => p.id === o.id)!.startsAt);
  assert.deepEqual(starts, [...starts].sort());
  assert.equal(view.options.at(-1)?.id, last);
  assert.equal(view.options.at(-1)?.lead, true);
  assert.equal(view.options.filter((o) => o.lead).length, 1);
});

test("a guest Maybe is stored and returned; an old client's Best still lands as Yes", async () => {
  const state = buildDemo("seth");
  const poll = structuredClone(state.polls.find((item) => item.id === "salt-dates")!);
  poll.votes = {};
  const members = state.members.saltmarsh.map((member) => ({ id: member.id, displayName: member.displayName }));
  const first = await applyGuestVote(poll, { token: TOKEN, name: "Mira", picks: ["2026-11-21-18:00", "2026-11-29-18:00"], maybe: ["2026-11-29-18:00"] }, members);
  assert.ok(!("error" in first));
  if ("error" in first) return;
  const key = Object.keys(first.poll.votes).find((id) => id.startsWith("guest:"))!;
  assert.equal(first.poll.votes[key]?.picks["2026-11-21-18:00"], true);
  assert.equal(first.poll.votes[key]?.picks["2026-11-29-18:00"], "maybe");
  assert.deepEqual(maybeIds(first.poll.votes[key]), ["2026-11-29-18:00"]);
  const row = rankedOptions(first.poll, null).find((item) => item.option.id === "2026-11-29-18:00");
  assert.equal(row?.yes, 0);
  assert.equal(row?.maybe, 1);
  const view = await toPublicPoll({ poll: first.poll, campaignName: "Ghosts of Saltmarsh", campaignStatus: "active", members }, TOKEN);
  assert.deepEqual(view.mine?.picks.sort(), ["2026-11-21-18:00", "2026-11-29-18:00"]);
  assert.deepEqual(view.mine?.maybe, ["2026-11-29-18:00"]);

  const legacy = parseGuestBallot({ token: TOKEN, name: "Mira", picks: ["2026-11-21-18:00"], best: ["2026-11-29-18:00"] });
  assert.ok(!("error" in legacy));
  if ("error" in legacy) return;
  assert.deepEqual(legacy.picks.sort(), ["2026-11-21-18:00", "2026-11-29-18:00"]);
  assert.deepEqual(legacy.maybe, []);
  const maybeOnly = parseGuestBallot({ token: TOKEN, name: "Mira", picks: [], maybe: ["2026-11-29-18:00"] });
  assert.ok(!("error" in maybeOnly));
});
