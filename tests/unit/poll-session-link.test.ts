import assert from "node:assert/strict";
import test from "node:test";
import { buildDemo } from "../../lib/demo-data.ts";
import { lockPoll, unlockPoll } from "../../lib/model.ts";
import { routeParam } from "../../lib/route-param.ts";
import { sessionHref } from "../../components/schedule.tsx";
import type { AppState } from "../../lib/types.ts";

/** What the session page does with the URL Next hands it: decode, then look the session up. */
function opens(state: AppState, href: string): boolean {
  const [, , cidRaw, , sidRaw] = href.split("/");
  const cid = routeParam(cidRaw!);
  const sid = routeParam(sidRaw!);
  return state.sessions.some((s) => s.id === sid && s.cid === cid);
}
function locked(state: AppState | { error: string }): AppState {
  assert.ok(!("error" in state), "error" in state ? state.error : "");
  return state as AppState;
}

test("lock -> the new session has a URL-safe id, the campaign's name, and its link opens", () => {
  const state = buildDemo("seth");
  const poll = state.polls.find((p) => p.id === "frost-dec")!;
  const next = locked(lockPoll(state, poll.id, "2026-12-07-18:00"));
  const sid = next.polls.find((p) => p.id === poll.id)!.sessionId!;
  const session = next.sessions.find((s) => s.id === sid)!;
  assert.match(session.id, /^[A-Za-z0-9_-]+$/);
  assert.equal(session.title, state.campaigns.find((c) => c.id === poll.cid)!.name);
  assert.notEqual(session.title, poll.title);
  assert.ok(opens(next, sessionHref(session)));
});

test("change date -> the old session is removed cleanly and the new one opens", () => {
  const state = buildDemo("seth");
  const poll = state.polls.find((p) => p.id === "frost-dec")!;
  const first = locked(lockPoll(state, poll.id, "2026-12-07-18:00"));
  const oldSid = first.polls.find((p) => p.id === poll.id)!.sessionId!;
  const reopened = unlockPoll(first, poll.id);
  assert.ok(!("error" in reopened));
  if ("error" in reopened) return;
  assert.equal(reopened.removedSessionId, oldSid);
  assert.ok(!reopened.state.sessions.some((s) => s.id === oldSid));
  const second = locked(lockPoll(reopened.state, poll.id, "2026-12-12-14:00"));
  const sid = second.polls.find((p) => p.id === poll.id)!.sessionId!;
  assert.notEqual(sid, oldSid);
  assert.equal(second.sessions.filter((s) => s.id.startsWith("frostmaiden-poll-")).length, 1);
  assert.ok(opens(second, sessionHref(second.sessions.find((s) => s.id === sid)!)));
});

test("unlock -> the session is gone and no poll points at it", () => {
  const state = buildDemo("seth");
  const first = locked(lockPoll(state, "frost-dec", "2026-12-07-18:00"));
  const sid = first.polls.find((p) => p.id === "frost-dec")!.sessionId!;
  const result = unlockPoll(first, "frost-dec");
  assert.ok(!("error" in result));
  if ("error" in result) return;
  const poll = result.state.polls.find((p) => p.id === "frost-dec")!;
  assert.equal(poll.status, "open");
  assert.equal(poll.sessionId, undefined);
  assert.ok(!result.state.sessions.some((s) => s.id === sid));
});

test("older poll sessions whose ids contain ':' still open", () => {
  const state = buildDemo("seth");
  const legacy = { ...state.sessions[0]!, id: "ghosts-of-saltmarsh-poll-2026-11-29-11:00", cid: state.sessions[0]!.cid };
  const next = { ...state, sessions: [...state.sessions, legacy] };
  const href = sessionHref(legacy);
  assert.ok(href.includes("%3A"));
  assert.ok(opens(next, href));
  // and the raw, un-encoded form Next may also hand over
  assert.ok(opens(next, `/campaigns/${legacy.cid}/sessions/${legacy.id.replace(":", "%3A")}`));
  assert.equal(routeParam("bad%E0%A4%A"), "bad%E0%A4%A");
});
