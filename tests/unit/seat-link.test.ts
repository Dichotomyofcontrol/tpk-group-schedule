import { test } from "node:test";
import assert from "node:assert/strict";
import { finishDestination, magicLinkContinueUrl } from "../../lib/magic-link";
import { applyClaim, seatMessage, type RosterPlayer } from "../../lib/roster";

const params = (q: string) => new URLSearchParams(q);

test("seat sign-in links come back to /join, not /invite", () => {
  const url = new URL(magicLinkContinueUrl("https://taverning.com", undefined, "mrSwSeatTok_123"));
  assert.equal(url.pathname, "/auth/finish");
  assert.equal(url.searchParams.get("seat"), "mrSwSeatTok_123");
  assert.equal(url.searchParams.get("invite"), null);
  assert.equal(finishDestination(url.searchParams), "/join/mrSwSeatTok_123");
});

test("email invites still come back to /invite", () => {
  const url = new URL(magicLinkContinueUrl("https://taverning.com", "inviteTok"));
  assert.equal(finishDestination(url.searchParams), "/invite/inviteTok");
});

test("finish falls back to the seat saved in this tab, then home", () => {
  assert.equal(finishDestination(params(""), "seatTok"), "/join/seatTok");
  assert.equal(finishDestination(params(""), null), "/");
  assert.equal(finishDestination(params("seat=../evil"), null), "/");
});

const seat: RosterPlayer = { id: "rp_1", cid: "ghosts", name: "Nick", characterName: "Dom", status: "invited", token: "tok12345", createdAt: "2026-10-25T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z", linkSharedAt: "2026-10-26T00:00:00Z" } as RosterPlayer;
const nick = { id: "uid-nick", email: "nick@example.com", displayName: "Nick" };

test("a signed-in non-member can claim a seat whose link was copied", () => {
  const out = applyClaim(seat, [seat], [{ id: "uid-seth" }], nick);
  assert.ok(out.ok);
  if (out.ok) {
    assert.equal(out.player.status, "joined");
    assert.equal(out.player.memberId, "uid-nick");
    assert.equal(out.member?.role, "member");
    assert.equal(out.created, true);
  }
});

test("a seat claimed by someone else is refused; the owner sees it as theirs", () => {
  const taken = { ...seat, memberId: "uid-other", status: "joined" } as RosterPlayer;
  const out = applyClaim(taken, [taken], [], nick);
  assert.equal(out.ok, false);
  const mine = applyClaim({ ...taken, memberId: "uid-nick" } as RosterPlayer, [], [], nick);
  assert.ok(mine.ok && mine.already);
});

test("seat messages only say claimed when someone else holds it", () => {
  assert.match(seatMessage({ claimed: false, mine: false }, false), /Sign in/);
  assert.match(seatMessage({ claimed: false, mine: false }, true), /open/);
  assert.match(seatMessage({ claimed: true, mine: true }, true), /Joined/);
  assert.match(seatMessage({ claimed: true, mine: false }, true), /Someone else/);
});
