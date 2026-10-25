import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDemo } from "../../lib/demo-data.ts";
import { lockPoll, rankedOptions } from "../../lib/model.ts";
import { demoPollRecord, parseDemoRegistration, resetDemoPolls, saveDemoPoll } from "../../lib/poll-demo.ts";
import {
  applyGuestVote,
  cleanGuestName,
  guestTokenHash,
  optionClocks,
  optionTimeLabel,
  parseGuestBallot,
  pollPublicPath,
  pollShareCopy,
  summarizePoll,
  toPublicPoll,
  withGuestBallots,
  type PollPlayer,
} from "../../lib/poll-public.ts";
import { allowPollVote } from "../../lib/poll-vote-limit.ts";
import { resetMemoryLimits } from "../../lib/rate-limit.ts";
import { zonedTimeToUtc } from "../../lib/time.ts";
import type { Poll } from "../../lib/types.ts";

const TOKEN = "device-token-abcXYZ12";
const OTHER = "other-device-token-99";

function salt(): { poll: Poll; members: PollPlayer[] } {
  const state = buildDemo("seth");
  const poll = structuredClone(state.polls.find((item) => item.id === "salt-dates")!);
  const members = state.members.saltmarsh.map((member) => ({
    id: member.id,
    displayName: member.displayName,
    characterName: member.characterName,
  }));
  return { poll, members };
}

test("poll options show Pacific start and end times", () => {
  const start = zonedTimeToUtc("2026-11-21", "18:00", "America/Los_Angeles");
  const end = new Date(start.getTime() + 4 * 3600_000);
  assert.equal(start.toISOString(), "2026-11-22T02:00:00.000Z");
  assert.equal(optionTimeLabel({ startsAt: start.toISOString(), endsAt: end.toISOString() }), "6:00 – 10:00 PM");
  assert.equal(optionClocks({ startsAt: start.toISOString() }).time, "6:00 PM");
  assert.equal(optionClocks({ startsAt: start.toISOString(), endsAt: start.toISOString() }).time, "6:00 PM");
  const afternoon = zonedTimeToUtc("2026-12-19", "14:00", "America/Los_Angeles");
  assert.equal(optionClocks({ startsAt: afternoon.toISOString(), endsAt: new Date(afternoon.getTime() + 4 * 3600_000).toISOString() }).time, "2:00 – 6:00 PM");
  const pdt = zonedTimeToUtc("2026-10-23", "18:30", "America/Los_Angeles");
  assert.equal(optionClocks({ startsAt: pdt.toISOString(), endsAt: new Date(pdt.getTime() + 4 * 3600_000).toISOString() }).start, "6:30 PM");
});

test("a guest vote counts beside a signed-in vote and can be edited from the same device", async () => {
  const { poll, members } = salt();
  poll.votes = { seth: { picks: { "2026-11-21-18:00": true }, updatedAt: "2026-10-19T00:00:00.000Z" } };
  const first = await applyGuestVote(poll, { token: TOKEN, name: "Mira", picks: ["2026-11-21-18:00", "2026-11-29-18:00"] }, members);
  assert.ok(!("error" in first));
  if ("error" in first) return;
  assert.equal(first.edited, false);
  assert.equal(JSON.stringify(first.poll).includes(TOKEN), false);
  const hash = await guestTokenHash(TOKEN);
  const guestKey = Object.keys(first.poll.votes).find((id) => id.startsWith("guest:"));
  assert.equal(guestKey, `guest:${hash}`);
  assert.equal(first.poll.votes[guestKey!]?.guestToken, hash);
  const ranked = rankedOptions(first.poll, null);
  assert.equal(ranked.find((row) => row.option.id === "2026-11-21-18:00")?.yes, 2);
  assert.equal(ranked.find((row) => row.option.id === "2026-11-29-18:00")?.yes, 1);
  const summary = summarizePoll(first.poll, members, "seth");
  assert.equal(summary.voted, 1);
  assert.equal(summary.guests, 1);
  assert.match(summary.line, /1 of 1 voted/);
  assert.match(summary.line, /1 guest/);
  assert.deepEqual(summary.namesFor("2026-11-21-18:00").sort(), ["Mira", "You"]);

  const again = await applyGuestVote(first.poll, { token: TOKEN, name: "Mira", picks: ["2026-12-19-14:00"] }, members);
  assert.ok(!("error" in again));
  if ("error" in again) return;
  assert.equal(again.edited, true);
  assert.equal(Object.keys(again.poll.votes).length, 2);
  assert.equal(rankedOptions(again.poll, null).find((row) => row.option.id === "2026-11-21-18:00")?.yes, 1);
  assert.equal(rankedOptions(again.poll, null).find((row) => row.option.id === "2026-12-19-14:00")?.yes, 1);

  const duplicate = await applyGuestVote(again.poll, { token: OTHER, name: "mira", picks: ["2026-11-21-18:00"] }, members);
  assert.deepEqual(duplicate, { error: "Someone already voted as that name. Use the same device to change it, or add a last initial.", status: 409 });
});

test("picking a player who has not voted fills their seat, and a taken seat is refused", async () => {
  const { poll, members } = salt();
  const asSeth = await applyGuestVote(poll, { token: TOKEN, name: "Seth", picks: ["2026-11-29-18:00"] }, members);
  assert.ok(!("error" in asSeth));
  if ("error" in asSeth) return;
  assert.ok(asSeth.poll.votes.seth?.guestToken);
  assert.equal(summarizePoll(asSeth.poll, members).line, "1 of 1 voted");
  assert.equal(summarizePoll(asSeth.poll, members).guests, 0);

  const blocked = await applyGuestVote(asSeth.poll, { token: OTHER, name: "Seth", picks: ["2026-11-21-18:00"] }, members);
  assert.deepEqual(blocked, { error: "Someone already voted as that name. Use the same device to change it, or add a last initial.", status: 409 });

  const taken = await applyGuestVote(
    { ...poll, votes: { seth: { picks: { "2026-11-21-18:00": true }, updatedAt: "t" } } },
    { token: TOKEN, name: "Seth", picks: ["2026-11-29-18:00"] },
    members,
  );
  assert.deepEqual(taken, { error: "That player already voted. Sign in to change it.", status: 409 });
});

test("guest votes survive locking the leader", async () => {
  const state = buildDemo("seth");
  const { poll, members } = salt();
  const voted = await applyGuestVote(poll, { token: TOKEN, name: "Mira", picks: ["2026-11-21-18:00", "2026-11-29-18:00"] }, members);
  assert.ok(!("error" in voted));
  if ("error" in voted) return;
  const nextState = { ...state, polls: state.polls.map((item) => item.id === poll.id ? voted.poll : item) };
  const locked = lockPoll(nextState, poll.id, "2026-11-21-18:00");
  assert.ok(!("error" in locked));
  if ("error" in locked) return;
  const saved = locked.polls.find((item) => item.id === poll.id);
  assert.equal(saved?.status, "locked");
  assert.equal(saved?.chosenOptionId, "2026-11-21-18:00");
  assert.ok(Object.values(saved?.votes || {}).some((vote) => vote.name === "Mira"));
  const session = locked.sessions.find((item) => item.id === saved?.sessionId);
  assert.equal(session?.startsAt, voted.poll.options.find((option) => option.id === "2026-11-21-18:00")?.startsAt);
});

test("validation rejects empty names, bad tokens, locked polls, and unknown dates", async () => {
  const { poll, members } = salt();
  assert.deepEqual(cleanGuestName("  "), { error: "Enter your name." });
  assert.deepEqual(cleanGuestName("<script>"), { error: "Use a name with letters or numbers." });
  const named = cleanGuestName("  Mira  ");
  assert.ok("name" in named && named.name === "Mira");
  const parsed = parseGuestBallot({ token: "short", name: "Mira", picks: ["2026-11-21-18:00"] });
  assert.equal("error" in parsed && parsed.status, 400);
  const missing = await applyGuestVote(poll, { token: TOKEN, name: "Mira", picks: [] }, members);
  assert.equal("error" in missing && missing.status, 400);
  const unknown = await applyGuestVote(poll, { token: TOKEN, name: "Mira", picks: ["nope"] }, members);
  assert.equal("error" in unknown && unknown.status, 400);
  const locked = await applyGuestVote({ ...poll, status: "locked" }, { token: TOKEN, name: "Mira", picks: ["2026-11-21-18:00"] }, members);
  assert.deepEqual(locked, { error: "This poll is locked.", status: 409 });
  const ambiguous = await applyGuestVote(poll, { token: TOKEN, name: "Sam", picks: ["2026-11-21-18:00"] }, [
    { id: "a", displayName: "Sam" },
    { id: "b", displayName: "Sam" },
  ]);
  assert.equal("error" in ambiguous && ambiguous.status, 400);
});

test("public link copy and preview hide the device token", async () => {
  assert.equal(pollPublicPath("saltmarsh", "salt-dates"), "/p/saltmarsh/salt-dates");
  const { poll, members } = salt();
  const voted = await applyGuestVote(poll, { token: TOKEN, name: "Mira", picks: ["2026-11-21-18:00"] }, members);
  assert.ok(!("error" in voted));
  if ("error" in voted) return;
  const view = await toPublicPoll({ poll: voted.poll, campaignName: "Ghosts of Saltmarsh", campaignStatus: "active", members }, TOKEN);
  assert.equal(view.mine?.name, "Mira");
  assert.deepEqual(view.mine?.picks, ["2026-11-21-18:00"]);
  assert.equal(view.options[0]?.time.includes("6:00"), true);
  assert.equal(JSON.stringify(view).includes(TOKEN), false);
  assert.equal(view.guestBallots[0]?.name, "Mira");
  const copy = pollShareCopy(view);
  assert.match(copy.title, /Options\?/);
  assert.match(copy.title, /Ghosts of Saltmarsh/);
  assert.match(copy.description, /No account needed/);
  assert.match(copy.description, /6:00 PM/);
  const stranger = await toPublicPoll({ poll: voted.poll, campaignName: "Ghosts of Saltmarsh", campaignStatus: "active", members }, OTHER);
  assert.equal(stranger.mine, null);
});

test("guest ballots merge into the member poll without doubling a name", async () => {
  const { poll, members } = salt();
  poll.votes = { seth: { picks: { "2026-11-21-18:00": true }, updatedAt: "t" } };
  const merged = withGuestBallots(poll, members, [{ name: "Mira", picks: ["2026-11-29-18:00"] }, { name: "Seth", picks: ["2026-12-19-14:00"] }]);
  assert.ok(merged);
  assert.equal(rankedOptions(merged!, null).find((row) => row.option.id === "2026-11-21-18:00")?.yes, 1);
  assert.equal(rankedOptions(merged!, null).find((row) => row.option.id === "2026-11-29-18:00")?.yes, 1);
  assert.equal(summarizePoll(merged!, members).guests, 1);
  assert.equal(withGuestBallots(merged!, members, [{ name: "Mira", picks: ["2026-11-29-18:00"] }]), null);
});

test("public votes are rate limited per device", async () => {
  resetMemoryLimits();
  for (let i = 0; i < 12; i++) assert.equal(await allowPollVote(null, "203.0.113.9", TOKEN, "salt-dates"), true);
  assert.equal(await allowPollVote(null, "203.0.113.9", TOKEN, "salt-dates"), false);
  assert.equal(await allowPollVote(null, "203.0.113.10", OTHER, "salt-dates"), true);
  resetMemoryLimits();
});

test("demo memory keeps a guest vote and refuses a bad registration", async () => {
  resetDemoPolls();
  const record = demoPollRecord("saltmarsh", "salt-dates");
  assert.equal(record?.campaignName, "Ghosts of Saltmarsh");
  assert.equal(record?.poll.options.length, 3);
  const voted = await applyGuestVote(record!.poll, { token: TOKEN, name: "Mira", picks: ["2026-11-21-18:00"] }, record!.members);
  assert.ok(!("error" in voted));
  if ("error" in voted) return;
  saveDemoPoll(voted.poll, record!);
  assert.equal(Object.keys(demoPollRecord("saltmarsh", "salt-dates")!.poll.votes).length, 1);
  assert.equal("error" in parseDemoRegistration({ poll: { id: "x", cid: "y", title: "Hi", options: [] } }), true);
  resetDemoPolls();
});

test("firestore rules still refuse anonymous poll writes, and recap import stays guarded", () => {
  const rules = readFileSync(new URL("../../firebase/firestore.rules", import.meta.url), "utf8");
  const block = rules.match(/match \/polls\/\{pid\} \{[\s\S]*?\n {6}\}/);
  assert.ok(block);
  assert.match(block![0], /allow read: if isMember\(cid\)/);
  assert.match(block![0], /allow update: if isStaff\(cid\) \|\| \(isMember\(cid\) && ownVote\(\)\)/);
  assert.match(block![0], /allow create: if isStaff\(cid\)/);
  assert.doesNotMatch(block![0], /if true/);
  assert.doesNotMatch(block![0], /request\.auth == null/);
  const recap = readFileSync(new URL("../../app/api/import/recap/route.ts", import.meta.url), "utf8");
  assert.match(recap, /secretOk/);
  assert.match(recap, /parseRecapImport/);
  assert.match(recap, /publishRecap/);
});
