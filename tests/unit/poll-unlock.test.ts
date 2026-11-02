import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemo } from "../../lib/demo-data";
import { lockPoll, unlockPoll, isStaff, membersOf } from "../../lib/model";

function lockedState(persona: string) {
  const s = buildDemo(persona);
  const open = s.polls.find((p) => p.status === "open" && isStaff(s, p.cid, "seth"))!;
  const seth = { ...buildDemo("seth") };
  const r = lockPoll(seth, open.id, open.options[0].id);
  assert.ok(!("error" in r));
  return { state: r, pollId: open.id };
}

test("organizer unlock reopens the poll, keeps votes, removes the untouched session", () => {
  const { state, pollId } = lockedState("seth");
  const before = state.polls.find((p) => p.id === pollId)!;
  const sid = before.sessionId!;
  const r = unlockPoll(state, pollId);
  assert.ok(!("error" in r));
  const after = r.state.polls.find((p) => p.id === pollId)!;
  assert.equal(after.status, "open");
  assert.equal(after.sessionId, undefined);
  assert.deepEqual(after.votes, before.votes);
  assert.equal(r.removedSessionId, sid);
  assert.ok(!r.state.sessions.some((s) => s.id === sid));
});

test("a session with RSVPs is cancelled, not deleted", () => {
  const { state, pollId } = lockedState("seth");
  const sid = state.polls.find((p) => p.id === pollId)!.sessionId!;
  const used = { ...state, sessions: state.sessions.map((s) => (s.id === sid ? { ...s, attendance: [{ uid: "amy", state: "yes" }] as never } : s)) };
  const r = unlockPoll(used, pollId);
  assert.ok(!("error" in r));
  assert.equal(r.removedSessionId, null);
  assert.equal(r.state.sessions.find((s) => s.id === sid)!.status, "cancelled");
});

test("non-organizers cannot unlock", () => {
  const { state, pollId } = lockedState("seth");
  const cid = state.polls.find((p) => p.id === pollId)!.cid;
  const asPlayer = { ...state, members: { ...state.members, [cid]: [...membersOf(state, cid), { ...membersOf(state, cid)[0], id: "amy-x", role: "member" as const }] }, me: { ...state.me, id: "amy-x" } };
  const r = unlockPoll(asPlayer, pollId);
  assert.ok("error" in r);
});

test("organizer can lock any option; members cannot lock", () => {
  const s = buildDemo("seth");
  const open = s.polls.find((p) => p.status === "open" && isStaff(s, p.cid, "seth"))!;
  const last = open.options[open.options.length - 1];
  const r = lockPoll(s, open.id, last.id);
  assert.ok(!("error" in r));
  assert.equal(r.polls.find((p) => p.id === open.id)!.chosenOptionId, last.id);
  const asMember = { ...s, members: { ...s.members, [open.cid]: [...membersOf(s, open.cid), { ...membersOf(s, open.cid)[0], id: "amy-x", role: "member" as const }] }, me: { ...s.me, id: "amy-x" } };
  assert.ok("error" in lockPoll(asMember, open.id, last.id));
});
