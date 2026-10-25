import assert from "node:assert/strict";
import test from "node:test";
import { buildDemo } from "../../lib/demo-data.ts";
import { groupMemberPolls, pollDisplayTitle } from "../../lib/poll-lists.ts";
import type { Poll } from "../../lib/types.ts";

function poll(partial: Partial<Poll> & Pick<Poll, "id" | "createdBy" | "status">): Poll {
  return {
    cid: "c",
    title: partial.id,
    options: [],
    votes: {},
    ...partial,
  };
}

test("polls split into sent and received, then active and closed", () => {
  const groups = groupMemberPolls([
    poll({ id: "mine-open", createdBy: "seth", status: "open" }),
    poll({ id: "mine-lock", createdBy: "seth", status: "locked" }),
    poll({ id: "theirs-open", createdBy: "amy", status: "open" }),
    poll({ id: "theirs-lock", createdBy: "amy", status: "locked" }),
  ], "seth");
  assert.deepEqual(groups.sent.active.map((item) => item.id), ["mine-open"]);
  assert.deepEqual(groups.sent.closed.map((item) => item.id), ["mine-lock"]);
  assert.deepEqual(groups.received.active.map((item) => item.id), ["theirs-open"]);
  assert.deepEqual(groups.received.closed.map((item) => item.id), ["theirs-lock"]);
});

test("one-shot polls use the campaign name as the row title", () => {
  assert.equal(pollDisplayTitle({ title: "Which night?" }, { kind: "oneshot", name: "Halloween" }), "Halloween");
  assert.equal(pollDisplayTitle({ title: "Which night?" }, { name: "Strahd" }), "Which night?");
});

test("demo polls give Seth a sent list and a received list", () => {
  const state = buildDemo("seth");
  const groups = groupMemberPolls(state.polls, "seth");
  assert.deepEqual(groups.sent.active.map((item) => item.id), ["salt-dates", "frost-dec"]);
  assert.deepEqual(groups.sent.closed.map((item) => item.id), ["strahd-lock"]);
  assert.deepEqual(groups.received.active.map((item) => item.id), ["frost-amy"]);
  assert.deepEqual(groups.received.closed.map((item) => item.id), ["ley-lock"]);
  assert.equal(state.polls.find((item) => item.id === "salt-dates")?.status, "open");
  assert.equal(state.polls.find((item) => item.id === "frost-dec")?.status, "open");
});
