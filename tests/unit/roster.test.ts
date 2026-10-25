import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateUserInput } from "@google-cloud/firestore/build/src/serializer.js";
import { applyGuestVote, mergeVoteSeats, summarizePoll, toPublicPoll, voteSeats } from "../../lib/poll-public.ts";
import { seatsFromRoster, rosterDocument, rosterFailureMessage, unifyPlayers, seatLabel, markLinkShared, parseStoredRoster } from "../../lib/roster.ts";
import { applyClaim, parseRosterInput, buildRosterPlayer, patchRosterPlayer } from "../../lib/roster.ts";
import { SALTMARSH_ROSTER, addDemoRosterPlayer, markDemoRosterShared, resetDemoRoster } from "../../lib/roster-demo.ts";
import { demoPollRecord, resetDemoPolls } from "../../lib/poll-demo.ts";
import type { Poll } from "../../lib/types.ts";

const TOKEN = "device-token-roster-1111";
const OTHER = "device-token-roster-2222";

function saltPoll(): Poll {
  const record = demoPollRecord("saltmarsh", "salt-dates");
  assert.ok(record);
  return structuredClone(record!.poll);
}

test("roster input keeps optional contact details and rejects a bad phone", () => {
  const parsed = parseRosterInput({ name: "  Elara  ", characterName: "Elara Voss", email: "Elara@Example.com", phone: "(415) 555-0136" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.name, "Elara");
  assert.equal(parsed.value.email, "elara@example.com");
  assert.equal(parsed.value.phone, "(415) 555-0136");
  assert.equal(parseRosterInput({ name: "Elara", phone: "12" }).ok, false);
  assert.equal(parseRosterInput({ name: "" }).ok, false);
  resetDemoRoster();
  const duplicate = addDemoRosterPlayer("saltmarsh", { name: "elara" }, "rp-dup", "token-dup");
  assert.equal("error" in duplicate, true);
});

test("empty email and phone are omitted so Firestore can store the seat", () => {
  const parsed = parseRosterInput({ name: "Greg", characterName: "Gor", email: "", phone: "" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.email, undefined);
  assert.equal(parsed.value.phone, undefined);
  assert.equal(parsed.value.characterName, "Gor");
  const player = buildRosterPlayer("saltmarsh", parsed.value, "rp-greg", "token-greg");
  assert.throws(
    () => validateUserInput("data", { ...player }, "document", { allowUndefined: false }, undefined, 0, false),
    /undefined/,
  );
  const stored = rosterDocument(player);
  assert.equal("email" in stored, false);
  assert.equal("phone" in stored, false);
  assert.equal(stored.name, "Greg");
  assert.equal(stored.characterName, "Gor");
  assert.doesNotThrow(() => validateUserInput("data", stored, "document", { allowUndefined: false }, undefined, 0, false));
  const shown = rosterFailureMessage(new Error('Value for argument "data" is not a valid Firestore document. Cannot use "undefined" as a Firestore value (found in field "email").'));
  assert.match(shown, /found in field "email"/);
});

test("a seat stays not invited until the server records a copied link", () => {
  resetDemoRoster();
  const added = addDemoRosterPlayer("saltmarsh", { name: "Greg", characterName: "Gor", email: "", phone: "" }, "rp-greg", "token-greg");
  assert.equal("error" in added, false);
  if ("error" in added) return;
  assert.equal(added.linkSharedAt, undefined);
  assert.equal(seatLabel(added), "Not invited");
  assert.equal(seatLabel(SALTMARSH_ROSTER[0]!), "Joined");
  const stored = parseStoredRoster("rp-old", "saltmarsh", { name: "Greg", token: "token-old", status: "invited" });
  assert.equal(stored?.linkSharedAt, undefined);
  assert.equal(seatLabel(stored!), "Not invited");
  const when = new Date("2026-10-25T21:40:00.000Z");
  const shared = markDemoRosterShared("saltmarsh", "rp-greg", when);
  assert.equal("error" in shared, false);
  if ("error" in shared) return;
  assert.equal(shared.linkSharedAt, when.toISOString());
  assert.equal(seatLabel(shared), "Link copied");
  const edited = patchRosterPlayer(shared, { name: "Greg", characterName: "Gor" });
  assert.equal(edited.linkSharedAt, when.toISOString());
  assert.equal(seatLabel(markLinkShared(added, when)), "Link copied");
  const sharedDoc = rosterDocument(shared);
  assert.equal(sharedDoc.linkSharedAt, when.toISOString());
  assert.equal("linkSharedAt" in rosterDocument(added), false);
  assert.doesNotThrow(() => validateUserInput("data", sharedDoc, "document", { allowUndefined: false }, undefined, 0, false));
  assert.equal(parseStoredRoster("rp-bad", "saltmarsh", { name: "Greg", token: "token-bad", status: "invited", linkSharedAt: "not-a-date" })?.linkSharedAt, undefined);
  const listed = unifyPlayers(
    [{ id: "seth", displayName: "Seth", role: "organizer" }],
    [shared],
  );
  assert.equal(listed.find((row) => row.name === "Greg")?.linkSharedAt, when.toISOString());
  assert.equal(seatLabel(listed.find((row) => row.name === "Greg")!), "Link copied");
  const route = readFileSync(new URL("../../app/api/campaigns/[cid]/roster/[id]/share/route.ts", import.meta.url), "utf8");
  assert.match(route, /shareRosterLink/);
  assert.doesNotMatch(route, /linkSharedAt/);
});

test("the player list keeps joined accounts and invited seats without duplicating a name", () => {
  const rows = unifyPlayers(
    [
      { id: "seth", displayName: "Seth", role: "organizer", email: "seth@example.com" },
      { id: "mira", displayName: "Mira", role: "member" },
    ],
    SALTMARSH_ROSTER,
  );
  assert.equal(rows.filter((row) => row.name === "Seth").length, 1);
  assert.equal(rows.find((row) => row.name === "Seth")?.status, "joined");
  assert.equal(rows.find((row) => row.name === "Elara")?.status, "invited");
  assert.equal(seatLabel(rows.find((row) => row.name === "Elara")!), "Not invited");
  assert.equal(seatLabel(rows.find((row) => row.name === "Seth")!), "Joined");
  assert.equal(rows.find((row) => row.name === "Mira")?.status, "joined");
  assert.equal(rows.find((row) => row.name === "Mira")?.token, undefined);
  const seats = mergeVoteSeats(
    [{ id: "seth", displayName: "Seth" }, { id: "mira", displayName: "Mira" }],
    seatsFromRoster(SALTMARSH_ROSTER),
  );
  assert.deepEqual(seats.map((seat) => seat.displayName).sort(), ["Corin", "Elara", "Mira", "Seth"]);
  assert.equal(seats.filter((seat) => seat.id === "seth").length, 1);
});

test("claiming a seat links an existing member and creates one for a new player", () => {
  const elara = SALTMARSH_ROSTER.find((player) => player.id === "rp-elara")!;
  const linked = applyClaim(elara, SALTMARSH_ROSTER, [{ id: "seth" }], { id: "seth", email: "seth@example.com", displayName: "Seth" });
  assert.equal(linked.ok, false);
  const fresh = applyClaim(elara, SALTMARSH_ROSTER, [{ id: "seth" }], { id: "giada", email: "giada@example.com", displayName: "Giada" });
  assert.equal(fresh.ok, true);
  if (!fresh.ok) return;
  assert.equal(fresh.created, true);
  assert.equal(fresh.player.status, "joined");
  assert.equal(fresh.player.memberId, "giada");
  assert.equal(fresh.member?.displayName, "Giada");
  assert.equal(fresh.member?.characterName, "Elara Voss");
  const again = applyClaim(fresh.player, [...SALTMARSH_ROSTER.filter((player) => player.id !== "rp-elara"), fresh.player], [{ id: "seth" }, { id: "giada" }], { id: "giada", email: "giada@example.com", displayName: "Giada" });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.already, true);
  const stolen = applyClaim(fresh.player, SALTMARSH_ROSTER, [{ id: "seth" }], { id: "amy", email: "amy@example.com", displayName: "Amy" });
  assert.equal(stolen.ok, false);
});

test("an edit keeps the claim link and a patch does not drop the token", () => {
  const player = buildRosterPlayer("saltmarsh", { name: "Elara", characterName: "Elara Voss" }, "rp-x", "token-1");
  const next = patchRosterPlayer(player, { name: "Elara Quinn", email: "elara@example.com" });
  assert.equal(next.token, "token-1");
  assert.equal(next.status, "invited");
  assert.equal(next.name, "Elara Quinn");
  assert.equal(next.email, "elara@example.com");
  assert.equal(next.characterName, undefined);
});

test("poll counts and nudges use the roster, one vote per seat", async () => {
  resetDemoPolls();
  resetDemoRoster();
  const record = demoPollRecord("saltmarsh", "salt-dates");
  assert.ok(record?.roster && record.roster.length === 3);
  const seats = voteSeats(record!);
  assert.deepEqual(seats.map((seat) => seat.displayName).sort(), ["Corin", "Elara", "Seth"]);
  assert.equal(summarizePoll(record!.poll, seats).line.startsWith("0 of 3 voted"), true);

  const poll = saltPoll();
  const voted = await applyGuestVote(poll, { token: TOKEN, name: "Elara", picks: [poll.options[0].id], rosterId: "rp-elara" }, seats);
  assert.equal("error" in voted, false);
  if ("error" in voted) return;
  assert.equal(voted.poll.votes["roster:rp-elara"]?.name, "Elara");
  const summary = summarizePoll(voted.poll, seats);
  assert.equal(summary.voted, 1);
  assert.equal(summary.total, 3);
  assert.equal(summary.quiet.includes("Elara"), false);
  assert.equal(summary.quiet.includes("Corin"), true);

  const other = await applyGuestVote(voted.poll, { token: OTHER, name: "Elara", picks: [poll.options[1].id], rosterId: "rp-elara" }, seats);
  assert.equal("error" in other, true);
  if (!("error" in other)) return;
  assert.equal(other.error, "Elara already voted.");

  const edit = await applyGuestVote(voted.poll, { token: TOKEN, name: "Elara", picks: [poll.options[1].id], rosterId: "rp-elara" }, seats);
  assert.equal("error" in edit, false);
  if ("error" in edit) return;
  assert.equal(edit.edited, true);
  assert.equal(edit.poll.votes["roster:rp-elara"]?.picks[poll.options[1].id], true);

  const guest = await applyGuestVote(edit.poll, { token: OTHER, name: "Mira", picks: [poll.options[0].id] }, seats);
  assert.equal("error" in guest, false);
  if ("error" in guest) return;
  assert.ok(Object.keys(guest.poll.votes).some((id) => id.startsWith("guest:")));
  assert.equal(summarizePoll(guest.poll, seats).guests, 1);

  const view = await toPublicPoll({ ...record!, poll: edit.poll }, OTHER);
  const elara = view.players.find((player) => player.name === "Elara");
  assert.equal(elara?.taken, true);
  const mine = await toPublicPoll({ ...record!, poll: edit.poll }, TOKEN);
  assert.equal(mine.players.find((player) => player.name === "Elara")?.taken, false);
  assert.equal(mine.mine?.name, "Elara");
  assert.equal(JSON.stringify(view).includes(TOKEN), false);
  assert.equal(seatsFromRoster(SALTMARSH_ROSTER).find((seat) => seat.rosterId === "rp-seth")?.id, "seth");
});

test("roster writes stay on the server and the claim route checks the import-style bearer", () => {
  const rules = readFileSync(new URL("../../firebase/firestore.rules", import.meta.url), "utf8");
  const block = rules.match(/match \/roster\/\{rid\} \{[\s\S]*?\n {6}\}/);
  assert.ok(block);
  assert.match(block![0], /allow read, write: if false/);
  assert.match(rules, /match \/rosterTokens\/\{token\}/);
  const route = readFileSync(new URL("../../app/api/campaigns/[cid]/roster/route.ts", import.meta.url), "utf8");
  assert.match(route, /verifyBearer/);
  assert.match(route, /createRosterPlayer/);
  const claim = readFileSync(new URL("../../app/api/join/[token]/route.ts", import.meta.url), "utf8");
  assert.match(claim, /verifyBearer/);
  assert.match(claim, /claimRosterSeat/);
  const recap = readFileSync(new URL("../../app/api/import/recap/route.ts", import.meta.url), "utf8");
  assert.match(recap, /secretOk/);
});
